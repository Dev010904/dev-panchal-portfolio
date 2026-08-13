'use client';

import { useMemo } from 'react';

import { PRELOADER } from '@/config/animation';
import { GRID, PARTS, PINS } from '@/lib/mark/paths';
import { outlineToPathD } from '@/lib/mark/svg';

/**
 * THE CAD VIEWPORT — the preloader's technical drawing.
 *
 * Every outline in here is `outlineToPathD(part.outline)` off the SAME `PARTS`
 * array that `lib/mark/geometry.ts` extrudes into the 3D object. Nothing is
 * traced, approximated or re-authored, so the drawing that assembles during
 * the load and the object it resolves into are the same numbers. That is the
 * whole reason the handoff at the end reads as one thing solidifying rather
 * than as a picture being swapped for a model.
 *
 * THE WORDMARK IS A DATUM, NOT A CAPTION.
 *
 * "DEV PANCHAL" is set here, in the drawing's own coordinate space, as static
 * hairline type. It never animates. Its set width is FORCED to `wordWidth`
 * with `textLength`, which is what lets the dimension line beneath it be
 * correct by construction — the alternative is measuring a `getBBox()` after
 * fonts land, which is a layout read, a race, and a number that changes
 * between the first paint and the second.
 *
 * Its baseline and cap height are drawn as datums A and B, and the mark's
 * construction registers against them: the coordinate grid lands on the type's
 * left and right edges, and one leader runs from the assembly down to the
 * cap-height datum. A drawing whose dimensions do not resolve to anything is
 * decoration; these resolve to the type.
 *
 * ── HOW EACH THING IS REVEALED, AND WHY IT IS NOT ONE MECHANISM ────────────
 *
 * The obvious build is `pathLength="1"` plus an animated `stroke-dashoffset`
 * on everything — one uniform trick, no measuring. It does not work here, for
 * two independent reasons, and both were found by looking at the rendered
 * page rather than by reasoning about the spec:
 *
 *   1. `vector-effect: non-scaling-stroke` resolves the dash pattern in SCREEN
 *      space, which defeats the `pathLength` normalisation entirely. The
 *      computed style comes back as `stroke-dasharray: 1px` — a 1px-on,
 *      1px-off pattern on a 540-unit line, which reads as a solid line. Every
 *      element rendered fully drawn at progress 0.
 *   2. A dashed construction line needs `stroke-dasharray` for its APPEARANCE.
 *      It cannot also use it for its reveal; the second use silently destroys
 *      the first.
 *
 * So each kind of element gets the reveal that matches what it physically is,
 * which is also the more truthful drawing:
 *
 *   grid + datums      extend — `x2`/`y2` grows from the start point
 *   construction arcs  struck — `r` grows from 0, the way a compass works
 *   solid outlines     drawn — real `getTotalLength()` dashoffset
 *   control points     snap — `r` with a back ease, a discrete event
 *   labels             fade
 *
 * `getTotalLength()` is called once per solid element at mount, never per
 * frame, and only while the preloader is up and nothing else is competing.
 *
 * ── ELEMENT BUDGET — 46 drawn elements, held under 50 deliberately ──────────
 *
 * Oryzo's preloader, which this follows, is 43 SVG elements composited over
 * the canvas rather than shader work, because a preloader competes for the GPU
 * with the exact shader compilation it exists to cover. If this drawing ever
 * needs more elements to read, the drawing is too complicated — simplify the
 * drawing, do not raise the cap. `__qa.cad()` reports the live count so the
 * budget is checkable rather than aspirational.
 */

const C = PRELOADER.cad;

/** Drawing sheet, in viewBox units. */
export const VB = { w: 1000, h: 620 } as const;

/** The wordmark, and therefore the datums. */
const WORD = { x: 62, baseline: 545, size: 104, width: C.wordWidth } as const;
const CAP_Y = WORD.baseline - WORD.size * C.capRatio;
const WORD_RIGHT = WORD.x + WORD.width;

/** Where the mark's 100x120 design grid sits on the sheet, and at what scale. */
const M = { x: 636, y: 96, scale: 2.35 } as const;

/** Design-grid (Y-up) -> sheet (Y-down). */
const mx = (gx: number) => M.x + gx * M.scale;
const my = (gy: number) => M.y + (GRID.h - gy) * M.scale;

const n = (v: number) => Number(v.toFixed(2));

/**
 * A dimension line with its two end ticks, as ONE path. Three elements per
 * dimension is how a 46-element budget becomes a 120-element one.
 */
