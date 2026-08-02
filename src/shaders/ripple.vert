precision highp float;

/**
 * WORK CHAPTER — the project screenshot on a displaced plane.
 * Hovering sends a ring out from the cursor across the surface. The
 * displacement is in the vertex shader so the plane genuinely deforms in 3D
 * and catches the scene lighting at its crests, rather than being a
 * flat UV distortion pretending to be geometry.
 */

varying vec2 vUv;
varying float vRipple;

uniform float uTime;
uniform vec2  uPointer;    // 0..1 in plane space
uniform float uHover;      // 0..1 eased
uniform float uAmplitude;
uniform float uFrequency;
uniform float uSpeed;

void main() {
  vUv = uv;

  float d = distance(uv, uPointer);
  float wave = sin(d * uFrequency - uTime * uSpeed);
  // Compact support: the ripple dies out well before the panel edge, so the
  // corners stay square and the thing still reads as a screen.
  float falloff = 1.0 - smoothstep(0.0, 0.62, d);

  float r = wave * falloff * uHover;
  vRipple = r;

  vec3 p = position;
  p.z += r * uAmplitude;

  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
