/* ===== Shape definitions ===================================================
   All coords normalized 0–1 (top-left origin, same as canvas).
   Each shape is an array of "strokes"; each stroke is an array of {x, y}.
   ========================================================================== */

function circlePoints(cx, cy, r, n = 48) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * 2 * Math.PI;
    pts.push({ x: cx + r * Math.cos(t), y: cy + r * Math.sin(t) });
  }
  return pts;
}

const SHAPES = {
  // Diagnostic: border + cross + corner labels so you can see axis orientation
  testgrid: {
    label: '🔧 Axis Test',
    color: '#999',
    strokes() {
      // Outer border (nearly full area)
      const border = [
        {x:0.05,y:0.05},{x:0.95,y:0.05},{x:0.95,y:0.95},{x:0.05,y:0.95},{x:0.05,y:0.05}
      ];
      // Cross through centre
      const hLine = [{x:0.05,y:0.5},{x:0.95,y:0.5}];
      const vLine = [{x:0.5,y:0.05},{x:0.5,y:0.95}];
      // Small mark at top-left corner (origin on canvas = should be plotter origin)
      const tlMark = [{x:0.05,y:0.05},{x:0.12,y:0.12}];
      return [border, hLine, vLine, tlMark];
    }
  },

  star: {
    label: '⭐ Star',
    color: '#FFD93D',
    strokes() {
      const cx = 0.5, cy = 0.5, OR = 0.43, IR = 0.17, n = 5;
      const pts = [];
      for (let i = 0; i <= n * 2; i++) {
        const a = (i * Math.PI / n) - Math.PI / 2;
        const r = i % 2 === 0 ? OR : IR;
        pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
      }
      return [pts];
    }
  },

  heart: {
    label: '❤️ Heart',
    color: '#FF4D6D',
    strokes() {
      const pts = [];
      for (let i = 0; i <= 72; i++) {
        const t = (i / 72) * 2 * Math.PI;
        const x = 16 * Math.pow(Math.sin(t), 3);
        const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
        pts.push({ x: x / 36 + 0.5, y: -y / 36 + 0.5 });
      }
      return [pts];
    }
  },

  spiral: {
    label: '🌀 Spiral',
    color: '#4D96FF',
    strokes() {
      const pts = [];
      for (let i = 0; i <= 180; i++) {
        const t = (i / 180) * 3 * 2 * Math.PI;
        const r = 0.04 + 0.43 * (i / 180);
        pts.push({ x: 0.5 + r * Math.cos(t - Math.PI / 2), y: 0.5 + r * Math.sin(t - Math.PI / 2) });
      }
      return [pts];
    }
  },

  house: {
    label: '🏠 House',
    color: '#FF6B35',
    strokes() {
      const walls = [
        { x: 0.15, y: 0.92 }, { x: 0.15, y: 0.50 },
        { x: 0.85, y: 0.50 }, { x: 0.85, y: 0.92 },
        { x: 0.15, y: 0.92 }
      ];
      const roof = [
        { x: 0.08, y: 0.52 }, { x: 0.50, y: 0.10 }, { x: 0.92, y: 0.52 }
      ];
      const door = [
        { x: 0.38, y: 0.92 }, { x: 0.38, y: 0.65 },
        { x: 0.62, y: 0.65 }, { x: 0.62, y: 0.92 }
      ];
      const winL = [
        { x: 0.20, y: 0.58 }, { x: 0.35, y: 0.58 },
        { x: 0.35, y: 0.72 }, { x: 0.20, y: 0.72 }, { x: 0.20, y: 0.58 }
      ];
      const winR = [
        { x: 0.65, y: 0.58 }, { x: 0.80, y: 0.58 },
        { x: 0.80, y: 0.72 }, { x: 0.65, y: 0.72 }, { x: 0.65, y: 0.58 }
      ];
      return [walls, roof, door, winL, winR];
    }
  },

  smiley: {
    label: '😊 Smiley',
    color: '#FFD93D',
    strokes() {
      const face = circlePoints(0.5, 0.5, 0.42);
      const eyeL = circlePoints(0.34, 0.38, 0.07, 20);
      const eyeR = circlePoints(0.66, 0.38, 0.07, 20);
      const smile = [];
      for (let i = 0; i <= 30; i++) {
        const t = Math.PI * 0.15 + (i / 30) * Math.PI * 0.70;
        smile.push({ x: 0.5 + 0.28 * Math.cos(t), y: 0.55 + 0.22 * Math.sin(t) });
      }
      return [face, eyeL, eyeR, smile];
    }
  },

  sun: {
    label: '☀️ Sun',
    color: '#FFD93D',
    strokes() {
      const face = circlePoints(0.5, 0.5, 0.22, 36);
      const rays = [];
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * 2 * Math.PI - Math.PI / 2;
        rays.push([
          { x: 0.5 + 0.29 * Math.cos(a), y: 0.5 + 0.29 * Math.sin(a) },
          { x: 0.5 + 0.44 * Math.cos(a), y: 0.5 + 0.44 * Math.sin(a) }
        ]);
      }
      return [face, ...rays];
    }
  },

  cat: {
    label: '🐱 Cat',
    color: '#C77DFF',
    strokes() {
      const face = circlePoints(0.5, 0.56, 0.37, 48);
      const earL = [{ x: 0.20, y: 0.40 }, { x: 0.30, y: 0.18 }, { x: 0.44, y: 0.38 }];
      const earR = [{ x: 0.56, y: 0.38 }, { x: 0.70, y: 0.18 }, { x: 0.80, y: 0.40 }];
      const eyeL = circlePoints(0.36, 0.50, 0.055, 16);
      const eyeR = circlePoints(0.64, 0.50, 0.055, 16);
      const nose = [
        { x: 0.50, y: 0.60 }, { x: 0.43, y: 0.68 }, { x: 0.57, y: 0.68 }, { x: 0.50, y: 0.60 }
      ];
      const wL1 = [{ x: 0.08, y: 0.64 }, { x: 0.40, y: 0.65 }];
      const wL2 = [{ x: 0.08, y: 0.70 }, { x: 0.40, y: 0.70 }];
      const wR1 = [{ x: 0.60, y: 0.65 }, { x: 0.92, y: 0.64 }];
      const wR2 = [{ x: 0.60, y: 0.70 }, { x: 0.92, y: 0.70 }];
      return [face, earL, earR, eyeL, eyeR, nose, wL1, wL2, wR1, wR2];
    }
  },

  fish: {
    label: '🐟 Fish',
    color: '#4D96FF',
    strokes() {
      const body = [];
      for (let i = 0; i <= 60; i++) {
        const t = (i / 60) * 2 * Math.PI;
        body.push({ x: 0.56 + 0.32 * Math.cos(t), y: 0.50 + 0.22 * Math.sin(t) });
      }
      const tail = [
        { x: 0.24, y: 0.50 }, { x: 0.08, y: 0.28 }, { x: 0.08, y: 0.72 }, { x: 0.24, y: 0.50 }
      ];
      const eye = circlePoints(0.70, 0.43, 0.04, 14);
      const fin = [{ x: 0.44, y: 0.28 }, { x: 0.56, y: 0.18 }, { x: 0.70, y: 0.28 }];
      return [body, tail, eye, fin];
    }
  },

  rocket: {
    label: '🚀 Rocket',
    color: '#FF6B35',
    strokes() {
      // Body
      const body = [
        { x: 0.50, y: 0.08 }, { x: 0.68, y: 0.40 },
        { x: 0.68, y: 0.72 }, { x: 0.32, y: 0.72 },
        { x: 0.32, y: 0.40 }, { x: 0.50, y: 0.08 }
      ];
      // Left fin
      const finL = [
        { x: 0.32, y: 0.72 }, { x: 0.16, y: 0.88 }, { x: 0.32, y: 0.82 }
      ];
      // Right fin
      const finR = [
        { x: 0.68, y: 0.72 }, { x: 0.84, y: 0.88 }, { x: 0.68, y: 0.82 }
      ];
      // Window
      const window = circlePoints(0.50, 0.44, 0.10, 20);
      // Flame
      const flame = [
        { x: 0.38, y: 0.74 }, { x: 0.50, y: 0.92 }, { x: 0.62, y: 0.74 }
      ];
      return [body, finL, finR, window, flame];
    }
  },

  flower: {
    label: '🌸 Flower',
    color: '#FF4D6D',
    strokes() {
      const petals = [];
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * 2 * Math.PI;
        const petal = [];
        for (let j = 0; j <= 20; j++) {
          const t = (j / 20) * 2 * Math.PI;
          const r = 0.14 * (1 + 0.5 * Math.cos(t));
          petal.push({
            x: 0.5 + (0.22 + r) * Math.cos(a) - r * 0.5 * Math.sin(a) * Math.sin(t),
            y: 0.5 + (0.22 + r) * Math.sin(a) + r * 0.5 * Math.cos(a) * Math.sin(t),
          });
        }
        petals.push(petal);
      }
      const center = circlePoints(0.5, 0.5, 0.12, 24);
      return [...petals, center];
    }
  },
};

