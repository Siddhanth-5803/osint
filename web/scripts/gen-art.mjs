// Dependency-free brand-art generator. Draws the Reelio mark (brand-gradient
// rounded square + white play triangle) and writes PNGs for PWA icons and for
// @capacitor/assets source art. No image libraries required — raw RGBA buffers
// encoded to PNG with Node's zlib.
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

/* ---- PNG encoder (8-bit RGBA) ---- */
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}
function encodePNG(w, h, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/* ---- drawing ---- */
const STOPS = [
  [0.0, [139, 92, 246]], // violet
  [0.55, [244, 114, 182]], // pink
  [1.0, [103, 232, 249]], // cyan
];
function gradAt(t) {
  t = Math.max(0, Math.min(1, t));
  for (let i = 1; i < STOPS.length; i++) {
    if (t <= STOPS[i][0]) {
      const [a, ca] = STOPS[i - 1];
      const [b, cb] = STOPS[i];
      const f = (t - a) / (b - a);
      return ca.map((v, j) => Math.round(v + (cb[j] - v) * f));
    }
  }
  return STOPS[STOPS.length - 1][1];
}
function inRounded(x, y, S, r) {
  if (r <= 0) return true;
  const cx = Math.min(Math.max(x, r), S - r);
  const cy = Math.min(Math.max(y, r), S - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}
function inPlay(x, y, S, scale) {
  const cx = S / 2, cy = S / 2;
  const p = scale * S * 0.5;
  // right-pointing triangle, optically centered
  const ax = cx - p * 0.58, ay = cy - p;
  const bx = cx - p * 0.58, by = cy + p;
  const dx = cx + p * 0.82, dy = cy;
  const s = (px, py, x1, y1, x2, y2) =>
    (x2 - x1) * (py - y1) - (y2 - y1) * (px - x1);
  const d1 = s(x, y, ax, ay, bx, by);
  const d2 = s(x, y, bx, by, dx, dy);
  const d3 = s(x, y, dx, dy, ax, ay);
  const neg = d1 < 0 || d2 < 0 || d3 < 0;
  const pos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(neg && pos);
}

// Render an SxS logo (2x supersampled). opts: {bg:'gradient'|'none', round, play}
function makeLogo(S, { bg = "gradient", round = 0.22, play = 0.4 } = {}) {
  const ss = 2, S2 = S * ss;
  const big = Buffer.alloc(S2 * S2 * 4);
  const r = round * S2;
  for (let y = 0; y < S2; y++) {
    for (let x = 0; x < S2; x++) {
      const o = (y * S2 + x) * 4;
      const inside = inRounded(x, y, S2, r);
      if (bg === "gradient" && inside) {
        const [rr, gg, bb] = gradAt((x + y) / (2 * S2));
        big[o] = rr; big[o + 1] = gg; big[o + 2] = bb; big[o + 3] = 255;
      }
      if (play > 0 && inPlay(x, y, S2, play)) {
        big[o] = 255; big[o + 1] = 255; big[o + 2] = 255; big[o + 3] = 255;
      }
    }
  }
  // box-downscale ss -> 1
  const out = Buffer.alloc(S * S * 4);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      let r2 = 0, g2 = 0, b2 = 0, a2 = 0;
      for (let dy = 0; dy < ss; dy++)
        for (let dx = 0; dx < ss; dx++) {
          const o = ((y * ss + dy) * S2 + (x * ss + dx)) * 4;
          const a = big[o + 3];
          r2 += big[o] * a; g2 += big[o + 1] * a; b2 += big[o + 2] * a; a2 += a;
        }
      const o = (y * S + x) * 4;
      const n = ss * ss;
      out[o] = a2 ? Math.round(r2 / a2) : 0;
      out[o + 1] = a2 ? Math.round(g2 / a2) : 0;
      out[o + 2] = a2 ? Math.round(b2 / a2) : 0;
      out[o + 3] = Math.round(a2 / n);
    }
  }
  return out;
}

function makeSplash(S, logoSize) {
  const buf = Buffer.alloc(S * S * 4);
  for (let i = 0; i < S * S; i++) {
    buf[i * 4] = 11; buf[i * 4 + 1] = 11; buf[i * 4 + 2] = 17; buf[i * 4 + 3] = 255;
  }
  const logo = makeLogo(logoSize, { bg: "gradient", round: 0.24, play: 0.42 });
  const ox = Math.floor((S - logoSize) / 2), oy = Math.floor((S - logoSize) / 2);
  for (let y = 0; y < logoSize; y++)
    for (let x = 0; x < logoSize; x++) {
      const so = (y * logoSize + x) * 4;
      const a = logo[so + 3] / 255;
      if (a === 0) continue;
      const o = ((oy + y) * S + (ox + x)) * 4;
      for (let c = 0; c < 3; c++)
        buf[o + c] = Math.round(logo[so + c] * a + buf[o + c] * (1 - a));
    }
  return buf;
}

function save(path, w, h, rgba) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, encodePNG(w, h, rgba));
  console.log("wrote", path);
}

const root = new URL("..", import.meta.url).pathname;
// PWA icons
save(`${root}public/icons/icon-192.png`, 192, 192, makeLogo(192, { round: 0.22 }));
save(`${root}public/icons/icon-512.png`, 512, 512, makeLogo(512, { round: 0.22 }));
save(`${root}public/icons/icon-maskable-512.png`, 512, 512, makeLogo(512, { round: 0, play: 0.32 }));
// @capacitor/assets source art (adaptive icon + splash)
save(`${root}assets/icon-only.png`, 1024, 1024, makeLogo(1024, { round: 0.22 }));
save(`${root}assets/icon-foreground.png`, 1024, 1024, makeLogo(1024, { bg: "none", play: 0.32 }));
save(`${root}assets/icon-background.png`, 1024, 1024, makeLogo(1024, { bg: "gradient", round: 0, play: 0 }));
save(`${root}assets/splash.png`, 2732, 2732, makeSplash(2732, 820));
save(`${root}assets/splash-dark.png`, 2732, 2732, makeSplash(2732, 820));
