# Atari Strip Poker Editor

A web-based editor for the classic Atari 8-bit Strip Poker game (1982). Edit images and text directly in your browser!

## 🎮 Live Demo

**[Try it now on GitHub Pages!](#)** *(Link will be active after deployment)*

## ✨ Features

### 🖼️ Image Editor
- **Edit 14 opponent images**: OP1.1-OP1.5, OP2.1-OP2.4, TITLE2
- **Drawing tools**: Mouse/touch support
- **PNG Import** with advanced processing:
  - 🎨 **4 Dithering Algorithms**:
    - Floyd-Steinberg (Best Quality)
    - Atkinson (Mac Classic)
    - Ordered/Bayer (Retro Pattern)
    - None (Nearest Color)
  - 🔧 **Image Adjustments**:
    - Brightness (-100 to +100)
    - Contrast (-100 to +100)
    - Saturation (0 to 2.0)
  - 👁️ **Real-time Preview**: See changes before applying
- **4-color Atari palette**: Black, Brown, Orange, White
- **Large 800px preview canvas**

### 📝 Text Editor
Edit **74 text strings** total:

#### Game Messages (14 texts)
- Trigger prompts
- Game results
- Clothing messages
- Examples: "PUSH MY TRIGGER FOR OPPONENTS", "WE TIED...NEW DEAL"

#### COM1 - Opponent Comments Set 1 (30 texts)
- "I'M ON A LUCKY STREAK NOW!    "
- "YOU LUCKY *!#%&*+$#!@         "
- "PLEASE! PLEASE! PUSH RESET!!! "
- "           SHIT!              "

#### COM2 - Opponent Comments Set 2 (30 texts)
- "         GIVE UP?             "
- "OHHH...I LIKE A MAN WITH GUTS!"
- "        YOU TWERP!            "
- "          NUTS...             "

### 🛡️ Safety Features
- ⚠️ Text length validation prevents ATR corruption
- ⚠️ Cannot save if any text has wrong length
- ⚠️ File size remains exactly 92,176 bytes
- ⚠️ All changes are in-memory until download
- 🎨 Color-coded character counter (Green=correct, Orange=too short, Red=too long)

## 🚀 Quick Start

### Online (Recommended)
Just visit the GitHub Pages link above - no installation needed!

### Local Development
```bash
cd vite-editor
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

### Build for Production
```bash
cd vite-editor
npm run build
```

Built files will be in `vite-editor/dist/`

## 📖 Usage Guide

1. **Load Data**: Click "Load Data" button to load the embedded Strip Poker ATR
2. **Edit Images** (Image Editor tab):
   - Select a file from the left panel (OP1.1, OP1.2, etc.)
   - Draw with mouse/touch tools OR import PNG
   - For PNG: Adjust brightness/contrast/saturation, choose dithering
   - Click "Update File in Disk"
3. **Edit Text** (Text Editor tab):
   - Scroll through all 74 editable text strings
   - Edit any message (keep exact character count!)
   - Watch character counter turn green when correct
   - Click "Save All Text Changes"
4. **Download**: Click "Download Modified ATR" to save your customized game

## 🔧 Technical Details

- **Framework**: Vanilla JavaScript + Vite
- **File Format**: Atari ATR disk image (92,176 bytes)
- **Image Format**: 160x140 pixels, 4 colors
- **Sector Size**: 128 bytes
- **File System**: Atari DOS 2.0S
- **Text Encoding**: ASCII
- **Total Editable Texts**: 74 strings

## 📁 Project Structure

```
.
├── vite-editor/          # Web editor application
│   ├── src/
│   │   ├── main.js              # Main application logic
│   │   ├── embedded-atr-binary.js  # Embedded ATR data
│   │   └── style.css            # Styles
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── .github/workflows/    # GitHub Actions for deployment
├── extract_atr.py        # Python script to extract ATR files
└── Strip Poker.atr       # Original game disk image
```

## 🌐 GitHub Pages Deployment

This project auto-deploys to GitHub Pages:

1. Push to `master` or `main` branch
2. GitHub Actions automatically builds and deploys
3. Enable GitHub Pages: Settings → Pages → Source: GitHub Actions

## 📜 License

Educational/Personal use. Original Strip Poker game © 1982 Artworx.

## 🙏 Credits

- Original game by Artworx (1982)
- Editor by [Your Name]
- Built with Vite

---

**Have fun customizing your Strip Poker game! 🎮✨**