/* ===== Drawing state ====================================================== */

const canvas = document.getElementById('drawing-canvas');
const ctx = canvas.getContext('2d');

let strokes = [];       // completed strokes
let current = null;     // stroke in progress
let brushSize = 4;
let isDrawing = false;
let activeShapeKey = null;  // which preset is loaded, if any

function resizeCanvas() {
  const wrapper = canvas.parentElement;
  const size = Math.min(wrapper.clientWidth - 16, wrapper.clientHeight - 16);
  canvas.width = size;
  canvas.height = size;
  redraw();
}

function redraw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (const stroke of strokes) {
    drawStroke(ctx, stroke, canvas.width, canvas.height);
  }
  if (current && current.pts.length > 1) {
    drawStroke(ctx, current, canvas.width, canvas.height);
  }
}

function drawStroke(targetCtx, stroke, W, H) {
  if (stroke.pts.length < 2) return;
  targetCtx.beginPath();
  targetCtx.strokeStyle = '#222';
  targetCtx.lineWidth = stroke.size * (W / 400);  // scale brush to canvas size
  const first = stroke.pts[0];
  targetCtx.moveTo(first.x * W, first.y * H);
  for (let i = 1; i < stroke.pts.length; i++) {
    targetCtx.lineTo(stroke.pts[i].x * W, stroke.pts[i].y * H);
  }
  targetCtx.stroke();
}

