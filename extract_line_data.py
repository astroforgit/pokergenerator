import struct
import sys

def extract_line_data(filepath, target_line):
    with open(filepath, 'rb') as f:
        data = f.read()
    
    pos = 2
    while pos < len(data):
        if pos + 4 > len(data): break
        ln = struct.unpack("<H", data[pos:pos+2])[0]
        # ptr = struct.unpack("<H", data[pos+2:pos+4])[0]
        
        start_data = pos + 4
        eol = -1
        for k in range(start_data, len(data)):
            if data[k] == 0x16:
                eol = k
                break
        if eol == -1: break
        
        if ln == target_line:
            # Extract raw bytes from start_data to eol
            raw = data[start_data:eol]
            out_name = f"line_{ln}.bin"
            with open(out_name, "wb") as out_f:
                out_f.write(raw)
            print(f"Extracted {len(raw)} bytes to {out_name}")
            return
            
        pos = eol + 1

if __name__ == "__main__":
    extract_line_data(sys.argv[1], int(sys.argv[2]))