function dimH(x0: number, x1: number, y: number, tick = 6): string {
  return `M${n(x0)} ${n(y - tick)}L${n(x0)} ${n(y + tick)}M${n(x0)} ${n(y)}L${n(x1)} ${n(y)}M${n(x1)} ${n(y - tick)}L${n(x1)} ${n(y + tick)}`;
}
function dimV(y0: number, y1: number, x: number, tick = 6): string {
  return `M${n(x - tick)} ${n(y0)}L${n(x + tick)} ${n(y0)}M${n(x)} ${n(y0)}L${n(x)} ${n(y1)}M${n(x - tick)} ${n(y1)}L${n(x + tick)} ${n(y1)}`;
}
/** A bolt-hole axis: two crossed centre lines, one path. */
function crosshair(cx: number, cy: number, r: number): string {
  return `M${n(cx - r)} ${n(cy)}L${n(cx + r)} ${n(cy)}M${n(cx)} ${n(cy - r)}L${n(cx)} ${n(cy + r)}`;
}

const part = (id: string) => PARTS.find((p) => p.id === id)!;

/** 4 verticals, each registering against something real: the type's left edge,
 *  a sheet third, the mark's left edge, the type's right edge. */
const GRID_V = [WORD.x, 350, M.x, WORD_RIGHT];
/** 2 horizontals, on the mark's own extents. */
const GRID_H = [my(GRID.h), my(0)];

/** The six parts, back to front, exactly as `svg.ts` orders the flat mark. */
const OUTLINES = ['shim-b', 'shim-a', 'major-arc', 'spine', 'minor-arc', 'inlay'].map((id) => ({
  id,
  d: outlineToPathD(part(id).outline),
  ember: part(id).material === 'ember',
}));

/**
 * The bowls' true circles. The single most "construction drawing" thing here:
 * the arcs in the mark are struck from these, and showing the whole circle is
 * how a drawing says where an arc came from.
 */
const CIRCLES = [
  { cx: 22, cy: 60, r: 60 },
  { cx: 22, cy: 60, r: 40 },
  { cx: 22, cy: 88, r: 29 },
  { cx: 22, cy: 88, r: 17 },
];

/** Control points on real vertices and arc extremes. */
const POINTS = [
  [0, 0],
  [22, 120],
  [82, 60],
  [51, 88],
  [22, 60],
  [22, 88],
];

/** Dimensions. Two measure the mark, two measure the type, one is a radius. */
const DIMS = [
  { d: dimV(my(GRID.h), my(0), mx(0) - 30), label: '120', lx: mx(0) - 38, ly: (my(GRID.h) + my(0)) / 2, rot: -90 },
  { d: dimH(mx(0), mx(22), my(0) + 28), label: '22', lx: (mx(0) + mx(22)) / 2, ly: my(0) + 20, rot: 0 },
  {
    d: `M${n(mx(22))} ${n(my(60))}L${n(mx(22 + 60 * Math.cos(Math.PI / 6)))} ${n(my(60 + 60 * Math.sin(Math.PI / 6)))}L${n(mx(96))} ${n(my(96))}`,
    label: 'R60',
    lx: mx(99),
    ly: my(96) - 6,
    rot: 0,
  },
  { d: dimH(WORD.x, WORD_RIGHT, WORD.baseline + 34), label: String(C.wordWidth), lx: (WORD.x + WORD_RIGHT) / 2, ly: WORD.baseline + 26, rot: 0 },
  { d: dimV(CAP_Y, WORD.baseline, WORD.x - 26), label: `CAP ${n(WORD.size * C.capRatio)}`, lx: WORD.x - 34, ly: (CAP_Y + WORD.baseline) / 2, rot: -90 },
];

/** The leader tying the assembly to the type. Ends pointing at datum B. */
const LEADER_D = `M${n(mx(4))} ${n(my(6))}L${n(470)} ${n(452)}L${n(WORD.x + 34)} ${n(452)}L${n(WORD.x + 34)} ${n(CAP_Y - 5)}`;

/** Shared by every stroked construction element. */
const HAIR = { fill: 'none', className: 'cad-line' } as const;

