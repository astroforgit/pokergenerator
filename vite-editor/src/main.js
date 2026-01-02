import './style.css';

// --- Global State ---
let atrBuffer = null;
let diskFiles = [];
let currentFile = null;
let currentColor = 1;
let isDrawing = false;

// Atari Mode 15 Palette
const PALETTE = [
    {r: 0, g: 0, b: 0},       // 00
    {r: 255, g: 180, b: 140}, // 01
    {r: 80, g: 80, b: 255},   // 10
    {r: 255, g: 255, b: 255}  // 11
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
    if (!currentFile || !currentFile.originalSize) {
        alert('Error: No file loaded or file size unknown.');
        return null;
    }

    const cvs = document.getElementById('editorCanvas');
    const ctx = cvs.getContext('2d');
    const imgData = ctx.getImageData(0, 0, 160, 140);

    // Use the original file size to ensure exact match
    const fileSize = currentFile.originalSize;
    const out = new Uint8Array(fileSize);
    let byteIdx = 0;

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

    // Fill any remaining bytes with zeros (should only happen for 5605-byte files)
    while(byteIdx < fileSize) {
        out[byteIdx++] = 0;
    }

    return out;
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
    img.onload = () => document.getElementById('editorCanvas').getContext('2d').drawImage(img, 0, 0, 160, 140);
    img.src = URL.createObjectURL(file);
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
