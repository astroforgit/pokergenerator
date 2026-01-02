import os
import glob
from PIL import Image
import collections

def score_decryption(data):
    # Score based on frequency of 0x00, 0x55, 0xAA, 0xFF
    # These are solid colors in Atari Mode 15 (2 bits per pixel)
    counts = collections.Counter(data)
    total = len(data)
    if total == 0: return 0
    solid = counts[0x00] + counts[0x55] + counts[0xAA] + counts[0xFF]
    return solid / total

def decrypt_and_convert(filepath):
    with open(filepath, 'rb') as f:
        data = f.read()
        
    # Heuristic: Find best StartSeed for: Out[i] = In[i] ^ (Seed + i)
    best_seed = 0
    best_score = -1
    best_data = None
    
    # Handle header?
    # Analysis suggests the header IS part of the image (decrypts to 55s)
    # So we should NOT strip it, to maintain alignment.
    payload = data
        
    # Optimization: Check first 100 bytes of payload
    sample = payload[:100]
    
    for seed in range(256):
        attempt = bytearray()
        s = seed
        for b in sample:
            attempt.append(b ^ s)
            s = (s + 1) & 0xFF
            
        score = score_decryption(attempt)
        if score > best_score:
            best_score = score
            best_seed = seed

    print(f"File {os.path.basename(filepath)}: Best Seed {best_seed:02X} (Score {best_score:.2f})")
    
    # Full Decryption
    decrypted = bytearray()
    s = best_seed
    for b in payload:
        decrypted.append(b ^ s)
        s = (s + 1) & 0xFF
        
    # Skip small files
    if len(decrypted) < 1000:
        print(f"Skipping small file {filepath}")
        return

    # Convert to PNG
    width = 160
    height = len(decrypted) // 40
    
    img = Image.new("P", (width, height))
    
    # ... Palette ...
    # Palette
    palette = [
        0, 0, 0,
        255, 180, 140, # Skin
        80, 80, 255,   # Blue
        255, 255, 255
    ]
    palette.extend([0,0,0] * (256 - 4))
    img.putpalette(palette)
    
    pixels = []
    for byte in decrypted:
        p0 = (byte >> 6) & 0x03
        p1 = (byte >> 4) & 0x03
        p2 = (byte >> 2) & 0x03
        p3 = byte & 0x03
        pixels.extend([p0, p1, p2, p3])
        
    # Truncate pixels to match image buffer
    expected_pixels = width * height
    if len(pixels) > expected_pixels:
        pixels = pixels[:expected_pixels]
        
    img.putdata(pixels)
    out_name = os.path.basename(filepath) + "_decrypted.png"
    img.save(out_name)
    print(f"Saved {out_name}")

if __name__ == "__main__":
    files = glob.glob("extracted/OP*.1") + glob.glob("extracted/OP*.2") + glob.glob("extracted/OP*.3") + glob.glob("extracted/OP*.4") + glob.glob("extracted/OP*.5")
    # And other OP* files
    files = glob.glob("extracted/OP*")
    
    for f in files:
        # Skip directories and non-image looking files
        if os.path.isdir(f): continue
        if f.endswith(".png") or f.endswith(".cracked"): continue
        if "DOS" in f or "AUTORUN" in f or "SP" in f or "COM" in f or "DLIST" in f: continue
        
        decrypt_and_convert(f)
