precision highp float;

/**
 * THE CORE BURN.
 *
 * A tight, turbulent flash at the heart of the object — a burn, not a movie
 * fireball. The edge is pushed outward by noise that boils as it expands, so
 * it is never a clean disc, and the whole thing cools from white through the
 * ember to nothing over its short life.
 */

#include <noise>

varying vec2 vUv;

uniform float uTime;   // 0..1 through the burn
uniform float uSeed;

out vec4 fragColor;

void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);

  vec2 outward = p / max(r, 1e-4);
  float n = fbm(p * 2.6 + vec2(uSeed, uSeed * 1.7) - outward * uTime * 1.5, 3);
  float edge = r + n * 0.28;

  float body = 1.0 - smoothstep(0.35, 1.0, edge);
  float core = 1.0 - smoothstep(0.0, 0.45, edge);

  float heat = 1.0 - uTime;
  vec3 white = vec3(1.0, 0.93, 0.82);
  vec3 ember = vec3(1.0, 0.353, 0.122);
  vec3 c = mix(ember, white, core * heat) * (1.0 + 3.0 * core * heat);

  fragColor = vec4(c, body * heat * heat);
}
