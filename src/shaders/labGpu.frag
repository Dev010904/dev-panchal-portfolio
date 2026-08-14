precision highp float;

/**
 * One particle. Round, soft-edged, additive.
 *
 * The colour carries two signals and no others: SPEED, which tints toward the
 * ember accent so the turbulent regions read warm and the settled letterforms
 * read cool; and WAKE, which is the cursor's dissipating charge. Both are
 * physical quantities out of the simulation rather than decoration, which is
 * why the field looks like it is doing something rather than cycling a palette.
 */

out vec4 fragColor;

in float vWake;
in float vSpeed;
in float vSeed;
in float vDepth;

uniform vec3  uColor;
uniform vec3  uAccent;
uniform float uOpacity;
uniform float uSpeedScale;
uniform float uDensityGain;

void main() {
  // gl_PointCoord is uniform across the primitive, so this is safe — no
  // derivatives anywhere in this file.
  vec2 d = gl_PointCoord - 0.5;
  float r2 = dot(d, d);
  if (r2 > 0.25) discard;

  // Tight falloff, matching the CPU path. A wide glow at this count turns the
  // whole field into fog and the letterforms stop being readable.
  float falloff = 1.0 - smoothstep(0.06, 0.25, r2);

  // Depth fade, so the far side of the field reads as distance rather than as
  // more brightness. Same window as the CPU path.
  float fog = 1.0 - smoothstep(3.0, 11.0, vDepth);

  /**
   * `uSpeedScale` IS SET FROM A MEASUREMENT, NOT A GUESS.
   *
   * Measured speed distribution in the formed state, via `__qa.particles()`:
   *
   *     p05 0.96 · p50 2.28 · p95 3.61 · max 3.89
   *
   * The original 0.42 saturated `heat` at speed 2.38 — below the median — so
   * more than half of every frame was pinned at full accent and the field came
   * out a uniform orange wash. That is what "tints toward the ember so the
   * turbulent regions read warm and the settled letterforms read cool" was
   * supposed to avoid, and the number quietly defeated it.
   *
   * At 0.22 the median lands at heat 0.50, p95 at 0.79, and nothing saturates
   * short of the fastest particles in the field. Re-derive this if the flow
   * strength, stiffness or damping change — they set the distribution.
   */
  float heat = clamp(vSpeed * uSpeedScale, 0.0, 1.0);
  vec3 col = mix(uColor, uAccent, heat * 0.8 + vWake * 0.6);

  // Wake also brightens, so a cursor trail is visible in a field whose colour
  // is otherwise nearly uniform.
  float gain = 0.55 + heat * 0.5 + vWake * 1.5;

  // A little per-particle variance, so the field is not a flat wash.
  gain *= 0.75 + fract(vSeed * 0.0137) * 0.5;

  /**
   * EVERY RUNG OF THE LADDER MUST LOOK THE SAME BRIGHTNESS.
   *
   * These points are additively blended, so total luminance scales with the
   * particle count. Without this term the 500k rung is twice as bright as the
   * 250k rung and the field's exposure becomes a property of the visitor's
   * graphics card — a discrete GPU would blow the section out while integrated
   * graphics looked correct. `uDensityGain` is the reference count over the
   * live count, so the emitted energy is invariant across the ladder and the
   * only thing a higher rung buys is finer grain, which is the point of it.
   */
  gain *= uDensityGain;

  fragColor = vec4(col * gain, falloff * fog * uOpacity);
}
