#!/usr/bin/env node
/* Send a drawing to the plotter from the command line — no browser needed.
 *
 *   node tools/plot.js smiley          send a preset
 *   node tools/plot.js --json s.json   send strokes from a file
 *   node tools/plot.js --dry smiley    preview only, nothing is sent
 *
 * Streams progress until the job finishes.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const http = require('http');

const ROOT = path.join(__dirname, '..');
const BASE = process.env.KIDTBOT_URL || 'http://localhost:3000';

function loadShapes() {
  const src = fs.readFileSync(path.join(ROOT, 'public/app.js'), 'utf8');
  const end = src.indexOf('/* ===== Drawing state');
  const ctx = { Math };
  vm.createContext(ctx);
  vm.runInContext(src.slice(0, end) + '\n;globalThis.__shapes = SHAPES;', ctx);
  return ctx.__shapes;
}

function request(method, url, body) {
  return new Promise((resolve, reject) => {
    const data = body ? Buffer.from(JSON.stringify(body)) : null;
    const u = new URL(url);
    const req = http.request({
      hostname: u.hostname, port: u.port, path: u.pathname + u.search, method,
      headers: data
        ? { 'Content-Type': 'application/json', 'Content-Length': data.length }
        : {},
    }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  const args = process.argv.slice(2);
  const dry = args.includes('--dry');

  let strokes;
  if (args.includes('--json')) {
    const raw = JSON.parse(fs.readFileSync(args[args.indexOf('--json') + 1], 'utf8'));
    strokes = Array.isArray(raw) ? raw : raw.strokes;
  } else {
    const name = args.find(a => !a.startsWith('--'));
    const shapes = loadShapes();
    if (!name || !shapes[name]) {
      console.error(`usage: node tools/plot.js [--dry] <shape>`);
      console.error(`shapes: ${Object.keys(shapes).join(', ')}`);
      process.exit(1);
    }
    strokes = shapes[name].strokes();
  }

  if (dry) {
    const r = await request('POST', `${BASE}/api/preview?format=json`, { strokes });
    const j = JSON.parse(r.body.toString());
    console.log('stats:', j.stats);
    if (j.warnings.length) console.log('warnings:', j.warnings);
    return;
  }

  const start = await request('POST', `${BASE}/api/plot`, { strokes });
  if (start.status !== 200) {
    console.error(start.body.toString());
    process.exit(1);
  }
  const { jobId } = JSON.parse(start.body.toString());
  console.log(`job ${jobId} started`);

  // Poll the SSE stream for progress.
  await new Promise((resolve, reject) => {
    http.get(`${BASE}/api/plot/${jobId}`, res => {
      res.setEncoding('utf8');
      let buf = '';
      res.on('data', chunk => {
        buf += chunk;
        let i;
        while ((i = buf.indexOf('\n\n')) !== -1) {
          const line = buf.slice(0, i).replace(/^data: /, '');
          buf = buf.slice(i + 2);
          let job;
          try { job = JSON.parse(line); } catch { continue; }
          if (job.total) {
            process.stdout.write(`\r  ${job.progress}/${job.total} commands   `);
          }
          if (['done', 'error', 'cancelled'].includes(job.status)) {
            process.stdout.write('\n');
            if (job.status === 'error') return reject(new Error(job.error));
            console.log(job.status);
            return resolve();
          }
        }
      });
      res.on('end', resolve);
    }).on('error', reject);
  });
}

main().catch(e => { console.error(e.message); process.exit(1); });
