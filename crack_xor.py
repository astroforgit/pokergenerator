import sys
import collections

def score_data(data):
    # Heuristic: Mode 15 images have lots of 00, 55, AA, FF (solid colors)
    # 00 = 00000000
    # 55 = 01010101
    # AA = 10101010
    # FF = 11111111
    
    counts = collections.Counter(data)
    total = len(data)
    if total == 0: return 0
    
    solid_count = counts[0x00] + counts[0x55] + counts[0xAA] + counts[0xFF]
    
    # Also vertical coherence?
    
    return solid_count / total

def try_crack(filepath):
    with open(filepath, 'rb') as f:
        full_data = f.read()
        
    if len(full_data) <= 5600:
        print("File too small for 5-byte header hypothesis")
        payload = full_data
    else:
        # Assume 5 byte header
        header = full_data[:5]
        payload = full_data[5:]
        
    print(f"Analyzing {filepath}, Payload: {len(payload)} bytes")
    
    best_score = 0
    best_algo = ""
    best_data = None
    
    # Algo 1: XOR with Constant
    for k in range(256):
        attempt = bytes([x ^ k for x in payload])
        s = score_data(attempt)
        if s > best_score:
            best_score = s
            best_algo = f"XOR Constant {k:02X}"
            best_data = attempt
            
    # Algo 2: XOR with previous byte (Cipher Block Chaining / Delta)
    # Out[i] = In[i] ^ In[i-1]
    attempt = bytearray()
    prev = 0 # Or use header[-1]?
    # Let's try 0 first
    for x in payload:
        val = x ^ prev
        attempt.append(val)
        prev = x 
    s = score_data(attempt)
    if s > best_score:
        best_score = s
        best_algo = "XOR with Previous Input (Delta)"
        best_data = attempt

    # Algo 3: XOR with previous Output (CBC)
    # Out[i] = In[i] ^ Out[i-1]
    attempt = bytearray()
    prev = 0
    for x in payload:
        val = x ^ prev
        attempt.append(val)
        prev = val
    s = score_data(attempt)
    if s > best_score:
        best_score = s
        best_algo = "XOR with Previous Output (Accumulator)"
        best_data = attempt
        
    # Algo 4: Seeded XOR?
    # Maybe header contains the seed?
    if len(full_data) > 5:
        # Try using last byte of header as seed for Algo 3
        seed = full_data[4]
        attempt = bytearray()
        prev = seed
        for x in payload:
            val = x ^ prev
            attempt.append(val)
            prev = val
        s = score_data(attempt)
        if s > best_score:
            best_score = s
            best_algo = f"XOR with Prev Output (Seed {seed:02X} from header)"
            best_data = attempt

    print(f"Best Match: {best_algo} (Score: {best_score:.4f})")
    
    if best_data and best_score > 0.1: # Threshold
        out_name = filepath + ".cracked"
        with open(out_name, "wb") as f:
            f.write(best_data)
        print(f"Saved cracked data to {out_name}")

if __name__ == "__main__":
    try_crack("extracted/OP1.1")
    try_crack("extracted/OPP")
