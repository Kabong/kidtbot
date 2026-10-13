#!/usr/bin/env node
/* Grab a frame from the camera watching the plotter.
 *
 *   node tools/watch.js                 -> out/cam-<timestamp>.jpg
 *   node tools/watch.js out/now.jpg     -> that path
 *   node tools/watch.js --every 10 --for 120   -> a frame every 10s for 2min
 *
 * Point config.cameraUrl at a still-image URL. For the Android "IP Webcam"
 * app that's http://<phone-ip>:8080/shot.jpg
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

const ROOT = path.join(__dirname, '..');
const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'config.json'), 'utf8'));

function fetchBuffer(url, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https:') ? https : http;
    const req = mod.get(url, res => {
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode} from camera`));
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.setTimeout(timeoutMs, () => req.destroy(new Error('camera timed out')));
    req.on('error', reject);
  });
}

async function snap(outPath) {
  const buf = await fetchBuffer(config.cameraUrl);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, buf);
  console.log(`${outPath}  (${(buf.length / 1024).toFixed(0)} KB)`);
  return outPath;
}

async function main() {
  if (!config.cameraUrl) {
    console.error('No cameraUrl in config.json.');
    console.error('Set it to your camera\'s still-image URL, e.g.');
    console.error('  http://192.168.1.50:8080/shot.jpg   (Android "IP Webcam" app)');
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const outDir = path.join(ROOT, 'out');
  const num = (flag, dflt) => {
    const i = args.indexOf(flag);
    return i === -1 ? dflt : Number(args[i + 1]);
  };

  const every = num('--every', 0);
  const forSec = num('--for', 0);

  if (every > 0) {
    const until = Date.now() + (forSec || 60) * 1000;
    let n = 0;
    while (Date.now() < until) {
      try {
        await snap(path.join(outDir, `cam-${String(++n).padStart(3, '0')}.jpg`));
      } catch (e) {
        console.error(`frame ${n}: ${e.message}`);
      }
      await new Promise(r => setTimeout(r, every * 1000));
    }
    return;
  }

  const explicit = args.find(a => !a.startsWith('--') && !/^\d+$/.test(a));
  const out = explicit
    ? path.resolve(ROOT, explicit)
    : path.join(outDir, `cam-${Date.now()}.jpg`);
  await snap(out);
}

main().catch(e => { console.error(e.message); process.exit(1); });
