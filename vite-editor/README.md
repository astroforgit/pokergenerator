# Atari Strip Poker Editor

A web-based editor for the classic Atari 8-bit Strip Poker game. Edit images and text directly in your browser!

## Features

### 🖼️ Image Editor
- Edit 14 opponent images (OP1.1-OP1.5, OP2.1-OP2.4, TITLE2)
- Draw with mouse/touch
- Import PNG images with advanced processing:
  - **4 Dithering Algorithms**: Floyd-Steinberg, Atkinson, Ordered/Bayer, None
  - **Image Adjustments**: Brightness, Contrast, Saturation
  - **Real-time Preview**: See changes before applying
- 4-color Atari palette (Black, Brown, Orange, White)
- Larger 800px preview canvas

### 📝 Text Editor
- Edit **74 text strings** total:
  - **14 Game Messages**: Trigger prompts, results, clothing messages
  - **30 COM1 Comments**: Opponent taunts and reactions (set 1)
  - **30 COM2 Comments**: Opponent taunts and reactions (set 2)
- Real-time character counter with color feedback
- Length validation (prevents ATR corruption)
- Examples: "I'M ON A LUCKY STREAK NOW!", "YOU LUCKY *!#%&*+$#!@"

## Usage

1. **Load Data**: Click "Load Data" button to load the embedded Strip Poker ATR
2. **Edit Images**:
   - Select a file from the left panel
   - Draw with tools or import PNG
   - Adjust image settings
   - Click "Update File in Disk"
3. **Edit Text**:
   - Switch to "Text Editor" tab
   - Edit any of the 74 text strings
   - Keep exact character count (watch color feedback)
   - Click "Save All Text Changes"
4. **Download**: Click "Download Modified ATR" to save your changes

## Development

```bash
cd vite-editor
npm install
npm run dev
```

## Build for Production

```bash
cd vite-editor
npm run build
```

The built files will be in `vite-editor/dist/`

## GitHub Pages Deployment

This project is configured for automatic deployment to GitHub Pages:

1. Push to `master` or `main` branch
2. GitHub Actions will automatically build and deploy
3. Enable GitHub Pages in repository settings (Settings → Pages → Source: GitHub Actions)

## Technical Details

- **Framework**: Vanilla JavaScript + Vite
- **File Format**: Atari ATR disk image (92,176 bytes)
- **Image Format**: 160x140 pixels, 4 colors
- **Sector Size**: 128 bytes
- **File System**: Atari DOS 2.0S

## Safety Features

- ⚠️ Text length validation prevents ATR corruption
- ⚠️ Cannot save if any text has wrong length
- ⚠️ File size remains exactly 92,176 bytes
- ⚠️ All changes are in-memory until download

## License

Educational/Personal use. Original Strip Poker game © 1982 Artworx.

