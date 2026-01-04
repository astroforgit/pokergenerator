import './style.css';
import { getEmbeddedATR, ATR_FILENAME, EDITABLE_TEXTS, EMBEDDED_ATR_DATA } from './embedded-atr-binary.js';

// --- Global State ---
let atrBuffer = null;
let diskFiles = [];
let currentFile = null;
let currentFileOriginalData = null; // Store original decrypted data to preserve trailing bytes
let currentColor = 0;
let isDrawing = false;
let importedImage = null; // Store imported image for processing

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

// Store original image and crop selection
let originalImageData = null; // Store the original Image object
let cropSelection = { x: 0, y: 0, width: 0, height: 0 }; // Crop selection in original image coordinates
let isDraggingCrop = false;
let isMovingCrop = false;
let isResizingCrop = false;
let resizeHandle = null; // 'nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'
let cropDragStart = { x: 0, y: 0 };
let cropStartState = { x: 0, y: 0, width: 0, height: 0 };
let originalCanvasScale = 1; // Scale factor for display
let cropMode = 'auto'; // 'auto', 'fit', 'fill', 'manual'

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

// Apply brightness, contrast, and saturation adjustments
function adjustImageData(imageData, brightness, contrast, saturation) {
    const data = imageData.data;
    const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));

    for (let i = 0; i < data.length; i += 4) {
        let r = data[i];
        let g = data[i + 1];
        let b = data[i + 2];

        // Apply brightness
        r += brightness;
        g += brightness;
        b += brightness;

        // Apply contrast
        r = factor * (r - 128) + 128;
        g = factor * (g - 128) + 128;
        b = factor * (b - 128) + 128;

        // Apply saturation
        const gray = 0.2989 * r + 0.5870 * g + 0.1140 * b;
        r = gray + saturation * (r - gray);
        g = gray + saturation * (g - gray);
        b = gray + saturation * (b - gray);

        // Clamp values
        data[i] = Math.max(0, Math.min(255, r));
        data[i + 1] = Math.max(0, Math.min(255, g));
        data[i + 2] = Math.max(0, Math.min(255, b));
    }

    return imageData;
}

// Dithering algorithms
function convertTo4Colors(imageData, algorithm = 'floyd-steinberg') {
    const width = imageData.width;
    const height = imageData.height;
    const data = new Uint8ClampedArray(imageData.data);

    if (algorithm === 'none') {
        // No dithering - simple nearest color
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                const newColor = getClosestPaletteColor(data[idx], data[idx + 1], data[idx + 2]);
                data[idx] = newColor.r;
                data[idx + 1] = newColor.g;
                data[idx + 2] = newColor.b;
            }
        }
    } else if (algorithm === 'floyd-steinberg') {
        // Floyd-Steinberg dithering
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                const oldR = data[idx];
                const oldG = data[idx + 1];
                const oldB = data[idx + 2];

                const newColor = getClosestPaletteColor(oldR, oldG, oldB);
                data[idx] = newColor.r;
                data[idx + 1] = newColor.g;
                data[idx + 2] = newColor.b;

                const errR = oldR - newColor.r;
                const errG = oldG - newColor.g;
                const errB = oldB - newColor.b;

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
    } else if (algorithm === 'atkinson') {
        // Atkinson dithering (used by original Mac)
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                const oldR = data[idx];
                const oldG = data[idx + 1];
                const oldB = data[idx + 2];

                const newColor = getClosestPaletteColor(oldR, oldG, oldB);
                data[idx] = newColor.r;
                data[idx + 1] = newColor.g;
                data[idx + 2] = newColor.b;

                const errR = oldR - newColor.r;
                const errG = oldG - newColor.g;
                const errB = oldB - newColor.b;

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

                // Atkinson distributes 6/8 of error (loses 2/8)
                distributeError(1, 0, 1/8);
                distributeError(2, 0, 1/8);
                distributeError(-1, 1, 1/8);
                distributeError(0, 1, 1/8);
                distributeError(1, 1, 1/8);
                distributeError(0, 2, 1/8);
            }
        }
    } else if (algorithm === 'ordered') {
        // Ordered (Bayer) dithering with 4x4 matrix
        const bayerMatrix = [
            [0, 8, 2, 10],
            [12, 4, 14, 6],
            [3, 11, 1, 9],
            [15, 7, 13, 5]
        ];

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                const threshold = (bayerMatrix[y % 4][x % 4] / 16 - 0.5) * 64;

                const r = Math.max(0, Math.min(255, data[idx] + threshold));
                const g = Math.max(0, Math.min(255, data[idx + 1] + threshold));
                const b = Math.max(0, Math.min(255, data[idx + 2] + threshold));

                const newColor = getClosestPaletteColor(r, g, b);
                data[idx] = newColor.r;
                data[idx + 1] = newColor.g;
                data[idx + 2] = newColor.b;
            }
        }
    }

    imageData.data.set(data);
    return imageData;
}

