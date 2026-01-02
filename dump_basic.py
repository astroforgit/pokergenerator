import struct
import sys

def parse_number(data):
    # Atari BASIC Number format (6 bytes BCD/Float)
    # We can just print hex for now or try to decode
    return f"[NUM: {data.hex()}]"

def decode_basic_line(line_data):
    output = []
    i = 0
    while i < len(line_data):
        token = line_data[i]
        
        if token == 0x0E: # Number
            if i + 7 > len(line_data):
                output.append("[NumPartial]")
                break
            num_data = line_data[i+1:i+7]
            output.append(parse_number(num_data))
            i += 7
        elif token == 0x0F: # String
            if i + 2 > len(line_data):
                break
            slen = line_data[i+1]
            sval = line_data[i+2:i+2+slen]
            output.append(f'"{sval.decode("ascii", "ignore")}"')
            i += 2 + slen
        elif token == 0x16: # EOL? usually stripped before calling this
            output.append("[EOL]")
            i += 1
        elif token < 0x80: # Variable?
            output.append(f"VAR_{token:02X}")
            i += 1
        else:
            output.append(f"<{token:02X}>")
            i += 1
    return " ".join(output)

def list_basic(filepath):
    with open(filepath, 'rb') as f:
        data = f.read()
    
    pos = 2
    while pos < len(data):
        if pos + 4 > len(data): break
        ln = struct.unpack("<H", data[pos:pos+2])[0]
        ptr = struct.unpack("<H", data[pos+2:pos+4])[0]
        
        start_data = pos + 4
        eol = -1
        for k in range(start_data, len(data)):
            if data[k] == 0x16:
                eol = k
                break
        
        if eol == -1: break
        
        line_data = data[start_data:eol]
        decoded = decode_basic_line(line_data)
        
        print(f"{ln} {decoded}")
        
        pos = eol + 1

if __name__ == "__main__":
    list_basic(sys.argv[1])
