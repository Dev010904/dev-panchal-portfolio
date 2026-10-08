precision highp float;

/**
 * THE FIRST FRAMES — a white-hot point at the heart of the mark, gone in a
 * tenth of a second. A tight core over a wide, faint halo: the core is what
 * the eye registers as the instant of detonation, and the bloom pass turns it
 * into the glare around it. Additive; alpha is unused.
 */

uniform float uIntensity;

varying vec2 vUv;

out vec4 fragColor;

void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  if (r >= 1.0) discard;

  float core = exp(-r * r * 22.0);
  float halo = (1.0 - r) * (1.0 - r) * (1.0 - r) * 0.3;
  vec3 c = vec3(1.0, 0.86, 0.64) * (core * 6.0 + halo) * uIntensity;

  fragColor = vec4(c, 1.0);
}
