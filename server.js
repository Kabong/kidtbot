const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const { strokesToGcode } = require('./lib/gcode');
const { simulate } = require('./lib/simulate');

const app = express();
app.use(express.json({ limit: '4mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// --- Config ---
const CONFIG_PATH = path.join(__dirname, 'config.json');
let config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));

function saveConfig() {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

const esp = () => `http://${config.esp32Ip}`;

// --- Job tracking ---
const jobs = new Map();

// --- Send gcode to the plotter ---
async function sendGcodeLines(lines, jobId) {
  const job = jobs.get(jobId);
  const actionableLines = lines.filter(l => l.trim() && !l.startsWith(';'));
  job.total = actionableLines.length;
  job.progress = 0;

  for (let i = 0; i < actionableLines.length; i++) {
    if (job.cancelled) {
      job.status = 'cancelled';
      return;
    }

    const line = actionableLines[i];
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await axios.get(`${esp()}/command`, {
          params: { commandText: line },
          timeout: 8000,
        });
        break;
      } catch (err) {
        if (attempt === 3) {
          throw new Error(`Failed after 3 attempts at line ${i + 1} ("${line}"): ${err.message}`);
        }
        await new Promise(r => setTimeout(r, 300));
      }
    }

    job.progress = i + 1;
    await new Promise(r => setTimeout(r, config.cmdDelayMs));
  }
}

async function runPlotJob(jobId, strokes) {
  const job = jobs.get(jobId);
  try {
    const { lines, meta } = strokesToGcode(strokes, config);
    if (meta.empty) throw new Error('Nothing to draw');
    job.meta = meta;
    console.log(`[job ${jobId}] ${meta.strokeCount} strokes, ` +
      `${meta.pointsBefore}->${meta.pointsAfter} points, ${meta.actionable} commands`);
    await sendGcodeLines(lines, jobId);
    if (job.status !== 'cancelled') job.status = 'done';
  } catch (err) {
    job.status = 'error';
    job.error = err.message;
    console.error(`[job ${jobId}] ${err.message}`);
  }
}

// --- Routes ---

/** Grbl answers "?" with e.g. "<Idle|MPos:0.000,0.000,0.000|FS:0,0>".
    Reachable-over-HTTP is NOT the same as ready-to-draw, so parse the state. */
app.get('/api/status', async (req, res) => {
  try {
    const r = await axios.get(`${esp()}/command`, {
      params: { commandText: '?' },
      timeout: 3000,
    });
    const body = typeof r.data === 'string' ? r.data : JSON.stringify(r.data);
    const m = body.match(/<([A-Za-z]+)[|>]/);
    const state = m ? m[1] : null;
    const ready = state ? ['Idle', 'Run', 'Jog'].includes(state) : true;
    res.json({ connected: true, ready, state, ip: config.esp32Ip });
  } catch {
    res.json({ connected: false, ready: false, state: null, ip: config.esp32Ip });
  }
});

/** Dry run: generate + simulate, return a PNG of what the pen would draw.
    No hardware involved — this is how we test without the plotter. */
app.post('/api/preview', (req, res) => {
  const { strokes } = req.body;
  if (!Array.isArray(strokes) || strokes.length === 0) {
    return res.status(400).json({ error: 'No strokes provided' });
  }
  const { lines, meta } = strokesToGcode(strokes, config);
  if (meta.empty) return res.status(400).json({ error: 'Nothing to draw' });

  const { png, stats, warnings } = simulate(lines, config);
  if (req.query.format === 'json') {
    return res.json({ meta, stats, warnings, gcode: lines });
  }
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('X-Plot-Stats', JSON.stringify(stats));
  res.setHeader('X-Plot-Warnings', JSON.stringify(warnings));
  res.send(png);
});

app.post('/api/plot', (req, res) => {
  const { strokes } = req.body;
  if (!Array.isArray(strokes) || strokes.length === 0) {
    return res.status(400).json({ error: 'No strokes provided' });
  }

  const jobId = Date.now().toString();
  jobs.set(jobId, { status: 'running', progress: 0, total: 0, error: null, cancelled: false });
  runPlotJob(jobId, strokes);
  res.json({ jobId });
});

app.get('/api/plot/:jobId', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const { jobId } = req.params;

  const send = () => {
    const job = jobs.get(jobId);
    if (!job) {
      res.write(`data: ${JSON.stringify({ status: 'not-found' })}\n\n`);
      clearInterval(timer);
      res.end();
      return;
    }
    res.write(`data: ${JSON.stringify(job)}\n\n`);
    if (['done', 'error', 'cancelled'].includes(job.status)) {
      clearInterval(timer);
      setTimeout(() => jobs.delete(jobId), 5000);
      res.end();
    }
  };

  send();
  const timer = setInterval(send, 400);
  req.on('close', () => clearInterval(timer));
});

app.post('/api/stop', (req, res) => {
  for (const [, job] of jobs) {
    if (job.status === 'running') job.cancelled = true;
  }
  // Lift the pen as a safety measure, best-effort.
  axios.get(`${esp()}/command`, {
    params: { commandText: config.penUpCmd },
    timeout: 3000,
  }).catch(() => {});
  res.json({ ok: true });
});

/** Proxy a snapshot from the camera watching the plotter. Keeps the camera's
    address in one place and sidesteps browser cross-origin rules. */
app.get('/api/camera/snapshot', async (req, res) => {
  if (!config.cameraUrl) return res.status(404).json({ error: 'No cameraUrl configured' });
  try {
    const r = await axios.get(config.cameraUrl, {
      responseType: 'arraybuffer',
      timeout: 8000,
    });
    res.setHeader('Content-Type', r.headers['content-type'] || 'image/jpeg');
    res.setHeader('Cache-Control', 'no-store');
    res.send(Buffer.from(r.data));
  } catch (err) {
    res.status(502).json({ error: `Camera unreachable: ${err.message}` });
  }
});

app.get('/api/config', (req, res) => res.json(config));

app.post('/api/config', (req, res) => {
  const allowed = [
    'esp32Ip', 'plotWidth', 'plotHeight', 'penDownCmd', 'penUpCmd',
    'drawSpeed', 'moveSpeed', 'cmdDelayMs', 'penLiftDelay', 'penLiftZ',
    'simplifyEps', 'cameraUrl',
  ];
  for (const key of allowed) {
    if (req.body[key] !== undefined) config[key] = req.body[key];
  }
  saveConfig();
  res.json({ ok: true });
});

// --- Start ---
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`\n🎨 MidTBot Kids UI is running!`);
  console.log(`   Open: http://localhost:${PORT}`);
  console.log(`   (or from another device on your network: http://<your-pc-ip>:${PORT})\n`);
});
