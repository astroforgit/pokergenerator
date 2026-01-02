const fs = require('fs');
const { PNG } = require('pngjs');
const path = require('path');

// Atari Mode 15 Palette (Approximate)
// 00: Black
// 01: Peach/Skin (R=255, G=180, B=140)
// 10: Blue (R=80, G=80, B=255)
// 11: White (R=255, G=255, B=255)
const PALETTE = [
    { r: 0, g: 0, b: 0, val: 0 },
    { r: 255, g: 180, b: 140, val: 1 },
    { r: 80, g: 80, b: 255, val: 2 },
    { r: 255, g: 255, b: 255, val: 3 }
];

const TARGET_WIDTH = 160;
const TARGET_HEIGHT = 140; // 5600 bytes / 40 bytes per line
const FILE_SIZE = 5605;    // Standard file size found on disk

function getClosestColorIndex(r, g, b) {
    let minDist = Infinity;
    let bestIdx = 0;
    
    for (let i = 0; i < PALETTE.length; i++) {
        const c = PALETTE[i];
        const dist = Math.pow(r - c.r, 2) + Math.pow(g - c.g, 2) + Math.pow(b - c.b, 2);
        if (dist < minDist) {
            minDist = dist;
            bestIdx = c.val;
        }
    }
    return bestIdx;
}

function encrypt(inputPath, outputPath, seed) {
    console.log(`Encrypting ${inputPath} to ${outputPath} with Seed 0x${seed.toString(16)}...`);
    
    fs.createReadStream(inputPath)
        .pipe(new PNG())
        .on('parsed', function() {
            if (this.width !== TARGET_WIDTH || this.height !== TARGET_HEIGHT) {
                console.warn(`Warning: Image size is ${this.width}x${this.height}. Expected ${TARGET_WIDTH}x${TARGET_HEIGHT}. Image will be resized/cropped.`);
            }

            const rawBuffer = Buffer.alloc(FILE_SIZE);
            
            let bufIdx = 0;
            
            for (let y = 0; y < TARGET_HEIGHT; y++) {
                for (let x = 0; x < TARGET_WIDTH; x += 4) {
                    if (bufIdx >= 5600) break;

                    // Pack 4 pixels into 1 byte
                    // Pixel 0 (High bits) -> Pixel 3 (Low bits)
                    // Atari usually: 76 (p0), 54 (p1), 32 (p2), 10 (p3)
                    
                    let byteVal = 0;
                    for (let p = 0; p < 4; p++) {
                        let px = x + p;
                        let py = y;
                        let pIdx = -1;
                        
                        if (px < this.width && py < this.height) {
                            const idx = (this.width * py + px) << 2;
                            const r = this.data[idx];
                            const g = this.data[idx + 1];
                            const b = this.data[idx + 2];
                            // const a = this.data[idx + 3];
                            pIdx = getClosestColorIndex(r, g, b);
                        } else {
                            pIdx = 0; // Black padding
                        }
                        
                        // Shift into place
                        // p=0 (first pixel) -> bits 6-7 (shift 6)
                        // p=1 -> bits 4-5 (shift 4)
                        byteVal |= (pIdx << (6 - p*2));
                    }
                    
                    // Apply Encryption: Byte ^ (Seed + bufIdx)
                    // Logic: Encrypted[i] = Raw[i] ^ Key
                    // Since Decrypted[i] = Encrypted[i] ^ Key
                    // Then Encrypted[i] = Decrypted[i] ^ Key (XOR is its own inverse)
                    
                    const key = (seed + bufIdx) & 0xFF;
                    rawBuffer[bufIdx] = byteVal ^ key;
                    
                    bufIdx++;
                }
            }
            
            // Fill remaining bytes (padding) with encrypted garbage or specific value?
            // The original files were 5605 bytes. We filled 5600.
            // Let's just fill the last 5 bytes with encrypted 0s
            while (bufIdx < FILE_SIZE) {
                const key = (seed + bufIdx) & 0xFF;
                rawBuffer[bufIdx] = 0 ^ key;
                bufIdx++;
            }
            
            fs.writeFileSync(outputPath, rawBuffer);
            console.log(`Saved ${outputPath} (${rawBuffer.length} bytes).`);
        });
}

function decrypt(inputPath, outputPath, seed) {
    console.log(`Decrypting ${inputPath} to ${outputPath} with Seed 0x${seed.toString(16)}...`);
    
    const data = fs.readFileSync(inputPath);
    const png = new PNG({ width: TARGET_WIDTH, height: TARGET_HEIGHT });
    
    // Decrypt buffer
    const decrypted = Buffer.alloc(data.length);
    for (let i = 0; i < data.length; i++) {
        const key = (seed + i) & 0xFF;
        decrypted[i] = data[i] ^ key;
    }
    
    // Convert to PNG pixels
    for (let y = 0; y < TARGET_HEIGHT; y++) {
        for (let x = 0; x < TARGET_WIDTH; x += 4) {
            const bufIdx = y * (TARGET_WIDTH / 4) + (x / 4);
            if (bufIdx >= decrypted.length) break;
            
            const byteVal = decrypted[bufIdx];
            
            for (let p = 0; p < 4; p++) {
                // Extract 2 bits
                const pIdx = (byteVal >> (6 - p*2)) & 0x03;
                
                const c = PALETTE.find(x => x.val === pIdx) || PALETTE[0];
                
                const idx = (TARGET_WIDTH * y + (x + p)) << 2;
                png.data[idx] = c.r;
                png.data[idx + 1] = c.g;
                png.data[idx + 2] = c.b;
                png.data[idx + 3] = 255; // Alpha
            }
        }
    }
    
    png.pack().pipe(fs.createWriteStream(outputPath))
        .on('finish', () => console.log(`Saved ${outputPath}.`));
}

function main() {
    const args = process.argv.slice(2);
    if (args.length < 3) {
        console.log("Usage:");
        console.log("  node atari_converter.js encrypt <input.png> <output.bin> <seed_hex>");
        console.log("  node atari_converter.js decrypt <input.bin> <output.png> <seed_hex>");
        console.log("Example: node atari_converter.js decrypt OP1.2 OP1.2.png 32");
        process.exit(1);
    }
    
    const mode = args[0];
    const input = args[1];
    const output = args[2];
    const seed = parseInt(args[3], 16);
    
    if (isNaN(seed)) {
        console.error("Error: Invalid seed. Must be hex (e.g. 32, BB).");
        process.exit(1);
    }
    
    if (mode === 'encrypt') {
        encrypt(input, output, seed);
    } else if (mode === 'decrypt') {
        decrypt(input, output, seed);
    } else {
        console.error("Unknown mode. Use 'encrypt' or 'decrypt'.");
    }
}

main();