/* ===== Canvas events ====================================================== */

function getPos(e) {
  const rect = canvas.getBoundingClientRect();
  const src = e.touches ? e.touches[0] : e;
  return {
    x: (src.clientX - rect.left) / canvas.width,
    y: (src.clientY - rect.top)  / canvas.height,
  };
}

canvas.addEventListener('mousedown',  e => startDraw(getPos(e)));
canvas.addEventListener('mousemove',  e => { if (isDrawing) continueDraw(getPos(e)); });
canvas.addEventListener('mouseup',    () => endDraw());
canvas.addEventListener('mouseleave', () => endDraw());

canvas.addEventListener('touchstart', e => { e.preventDefault(); startDraw(getPos(e)); }, { passive: false });
canvas.addEventListener('touchmove',  e => { e.preventDefault(); if (isDrawing) continueDraw(getPos(e)); }, { passive: false });
canvas.addEventListener('touchend',   e => { e.preventDefault(); endDraw(); }, { passive: false });

function startDraw(pos) {
  activeShapeKey = null;
  clearShapeSelection();
  isDrawing = true;
  current = { pts: [pos], size: brushSize };
}

function continueDraw(pos) {
  if (!current) return;
  current.pts.push(pos);
  // Incremental draw
  if (current.pts.length >= 2) {
    const pts = current.pts;
    const W = canvas.width, H = canvas.height;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#222';
    ctx.lineWidth = brushSize * (W / 400);
    ctx.beginPath();
    ctx.moveTo(pts[pts.length - 2].x * W, pts[pts.length - 2].y * H);
    ctx.lineTo(pts[pts.length - 1].x * W, pts[pts.length - 1].y * H);
    ctx.stroke();
  }
}

function endDraw() {
  if (!isDrawing || !current) return;
  isDrawing = false;
  if (current.pts.length >= 2) {
    strokes.push(current);
  }
  current = null;
}

/* ===== Tool actions ======================================================== */

function setBrush(size) {
  brushSize = size;
  document.querySelectorAll('.brush-btn').forEach(b => {
    b.classList.toggle('active', Number(b.dataset.size) === size);
  });
}

function undoStroke() {
  if (strokes.length === 0) return;
  strokes.pop();
  activeShapeKey = null;
  clearShapeSelection();
  redraw();
}

function clearCanvas() {
  strokes = [];
  current = null;
  activeShapeKey = null;
  clearShapeSelection();
  redraw();
}

/* ===== Tabs ================================================================ */