export function CadViewport() {
  // The mark's own transform: author Y-up, render Y-down. One flip for the
  // whole assembly, exactly as lib/mark/svg.ts does it.
  const flip = useMemo(
    () => `translate(${M.x} ${M.y}) scale(${M.scale}) translate(0 ${GRID.h}) scale(1 -1)`,
    [],
  );

  return (
    <svg
      className="cad-sheet absolute inset-0 h-full w-full"
      viewBox={`0 0 ${VB.w} ${VB.h}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      data-cad-root
    >
      {/* Sheet frame. */}
      <rect data-cad-draw data-cad-frame x={28} y={28} width={VB.w - 56} height={VB.h - 56} {...HAIR} stroke="var(--color-rule)" />

      {/* Coordinate grid — extends from the top/left. */}
      {GRID_V.map((x) => (
        <line key={`gv${x}`} data-cad-grid data-grow="y2" data-from="y1" x1={x} y1={40} x2={x} y2={VB.h - 40} {...HAIR} stroke="var(--color-rule)" />
      ))}
      {GRID_H.map((y) => (
        <line key={`gh${y}`} data-cad-grid data-grow="x2" data-from="x1" x1={40} y1={y} x2={VB.w - 40} y2={y} {...HAIR} stroke="var(--color-rule)" />
      ))}

      {/* Datums A (baseline) and B (cap height) — the type's own geometry.
          Dashed, so they cannot use dasharray for their reveal; they extend. */}
      <line data-cad-datum data-grow="x2" data-from="x1" x1={40} y1={WORD.baseline} x2={VB.w - 40} y2={WORD.baseline} {...HAIR} strokeDasharray="9 6" stroke="var(--color-fg-dim)" />
      <line data-cad-datum data-grow="x2" data-from="x1" x1={40} y1={CAP_Y} x2={VB.w - 40} y2={CAP_Y} {...HAIR} strokeDasharray="9 6" stroke="var(--color-fg-dim)" />
      <text data-cad-datum-label className="cad-t" x={VB.w - 44} y={WORD.baseline - 9} textAnchor="end">DATUM A · BASELINE</text>
      <text data-cad-datum-label className="cad-t" x={VB.w - 44} y={CAP_Y - 9} textAnchor="end">DATUM B · CAP</text>

      {/* ── THE WORDMARK. Static from frame one. Never animated. ──────────
          `textLength` forces the set width so the dimension below it is right
          by construction rather than by measuring a font that may not have
          arrived. `lengthAdjust="spacing"` moves the letters, never the
          glyph shapes. */}
      <text
        className="cad-word"
        x={WORD.x}
        y={WORD.baseline}
        fontSize={WORD.size}
        textLength={WORD.width}
        lengthAdjust="spacing"
      >
        DEV PANCHAL
      </text>

      {/* ── The assembly ─────────────────────────────────────────────────── */}
      {/* The assembly carries a 2.35x scale, so every hairline inside it
          divides through by that to stay the same optical weight as the sheet.
          See the note on `--cad-scale` in globals.css. */}
      <g transform={flip} style={{ ['--cad-scale' as string]: M.scale }}>
        {/* Construction circles the bowls are struck from. `r` grows from 0 —
            a compass, not a sweep. Dash pattern is in grid units, so it is
            divided by the group scale to land at the same optical rhythm as
            the datums above. */}
        {CIRCLES.map((c, i) => (
          <circle key={`c${i}`} data-cad-circle data-r={c.r} cx={c.cx} cy={c.cy} r={c.r} {...HAIR} strokeDasharray="3.4 2.6" stroke="var(--color-rule)" />
        ))}

        {/* Bolt-hole axes. */}
        {PINS.positions.map(([px, py], i) => (
          <path key={`b${i}`} data-cad-draw data-cad-bolt d={crosshair(px, py, 7)} {...HAIR} stroke="var(--color-rule)" />
        ))}

        {/* The parts. One ember accent; everything else hairline. */}
        {OUTLINES.map((o) => (
          <path
            key={o.id}
            data-cad-draw
            data-cad-outline
            d={o.d}
            fillRule="evenodd"
            {...HAIR}
            fill={o.ember ? 'var(--color-accent)' : 'var(--color-fg)'}
            fillOpacity={0}
            stroke={o.ember ? 'var(--color-accent)' : 'var(--color-fg)'}
          />
        ))}

        {/* Control points, on real vertices. */}
        {POINTS.map(([px, py], i) => (
          <circle key={`p${i}`} data-cad-point className="cad-line" cx={px} cy={py} r={0} fill="none" stroke="var(--color-fg)" />
        ))}
      </g>

      {/* Dimensions and their labels. */}
      {DIMS.map((d, i) => (
        <path key={`d${i}`} data-cad-draw data-cad-dim d={d.d} {...HAIR} stroke="var(--color-rule)" />
      ))}
      {DIMS.map((d, i) => (
        <text
          key={`dl${i}`}
          data-cad-dim-label
          className="cad-t"
          x={d.lx}
          y={d.ly}
          textAnchor="middle"
          transform={d.rot ? `rotate(${d.rot} ${n(d.lx)} ${n(d.ly)})` : undefined}
        >
          {d.label}
        </text>
      ))}

      {/* The leader tying the assembly to the type. */}
      <path data-cad-draw data-cad-leader d={LEADER_D} {...HAIR} stroke="var(--color-rule)" />
      <text data-cad-leader-label className="cad-t" x={480} y={446}>SET FROM DATUM B</text>

      {/* Title block. */}
      <line data-cad-draw data-cad-title-rule x1={700} y1={86} x2={VB.w - 40} y2={86} {...HAIR} stroke="var(--color-rule)" />
      <text data-cad-title className="cad-t" x={VB.w - 40} y={70} textAnchor="end">DP—01 · THE INSTRUMENT</text>
      <text data-cad-title className="cad-t" x={VB.w - 40} y={104} textAnchor="end">
        GRID {GRID.w}×{GRID.h} · SCALE {M.scale}:1
      </text>
    </svg>
  );
}
