# Atari Strip Poker Reverse Engineering & Editor Documentation

## Project Overview
This project involves reverse engineering the Atari 8-bit game "Strip Poker", analyzing its file formats, identifying the encryption algorithm used for its images, and creating a web-based editor to modify the game's graphics.

## File System & Architecture

### Disk Format (ATR)
The game uses a standard **Atari DOS 2.0 Single Density** disk format (90k).
*   **Sector Size:** 128 bytes.
*   **Boot Sector:** Sector 1.
*   **Directory:** Sector 361 (8 sectors long).
*   **File Storage:** Linked list of sectors. The last 3 bytes of each sector act as metadata:
    *   Byte 125: Link to next sector (high 2 bits) + File Number (low 6 bits).
    *   Byte 126: Link to next sector (low 8 bits).
    *   Byte 127: Number of data bytes in this sector (0-125).

### Key Files
*   `SP`: The main game executable (Tokenized Atari BASIC).
*   `AUTORUN.SYS`: Machine code bootloader that runs `SP`.
*   `DOS.SYS`: Atari DOS kernel.
*   `TITLE2`: Title screen image (Unencrypted Mode 15).
*   `OPP`: Opponent base image (Unencrypted Mode 15).
*   `OP1.x`: Opponent 1 (Suzy) images (Encrypted Mode 15).
*   `OP2.x`: Opponent 2 (Melissa) images (Encrypted Mode 15).
*   `COM1` / `COM2`: Text files containing opponent comments/taunts.

### Image Format (Atari Mode 15)
*   **Resolution:** 160x192 pixels.
*   **Color Depth:** 4 colors (2 bits per pixel).
*   **Memory Layout:** Linear bitmap, 40 bytes per line.
*   **Palette:**
    *   00: Black
    *   01: Peach/Skin (Color Register 0)
    *   10: Blue (Color Register 1)
    *   11: White (Color Register 2)

## Encryption Algorithm
The game uses a custom "XOR Stream Cipher" to obfuscate the opponent images (`OP*` files).

**Algorithm:**
```
DecryptedByte[i] = EncryptedByte[i] ^ ((StartSeed + i) & 0xFF)
```
Where:
*   `i`: The byte index (0-based) in the file.
*   `StartSeed`: A unique 8-bit seed derived from the filename's last character.
    *   `OP1.2` ('2' = 0x32) -> Seed `0x32`.
    *   `OP2.1` ('1' = 0x31) -> Seed `0xBB` (Note: `0xBB` is used for `OP2` series, likely manually offset).

**Validation:**
We successfully cracked this by bruteforcing the seed that maximized the "visual coherence" (solid color blocks) of the decrypted output.

## Included Scripts

### 1. `extract_atr.py`
Parses the ATR disk image and extracts all files to the `extracted/` directory.
*   **Usage:** `python3 extract_atr.py`
*   **Logic:** Reads DOS 2.0 directory, follows sector chains, handles link bytes.

### 2. `convert_images.py`
Converts raw Atari Mode 15 files to standard PNG images.
*   **Usage:** `python3 convert_images.py`
*   **Logic:** Maps 2-bit Atari pixels to an RGB palette. Handles unencrypted files like `TITLE2`.

### 3. `disasm_6502.py`
A simple 6502 disassembler to analyze binary files.
*   **Usage:** `python3 disasm_6502.py <file>`
*   **Features:** decodes standard opcodes, identifies standard 0xFFFF headers.

### 4. `dump_basic.py`
Attempts to list the content of the tokenized Atari BASIC file `SP`.
*   **Usage:** `python3 dump_basic.py extracted/SP`
*   **Logic:** Parses the BASIC line structure (Line Number, Offset, Tokens).

### 5. `decrypt_images.py`
Automated cracker that finds the correct seed for each `OP*` file, decrypts it, and converts it to PNG.
*   **Usage:** `python3 decrypt_images.py`
*   **Logic:** Tries all 256 seeds, scores result by entropy/solid-color-count, saves best match. Note: It preserves the 5-byte "Footer" found in original files.

### 6. `atari_converter.js`
A CLI Node.js tool to Encrypt/Decrypt individual files.
*   **Usage:**
    *   `node atari_converter.js decrypt <input_bin> <output_png> <seed_hex>`
    *   `node atari_converter.js encrypt <input_png> <output_bin> <seed_hex>`

## Web Editor (Vite)
A modern, browser-based tool to modify the game.

### Architecture
*   **Framework:** Vite (Vanilla JS).
*   **Core Logic:** `vite-editor/src/main.js` handles:
    *   **ATR Parsing:** Reads/Writes sectors directly in browser memory.
    *   **Seed Detection:** Re-implements the bruteforce logic in JS.
    *   **Image Processing:** Canvas API for pixel editing and PNG import.
    *   **Safe Saving:** Critical logic to preserve the **original file footer (last 5 bytes)**. The game requires these specific bytes (likely a checksum or offset) at the end of the 5605-byte files. The editor extracts them from the original file and appends them to the new encrypted data before writing to the disk image.

### Usage
1.  Run `npm run dev` in `vite-editor/`.
2.  Open `http://localhost:5173`.
3.  Load `Strip Poker.atr`.
4.  Select an image, edit or import PNG.
5.  Click "Update File in Disk" -> "Download Modified ATR".
