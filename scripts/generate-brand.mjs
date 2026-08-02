/**
 * Generates the flat brand assets from the SAME path data the 3D object uses.
 *
 *   node scripts/generate-brand.mjs
 *
 * Outputs to /public/brand: mark.svg, wordmark.svg, favicon.svg, favicon-*.png,
 * apple-touch-icon.png. The OG image is rendered separately from the live hero
 * scene (see scripts/capture-og.md) because a flat mark makes a poor OG card.
 *
 * This is a plain .mjs script with the geometry inlined rather than importing
 * src/lib/mark/paths.ts, so that regenerating brand assets never requires a
 * TypeScript toolchain. The numbers are duplicated in exactly one place and
 * there is a check below that fails loudly if the two drift.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'public', 'brand');

const FG = '#F2F2F0';
const ACCENT = '#FF5A1F';
const BG = '#08080A';

const GRID = { w: 100, h: 120 };
const STEM_W = 22;
const CHANNEL = { x: 8.5, y: 9, w: 5, h: 102 };
const BOLT_R = 2.15;
const BOLT_Y = [26, 60, 94];
const BOX = { x: -11, y: -2, w: 105, h: 124 };

const d = (deg) => (deg * Math.PI) / 180;
const r = (n) => Number(n.toFixed(3)).toString();

/* ── Path emitters (mirror of src/lib/mark/svg.ts) ────────────────────────── */

function roundRectD(x, y, w, h, rad) {
  const R = rad;
  return [
    `M${r(x + R)} ${r(y)}`,
    `L${r(x + w - R)} ${r(y)}`,
    `A${R} ${R} 0 0 1 ${r(x + w)} ${r(y + R)}`,
    `L${r(x + w)} ${r(y + h - R)}`,
    `A${R} ${R} 0 0 1 ${r(x + w - R)} ${r(y + h)}`,
    `L${r(x + R)} ${r(y + h)}`,
    `A${R} ${R} 0 0 1 ${r(x)} ${r(y + h - R)}`,
    `L${r(x)} ${r(y + R)}`,
    `A${R} ${R} 0 0 1 ${r(x + R)} ${r(y)}`,
    'Z',
  ].join('');
}

function circleD(cx, cy, rad) {
  return (
    `M${r(cx + rad)} ${r(cy)}` +
    `A${rad} ${rad} 0 0 1 ${r(cx - rad)} ${r(cy)}` +
    `A${rad} ${rad} 0 0 1 ${r(cx + rad)} ${r(cy)}Z`
  );
}

/** Half-annulus struck from the stem's right edge. */
function bowlD(cy, outer, inner) {
  const x = STEM_W;
  return (
    `M${r(x)} ${r(cy - outer)}` +
    `A${outer} ${outer} 0 0 1 ${r(x)} ${r(cy + outer)}` +
    `L${r(x)} ${r(cy + inner)}` +
    `A${inner} ${inner} 0 0 0 ${r(x)} ${r(cy - inner)}` +
    'Z'
  );
}

const channelD = roundRectD(CHANNEL.x, CHANNEL.y, CHANNEL.w, CHANNEL.h, CHANNEL.w / 2);

const PARTS = {
  majorArc: { d: bowlD(GRID.h / 2, 60, 40), fill: FG },
  spine: { d: roundRectD(0, 0, STEM_W, GRID.h, 2.5) + channelD, fill: FG },
  minorArc: { d: bowlD(88, 29, 17), fill: FG },
  inlay: {
    d: channelD + BOLT_Y.map((y) => circleD(STEM_W / 2, y, BOLT_R)).join(''),
    fill: ACCENT,
  },
};

const ORDER = ['majorArc', 'spine', 'minorArc', 'inlay'];

function glyph(fg = FG, accent = ACCENT) {
  return ORDER.map((k) => {
    const p = PARTS[k];
    const fill = p.fill === ACCENT ? accent : fg;
    return `<path d="${p.d}" fill="${fill}" fill-rule="evenodd"/>`;
  }).join('');
}

