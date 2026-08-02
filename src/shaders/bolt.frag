precision highp float;

/**
 * Ribbon shading for one layer of a discharge.
 *
 * `uFalloff` is the whole difference between the two layers. The core runs a
 * high exponent, so it stays near-white right up to a hard edge; the halo runs
 * a low one over a much wider ribbon, so it reads as glow rather than as a
 * second, fatter bolt. Real discharges are white in the middle and blue at the
 * edges, and layering is the cheapest honest way to get that — a single flat
 * blue stroke is exactly what makes a bolt look drawn.
 */

out vec4 fragColor;

varying float vSide;
varying float vIntensity;

uniform vec3  uColor;
uniform float uOpacity;
uniform float uFlicker;   // 0..1, stepped per frame — the stutter, not a fade
uniform float uFalloff;

void main() {
  // Soft across the ribbon. vSide runs -1..1 edge to edge.
  float across = 1.0 - abs(vSide);
  float shape = pow(clamp(across, 0.0, 1.0), uFalloff);

  float a = shape * vIntensity * uFlicker * uOpacity;
  if (a < 0.002) discard;

  // Additively blended, so the colour carries the energy and alpha only
  // shapes it. Values above 1 are intentional — they are what pushes the core
  // over the bloom threshold.
  fragColor = vec4(uColor * a, a);
}
