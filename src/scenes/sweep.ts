import * as THREE from 'three';

import { SWEEP } from '@/config/animation';

/**
 * SWEEP-LINE PROXIMITY — the measurement half of the discharge.
 *
 * Split out of SweepLines.tsx for one reason that is not tidiness: the QA
 * harness has to be able to ask "how far is the cursor from this line, and would
 * that arm it?" and get the answer from *the same code that actually arms it*.
 * A harness with its own copy of the distance maths can agree with the renderer
 * on every test and still be measuring something else — which is precisely how
 * the previous version's proximity bug survived being looked at.
 *
 * WHAT WAS WRONG BEFORE
 * The old test projected 17 vertices spread across the middle half of a
 * 128-segment curve and took the distance to the nearest *vertex*. At hero
 * framing those probes land roughly 190 CSS px apart, so the armed region was 17
 * discs of radius 80px with 190px between their centres. That produces both
 * reported symptoms at once, from one cause:
 *
 *   - Cursor exactly on the stroke, midway between two probes: nearest vertex is
 *     ~95px away, over the 80px threshold, nothing fires.
 *   - Cursor 79px clear of the stroke but beside a probe: fires.
 *
 * The fix is to measure to the SEGMENTS, not the vertices. Point-to-segment
 * distance across the projected polyline is exact for a straight edge and the
 * curve is finely sampled enough that the residual error is far below a pixel.
 * Once the measurement is right the threshold can come down to something that
 * matches the visible stroke instead of compensating for sampling error.
 */

/** Vertices either side of centre that can plausibly be on screen. */
const SPAN = SWEEP.segments / 4;
/** First and last vertex index of the tested run. */
export const FIRST = SWEEP.segments / 2 - SPAN;
export const LAST = SWEEP.segments / 2 + SPAN;
/** Screen-space points held per line. */
export const PROBES = LAST - FIRST + 1;

/**
 * One line's projected polyline, in CSS pixels.
 *
 * `ok` marks which entries are usable. A vertex behind the camera projects to
 * nonsense — `project()` divides by w, and w flips sign across the near plane —
 * so a segment is only tested when BOTH its endpoints are in front. At the
 * frustum edge that discards a partial segment rather than testing a garbage
 * one, which is the correct trade: a missed strike at the very edge of the
 * screen is invisible, a spurious one at a wild coordinate is not.
 */
export interface LineScreen {
  id: string;
  xy: Float32Array;
  ok: Uint8Array;
}

export const sweepScreen: LineScreen[] = SWEEP.lines.map((l) => ({
  id: l.id,
  xy: new Float32Array(PROBES * 2),
  ok: new Uint8Array(PROBES),
}));

const _v = new THREE.Vector3();

/**
 * Project one line's tested run into `sweepScreen[index]`.
 *
 * Allocates nothing. Called once per line per frame, so 3 × 65 = 195 projections
 * a frame for the whole set — a mat4 multiply and a divide each, which is
 * comfortably inside the budget and buys an exact answer.
 */
export function projectLine(
  index: number,
  points: Float32Array,
  matrixWorld: THREE.Matrix4,
  camera: THREE.Camera,
  width: number,
  height: number,
) {
  const dst = sweepScreen[index];
  for (let i = 0; i < PROBES; i++) {
    _v.fromArray(points, (FIRST + i) * 3).applyMatrix4(matrixWorld);
    // View-space Z is the honest in-front test. NDC z is already the result of
    // the w-divide, so a point behind the camera can land inside -1..1 and read
    // as visible — the old code's `z < -1 || z > 1` check let exactly that
    // through.
    _v.project(camera);
    const behind = _v.z < -1 || _v.z > 1;
    dst.ok[i] = behind ? 0 : 1;
    dst.xy[i * 2] = (_v.x * 0.5 + 0.5) * width;
    dst.xy[i * 2 + 1] = (1 - (_v.y * 0.5 + 0.5)) * height;
  }
}

/**
 * Squared distance from a point to a segment, both in CSS pixels.
 *
 * Squared throughout and rooted once by the caller — a `Math.hypot` per segment
 * is 64 square roots per line per frame for a value only ever used in a
 * comparison.
 */
function segDistSq(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const vx = bx - ax;
  const vy = by - ay;
  const wx = px - ax;
  const wy = py - ay;
  const len = vx * vx + vy * vy;
  // A degenerate segment is a point. Guarding this is not defensive
  // programming: consecutive vertices coincide on screen whenever the line is
  // nearly edge-on to the camera, which happens every rotation cycle.
  if (len < 1e-9) return wx * wx + wy * wy;
  let t = (wx * vx + wy * vy) / len;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const dx = wx - vx * t;
  const dy = wy - vy * t;
  return dx * dx + dy * dy;
}

export interface Nearest {
  /** CSS pixels to the nearest point ON the stroke. Infinity if none testable. */
  distance: number;
  /** Vertex index of the segment start, in the ORIGINAL curve's indexing. */
  index: number;
}

const _nearest: Nearest = { distance: Infinity, index: -1 };

/**
 * Nearest approach from a cursor position to one projected line.
 *
 * Returns a shared object — the caller must read it before the next call. That
 * is deliberate: this runs three times a frame forever, and returning a fresh
 * `{distance, index}` would be three garbage objects per frame, which is the
 * per-frame-allocation pattern the smoothness pass exists to remove.
 */
export function nearestOnLine(index: number, cx: number, cy: number): Nearest {
  const { xy, ok } = sweepScreen[index];
  let best = Infinity;
  let bestSeg = -1;

  for (let i = 0; i < PROBES - 1; i++) {
    if (!ok[i] || !ok[i + 1]) continue;
    const d = segDistSq(cx, cy, xy[i * 2], xy[i * 2 + 1], xy[(i + 1) * 2], xy[(i + 1) * 2 + 1]);
    if (d < best) {
      best = d;
      bestSeg = i;
    }
  }

  _nearest.distance = bestSeg < 0 ? Infinity : Math.sqrt(best);
  // Back to the curve's own indexing so the caller can read tangents from the
  // source points array.
  _nearest.index = bestSeg < 0 ? -1 : FIRST + bestSeg;
  return _nearest;
}

/**
 * Live arming state, exposed so the QA harness can assert against the renderer's
 * actual decision rather than re-deriving it.
 */
export const sweepDebug = {
  /** Per-line: is the cursor currently inside the arming region? */
  inside: SWEEP.lines.map(() => false),
  /** Per-line: last measured distance in CSS px. */
  distance: SWEEP.lines.map(() => Infinity),
  /** Set true once the first frame of measurement has run. */
  measured: false,
};
