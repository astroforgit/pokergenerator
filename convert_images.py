from PIL import Image
import os
import glob

def convert_atari_mode15(file_path, width=160, height=140):
    try:
        with open(file_path, "rb") as f:
            data = f.read()
    except Exception as e:
        print(f"Error reading {file_path}: {e}")
        return

    # Check size
    if len(data) < width * height // 4:
        print(f"File {file_path} too small ({len(data)} bytes) for {width}x{height} mode 15")
        return

    # If slightly larger, maybe header?
    # If 5605, maybe 5 bytes header? 
    # Let's just take the first 5600 bytes or last 5600?
    # TITLE2 was 5600 exactly. OP1.1 was 5605.
    
    start_offset = 0
    if len(data) > 5600:
        # Heuristic: if file is slightly bigger, maybe header at start?
        # But for now let's just take the first 5600 and see.
        pass

    raw = data[start_offset : start_offset + 5600]
    
    img = Image.new("P", (width, height))
    
    # Simple palette
    # 00: Black
    # 01: Peach/Skin (R=255, G=200, B=150)
    # 10: Blue (R=50, G=50, B=200)
    # 11: White (R=255, G=255, B=255)
    palette = [
        0, 0, 0,
        255, 180, 140, # Skin toneish
        80, 80, 255,   # Blueish
        255, 255, 255
    ]
    # Pad to 256 colors
    palette.extend([0,0,0] * (256 - 4))
    img.putpalette(palette)
    
    pixels = []
    for byte in raw:
        # Each byte is 4 pixels (2 bits each)
        # 76543210
        # p0: 76, p1: 54, p2: 32, p3: 10
        p0 = (byte >> 6) & 0x03
        p1 = (byte >> 4) & 0x03
        p2 = (byte >> 2) & 0x03
        p3 = byte & 0x03
        pixels.extend([p0, p1, p2, p3])
        
    img.putdata(pixels)
    
    out_name = os.path.basename(file_path) + ".png"
    img.save(out_name)
    print(f"Converted {file_path} to {out_name}")

if __name__ == "__main__":
    targets = ["TITLE2", "OPP", "OP1.1", "OP1.2", "OP1.3", "OP1.4", "OP1.5"]
    
    # Also look for files in 'extracted' dir
    files = glob.glob("extracted/*")
    
    for f in files:
        fname = os.path.basename(f)
        # Heuristic: size close to 5600
        size = os.path.getsize(f)
        if 5600 <= size <= 5700:
            convert_atari_mode15(f)