// Draw original image on the original canvas
function drawOriginalImage() {
    if (!originalImageData) return;

    const canvas = document.getElementById('originalCanvas');
    const ctx = canvas.getContext('2d');

    // Set canvas to original image size
    canvas.width = originalImageData.width;
    canvas.height = originalImageData.height;

    // Draw the original image
    ctx.drawImage(originalImageData, 0, 0);

    // Calculate scale for display (max 800x600)
    const maxWidth = 800;
    const maxHeight = 600;
    const scaleX = maxWidth / originalImageData.width;
    const scaleY = maxHeight / originalImageData.height;
    originalCanvasScale = Math.min(scaleX, scaleY, 1); // Don't scale up

    // Set display size
    canvas.style.width = (originalImageData.width * originalCanvasScale) + 'px';
    canvas.style.height = (originalImageData.height * originalCanvasScale) + 'px';

    // Draw crop box if in manual mode
    if (cropMode === 'manual') {
        drawCropBox();
    } else {
        document.getElementById('cropBox').style.display = 'none';
    }
}

// Draw the crop selection box with resize handles
function drawCropBox() {
    const cropBox = document.getElementById('cropBox');

    if (cropSelection.width > 0 && cropSelection.height > 0) {
        cropBox.style.display = 'block';
        cropBox.style.left = (cropSelection.x * originalCanvasScale) + 'px';
        cropBox.style.top = (cropSelection.y * originalCanvasScale) + 'px';
        cropBox.style.width = (cropSelection.width * originalCanvasScale) + 'px';
        cropBox.style.height = (cropSelection.height * originalCanvasScale) + 'px';

        // Add resize handles if not already present
        if (!cropBox.querySelector('.resize-handle')) {
            const handleSize = 10;
            const handles = ['nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'];
            handles.forEach(pos => {
                const handle = document.createElement('div');
                handle.className = 'resize-handle';
                handle.dataset.position = pos;
                handle.style.position = 'absolute';
                handle.style.width = handleSize + 'px';
                handle.style.height = handleSize + 'px';
                handle.style.background = '#4CAF50';
                handle.style.border = '1px solid white';
                handle.style.pointerEvents = 'auto';
                handle.style.cursor = pos + '-resize';

                // Position handles
                if (pos.includes('n')) handle.style.top = -handleSize/2 + 'px';
                if (pos.includes('s')) handle.style.bottom = -handleSize/2 + 'px';
                if (pos.includes('w')) handle.style.left = -handleSize/2 + 'px';
                if (pos.includes('e')) handle.style.right = -handleSize/2 + 'px';
                if (pos === 'n' || pos === 's') {
                    handle.style.left = '50%';
                    handle.style.marginLeft = -handleSize/2 + 'px';
                }
                if (pos === 'e' || pos === 'w') {
                    handle.style.top = '50%';
                    handle.style.marginTop = -handleSize/2 + 'px';
                }

                cropBox.appendChild(handle);
            });

            // Add move cursor for center
            cropBox.style.cursor = 'move';
        }
    } else {
        cropBox.style.display = 'none';
    }
}

// Calculate crop area based on mode
function calculateCropArea() {
    if (!originalImageData) return { x: 0, y: 0, width: 0, height: 0 };

    const targetRatio = 160 / 140;
    const imageRatio = originalImageData.width / originalImageData.height;

    let x, y, width, height;

    if (cropMode === 'manual' && cropSelection.width > 0 && cropSelection.height > 0) {
        // Use manual crop selection
        return { ...cropSelection };
    } else if (cropMode === 'fit') {
        // Fit: entire image visible, may have black bars
        if (imageRatio > targetRatio) {
            // Image is wider - fit to width
            width = originalImageData.width;
            height = width / targetRatio;
            x = 0;
            y = (originalImageData.height - height) / 2;
        } else {
            // Image is taller - fit to height
            height = originalImageData.height;
            width = height * targetRatio;
            x = (originalImageData.width - width) / 2;
            y = 0;
        }
    } else if (cropMode === 'fill') {
        // Fill: fills entire frame, may crop image
        if (imageRatio > targetRatio) {
            // Image is wider - crop sides
            height = originalImageData.height;
            width = height * targetRatio;
            x = (originalImageData.width - width) / 2;
            y = 0;
        } else {
            // Image is taller - crop top/bottom
            width = originalImageData.width;
            height = width / targetRatio;
            x = 0;
            y = (originalImageData.height - height) / 2;
        }
    } else {
        // Auto: same as fill
        if (imageRatio > targetRatio) {
            height = originalImageData.height;
            width = height * targetRatio;
            x = (originalImageData.width - width) / 2;
            y = 0;
        } else {
            width = originalImageData.width;
            height = width / targetRatio;
            x = 0;
            y = (originalImageData.height - height) / 2;
        }
    }

    return { x, y, width, height };
}

