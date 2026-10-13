/* Replay gcode the way the plotter would and draw what the pen would leave
   on the paper. Lets us catch mirrored axes, bad scaling, off-paper moves and
   stuck-pen bugs without owning the hardware. */

const { Raster } = require('./png');

const INK      = [20, 20, 20];      // pen-down drawing
const TRAVEL   = [150, 185, 235];   // pen-up rapid
const BAD      = [230, 50, 50];     // pen-down rapid: a dragged line
const AREA     = [205, 205, 210];   // plot-area border
const ORIGIN   = [40, 170, 90];     // machine origin marker

/** Parse one gcode line into { cmd, words }, comments stripped. */
function parseLine(raw) {
  const line = raw.split(';')[0].trim();
  if (!line) return null;
  const words = {};
  // Letter followed by a number, e.g. X12.5 / F800 / S90
  for (const m of line.matchAll(/([A-Za-z])\s*(-?\d*\.?\d+)/g)) {
    words[m[1].toUpperCase()] = parseFloat(m[2]);
  }
  return { line, words };
}

/**
 * @param lines  gcode lines
 * @param config plotter config (plotWidth/plotHeight/penUpCmd/penDownCmd/...)
 */
function simulate(lines, config) {
  const {
    plotWidth, plotHeight, penUpCmd, penDownCmd,
    drawSpeed = 800, moveSpeed = 3000, cmdDelayMs = 0, penLiftDelay = 0,
    penLiftZ = 0,
  } = config;

  const upTok   = (penUpCmd   || 'M5').trim().split(/\s+/)[0].toUpperCase();
  const downTok = (penDownCmd || 'M3').trim().split(/\s+/)[0].toUpperCase();

  let x = 0, y = 0, z = 0;
  let servoDown = false;       // what the M-command says
  let rapid = true;            // G0 vs G1 (modal)
  const useZ = penLiftZ > 0;

  const segments = [];
  const warnings = [];
  let drawnLen = 0, travelLen = 0, dwellSec = 0, actionable = 0;
  let penChanges = 0, zCommands = 0;

  for (const raw of lines) {
    const p = parseLine(raw);
    if (!p) continue;
    actionable++;
    const { line, words } = p;
    const head = line.split(/\s+/)[0].toUpperCase();

    if (head === upTok)   { if (servoDown) penChanges++; servoDown = false; continue; }
    if (head === downTok) { if (!servoDown) penChanges++; servoDown = true;  continue; }

    if ('G' in words) {
      const g = words.G;
      if (g === 4) { dwellSec += words.P || 0; continue; }
      if (g === 92) {
        // Reset work origin. Z deliberately untouched by our generator.
        if ('X' in words) x = words.X;
        if ('Y' in words) y = words.Y;
        if ('Z' in words) warnings.push('G92 touched Z — pen height loses physical meaning');
        continue;
      }
      if (g === 21 || g === 90) continue;           // units / absolute: assumed
      if (g === 0 || g === 1) rapid = (g === 0);     // fall through to motion
      else continue;
    }

    const hasMotion = 'X' in words || 'Y' in words || 'Z' in words;
    if (!hasMotion) continue;

    if ('Z' in words) { zCommands++; z = words.Z; }
    const nx = 'X' in words ? words.X : x;
    const ny = 'Y' in words ? words.Y : y;

    // The pen only marks paper if the servo says down AND (when the Z lift is
    // in use) the Z axis is actually at the paper.
    const penDown = servoDown && (!useZ || z <= 0.01);
    const len = Math.hypot(nx - x, ny - y);

    if (len > 0) {
      segments.push({ x0: x, y0: y, x1: nx, y1: ny, penDown, rapid });
      if (penDown) {
        drawnLen += len;
        if (rapid) warnings.push(`rapid move while pen is down at (${nx.toFixed(1)}, ${ny.toFixed(1)}) — will drag a line`);
      } else {
        travelLen += len;
      }
      if (nx < -0.01 || ny < -0.01 || nx > plotWidth + 0.01 || ny > plotHeight + 0.01) {
        warnings.push(`move outside plot area: (${nx.toFixed(1)}, ${ny.toFixed(1)}) vs ${plotWidth}x${plotHeight}mm`);
      }
    }
    x = nx; y = ny;
  }

  if (useZ && zCommands === 0) warnings.push('penLiftZ is set but no Z moves were emitted');
  if (!useZ && zCommands > 0)  warnings.push('Z moves emitted while penLiftZ is disabled');
  if (servoDown)               warnings.push('gcode ends with the pen DOWN');

  // --- render -------------------------------------------------------------
  const PPMM = 10, PAD = 14;
  const W = Math.round(plotWidth * PPMM) + PAD * 2;
  const H = Math.round(plotHeight * PPMM) + PAD * 2;
  const r = new Raster(W, H);

  // Plotter Y grows away from the user; image Y grows downward.
  const ix = mm => PAD + mm * PPMM;
  const iy = mm => PAD + (plotHeight - mm) * PPMM;

  r.rect(ix(0), iy(0), ix(plotWidth), iy(plotHeight), AREA, 1);

  for (const s of segments) {
    if (s.penDown && s.rapid)      r.line(ix(s.x0), iy(s.y0), ix(s.x1), iy(s.y1), BAD, 3);
    else if (s.penDown)            r.line(ix(s.x0), iy(s.y0), ix(s.x1), iy(s.y1), INK, 2);
    else                           r.line(ix(s.x0), iy(s.y0), ix(s.x1), iy(s.y1), TRAVEL, 1, 5);
  }

  // Origin crosshair, so axis flips are obvious at a glance.
  r.line(ix(0) - 6, iy(0), ix(0) + 6, iy(0), ORIGIN, 1);
  r.line(ix(0), iy(0) - 6, ix(0), iy(0) + 6, ORIGIN, 1);

  const motionSec = (drawnLen / drawSpeed + travelLen / moveSpeed) * 60;
  const stats = {
    segments: segments.length,
    drawnLenMm: +drawnLen.toFixed(1),
    travelLenMm: +travelLen.toFixed(1),
    penChanges,
    actionable,
    motionSec: +motionSec.toFixed(1),
    dwellSec: +dwellSec.toFixed(1),
    httpDelaySec: +((actionable * cmdDelayMs) / 1000).toFixed(1),
    get totalSec() { return +(this.motionSec + this.dwellSec + this.httpDelaySec).toFixed(1); },
  };

  return { png: r.toPNG(), stats, warnings: [...new Set(warnings)] };
}

module.exports = { simulate, parseLine };
