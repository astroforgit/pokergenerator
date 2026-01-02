import sys

def find_xor_ops(filepath):
    with open(filepath, 'rb') as f:
        data = f.read()
    
    print(f"Scanning {filepath} ({len(data)} bytes)...")
    
    # Opcode list for EOR
    # 49: EOR #imm
    # 45: EOR zp
    # 55: EOR zp,X
    # 4D: EOR abs
    # 5D: EOR abs,X
    # 59: EOR abs,Y
    # 41: EOR (zp,X)
    # 51: EOR (zp),Y
    
    xor_ops = [0x49, 0x45, 0x55, 0x4D, 0x5D, 0x59, 0x41, 0x51]
    
    for i in range(len(data)):
        if data[i] in xor_ops:
            # Check context (simple heuristic disassembly)
            op = data[i]
            if op == 0x49: # #imm (2 bytes)
                if i+1 < len(data):
                    val = data[i+1]
                    print(f"{i:04X}: EOR #${val:02X}")
            elif op == 0x51: # (zp),Y (2 bytes)
                if i+1 < len(data):
                    val = data[i+1]
                    print(f"{i:04X}: EOR (${val:02X}),Y  <-- Potential decryption loop")
            elif op == 0x5D: # abs,X (3 bytes)
                if i+2 < len(data):
                    val = data[i+1] | (data[i+2] << 8)
                    print(f"{i:04X}: EOR ${val:04X},X")
            elif op == 0x4D: # abs (3 bytes)
                if i+2 < len(data):
                    val = data[i+1] | (data[i+2] << 8)
                    print(f"{i:04X}: EOR ${val:04X}")

if __name__ == "__main__":
    for f in sys.argv[1:]:
        find_xor_ops(f)
