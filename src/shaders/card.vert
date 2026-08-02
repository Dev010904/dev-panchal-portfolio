precision highp float;

/**
 * WORK ARC — one project panel, bent around the ribbon cylinder.
 *
 * The card's Object3D already sits at its point on the arc and is rotated to
 * the tangent there, so the CPU-side transform is correct for raycasting. What
 * this adds is the panel's own curvature: local x is treated as arc length
 * about the same radius, so the quad wraps onto the cylinder instead of being
 * a flat chord across it. Over a 3.75-unit card at radius 12.6 that is a
 * sagitta of 0.14 — small enough that the pointer still hits the right card,
 * large enough that the ribbon reads as continuous rather than faceted.
 */

varying vec2 vUv;
varying float vFacing;

uniform float uRadius;

void main() {
  vUv = uv;

  vec3 p = position;

  float a = p.x / uRadius;
  p.x = uRadius * sin(a);
  // Negative: the panel's edges fall AWAY from the camera, which is what makes
  // the ribbon convex. Flip this and the cards cup toward the viewer and the
  // whole arc turns inside out.
  p.z += uRadius * cos(a) - uRadius;

  vec4 mv = modelViewMatrix * vec4(p, 1.0);

  // How square-on this fragment is to the camera. The edge highlight below is
  // gated on it, so a card only catches a hard rim once it has turned — the
  // same behaviour as the chamfers on the mark, and the reason the arc reads
  // as machined panels rather than as printed cards.
  vec3 n = normalize(normalMatrix * vec3(sin(a), 0.0, cos(a)));
  vFacing = abs(dot(n, normalize(-mv.xyz)));

  gl_Position = projectionMatrix * mv;
}
