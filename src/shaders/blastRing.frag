precision highp float;

/**
 * THE SHOCKWAVE.
 *
 * A thin bright crest with a faint wake behind it, on a camera-facing quad —
 * which is exactly the silhouette of a spherical shell, the shape the front
 * actually is. The crest is broken up by noise around its circumference so it
 * reads as air being shoved, not as a circle someone drew.
 */

#include <noise>

varying vec2 vUv;

uniform float uProgress;  // 0..1
uniform float uWidth;     // crest width, as a fraction of the radius
uniform float uIntensity;
uniform float uSeed;

out vec4 fragColor;

void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);

  float crest = exp(-pow((r - 0.97) / uWidth, 2.0));
  float wake = smoothstep(0.55, 0.97, r) * (1.0 - smoothstep(0.97, 1.0, r)) * 0.16;
  float grit = 0.72 + 0.28 * snoise(vec2(atan(p.y, p.x) * 3.0 + uSeed, r * 4.0 - uProgress * 3.0));

  float fade = 1.0 - uProgress;
  vec3 c = mix(vec3(1.0, 0.62, 0.42), vec3(1.0, 0.93, 0.85), crest);

  fragColor = vec4(c, (crest + wake) * grit * fade * fade * uIntensity);
}
