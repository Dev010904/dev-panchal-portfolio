// ─────────────────────────────────────────────────────────────────────────────
// THE INSPECTION LENS — the engineering view under the cursor.
//
// A shared chunk, injected into every one of the mark's solid materials so all
// six parts branch identically. It is a chunk rather than a material because
// the parts use three different base materials (graphite, steel, ember) and the
// lens has to be one effect across all of them — a per-material copy would
// drift the moment anyone retuned one of them.
//
// Everything is authored in DESIGN-GRID units, the same 100x120 grid
// lib/mark/paths.ts uses. `uMarkGrid` carries the conversion, so this file
// contains no coordinate that also exists in paths.ts. Hardcoding the grid here
// would be the second source of numbers the identity is built to avoid.
// ─────────────────────────────────────────────────────────────────────────────

uniform vec2  uLensPos;      // lens centre, device pixels
uniform float uLensRadius;   // lens radius, device pixels
uniform float uLensEdge;     // soft boundary width, fraction of radius
uniform float uLensAmount;   // master 0..1 — damped, so it opens and closes
uniform float uLensRefract;  // radial warp at the rim
uniform vec3  uMarkGrid;     // (1 / MARK_SCALE, CENTER.x, CENTER.y)
uniform float uLensStep;     // construction-line spacing, grid units
uniform float uLensLineW;    // hairline half-width, grid units
uniform float uBoltX;        // bolt centreline, grid units
uniform vec3  uBoltY;        // the three bolt stations, grid units
uniform float uBoltRing;     // bolt axis ring radius, grid units
uniform vec4  uLensValues;   // (solid dim, grid, bolt, edge)
uniform float uLensRimValue;
uniform vec3  uLensTint;     // cold steel — the drawing's ink
uniform vec3  uLensAccent;   // ember — reserved for the bolt stations only

varying vec3 vMarkLocal;

// ── ANTIALIASING WIDTHS ARE PASSED IN, NEVER TAKEN HERE ──────────────────────
//
// These helpers used to call `fwidth` themselves. That put gradient
// instructions inside a loop that sits inside divergent control flow — the
// early-out in `applyLens` — and produced, on every compiled program that
// includes this chunk:
//
//   X3595: gradient instruction used in a loop with varying iteration;
//          partial derivatives may have undefined value
//
// It is a correctness warning, not a style one. A derivative is computed by
// differencing neighbouring fragments across a 2x2 quad, so it is only defined
// when all four lanes execute it. Once some lanes have taken an early return or
// a different loop count, the neighbours a lane differences against may never
// have run — the result is undefined and free to differ between GPUs.
//
// The fix is structural: every derivative is now taken exactly once in
// `applyLens`, in uniform control flow before any branch, and handed down.
//
// `fwidth` is still what makes a hairline survive at any DPR and any zoom — it
// asks how much a coordinate changes across one pixel and sizes the smoothstep
// to exactly that, so the line is one pixel wide whether the object fills the
// screen or sits 40px across. A fixed epsilon instead produces lines that
// shimmer when the object moves, which is the most common tell of a hand-rolled
// grid shader. None of that changes; only where the derivative is taken.

/** Antialiased repeating line. `aa` is the screen-space width of one pixel in x. */
float lensLine(float x, float step, float w, float aa) {
  float d = abs(mod(x + step * 0.5, step) - step * 0.5);
  return 1.0 - smoothstep(w - aa, w + aa, d);
}

/**
 * Antialiased ring.
 *
 * `fw` is the screen-space derivative of `p`. The derivative of `length(p - c)`
 * is recovered from it by the chain rule rather than by a second gradient
 * instruction: d(dist) = |d(p) . dir|, where `dir` is the unit vector from the
 * centre. Summing the two axis contributions with `dot(abs(dir), fw)` is the
 * same first-order estimate `fwidth(dist)` would have produced, and it is legal
 * inside a loop because it contains no gradient at all.
 */
float lensRing(vec2 p, vec2 c, float r, float w, vec2 fw) {
  vec2 delta = p - c;
  float dist = length(delta);
  float d = abs(dist - r);
  vec2 dir = delta / max(dist, 1e-5);
  float aa = dot(abs(dir), fw) * 0.8 + 1e-5;
  return 1.0 - smoothstep(w - aa, w + aa, d);
}

