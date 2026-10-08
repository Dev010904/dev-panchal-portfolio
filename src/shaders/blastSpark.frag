precision highp float;

varying float vLife;
varying float vHeat;
varying float vSeed;
varying vec2 vQuad;

uniform float uIntensity;
uniform float uTime;

out vec4 fragColor;

/**
 * The cooling ramp: white-hot, yellow, the ember, then a dull red, then gone.
 * Only a spark born at full heat ever shows white, and only for the first
 * sliver of its life — a ramp that spent 40% of every spark's life at white
 * is what turned the whole spray into a starfield.
 */
vec3 heat(float t) {
  vec3 white = vec3(1.0, 0.93, 0.78);
  vec3 yellow = vec3(1.0, 0.66, 0.24);
  vec3 ember = vec3(1.0, 0.353, 0.122);
  vec3 red = vec3(0.45, 0.06, 0.02);
  if (t > 0.82) return mix(yellow, white, (t - 0.82) / 0.18);
  if (t > 0.5) return mix(ember, yellow, (t - 0.5) / 0.32);
  return mix(red, ember, t / 0.5);
}

void main() {
  // Soft across the width; brightest at the head, so the smear has a front.
  float across = 1.0 - abs(vQuad.y * 2.0 - 1.0);
  float along = smoothstep(0.0, 1.0, vQuad.x);
  float fade = smoothstep(0.0, 0.18, vLife);

  float t = vLife * vHeat;
  // Burning metal does not glow steadily; each one sputters at its own rate.
  float flicker = 0.72 + 0.28 * sin(uTime * (31.0 + vSeed * 40.0) + vSeed * 91.0);

  // Above 1.0 while hot, on purpose: the core crosses the bloom threshold and
  // glows, and the glow dies as the spark cools.
  vec3 c = heat(t) * (0.5 + 2.6 * t * t) * flicker;

  fragColor = vec4(c, across * across * along * fade * uIntensity);
}
