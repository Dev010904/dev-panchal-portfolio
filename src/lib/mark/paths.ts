/**
 * DP-01 — "THE INSTRUMENT"
 * ---------------------------------------------------------------------------
 * The single source of truth for Dev Panchal's mark.
 *
 * Everything is authored ONCE here as 2D outlines in a 100x120 design grid,
 * Y-up, origin bottom-left. Two consumers read this file and nothing else:
 *
 *   lib/mark/geometry.ts -> THREE.Shape -> ExtrudeGeometry   (the 3D object)
 *   lib/mark/svg.ts      -> SVG path `d` strings             (nav mark, favicon, OG)
 *
 * That is why the flat logo and the hero object can never drift apart: they are
 * the same numbers. See /docs/IDENTITY.md.
 *
 * THE IDEA
 * D and P are the same letter twice: a vertical stem carrying a bowl. D's bowl
 * runs the full height; P's bowl runs the top half. So one stem + two bowls IS
 * "DP" — not a trick, a ligature. The two bowls sit at different Z depths, so
 * head-on they resolve into a monogram and from any other angle they separate
 * into an abstract instrument of arcs floating off a machined rail.
 */

export const GRID = { w: 100, h: 120 } as const;

/** Stem occupies x:[0,22]. Both bowls are struck from its right edge. */
const STEM_W = 22;

export type Cmd =
  | { t: 'M'; x: number; y: number }
  | { t: 'L'; x: number; y: number }
  /** Absolute arc, angles in radians, CCW unless `ccw:false`. */
  | { t: 'A'; cx: number; cy: number; r: number; a0: number; a1: number; ccw?: boolean }
  | { t: 'Z' };

export interface Outline {
  /** Outer contour. */
  contour: Cmd[];
  /** Punched holes (through-features). */
  holes?: Cmd[][];
}

export interface PartSpec {
  id: string;
  /** Monospace annotation shown in the Deconstruction sequence. */
  label: string;
  /** Index shown as `0N` alongside the label. */
  index: number;
  outline: Outline;
  /** Extrusion depth in grid units. */
  depth: number;
  /** Z position of the extrusion's near face, grid units. */
  z: number;
  /** Chamfer size in grid units. This is what catches the rim light. */
  bevel: number;
  /** Material key, resolved in scenes/materials.ts */
  material: 'graphite' | 'steel' | 'ember';
  /**
   * Unit vector the part travels along when the assembly explodes.
   * Every part leaves along the axis it seats on — never straight at camera.
   */
  explode: [number, number, number];
  /** Explode distance multiplier, relative to the base distance in the config. */
  explodeScale: number;
}

const TAU = Math.PI * 2;
const deg = (d: number) => (d * Math.PI) / 180;

/** Rounded-rectangle contour, authored CCW. */
function roundRect(x: number, y: number, w: number, h: number, r: number): Cmd[] {
  return [
    { t: 'M', x: x + r, y },
    { t: 'L', x: x + w - r, y },
    { t: 'A', cx: x + w - r, cy: y + r, r, a0: deg(-90), a1: 0 },
    { t: 'L', x: x + w, y: y + h - r },
    { t: 'A', cx: x + w - r, cy: y + h - r, r, a0: 0, a1: deg(90) },
    { t: 'L', x: x + r, y: y + h },
    { t: 'A', cx: x + r, cy: y + h - r, r, a0: deg(90), a1: deg(180) },
    { t: 'L', x, y: y + r },
    { t: 'A', cx: x + r, cy: y + r, r, a0: deg(180), a1: deg(270) },
    { t: 'Z' },
  ];
}

function circle(cx: number, cy: number, r: number): Cmd[] {
  return [
    { t: 'M', x: cx + r, y: cy },
    { t: 'A', cx, cy, r, a0: 0, a1: TAU },
    { t: 'Z' },
  ];
}

/**
 * Half-annulus struck from the stem's right edge — the bowl of a D or a P.
 * Sweeps the right half (-90deg to +90deg) so it always closes flat against
 * the stem, which is what makes the letterform read.
 */
function bowl(cy: number, outer: number, inner: number): Cmd[] {
  const x = STEM_W;
  return [
    { t: 'M', x, y: cy - outer },
    { t: 'A', cx: x, cy, r: outer, a0: deg(-90), a1: deg(90) },
    { t: 'L', x, y: cy + inner },
    { t: 'A', cx: x, cy, r: inner, a0: deg(90), a1: deg(-90), ccw: false },
    { t: 'Z' },
  ];
}

/* ── 01 SPINE ────────────────────────────────────────────────────────────────
   The shared stem. A solid machined rail with a channel milled down its face;
   the anodised inlay (04) drops into that channel.

   An earlier version put a four-hole bolt pattern down the centreline instead.
   It read as polka dots at any size below about 200px and made the mark look
   playful, which is the one thing it must not be. A single continuous channel
   does the same "this is a machined part" job and gets stronger as it scales
   down rather than weaker. */
