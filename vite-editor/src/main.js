import './style.css';
import { getEmbeddedATR, ATR_FILENAME } from './embedded-atr.js';

// --- Global State ---
let atrBuffer = null;
let diskFiles = [];
let currentFile = null;
let currentFileOriginalData = null; // Store original decrypted data to preserve trailing bytes
let currentColor = 0;
let isDrawing = false;
let importedImage = null; // Store imported image for processing
let cropRect = { x: 0, y: 0, width: 160, height: 140 }; // Crop rectangle

// Atari Mode 15 Palette (NTSC - Hue 1 Orange/Gold tones)
// Based on actual game screenshot - uses warm brown/orange palette
const PALETTE = [
    {r: 0, g: 0, b: 0},         // 00 - Black (Hue 0, Lum 0)
    {r: 148, g: 108, b: 0},     // 01 - Dark Brown (Hue 1, Lum 4)
    {r: 228, g: 188, b: 124},   // 10 - Light Tan (Hue 1, Lum 8)
    {r: 255, g: 228, b: 184}    // 11 - Light Orange/Cream (Hue 1, Lum 10)
];

// --- ATR / DOS 2.0 Helpers ---
const SECTOR_SIZE = 128;
const HEADER_SIZE = 16;

function readSector(secNum) {
    const offset = HEADER_SIZE + (secNum - 1) * SECTOR_SIZE;
    return atrBuffer.slice(offset, offset + SECTOR_SIZE);
}

function writeSector(secNum, data) {
    const offset = HEADER_SIZE + (secNum - 1) * SECTOR_SIZE;
    atrBuffer.set(data, offset);
}

function parseDirectory() {
    diskFiles = [];
    const DIR_START = 361;
    const DIR_LEN = 8;
    
    for(let i=0; i<DIR_LEN; i++) {
        const sec = readSector(DIR_START + i);
        for(let entry=0; entry<SECTOR_SIZE; entry+=16) {
            const flag = sec[entry];
            if(flag === 0 || flag === 0x80) continue; 
            
            const cnt = sec[entry+1] | (sec[entry+2] << 8); 
            const startSec = sec[entry+3] | (sec[entry+4] << 8);
            
            let name = "";
            for(let j=5; j<13; j++) name += String.fromCharCode(sec[entry+j] & 0x7F);
            let ext = "";
            for(let j=13; j<16; j++) ext += String.fromCharCode(sec[entry+j] & 0x7F);
            
            name = name.trim();
            ext = ext.trim();
            const fullname = ext ? `${name}.${ext}` : name;
            
            diskFiles.push({
                name: fullname,
                startSector: startSec,
                sectorCount: cnt,
                flag: flag
            });
        }
    }
    renderFileList();
}

function getFileChain(startSector) {
    const chain = [];
    let curr = startSector;
    let limit = 720; 
    
    while(curr !== 0 && limit-- > 0) {
        chain.push(curr);
        const sec = readSector(curr);
        const linkByte = sec[125];
        const nextLow = sec[126];
        const nextHigh = linkByte & 0x03;
        curr = (nextHigh << 8) | nextLow;
    }
    return chain;
}

function readFileData(file) {
    const chain = getFileChain(file.startSector);
    let bytes = [];
    for(let secNum of chain) {
        const sec = readSector(secNum);
        const count = sec[127];
        for(let i=0; i<count; i++) bytes.push(sec[i]);
    }
    const fileData = new Uint8Array(bytes);
    // Store original file size for later validation
    file.originalSize = fileData.length;
    return fileData;
}

function writeFileData(file, data) {
    // Validate that new data matches original file size exactly
    const expectedSize = file.originalSize || 5605;
    if (data.length !== expectedSize) {
        alert(`Error: Data length mismatch. Expected ${expectedSize} bytes, got ${data.length} bytes.\nFile: ${file.name}`);
        return false;
    }

    const chain = getFileChain(file.startSector);
    let dataIdx = 0;
    for(let secNum of chain) {
        const sec = readSector(secNum);
        const count = sec[127];
        for(let i=0; i<count; i++) {
            if (dataIdx < data.length) sec[i] = data[dataIdx++];
        }
        writeSector(secNum, sec);
    }

    // Verify all data was written
    if (dataIdx !== data.length) {
        alert(`Warning: Only wrote ${dataIdx} of ${data.length} bytes!`);
        return false;
    }

    return true;
}