// Update the result preview (top canvas)
function updateResultPreview() {
    if (!originalImageData) return;

    // Create temporary canvas at original image resolution
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = originalImageData.width;
    tempCanvas.height = originalImageData.height;
    const tempCtx = tempCanvas.getContext('2d');

    // Draw original image at full resolution
    tempCtx.drawImage(originalImageData, 0, 0);

    // Get image data at original resolution
    let imgData = tempCtx.getImageData(0, 0, originalImageData.width, originalImageData.height);

    // Get adjustment values
    const brightness = parseInt(document.getElementById('brightnessSlider').value);
    const contrast = parseInt(document.getElementById('contrastSlider').value);
    const saturation = parseInt(document.getElementById('saturationSlider').value) / 100;

    // Apply adjustments to ORIGINAL resolution image
    imgData = adjustImageData(imgData, brightness, contrast, saturation);

    // Put adjusted image back to temp canvas
    tempCtx.putImageData(imgData, 0, 0);

    // Determine crop area based on mode
    const crop = calculateCropArea();
    const srcX = crop.x;
    const srcY = crop.y;
    const srcW = crop.width;
    const srcH = crop.height;

    // Create final canvas for scaled output
    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = 160;
    finalCanvas.height = 140;
    const finalCtx = finalCanvas.getContext('2d');

    // Scale down cropped area to 160x140 with high quality
    finalCtx.imageSmoothingEnabled = true;
    finalCtx.imageSmoothingQuality = 'high';
    finalCtx.drawImage(tempCanvas, srcX, srcY, srcW, srcH, 0, 0, 160, 140);

    // Get scaled image data
    let scaledImgData = finalCtx.getImageData(0, 0, 160, 140);

    // Apply dithering algorithm to scaled image
    const algorithm = document.getElementById('ditheringAlgorithm').value;
    scaledImgData = convertTo4Colors(scaledImgData, algorithm);

    // Display in result preview canvas
    const resultCanvas = document.getElementById('resultCanvas');
    const resultCtx = resultCanvas.getContext('2d');
    resultCtx.fillStyle = 'black';
    resultCtx.fillRect(0, 0, 160, 140);
    resultCtx.putImageData(scaledImgData, 0, 0);
}

// Get which resize handle is under the mouse
function getResizeHandle(mouseX, mouseY) {
    if (cropSelection.width === 0 || cropSelection.height === 0) return null;

    const handleSize = 15; // Larger hit area
    const x = cropSelection.x * originalCanvasScale;
    const y = cropSelection.y * originalCanvasScale;
    const w = cropSelection.width * originalCanvasScale;
    const h = cropSelection.height * originalCanvasScale;

    // Check corners first
    if (Math.abs(mouseX - x) < handleSize && Math.abs(mouseY - y) < handleSize) return 'nw';
    if (Math.abs(mouseX - (x + w)) < handleSize && Math.abs(mouseY - y) < handleSize) return 'ne';
    if (Math.abs(mouseX - x) < handleSize && Math.abs(mouseY - (y + h)) < handleSize) return 'sw';
    if (Math.abs(mouseX - (x + w)) < handleSize && Math.abs(mouseY - (y + h)) < handleSize) return 'se';

    // Check edges
    if (Math.abs(mouseY - y) < handleSize && mouseX > x && mouseX < x + w) return 'n';
    if (Math.abs(mouseY - (y + h)) < handleSize && mouseX > x && mouseX < x + w) return 's';
    if (Math.abs(mouseX - x) < handleSize && mouseY > y && mouseY < y + h) return 'w';
    if (Math.abs(mouseX - (x + w)) < handleSize && mouseY > y && mouseY < y + h) return 'e';

    return null;
}

// Check if mouse is inside crop box
function isInsideCropBox(mouseX, mouseY) {
    if (cropSelection.width === 0 || cropSelection.height === 0) return false;

    const x = cropSelection.x * originalCanvasScale;
    const y = cropSelection.y * originalCanvasScale;
    const w = cropSelection.width * originalCanvasScale;
    const h = cropSelection.height * originalCanvasScale;

    return mouseX > x && mouseX < x + w && mouseY > y && mouseY < y + h;
}

