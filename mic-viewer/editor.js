// Asteroida Studio Editor
// Integrated from edit.html

const API_URL = 'http://localhost:3001';

class EditorApp {
  constructor() {
    this.project = { enums: [], geometry: {}, objects: [], rooms: [], scripts: {} };
    this.currentMode = 'rooms';
    this.selectedRoomIdx = 0;
    this.selectedObjId = null;
    this.zoom = 3; // Default to 3x zoom for better visibility
    this.dragMode = null;
    this.dragStart = {x:0, y:0};
    this.initGeo = {x:0, y:0, w:0, h:0};
    this.activeEdit = null;
    this.currentMICData = null;
    this.VERBS = ["ACTION_EXAMINE_LABEL", "ACTION_GET_LABEL", "ACTION_USE_LABEL", "ACTION_OPEN_LABEL", "CUSTOM_GO", "CUSTOM_FLUSH", "CUSTOM_SWITCH"];

    this.canvas = document.getElementById('gameCanvas');
    if (this.canvas) {
      this.ctx = this.canvas.getContext('2d');
      // Set initial canvas size to 160x160 (Atari screen size)
      this.canvas.width = 160;
      this.canvas.height = 160;
    }

    this.initEventListeners();
    this.renderList();
    this.renderCanvas();
    this.renderProperties();
    this.updateCanvasScale(); // Apply initial zoom
  }

  // --- LOGGER ---
  log(m, c) {
    const p = document.getElementById('logPanel');
    if (!p) return;
    const d = document.createElement('div');
    d.className = 'log-entry ' + c;
    d.innerText = `[${new Date().toLocaleTimeString()}] ${m}`;
    p.prepend(d);
  }

  info(m) { this.log(m, 'log-info'); }
  success(m) { this.log(m, 'log-success'); }
  error(m) { this.log(m, 'log-error'); }

  // --- JSON SAVE / LOAD ---
  saveJSON() {
    try {
      const jsonStr = JSON.stringify(this.project, null, 2);
      const blob = new Blob([jsonStr], {type: "application/json"});
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "asteroida_project.json";
      link.click();
      this.success("Project saved as JSON.");
    } catch(e) {
      this.error("JSON Save failed: " + e);
    }
  }