function getBestSeed(data) {
    let bestSeed = 0;
    let bestScore = -1;
    const sampleLen = Math.min(200, data.length);
    for(let seed=0; seed<256; seed++) {
        let solidCount = 0;
        let s = seed;
        for(let i=0; i<sampleLen; i++) {
            const val = data[i] ^ s;
            if(val === 0x00 || val === 0x55 || val === 0xAA || val === 0xFF) solidCount++;
            s = (s + 1) & 0xFF;
        }
        if (solidCount > bestScore) {
            bestScore = solidCount;
            bestSeed = seed;
        }
    }
    return bestSeed;
}

function processData(data, seed) {
    const out = new Uint8Array(data.length);
    let s = seed;
    for(let i=0; i<data.length; i++) {
        out[i] = data[i] ^ s;
        s = (s + 1) & 0xFF;
    }
    return out;
}

function renderFileList() {
    const list = document.getElementById('fileList');
    list.innerHTML = "";
    diskFiles.forEach(f => {
        const isImage = (f.name.startsWith('OP') || f.name === 'TITLE2') && (f.sectorCount > 40); 
        const li = document.createElement('li');
        li.className = 'file-item' + (isImage ? '' : ' disabled');
        li.style.opacity = isImage ? 1 : 0.5;
        li.innerHTML = `<span>${f.name}</span> <span class="size">Sec: ${f.startSector}</span>`;
        li.onclick = () => { if(isImage) selectFile(f); };
        list.appendChild(li);
    });
}

function selectFile(file) {
    document.querySelectorAll('.file-item').forEach(el => el.classList.remove('active'));
    currentFile = file;
    const rawData = readFileData(file);
    let seed = file.name === "OPP" ? 0 : getBestSeed(rawData);
    currentFile.seed = seed;
    const decrypted = processData(rawData, seed);

    // Store original decrypted data to preserve trailing bytes
    currentFileOriginalData = new Uint8Array(decrypted);

    renderImageToCanvas(decrypted);
    document.getElementById('editorControls').style.display = 'flex';
    document.getElementById('placeholder').style.display = 'none';
    document.getElementById('status').textContent = `Editing ${file.name} (${file.originalSize} bytes, Seed: 0x${seed.toString(16).toUpperCase()})`;
}

function renderImageToCanvas(data) {
    const cvs = document.getElementById('editorCanvas');
    const ctx = cvs.getContext('2d');
    const imgData = ctx.createImageData(160, 140);
    for(let i=0; i<data.length; i++) {
        const byte = data[i];
        const p0 = (byte >> 6) & 0x03;
        const p1 = (byte >> 4) & 0x03;
        const p2 = (byte >> 2) & 0x03;
        const p3 = byte & 0x03;
        const pixels = [p0, p1, p2, p3];
        const baseX = (i * 4) % 160;
        const y = Math.floor((i * 4) / 160);
        if(y >= 140) break;
        for(let p=0; p<4; p++) {
            const color = PALETTE[pixels[p]];
            const idx = (y * 160 + baseX + p) * 4;
            imgData.data[idx] = color.r;
            imgData.data[idx+1] = color.g;
            imgData.data[idx+2] = color.b;
            imgData.data[idx+3] = 255;
        }
    }
    ctx.putImageData(imgData, 0, 0);
}