// Setup crop selection on original canvas
function setupCropSelection() {
    const canvas = document.getElementById('originalCanvas');
    const cropBox = document.getElementById('cropBox');

    canvas.addEventListener('mousedown', (e) => {
        if (!originalImageData || cropMode !== 'manual') return;

        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const x = mouseX / originalCanvasScale;
        const y = mouseY / originalCanvasScale;

        // Check if clicking on resize handle
        resizeHandle = getResizeHandle(mouseX, mouseY);

        if (resizeHandle) {
            isResizingCrop = true;
            cropStartState = { ...cropSelection };
            cropDragStart = { x, y };
        } else if (isInsideCropBox(mouseX, mouseY)) {
            // Moving crop box
            isMovingCrop = true;
            cropDragStart = { x, y };
            cropStartState = { ...cropSelection };
        } else {
            // Creating new crop box
            isDraggingCrop = true;
            cropDragStart = { x, y };
            cropSelection = { x, y, width: 0, height: 0 };
        }
    });

    canvas.addEventListener('mousemove', (e) => {
        if (!originalImageData) return;

        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const x = mouseX / originalCanvasScale;
        const y = mouseY / originalCanvasScale;

        // Update cursor
        if (cropMode === 'manual' && !isDraggingCrop && !isMovingCrop && !isResizingCrop) {
            const handle = getResizeHandle(mouseX, mouseY);
            if (handle) {
                canvas.style.cursor = handle + '-resize';
            } else if (isInsideCropBox(mouseX, mouseY)) {
                canvas.style.cursor = 'move';
            } else {
                canvas.style.cursor = 'crosshair';
            }
        }

        if (isMovingCrop) {
            // Move crop box
            const dx = x - cropDragStart.x;
            const dy = y - cropDragStart.y;

            cropSelection.x = cropStartState.x + dx;
            cropSelection.y = cropStartState.y + dy;

            // Clamp to image bounds
            cropSelection.x = Math.max(0, Math.min(cropSelection.x, originalImageData.width - cropSelection.width));
            cropSelection.y = Math.max(0, Math.min(cropSelection.y, originalImageData.height - cropSelection.height));

            drawCropBox();
        } else if (isResizingCrop) {
            // Resize crop box
            const dx = x - cropDragStart.x;
            const dy = y - cropDragStart.y;
            const targetRatio = 160 / 140;

            let newX = cropStartState.x;
            let newY = cropStartState.y;
            let newW = cropStartState.width;
            let newH = cropStartState.height;

            // Apply resize based on handle
            if (resizeHandle.includes('e')) newW = cropStartState.width + dx;
            if (resizeHandle.includes('w')) { newW = cropStartState.width - dx; newX = cropStartState.x + dx; }
            if (resizeHandle.includes('s')) newH = cropStartState.height + dy;
            if (resizeHandle.includes('n')) { newH = cropStartState.height - dy; newY = cropStartState.y + dy; }

            // Maintain aspect ratio
            if (resizeHandle.length === 2) { // Corner handles
                // Use the larger dimension change
                if (Math.abs(newW / cropStartState.width) > Math.abs(newH / cropStartState.height)) {
                    newH = newW / targetRatio;
                    if (resizeHandle.includes('n')) newY = cropStartState.y + cropStartState.height - newH;
                } else {
                    newW = newH * targetRatio;
                    if (resizeHandle.includes('w')) newX = cropStartState.x + cropStartState.width - newW;
                }
            } else { // Edge handles
                if (resizeHandle === 'e' || resizeHandle === 'w') {
                    newH = newW / targetRatio;
                } else {
                    newW = newH * targetRatio;
                }
                if (resizeHandle === 'w') newX = cropStartState.x + cropStartState.width - newW;
                if (resizeHandle === 'n') newY = cropStartState.y + cropStartState.height - newH;
            }

            // Ensure minimum size
            if (newW > 10 && newH > 10) {
                cropSelection = { x: newX, y: newY, width: newW, height: newH };

                // Clamp to image bounds
                if (cropSelection.x < 0) { cropSelection.width += cropSelection.x; cropSelection.x = 0; }
                if (cropSelection.y < 0) { cropSelection.height += cropSelection.y; cropSelection.y = 0; }
                if (cropSelection.x + cropSelection.width > originalImageData.width) {
                    cropSelection.width = originalImageData.width - cropSelection.x;
                }
                if (cropSelection.y + cropSelection.height > originalImageData.height) {
                    cropSelection.height = originalImageData.height - cropSelection.y;
                }

                drawCropBox();
            }
        } else if (isDraggingCrop) {
            // Creating new crop box
            let width = x - cropDragStart.x;
            let height = y - cropDragStart.y;

            // Maintain aspect ratio
            const targetRatio = 160 / 140;
            if (Math.abs(width / height) > targetRatio) {
                width = height * targetRatio * Math.sign(width);
            } else {
                height = width / targetRatio * Math.sign(height);
            }

            cropSelection = {
                x: width < 0 ? cropDragStart.x + width : cropDragStart.x,
                y: height < 0 ? cropDragStart.y + height : cropDragStart.y,
                width: Math.abs(width),
                height: Math.abs(height)
            };

            // Clamp to image bounds
            cropSelection.x = Math.max(0, Math.min(cropSelection.x, originalImageData.width - cropSelection.width));
            cropSelection.y = Math.max(0, Math.min(cropSelection.y, originalImageData.height - cropSelection.height));
            cropSelection.width = Math.min(cropSelection.width, originalImageData.width - cropSelection.x);
            cropSelection.height = Math.min(cropSelection.height, originalImageData.height - cropSelection.y);

            drawCropBox();
        }
    });

    canvas.addEventListener('mouseup', () => {
        if (isDraggingCrop || isMovingCrop || isResizingCrop) {
            isDraggingCrop = false;
            isMovingCrop = false;
            isResizingCrop = false;
            resizeHandle = null;
            updateResultPreview();
        }
    });

    canvas.addEventListener('mouseleave', () => {
        if (isDraggingCrop || isMovingCrop || isResizingCrop) {
            isDraggingCrop = false;
            isMovingCrop = false;
            isResizingCrop = false;
            resizeHandle = null;
            updateResultPreview();
        }
    });
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

    const img = new Image();
    img.onload = () => {
        // Store original image
        originalImageData = img;
        importedImage = img; // Keep for compatibility

        // Reset crop selection and mode
        cropSelection = { x: 0, y: 0, width: 0, height: 0 };
        cropMode = 'fill'; // Default to fill mode

        // Show import section
        document.getElementById('importSection').style.display = 'block';

        // Reset adjustments to defaults
        document.getElementById('brightnessSlider').value = 0;
        document.getElementById('contrastSlider').value = 0;
        document.getElementById('saturationSlider').value = 100;
        document.getElementById('ditheringAlgorithm').value = 'floyd-steinberg';
        document.getElementById('brightnessValue').textContent = '0';
        document.getElementById('contrastValue').textContent = '0';
        document.getElementById('saturationValue').textContent = '1.0';

        // Update button states
        updateCropModeButtons();

        // Draw original image on bottom canvas
        drawOriginalImage();

        // Update result preview on top canvas
        updateResultPreview();
    };
    img.src = URL.createObjectURL(file);
    e.target.value = ''; // Reset input
});

