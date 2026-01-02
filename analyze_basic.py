import struct
import sys

def analyze_basic(filepath):
    with open(filepath, 'rb') as f:
        data = f.read()
        
    pos = 0
    # BASIC usually starts with 00 00??
    # Or maybe not.
    
    # Try to find line structure.
    # Line structure: [LineNum 2 bytes] [LineSize 2 bytes] [Cmds...] [16]
    # LineSize usually includes the header?
    
    while pos < len(data):
        if pos + 4 > len(data):
            break
            
        # Try Little Endian
        ln = struct.unpack("<H", data[pos:pos+2])[0]
        # Offset/Size
        offset = struct.unpack("<H", data[pos+2:pos+4])[0]
        
        print(f"Pos {pos:04X}: Line {ln}, Offset {offset:04X}")
        
        # Heuristic: Offset should be > pos?
        # If it's a memory pointer, it will be much larger.
        # But the distance between offsets should match the line length.
        
        # If we just advance 20 bytes to test?
        # No, we need to know the length.
        
        # If 'offset' is the absolute address of the next line.
        # Let's assume the first line starts at some base address.
        # Base = Offset - (Pos + LengthOfLine) ??
        
        # Let's just print the first few and see if there's a pattern.
        if pos > 100: break
        pos += 1  # Scan byte by byte to find pattern? No.
        
        # If we assume it is a linked list structure where 'offset' is the pointer to next line.
        # Let's see if we can deduce the 'next' position.
        
        # Let's just print 16 bytes at each step for manual inspection first
        pos += 4
        
if __name__ == "__main__":
    analyze_basic(sys.argv[1])
