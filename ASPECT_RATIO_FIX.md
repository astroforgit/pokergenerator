# Aspect Ratio Fix

## Problem
The editor was displaying images with **square pixels**, but Atari graphics use **rectangular pixels**. This made images appear squished/compressed compared to how they look in the actual game.

## Analysis

### Game Screenshot
- Resolution: **1107 × 571 pixels**
- Aspect ratio: **1.9387:1** (almost 2:1, very wide)

### Canvas Data
- Resolution: **160 × 140 pixels**
- Aspect ratio: **1.1429:1** (slightly wider than square)

### Pixel Aspect Ratio
```
Pixel Aspect Ratio = Game Ratio / Data Ratio
                   = 1.9387 / 1.1429
                   = 1.6964
```

This means **each Atari pixel is ~1.70 times WIDER than it is tall**.

## Visual Comparison

### Before Fix (Square Pixels)
```
Canvas: 160×140 displayed as 160×140
Aspect: 1.14:1
Result: Images appear COMPRESSED horizontally
        (too narrow, faces look squished)
```

### After Fix (Rectangular Pixels)
```
Canvas: 160×140 displayed as 814×420
Aspect: 1.94:1
Result: Images match game appearance
        (correct proportions, faces look natural)
```

## Technical Details

### Display Scaling
- **Canvas element size**: `width="160" height="140"` (data resolution)
- **CSS display size**: `width: 814px; height: 420px;` (visual size)
- **Scale factor**: 
  - Width: 814 / 160 = 5.0875x
  - Height: 420 / 140 = 3.0x
  - Ratio: 5.0875 / 3.0 = 1.6958 ≈ 1.70 ✓

### Mouse Coordinate Handling
The existing code already handles scaling correctly:
```javascript
const x = Math.floor((e.clientX - rect.left) * (canvas.width / rect.width));
const y = Math.floor((e.clientY - rect.top) * (canvas.height / rect.height));
```

This converts screen coordinates to canvas data coordinates automatically.

## Why Atari Pixels Are Rectangular

### NTSC Video Standard
- Atari outputs to NTSC television
- NTSC has a 4:3 display aspect ratio
- Atari Mode 15: 160 pixels wide displayed across ~80% of screen width
- This stretches pixels horizontally

### Mode 15 Specifics
- Resolution: 160×192 (or 160×96 in some modes)
- 4 colors (2 bits per pixel)
- Pixels are displayed wider than tall to fill the TV screen properly

## Verification

To verify the fix is correct:
1. Load an image in the editor
2. Take a screenshot of the editor
3. Compare proportions with game screenshot
4. Faces and bodies should have the same width/height ratio

### Expected Ratios
| Element | Game | Editor (Fixed) |
|---------|------|----------------|
| Face width:height | ~1.9:1 | ~1.9:1 ✓ |
| Body width:height | ~1.9:1 | ~1.9:1 ✓ |
| Overall image | 1.94:1 | 1.94:1 ✓ |

## Files Changed
- `vite-editor/src/style.css` - Added CSS scaling to 814×420
- `vite-editor/index.html` - Added aspect ratio note

## Commit
`a436b94` - Fix aspect ratio: display images with correct Atari pixel proportions