// Image adjustment sliders
document.getElementById('brightnessSlider').addEventListener('input', (e) => {
    document.getElementById('brightnessValue').textContent = e.target.value;
    if (originalImageData) updateResultPreview();
});

document.getElementById('contrastSlider').addEventListener('input', (e) => {
    document.getElementById('contrastValue').textContent = e.target.value;
    if (originalImageData) updateResultPreview();
});

document.getElementById('saturationSlider').addEventListener('input', (e) => {
    const value = (parseInt(e.target.value) / 100).toFixed(1);
    document.getElementById('saturationValue').textContent = value;
    if (originalImageData) updateResultPreview();
});

document.getElementById('ditheringAlgorithm').addEventListener('change', () => {
    if (originalImageData) updateResultPreview();
});

document.getElementById('resetAdjustmentsBtn').addEventListener('click', () => {
    document.getElementById('brightnessSlider').value = 0;
    document.getElementById('contrastSlider').value = 0;
    document.getElementById('saturationSlider').value = 100;
    document.getElementById('ditheringAlgorithm').value = 'floyd-steinberg';
    document.getElementById('brightnessValue').textContent = '0';
    document.getElementById('contrastValue').textContent = '0';
    document.getElementById('saturationValue').textContent = '1.0';
    if (originalImageData) updateResultPreview();
});

// Update crop mode button states
function updateCropModeButtons() {
    const autoBtn = document.getElementById('autoFillBtn');
    const fitBtn = document.getElementById('fitBtn');
    const manualBtn = document.getElementById('manualCropBtn');
    const helpText = document.getElementById('cropModeHelp');

    // Reset all buttons
    [autoBtn, fitBtn, manualBtn].forEach(btn => {
        btn.classList.remove('primary');
        btn.style.background = '#444';
    });

    // Highlight active button
    if (cropMode === 'fill') {
        autoBtn.classList.add('primary');
        autoBtn.style.background = '#005a9e';
        helpText.textContent = 'Auto Fill: Fills frame, may crop edges to preserve aspect ratio';
    } else if (cropMode === 'fit') {
        fitBtn.classList.add('primary');
        fitBtn.style.background = '#005a9e';
        helpText.textContent = 'Fit: Shows entire image, may have black bars';
    } else if (cropMode === 'manual') {
        manualBtn.classList.add('primary');
        manualBtn.style.background = '#005a9e';
        helpText.textContent = 'Manual Crop: Drag to create crop area, drag edges/corners to resize, drag center to move';
    }
}

