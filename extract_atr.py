import struct
import os

def read_sector(f, sector_num, sector_size=128):
    # Header is 16 bytes.
    # Sectors are 1-indexed.
    offset = 16 + (sector_num - 1) * sector_size
    f.seek(offset)
    return f.read(sector_size)

def extract_files(atr_path):
    output_dir = "extracted"
    os.makedirs(output_dir, exist_ok=True)
    
    with open(atr_path, "rb") as f:
        # Check header
        header = f.read(16)
        magic = struct.unpack("<H", header[:2])[0]
        if magic != 0x0296:
            print("Not a valid ATR file.")
            return

        # Assume 128 byte sectors for now based on header analysis
        SECTOR_SIZE = 128
        
        # Directory starts at sector 361, length 8 sectors
        DIR_START = 361
        DIR_LEN = 8
        
        files = []
        
        print("Reading directory...")
        for i in range(DIR_LEN):
            sec_data = read_sector(f, DIR_START + i, SECTOR_SIZE)
            # 8 entries per sector (16 bytes each)
            for entry_idx in range(0, SECTOR_SIZE, 16):
                entry = sec_data[entry_idx : entry_idx + 16]
                flag = entry[0]
                if flag == 0: continue # Deleted/Empty
                
                cnt = struct.unpack("<H", entry[1:3])[0]
                start_sector = struct.unpack("<H", entry[3:5])[0]
                name = entry[5:13].decode('ascii', errors='ignore').strip()
                ext = entry[13:16].decode('ascii', errors='ignore').strip()
                
                full_name = f"{name}.{ext}" if ext else name
                
                # Sanitize filename to remove null bytes or invalid chars
                full_name = "".join(c for c in full_name if c.isalnum() or c in "._-")
                
                if flag != 0 and start_sector != 0:
                    files.append((full_name, start_sector, flag))
                    print(f"Found file: {full_name} (Start: {start_sector}, Flag: {flag:02x})")

        # Extract
        for fname, start, flag in files:
            print(f"Extracting {fname}...")
            file_data = bytearray()
            current_sector = start
            
            while current_sector != 0:
                # Loop safety
                if current_sector > 720: # Sanity check for SD disk
                    print(f"Sector {current_sector} out of bounds, stopping.")
                    break
                    
                data = read_sector(f, current_sector, SECTOR_SIZE)
                
                # Link bytes
                # Byte 125: (file_no << 2) | (next_sector_high)
                # Byte 126: next_sector_low
                # Byte 127: byte_count
                
                link_byte = data[125]
                next_sector_low = data[126]
                byte_count = data[127]
                
                next_sector_high = link_byte & 0x03
                next_sector = (next_sector_high << 8) | next_sector_low
                
                # Sanity check on byte_count
                if byte_count > 125:
                    byte_count = 125 # Should be max 125 for data
                
                file_data.extend(data[:byte_count])
                
                current_sector = next_sector
                # Link 0 means end of file usually, or strictly last sector logic?
                # In Atari DOS, next_sector usually points to 0 on the last sector.
                # Or sometimes bit 0x80 in link byte? No, standard is next_sector field.
                
                if current_sector == 0:
                    break

            out_path = os.path.join(output_dir, fname)
            with open(out_path, "wb") as out_f:
                out_f.write(file_data)
            print(f"Saved {out_path} ({len(file_data)} bytes)")

if __name__ == "__main__":
    extract_files("Strip Poker.atr")