function canvasToBinary() {
    if (!currentFile || !currentFile.originalSize || !currentFileOriginalData) {
        alert('Error: No file loaded or original data missing.');
        return null;
    }

    const cvs = document.getElementById('editorCanvas');
    const ctx = cvs.getContext('2d');
    const imgData = ctx.getImageData(0, 0, 160, 140);

    // Use the original file size to ensure exact match
    const fileSize = currentFile.originalSize;
    const out = new Uint8Array(fileSize);
    let byteIdx = 0;

    // Convert canvas pixels to binary (160x140 = 5600 bytes)
    for(let i=0; i<imgData.data.length; i+=16) {
        let byteVal = 0;
        for(let p=0; p<4; p++) {
            const r = imgData.data[i + p*4];
            const g = imgData.data[i + p*4 + 1];
            const b = imgData.data[i + p*4 + 2];
            let minD = Infinity; let idx = 0;
            PALETTE.forEach((c, j) => {
                const d = (r-c.r)**2 + (g-c.g)**2 + (b-c.b)**2;
                if(d < minD) { minD = d; idx = j; }
            });
            byteVal |= (idx << (6 - p*2));
        }
        if(byteIdx < fileSize) out[byteIdx++] = byteVal;
    }

    // Preserve any trailing bytes from the original file (e.g., 5 extra bytes in OP1.x files)
    // This is critical to maintain file integrity!
    while(byteIdx < fileSize) {
        out[byteIdx] = currentFileOriginalData[byteIdx];
        byteIdx++;
    }

    return out;
}

// --- Image Import & Conversion Functions ---
function getClosestPaletteColor(r, g, b) {
    let minDist = Infinity;
    let bestColor = PALETTE[0];
    PALETTE.forEach((c) => {
        // Use Euclidean distance in RGB space
        const dist = Math.sqrt(
            (r - c.r) ** 2 +
            (g - c.g) ** 2 +
            (b - c.b) ** 2
        );
        if (dist < minDist) {
            minDist = dist;
            bestColor = c;
        }
    });
    return bestColor;
}

function convertTo4Colors(imageData) {
    // Floyd-Steinberg dithering for better quality
    const width = imageData.width;
    const height = imageData.height;
    const data = new Uint8ClampedArray(imageData.data);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            const oldR = data[idx];
            const oldG = data[idx + 1];
            const oldB = data[idx + 2];

            // Find closest palette color
            const newColor = getClosestPaletteColor(oldR, oldG, oldB);

            // Set new color
            data[idx] = newColor.r;
            data[idx + 1] = newColor.g;
            data[idx + 2] = newColor.b;

            // Calculate error
            const errR = oldR - newColor.r;
            const errG = oldG - newColor.g;
            const errB = oldB - newColor.b;

            // Distribute error to neighboring pixels (Floyd-Steinberg)
            const distributeError = (dx, dy, factor) => {
                const nx = x + dx;
                const ny = y + dy;
                if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                    const nidx = (ny * width + nx) * 4;
                    data[nidx] = Math.max(0, Math.min(255, data[nidx] + errR * factor));
                    data[nidx + 1] = Math.max(0, Math.min(255, data[nidx + 1] + errG * factor));
                    data[nidx + 2] = Math.max(0, Math.min(255, data[nidx + 2] + errB * factor));
                }
            };

            distributeError(1, 0, 7/16);
            distributeError(-1, 1, 3/16);
            distributeError(0, 1, 5/16);
            distributeError(1, 1, 1/16);
        }
    }

    imageData.data.set(data);
    return imageData;
}

function resizeImage(img, mode) {
    const canvas = document.getElementById('importCanvas');
    const ctx = canvas.getContext('2d');

    // Enable image smoothing for better quality resize
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Clear canvas
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, 160, 140);

    if (mode === 'fit') {
        // Fit: maintain aspect ratio, may have letterboxing
        const scale = Math.min(160 / img.width, 140 / img.height);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const x = Math.round((160 - w) / 2);
        const y = Math.round((140 - h) / 2);

        ctx.drawImage(img, x, y, w, h);
    } else {
        // Fill: cover entire canvas, may crop
        const scale = Math.max(160 / img.width, 140 / img.height);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const x = Math.round((160 - w) / 2);
        const y = Math.round((140 - h) / 2);

        ctx.drawImage(img, x, y, w, h);
    }

    // Convert to 4 colors with dithering
    let imgData = ctx.getImageData(0, 0, 160, 140);
    imgData = convertTo4Colors(imgData);
    ctx.putImageData(imgData, 0, 0);
}