function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.getElementById(`tab-${tab}`).classList.add('active');
  document.getElementById(`panel-${tab}`).classList.add('active');

  if (tab === 'draw') {
    setTimeout(resizeCanvas, 10);
  }
}

/* ===== Shape gallery ======================================================= */

function buildShapeGallery() {
  const grid = document.getElementById('shapes-grid');
  for (const [key, shape] of Object.entries(SHAPES)) {
    const card = document.createElement('div');
    card.className = 'shape-card';
    card.id = `shape-card-${key}`;
    card.onclick = () => loadShape(key);

    const preview = document.createElement('canvas');
    preview.width = 100;
    preview.height = 100;
    renderShapePreview(preview, shape);

    const label = document.createElement('div');
    label.className = 'shape-name';
    label.textContent = shape.label;

    card.appendChild(preview);
    card.appendChild(label);
    grid.appendChild(card);
  }
}

function renderShapePreview(previewCanvas, shape) {
  const pCtx = previewCanvas.getContext('2d');
  const W = previewCanvas.width, H = previewCanvas.height;
  pCtx.clearRect(0, 0, W, H);
  pCtx.lineCap = 'round';
  pCtx.lineJoin = 'round';
  pCtx.strokeStyle = shape.color || '#222';
  pCtx.lineWidth = 2.5;

  for (const stroke of shape.strokes()) {
    if (stroke.length < 2) continue;
    pCtx.beginPath();
    pCtx.moveTo(stroke[0].x * W, stroke[0].y * H);
    for (let i = 1; i < stroke.length; i++) {
      pCtx.lineTo(stroke[i].x * W, stroke[i].y * H);
    }
    pCtx.stroke();
  }
}

function loadShape(key) {
  const shape = SHAPES[key];
  if (!shape) return;

  // Convert shape strokes (0-1 normalized, no size) to our stroke format
  strokes = shape.strokes().map(pts => ({ pts, size: 3 }));
  activeShapeKey = key;

  // Highlight the selected card
  clearShapeSelection();
  document.getElementById(`shape-card-${key}`)?.classList.add('selected');

  // Switch to draw tab so they can see the preview
  switchTab('draw');
  setTimeout(redraw, 50);
}

function clearShapeSelection() {
  document.querySelectorAll('.shape-card').forEach(c => c.classList.remove('selected'));
}

/* ===== Plotting ============================================================ */

let currentJobId = null;
let progressSource = null;

function getNormalizedStrokes() {
  return strokes.map(s => s.pts);
}

async function startPlot() {
  const ns = getNormalizedStrokes();
  if (ns.length === 0 || ns.every(s => s.length < 2)) {
    showPlotStatus('Draw something first! ✏️', '');
    return;
  }

  document.getElementById('plot-btn').disabled = true;
  document.getElementById('stop-btn').classList.remove('hidden');
  showProgressOverlay(true);
  hidePlotStatus();

  try {
    const res = await fetch('/api/plot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ strokes: ns }),
    });

    if (!res.ok) throw new Error('Server error');
    const { jobId } = await res.json();
    currentJobId = jobId;
    watchProgress(jobId);

  } catch (err) {
    showProgressOverlay(false);
    document.getElementById('plot-btn').disabled = false;
    document.getElementById('stop-btn').classList.add('hidden');
    showPlotStatus('Could not start the plotter. Is the server running?', 'error');
  }
}

function watchProgress(jobId) {
  if (progressSource) progressSource.close();
  progressSource = new EventSource(`/api/plot/${jobId}`);

  progressSource.onmessage = (e) => {
    const job = JSON.parse(e.data);

    if (job.total > 0) {
      const pct = Math.round((job.progress / job.total) * 100);
      document.getElementById('progress-bar').style.width = pct + '%';
      document.getElementById('progress-text').textContent = `${job.progress} / ${job.total} commands`;
    }

    if (job.status === 'done') {
      progressSource.close();
      plotFinished(true, '');
    } else if (job.status === 'error') {
      progressSource.close();
      plotFinished(false, job.error);
    } else if (job.status === 'cancelled') {
      progressSource.close();
      plotFinished(false, 'Stopped.');
    }
  };

  progressSource.onerror = () => {
    progressSource.close();
    plotFinished(false, 'Connection lost. Check if plotter is reachable.');
  };
}

