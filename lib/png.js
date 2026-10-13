/* Minimal PNG encoder — 8-bit RGB, no dependencies.
   Exists so the simulator can produce an image we can actually open
   without pulling a native canvas library onto a Windows box. */

const zlib = require('zlib');

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

/** A simple RGB raster you can draw into, then encode as PNG. */
class Raster {
  constructor(width, height, bg = [255, 255, 255]) {
    this.width = width;
    this.height = height;
    this.data = Buffer.alloc(width * height * 3);
    for (let i = 0; i < width * height; i++) {
      this.data[i * 3] = bg[0];
      this.data[i * 3 + 1] = bg[1];
      this.data[i * 3 + 2] = bg[2];
    }
  }

  /** Blend a pixel with coverage `a` in 0..1. */
  px(x, y, color, a = 1) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    if (a <= 0) return;
    if (a > 1) a = 1;
    const i = (y * this.width + x) * 3;
    for (let k = 0; k < 3; k++) {
      this.data[i + k] = Math.round(this.data[i + k] * (1 - a) + color[k] * a);
    }
  }

  /** Filled disc — used as a brush so thick lines have round joins. */
  disc(cx, cy, r, color) {
    const r2 = r * r;
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        const d2 = (x - cx) ** 2 + (y - cy) ** 2;
        if (d2 <= r2) this.px(x, y, color, 1);
        else if (d2 <= (r + 1) ** 2) this.px(x, y, color, (r + 1 - Math.sqrt(d2)));
      }
    }
  }

  /** Line from (x0,y0) to (x1,y1). `dash` > 0 draws a dashed line. */
  line(x0, y0, x1, y1, color, width = 1, dash = 0) {
    const len = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.max(1, Math.ceil(len * 2));
    const r = width / 2;
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      if (dash > 0) {
        // Skip the "off" half of each dash period.
        const along = t * len;
        if (Math.floor(along / dash) % 2 === 1) continue;
      }
      this.disc(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r, color);
    }
  }

  rect(x0, y0, x1, y1, color, width = 1, dash = 0) {
    this.line(x0, y0, x1, y0, color, width, dash);
    this.line(x1, y0, x1, y1, color, width, dash);
    this.line(x1, y1, x0, y1, color, width, dash);
    this.line(x0, y1, x0, y0, color, width, dash);
  }

  toPNG() {
    const { width, height, data } = this;
    // Each scanline is prefixed with a filter-type byte (0 = none).
    const raw = Buffer.alloc((width * 3 + 1) * height);
    for (let y = 0; y < height; y++) {
      raw[y * (width * 3 + 1)] = 0;
      data.copy(raw, y * (width * 3 + 1) + 1, y * width * 3, (y + 1) * width * 3);
    }
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8;   // bit depth
    ihdr[9] = 2;   // color type: truecolor RGB
    ihdr[10] = 0;  // deflate
    ihdr[11] = 0;  // adaptive filtering
    ihdr[12] = 0;  // no interlace
    return Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk('IHDR', ihdr),
      chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
      chunk('IEND', Buffer.alloc(0)),
    ]);
  }
}

module.exports = { Raster };
