import './style.css'
import { MICViewer } from './micViewer.js'

const viewer = new MICViewer();
let currentScale = 2;
const API_URL = 'http://localhost:3001';

// Get DOM elements
const micFileInput = document.getElementById('micFile');
const colFileInput = document.getElementById('colFile');
const paletteFileInput = document.getElementById('paletteFile');
const widthInput = document.getElementById('widthInput');
const scaleInput = document.getElementById('scaleInput');
const scaleValue = document.getElementById('scaleValue');
const canvas = document.getElementById('canvas');
const infoDiv = document.getElementById('info');
const fileBrowserDiv = document.getElementById('fileBrowser');
const fileListDiv = document.getElementById('fileList');
const refreshBtn = document.getElementById('refreshFiles');
const pngFileInput = document.getElementById('pngFile');
const pngWidthInput = document.getElementById('pngWidthInput');
const pngHeightInput = document.getElementById('pngHeightInput');
const previewBtn = document.getElementById('previewBtn');
const convertBtn = document.getElementById('convertBtn');
const conversionStatus = document.getElementById('conversionStatus');
const ditheringCheckbox = document.getElementById('ditheringCheckbox');
const paletteSelect = document.getElementById('paletteSelect');
const previewAlgorithm = document.getElementById('previewAlgorithm');
const showComparisonCheckbox = document.getElementById('showComparison');
const comparisonMode = document.getElementById('comparisonMode');
const originalCanvas = document.getElementById('originalCanvas');
const convertedCanvas = document.getElementById('convertedCanvas');
const previewContainer = document.getElementById('previewContainer');
const previewCanvas = document.getElementById('previewCanvas');
const paletteDisplay = document.getElementById('paletteDisplay');

// Color adjustment controls
const brightnessSlider = document.getElementById('brightnessSlider');
const contrastSlider = document.getElementById('contrastSlider');
const saturationSlider = document.getElementById('saturationSlider');
const brightnessValue = document.getElementById('brightnessValue');
const contrastValue = document.getElementById('contrastValue');
const saturationValue = document.getElementById('saturationValue');
const resetAdjustmentsBtn = document.getElementById('resetAdjustments');

// Brush controls
const brushEnabled = document.getElementById('brushEnabled');
const brushSize = document.getElementById('brushSize');
const brushSizeValue = document.getElementById('brushSizeValue');
const brushPalette = document.getElementById('brushPalette');
const brushCursor = document.getElementById('brushCursor');
const previewZoom = document.getElementById('previewZoom');
const previewZoomValue = document.getElementById('previewZoomValue');
const savePreviewBtn = document.getElementById('savePreviewBtn');

let originalPngImage = null;
let atariPalette = null;
let currentPaletteName = 'laoo';
let previewImageData = null; // Store preview result for conversion
let scanlinePalettes = []; // Store palette for each scanline
let basePreviewImageData = null; // Store base preview before adjustments
let currentBrushColor = null; // Currently selected brush color
let isDrawing = false; // Track if user is drawing
let allPaletteColors = []; // All unique colors from all scanlines

// File upload handlers
micFileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (file) {
    try {
      const width = parseInt(widthInput.value) || 160;
      await viewer.loadMIC(file, width);
      updateInfo();
      tryRender();
    } catch (error) {
      showError(`Error loading MIC file: ${error.message}`);
    }
  }
});

colFileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (file) {
    try {
      await viewer.loadCOL(file);
      updateInfo();
      tryRender();
    } catch (error) {
      showError(`Error loading COL file: ${error.message}`);
    }
  }
});

paletteFileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (file) {
    try {
      await viewer.loadPalette(file);
      updateInfo();
      tryRender();
    } catch (error) {
      showError(`Error loading palette file: ${error.message}`);
    }
  }
});

// Width input handler
widthInput.addEventListener('change', async () => {
  if (viewer.micData) {
    // Reload MIC with new width
    const file = micFileInput.files[0];
    if (file) {
      const width = parseInt(widthInput.value) || 160;
      await viewer.loadMIC(file, width);
      updateInfo();
      tryRender();
    }
  }
});

// Scale input handler
scaleInput.addEventListener('input', () => {
  currentScale = parseInt(scaleInput.value);
  scaleValue.textContent = `${currentScale}x`;
  tryRender();
});

// Try to render if both MIC and COL are loaded
function tryRender() {
  if (viewer.micData && viewer.colData) {
    try {
      viewer.render(canvas, currentScale);
      showSuccess(`Rendered ${viewer.width}x${viewer.height} image at ${currentScale}x scale`);
    } catch (error) {
      showError(`Error rendering: ${error.message}`);
    }
  }
}

// Update info display
function updateInfo() {
  const parts = [];

  if (viewer.micData) {
    parts.push(`✓ MIC: ${viewer.micData.length} bytes (${viewer.width}x${viewer.height})`);
  } else {
    parts.push(`⚠ MIC: Not loaded`);
  }

  if (viewer.colData) {
    parts.push(`✓ COL: ${viewer.colData.length} bytes`);
  } else {
    parts.push(`⚠ COL: Not loaded`);
  }

  if (viewer.palette) {
    parts.push(`✓ Palette: ${viewer.palette.length} colors`);
  }

  infoDiv.innerHTML = parts.join(' | ');
}

// Show error message
function showError(message) {
  infoDiv.innerHTML = `<span style="color: #ff6b6b;">❌ ${message}</span>`;
  console.error(message);
}