/** Centre-mark: the short cross a drawing puts through a drilled hole. */
float lensCross(vec2 p, vec2 c, float len, float w, float aa) {
  vec2 d = abs(p - c);
  float h = (1.0 - smoothstep(w - aa, w + aa, d.y)) * (1.0 - smoothstep(len, len + aa, d.x));
  float v = (1.0 - smoothstep(w - aa, w + aa, d.x)) * (1.0 - smoothstep(len, len + aa, d.y));
  return max(h, v);
}

/**
 * Lens coverage in screen space.
 *
 * `rim` is the band where the falloff is actually happening — high in the middle
 * of the transition, zero at both ends. A real lens bends light hardest at its
 * edge, so that band is where the warp and the highlight go. Deriving it from
 * the mask rather than declaring a second radius means the two can never
 * disagree about where the boundary is.
 */
float lensMask(vec2 frag, out float rim) {
  float r = length(frag - uLensPos) / max(uLensRadius, 1.0);
  float e = max(uLensEdge, 0.001);
  float m = 1.0 - smoothstep(1.0 - e, 1.0, r);
  rim = m * (1.0 - m) * 4.0;
  return m;
}

/**
 * The engineering view, composited over whatever the lit surface produced.
 *
 * The solid is DIMMED rather than removed. That is the difference between
 * seeing into an object and seeing a hole cut in one: at `uLensValues.x = 0`
 * the mark loses its mass inside the lens and the whole thing reads as a
 * cheap cutout.
 */
vec3 applyLens(vec3 lit, vec2 frag, float fresnel) {
  float rim;
  float mask = lensMask(frag, rim) * uLensAmount;

  // Object space -> design grid. The radial stretch at the rim is the
  // refraction: what is behind glass is displaced outward near its edge.
  vec2 g = vMarkLocal.xy * uMarkGrid.x + uMarkGrid.yz;
  g *= 1.0 + uLensRefract * rim * 3.0;

  // ── THE ONLY GRADIENT INSTRUCTION IN THIS CHUNK ────────────────────────────
  // Taken here, above the early-out and outside the loop below, so all four
  // lanes of every quad reach it. Everything downstream derives its
  // antialiasing width from this one value by arithmetic. Moving this line
  // below the branch, or letting a helper take its own `fwidth` again,
  // reintroduces X3595 and with it undefined behaviour that can render
  // differently across GPUs. See the note above the helpers.
  vec2 fw = fwidth(g);

  // Safe to leave now: no derivative is taken after this point.
  if (mask < 0.002) return lit;

  // Construction grid — the lines the part was actually drawn against.
  float grid = max(lensLine(g.x, uLensStep, uLensLineW, fw.x * 0.8 + 1e-5),
                   lensLine(g.y, uLensStep, uLensLineW, fw.y * 0.8 + 1e-5));

  // Bolt-hole axes. Ring plus centre-mark at each of the three stations.
  float bolt = 0.0;
  for (int i = 0; i < 3; i++) {
    vec2 c = vec2(uBoltX, uBoltY[i]);
    bolt = max(bolt, lensRing(g, c, uBoltRing, uLensLineW * 1.1, fw));
    bolt = max(bolt, lensCross(g, c, uBoltRing * 1.9, uLensLineW * 1.1, fw.x * 0.8 + 1e-5));
  }

  // Hidden edges. A grazing-angle term finds every chamfer boundary and every
  // internal counter the shading is otherwise smoothing over — which is exactly
  // the geometry a section view exists to show.
  float edge = smoothstep(0.55, 0.97, fresnel);

  vec3 ink = uLensTint * (grid * uLensValues.y + edge * uLensValues.w)
           + uLensAccent * bolt * uLensValues.z;

  // The rim highlight. Cold, narrow, and the last thing added, so it sits on
  // top of the drawing the way a bevelled glass edge catches the key light.
  ink += uLensTint * rim * uLensRimValue;

  return mix(lit, lit * uLensValues.x + ink, mask);
}
