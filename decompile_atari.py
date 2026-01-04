import struct
import sys

# Atari BASIC Token Map (Approximation)
STATEMENTS = {
    0x00: 'REM', 0x01: 'DATA', 0x02: 'INPUT', 0x03: 'COLOR', 0x04: 'LIST', 
    0x05: 'ENTER', 0x06: 'LET', 0x07: 'IF', 0x08: 'FOR', 0x09: 'NEXT', 
    0x0A: 'GOTO', 0x0B: 'GOSUB', 0x0C: 'TRAP', 0x0D: 'BYE', 0x0E: 'CONT', 
    0x0F: 'COM', 0x10: 'CLOSE', 0x11: 'CLR', 0x12: 'DEG', 0x13: 'DIM', 
    0x14: 'END', 0x15: 'NEW', 0x16: 'OPEN', 0x17: 'LOAD', 0x18: 'SAVE', 
    0x19: 'STATUS', 0x1A: 'NOTE', 0x1B: 'POINT', 0x1C: 'XIO', 0x1D: 'ON', 
    0x1E: 'POKE', 0x1F: 'PRINT', 0x20: 'RAD', 0x21: 'READ', 0x22: 'RESTORE', 
    0x23: 'RETURN', 0x24: 'RUN', 0x25: 'STOP', 0x26: 'POP', 0x27: '?', 
    0x28: 'GET', 0x29: 'PUT', 0x2A: 'GRAPHICS', 0x2B: 'PLOT', 0x2C: 'POSITION', 
    0x2D: 'DOS', 0x2E: 'DRAWTO', 0x2F: 'SETCOLOR', 0x30: 'LOCATE', 0x31: 'SOUND', 
    0x32: 'LPRINT', 0x33: 'CSAVE', 0x34: 'CLOAD', 0x35: 'IMPLICIT_LET', 0x36: 'ERROR-'
}

OPERATORS = {
    0x10: '+', 0x11: '-', 0x12: '*', 0x13: '/', 0x14: '&', 
    0x15: 'OR', 0x16: 'AND', 0x17: 'NOT', 0x18: '<', 0x19: '>', 
    0x1A: '=', 0x1B: '<=', 0x1C: '>=', 0x1D: '<>', 0x1E: '^', 
    0x1F: '(', 0x20: ')', 0x21: ',', 0x22: ';', 0x23: 'EOL', 
    0x24: 'GOTO_OP', 0x25: 'GOSUB_OP', 0x26: 'TO', 0x27: 'STEP', 0x28: 'THEN',
    0x29: '#', 0x2A: '$', 0x2B: 'STR$', 0x2C: 'CHR$', 0x2D: 'USR', 
    0x2E: 'ASC', 0x2F: 'VAL', 0x30: 'LEN', 0x31: 'ADR', 0x32: 'ATN', 
    0x33: 'COS', 0x34: 'PEEK', 0x35: 'SIN', 0x36: 'RND', 0x37: 'FRE', 
    0x38: 'EXP', 0x39: 'LOG', 0x3A: 'CLOG', 0x3B: 'SQR', 0x3C: 'SGN', 
    0x3D: 'ABS', 0x3E: 'INT', 0x3F: 'PADDLE', 0x40: 'STICK', 0x41: 'PTRIG', 
    0x42: 'STRIG', 0x43: 'BUMP', 0x44: 'PEN', 0x45: 'ERR'
}

def parse_float(data):
    # Atari 6-byte floating point
    # Just return hex for now to be safe
    return f"{{FLT:{data.hex()}}}"

def parse_var_table(data, vnt_start, vnt_end):
    # VNT: List of strings, last char has 0x80 set
    vnt_data = data[vnt_start:vnt_end]
    variables = []
    current_name = ""
    for b in vnt_data:
        char_code = b & 0x7F
        current_name += chr(char_code)
        if b & 0x80:
            variables.append(current_name)
            current_name = ""
    return variables