function plotFinished(success, message) {
  showProgressOverlay(false);
  document.getElementById('plot-btn').disabled = false;
  document.getElementById('stop-btn').classList.add('hidden');
  currentJobId = null;
  if (success) {
    showPlotStatus('🎉 Done! Watch it draw!', 'success');
  } else {
    showPlotStatus(message || 'Something went wrong.', 'error');
  }
}

async function stopPlot() {
  try { await fetch('/api/stop', { method: 'POST' }); } catch {}
}

function showProgressOverlay(visible) {
  const overlay = document.getElementById('progress-overlay');
  overlay.classList.toggle('hidden', !visible);
  if (visible) {
    document.getElementById('progress-bar').style.width = '0%';
    document.getElementById('progress-text').textContent = 'Starting...';
  }
}

function showPlotStatus(msg, type) {
  const el = document.getElementById('plot-status');
  el.textContent = msg;
  el.className = 'plot-status ' + (type || '');
  el.classList.remove('hidden');
}

function hidePlotStatus() {
  document.getElementById('plot-status').classList.add('hidden');
}

/* ===== Status polling ====================================================== */

async function checkStatus() {
  try {
    const res = await fetch('/api/status');
    const { connected, ready, state, ip } = await res.json();
    const badge = document.getElementById('status-badge');
    const text = document.getElementById('status-text');
    if (connected && ready) {
      badge.className = 'status-badge status-ok';
      text.textContent = 'Plotter ready';
    } else if (connected) {
      // Reachable but not willing to move — usually Alarm after a limit trip.
      badge.className = 'status-badge status-err';
      text.textContent = `Plotter ${state || 'busy'}`;
    } else {
      badge.className = 'status-badge status-err';
      text.textContent = `Not found (${ip})`;
    }
  } catch {
    document.getElementById('status-badge').className = 'status-badge status-err';
    document.getElementById('status-text').textContent = 'Server offline';
  }
}

/* ===== Config modal ======================================================== */

async function openConfig() {
  try {
    const res = await fetch('/api/config');
    const cfg = await res.json();
    document.getElementById('cfg-ip').value = cfg.esp32Ip;
    document.getElementById('cfg-width').value = cfg.plotWidth;
    document.getElementById('cfg-height').value = cfg.plotHeight;
    document.getElementById('cfg-pendown').value = cfg.penDownCmd;
    document.getElementById('cfg-penup').value = cfg.penUpCmd;
    document.getElementById('cfg-drawspeed').value = cfg.drawSpeed;
    document.getElementById('cfg-penlift-z').value = cfg.penLiftZ ?? 0;
    document.getElementById('cfg-penlift').value = cfg.penLiftDelay ?? 400;
    document.getElementById('cfg-delay').value = cfg.cmdDelayMs;
    document.getElementById('cfg-simplify').value = cfg.simplifyEps ?? 0.004;
    document.getElementById('cfg-camera').value = cfg.cameraUrl ?? '';
  } catch {}
  document.getElementById('config-modal').classList.remove('hidden');
}

function closeConfig() {
  document.getElementById('config-modal').classList.add('hidden');
}

async function saveConfig() {
  const body = {
    esp32Ip:    document.getElementById('cfg-ip').value.trim(),
    plotWidth:  Number(document.getElementById('cfg-width').value),
    plotHeight: Number(document.getElementById('cfg-height').value),
    penDownCmd: document.getElementById('cfg-pendown').value.trim(),
    penUpCmd:   document.getElementById('cfg-penup').value.trim(),
    drawSpeed:    Number(document.getElementById('cfg-drawspeed').value),
    penLiftZ:     Number(document.getElementById('cfg-penlift-z').value),
    penLiftDelay: Number(document.getElementById('cfg-penlift').value),
    cmdDelayMs:   Number(document.getElementById('cfg-delay').value),
    simplifyEps:  Number(document.getElementById('cfg-simplify').value),
    cameraUrl:    document.getElementById('cfg-camera').value.trim(),
  };
  try {
    await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    closeConfig();
    checkStatus();
  } catch {
    alert('Could not save settings.');
  }
}

// Close modal on background click
document.getElementById('config-modal').addEventListener('click', function(e) {
  if (e.target === this) closeConfig();
});

/* ===== Init ================================================================ */

window.addEventListener('resize', resizeCanvas);
resizeCanvas();
buildShapeGallery();
checkStatus();
setInterval(checkStatus, 8000);
