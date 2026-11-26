// news-image-20261126 — a one-page newspaper front page summing up the world
// news of Thursday 26 November 2026, drawn from scratch in pure Node 22
// standard library code. No network at run time: the text is set from vector
// glyph outlines shipped beside this file in glyphs.json (DejaVu outlines,
// extracted from the system fonts), the picture is drawn with polygons,
// circles and rectangles, and the PNG is encoded by hand (zlib deflate).
//
// Run:  mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// The program is deterministic: same input files, same bytes out, every run.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

// ---------------------------------------------------------------------------
// PNG encoding (hand-rolled: signature, IHDR, IDAT, IEND, CRC32)
// ---------------------------------------------------------------------------

const CRC_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

function encodePng(width: number, height: number, rgb: Uint8Array): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  // One filter byte (0 = none) per scanline, then raw RGB triples.
  const raw = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 3)] = 0;
    Buffer.from(rgb.buffer, rgb.byteOffset + y * width * 3, width * 3)
      .copy(raw, y * (1 + width * 3) + 1);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------

type RGB = [number, number, number];

function hex(h: string): RGB {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const PAPER = hex('#f6f1e3');
const INK = hex('#16130e');
const RED = hex('#a81f26');
const BLUE = hex('#1d4e89');
const SLATE = hex('#3d4450');
const MUTED = hex('#5c564a');
const SKY = hex('#cfe0ea');
const SKY_TOP = hex('#9dbfd4');
const SEA = hex('#5d87a3');
const SEA_DARK = hex('#3f6a86');
const SMOKE = hex('#6f6a63');
const SMOKE_LIGHT = hex('#9a948a');
const STEEL = hex('#2c2f36');
const STEEL_LIGHT = hex('#4a4e57');
const GOLD = hex('#c08a1e');
const GREEN = hex('#1e6b3a');

// ---------------------------------------------------------------------------
// Canvas: an RGB raster with polygon / circle / rectangle drawing
// ---------------------------------------------------------------------------

class Canvas {
  readonly w: number;
  readonly h: number;
  readonly px: Uint8Array; // row-major RGB

  constructor(w: number, h: number, bg: RGB) {
    this.w = w;
    this.h = h;
    this.px = new Uint8Array(w * h * 3);
    for (let i = 0; i < w * h; i++) {
      this.px[i * 3] = bg[0];
      this.px[i * 3 + 1] = bg[1];
      this.px[i * 3 + 2] = bg[2];
    }
  }

  set(x: number, y: number, c: RGB): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 3;
    this.px[i] = c[0];
    this.px[i + 1] = c[1];
    this.px[i + 2] = c[2];
  }

  rect(x: number, y: number, w: number, h: number, c: RGB): void {
    const x0 = Math.max(0, Math.floor(x));
    const y0 = Math.max(0, Math.floor(y));
    const x1 = Math.min(this.w, Math.ceil(x + w));
    const y1 = Math.min(this.h, Math.ceil(y + h));
    for (let yy = y0; yy < y1; yy++) {
      for (let xx = x0; xx < x1; xx++) {
        const i = (yy * this.w + xx) * 3;
        this.px[i] = c[0];
        this.px[i + 1] = c[1];
        this.px[i + 2] = c[2];
      }
    }
  }

  // Filled circle by horizontal spans.
  disc(cx: number, cy: number, r: number, c: RGB): void {
    const rr = Math.round(r);
    for (let dy = -rr; dy <= rr; dy++) {
      const half = Math.floor(Math.sqrt(Math.max(0, rr * rr - dy * dy)));
      const y = Math.round(cy) + dy;
      if (y < 0 || y >= this.h) continue;
      for (let dx = -half; dx <= half; dx++) {
        const x = Math.round(cx) + dx;
        if (x < 0 || x >= this.w) continue;
        const i = (y * this.w + x) * 3;
        this.px[i] = c[0];
        this.px[i + 1] = c[1];
        this.px[i + 2] = c[2];
      }
    }
  }

  // Filled polygon, even-odd rule, scanline by scanline. Points are [x, y].
  poly(points: Array<[number, number]>, c: RGB): void {
    this.polyMulti([points], c);
  }

  // Fill several contours at once with one even-odd pass, so the inner
  // contour of a letter (the hole of an "O", "D", "a", "e" ...) is left
  // unfilled instead of painted solid.
  polyMulti(contours: Array<Array<[number, number]>>, c: RGB): void {
    let minY = Infinity;
    let maxY = -Infinity;
    for (const points of contours) {
      if (points.length < 3) continue;
      for (const [, y] of points) {
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    if (!Number.isFinite(minY)) return;
    const y0 = Math.max(0, Math.ceil(minY));
    const y1 = Math.min(this.h - 1, Math.floor(maxY));
    for (let y = y0; y <= y1; y++) {
      const xs: number[] = [];
      for (const points of contours) {
        for (let i = 0; i < points.length; i++) {
          const [x1, y1p] = points[i];
          const [x2, y2p] = points[(i + 1) % points.length];
          if ((y1p <= y && y2p > y) || (y2p <= y && y1p > y)) {
            xs.push(x1 + ((y - y1p) * (x2 - x1)) / (y2p - y1p));
          }
        }
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const xa = Math.max(0, Math.ceil(xs[k]));
        const xb = Math.min(this.w - 1, Math.floor(xs[k + 1]));
        for (let x = xa; x <= xb; x++) {
          const i = (y * this.w + x) * 3;
          this.px[i] = c[0];
          this.px[i + 1] = c[1];
          this.px[i + 2] = c[2];
        }
      }
    }
  }

  // Thick straight segment, drawn as a rotated rectangle.
  line(x1: number, y1: number, x2: number, y2: number, t: number, c: RGB): void {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    if (len === 0) {
      this.disc(x1, y1, t / 2, c);
      return;
    }
    const nx = (-dy / len) * (t / 2);
    const ny = (dx / len) * (t / 2);
    this.poly(
      [
        [x1 + nx, y1 + ny],
        [x2 + nx, y2 + ny],
        [x2 - nx, y2 - ny],
        [x1 - nx, y1 - ny],
      ],
      c,
    );
    this.disc(x1, y1, t / 2, c);
    this.disc(x2, y2, t / 2, c);
  }
}

// ---------------------------------------------------------------------------
// Text: vector glyphs from glyphs.json, scaled and filled like any polygon
// ---------------------------------------------------------------------------

interface Glyph {
  adv: number;
  c: Array<Array<[number, number]>>;
}

interface GlyphFile {
  unitsPerEm: number;
  regular: Record<string, Glyph>;
  bold: Record<string, Glyph>;
}

const GLYPHS: GlyphFile = JSON.parse(
  readFileSync(new URL('./glyphs.json', import.meta.url), 'utf8'),
) as GlyphFile;

type FontWeight = 'regular' | 'bold';

class Typesetter {
  private cv: Canvas;

  constructor(cv: Canvas) {
    this.cv = cv;
  }

  // Width of a string at a given pixel size (size = em height in px).
  width(text: string, size: number, weight: FontWeight): number {
    const face = GLYPHS[weight];
    const scale = size / GLYPHS.unitsPerEm;
    let w = 0;
    for (const ch of text) {
      const g = face[ch];
      if (!g) continue;
      w += g.adv * scale;
    }
    return w;
  }

  // Draw one line of text; returns the x position after the last glyph.
  // (x, y) is the top-left of the em box; glyphs are flipped vertically
  // because font coordinates point up and canvas coordinates point down.
  draw(text: string, x: number, y: number, size: number, weight: FontWeight, c: RGB): number {
    const face = GLYPHS[weight];
    const scale = size / GLYPHS.unitsPerEm;
    let cx = x;
    for (const ch of text) {
      const g = face[ch];
      if (!g) {
        cx += size * 0.5;
        continue;
      }
      const contours: Array<Array<[number, number]>> = g.c.map((contour) =>
        contour.map(([px, py]): [number, number] => [cx + px * scale, y + size - py * scale]),
      );
      this.cv.polyMulti(contours, c);
      cx += g.adv * scale;
    }
    return cx;
  }

  drawCentred(text: string, cx: number, y: number, size: number, weight: FontWeight, c: RGB): void {
    this.draw(text, cx - this.width(text, size, weight) / 2, y, size, weight, c);
  }

  // Word-wrap a paragraph into lines no wider than maxWidth. Returns lines.
  wrap(text: string, size: number, weight: FontWeight, maxWidth: number): string[] {
    const words = text.split(/\s+/).filter((w) => w.length > 0);
    const lines: string[] = [];
    let cur = '';
    for (const word of words) {
      const trial = cur ? cur + ' ' + word : word;
      if (this.width(trial, size, weight) <= maxWidth || !cur) {
        cur = trial;
      } else {
        lines.push(cur);
        cur = word;
      }
    }
    if (cur) lines.push(cur);
    return lines;
  }

  // Draw a wrapped paragraph; returns the y just below the last line.
  paragraph(
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    size: number,
    weight: FontWeight,
    c: RGB,
    lineGap: number,
  ): number {
    const lines = this.wrap(text, size, weight, maxWidth);
    for (const line of lines) {
      this.draw(line, x, y, size, weight, c);
      y += size + lineGap;
    }
    return y;
  }
}

// ---------------------------------------------------------------------------
// Pictures: the lead illustration and the small column icons, all polygons
// ---------------------------------------------------------------------------

// The lead picture: the Ras Tanura refinery hub on the Gulf coast at dusk,
// a thick smoke plume rising from the plant, the sea in the foreground.
// (x, y) is the top-left of the picture box, w x h its size.
function drawRefinery(cv: Canvas, x: number, y: number, w: number, h: number): void {
  const horizon = y + h * 0.62;
  // Sky: three horizontal bands, darker toward the top.
  cv.rect(x, y, w, h * 0.22, SKY_TOP);
  cv.rect(x, y + h * 0.22, w, h * 0.22, hex('#b6cddc'));
  cv.rect(x, y + h * 0.44, w, h * 0.18, SKY);
  // Low sun, half-hidden by haze.
  cv.disc(x + w * 0.82, y + h * 0.30, h * 0.11, hex('#e8c96a'));
  cv.disc(x + w * 0.82, y + h * 0.30, h * 0.085, hex('#f0d98c'));
  // Sea.
  cv.rect(x, horizon, w, h - h * 0.62, SEA);
  cv.rect(x, horizon + h * 0.10, w, h * 0.05, SEA_DARK);
  for (let i = 0; i < 7; i++) {
    const wy = horizon + h * (0.08 + i * 0.045);
    const wl = w * (0.10 + 0.05 * ((i * 37) % 5));
    const wx = x + w * (0.06 + 0.13 * ((i * 53) % 6));
    cv.rect(wx, wy, wl, 3, hex('#8fb2c6'));
  }
  // Distant shore line.
  cv.rect(x, horizon - 4, w, 4, hex('#7d8894'));
  // Refinery ground.
  cv.rect(x, horizon - h * 0.10, w, h * 0.10, hex('#3a3d44'));
  // Storage tanks (white cylinders with domed tops).
  const tank = (tx: number, tw: number, th: number): void => {
    cv.rect(tx, horizon - h * 0.10 - th, tw, th, hex('#d8d5cc'));
    cv.poly(
      [
        [tx, horizon - h * 0.10 - th],
        [tx + tw / 2, horizon - h * 0.10 - th - tw * 0.22],
        [tx + tw, horizon - h * 0.10 - th],
      ],
      hex('#c4c0b4'),
    );
    cv.rect(tx, horizon - h * 0.10 - th + th * 0.25, tw, 3, hex('#a9a49a'));
  };
  tank(x + w * 0.04, w * 0.075, h * 0.16);
  tank(x + w * 0.13, w * 0.075, h * 0.13);
  tank(x + w * 0.66, w * 0.075, h * 0.15);
  tank(x + w * 0.75, w * 0.075, h * 0.12);
  // Distillation towers.
  const tower = (tx: number, tw: number, th: number): void => {
    cv.rect(tx, horizon - h * 0.10 - th, tw, th, STEEL);
    cv.poly(
      [
        [tx, horizon - h * 0.10 - th],
        [tx + tw / 2, horizon - h * 0.10 - th - tw * 0.6],
        [tx + tw, horizon - h * 0.10 - th],
      ],
      STEEL_LIGHT,
    );
    for (let i = 1; i <= 3; i++) {
      cv.rect(tx - 4, horizon - h * 0.10 - (th * i) / 4, tw + 8, 3, STEEL_LIGHT);
    }
  };
  tower(x + w * 0.24, w * 0.035, h * 0.34);
  tower(x + w * 0.30, w * 0.028, h * 0.26);
  tower(x + w * 0.56, w * 0.032, h * 0.30);
  // Flare stack with a small flame.
  cv.rect(x + w * 0.47, horizon - h * 0.10 - h * 0.38, 6, h * 0.38, STEEL);
  cv.poly(
    [
      [x + w * 0.47 - 2, horizon - h * 0.10 - h * 0.38],
      [x + w * 0.47 + 3, horizon - h * 0.10 - h * 0.38 - 16],
      [x + w * 0.47 + 8, horizon - h * 0.10 - h * 0.38],
    ],
    hex('#e8862e'),
  );
  // Smoke plume: stacked dark discs rising and drifting right from the
  // plant, kept inside the picture box.
  const plume: Array<[number, number, number, RGB]> = [
    [0.40, 0.42, 0.045, SMOKE],
    [0.43, 0.34, 0.06, SMOKE],
    [0.47, 0.26, 0.07, SMOKE_LIGHT],
    [0.52, 0.19, 0.075, SMOKE],
    [0.58, 0.13, 0.07, SMOKE_LIGHT],
    [0.36, 0.36, 0.04, SMOKE_LIGHT],
    [0.50, 0.22, 0.06, SMOKE],
    [0.44, 0.38, 0.05, SMOKE_LIGHT],
    [0.48, 0.30, 0.055, SMOKE],
    [0.55, 0.16, 0.06, SMOKE],
    [0.45, 0.30, 0.05, SMOKE_LIGHT],
  ];
  for (const [fx, fy, fr, col] of plume) {
    cv.disc(x + w * fx, y + h * fy, h * fr, col);
  }
  // Thin frame around the picture.
  cv.rect(x, y, w, 3, INK);
  cv.rect(x, y + h - 3, w, 3, INK);
  cv.rect(x, y, 3, h, INK);
  cv.rect(x + w - 3, y, 3, h, INK);
}

// Small icons drawn above each brief column (48 x 48 box).
function drawCoinIcon(cv: Canvas, x: number, y: number): void {
  cv.disc(x + 24, y + 24, 22, GOLD);
  cv.disc(x + 24, y + 24, 18, hex('#e3b34a'));
  cv.rect(x + 19, y + 12, 10, 4, hex('#8a5f10'));
  cv.rect(x + 19, y + 22, 10, 4, hex('#8a5f10'));
  cv.rect(x + 19, y + 32, 10, 4, hex('#8a5f10'));
}

function drawBallIcon(cv: Canvas, x: number, y: number): void {
  cv.disc(x + 24, y + 24, 22, hex('#f2ede0'));
  cv.disc(x + 24, y + 24, 22, hex('#f2ede0'));
  cv.poly(
    [
      [x + 24, y + 14],
      [x + 33, y + 21],
      [x + 30, y + 32],
      [x + 18, y + 32],
      [x + 15, y + 21],
    ],
    INK,
  );
  cv.line(x + 24, y + 14, x + 24, y + 4, 3, INK);
  cv.line(x + 33, y + 21, x + 43, y + 16, 3, INK);
  cv.line(x + 30, y + 32, x + 38, y + 41, 3, INK);
  cv.line(x + 18, y + 32, x + 10, y + 41, 3, INK);
  cv.line(x + 15, y + 21, x + 5, y + 16, 3, INK);
}

function drawStormIcon(cv: Canvas, x: number, y: number): void {
  cv.disc(x + 16, y + 20, 11, SLATE);
  cv.disc(x + 28, y + 16, 13, SLATE);
  cv.disc(x + 36, y + 22, 9, SLATE);
  cv.rect(x + 6, y + 20, 36, 10, SLATE);
  cv.line(x + 16, y + 34, x + 12, y + 44, 4, BLUE);
  cv.line(x + 26, y + 34, x + 22, y + 44, 4, BLUE);
  cv.line(x + 36, y + 34, x + 32, y + 44, 4, BLUE);
}

// A thin rule with a small diamond in the middle.
function divider(cv: Canvas, x: number, y: number, w: number): void {
  cv.rect(x, y, w, 2, INK);
  const cx = x + w / 2;
  cv.poly(
    [
      [cx, y - 5],
      [cx + 6, y + 1],
      [cx, y + 7],
      [cx - 6, y + 1],
    ],
    RED,
  );
}


// ---------------------------------------------------------------------------
// The front page: masthead, lead story, three briefs, markets, footer
// ---------------------------------------------------------------------------

const W = 1024;
const H = 1024;
const MARGIN = 32;
const CONTENT = W - MARGIN * 2;

function buildPage(): Canvas {
  const cv = new Canvas(W, H, PAPER);
  const ts = new Typesetter(cv);

  // Top red bar.
  cv.rect(0, 0, W, 10, RED);

  // Masthead.
  ts.drawCentred('THE WORLD TODAY', W / 2, 24, 64, 'bold', INK);
  ts.drawCentred('THURSDAY, 26 NOVEMBER 2026', W / 2, 100, 28, 'bold', RED);
  cv.rect(MARGIN, 140, CONTENT, 3, INK);
  cv.rect(MARGIN, 146, CONTENT, 1, INK);
  ts.drawCentred(
    "ONE DAY  •  ONE PAGE  •  THE WORLD'S NEWS",
    W / 2,
    156,
    16,
    'regular',
    MUTED,
  );

  // Lead kicker + headline.
  ts.draw('MIDDLE EAST  —  ENERGY', MARGIN, 186, 20, 'bold', RED);
  ts.draw('SAUDI ARABIA', W - MARGIN - ts.width('SAUDI ARABIA', 20, 'bold'), 186, 20, 'bold', SLATE);
  let y = 212;
  y = ts.paragraph(
    'OIL JUMPS AS SMOKE SEEN OVER SAUDI REFINERY',
    MARGIN,
    y,
    CONTENT,
    44,
    'bold',
    INK,
    5,
  );
  y += 4;
  y = ts.paragraph(
    "Houthis claim a strike on Ras Tanura, the kingdom's largest refinery; Brent crude climbs toward $95 a barrel.",
    MARGIN,
    y,
    CONTENT,
    22,
    'regular',
    SLATE,
    4,
  );

  // Lead picture.
  const picY = y + 12;
  const picH = 210;
  drawRefinery(cv, MARGIN, picY, CONTENT, picH);
  const capY = picY + picH + 10;
  ts.draw(
    "Smoke rises over the Ras Tanura refinery hub on Saudi Arabia's Gulf coast.",
    MARGIN,
    capY,
    16,
    'regular',
    MUTED,
  );
  ts.draw(
    'Satellite image.',
    MARGIN + ts.width("Smoke rises over the Ras Tanura refinery hub on Saudi Arabia's Gulf coast. ", 16, 'regular') + 8,
    capY,
    16,
    'bold',
    MUTED,
  );

  // Lead body, two columns of short lines under the caption.
  const bodyY = capY + 30;
  ts.paragraph(
    'Satellite images showed a thick black smoke plume over the export hub on Thursday. Saudi Arabia said it intercepted drones; the scale of any damage was not yet confirmed. Oil prices rose about 3.5% on the day.',
    MARGIN,
    bodyY,
    CONTENT,
    20,
    'regular',
    INK,
    5,
  );

  // Divider above the briefs.
  const divY = 712;
  divider(cv, MARGIN, divY, CONTENT);

  // Three brief columns.
  const colW = (CONTENT - 2 * 24) / 3;
  const colY = divY + 22;
  const briefs = [
    {
      icon: drawCoinIcon,
      kicker: 'ECONOMY  —  KOREA',
      head: 'SEOUL RAISES RATES TO 3.25%',
      body: 'The Bank of Korea lifts its base rate a quarter point to 3.25%, resuming tightening as chip exports boom.',
    },
    {
      icon: drawBallIcon,
      kicker: 'SPORT  —  FOOTBALL',
      head: 'LIVERPOOL AND BARCA WIN BIG',
      body: 'Liverpool win 3-0 at Club Brugge; Barcelona win 4-1. PSG are held 2-2 by Roma; Bayern lose 2-1 at Lille.',
    },
    {
      icon: drawStormIcon,
      kicker: 'WEATHER  —  AMERICA',
      head: "STORM MOVES MACY'S PARADE",
      body: "A nor'easter forces New York's centenary Thanksgiving parade to Saturday.",
    },
  ];
  briefs.forEach((b, i) => {
    const cx = MARGIN + i * (colW + 24);
    b.icon(cv, cx, colY);
    let by = colY + 50;
    ts.draw(b.kicker, cx, by, 16, 'bold', RED);
    by += 24;
    by = ts.paragraph(b.head, cx, by, colW, 25, 'bold', INK, 3);
    by += 6;
    ts.paragraph(b.body, cx, by, colW, 17, 'regular', INK, 4);
    if (i < 2) cv.rect(cx + colW + 12, colY, 1, 168, hex('#c9c2ae'));
  });

  // Markets strip.
  const stripY = 952;
  cv.rect(0, stripY, W, 30, INK);
  ts.drawCentred(
    'MARKETS  •  BRENT $94.81  •  GOLD $3,566  •  NIKKEI +1.6%  •  KOSPI +1.9%',
    W / 2,
    stripY + 7,
    18,
    'bold',
    PAPER,
  );

  // Footer.
  ts.drawCentred(
    'THURSDAY, 26 NOVEMBER 2026  —  ALL STORIES REPORTED ON 26 NOVEMBER 2026',
    W / 2,
    990,
    14,
    'bold',
    MUTED,
  );
  ts.drawCentred('Sources: Reuters  •  UEFA  •  USA TODAY', W / 2, 1008, 12, 'regular', MUTED);

  return cv;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

function main(): void {
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
  mkdirSync(outDir, { recursive: true });
  const page = buildPage();
  const png = encodePng(W, H, page.px);
  writeFileSync(join(outDir, 'entry.png'), png);
}

main();