function cropImage(img) {
    const canvas = document.getElementById('importCanvas');
    const ctx = canvas.getContext('2d');

    // Enable image smoothing
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Clear canvas
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, 160, 140);

    // Calculate center crop from source image
    const srcX = Math.max(0, Math.round((img.width - 160) / 2));
    const srcY = Math.max(0, Math.round((img.height - 140) / 2));
    const srcW = Math.min(160, img.width);
    const srcH = Math.min(140, img.height);

    // Calculate destination position (center if source is smaller)
    const dstX = Math.max(0, Math.round((160 - srcW) / 2));
    const dstY = Math.max(0, Math.round((140 - srcH) / 2));

    // Draw cropped portion
    ctx.drawImage(img, srcX, srcY, srcW, srcH, dstX, dstY, srcW, srcH);

    // Convert to 4 colors with dithering
    let imgData = ctx.getImageData(0, 0, 160, 140);
    imgData = convertTo4Colors(imgData);
    ctx.putImageData(imgData, 0, 0);
}

// Event Listeners
document.getElementById('loadAtrBtn').addEventListener('click', () => document.getElementById('atrInput').click());
document.getElementById('atrInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        atrBuffer = new Uint8Array(e.target.result);
        parseDirectory();
        document.getElementById('status').textContent = `Loaded ${file.name}`;
    };
    reader.readAsArrayBuffer(file);
});

document.getElementById('saveAtrBtn').addEventListener('click', () => {
    if(!atrBuffer) return;
    const blob = new Blob([atrBuffer], {type: "application/octet-stream"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = "StripPoker_Modified.atr";
    a.click();
});

document.getElementById('clearBtn').addEventListener('click', () => {
    const ctx = document.getElementById('editorCanvas').getContext('2d');
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, 160, 140);
});

document.getElementById('commitBtn').addEventListener('click', () => {
    if(!currentFile) return;
    const rawData = canvasToBinary();
    if (!rawData) return; // Error already shown by canvasToBinary
    const encrypted = processData(rawData, currentFile.seed);
    if(writeFileData(currentFile, encrypted)) {
        alert(`✓ Updated ${currentFile.name} in memory.\nSize: ${rawData.length} bytes\nNow click "Save ATR" to download.`);
    }
});

document.getElementById('importPngBtn').addEventListener('click', () => document.getElementById('pngInput').click());
document.getElementById('pngInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if(!file) return;

    importedImage = new Image();
    importedImage.onload = () => {
        // Show import section
        document.getElementById('importSection').style.display = 'block';

        // Default: resize to fit
        resizeImage(importedImage, 'fit');
    };
    importedImage.src = URL.createObjectURL(file);
    e.target.value = ''; // Reset input
});

document.getElementById('cropBtn').addEventListener('click', () => {
    if (!importedImage) return;
    cropImage(importedImage);
});

document.getElementById('resizeFitBtn').addEventListener('click', () => {
    if (!importedImage) return;
    resizeImage(importedImage, 'fit');
});

document.getElementById('resizeFillBtn').addEventListener('click', () => {
    if (!importedImage) return;
    resizeImage(importedImage, 'fill');
});

document.getElementById('applyImportBtn').addEventListener('click', () => {
    // Copy from import canvas to editor canvas
    const importCanvas = document.getElementById('importCanvas');
    const editorCanvas = document.getElementById('editorCanvas');
    const editorCtx = editorCanvas.getContext('2d');

    editorCtx.drawImage(importCanvas, 0, 0);

    // Hide import section
    document.getElementById('importSection').style.display = 'none';
    importedImage = null;
});

document.getElementById('cancelImportBtn').addEventListener('click', () => {
    document.getElementById('importSection').style.display = 'none';
    importedImage = null;
});

