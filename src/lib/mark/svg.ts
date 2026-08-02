import { MONOGRAM_BOX, PARTS, type Cmd, type Outline } from './paths';

/**
 * The flat mark. Same numbers as the 3D object — see paths.ts.
 *
 * Authored Y-up; SVG is Y-down. Rather than negating every coordinate (which
 * would also require flipping every arc sweep flag) the whole thing is emitted
 * inside one flip transform. One place to be wrong instead of forty.
 */

function arcTo(c: Extract<Cmd, { t: 'A' }>): string {
  const ccw = c.ccw !== false;
  const x0 = c.cx + Math.cos(c.a0) * c.r;
  const y0 = c.cy + Math.sin(c.a0) * c.r;
  const x1 = c.cx + Math.cos(c.a1) * c.r;
  const y1 = c.cy + Math.sin(c.a1) * c.r;

  let sweepAngle = c.a1 - c.a0;
  if (ccw && sweepAngle < 0) sweepAngle += Math.PI * 2;
  if (!ccw && sweepAngle > 0) sweepAngle -= Math.PI * 2;

  // A full revolution cannot be expressed as a single SVG arc — split it.
  if (Math.abs(sweepAngle) >= Math.PI * 2 - 1e-6) {
    const mx = c.cx - Math.cos(c.a0) * c.r;
    const my = c.cy - Math.sin(c.a0) * c.r;
    const f = ccw ? 1 : 0;
    return `A${c.r} ${c.r} 0 0 ${f} ${r(mx)} ${r(my)}A${c.r} ${c.r} 0 0 ${f} ${r(x0)} ${r(y0)}`;
  }

  const large = Math.abs(sweepAngle) > Math.PI ? 1 : 0;
  const sweep = ccw ? 1 : 0;
  return `${prefixMove(x0, y0)}A${c.r} ${c.r} 0 ${large} ${sweep} ${r(x1)} ${r(y1)}`;
}

// Arcs always continue from the current point; the explicit move is only
// emitted when the caller has not already placed the pen there.
let penX = NaN;
let penY = NaN;
function prefixMove(x: number, y: number): string {
  if (near(penX, x) && near(penY, y)) return '';
  return `L${r(x)} ${r(y)}`;
}
const near = (a: number, b: number) => Math.abs(a - b) < 1e-4;
const r = (n: number) => Number(n.toFixed(3)).toString();

function toPathD(cmds: Cmd[]): string {
  let d = '';
  penX = NaN;
  penY = NaN;
  for (const c of cmds) {
    switch (c.t) {
      case 'M':
        d += `M${r(c.x)} ${r(c.y)}`;
        penX = c.x;
        penY = c.y;
        break;
      case 'L':
        d += `L${r(c.x)} ${r(c.y)}`;
        penX = c.x;
        penY = c.y;
        break;
      case 'A': {
        d += arcTo(c);
        penX = c.cx + Math.cos(c.a1) * c.r;
        penY = c.cy + Math.sin(c.a1) * c.r;
        break;
      }
      case 'Z':
        d += 'Z';
        break;
    }
  }
  return d;
}

export function outlineToPathD(o: Outline): string {
  return [o.contour, ...(o.holes ?? [])].map(toPathD).join('');
}

/**
 * Parts that make up the resolved head-on monogram, back to front.
 * The shims are 3D-only — they exist to give the exploded view depth and
 * would just be a grey rectangle behind the mark in flat form.
 */
const FLAT_ORDER = ['major-arc', 'spine', 'minor-arc', 'inlay'];

export interface MarkSvgOptions {
  size?: number;
  /** Fill for the graphite parts. */
  fg?: string;
  /** Fill for the anodised keeper. */
  accent?: string;
  /** Emit an opaque background rect (favicons and OG need one). */
  bg?: string;
  /** Include width/height attrs. Omit for inline React use. */
  sized?: boolean;
}

export function markSvg(opts: MarkSvgOptions = {}): string {
  const { fg = '#F2F2F0', accent = '#FF5A1F', bg, sized = true } = opts;
  const b = MONOGRAM_BOX;
  const size = opts.size ?? 64;

  const body = FLAT_ORDER.map((id) => {
    const p = PARTS.find((x) => x.id === id)!;
    const fill = p.material === 'ember' ? accent : fg;
    return `<path d="${outlineToPathD(p.outline)}" fill="${fill}" fill-rule="evenodd"/>`;
  }).join('');

  const dims = sized ? ` width="${size}" height="${size}"` : '';
  const pad = 6;
  const vb = `${b.x - pad} ${b.y - pad} ${b.w + pad * 2} ${b.h + pad * 2}`;
  const square = Math.max(b.w, b.h) + pad * 2;
  const vbSquare = `${b.x + b.w / 2 - square / 2} ${b.y + b.h / 2 - square / 2} ${square} ${square}`;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg"${dims} viewBox="${vbSquare}" role="img" aria-label="Dev Panchal">`,
    bg ? `<rect x="-500" y="-500" width="1000" height="1000" fill="${bg}"/>` : '',
    // One flip for the whole mark: author Y-up, render Y-down.
    `<g transform="translate(0 ${b.y * 2 + b.h}) scale(1 -1)">${body}</g>`,
    `</svg>`,
  ].join('');
  void vb;
}

/** Mark + "DEV PANCHAL" set in a geometric grotesque, drawn as a lockup. */
export function wordmarkSvg(opts: { fg?: string; accent?: string } = {}): string {
  const { fg = '#F2F2F0', accent = '#FF5A1F' } = opts;
  const b = MONOGRAM_BOX;
  const glyph = FLAT_ORDER.map((id) => {
    const p = PARTS.find((x) => x.id === id)!;
    return `<path d="${outlineToPathD(p.outline)}" fill="${p.material === 'ember' ? accent : fg}" fill-rule="evenodd"/>`;
  }).join('');

  // Mark scaled to cap height, word set to its right on a shared baseline.
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 620 124" role="img" aria-label="Dev Panchal">`,
    `<g transform="translate(11 2) scale(1)">`,
    `<g transform="translate(0 ${b.y * 2 + b.h}) scale(1 -1)">${glyph}</g>`,
    `</g>`,
    `<text x="132" y="86" font-family="'Inter Tight','Helvetica Neue',Arial,sans-serif" font-size="72" font-weight="700" letter-spacing="-2.2" fill="${fg}">DEV PANCHAL</text>`,
    `</svg>`,
  ].join('');
}
