precision highp float;

/**
 * THE FOOTER FIELD.
 * ---------------------------------------------------------------------------
 *
 * A near-black plate carrying sparse dashed rules in irregular column groups,
 * with a very soft haze drifting behind them.
 *
 * This replaced a dense perspective rule grid. That version was technically
 * more interesting — a real deformable surface with an inverse-square cursor
 * well and travelling ripples — and it was the wrong answer, because at the
 * bottom of a page you want quiet. Rendered out it read as a grey thread mass:
 * heavy, noisy, and easy to mistake for a rendering fault.
 *
 * WHAT MAKES THIS READ AS EXPENSIVE RATHER THAN AS A GRID
 * The irregularity, and nothing else. Every column has its own row rhythm, its
 * own vertical phase, and its own dash frequency; every rule within a column
 * has its own width and its own start offset. Nothing lines up with anything.
 * A uniform dashed grid at the same opacity reads instantly as graph paper —
 * the eye locks onto the repeat and the whole thing flattens.
 *
 * All of it is hashed from the column and row indices, so it is stable frame to
 * frame, costs no memory, and cannot drift.
 */

out vec4 fragColor;

varying vec2 vUv;

uniform float uTime;
uniform vec2  uRes;
uniform vec2  uPointer;      // 0..1, already smoothed on the CPU
uniform float uPresence;     // 0..1 — how far into view the footer is
uniform float uHover;        // 0..1 — pointer is low enough to matter
uniform float uColumns;
uniform vec2  uRows;         // min/max rows per column
uniform vec2  uDashes;       // min/max dash frequency along a rule
uniform vec2  uDuty;         // min/max inked fraction of a dash cell
uniform float uOpacity;
uniform float uHazeScale;
uniform float uHazeSpeed;
uniform float uHazeStrength;
uniform float uCloudScale;
uniform float uCloudSpeed;
uniform float uCloudStrength;
uniform float uBreath;      // 0..1 slow ambient pulse, computed on the CPU
uniform float uCursorRadius;
uniform float uCursorDisplace;
uniform vec3  uColor;

#include <noise>

/** Cheap stable scalar hash. Used only for layout, never for shading. */
float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}

