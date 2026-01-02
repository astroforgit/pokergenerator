import struct
import sys

def scan_basic(filepath):
    with open(filepath, 'rb') as f:
        data = f.read()
    
    pos = 2 # Skip header 00 00
    
    while pos < len(data):
        if pos + 4 > len(data):
            break
            
        ln = struct.unpack("<H", data[pos:pos+2])[0]
        ptr = struct.unpack("<H", data[pos+2:pos+4])[0]
        
        start_data = pos + 4
        # Scan for EOL (0x16)
        eol = -1
        for i in range(start_data, len(data)):
            if data[i] == 0x16:
                eol = i
                break
        
        if eol == -1:
            print(f"Error: No EOL found for line {ln} starting at {pos:04X}")
            break
            
        line_len = eol - start_data
        print(f"Line {ln}: Offset {pos:04X}, DataLen {line_len}, NextPos {eol+1:04X}")
        
        # Dump first few bytes of data to see if it makes sense
        preview = data[start_data:min(start_data+16, eol)].hex()
        print(f"  Data: {preview}")
        
        pos = eol + 1

if __name__ == "__main__":
    scan_basic(sys.argv[1])