// Crop mode buttons
document.getElementById('autoFillBtn').addEventListener('click', () => {
    cropMode = 'fill';
    cropSelection = { x: 0, y: 0, width: 0, height: 0 };
    updateCropModeButtons();
    drawOriginalImage();
    updateResultPreview();
});

document.getElementById('fitBtn').addEventListener('click', () => {
    cropMode = 'fit';
    cropSelection = { x: 0, y: 0, width: 0, height: 0 };
    updateCropModeButtons();
    drawOriginalImage();
    updateResultPreview();
});

document.getElementById('manualCropBtn').addEventListener('click', () => {
    cropMode = 'manual';
    // Initialize crop to full image with correct aspect ratio
    const crop = calculateCropArea();
    cropSelection = { ...crop };
    updateCropModeButtons();
    drawOriginalImage();
    updateResultPreview();
});



document.getElementById('applyImportBtn').addEventListener('click', () => {
    // Copy from result canvas to editor canvas
    const resultCanvas = document.getElementById('resultCanvas');
    const editorCanvas = document.getElementById('editorCanvas');
    const editorCtx = editorCanvas.getContext('2d');

    editorCtx.drawImage(resultCanvas, 0, 0);

    // Hide import section
    document.getElementById('importSection').style.display = 'none';
    importedImage = null;
    originalImageData = null;
    cropSelection = { x: 0, y: 0, width: 0, height: 0 };
});

document.getElementById('cancelImportBtn').addEventListener('click', () => {
    document.getElementById('importSection').style.display = 'none';
    importedImage = null;
    originalImageData = null;
    cropSelection = { x: 0, y: 0, width: 0, height: 0 };
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
        console.log('Loading embedded Strip Poker.atr...');
        document.getElementById('status').textContent = 'Loading embedded ATR...';

        // Get embedded ATR data (already a Uint8Array)
        atrBuffer = new Uint8Array(getEmbeddedATR());

        console.log(`ATR buffer loaded: ${atrBuffer.length} bytes`);
        console.log(`First 16 bytes: ${Array.from(atrBuffer.slice(0, 16)).join(',')}`);

        // Use the same parseDirectory function as file loading
        parseDirectory();

        console.log(`Parsed ${diskFiles.length} files`);
        diskFiles.forEach(f => console.log(`  - ${f.name}: sector ${f.startSector}, count ${f.sectorCount}`));

        document.getElementById('status').textContent = `Loaded ${ATR_FILENAME} (${diskFiles.length} files)`;
        document.getElementById('saveAtrBtn').disabled = false;

        // Show tabs and initialize text editor
        document.getElementById('tabNav').style.display = 'block';
        showTab('image');
        initializeTextEditor();

        console.log('Load complete!');
    } catch (error) {
        console.error('Load failed:', error);
        console.error('Stack trace:', error.stack);
        document.getElementById('status').textContent = `Load failed: ${error.message}`;
    }
}

// --- Tab Switching ---
function showTab(tabName) {
    const imageTab = document.getElementById('imageEditorTab');
    const textTab = document.getElementById('textEditorTab');
    const imageBtn = document.getElementById('imageTabBtn');
    const textBtn = document.getElementById('textTabBtn');

    if (tabName === 'image') {
        imageTab.style.display = 'block';
        textTab.style.display = 'none';
        imageBtn.classList.add('active');
        textBtn.classList.remove('active');
        imageBtn.style.borderBottom = '3px solid #4CAF50';
        textBtn.style.borderBottom = '3px solid transparent';
    } else {
        imageTab.style.display = 'none';
        textTab.style.display = 'block';
        imageBtn.classList.remove('active');
        textBtn.classList.add('active');
        imageBtn.style.borderBottom = '3px solid transparent';
        textBtn.style.borderBottom = '3px solid #4CAF50';
    }
}

document.getElementById('imageTabBtn').addEventListener('click', () => showTab('image'));
document.getElementById('textTabBtn').addEventListener('click', () => showTab('text'));

// --- Text Editor Functions ---

// Helper function to read a complete file from disk (handles sector chains)
function readCompleteFile(fileName) {
    const file = diskFiles.find(f => f.name === fileName);
    if (!file) return null;

    const data = readFileData(file);
    return data;
}

// Helper function to write a complete file to disk (handles sector chains)
function writeCompleteFile(fileName, data) {
    const file = diskFiles.find(f => f.name === fileName);
    if (!file) return false;

    const chain = getFileChain(file.startSector);
    let dataPos = 0;

    for (let i = 0; i < chain.length && dataPos < data.length; i++) {
        const sector = readSector(chain[i]);
        const bytesToWrite = Math.min(125, data.length - dataPos);

        // Write data bytes
        for (let j = 0; j < bytesToWrite; j++) {
            sector[j] = data[dataPos++];
        }

        // Update byte count
        sector[127] = bytesToWrite;

        // Write sector back
        writeSector(chain[i], sector);
    }

    return true;
}