def decompile(filepath):
    with open(filepath, 'rb') as f:
        data = f.read()

    # Heuristic parsing of pointers in first few bytes?
    # Actually, usually the file starts directly with the Statement Table (Line list)
    # But it might be a memory dump.
    # Extracted SP had `00 00 00 01 3a 02 ...`
    # `00 00` ignored.
    # `00 01` (Line 256)
    
    # We need to find the VNT (Variable Name Table) to decode vars.
    # It usually follows the Statement Table.
    # We can scan for it? It looks like ASCII text.
    
    # Let's do a pass to find VNT start
    # Iterate lines until we hit something that isn't a line.
    pos = 2
    while pos < len(data):
        if pos + 4 > len(data): break
        ln = struct.unpack("<H", data[pos:pos+2])[0]
        offset = struct.unpack("<H", data[pos+2:pos+4])[0]
        
        # Check if line number is reasonable (0-32767)
        if ln > 32767:
            # End of statement table?
            break
            
        # Check for EOL (0x16)
        # Scan forward
        # If offset is relative to start of file, we can jump?
        # In memory, offset is address. In file, it is displacement?
        # Usually in file it's displacement.
        
        # Let's assume we can walk lines.
        # But we need VNT.
        
        # Heuristic: Scan for common variable names like "A", "I", "X", "Y" at the end of file?
        # Or look for text strings that aren't inside quotes.
        pos += 1 # slow scan
        
    # Better approach: Just decompile assuming no vars first, and print VAR_xx.
    # Then we can infer VNT location or names.
    
    variables = []
    # Search for VNT manually?
    # VNT usually starts after the last line.
    
    print("--- DECOMPILING ---")
    pos = 2
    while pos < len(data):
        if pos + 4 > len(data): break
        ln = struct.unpack("<H", data[pos:pos+2])[0]
        line_len_ptr = struct.unpack("<H", data[pos+2:pos+4])[0]
        
        if ln == 0 and line_len_ptr == 0: break # End of table?
        
        # Scan for EOL (0x16)
        stmt_start = pos + 4
        eol = -1
        for k in range(stmt_start, len(data)):
            if data[k] == 0x16:
                eol = k
                break
        
        if eol == -1: 
            # Could be end of program data, followed by VNT
            # The "Line Number" we read might be garbage (start of VNT)
            # Stop here.
            break
            
        # Process Line
        line_data = data[stmt_start:eol]
        
        # De-tokenize line
        output = []
        i = 0
        while i < len(line_data):
            byte = line_data[i]
            
            if byte == 0x0E: # Number
                val_bytes = line_data[i+1:i+7]
                # Decode BCD/Float
                # Atari Float: 1 byte exp, 5 bytes mantissa (BCD pairs)
                exp = val_bytes[0]
                mantissa = val_bytes[1:]
                # Convert BCD to hex string for now
                val_str = mantissa.hex()
                output.append(f"#{val_str}E{exp:02X}")
                i += 7
            elif byte == 0x0F: # String literal
                slen = line_data[i+1]
                sval = line_data[i+2:i+2+slen]
                # Escape quotes
                s_str = sval.decode('ascii', errors='replace').replace('"', '""')
                output.append(f'"{s_str}"')
                i += 2 + slen
            elif byte & 0x80: # Variable
                var_idx = byte & 0x7F
                var_name = f"V{var_idx}"
                # If we have VNT, use it
                if var_idx < len(variables):
                    var_name = variables[var_idx]
                
                # Check for array indexing or modification?
                output.append(var_name)
                i += 1
            elif byte in STATEMENTS:
                 # Statement is usually at start of line or after colon
                 output.append(STATEMENTS[byte])
                 i += 1
            elif byte in OPERATORS:
                 output.append(OPERATORS[byte])
                 i += 1
            else:
                 output.append(f"<{byte:02X}>")
                 i += 1
                 
        print(f"{ln} {' '.join(output)}")
        
        pos = eol + 1
        
        # Check if next bytes look like a line header (2 bytes LN, 2 bytes PTR)
        # If not, we might be at VNT.
        
if __name__ == "__main__":
    decompile(sys.argv[1])