// Show success message
function showSuccess(message) {
  infoDiv.innerHTML = `<span style="color: #51cf66;">✓ ${message}</span>`;
  console.log(message);
}

// Load file from URL (for file browser)
async function loadFileFromURL(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load file: ${response.statusText}`);
  }
  const blob = await response.blob();
  return blob;
}

// Load a file pair from the game directory
async function loadFilePair(fileInfo) {
  try {
    showInfo(`Loading ${fileInfo.name}...`);

    // Load MIC file
    const micBlob = await loadFileFromURL(`${API_URL}${fileInfo.micPath}`);
    const width = parseInt(widthInput.value) || 160;
    await viewer.loadMIC(micBlob, width);

    // Load COL file
    const colBlob = await loadFileFromURL(`${API_URL}${fileInfo.colPath}`);
    await viewer.loadCOL(colBlob);

    // Load palette
    const paletteBlob = await loadFileFromURL(`${API_URL}${fileInfo.palettePath}`);
    await viewer.loadPalette(paletteBlob);

    updateInfo();
    tryRender();

    showSuccess(`Loaded ${fileInfo.name} successfully!`);
  } catch (error) {
    showError(`Error loading ${fileInfo.name}: ${error.message}`);
  }
}

// Load available files from API
async function loadAvailableFiles() {
  try {
    fileListDiv.innerHTML = '<div class="loading">Loading files...</div>';

    const response = await fetch(`${API_URL}/api/files`);
    if (!response.ok) {
      throw new Error('API server not running. Start with: npm run server');
    }

    const data = await response.json();

    if (!data.success || data.files.length === 0) {
      fileListDiv.innerHTML = '<div class="no-files">No MIC+COL file pairs found</div>';
      return;
    }

    // Build file list UI
    fileListDiv.innerHTML = '';

    data.files.forEach(fileInfo => {
      const fileItem = document.createElement('div');
      fileItem.className = 'file-item';
      fileItem.innerHTML = `
        <div class="file-name">${fileInfo.name}</div>
        <div class="file-details">
          <span class="file-badge">MIC</span>
          <span class="file-badge">COL</span>
        </div>
      `;

      fileItem.addEventListener('click', () => {
        // Remove active class from all items
        document.querySelectorAll('.file-item').forEach(item => {
          item.classList.remove('active');
        });
        // Add active class to clicked item
        fileItem.classList.add('active');
        // Load the file
        loadFilePair(fileInfo);
      });

      fileListDiv.appendChild(fileItem);
    });

    showInfo(`Found ${data.files.length} file pairs`);
  } catch (error) {
    fileListDiv.innerHTML = `
      <div class="error-message">
        <strong>⚠️ API Server Not Running</strong>
        <p>Start the API server in a new terminal:</p>
        <code>cd mic-viewer && npm run server</code>
        <p>Then click the refresh button.</p>
      </div>
    `;
    console.error('Error loading files:', error);
  }
}

// Refresh button handler
refreshBtn.addEventListener('click', loadAvailableFiles);

// Load available palettes
async function loadAvailablePalettes() {
  try {
    const response = await fetch(`${API_URL}/api/palettes`);
    const data = await response.json();

    if (data.success && data.palettes.length > 0) {
      paletteSelect.innerHTML = '';
      data.palettes.forEach(palette => {
        const option = document.createElement('option');
        option.value = palette.name;
        option.textContent = palette.displayName;
        paletteSelect.appendChild(option);
      });

      // Set default
      paletteSelect.value = 'laoo';
      currentPaletteName = 'laoo';
    }
  } catch (error) {
    console.error('Failed to load palette list:', error);
  }
}

// Load Atari palette
async function loadAtariPalette(paletteName = 'laoo') {
  try {
    const response = await fetch(`${API_URL}/api/palette/${paletteName}`);
    const arrayBuffer = await response.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);

    // Parse ACT palette (256 colors × 3 bytes RGB)
    atariPalette = [];
    for (let i = 0; i < 256; i++) {
      atariPalette.push([data[i * 3], data[i * 3 + 1], data[i * 3 + 2]]);
    }
    console.log(`Atari palette loaded: ${paletteName} (${atariPalette.length} colors)`);
    currentPaletteName = paletteName;
  } catch (error) {
    console.error('Failed to load Atari palette:', error);
    // Use a simple grayscale fallback
    atariPalette = [];
    for (let i = 0; i < 256; i++) {
      atariPalette.push([i, i, i]);
    }
  }
}

// Palette selection handler
paletteSelect.addEventListener('change', async () => {
  const paletteName = paletteSelect.value;
  await loadAtariPalette(paletteName);

  // If we have a preview, regenerate it with new palette
  if (previewContainer.style.display !== 'none' && originalPngImage) {
    previewBtn.click();
  }
});

// PNG file input handler
pngFileInput.addEventListener('change', (e) => {
  const hasFile = e.target.files && e.target.files.length > 0;
  previewBtn.disabled = !hasFile;
  convertBtn.disabled = !hasFile;
  conversionStatus.innerHTML = '';
  previewContainer.style.display = 'none';

  // Load original image for comparison
  if (hasFile) {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        originalPngImage = img;
        showComparisonCheckbox.disabled = false;
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  } else {
    originalPngImage = null;
    showComparisonCheckbox.disabled = true;
    showComparisonCheckbox.checked = false;
  }
});

// Comparison checkbox handler
showComparisonCheckbox.addEventListener('change', (e) => {
  if (e.target.checked && originalPngImage) {
    showComparison();
  } else {
    hideComparison();
  }
});

// Preview button handler
previewBtn.addEventListener('click', async () => {
  if (!originalPngImage || !atariPalette) {
    showError('Image or palette not loaded');
    return;
  }

  try {
    previewBtn.disabled = true;
    previewBtn.textContent = '⏳ Generating preview...';

    const width = parseInt(pngWidthInput.value) || 160;
    const height = pngHeightInput.value ? parseInt(pngHeightInput.value) : null;

    // Calculate target height
    let targetHeight = height;
    if (!targetHeight) {
      const aspectRatio = originalPngImage.height / originalPngImage.width;
      targetHeight = Math.round(width * aspectRatio);
      targetHeight = Math.round(targetHeight / 8) * 8; // Round to multiple of 8
    }

    // Create temporary canvas to resize image
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = targetHeight;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(originalPngImage, 0, 0, width, targetHeight);

    // Get image data
    const imageData = tempCtx.getImageData(0, 0, width, targetHeight);
    const pixels = imageData.data;

    // Reset scanline palettes
    scanlinePalettes = [];

    // Choose quantization algorithm
    const algorithm = previewAlgorithm.value;
    console.log(`Using quantization algorithm: ${algorithm}`);

    if (algorithm === 'global') {
      scanlinePalettes = quantizeGlobalPalette(imageData, width, targetHeight, atariPalette);
    } else if (algorithm === 'median-cut') {
      scanlinePalettes = quantizeMedianCut(imageData, width, targetHeight, atariPalette);
    } else if (algorithm === 'kmeans') {
      scanlinePalettes = quantizeKMeans(imageData, width, targetHeight, atariPalette);
    } else {
      // Default: Per-scanline (original algorithm)
      for (let y = 0; y < targetHeight; y++) {
        const scanlineColors = new Map();

        // Collect unique colors in this scanline
        for (let x = 0; x < width; x++) {
          const idx = (y * width + x) * 4;
          const r = pixels[idx];
          const g = pixels[idx + 1];
          const b = pixels[idx + 2];
          const key = `${r},${g},${b}`;
          scanlineColors.set(key, (scanlineColors.get(key) || 0) + 1);
        }

        // Get top 4 most frequent colors
        const sortedColors = Array.from(scanlineColors.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 4)
          .map(([key]) => key.split(',').map(Number));

        // Map each color to closest Atari color FIRST, then deduplicate
        const atariColorIndices = sortedColors.map(rgb => {
          const atariColor = findClosestAtariColor(rgb);
          return atariColor;
        });

        // Remove duplicates (same as Python's set())
        const uniqueAtariColors = [];
        const seen = new Set();
        for (const color of atariColorIndices) {
          const key = `${color[0]},${color[1]},${color[2]}`;
          if (!seen.has(key)) {
            seen.add(key);
            uniqueAtariColors.push(color);
          }
        }

        // Sort by RGB values to match Python's sorted() behavior
        // This ensures deterministic palette order
        uniqueAtariColors.sort((a, b) => {
          // Compare by Atari palette index (find index in atariPalette)
          const indexA = atariPalette.findIndex(c => c[0] === a[0] && c[1] === a[1] && c[2] === a[2]);
          const indexB = atariPalette.findIndex(c => c[0] === b[0] && c[1] === b[1] && c[2] === b[2]);
          return indexA - indexB;
        });

        // Pad with black if needed (same as Python)
        while (uniqueAtariColors.length < 4) {
          uniqueAtariColors.push([0, 0, 0]);
        }

        const atariColors = uniqueAtariColors;

        // Store palette for this scanline
        scanlinePalettes.push(atariColors);

        // Remap scanline pixels to these 4 colors
        for (let x = 0; x < width; x++) {
          const idx = (y * width + x) * 4;
          const r = pixels[idx];
          const g = pixels[idx + 1];
          const b = pixels[idx + 2];

          // Find closest color in our 4-color palette
          const closest = findClosestInPalette([r, g, b], atariColors);
          pixels[idx] = closest[0];
          pixels[idx + 1] = closest[1];
          pixels[idx + 2] = closest[2];
        }
      }
    }

    // Store preview data for conversion
    previewImageData = {
      canvas: tempCanvas,
      width: width,
      height: targetHeight,
      imageData: imageData
    };

    // Store base preview image data (before adjustments)
    basePreviewImageData = tempCtx.getImageData(0, 0, width, targetHeight);

    // Collect all unique colors actually used in the picture
    allPaletteColors = [];
    const colorSet = new Set();
    // pixels is already declared above, reuse it

    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];
      const key = `${r},${g},${b}`;

      if (!colorSet.has(key)) {
        colorSet.add(key);
        allPaletteColors.push([r, g, b]);
      }
    }

    // Sort colors by brightness for better display
    allPaletteColors.sort((a, b) => {
      const brightnessA = (a[0] + a[1] + a[2]) / 3;
      const brightnessB = (b[0] + b[1] + b[2]) / 3;
      return brightnessA - brightnessB;
    });

    console.log(`Collected ${allPaletteColors.length} unique colors from picture`);

    // Update brush palette display
    updateBrushPalette();

    // Display preview with zoom
    const zoom = parseInt(previewZoom.value) || 2;
    previewCanvas.width = width * zoom;
    previewCanvas.height = targetHeight * zoom;
    const previewCtx = previewCanvas.getContext('2d');
    previewCtx.imageSmoothingEnabled = false;

    tempCtx.putImageData(imageData, 0, 0);
    previewCtx.drawImage(tempCanvas, 0, 0, width * zoom, targetHeight * zoom);

    // Display palette information
    displayPaletteInfo(scanlinePalettes, targetHeight);

    previewContainer.style.display = 'block';
    savePreviewBtn.style.display = 'inline-block';
    conversionStatus.innerHTML = `<div class="success">✓ Preview generated: ${width}×${targetHeight} pixels, 4 colors per scanline. Click "Convert to MIC+COL" to save.</div>`;

  } catch (error) {
    console.error('Preview error:', error);
    showError(`Preview failed: ${error.message}`);
  } finally {
    previewBtn.disabled = false;
    previewBtn.textContent = '🔍 Preview (Fast)';
  }
});

// Helper: Find closest Atari color
function findClosestAtariColor(rgb) {
  let minDist = Infinity;
  let closest = atariPalette[0];

  for (const color of atariPalette) {
    const dist = Math.sqrt(
      Math.pow(rgb[0] - color[0], 2) +
      Math.pow(rgb[1] - color[1], 2) +
      Math.pow(rgb[2] - color[2], 2)
    );
    if (dist < minDist) {
      minDist = dist;
      closest = color;
    }
  }

  return closest;
}

// Helper: Find closest color in a small palette
function findClosestInPalette(rgb, palette) {
  let minDist = Infinity;
  let closest = palette[0];

  for (const color of palette) {
    const dist = Math.sqrt(
      Math.pow(rgb[0] - color[0], 2) +
      Math.pow(rgb[1] - color[1], 2) +
      Math.pow(rgb[2] - color[2], 2)
    );
    if (dist < minDist) {
      minDist = dist;
      closest = color;
    }
  }

  return closest;
}

// Display palette information
function displayPaletteInfo(palettes, height) {
  paletteDisplay.innerHTML = '<h5>Scanline Palettes</h5>';

  // Group consecutive scanlines with same palette
  const groups = [];
  let currentGroup = { start: 0, end: 0, colors: palettes[0] };

  for (let i = 1; i < palettes.length; i++) {
    const same = arraysEqual(palettes[i], currentGroup.colors);
    if (same) {
      currentGroup.end = i;
    } else {
      groups.push(currentGroup);
      currentGroup = { start: i, end: i, colors: palettes[i] };
    }
  }
  groups.push(currentGroup);

  // Display groups (show every 8th scanline or groups)
  const step = height > 128 ? 8 : 4;
  let displayedGroups = 0;

  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];

    // Show if it's a significant group or every Nth group
    if (group.end - group.start > 4 || displayedGroups % step === 0) {
      const scanlineDiv = document.createElement('div');
      scanlineDiv.className = 'palette-scanline';

      const label = document.createElement('div');
      label.className = 'palette-scanline-label';
      if (group.start === group.end) {
        label.textContent = `Line ${group.start}`;
      } else {
        label.textContent = `Lines ${group.start}-${group.end}`;
      }
      scanlineDiv.appendChild(label);

      const colorsDiv = document.createElement('div');
      colorsDiv.className = 'palette-colors';

      group.colors.forEach(color => {
        const colorDiv = document.createElement('div');
        colorDiv.className = 'palette-color';
        colorDiv.style.backgroundColor = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
        colorDiv.setAttribute('data-rgb', `RGB(${color[0]}, ${color[1]}, ${color[2]})`);
        colorsDiv.appendChild(colorDiv);
      });

      scanlineDiv.appendChild(colorsDiv);
      paletteDisplay.appendChild(scanlineDiv);
    }

    displayedGroups++;
  }

  // Add summary
  const summary = document.createElement('div');
  summary.style.marginTop = '10px';
  summary.style.fontSize = '0.8em';
  summary.style.color = 'rgba(255, 255, 255, 0.6)';
  summary.textContent = `${groups.length} unique palette${groups.length !== 1 ? 's' : ''} across ${height} scanlines`;
  paletteDisplay.appendChild(summary);
}

// Helper: Compare two color arrays
function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i][0] !== b[i][0] || a[i][1] !== b[i][1] || a[i][2] !== b[i][2]) {
      return false;
    }
  }
  return true;
}

// Quantization Algorithm: Global Palette
// Finds most common colors across entire image, then applies to all scanlines
function quantizeGlobalPalette(imageData, width, height, atariPalette) {
  const pixels = imageData.data;
  const colorCounts = new Map();

  // Count all colors in entire image
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const key = `${r},${g},${b}`;
    colorCounts.set(key, (colorCounts.get(key) || 0) + 1);
  }

  // Get top colors and map to Atari palette
  const sortedColors = Array.from(colorCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 256) // Get top 256 colors
    .map(([key]) => key.split(',').map(Number));

  // Map to Atari colors and deduplicate
  const atariColorSet = new Set();
  const atariColors = [];

  for (const rgb of sortedColors) {
    const atariColor = findClosestAtariColor(rgb);
    const key = `${atariColor[0]},${atariColor[1]},${atariColor[2]}`;
    if (!atariColorSet.has(key) && atariColors.length < 4) {
      atariColorSet.add(key);
      atariColors.push(atariColor);
    }
    if (atariColors.length >= 4) break;
  }

  // Pad with black if needed
  while (atariColors.length < 4) {
    atariColors.push([0, 0, 0]);
  }

  // Apply same palette to all scanlines
  const scanlinePalettes = [];
  for (let y = 0; y < height; y++) {
    scanlinePalettes.push([...atariColors]);

    // Remap pixels
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = pixels[idx];
      const g = pixels[idx + 1];
      const b = pixels[idx + 2];

      const closest = findClosestInPalette([r, g, b], atariColors);
      pixels[idx] = closest[0];
      pixels[idx + 1] = closest[1];
      pixels[idx + 2] = closest[2];
    }
  }

  return scanlinePalettes;
}

// Quantization Algorithm: Median Cut
// Divides color space into boxes and finds representative colors
function quantizeMedianCut(imageData, width, height, atariPalette) {
  const pixels = imageData.data;
  const colors = [];

  // Collect all unique colors
  const colorSet = new Set();
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const key = `${r},${g},${b}`;
    if (!colorSet.has(key)) {
      colorSet.add(key);
      colors.push([r, g, b]);
    }
  }

  // Median cut algorithm
  function medianCut(colors, depth) {
    if (depth === 0 || colors.length === 0) {
      // Return average color
      if (colors.length === 0) return [0, 0, 0];
      const avg = colors.reduce((acc, c) => [acc[0] + c[0], acc[1] + c[1], acc[2] + c[2]], [0, 0, 0]);
      return [Math.round(avg[0] / colors.length), Math.round(avg[1] / colors.length), Math.round(avg[2] / colors.length)];
    }

    // Find channel with greatest range
    const ranges = [0, 1, 2].map(channel => {
      const values = colors.map(c => c[channel]);
      return Math.max(...values) - Math.min(...values);
    });
    const channel = ranges.indexOf(Math.max(...ranges));

    // Sort by that channel
    colors.sort((a, b) => a[channel] - b[channel]);

    // Split in half
    const mid = Math.floor(colors.length / 2);
    return [
      medianCut(colors.slice(0, mid), depth - 1),
      medianCut(colors.slice(mid), depth - 1)
    ].flat();
  }

  const paletteColors = medianCut(colors, 2); // 2^2 = 4 colors

  // Map to Atari palette
  const atariColors = paletteColors.map(rgb => findClosestAtariColor(rgb));

  // Deduplicate
  const uniqueAtariColors = [];
  const seen = new Set();
  for (const color of atariColors) {
    const key = `${color[0]},${color[1]},${color[2]}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueAtariColors.push(color);
    }
  }

  while (uniqueAtariColors.length < 4) {
    uniqueAtariColors.push([0, 0, 0]);
  }

  // Apply to all scanlines
  const scanlinePalettes = [];
  for (let y = 0; y < height; y++) {
    scanlinePalettes.push([...uniqueAtariColors]);

    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = pixels[idx];
      const g = pixels[idx + 1];
      const b = pixels[idx + 2];

      const closest = findClosestInPalette([r, g, b], uniqueAtariColors);
      pixels[idx] = closest[0];
      pixels[idx + 1] = closest[1];
      pixels[idx + 2] = closest[2];
    }
  }

  return scanlinePalettes;
}