// Load COM file texts
function loadCOMTexts() {
    const comTexts = { COM1: [], COM2: [] };

    for (const fileName of ['COM1', 'COM2']) {
        const data = readCompleteFile(fileName);
        if (data) {
            // Each comment is 30 chars, there are 30 comments (900 bytes total)
            for (let i = 0; i < 30; i++) {
                const start = i * 30;
                const text = String.fromCharCode(...data.slice(start, start + 30));
                comTexts[fileName].push(text);
            }
        }
    }

    return comTexts;
}

function initializeTextEditor() {
    const container = document.getElementById('textEditorList');
    container.innerHTML = '';

    // Add section for embedded texts
    const embeddedSection = document.createElement('div');
    embeddedSection.innerHTML = '<h3 style="color: #4CAF50; margin: 20px 0 10px 0;">Game Messages</h3>';
    container.appendChild(embeddedSection);

    EDITABLE_TEXTS.forEach((textDef, index) => {
        const div = document.createElement('div');
        div.style.cssText = 'padding: 15px; background: #2a2a2a; border-radius: 5px; margin-bottom: 10px;';

        const label = document.createElement('label');
        label.style.cssText = 'display: block; margin-bottom: 5px; color: #aaa; font-size: 0.9rem;';
        label.textContent = `${textDef.description} (${textDef.length} chars)`;

        const input = document.createElement('input');
        input.type = 'text';
        input.id = `text_${index}`;
        input.value = textDef.text;
        input.maxLength = textDef.length;
        input.style.cssText = 'width: 100%; padding: 8px; background: #1a1a1a; color: #fff; border: 1px solid #555; border-radius: 3px; font-family: monospace; font-size: 1rem;';

        const charCount = document.createElement('span');
        charCount.id = `charCount_${index}`;
        charCount.style.cssText = 'display: block; margin-top: 5px; font-size: 0.8rem; color: #888;';
        charCount.textContent = `${textDef.text.length} / ${textDef.length} characters`;

        input.addEventListener('input', () => {
            const len = input.value.length;
            const max = textDef.length;
            charCount.textContent = `${len} / ${max} characters`;

            if (len === max) {
                charCount.style.color = '#4CAF50';
            } else if (len < max) {
                charCount.style.color = '#ff9800';
            } else {
                charCount.style.color = '#f44336';
            }
        });

        div.appendChild(label);
        div.appendChild(input);
        div.appendChild(charCount);
        container.appendChild(div);
    });

    // Add section for COM1 comments
    const com1Section = document.createElement('div');
    com1Section.innerHTML = '<h3 style="color: #4CAF50; margin: 30px 0 10px 0;">COM1 - Opponent Comments (Set 1)</h3>';
    container.appendChild(com1Section);

    const comTexts = loadCOMTexts();

    comTexts.COM1.forEach((text, index) => {
        const div = document.createElement('div');
        div.style.cssText = 'padding: 15px; background: #2a2a2a; border-radius: 5px; margin-bottom: 10px;';

        const label = document.createElement('label');
        label.style.cssText = 'display: block; margin-bottom: 5px; color: #aaa; font-size: 0.9rem;';
        label.textContent = `Comment ${index + 1} (30 chars)`;

        const input = document.createElement('input');
        input.type = 'text';
        input.id = `com1_${index}`;
        input.value = text;
        input.maxLength = 30;
        input.style.cssText = 'width: 100%; padding: 8px; background: #1a1a1a; color: #fff; border: 1px solid #555; border-radius: 3px; font-family: monospace; font-size: 1rem;';

        const charCount = document.createElement('span');
        charCount.id = `com1Count_${index}`;
        charCount.style.cssText = 'display: block; margin-top: 5px; font-size: 0.8rem; color: #888;';
        charCount.textContent = `${text.length} / 30 characters`;

        input.addEventListener('input', () => {
            const len = input.value.length;
            charCount.textContent = `${len} / 30 characters`;
            charCount.style.color = len === 30 ? '#4CAF50' : (len < 30 ? '#ff9800' : '#f44336');
        });

        div.appendChild(label);
        div.appendChild(input);
        div.appendChild(charCount);
        container.appendChild(div);
    });

    // Add section for COM2 comments
    const com2Section = document.createElement('div');
    com2Section.innerHTML = '<h3 style="color: #4CAF50; margin: 30px 0 10px 0;">COM2 - Opponent Comments (Set 2)</h3>';
    container.appendChild(com2Section);

    comTexts.COM2.forEach((text, index) => {
        const div = document.createElement('div');
        div.style.cssText = 'padding: 15px; background: #2a2a2a; border-radius: 5px; margin-bottom: 10px;';

        const label = document.createElement('label');
        label.style.cssText = 'display: block; margin-bottom: 5px; color: #aaa; font-size: 0.9rem;';
        label.textContent = `Comment ${index + 1} (30 chars)`;

        const input = document.createElement('input');
        input.type = 'text';
        input.id = `com2_${index}`;
        input.value = text;
        input.maxLength = 30;
        input.style.cssText = 'width: 100%; padding: 8px; background: #1a1a1a; color: #fff; border: 1px solid #555; border-radius: 3px; font-family: monospace; font-size: 1rem;';

        const charCount = document.createElement('span');
        charCount.id = `com2Count_${index}`;
        charCount.style.cssText = 'display: block; margin-top: 5px; font-size: 0.8rem; color: #888;';
        charCount.textContent = `${text.length} / 30 characters`;

        input.addEventListener('input', () => {
            const len = input.value.length;
            charCount.textContent = `${len} / 30 characters`;
            charCount.style.color = len === 30 ? '#4CAF50' : (len < 30 ? '#ff9800' : '#f44336');
        });

        div.appendChild(label);
        div.appendChild(input);
        div.appendChild(charCount);
        container.appendChild(div);
    });
}

