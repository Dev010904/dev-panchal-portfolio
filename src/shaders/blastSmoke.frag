precision highp float;

/**
 * The haze the detonation leaves hanging. Near-black, faint, lit from inside
 * by the ember for its first moments. On a #08080A page any smoke that reads
 * clearly is smoke that lifts the black, so this is tuned toward barely.
 */

#include <noise>

varying vec2 vUv;
varying float vLife;
varying float vSeed;

uniform float uOpacity;
uniform float uHeat;  // 0..1: the fire under it, dying

out vec4 fragColor;

void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  float n = fbm(p * 1.8 + vec2(vSeed * 13.1, vSeed * 7.3), 3);
  float puff = 1.0 - smoothstep(0.2, 1.0, r + n * 0.35);

  // Life runs 1 → 0: in fast, out slow.
  float env = smoothstep(1.0, 0.85, vLife) * smoothstep(0.0, 0.6, vLife);

  vec3 smoke = vec3(0.085, 0.085, 0.095);
  vec3 lit = vec3(0.55, 0.2, 0.08);
  vec3 c = mix(smoke, lit, uHeat * (1.0 - r));

  fragColor = vec4(c, puff * env * uOpacity);
}
