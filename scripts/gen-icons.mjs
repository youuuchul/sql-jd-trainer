/**
 * PWA 아이콘 PNG 를 의존성 없이 그린다. 빈칸이 있는 코드 카드 모양.
 * 실행: node scripts/gen-icons.mjs  -> public/icons/*.png, app/apple-icon.png
 */
import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const BG = [17, 17, 17];
const LINE = [92, 92, 92];
const ACCENT = [107, 140, 255];

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};
const png = (size, pixel) => {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x, y);
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
      raw[o + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
};

const inRound = (u, v, [x0, y0, x1, y1], r) => {
  if (u < x0 || u > x1 || v < y0 || v > y1) return false;
  const cx = Math.min(Math.max(u, x0 + r), x1 - r);
  const cy = Math.min(Math.max(v, y0 + r), y1 - r);
  return (u - cx) ** 2 + (v - cy) ** 2 <= r * r;
};

// 단위 좌표(0~1). 세 줄의 코드와 가운데 줄의 강조 빈칸
const SHAPES = [
  { rect: [0.24, 0.3, 0.6, 0.38], color: LINE },
  { rect: [0.24, 0.46, 0.44, 0.54], color: LINE },
  { rect: [0.5, 0.46, 0.76, 0.54], color: ACCENT },
  { rect: [0.24, 0.62, 0.68, 0.7], color: LINE },
];

const draw = (size, { transparentBg = false, mono = false } = {}) =>
  png(size, (x, y) => {
    const S = 4;
    let hit = [0, 0, 0];
    let cover = 0;
    for (let i = 0; i < S; i++)
      for (let j = 0; j < S; j++) {
        const u = (x + (i + 0.5) / S) / size;
        const v = (y + (j + 0.5) / S) / size;
        const s = SHAPES.find((sh) => inRound(u, v, sh.rect, 0.04));
        if (s) {
          const c = mono ? [255, 255, 255] : s.color;
          hit = hit.map((h, k) => h + c[k]);
          cover++;
        } else if (!transparentBg) hit = hit.map((h, k) => h + BG[k]);
      }
    if (transparentBg) return cover ? [...hit.map((h) => Math.round(h / cover)), Math.round((cover / (S * S)) * 255)] : [0, 0, 0, 0];
    return [...hit.map((h) => Math.round(h / (S * S))), 255];
  });

writeFileSync("public/icons/icon-192.png", draw(192));
writeFileSync("public/icons/icon-512.png", draw(512));
writeFileSync("public/icons/badge-96.png", draw(96, { transparentBg: true, mono: true }));
writeFileSync("app/apple-icon.png", draw(180));
console.log("icons written");