function saveTextChanges() {
    if (!atrBuffer) {
        alert('No ATR loaded!');
        return;
    }

    let changedCount = 0;
    const errors = [];

    // Save embedded texts
    EDITABLE_TEXTS.forEach((textDef, index) => {
        const input = document.getElementById(`text_${index}`);
        const newText = input.value;

        // Validate length
        if (newText.length !== textDef.length) {
            errors.push(`"${textDef.description}" must be exactly ${textDef.length} characters (currently ${newText.length})`);
            return;
        }

        // Check if changed
        if (newText !== textDef.text) {
            // Write to ATR buffer
            const bytes = new TextEncoder().encode(newText);
            for (let i = 0; i < bytes.length; i++) {
                atrBuffer[textDef.offset + i] = bytes[i];
            }
            changedCount++;

            // Update the definition for future comparisons
            textDef.text = newText;
        }
    });

    // Save COM1 texts
    const com1Data = [];
    for (let i = 0; i < 30; i++) {
        const input = document.getElementById(`com1_${i}`);
        const newText = input.value;

        if (newText.length !== 30) {
            errors.push(`COM1 Comment ${i + 1} must be exactly 30 characters (currently ${newText.length})`);
            continue;
        }

        // Convert to bytes
        for (let j = 0; j < 30; j++) {
            com1Data.push(newText.charCodeAt(j));
        }
    }

    if (com1Data.length === 900) {
        if (writeCompleteFile('COM1', com1Data)) {
            changedCount++;
        }
    }

    // Save COM2 texts
    const com2Data = [];
    for (let i = 0; i < 30; i++) {
        const input = document.getElementById(`com2_${i}`);
        const newText = input.value;

        if (newText.length !== 30) {
            errors.push(`COM2 Comment ${i + 1} must be exactly 30 characters (currently ${newText.length})`);
            continue;
        }

        // Convert to bytes
        for (let j = 0; j < 30; j++) {
            com2Data.push(newText.charCodeAt(j));
        }
    }

    if (com2Data.length === 900) {
        if (writeCompleteFile('COM2', com2Data)) {
            changedCount++;
        }
    }

    if (errors.length > 0) {
        alert('⚠️ Cannot save - length errors:\n\n' + errors.join('\n'));
        return;
    }

    if (changedCount === 0) {
        alert('No changes detected.');
        return;
    }

    alert(`✓ Saved ${changedCount} text change(s) to memory.\n\nNow click "Download Modified ATR" to save the file.`);
}

document.getElementById('saveTextsBtn').addEventListener('click', saveTextChanges);

// Help button
document.getElementById('helpBtn').addEventListener('click', () => {
    document.getElementById('helpModal').style.display = 'block';
});

document.getElementById('closeHelpBtn').addEventListener('click', () => {
    document.getElementById('helpModal').style.display = 'none';
});

// Close help modal when clicking outside
document.getElementById('helpModal').addEventListener('click', (e) => {
    if (e.target.id === 'helpModal') {
        document.getElementById('helpModal').style.display = 'none';
    }
});

// Close help modal with Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.getElementById('helpModal').style.display === 'block') {
        document.getElementById('helpModal').style.display = 'none';
    }
});

// Auto-load embedded ATR on page load
window.addEventListener('DOMContentLoaded', () => {
    console.log('Page loaded, auto-loading embedded ATR...');
    autoLoadEmbeddedATR();

    // Setup crop selection on original canvas
    setupCropSelection();
});
