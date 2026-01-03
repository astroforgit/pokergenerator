# Image Import Guide

## New Features

The editor now supports importing any image and automatically converting it to the Atari 4-color format!

## How to Import an Image

### Step 1: Load ATR File
1. Click **"Load ATR"**
2. Select your `Strip Poker.atr` file
3. Select an image file from the list (e.g., OP1.1)

### Step 2: Import Your Image
1. Click **"📁 Import PNG"**
2. Select any image file (PNG, JPG, etc.)
3. The import preview section will appear

### Step 3: Adjust the Image
Choose one of these options:

#### **Crop to 160×140**
- Takes the center portion of your image
- Best for images that are already close to the right size
- No distortion, but may cut off edges

#### **Resize (Fit)**
- Scales image to fit inside 160×140
- Maintains aspect ratio
- Adds black bars if needed (letterboxing)
- Best for: portraits, images you want to see completely

#### **Resize (Fill)**
- Scales image to fill entire 160×140
- Maintains aspect ratio
- May crop edges to fill the space
- Best for: landscapes, images where edges aren't critical

### Step 4: Apply to Canvas
1. Click **"Apply to Canvas"** when satisfied
2. The converted image appears on the main canvas
3. You can now edit it pixel-by-pixel if needed

### Step 5: Save to ATR
1. Click **"💾 Update File in Disk"**
2. Click **"Download Modified ATR"**
3. Test in your Atari emulator!

## Image Conversion Details

### Automatic 4-Color Conversion
The editor uses **Floyd-Steinberg dithering** to convert your image to the 4 Atari colors:
- **Color 0**: Black (0, 0, 0)
- **Color 1**: Peach/Skin (255, 180, 140)
- **Color 2**: Blue (80, 80, 255)
- **Color 3**: White (255, 255, 255)

### What is Dithering?
Dithering creates the illusion of more colors by mixing pixels. For example:
- 50% black + 50% white pixels = appears gray
- Smooth gradients instead of harsh color bands
- Better quality than simple color matching

## Tips for Best Results

### Image Preparation
1. **Pre-crop your image** to roughly 2:1 aspect ratio (e.g., 800×400)
2. **Adjust contrast** before importing for better conversion
3. **Use high-quality source images** (at least 320×280)

### Color Considerations
- **Skin tones** → Will convert to Peach (Color 1)
- **Dark areas** → Will convert to Black (Color 0)
- **Light areas** → Will convert to White (Color 3)
- **Blue clothing/backgrounds** → Will convert to Blue (Color 2)

### Aspect Ratio
- The canvas displays at **960×560** for easy editing
- This maintains the correct Atari aspect ratio (1.94:1)
- Images will look wider than square pixels
- This matches how they appear in the actual game!

## Example Workflow

### Converting a Photo
```
1. Have a photo: 1200×1600 (portrait)
2. Import PNG → Shows preview
3. Click "Resize (Fit)" → Scales to 105×140 with black bars
4. Image is auto-converted to 4 colors with dithering
5. Click "Apply to Canvas"
6. Optional: Touch up with pixel editor
7. Save to ATR
```

### Using Existing Atari Art
```
1. Have pixel art: 160×140 (already correct size)
2. Import PNG → Shows preview
3. Click "Crop to 160×140" → No change needed
4. Auto-converts to exact 4 colors
5. Click "Apply to Canvas"
6. Save to ATR
```

## Canvas Size

The editor canvas is now **larger** for easier editing:
- **Display size**: 960×560 pixels (6x scale)
- **Data size**: 160×140 pixels (actual game resolution)
- **Aspect ratio**: 1.94:1 (matches game)

## Troubleshooting

### Image looks squished
✓ This is correct! Atari pixels are rectangular (1.7× wider than tall)

### Colors look wrong
- Try adjusting source image brightness/contrast
- Dithering works best with good tonal range
- Very dark or very bright images may not convert well

### Image is cut off
- Use "Resize (Fit)" instead of "Resize (Fill)"
- Or pre-crop your source image to 2:1 aspect ratio

### Can't see details
- The 4-color palette is very limited
- Simplify your source image
- Increase contrast before importing
- Some photos work better than others

## Advanced: Manual Editing

After importing, you can:
1. **Draw pixels** - Click and drag on canvas
2. **Select colors** - Click color swatches
3. **Clear canvas** - Start over
4. **Import again** - Try different settings

## File Size Preservation

The editor automatically:
- Detects original file size (5600 or 5605 bytes)
- Preserves trailing bytes in OP1.x files
- Validates data before saving
- Prevents ATR corruption

Your modified images will work perfectly in the game!