function markSvg({ fg = FG, accent = ACCENT, bg = null, pad = 8 } = {}) {
  const square = Math.max(BOX.w, BOX.h) + pad * 2;
  const vb = `${r(BOX.x + BOX.w / 2 - square / 2)} ${r(BOX.y + BOX.h / 2 - square / 2)} ${r(square)} ${r(square)}`;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" role="img" aria-label="Dev Panchal">`,
    bg ? `<rect x="-500" y="-500" width="1000" height="1000" fill="${bg}"/>` : '',
    // Author Y-up, render Y-down: one flip for the whole mark.
    `<g transform="translate(0 ${r(BOX.y * 2 + BOX.h)}) scale(1 -1)">${glyph(fg, accent)}</g>`,
    '</svg>',
  ].join('');
}

function wordmarkSvg() {
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 124" role="img" aria-label="Dev Panchal">',
    `<g transform="translate(11 0)"><g transform="translate(0 ${r(BOX.y * 2 + BOX.h)}) scale(1 -1)">${glyph()}</g></g>`,
    `<text x="136" y="88" font-family="'Inter Tight','Helvetica Neue',Arial,sans-serif" font-size="74" font-weight="700" letter-spacing="-2.4" fill="${FG}">DEV PANCHAL</text>`,
    '</svg>',
  ].join('');
}

/* ── Drift check ──────────────────────────────────────────────────────────── */

async function assertInSyncWithSource() {
  const src = await readFile(path.join(ROOT, 'src', 'lib', 'mark', 'paths.ts'), 'utf8');
  const checks = [
    [`const STEM_W = ${STEM_W}`, 'STEM_W'],
    [`const BOLT_R = ${BOLT_R}`, 'BOLT_R'],
    [`const BOLT_Y = [${BOLT_Y.join(', ')}]`, 'BOLT_Y'],
    [
      `const CHANNEL = { x: ${CHANNEL.x}, y: ${CHANNEL.y}, w: ${CHANNEL.w}, h: ${CHANNEL.h} }`,
      'CHANNEL',
    ],
    ['bowl(GRID.h / 2, 60, 40)', 'major arc radii'],
    ['bowl(88, 29, 17)', 'minor arc radii'],
    [`w: ${BOX.w}, h: ${BOX.h}`, 'monogram box'],
  ];
  const drift = checks.filter(([needle]) => !src.includes(needle)).map(([, name]) => name);
  if (drift.length) {
    throw new Error(
      `Brand script has drifted from src/lib/mark/paths.ts: ${drift.join(', ')}.\n` +
        `Update scripts/generate-brand.mjs to match, then re-run.`,
    );
  }
}

/* ── Main ─────────────────────────────────────────────────────────────────── */

const png = async (svg, size, file, background) =>
  sharp(Buffer.from(svg))
    .resize(size, size, { fit: 'contain', background: background ?? { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toFile(path.join(OUT, file));

async function main() {
  await assertInSyncWithSource();
  await mkdir(OUT, { recursive: true });

  const mark = markSvg();
  const favicon = markSvg({ bg: BG, pad: 14 });

  await writeFile(path.join(OUT, 'mark.svg'), mark, 'utf8');
  await writeFile(path.join(OUT, 'wordmark.svg'), wordmarkSvg(), 'utf8');
  await writeFile(path.join(OUT, 'favicon.svg'), favicon, 'utf8');

  await png(favicon, 32, 'favicon-32.png');
  await png(favicon, 192, 'favicon-192.png');
  await png(favicon, 512, 'favicon-512.png');
  await png(favicon, 180, 'apple-touch-icon.png');

  // .ico for legacy crawlers and pinned tabs.
  await sharp(Buffer.from(favicon)).resize(48, 48).toFormat('png').toFile(path.join(OUT, 'favicon-48.png'));

  console.log('brand assets written to public/brand');
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
