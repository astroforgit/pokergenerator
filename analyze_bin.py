import struct
import sys

def analyze_atari_binary(filepath):
    with open(filepath, 'rb') as f:
        data = f.read()
    
    pos = 0
    if len(data) < 2:
        print("File too short")
        return

    # Check for 0xFFFF header
    header = struct.unpack("<H", data[pos:pos+2])[0]
    if header == 0xFFFF:
        pos += 2
        print("Found standard 0xFFFF header")
    else:
        print("No 0xFFFF header, assuming raw data or custom format? (Check first segment)")
        # Some files might just start with start/end address without FFFF if it's not the very first load, 
        # but usually the file starts with FFFF.
        
    while pos < len(data):
        if pos + 4 > len(data):
            # Check if we are just at the end (EOF)
            if pos == len(data):
                break
            print(f"Trailing data at {pos}: {data[pos:].hex()}")
            break
            
        val1 = struct.unpack("<H", data[pos:pos+2])[0]
        
        if val1 == 0xFFFF:
            print("Found 0xFFFF header marker")
            pos += 2
            if pos + 4 > len(data):
                 print("Unexpected EOF after FFFF")
                 break
            start_addr = struct.unpack("<H", data[pos:pos+2])[0]
            end_addr = struct.unpack("<H", data[pos+2:pos+4])[0]
            pos += 4
        else:
            start_addr = val1
            end_addr = struct.unpack("<H", data[pos+2:pos+4])[0]
            pos += 4
        
        length = end_addr - start_addr + 1
        print(f"Segment: Start ${start_addr:04X}, End ${end_addr:04X}, Len {length} bytes")
        
        if pos + length > len(data):
            print("Error: Segment length exceeds file size")
            break
            
        # Move past data
        pos += length

if __name__ == "__main__":
    if len(sys.argv) > 1:
        analyze_atari_binary(sys.argv[1])
    else:
        print("Usage: python3 analyze_bin.py <file>")