void main() {
  vec2 uv = vUv;
  float aspect = uRes.x / uRes.y;

  // ── Cursor influence ─────────────────────────────────────────────────────
  // A gentle local lift, not a well. The rules bend toward the pointer over a
  // soft radius and that is the entire interaction — anything with more
  // authority than this fights the stillness the section is built on.
  vec2 p = vec2(uv.x * aspect, uv.y);
  vec2 c = vec2(uPointer.x * aspect, uPointer.y);
  vec2 d = p - c;
  float falloff = exp(-dot(d, d) / max(uCursorRadius * uCursorRadius, 1e-4));
  float bend = falloff * uHover;

  // Displace vertically, signed by which side of the cursor we are on, so the
  // rules part around it rather than all sliding the same way.
  uv.y += bend * uCursorDisplace * sign(d.y + 1e-5);

  // ── Columns ──────────────────────────────────────────────────────────────
  float colF = uv.x * uColumns;
  float col = floor(colF);
  float colLocal = fract(colF);

  // Per-column vertical rhythm and phase. Two different hashes so a column
  // that is dense is not also always high, which would correlate the two and
  // put a visible pattern back in.
  float rows = mix(uRows.x, uRows.y, hash11(col * 12.9898 + 3.1));
  float phase = hash11(col * 78.233 + 7.7);

  float rowF = (uv.y + phase) * rows;
  float row = floor(rowF);
  float rowLocal = fract(rowF);

  // ── One rule ─────────────────────────────────────────────────────────────
  float seed = col * 31.7 + row * 3.37;

  // Antialiased hairline. fwidth is core in ESSL3 — under three's default
  // ESSL1 this silently fails to compile and the whole pass renders nothing,
  // which is why every material here is created with glslVersion: GLSL3.
  float rw = fwidth(rowF);
  float line = 1.0 - smoothstep(0.0, rw * 1.4, abs(rowLocal - 0.5));

  // Each rule spans only part of its column, starting at its own offset. This
  // is what produces the loose stacks of differing widths.
  float width = mix(0.22, 0.94, hash11(seed * 1.13));
  float start = (1.0 - width) * hash11(seed * 2.71 + 5.0);
  float inRule =
    smoothstep(0.0, 0.01, colLocal - start) *
    smoothstep(0.0, 0.01, start + width - colLocal);

  // Dashes: own frequency, own phase, own duty cycle per rule.
  float freq = mix(uDashes.x, uDashes.y, hash11(seed * 3.91));
  float duty = mix(uDuty.x, uDuty.y, hash11(seed * 4.57 + 1.0));
  float dashF = colLocal * freq + hash11(seed * 5.23) * 10.0;
  float dashLocal = fract(dashF);
  float dw = fwidth(dashF);
  float dash =
    smoothstep(0.0, dw * 1.5, dashLocal) *
    smoothstep(0.0, dw * 1.5, duty - dashLocal);

  // Some rules are simply absent. Gaps in the stack matter as much as the
  // rules do — a full stack in every column is a grid again.
  float present = step(0.28, hash11(seed * 6.61 + 2.0));

  float rules = line * inRule * dash * present;

  // ── Haze ─────────────────────────────────────────────────────────────────
  // Low frequency, low contrast, slow. It should never be identifiable as
  // cloud — it exists to keep the plate from being a flat black rectangle and
  // to dither the banding that a near-black gradient always produces.
  vec2 hp = vec2(uv.x * aspect, uv.y) * uHazeScale;
  float haze = fbm(hp + vec2(uTime * uHazeSpeed, uTime * uHazeSpeed * 0.55), 3);
  haze = haze * 0.5 + 0.5;

  // ── Volumetric cloud ─────────────────────────────────────────────────────
  // A second, far larger and far slower noise layer sitting behind the rules.
  //
  // This is the layer that gives the footer depth. Without it the rules sit on
  // flat black and the whole section reads as thin no matter how well the rules
  // themselves are tuned — you notice the emptiness before you notice anything
  // else. The reference's equivalent is almost subliminal: you read the depth
  // before you can point at the fog making it.
  //
  // Kept to two octaves at a very large scale, then pushed through a hard
  // smoothstep so most of the frame stays at zero and only a few soft masses
  // ever lift off the black. A third octave here turns it into visible smoke.
  vec2 cp = vec2(uv.x * aspect, uv.y) * uCloudScale;
  float cloud = fbm(cp + vec2(uTime * uCloudSpeed, uTime * uCloudSpeed * 0.42), 2);
  cloud = smoothstep(0.05, 0.85, cloud * 0.5 + 0.5);

  // ── Composite ────────────────────────────────────────────────────────────
  // The field fades out toward the top so it sits under the type rather than
  // behind all of it, and never shows a hard edge anywhere. The reference
  // keeps its rules well below the contact block; carrying them all the way up
  // puts texture behind the headline, which is the one thing that has to sit
  // on clean black.
  float top = smoothstep(0.82, 0.28, uv.y);

  // Breathing. The rules swell very slightly and the cloud brightens and dims
  // on a long, deliberately non-repeating cycle. Nothing on the plate is ever
  // perfectly still — that is the difference between a live field and a
  // background image, and at these amplitudes you feel it rather than see it.
  float ruleBreath = 1.0 + uBreath * 0.14;
  float cloudBreath = 1.0 + uBreath * 0.55;

  float a = rules * uOpacity * top * ruleBreath;
  // Rules near the cursor lift slightly. Barely perceptible, and the only cue
  // that the field responds at all.
  a *= 1.0 + bend * 1.1;
  a += haze * uHazeStrength * top;
  a += cloud * uCloudStrength * cloudBreath * top;
  a *= uPresence;

  float alpha = clamp(a, 0.0, 1.0);
  if (alpha < 0.002) discard;
  fragColor = vec4(uColor, alpha);
}
