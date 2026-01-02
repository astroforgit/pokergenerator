// Test script to verify image round-trip (load -> decode -> encode -> save)
// This simulates what the editor does to ensure no data corruption

const fs = require('fs');

// Atari Mode 15 Palette
const PALETTE = [
    {r: 0, g: 0, b: 0},       // 00
    {r: 255, g: 180, b: 140}, // 01
    {r: 80, g: 80, b: 255},   // 10
    {r: 255, g: 255, b: 255}  // 11
];

const SECTOR_SIZE = 128;
const HEADER_SIZE = 16;

// Load ATR file
function loadATR(filename) {
    return fs.readFileSync(filename);
}

function readSector(atrBuffer, secNum) {
    const offset = HEADER_SIZE + (secNum - 1) * SECTOR_SIZE;
    return atrBuffer.slice(offset, offset + SECTOR_SIZE);
}

function writeSector(atrBuffer, secNum, data) {
    const offset = HEADER_SIZE + (secNum - 1) * SECTOR_SIZE;
    data.copy(atrBuffer, offset);
}

function getFileChain(atrBuffer, startSector) {
    const chain = [];
    let curr = startSector;
    let limit = 720;
    
    while(curr !== 0 && limit-- > 0) {
        chain.push(curr);
        const sec = readSector(atrBuffer, curr);
        const linkByte = sec[125];
        const nextLow = sec[126];
        const nextHigh = linkByte & 0x03;
        curr = (nextHigh << 8) | nextLow;
    }
    return chain;
}

function readFileData(atrBuffer, startSector) {
    const chain = getFileChain(atrBuffer, startSector);
    let bytes = [];
    for(let secNum of chain) {
        const sec = readSector(atrBuffer, secNum);
        const count = sec[127];
        for(let i=0; i<count; i++) bytes.push(sec[i]);
    }
    return Buffer.from(bytes);
}

function writeFileData(atrBuffer, startSector, data) {
    const chain = getFileChain(atrBuffer, startSector);
    let dataIdx = 0;
    for(let secNum of chain) {
        const sec = Buffer.from(readSector(atrBuffer, secNum));
        const count = sec[127];
        for(let i=0; i<count; i++) {
            if (dataIdx < data.length) sec[i] = data[dataIdx++];
        }
        writeSector(atrBuffer, secNum, sec);
    }
    return dataIdx;
}

// Decrypt/Encrypt with XOR
function processData(data, seed) {
    const out = Buffer.alloc(data.length);
    let s = seed;
    for(let i=0; i<data.length; i++) {
        out[i] = data[i] ^ s;
        s = (s + 1) & 0xFF;
    }
    return out;
}

// Decode binary to pixel data (simulating canvas)
function binaryToPixels(data) {
    const pixels = [];
    for(let i=0; i<data.length; i++) {
        const byte = data[i];
        pixels.push((byte >> 6) & 0x03);
        pixels.push((byte >> 4) & 0x03);
        pixels.push((byte >> 2) & 0x03);
        pixels.push(byte & 0x03);
    }
    return pixels;
}

// Encode pixels back to binary (simulating canvasToBinary)
function pixelsToBinary(pixels, targetSize, originalData) {
    const out = Buffer.alloc(targetSize);
    let byteIdx = 0;

    // Convert pixels to bytes (160x140 = 5600 bytes)
    for(let i=0; i<pixels.length && i<22400; i+=4) { // 22400 pixels = 5600 bytes
        let byteVal = 0;
        byteVal |= (pixels[i] << 6);
        byteVal |= (pixels[i+1] << 4);
        byteVal |= (pixels[i+2] << 2);
        byteVal |= pixels[i+3];
        if(byteIdx < targetSize) out[byteIdx++] = byteVal;
    }

    // Preserve trailing bytes from original data (critical for OP1.x files!)
    while(byteIdx < targetSize) {
        out[byteIdx] = originalData[byteIdx];
        byteIdx++;
    }

    return out;
}

// Test function
function testRoundTrip(atrFile, startSector, fileName, seed) {
    console.log(`\n=== Testing ${fileName} ===`);
    
    const atrBuffer = loadATR(atrFile);
    
    // Step 1: Read encrypted file
    const encryptedOriginal = readFileData(atrBuffer, startSector);
    console.log(`1. Read encrypted file: ${encryptedOriginal.length} bytes`);
    
    // Step 2: Decrypt
    const decrypted = processData(encryptedOriginal, seed);
    console.log(`2. Decrypted: ${decrypted.length} bytes`);
    
    // Step 3: Convert to pixels (simulating canvas rendering)
    const pixels = binaryToPixels(decrypted);
    console.log(`3. Converted to pixels: ${pixels.length} pixels`);

    // Step 4: Convert back to binary (simulating canvasToBinary with trailing byte preservation)
    const reencoded = pixelsToBinary(pixels, encryptedOriginal.length, decrypted);
    console.log(`4. Re-encoded to binary: ${reencoded.length} bytes`);
    
    // Step 5: Re-encrypt
    const reencrypted = processData(reencoded, seed);
    console.log(`5. Re-encrypted: ${reencrypted.length} bytes`);
    
    // Step 6: Compare
    const matches = encryptedOriginal.equals(reencrypted);
    console.log(`6. Data matches original: ${matches ? '✓ YES' : '✗ NO'}`);
    
    if (!matches) {
        // Find first difference
        for(let i=0; i<encryptedOriginal.length; i++) {
            if(encryptedOriginal[i] !== reencrypted[i]) {
                console.log(`   First difference at byte ${i}: ${encryptedOriginal[i].toString(16)} -> ${reencrypted[i].toString(16)}`);
                break;
            }
        }
        
        // Save for inspection
        fs.writeFileSync(`test_${fileName}_original.bin`, encryptedOriginal);
        fs.writeFileSync(`test_${fileName}_reencoded.bin`, reencrypted);
        console.log(`   Saved test files for comparison`);
    }
    
    return matches;
}

// Run tests
console.log('Testing ATR Round-Trip Processing...');

const tests = [
    { file: 'Strip Poker.atr', sector: 600, name: 'OP1.1', seed: 0x32 },
    { file: 'Strip Poker.atr', sector: 462, name: 'OP1.2', seed: 0x32 },
    { file: 'Strip Poker.atr', sector: 130, name: 'OPP', seed: 0x00 },
    { file: 'Strip Poker.atr', sector: 85, name: 'TITLE2', seed: 0xBB }
];

let allPassed = true;
for(const test of tests) {
    const passed = testRoundTrip(test.file, test.sector, test.name, test.seed);
    if (!passed) allPassed = false;
}

console.log(`\n${'='.repeat(50)}`);
console.log(allPassed ? '✓ All tests PASSED' : '✗ Some tests FAILED');
console.log('='.repeat(50));

