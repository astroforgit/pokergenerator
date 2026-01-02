# Critical Bug Fix: Image Corruption in ATR Editor

## Problem
When editing images in the ATR editor and saving them back, the modified images appeared corrupted in the game.

## Root Cause
The issue was caused by **not preserving trailing bytes** in image files:

### File Structure Discovery
- **OP1.x files**: 5605 bytes (44 sectors × 125 bytes + 1 sector × 105 bytes)
- **OPP/TITLE2 files**: 5600 bytes (44 sectors × 125 bytes + 1 sector × 100 bytes)

### The Problem
1. Canvas renders **160×140 pixels = 5600 bytes** of image data
2. OP1.x files have **5 extra trailing bytes** (bytes 5600-5604)
3. Original code filled these 5 bytes with **zeros** when re-encoding
4. This corrupted the file structure, making images unreadable in the game

## Solution
### Changes Made

1. **Store Original Data** (`vite-editor/src/main.js`)
   - Added `currentFileOriginalData` to preserve the original decrypted file
   - Stored when file is loaded in `selectFile()`

2. **Preserve Trailing Bytes** (`canvasToBinary()`)
   ```javascript
   // OLD: Fill with zeros
   while(byteIdx < fileSize) {
       out[byteIdx++] = 0;  // ❌ WRONG!
   }
   
   // NEW: Copy from original
   while(byteIdx < fileSize) {
       out[byteIdx] = currentFileOriginalData[byteIdx];  // ✓ CORRECT!
       byteIdx++;
   }
   ```

3. **Dynamic File Size Validation**
   - Detect original file size when reading from ATR
   - Validate that re-encoded data matches original size exactly
   - Show file size in status messages

## Testing
Created `test_roundtrip.js` to verify the fix:

```
=== Testing OP1.1 ===
1. Read encrypted file: 5605 bytes
2. Decrypted: 5605 bytes
3. Converted to pixels: 22420 pixels
4. Re-encoded to binary: 5605 bytes
5. Re-encrypted: 5605 bytes
6. Data matches original: ✓ YES
```

All tests pass for:
- OP1.1 (5605 bytes) ✓
- OP1.2 (5605 bytes) ✓
- OPP (5600 bytes) ✓
- TITLE2 (5600 bytes) ✓

## How to Test
1. Run the round-trip test:
   ```bash
   node test_roundtrip.js
   ```

2. Test in the editor:
   - Load `Strip Poker.atr`
   - Select an image file (e.g., OP1.1)
   - Make a small edit
   - Click "Commit to Memory"
   - Click "Save ATR"
   - Load the modified ATR in an Atari emulator
   - Verify the image displays correctly

## Technical Details
### Atari DOS 2.0 File Structure
- Sector size: 128 bytes
- Data per sector: 125 bytes (bytes 0-124)
- Link bytes: 3 bytes (bytes 125-127)
  - Byte 125: `(file_no << 2) | (next_sector_high)`
  - Byte 126: `next_sector_low`
  - Byte 127: `byte_count` (number of valid data bytes in this sector)

### Why 5605 bytes?
- 44 full sectors: 44 × 125 = 5500 bytes
- 1 partial sector: 105 bytes
- Total: 5605 bytes

The last 5 bytes (5600-5604) are **not image data** but may contain:
- Padding
- File metadata
- Checksum or validation data
- Must be preserved exactly!

## Commits
1. `fce035f` - Fix critical bug: preserve exact file sizes when saving images to ATR
2. `e497c7a` - Fix image corruption: preserve trailing bytes in OP1.x files

## Status
✅ **FIXED** - Images now save and load correctly without corruption

