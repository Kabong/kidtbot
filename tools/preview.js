#!/usr/bin/env node
/* Render what the plotter WOULD draw, without the plotter.
 *
 *   node tools/preview.js smiley            -> out/smiley.png
 *   node tools/preview.js --all             -> every preset
 *   node tools/preview.js --json strokes.json
 *
 * Reads the same SHAPES table the browser uses, so the preview can't drift
 * from what the kids actually tap.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const { strokesToGcode } = require(path.join(ROOT, 'lib/gcode'));
const { simulate } = require(path.join(ROOT, 'lib/simulate'));

/** Pull the SHAPES table straight out of public/app.js (its top section is
    plain JS — no DOM — so it evaluates standalone). */
function loadShapes() {
  const src = fs.readFileSync(path.join(ROOT, 'public/app.js'), 'utf8');
  const end = src.indexOf('/* ===== Drawing state');
  if (end === -1) throw new Error('could not find end of SHAPES block in public/app.js');
  const ctx = { Math };
  vm.createContext(ctx);
  vm.runInContext(src.slice(0, end) + '\n;globalThis.__shapes = SHAPES;', ctx);
  return ctx.__shapes;
}

function main() {
  const args = process.argv.slice(2);
  const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'config.json'), 'utf8'));
  const outDir = path.join(ROOT, 'out');
  fs.mkdirSync(outDir, { recursive: true });

  let jobs = [];
  if (args[0] === '--json') {
    const strokes = JSON.parse(fs.readFileSync(args[1], 'utf8'));
    jobs.push({ name: path.basename(args[1], '.json'), strokes });
  } else {
    const shapes = loadShapes();
    const names = args[0] === '--all' || args.length === 0
      ? Object.keys(shapes)
      : args.filter(a => !a.startsWith('--'));
    for (const n of names) {
      if (!shapes[n]) { console.error(`unknown shape: ${n}`); process.exit(1); }
      jobs.push({ name: n, strokes: shapes[n].strokes() });
    }
  }

  const rows = [];
  for (const job of jobs) {
    const { lines, meta } = strokesToGcode(job.strokes, config);
    if (meta.empty) { console.error(`${job.name}: nothing to draw`); continue; }
    const { png, stats, warnings } = simulate(lines, config);

    const pngPath = path.join(outDir, `${job.name}.png`);
    fs.writeFileSync(pngPath, png);
    fs.writeFileSync(path.join(outDir, `${job.name}.gcode`), lines.join('\n') + '\n');

    rows.push({
      shape: job.name,
      pts: `${meta.pointsBefore}→${meta.pointsAfter}`,
      cmds: stats.actionable,
      draw_mm: stats.drawnLenMm,
      move_mm: stats.travelLenMm,
      motion_s: stats.motionSec,
      http_s: stats.httpDelaySec,
      total_s: stats.totalSec,
      warn: warnings.length,
    });
    for (const w of warnings) console.error(`  ! ${job.name}: ${w}`);
  }

  console.table(rows);
  console.log(`\nPNG + gcode written to ${outDir}`);
}

main();