const CHANNEL = { x: 8.5, y: 9, w: 5, h: 102 } as const;
/**
 * Bolt-hole radius. Deliberately small relative to the 5-unit channel: at 2.15
 * the holes were nearly as wide as the inlay strip they sit in, so they read as
 * three dots punched through the accent rather than as hardware, and they broke
 * the one continuous line of colour on the object.
 */
const BOLT_R = 1.3;
const BOLT_Y = [26, 60, 94] as const;

const spine: PartSpec = {
  id: 'spine',
  label: 'SPINE',
  index: 1,
  depth: 14,
  z: -7,
  bevel: 1.4,
  material: 'graphite',
  explode: [-1, 0, 0],
  explodeScale: 0.55,
  outline: {
    contour: roundRect(0, 0, STEM_W, GRID.h, 2.5),
    holes: [roundRect(CHANNEL.x, CHANNEL.y, CHANNEL.w, CHANNEL.h, CHANNEL.w / 2)],
  },
};

/* ── 02 MAJOR ARC ────────────────────────────────────────────────────────────
   Full-height bowl. Stem + this = D. Sits furthest back. */
const majorArc: PartSpec = {
  id: 'major-arc',
  label: 'MAJOR ARC',
  index: 2,
  depth: 10,
  z: -14,
  bevel: 1.2,
  material: 'graphite',
  explode: [0.82, -0.57, 0],
  explodeScale: 1.0,
  outline: { contour: bowl(GRID.h / 2, 60, 40) },
};

/* ── 03 MINOR ARC ────────────────────────────────────────────────────────────
   Top-half bowl. Stem + this = P. Sits forward, inside the major arc's
   counter with 8 units of clearance — that gap is the whole reveal. */
const minorArc: PartSpec = {
  id: 'minor-arc',
  label: 'MINOR ARC',
  index: 3,
  depth: 8,
  z: 5,
  bevel: 1.1,
  material: 'graphite',
  explode: [0.74, 0.67, 0.1],
  explodeScale: 0.86,
  outline: { contour: bowl(88, 29, 17) },
};

/* ── 04 SHIM PLATES ──────────────────────────────────────────────────────────
   Two thin backing straps behind the spine. Structurally they do nothing;
   optically they give the rim light two more edges to trace and the exploded
   view its depth.

   They were originally large plates (74x56 and 58x54) and it was a mistake:
   at hero size they read as separate rectangular objects floating behind the
   mark, and the eye went to them instead of to the monogram. Narrow straps
   sized to the spine support the object rather than competing with it. */
const shimA: PartSpec = {
  id: 'shim-a',
  label: 'SHIM · A',
  index: 4,
  depth: 1.6,
  z: -20,
  bevel: 0.5,
  material: 'steel',
  explode: [-0.35, -0.55, -0.76],
  explodeScale: 1.35,
  outline: { contour: roundRect(-5, 12, 32, 30, 2.5) },
};

const shimB: PartSpec = {
  id: 'shim-b',
  label: 'SHIM · B',
  index: 4,
  depth: 1.6,
  z: -24,
  bevel: 0.5,
  material: 'steel',
  explode: [-0.5, 0.45, -0.74],
  explodeScale: 1.6,
  outline: { contour: roundRect(-8, 74, 28, 30, 2.5) },
};

/* ── 05 INLAY ────────────────────────────────────────────────────────────────
   The one anodised part: an ember strip seated in the spine's channel, drilled
   for the locating pins. It is the mark's single accent and its only warm
   value — one thin line of colour running the full height of a near-black
   object. Everything else in the identity is graphite. */
const inlay: PartSpec = {
  id: 'inlay',
  label: 'INLAY · ANODISED',
  index: 5,
  depth: 16,
  z: -8,
  bevel: 0.55,
  material: 'ember',
  explode: [-0.42, 0, 0.9],
  explodeScale: 1.05,
  outline: {
    contour: roundRect(CHANNEL.x, CHANNEL.y, CHANNEL.w, CHANNEL.h, CHANNEL.w / 2),
    holes: BOLT_Y.map((y) => circle(STEM_W / 2, y, BOLT_R)),
  },
};

export const PARTS: PartSpec[] = [spine, majorArc, minorArc, shimA, shimB, inlay];

/**
 * 06 LOCATING PINS — instanced cylinders through the inlay's drilled holes.
 * Not an outline: primitives, so they stay cheap and read as hardware.
 */
export const PINS = {
  id: 'pins',
  label: 'LOCATING PINS',
  index: 6,
  radius: BOLT_R * 0.78,
  length: 26,
  positions: BOLT_Y.map((y) => [STEM_W / 2, y] as [number, number]),
  explode: [0, 0, 1] as [number, number, number],
  explodeScale: 1.9,
};

/** Design-grid centre. Geometry is translated by this so the mark spins true. */
export const CENTER: [number, number] = [41, GRID.h / 2];

/** Grid units -> world units. Mark ends up ~2 world units tall. */
export const MARK_SCALE = 1 / 60;

/** Bounds of the resolved monogram, used to frame SVG/favicon exports. */
export const MONOGRAM_BOX = { x: -11, y: -2, w: 105, h: 124 } as const;