document.getElementById('exportPngBtn').addEventListener('click', () => {
    if (!currentFile) {
        alert('Please select a file to export');
        return;
    }

    const canvas = document.getElementById('editorCanvas');

    // Create a temporary canvas at actual size (160x140)
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 160;
    tempCanvas.height = 140;
    const tempCtx = tempCanvas.getContext('2d');

    // Copy current canvas content
    tempCtx.drawImage(canvas, 0, 0, 160, 140);

    // Convert to blob and download
    tempCanvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${currentFile.name}.png`;
        link.click();
        URL.revokeObjectURL(url);
    }, 'image/png');
});

document.querySelectorAll('.swatch').forEach(s => {
    s.addEventListener('click', () => {
        currentColor = parseInt(s.dataset.color);
        document.querySelectorAll('.swatch').forEach(sw => sw.classList.toggle('selected', sw === s));
    });
});

const canvas = document.getElementById('editorCanvas');
const draw = (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) * (canvas.width / rect.width));
    const y = Math.floor((e.clientY - rect.top) * (canvas.height / rect.height));
    const ctx = canvas.getContext('2d');
    const c = PALETTE[currentColor];
    ctx.fillStyle = `rgb(${c.r},${c.g},${c.b})`;
    ctx.fillRect(x, y, 1, 1);
};
canvas.addEventListener('mousedown', (e) => { isDrawing = true; draw(e); });
canvas.addEventListener('mousemove', (e) => { if(isDrawing) draw(e); });
window.addEventListener('mouseup', () => isDrawing = false);

// --- Auto-load embedded ATR on startup ---
async function autoLoadEmbeddedATR() {
    try {
        console.log('Auto-loading embedded Strip Poker.atr...');
        document.getElementById('status').textContent = 'Loading embedded ATR...';

        // Get embedded ATR data
        const buffer = getEmbeddedATR();

        // Process it as if user loaded it
        atrBuffer = buffer;
        const view = new DataView(atrBuffer);

        // Parse ATR header
        const magic = view.getUint16(0, true);
        if (magic !== 0x0296) {
            throw new Error('Invalid ATR file (bad magic number)');
        }

        const paragraphs = view.getUint16(2, true);
        const sectorSize = view.getUint16(4, true);
        const imageSize = view.getUint32(6, true);

        console.log(`ATR loaded: ${paragraphs} paragraphs, sector size ${sectorSize}, image size ${imageSize}`);

        // Read directory
        diskFiles = [];
        const dirStart = 16 + (3 * 128); // Skip header + boot sectors

        for (let i = 0; i < 64; i++) {
            const entryOffset = dirStart + (i * 16);
            const flag = view.getUint8(entryOffset);

            if (flag === 0) break; // End of directory
            if ((flag & 0x80) === 0) continue; // Deleted file

            const sectorMap = view.getUint16(entryOffset + 1, true);
            const sectorCount = view.getUint16(entryOffset + 3, true);

            let name = '';
            for (let j = 0; j < 8; j++) {
                const c = view.getUint8(entryOffset + 5 + j);
                if (c !== 0x20) name += String.fromCharCode(c);
            }

            let ext = '';
            for (let j = 0; j < 3; j++) {
                const c = view.getUint8(entryOffset + 13 + j);
                if (c !== 0x20) ext += String.fromCharCode(c);
            }

            const filename = ext ? `${name}.${ext}` : name;
            diskFiles.push({ name: filename, sector: sectorMap, count: sectorCount, size: sectorCount * 125 });
        }

        console.log(`Found ${diskFiles.length} files`);

        // Update UI
        const fileList = document.getElementById('fileList');
        fileList.innerHTML = '';
        diskFiles.forEach(f => {
            const li = document.createElement('li');
            li.className = 'file-item';
            li.innerHTML = `<span>${f.name}</span><span class="size">${f.size}B</span>`;
            li.onclick = () => loadFile(f);
            fileList.appendChild(li);
        });

        document.getElementById('status').textContent = `Loaded ${ATR_FILENAME} (${diskFiles.length} files)`;
        document.getElementById('saveAtrBtn').disabled = false;

        console.log('Auto-load complete!');
    } catch (error) {
        console.error('Auto-load failed:', error);
        document.getElementById('status').textContent = `Auto-load failed: ${error.message}`;
    }
}

// Auto-load on page load
window.addEventListener('DOMContentLoaded', () => {
    autoLoadEmbeddedATR();
});
