precision highp float;

/**
 * MARK DISSOLVE — state 4 of the signature object.
 *
 * Points are sampled off the actual extruded surfaces (area-weighted, see
 * lib/mark/geometry.ts), so at uDissolve = 0 the cloud is indistinguishable
 * from the solid mark's silhouette. It then flows apart along a curl-noise
 * field and re-crystallises onto the exact same points.
 *
 * The scatter is per-particle deterministic — no random walk — so scrubbing
 * the Deconstruction timeline backwards puts every particle back where it was.
 * A random-walk version looks identical playing forwards and falls apart the
 * moment someone scrolls up, which they will.
 */

attribute vec3 aHome;
attribute float aSeed;

uniform float uTime;
uniform float uDissolve;   // 0 = on the surface, 1 = fully scattered
uniform float uDrift;      // extra scroll-linked flow
uniform float uPointSize;
uniform float uPixelRatio;
uniform float uScale;

varying float vFade;
varying float vSeed;

#include <noise>

// Curl of a 2D noise field, lifted to 3D. Divergence-free, so the cloud
// swirls and folds instead of just expanding into a sphere.
vec3 curl(vec3 p) {
  float e = 0.22;
  float n1 = snoise(p.xy + vec2(0.0, e));
  float n2 = snoise(p.xy - vec2(0.0, e));
  float n3 = snoise(p.xy + vec2(e, 0.0));
  float n4 = snoise(p.xy - vec2(e, 0.0));
  float n5 = snoise(p.yz + vec2(0.0, e));
  float n6 = snoise(p.yz - vec2(0.0, e));
  return normalize(vec3(n1 - n2, n4 - n3, n5 - n6) + 1e-5);
}

void main() {
  vec3 seedv = hash31(aSeed * 91.7);
  vec3 pos = aHome;

  // Stagger: particles leave the surface in waves rather than all at once,
  // ordered by a noise field over the mark so the dissolve sweeps across it.
  float order = snoise(aHome.xy * 1.4) * 0.5 + 0.5;
  float d = clamp((uDissolve * 1.55) - order * 0.55, 0.0, 1.0);
  d = d * d * (3.0 - 2.0 * d);

  if (d > 0.0) {
    float t = uTime * 0.24 + seedv.x * 4.0;
    vec3 flow = curl(pos * 1.6 + vec3(t, t * 0.7, t * 0.4));
    float reach = mix(0.35, 1.9, seedv.y);
    pos += flow * d * reach;
    // Scroll-linked drift: the cloud is pulled along the scroll direction so
    // the particles feel attached to the gesture, not just floating.
    pos.y -= uDrift * d * (0.4 + seedv.z * 0.8);
    pos.z += (seedv.z - 0.5) * d * 0.9;
  }

  vec4 mv = modelViewMatrix * vec4(pos * uScale, 1.0);
  gl_Position = projectionMatrix * mv;

  vFade = d;
  vSeed = seedv.x;

  gl_PointSize = max(
    uPointSize * uPixelRatio * (1.0 + d * 0.5) * (3.0 / max(-mv.z, 0.1)),
    0.85 * uPixelRatio
  );
}
