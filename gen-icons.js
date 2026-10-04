const fs = require('fs');
const zlib = require('zlib');

function crc32(buf) {
  let c, table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function png(size, pixel) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  let p = 0;
  for (let y = 0; y < size; y++) {
    raw[p++] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x, y, size);
      raw[p++] = r; raw[p++] = g; raw[p++] = b; raw[p++] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const BG = [17, 20, 24, 255];

const LEFT = [62, 150, 166, 255];
const RIGHT = [98, 87, 214, 255];

function inRoundRect(x, y, rx, ry, w, h, r) {
  if (x < rx || y < ry || x >= rx + w || y >= ry + h) return false;
  const cx = Math.min(Math.max(x, rx + r), rx + w - r);
  const cy = Math.min(Math.max(y, ry + r), ry + h - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r || (x >= rx + r && x < rx + w - r) || (y >= ry + r && y < ry + h - r);
}

function draw(inset) {
  return (x, y, size) => {
    const pad = size * inset;
    const gap = size * 0.05;
    const w = (size - pad * 2 - gap) / 2;
    const h = size - pad * 2;
    const r = w * 0.28;
    if (inRoundRect(x, y, pad, pad, w, h, r)) return LEFT;
    if (inRoundRect(x, y, pad + w + gap, pad, w, h, r)) return RIGHT;
    return BG;
  };
}

for (const size of [192, 512]) {
  fs.writeFileSync(`icon-${size}.png`, png(size, draw(0.18)));
  fs.writeFileSync(`icon-maskable-${size}.png`, png(size, draw(0.28)));
}
console.log('icons written');
