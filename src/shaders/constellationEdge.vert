precision highp float;

/**
 * One end of one link.
 *
 * `aGlow`   this vertex's OWN node glow. Drives the lift, so the line follows
 *           the node it is attached to.
 * `aActive` the larger of the two endpoints' glows. Drives brightness, so the
 *           whole link lights up when either end is focused rather than
 *           fading out along its length — a link half-lit reads as an
 *           animation that has not finished, not as a relationship.
 */

attribute float aGlow;
attribute float aActive;

uniform float uLift;

varying float vActive;
varying float vDepth;

void main() {
  vActive = aActive;

  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  // Same offset, same threshold as constellation.vert. If these two ever
  // disagree the lines detach from the node they belong to.
  mv.z += uLift * smoothstep(0.5, 1.0, aGlow);

  gl_Position = projectionMatrix * mv;
  vDepth = -mv.z;
}
