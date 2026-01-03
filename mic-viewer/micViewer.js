/**
 * Atari MIC+COL Viewer
 * Parses and displays Atari 8-bit graphics files
 */

// Default Atari palette (NTSC values)
const DEFAULT_ATARI_PALETTE = [
  // Hue 0 (Grays)
  [0, 0, 0], [68, 68, 68], [112, 112, 112], [168, 168, 168],
  [228, 228, 228], [255, 255, 255], [255, 255, 255], [255, 255, 255],
  [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255],
  [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255],
  // Hue 1 (Gold/Orange)
  [68, 48, 0], [108, 68, 0], [148, 108, 0], [188, 148, 32],
  [228, 188, 124], [255, 228, 184], [255, 255, 224], [255, 255, 255],
  [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255],
  [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255],
  // Hue 2 (Orange)
  [112, 40, 0], [152, 60, 0], [192, 100, 0], [232, 140, 32],
  [255, 180, 120], [255, 220, 180], [255, 255, 220], [255, 255, 255],
  [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255],
  [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255],
  // Add more hues... (simplified for now)
];

// Fill palette to 256 colors
while (DEFAULT_ATARI_PALETTE.length < 256) {
  DEFAULT_ATARI_PALETTE.push([0, 0, 0]);
}

export class MICViewer {
  constructor() {
    this.micData = null;
    this.colData = null;
    this.palette = DEFAULT_ATARI_PALETTE;
    this.width = 160;
    this.height = 0;
  }

  /**
   * Load Atari palette from .ACT file (Adobe Color Table)
   */
  async loadPalette(file) {
    const buffer = await file.arrayBuffer();
    const data = new Uint8Array(buffer);
    
    this.palette = [];
    // ACT files are 768 bytes (256 colors × 3 bytes RGB)
    for (let i = 0; i < Math.min(768, data.length); i += 3) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      this.palette.push([r, g, b]);
    }
    
    // Pad to 256 colors if needed
    while (this.palette.length < 256) {
      this.palette.push([0, 0, 0]);
    }
    
    console.log(`Loaded palette: ${this.palette.length} colors`);
    return this.palette;
  }

  /**
   * Load MIC file (Multi-color Image)
   * Format: 4 pixels per byte (2 bits each)
   */
  async loadMIC(file, width = 160) {
    const buffer = await file.arrayBuffer();
    this.micData = new Uint8Array(buffer);
    this.width = width;
    
    // Calculate height from file size
    const bytesPerLine = width / 4; // 4 pixels per byte
    this.height = Math.floor(this.micData.length / bytesPerLine);
    
    console.log(`Loaded MIC: ${this.micData.length} bytes, ${width}x${this.height}`);
    return this.micData;
  }

  /**
   * Load COL file (Color palette data)
   * Format: 5 color registers × 256 scanlines = 1280 bytes
   */
  async loadCOL(file) {
    const buffer = await file.arrayBuffer();
    this.colData = new Uint8Array(buffer);
    
    console.log(`Loaded COL: ${this.colData.length} bytes`);
    return this.colData;
  }

  /**
   * Get color palette for a specific scanline
   * Returns array of 4 Atari color indices [PF0, PF1, PF2, PF3]
   */
  getScanlinePalette(scanline) {
    if (!this.colData) {
      return [0, 0, 0, 0]; // Default to black
    }
    
    // COL format: All BAK values (256 bytes), then all PF0 (256), PF1 (256), PF2 (256), PF3 (256)
    // We'll use registers 1-4 (PF0-PF3), skipping BAK (register 0)
    const palette = [];
    for (let reg = 1; reg <= 4; reg++) {
      const offset = reg * 256 + scanline;
      if (offset < this.colData.length) {
        palette.push(this.colData[offset]);
      } else {
        palette.push(0);
      }
    }
    
    return palette;
  }

  /**
   * Decode a single byte from MIC file
   * Returns array of 4 pixel indices (0-3)
   */
  decodeMICByte(byte) {
    return [
      (byte >> 6) & 0x03,  // Pixel 0 (bits 7-6)
      (byte >> 4) & 0x03,  // Pixel 1 (bits 5-4)
      (byte >> 2) & 0x03,  // Pixel 2 (bits 3-2)
      (byte >> 0) & 0x03,  // Pixel 3 (bits 1-0)
    ];
  }

  /**
   * Render MIC+COL to canvas
   */
  render(canvas, scale = 2) {
    if (!this.micData || !this.colData) {
      console.error('MIC or COL data not loaded');
      return;
    }

    const ctx = canvas.getContext('2d');
    canvas.width = this.width * scale;
    canvas.height = this.height * scale;

    const imageData = ctx.createImageData(this.width, this.height);
    const pixels = imageData.data;

    let micOffset = 0;
    const bytesPerLine = this.width / 4;

    for (let y = 0; y < this.height; y++) {
      const scanlinePalette = this.getScanlinePalette(y);

      for (let x = 0; x < this.width; x += 4) {
        const micByte = this.micData[micOffset++];
        const pixelIndices = this.decodeMICByte(micByte);

        for (let p = 0; p < 4; p++) {
          const pixelX = x + p;
          if (pixelX >= this.width) break;

          const colorIndex = pixelIndices[p];
          const atariColorIndex = scanlinePalette[colorIndex];
          const rgb = this.palette[atariColorIndex] || [0, 0, 0];

          const offset = (y * this.width + pixelX) * 4;
          pixels[offset + 0] = rgb[0]; // R
          pixels[offset + 1] = rgb[1]; // G
          pixels[offset + 2] = rgb[2]; // B
          pixels[offset + 3] = 255;    // A
        }
      }
    }

    // Draw to canvas at 1:1 scale first
    ctx.putImageData(imageData, 0, 0);

    // Scale up if needed
    if (scale > 1) {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = this.width;
      tempCanvas.height = this.height;
      const tempCtx = tempCanvas.getContext('2d');
      tempCtx.putImageData(imageData, 0, 0);

      canvas.width = this.width * scale;
      canvas.height = this.height * scale;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(tempCanvas, 0, 0, this.width * scale, this.height * scale);
    }

    console.log(`Rendered ${this.width}x${this.height} at ${scale}x scale`);
  }
}

