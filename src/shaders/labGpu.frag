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

uniform vec3  uColor;
uniform vec3  uAccent;
uniform float uOpacity;
uniform float uSpeedScale;

void main() {
  // gl_PointCoord is uniform across the primitive, so this is safe — no
  // derivatives anywhere in this file.
  vec2 d = gl_PointCoord - 0.5;
  float r2 = dot(d, d);
  if (r2 > 0.25) discard;

  float falloff = 1.0 - smoothstep(0.0, 0.25, r2);

  float heat = clamp(vSpeed * uSpeedScale, 0.0, 1.0);
  vec3 col = mix(uColor, uAccent, heat * 0.8 + vWake * 0.6);

  // Wake also brightens, so a cursor trail is visible in a field whose colour
  // is otherwise nearly uniform.
  float gain = 0.55 + heat * 0.5 + vWake * 1.5;

  // A little per-particle variance, so the field is not a flat wash.
  gain *= 0.75 + fract(vSeed * 0.0137) * 0.5;

  fragColor = vec4(col * gain, falloff * uOpacity);
}
