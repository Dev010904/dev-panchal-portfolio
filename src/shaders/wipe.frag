precision highp float;

/**
 * SECTION WIPE — a shader transition, not a fade.
 *
 * A raked band sweeps the viewport. Its leading edge is displaced by fbm so it
 * tears rather than slides, and the fragments right at the front get an RGB
 * split. A crossfade would be invisible on a near-black site; a torn edge with
 * chromatic separation is the only thing that reads at these luminances.
 */

out vec4 fragColor;

varying vec2 vUv;

uniform float uProgress;   // 0 = clear, 0.5 = fully covered, 1 = clear again
uniform float uEdgeNoise;
uniform float uEdgeWidth;
uniform float uAberration;
uniform float uTime;
uniform vec3  uColor;
uniform vec3  uAccent;

#include <noise>

float band(vec2 uv, float p) {
  // Rake the wipe so it travels down-right; a vertical wipe reads as a curtain.
  float axis = uv.x * 0.62 + (1.0 - uv.y) * 0.38;
  float n = fbm(uv * 3.4 + uTime * 0.05, 3) * uEdgeNoise;
  return smoothstep(p - uEdgeWidth, p + uEdgeWidth, axis + n);
}

void main() {
  // Out and back: cover on the first half, uncover on the second.
  float p = uProgress <= 0.5
    ? mix(-0.35, 1.35, uProgress * 2.0)
    : mix(-0.35, 1.35, (uProgress - 0.5) * 2.0);

  float m = band(vUv, p);
  // First half the panel arrives behind the edge; second half it leaves ahead
  // of it, so the tear always leads the motion.
  float cover = uProgress <= 0.5 ? 1.0 - m : m;

  // Chromatic split, strongest exactly at the front.
  float front = 1.0 - abs(cover - 0.5) * 2.0;
  float ab = front * uAberration * 40.0;
  float r = 1.0 - abs(band(vUv + vec2(ab, 0.0), p) - 0.5) * 2.0;
  float b = 1.0 - abs(band(vUv - vec2(ab, 0.0), p) - 0.5) * 2.0;

  vec3 col = uColor;
  col += vec3(r, front, b) * 0.06;
  // One thread of ember riding the tear.
  col = mix(col, uAccent, front * front * 0.16);

  float alpha = clamp(cover, 0.0, 1.0);
  if (alpha < 0.003) discard;
  fragColor = vec4(col, alpha);
}