  loadJSON(input) {
    if (!input.files[0]) return;
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = JSON.parse(e.target.result);
        if(!data.rooms || !data.objects) throw new Error("Invalid JSON structure");
        this.project = data;
        this.success(`JSON Loaded: ${this.project.rooms.length} Rooms, ${this.project.objects.length} Objects.`);
        this.selectedRoomIdx = 0;
        this.selectedObjId = null;
        this.switchMode('rooms');
      } catch(err) {
        this.error("JSON Load Error: " + err.message);
      }
    };
    reader.readAsText(input.files[0]);
    input.value = '';
  }

  // --- LOAD MIC/COL PREVIEW ---
  async loadMICPreview() {
    try {
      // Get list of available files
      const response = await fetch(`${API_URL}/api/files`);
      const data = await response.json();

      if (!data.success || !data.files || data.files.length === 0) {
        this.error("No MIC/COL files available");
        return;
      }

      // Show file selection dialog
      const fileNames = data.files.map(f => f.name);
      const selected = prompt(`Select a file to load:\n\n${fileNames.map((n, i) => `${i+1}. ${n}`).join('\n')}\n\nEnter number:`);

      if (!selected) return;

      const index = parseInt(selected) - 1;
      if (index < 0 || index >= data.files.length) {
        this.error("Invalid selection");
        return;
      }

      const file = data.files[index];
      this.info(`Loading ${file.name}...`);

      // Load MIC file
      const micResponse = await fetch(`${API_URL}${file.micPath}`);
      const micData = await micResponse.arrayBuffer();

      // Load COL file
      const colResponse = await fetch(`${API_URL}${file.colPath}`);
      const colData = await colResponse.arrayBuffer();

      // Load palette
      const paletteResponse = await fetch(`${API_URL}${file.palettePath}`);
      const paletteData = await paletteResponse.arrayBuffer();

      // Render to canvas
      this.renderMICToCanvas(new Uint8Array(micData), new Uint8Array(colData), new Uint8Array(paletteData));
      this.success(`Loaded ${file.name}`);

    } catch(error) {
      this.error(`Failed to load MIC/COL: ${error.message}`);
    }
  }

  async autoLoadRoomMIC(room) {
    if (!room || !room.id) return;

    try {
      // Get list of available files
      const response = await fetch(`${API_URL}/api/files`);
      const data = await response.json();

      if (!data.success || !data.files || data.files.length === 0) {
        return; // Silently fail if no files available
      }

      // Try to find matching MIC file based on room ID
      // Examples: ROOM_A -> 1_A, ROOM_B -> 1_B, ROOM_C -> 1_C
      let matchingFile = null;

      // Extract letter from room ID (e.g., ROOM_A -> A)
      const match = room.id.match(/ROOM_([A-Z])/);
      if (match) {
        const letter = match[1];
        const searchName = `1_${letter}`; // Try format like 1_A, 1_B, 1_C
        matchingFile = data.files.find(f => f.name === searchName);
      }

      // If no match found, try other patterns
      if (!matchingFile) {
        // Try room name without ROOM_ prefix
        const simpleName = room.id.replace('ROOM_', '');
        matchingFile = data.files.find(f => f.name === simpleName);
      }

      if (matchingFile) {
        this.info(`Auto-loading ${matchingFile.name} for ${room.id}...`);

        // Load MIC, COL, and palette files
        const [micRes, colRes, palRes] = await Promise.all([
          fetch(`${API_URL}${matchingFile.micPath}`),
          fetch(`${API_URL}${matchingFile.colPath}`),
          fetch(`${API_URL}${matchingFile.palettePath}`)
        ]);

        const micData = new Uint8Array(await micRes.arrayBuffer());
        const colData = new Uint8Array(await colRes.arrayBuffer());
        const paletteData = new Uint8Array(await palRes.arrayBuffer());

        this.renderMICToCanvas(micData, colData, paletteData);
      }
    } catch (error) {
      // Silently fail - auto-load is optional
      console.log(`Auto-load failed for ${room.id}:`, error);
    }
  }

  renderMICToCanvas(micData, colData, paletteData) {
    if (!this.ctx || !this.canvas) {
      this.error("Canvas not initialized");
      return;
    }

    // Parse palette (ACT format: 256 colors × 3 bytes RGB)
    const palette = [];
    for (let i = 0; i < 256; i++) {
      palette.push({
        r: paletteData[i * 3],
        g: paletteData[i * 3 + 1],
        b: paletteData[i * 3 + 2]
      });
    }

    // Render MIC data
    const width = 160;
    const height = 160; // Fixed height for Atari screen

    this.canvas.width = width;
    this.canvas.height = height;

    const imageData = this.ctx.createImageData(width, height);
    const pixels = imageData.data;

    for (let y = 0; y < height; y++) {
      // Get palette for this scanline from COL data
      const scanlinePalette = [
        colData[y],           // PF0
        colData[256 + y],     // PF1
        colData[512 + y],     // PF2
        colData[768 + y]      // PF3
      ];

      for (let x = 0; x < width; x++) {
        const byteIndex = y * (width / 4) + Math.floor(x / 4);
        const pixelInByte = 3 - (x % 4);
        const colorIndex = (micData[byteIndex] >> (pixelInByte * 2)) & 0x03;

        const atariColorIndex = scanlinePalette[colorIndex];
        const color = palette[atariColorIndex];

        const pixelIndex = (y * width + x) * 4;
        pixels[pixelIndex] = color.r;
        pixels[pixelIndex + 1] = color.g;
        pixels[pixelIndex + 2] = color.b;
        pixels[pixelIndex + 3] = 255;
      }
    }

    // Store the image data for later use
    this.currentMICData = imageData;

    // Render to canvas
    this.renderCanvas();
    this.success("MIC file loaded successfully");
  }

  // --- C PARSER ---
  parseArrayDepth(source, arrayName, callback) {
    const startIdx = source.indexOf(arrayName);
    if (startIdx === -1) return;
    let openBrace = source.indexOf('{', startIdx);
    if (openBrace === -1) return;
    let depth = 0, start = -1, inStr = false, itemIndex = 0;
    for (let i = openBrace; i < source.length; i++) {
      const c = source[i];
      if (c === '"' && source[i-1] !== '\\') inStr = !inStr;
      if (inStr) continue;
      if (c === '{') { if (depth === 1) start = i; depth++; }
      else if (c === '}') {
        depth--;
        if (depth === 1 && start !== -1) { callback(itemIndex, source.substring(start, i+1)); itemIndex++; start = -1; }
        if (depth === 0) break;
      }
    }
  }

  parseScriptsDepth(source) {
    const scripts = {};
    let pos = 0;
    while(pos < source.length) {
      const voidIdx = source.indexOf("void ", pos);
      if(voidIdx === -1) break;
      const openParen = source.indexOf("(", voidIdx);
      const closeParen = source.indexOf(")", openParen);
      const openBrace = source.indexOf("{", closeParen);
      if(openParen > -1 && closeParen > -1 && openBrace > -1 && (openBrace - closeParen) < 20) {
        const funcName = source.substring(voidIdx + 5, openParen).trim();
        if(funcName.startsWith("action_") || funcName.startsWith("endgame_") || funcName.startsWith("FX_")) {
          let depth = 0, bodyStart = openBrace, bodyEnd = -1;
          for(let i=openBrace; i<source.length; i++) {
            if(source[i] === '{') depth++;
            else if(source[i] === '}') { depth--; if(depth === 0) { bodyEnd = i; break; } }
          }
          if(bodyEnd > -1) {
            const body = source.substring(bodyStart + 1, bodyEnd).trim();
            scripts[funcName] = body;
            pos = bodyEnd + 1; continue;
          }
        }
      }
      pos = voidIdx + 5;
    }
    return scripts;
  }

  // --- TXT IMPORT ---
  importTextProject(input) {
    if (!input.files[0]) return;
    const reader = new FileReader();
    reader.onload = e => this.parseProject(e.target.result);
    reader.readAsText(input.files[0]);
    input.value = '';
  }

  parseProject(txt) {
    this.info("Parsing C Code...");

    const files = {};
    txt.split("//F:").forEach(s => {
      const split = s.indexOf('\n');
      if (split > 0) {
        const filename = s.substring(0, split).trim();
        const content = s.substring(split + 1);
        files[filename] = content;
      }
    });

    // 1. Enums
    let areasH = Object.keys(files).find(k=>k.includes("areas_def.h"));
    let objsH = Object.keys(files).find(k=>k.includes("objects_def.h"));
    let enums = [];
    const extractE = c => { if(c) for(const m of c.matchAll(/([A-Z0-9_]+)\s*(?:=.*?)?,/g)) if(!m[1].includes("LAST") && !m[1].startsWith("AREA_") && m[1]!=="OBJECT_FIRST") enums.push(m[1]); };
    extractE(files[areasH]); extractE(files[objsH]);
    this.project.enums = [...new Set(enums)];

    // 2. Geometry
    let areasC = Object.keys(files).find(k=>k.includes("areas_def.c"));
    this.project.geometry = {};
    if (files[areasC]) {
      this.parseArrayDepth(files[areasC], "g_areas", (idx, content) => {
        const parts = content.replace(/[{}]/g,'').split(',');
        const val = s => {
          if(!s) return 0; s=s.split('//')[0].trim();
          if(s.includes('/')) { const [n,d]=s.split('/'); return Math.round(parseFloat(n)/parseFloat(d)); }
          return parseInt(s)||0;
        };
        if(this.project.enums[idx]) this.project.geometry[this.project.enums[idx]] = { x:val(parts[0]), y:val(parts[1]), w:val(parts[2]), h:val(parts[3]) };
      });
    }

    // 3. Objects
    let objsC = Object.keys(files).find(k=>k.includes("objects_def.c"));
    this.project.objects = [];
    if (files[objsC]) {
      this.parseArrayDepth(files[objsC], "g_objects", (idx, content) => {
        if(idx >= this.project.enums.length) return;
        const name = (content.match(/"(.*?)"/) || [])[1] || "Unnamed";
        let actions = [];
        let d = 0, startAct = -1;
        for(let i=0; i<content.length; i++) { if(content[i]=='{') { d++; if(d===2) startAct = i; } }
        if(startAct > -1) {
          const actBlock = content.substring(startAct, content.lastIndexOf('}'));
          const actPairs = actBlock.match(/\{.*?\}/g);
          if(actPairs) actPairs.forEach(p => {
            const c = p.replace(/[{}]/g,'');
            const sp = c.indexOf(',');
            if(sp > -1) {
              const v = c.substring(0, sp).trim();
              const param = c.substring(sp+1).trim();
              if(v !== "TEXT_NONE") actions.push({v, p: param});
            }
          });
        }
        this.project.objects.push({id: this.project.enums[idx], name, actions});
      });
    }

    // 4. Scripts
    this.project.scripts = {};
    const scriptFiles = Object.keys(files).filter(k => k.includes("actions"));
    scriptFiles.forEach(fn => {
      const foundScripts = this.parseScriptsDepth(files[fn]);
      Object.assign(this.project.scripts, foundScripts);
    });

    // 5. Rooms
    let roomsH = Object.keys(files).find(k=>k.includes("rooms_def.h"));
    let roomsC = Object.keys(files).find(k=>k.includes("rooms_def.c"));
    this.project.rooms = [];

    let roomEnums = [];
    if(files[roomsH]) {
      for(const m of files[roomsH].matchAll(/([A-Z0-9_]+)\s*(?:=.*?)?,/g))
        if(!m[1].includes("LAST")) roomEnums.push(m[1]);
    }

    let parsedRoomsData = [];
    if(files[roomsC]) {
      this.parseArrayDepth(files[roomsC], "g_rooms", (idx, content) => {
        const lastOpen = content.lastIndexOf('{');
        const lastClose = content.lastIndexOf('}');
        let objList = [];
        if(lastOpen > -1 && lastClose > lastOpen) {
          const listStr = content.substring(lastOpen+1, lastClose);
          objList = listStr.split(',').map(s=>s.split('//')[0].trim()).filter(s=>s && s.includes("OBJECT") && !s.includes("NONE"));
        }
        parsedRoomsData.push(objList);
      });
    }

    roomEnums.forEach((rid, i) => {
      let objs = (i < parsedRoomsData.length) ? parsedRoomsData[i] : [];
      this.project.rooms.push({ id: rid, name: rid, objects: objs });
    });

    this.success(`C Import: ${this.project.rooms.length} Rooms, ${this.project.objects.length} Objects.`);
    this.switchMode('rooms');
  }

  // --- TXT EXPORT (Server-side conversion) ---
  async exportTextProject() {
    this.info("Exporting to full C text format via server...");

    try {
      // Send project data to server for conversion
      const response = await fetch(`${API_URL}/api/export-to-c`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(this.project)
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.statusText}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Export failed');
      }

      // Download the generated C code
      const blob = new Blob([result.content], {type: "text/plain"});
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "game_export.txt";
      link.click();

      this.success(`Exported: ${result.stats.objects} objects, ${result.stats.rooms} rooms, ${result.stats.lines} lines`);

    } catch (error) {
      this.error(`Export failed: ${error.message}`);
      console.error('Export error:', error);
    }
  }

  // --- TXT EXPORT (Fallback - client-side simple export) ---
  exportTextProjectSimple() {
    this.info("Generating simplified export format...");
    let output = "";

    // Export enums
    output += "//F:AdventureStudio/game/objects_def.h\n";
    output += "typedef enum {\n";
    this.project.enums.forEach((e, i) => {
      output += `  ${e} = ${i},\n`;
    });
    output += "  OBJECT_LAST\n} object_id_t;\n\n";

    // Export geometry
    output += "//F:AdventureStudio/game/areas_def.c\n";
    output += "const area_t g_areas[] = {\n";
    this.project.enums.forEach(e => {
      const g = this.project.geometry[e] || {x:0, y:0, w:0, h:0};
      output += `  {${g.x}, ${g.y}, ${g.w}, ${g.h}}, // ${e}\n`;
    });
    output += "};\n\n";

    // Export objects
    output += "//F:AdventureStudio/game/objects_def.c\n";
    output += "const object_t g_objects[] = {\n";
    this.project.objects.forEach(obj => {
      output += `  {\"${obj.name}\", {\n`;
      obj.actions.forEach(a => {
        output += `    {${a.v}, ${a.p}},\n`;
      });
      output += "  }},\n";
    });
    output += "};\n\n";

    // Export scripts
    Object.keys(this.project.scripts).forEach(funcName => {
      output += `//F:AdventureStudio/game/actions/${funcName}.c\n`;
      output += `void ${funcName}() {\n`;
      output += this.project.scripts[funcName];
      output += "\n}\n\n";
    });

    // Export rooms
    output += "//F:AdventureStudio/game/rooms_def.h\n";
    output += "typedef enum {\n";
    this.project.rooms.forEach((r, i) => {
      output += `  ${r.id} = ${i},\n`;
    });
    output += "  ROOM_LAST\n} room_id_t;\n\n";

    output += "//F:AdventureStudio/game/rooms_def.c\n";
    output += "const room_t g_rooms[] = {\n";
    this.project.rooms.forEach(r => {
      output += `  {${r.id}, {\n`;
      r.objects.forEach(o => output += `    ${o},\n`);
      output += "    OBJECT_NONE\n  }},\n";
    });
    output += "};\n";

    const blob = new Blob([output], {type: "text/plain"});
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "asteroida_export.txt";
    link.click();
    this.success("Exported to .txt file");
  }

  // --- MODE SWITCHING ---
  switchMode(mode) {
    this.currentMode = mode;
    document.getElementById('btnRooms').className = mode === 'rooms' ? 'primary' : '';
    document.getElementById('btnObjs').className = mode === 'objects' ? 'primary' : '';
    this.renderList();
    this.renderCanvas();
    this.renderProperties();
  }

  // --- LIST RENDERING ---
  renderList() {
    const container = document.getElementById('listContainer');
    container.innerHTML = '';

    if (this.currentMode === 'rooms') {
      this.project.rooms.forEach((r, i) => {
        const div = document.createElement('div');
        div.className = 'list-item' + (i === this.selectedRoomIdx ? ' active' : '');
        div.innerHTML = `<span>${r.name}</span><span class="meta">${r.objects.length} objs</span>`;
        div.onclick = () => {
          this.selectedRoomIdx = i;
          this.renderList();
          this.renderCanvas();
          this.renderProperties();
          this.autoLoadRoomMIC(r);
        };
        container.appendChild(div);
      });
    } else {
      this.project.objects.forEach(obj => {
        const div = document.createElement('div');
        div.className = 'list-item' + (obj.id === this.selectedObjId ? ' active' : '');
        div.innerHTML = `<span>${obj.name}</span><span class="meta">${obj.actions.length} acts</span>`;
        div.onclick = () => { this.selectedObjId = obj.id; this.renderList(); this.renderProperties(); };
        container.appendChild(div);
      });
    }
  }

  // --- CANVAS RENDERING ---
  renderCanvas() {
    if (!this.ctx || !this.canvas) return;

    // Clear canvas
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw MIC background if loaded
    if (this.currentMICData) {
      this.ctx.putImageData(this.currentMICData, 0, 0);
    }

    // Draw objects on top
    if (this.currentMode === 'rooms' && this.project.rooms[this.selectedRoomIdx]) {
      const room = this.project.rooms[this.selectedRoomIdx];

      room.objects.forEach(objId => {
        const geo = this.project.geometry[objId];
        if (!geo) return;

        const isSelected = objId === this.selectedObjId;

        // Draw filled rectangle
        this.ctx.fillStyle = isSelected ? 'rgba(74, 144, 226, 0.4)' : 'rgba(46, 204, 113, 0.2)';
        this.ctx.fillRect(geo.x, geo.y, geo.w, geo.h);

        // Draw border
        this.ctx.strokeStyle = isSelected ? '#fff' : '#2ecc71';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(geo.x, geo.y, geo.w, geo.h);

        // Draw resize handle for selected object
        if (isSelected) {
          this.ctx.fillStyle = '#fff';
          this.ctx.fillRect(geo.x + geo.w - 4, geo.y + geo.h - 4, 4, 4);

          // Draw label above object
          this.ctx.font = '9px monospace';
          this.ctx.fillText(objId.replace('OBJECT_ROOM_', '').replace('OBJECT_', ''), geo.x, geo.y - 3);
        }
      });
    }

    // Apply zoom by scaling the canvas display
    this.updateCanvasScale();
  }

  updateCanvasScale() {
    if (!this.canvas) return;

    // Scale canvas display size based on zoom
    const displayWidth = 160 * this.zoom;
    const displayHeight = 160 * this.zoom;

    this.canvas.style.width = displayWidth + 'px';
    this.canvas.style.height = displayHeight + 'px';

    // Force the canvas to be its actual size (no max-width/max-height constraints)
    this.canvas.style.minWidth = displayWidth + 'px';
    this.canvas.style.minHeight = displayHeight + 'px';

    this.info(`Zoom: ${this.zoom}x (${displayWidth}×${displayHeight}px)`);
  }

  setZoom(z) {
    this.zoom = z;
    this.updateCanvasScale();
  }

  // --- PROPERTIES PANEL ---
  renderProperties() {
    const container = document.getElementById('propContent');
    container.innerHTML = '';

    // If an object is selected (in rooms mode), show object properties
    if (this.selectedObjId) {
      const obj = this.project.objects.find(o => o.id === this.selectedObjId);
      const geo = this.project.geometry[this.selectedObjId];

      if (!obj) {
        container.innerHTML = '<p style="text-align:center;color:#666;margin-top:20px">Object not found</p>';
        return;
      }

      let html = `
        <div class="form-group">
          <h4>${obj.id}</h4>
          <label>Name</label>
          <input value="${obj.name}" oninput="window.editorApp.updateObjectName(this.value)">
        </div>
      `;

      // Show geometry if available
      if (geo) {
        html += `
          <div class="form-group">
            <h4>Geometry</h4>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
              <div>
                <label>X</label>
                <input type="number" value="${geo.x}" onchange="window.editorApp.updateGeo('x', this.value)">
              </div>
              <div>
                <label>Y</label>
                <input type="number" value="${geo.y}" onchange="window.editorApp.updateGeo('y', this.value)">
              </div>
              <div>
                <label>W</label>
                <input type="number" value="${geo.w}" onchange="window.editorApp.updateGeo('w', this.value)">
              </div>
              <div>
                <label>H</label>
                <input type="number" value="${geo.h}" onchange="window.editorApp.updateGeo('h', this.value)">
              </div>
            </div>
          </div>
        `;
      }

      // Show actions
      html += `
        <div class="form-group">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <h4>Actions</h4>
            <button onclick="window.editorApp.addAction()">+</button>
          </div>
      `;

      obj.actions.forEach((a, i) => {
        const opts = this.VERBS.map(v => `<option ${a.v === v ? 'selected' : ''}>${v}</option>`).join('');
        const scriptExists = this.project.scripts[a.p];
        html += `
          <div class="action-card">
            <div class="action-header">
              <select onchange="window.editorApp.updateActionVerb(${i}, this.value)" style="width:70%; font-size:11px;">
                ${opts}
              </select>
              <button class="danger" onclick="window.editorApp.removeAction(${i})">×</button>
            </div>
            <input value="${a.p}" readonly onclick="window.editorApp.editAction(${i})"
                   style="cursor:pointer; color:${scriptExists ? '#4a90e2' : '#aaa'}; font-size:11px;"
                   placeholder="Function Name...">
          </div>
        `;
      });

      html += `</div>`;
      container.innerHTML = html;
      return;
    }

    // No object selected - show room properties or "No Selection"
    if (this.currentMode === 'rooms' && this.project.rooms[this.selectedRoomIdx]) {
      const room = this.project.rooms[this.selectedRoomIdx];
      container.innerHTML = `
        <div class="form-group">
          <label>Room ID</label>
          <input value="${room.id}" onchange="window.editorApp.updateRoomId(this.value)">
        </div>
        <div class="form-group">
          <label>Room Name</label>
          <input value="${room.name}" onchange="window.editorApp.updateRoomName(this.value)">
        </div>
        <h4>Objects in Room:</h4>
        ${room.objects.map((o, i) => `
          <div class="action-card">
            <div class="action-header">
              <span>${o}</span>
              <button onclick="window.editorApp.removeObjectFromRoom(${i})">Remove</button>
            </div>
          </div>
        `).join('')}
        <button onclick="window.editorApp.addObjectToRoom()">+ Add Object</button>
      `;
    } else {
      container.innerHTML = '<p style="text-align:center;color:#666;margin-top:20px">No Selection</p>';
    }
  }

  // --- UPDATE METHODS ---
  updateRoomId(val) {
    if (this.project.rooms[this.selectedRoomIdx]) {
      this.project.rooms[this.selectedRoomIdx].id = val;
      this.renderList();
    }
  }

  updateRoomName(val) {
    if (this.project.rooms[this.selectedRoomIdx]) {
      this.project.rooms[this.selectedRoomIdx].name = val;
      this.renderList();
    }
  }

  updateObjectName(val) {
    const obj = this.project.objects.find(o => o.id === this.selectedObjId);
    if (obj) {
      obj.name = val;
      this.renderList();
    }
  }

  updateGeo(key, val) {
    if (this.project.geometry[this.selectedObjId]) {
      this.project.geometry[this.selectedObjId][key] = parseInt(val) || 0;
      this.renderCanvas();
    }
  }

  updateActionVerb(idx, verb) {
    const obj = this.project.objects.find(o => o.id === this.selectedObjId);
    if (obj && obj.actions[idx]) {
      obj.actions[idx].v = verb;
    }
  }

  addObjectToRoom() {
    const objId = prompt("Enter object ID to add:");
    if (objId && this.project.rooms[this.selectedRoomIdx]) {
      this.project.rooms[this.selectedRoomIdx].objects.push(objId);
      this.renderProperties();
      this.renderCanvas();
    }
  }

  removeObjectFromRoom(idx) {
    if (this.project.rooms[this.selectedRoomIdx]) {
      this.project.rooms[this.selectedRoomIdx].objects.splice(idx, 1);
      this.renderProperties();
      this.renderCanvas();
    }
  }

  addAction() {
    const obj = this.project.objects.find(o => o.id === this.selectedObjId);
    if (!obj) return;

    const verb = prompt(`Select action verb:\n${this.VERBS.map((v, i) => `${i+1}. ${v}`).join('\n')}\n\nEnter number:`);
    if (!verb) return;

    const verbIdx = parseInt(verb) - 1;
    if (verbIdx < 0 || verbIdx >= this.VERBS.length) return;

    const param = prompt("Enter parameter (function name or TEXT_xxx):");
    if (!param) return;

    obj.actions.push({ v: this.VERBS[verbIdx], p: param });
    this.renderProperties();
  }

  removeAction(idx) {
    const obj = this.project.objects.find(o => o.id === this.selectedObjId);
    if (obj) {
      obj.actions.splice(idx, 1);
      this.renderProperties();
    }
  }

  editAction(idx) {
    const obj = this.project.objects.find(o => o.id === this.selectedObjId);
    if (!obj || !obj.actions[idx]) return;

    const action = obj.actions[idx];
    const funcName = action.p;

    // Open modal
    this.activeEdit = { objId: obj.id, actionIdx: idx };
    document.getElementById('modalFuncName').value = funcName;
    document.getElementById('modalCode').value = this.project.scripts[funcName] || '';
    document.getElementById('codeModal').style.display = 'block';
    this.updateModalTitle();
  }

  updateModalTitle() {
    const funcName = document.getElementById('modalFuncName').value;
    document.getElementById('funcNameDisplay').innerText = funcName;
  }

  closeModal(save) {
    if (save && this.activeEdit) {
      const funcName = document.getElementById('modalFuncName').value;
      const code = document.getElementById('modalCode').value;

      if (funcName) {
        this.project.scripts[funcName] = code;

        // Update action parameter
        const obj = this.project.objects.find(o => o.id === this.activeEdit.objId);
        if (obj && obj.actions[this.activeEdit.actionIdx]) {
          obj.actions[this.activeEdit.actionIdx].p = funcName;
        }

        this.renderProperties();
        this.success(`Saved script: ${funcName}`);
      }
    }

    document.getElementById('codeModal').style.display = 'none';
    this.activeEdit = null;
  }

  createNewItem() {
    if (this.currentMode === 'rooms') {
      const id = prompt("Enter new room ID:");
      if (id) {
        this.project.rooms.push({ id, name: id, objects: [] });
        this.selectedRoomIdx = this.project.rooms.length - 1;
        this.renderList();
        this.renderCanvas();
        this.renderProperties();
      }
    } else {
      const id = prompt("Enter new object ID:");
      if (id) {
        this.project.enums.push(id);
        this.project.objects.push({ id, name: id, actions: [] });
        this.project.geometry[id] = { x: 0, y: 0, w: 20, h: 20 };
        this.selectedObjId = id;
        this.renderList();
        this.renderProperties();
      }
    }
  }

  // --- CANVAS INTERACTION ---
  getMousePos(e) {
    if (!this.canvas) return { x: 0, y: 0 };
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: Math.floor((e.clientX - rect.left) / this.zoom),
      y: Math.floor((e.clientY - rect.top) / this.zoom)
    };
  }

  handleCanvasMouseDown(e) {
    if (this.currentMode !== 'rooms') return;

    const m = this.getMousePos(e);
    const room = this.project.rooms[this.selectedRoomIdx];
    if (!room) return;

    // Check if clicking on resize handle of selected object
    if (this.selectedObjId && this.project.geometry[this.selectedObjId]) {
      const g = this.project.geometry[this.selectedObjId];
      // Check if clicking on bottom-right resize handle (5x5 pixel area)
      if (m.x >= g.x + g.w - 5 && m.x <= g.x + g.w &&
          m.y >= g.y + g.h - 5 && m.y <= g.y + g.h) {
        this.dragMode = 'RESIZE';
        this.dragStart = m;
        this.initGeo = { ...g };
        return;
      }
    }

    // Check if clicking on any object (reverse order for top-most first)
    for (let i = room.objects.length - 1; i >= 0; i--) {
      const oid = room.objects[i];
      const g = this.project.geometry[oid];
      if (g && m.x >= g.x && m.x <= g.x + g.w && m.y >= g.y && m.y <= g.y + g.h) {
        this.selectedObjId = oid;
        this.dragMode = 'MOVE';
        this.dragStart = m;
        this.initGeo = { ...g };
        this.renderCanvas();
        this.renderProperties();
        this.renderList();
        return;
      }
    }

    // Clicked on empty space - deselect
    this.selectedObjId = null;
    this.renderCanvas();
    this.renderProperties();
    this.renderList();
  }

  handleCanvasMouseMove(e) {
    if (!this.dragMode || !this.selectedObjId) return;

    const m = this.getMousePos(e);
    const g = this.project.geometry[this.selectedObjId];
    if (!g) return;

    const dx = m.x - this.dragStart.x;
    const dy = m.y - this.dragStart.y;

    if (this.dragMode === 'MOVE') {
      g.x = Math.max(0, Math.min(160 - g.w, this.initGeo.x + dx));
      g.y = Math.max(0, Math.min(160 - g.h, this.initGeo.y + dy));
    } else if (this.dragMode === 'RESIZE') {
      g.w = Math.max(4, this.initGeo.w + dx);
      g.h = Math.max(4, this.initGeo.h + dy);
    }

    this.renderCanvas();
    this.renderProperties();
  }

  handleCanvasMouseUp() {
    this.dragMode = null;
  }

  // --- EVENT LISTENERS ---
  initEventListeners() {
    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;

        // Hide all tabs
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));

        // Show selected tab
        document.getElementById(tab + 'Tab').classList.add('active');
        btn.classList.add('active');

        // Re-render editor when switching to it
        if (tab === 'editor') {
          this.renderList();
          this.renderCanvas();
          this.renderProperties();
        }
      });
    });

    // Canvas interaction
    if (this.canvas) {
      this.canvas.addEventListener('mousedown', (e) => this.handleCanvasMouseDown(e));
      window.addEventListener('mousemove', (e) => this.handleCanvasMouseMove(e));
      window.addEventListener('mouseup', () => this.handleCanvasMouseUp());
    }

    // Close modal on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && document.getElementById('codeModal').style.display === 'block') {
        this.closeModal(false);
      }
    });

    // Close modal when clicking outside
    const modal = document.getElementById('codeModal');
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          this.closeModal(false);
        }
      });
    }
  }
}

// Initialize editor app
window.editorApp = new EditorApp();