// Quantization Algorithm: K-Means Clustering
// Groups similar colors together using k-means
function quantizeKMeans(imageData, width, height, atariPalette) {
  const pixels = imageData.data;
  const colors = [];

  // Collect all colors with their frequencies
  const colorCounts = new Map();
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const key = `${r},${g},${b}`;
    colorCounts.set(key, (colorCounts.get(key) || 0) + 1);
  }

  // Convert to array
  const uniqueColors = Array.from(colorCounts.entries()).map(([key, count]) => {
    const [r, g, b] = key.split(',').map(Number);
    return { color: [r, g, b], count };
  });

  // K-means clustering (k=4)
  const k = 4;
  let centroids = [];

  // Initialize centroids with most frequent colors
  const sorted = [...uniqueColors].sort((a, b) => b.count - a.count);
  for (let i = 0; i < k && i < sorted.length; i++) {
    centroids.push([...sorted[i].color]);
  }
  while (centroids.length < k) {
    centroids.push([0, 0, 0]);
  }

  // Iterate k-means
  for (let iter = 0; iter < 10; iter++) {
    // Assign colors to nearest centroid
    const clusters = Array.from({ length: k }, () => []);

    for (const { color, count } of uniqueColors) {
      let minDist = Infinity;
      let bestCluster = 0;

      for (let i = 0; i < k; i++) {
        const dist = colorDistance(color, centroids[i]);
        if (dist < minDist) {
          minDist = dist;
          bestCluster = i;
        }
      }

      for (let i = 0; i < count; i++) {
        clusters[bestCluster].push(color);
      }
    }

    // Update centroids
    for (let i = 0; i < k; i++) {
      if (clusters[i].length > 0) {
        const sum = clusters[i].reduce((acc, c) => [acc[0] + c[0], acc[1] + c[1], acc[2] + c[2]], [0, 0, 0]);
        centroids[i] = [
          Math.round(sum[0] / clusters[i].length),
          Math.round(sum[1] / clusters[i].length),
          Math.round(sum[2] / clusters[i].length)
        ];
      }
    }
  }

  // Map centroids to Atari palette
  const atariColors = centroids.map(rgb => findClosestAtariColor(rgb));

  // Deduplicate
  const uniqueAtariColors = [];
  const seen = new Set();
  for (const color of atariColors) {
    const key = `${color[0]},${color[1]},${color[2]}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueAtariColors.push(color);
    }
  }

  while (uniqueAtariColors.length < 4) {
    uniqueAtariColors.push([0, 0, 0]);
  }

  // Apply to all scanlines
  const scanlinePalettes = [];
  for (let y = 0; y < height; y++) {
    scanlinePalettes.push([...uniqueAtariColors]);

    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = pixels[idx];
      const g = pixels[idx + 1];
      const b = pixels[idx + 2];

      const closest = findClosestInPalette([r, g, b], uniqueAtariColors);
      pixels[idx] = closest[0];
      pixels[idx + 1] = closest[1];
      pixels[idx + 2] = closest[2];
    }
  }

  return scanlinePalettes;
}

// Convert RGB to HSL
function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return [h, s, l];
}

// Convert HSL to RGB
function hslToRgb(h, s, l) {
  let r, g, b;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;

    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }

  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

// Apply color adjustments to image data
function applyColorAdjustments(imageData, brightness, contrast, saturation) {
  const pixels = imageData.data;

  for (let i = 0; i < pixels.length; i += 4) {
    let r = pixels[i];
    let g = pixels[i + 1];
    let b = pixels[i + 2];

    // Apply brightness
    if (brightness !== 0) {
      r += brightness;
      g += brightness;
      b += brightness;
    }

    // Apply contrast
    if (contrast !== 0) {
      const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
      r = factor * (r - 128) + 128;
      g = factor * (g - 128) + 128;
      b = factor * (b - 128) + 128;
    }

    // Apply saturation
    if (saturation !== 0) {
      const [h, s, l] = rgbToHsl(r, g, b);
      const newS = Math.max(0, Math.min(1, s + saturation / 100));
      [r, g, b] = hslToRgb(h, newS, l);
    }

    // Clamp values
    pixels[i] = Math.max(0, Math.min(255, r));
    pixels[i + 1] = Math.max(0, Math.min(255, g));
    pixels[i + 2] = Math.max(0, Math.min(255, b));
  }

  return imageData;
}

// Convert PNG button handler
convertBtn.addEventListener('click', async () => {
  const file = pngFileInput.files[0];
  if (!file) {
    showError('Please select a PNG file');
    return;
  }

  try {
    convertBtn.disabled = true;
    const startTime = Date.now();
    conversionStatus.innerHTML = '<div class="loading"><span class="spinner"></span> Converting to MIC+COL... This may take a few seconds.</div>';

    console.log('Starting PNG conversion for:', file.name);

    // If we have preview data, convert that canvas to PNG
    let fileToConvert = file;
    if (previewImageData) {
      console.log('Using preview image for conversion');
      // Convert preview canvas to blob with maximum quality (lossless PNG)
      const blob = await new Promise(resolve => {
        previewImageData.canvas.toBlob(resolve, 'image/png', 1.0);
      });
      fileToConvert = new File([blob], 'preview.png', { type: 'image/png' });
      console.log('Preview image size:', previewImageData.width, 'x', previewImageData.height);
    }

    // Prepare form data
    const formData = new FormData();
    formData.append('png', fileToConvert);
    formData.append('width', pngWidthInput.value || '160');
    if (pngHeightInput.value) {
      formData.append('height', pngHeightInput.value);
    }
    // IMPORTANT: Don't apply dithering when converting from preview
    // because preview has already done color reduction
    if (ditheringCheckbox.checked && !previewImageData) {
      formData.append('dithering', 'true');
    }
    formData.append('palette', currentPaletteName);

    console.log('Sending to API...');

    // Send to API
    const response = await fetch(`${API_URL}/api/convert-png`, {
      method: 'POST',
      body: formData
    });

    console.log('Response status:', response.status);

    if (!response.ok) {
      const error = await response.json();
      console.error('API error:', error);
      throw new Error(error.error || 'Conversion failed');
    }

    const result = await response.json();
    console.log('Conversion result:', result);

    if (!result.success) {
      throw new Error(result.error || 'Conversion failed');
    }

    conversionStatus.innerHTML = '<div class="success">✓ Converted successfully! Loading...</div>';

    console.log('Converting base64 to blobs...');

    // Convert base64 to Blob
    const micBlob = base64ToBlob(result.files.mic, 'application/octet-stream');
    const colBlob = base64ToBlob(result.files.col, 'application/octet-stream');
    const paletteBlob = base64ToBlob(result.files.palette, 'application/octet-stream');

    console.log('Loading into viewer...');

    // Load into viewer
    const width = parseInt(pngWidthInput.value) || 160;
    await viewer.loadMIC(micBlob, width);
    await viewer.loadCOL(colBlob);
    await viewer.loadPalette(paletteBlob);

    console.log('Rendering...');

    updateInfo();

    // Show comparison if checkbox is checked
    if (showComparisonCheckbox.checked && originalPngImage) {
      showComparison();
    } else {
      tryRender();
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    conversionStatus.innerHTML = `<div class="success">✓ Converted and displayed in ${elapsed}s: ${result.info.originalName} (${result.info.micSize} bytes MIC, ${result.info.colSize} bytes COL)</div>`;
    showSuccess(`PNG converted successfully in ${elapsed}s!`);

    console.log(`Conversion complete in ${elapsed}s`);

  } catch (error) {
    console.error('Conversion error:', error);
    conversionStatus.innerHTML = `<div class="error-message"><strong>Conversion failed:</strong> ${error.message}</div>`;
    showError(`PNG conversion error: ${error.message}`);
  } finally {
    convertBtn.disabled = false;
  }
});

// Save preview as MIC+COL button handler
savePreviewBtn.addEventListener('click', async () => {
  if (!previewImageData || !scanlinePalettes) {
    showError('No preview to save. Generate a preview first.');
    return;
  }

  try {
    savePreviewBtn.disabled = true;
    savePreviewBtn.textContent = '⏳ Saving...';

    // Prompt for filename
    const defaultName = 'preview_' + Date.now();
    const filename = prompt('Enter filename (without extension):', defaultName);

    if (!filename) {
      savePreviewBtn.disabled = false;
      savePreviewBtn.textContent = '💾 Save Preview as MIC+COL';
      return;
    }

    console.log('Saving preview as:', filename);

    // Convert preview canvas to PNG blob
    const blob = await new Promise(resolve => {
      previewImageData.canvas.toBlob(resolve, 'image/png', 1.0);
    });
    const file = new File([blob], filename + '.png', { type: 'image/png' });

    // Prepare form data
    const formData = new FormData();
    formData.append('png', file);
    formData.append('width', previewImageData.width.toString());
    formData.append('height', previewImageData.height.toString());
    formData.append('palette', currentPaletteName);
    formData.append('filename', filename);
    formData.append('save_to_disk', 'true'); // Tell server to save files

    // Send to server
    const response = await fetch('http://localhost:3001/api/convert', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Server error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('Save result:', result);

    showSuccess(`Saved ${filename}.MIC and ${filename}.COL to ${result.savedPath || 'disk'}!`);
    conversionStatus.innerHTML = `<div class="success">✓ Saved as ${filename}.MIC and ${filename}.COL</div>`;

    // Refresh file list
    loadAvailableFiles();

  } catch (error) {
    console.error('Save error:', error);
    showError(`Save failed: ${error.message}`);
  } finally {
    savePreviewBtn.disabled = false;
    savePreviewBtn.textContent = '💾 Save Preview as MIC+COL';
  }
});

// Helper: Convert base64 to Blob
function base64ToBlob(base64, mimeType) {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}

// Show comparison view
function showComparison() {
  if (!originalPngImage) return;

  // Hide main canvas
  canvas.style.display = 'none';
  comparisonMode.style.display = 'flex';

  // Draw original PNG
  const scale = parseInt(scaleInput.value) || 2;
  originalCanvas.width = originalPngImage.width * scale;
  originalCanvas.height = originalPngImage.height * scale;
  const origCtx = originalCanvas.getContext('2d');
  origCtx.imageSmoothingEnabled = false;
  origCtx.drawImage(originalPngImage, 0, 0, originalCanvas.width, originalCanvas.height);

  // Draw converted MIC
  viewer.render(convertedCanvas, scale);
}

// Hide comparison view
function hideComparison() {
  canvas.style.display = 'block';
  comparisonMode.style.display = 'none';
  tryRender();
}

// Show info message
function showInfo(message) {
  infoDiv.innerHTML = `<span style="color: rgba(255, 255, 255, 0.9);">${message}</span>`;
}

// Update brush palette display
function updateBrushPalette() {
  brushPalette.innerHTML = '';

  if (allPaletteColors.length === 0) {
    brushPalette.innerHTML = '<em style="color: rgba(255,255,255,0.5);">Generate preview first to see palette colors</em>';
    return;
  }

  allPaletteColors.forEach((color, index) => {
    const colorDiv = document.createElement('div');
    colorDiv.className = 'brush-color';
    colorDiv.style.backgroundColor = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
    colorDiv.setAttribute('data-rgb', `RGB(${color[0]}, ${color[1]}, ${color[2]})`);
    colorDiv.addEventListener('click', () => {
      currentBrushColor = color;
      document.querySelectorAll('.brush-color').forEach(el => el.classList.remove('selected'));
      colorDiv.classList.add('selected');
    });

    if (index === 0 && !currentBrushColor) {
      colorDiv.classList.add('selected');
      currentBrushColor = color;
    }

    brushPalette.appendChild(colorDiv);
  });
}

// Apply adjustments to preview
function applyAdjustmentsToPreview() {
  if (!basePreviewImageData) return;

  const brightness = parseInt(brightnessSlider.value);
  const contrast = parseInt(contrastSlider.value);
  const saturation = parseInt(saturationSlider.value);

  // Create a copy of base image data
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = basePreviewImageData.width;
  tempCanvas.height = basePreviewImageData.height;
  const tempCtx = tempCanvas.getContext('2d');
  tempCtx.putImageData(basePreviewImageData, 0, 0);

  // Get image data and apply adjustments
  const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
  applyColorAdjustments(imageData, brightness, contrast, saturation);
  tempCtx.putImageData(imageData, 0, 0);

  // Redraw to preview canvas with zoom
  const zoom = parseInt(previewZoom.value) || 2;
  previewCanvas.width = tempCanvas.width * zoom;
  previewCanvas.height = tempCanvas.height * zoom;
  const previewCtx = previewCanvas.getContext('2d');
  previewCtx.imageSmoothingEnabled = false;
  previewCtx.drawImage(tempCanvas, 0, 0, previewCanvas.width, previewCanvas.height);

  // Update preview image data for conversion
  previewImageData = {
    canvas: tempCanvas,
    width: tempCanvas.width,
    height: tempCanvas.height
  };
}

// Color adjustment event handlers
brightnessSlider.addEventListener('input', () => {
  brightnessValue.textContent = brightnessSlider.value;
  applyAdjustmentsToPreview();
});

contrastSlider.addEventListener('input', () => {
  contrastValue.textContent = contrastSlider.value;
  applyAdjustmentsToPreview();
});

saturationSlider.addEventListener('input', () => {
  saturationValue.textContent = saturationSlider.value;
  applyAdjustmentsToPreview();
});

resetAdjustmentsBtn.addEventListener('click', () => {
  brightnessSlider.value = 0;
  contrastSlider.value = 0;
  saturationSlider.value = 0;
  brightnessValue.textContent = '0';
  contrastValue.textContent = '0';
  saturationValue.textContent = '0';
  applyAdjustmentsToPreview();
});

// Brush size handler
brushSize.addEventListener('input', () => {
  brushSizeValue.textContent = brushSize.value + 'px';
  updateBrushCursorSize();
});

// Zoom handler
previewZoom.addEventListener('input', () => {
  previewZoomValue.textContent = previewZoom.value + 'x';
  applyAdjustmentsToPreview();
  updateBrushCursorSize();
});

// Brush enabled handler
brushEnabled.addEventListener('change', () => {
  if (brushEnabled.checked) {
    previewCanvas.classList.add('brush-active');
    brushCursor.classList.add('active');
  } else {
    previewCanvas.classList.remove('brush-active');
    brushCursor.classList.remove('active');
  }
});

// Update brush cursor size
function updateBrushCursorSize() {
  const size = parseInt(brushSize.value);
  const zoom = parseInt(previewZoom.value) || 2;
  // Cursor size = brush size in actual pixels × zoom
  const cursorSize = size * 2 * zoom; // diameter in screen pixels
  brushCursor.style.width = cursorSize + 'px';
  brushCursor.style.height = cursorSize + 'px';
}

// Canvas drawing handlers
previewCanvas.addEventListener('mousedown', (e) => {
  if (!brushEnabled.checked || !currentBrushColor) return;
  isDrawing = true;
  drawOnCanvas(e);
});

previewCanvas.addEventListener('mousemove', (e) => {
  // Update brush cursor position
  if (brushEnabled.checked) {
    const rect = previewCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const size = parseInt(brushSize.value);
    const zoom = parseInt(previewZoom.value) || 2;
    // Cursor size in screen pixels = brush size × 2 (diameter) × zoom
    const cursorSize = size * 2 * zoom;

    brushCursor.style.left = (x - cursorSize / 2) + 'px';
    brushCursor.style.top = (y - cursorSize / 2) + 'px';
  }

  if (!isDrawing) return;
  drawOnCanvas(e);
});

previewCanvas.addEventListener('mouseup', () => {
  isDrawing = false;
});

previewCanvas.addEventListener('mouseleave', () => {
  isDrawing = false;
  brushCursor.style.display = 'none';
});

previewCanvas.addEventListener('mouseenter', () => {
  if (brushEnabled.checked) {
    brushCursor.style.display = 'block';
  }
});

// Draw on canvas with brush
function drawOnCanvas(e) {
  if (!currentBrushColor || !basePreviewImageData) return;

  const rect = previewCanvas.getBoundingClientRect();
  const zoom = parseInt(previewZoom.value) || 2;
  const x = Math.floor((e.clientX - rect.left) / zoom);
  const y = Math.floor((e.clientY - rect.top) / zoom);
  const size = parseInt(brushSize.value);

  // Get current preview image data
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = basePreviewImageData.width;
  tempCanvas.height = basePreviewImageData.height;
  const tempCtx = tempCanvas.getContext('2d');
  tempCtx.putImageData(previewImageData.canvas.getContext('2d').getImageData(0, 0, previewImageData.width, previewImageData.height), 0, 0);

  const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
  const pixels = imageData.data;

  // Draw circle with brush color
  for (let dy = -size; dy <= size; dy++) {
    for (let dx = -size; dx <= size; dx++) {
      if (dx * dx + dy * dy <= size * size) {
        const px = x + dx;
        const py = y + dy;

        if (px >= 0 && px < tempCanvas.width && py >= 0 && py < tempCanvas.height) {
          const idx = (py * tempCanvas.width + px) * 4;
          pixels[idx] = currentBrushColor[0];
          pixels[idx + 1] = currentBrushColor[1];
          pixels[idx + 2] = currentBrushColor[2];
          pixels[idx + 3] = 255;
        }
      }
    }
  }

  tempCtx.putImageData(imageData, 0, 0);

  // Redraw to preview canvas with zoom
  const previewCtx = previewCanvas.getContext('2d');
  previewCtx.imageSmoothingEnabled = false;
  previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
  previewCtx.drawImage(tempCanvas, 0, 0, previewCanvas.width, previewCanvas.height);

  // Update preview image data
  previewImageData = {
    canvas: tempCanvas,
    width: tempCanvas.width,
    height: tempCanvas.height
  };

  // Update base preview to include the drawn pixels
  basePreviewImageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
}

// Initialize
updateInfo();
loadAvailablePalettes().then(() => loadAtariPalette());
loadAvailableFiles();
console.log('Atari MIC+COL Viewer initialized');
