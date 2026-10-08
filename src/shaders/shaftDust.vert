precision highp float;

/**
 * SHAFT DUST — one line segment per mote, both ends at the same point until
 * the camera moves. The far end is pushed along the camera's own velocity by
 * `uTrail` seconds of travel: what a stationary speck does on a sensor while
 * the camera falls past it. Standing still, every mote is a dot; falling, the
 * whole column becomes streaks, and that is the read of speed.
 */

attribute float aEnd;   // 0 at the mote, 1 at the end of its streak
attribute float aSeed;

uniform vec3 uVel;      // camera velocity, world units/s
uniform float uTrail;   // seconds of travel a streak shows
uniform float uMaxLen;  // world units

varying float vEnd;
varying float vSeed;

void main() {
  vEnd = aEnd;
  vSeed = aSeed;

  vec3 d = uVel * uTrail;
  float len = length(d);
  if (len > uMaxLen) d *= uMaxLen / len;
  // A floor, so a mote is still a dot when the camera is all but still.
  if (len < 0.03) d = vec3(0.0, 0.03, 0.0);

  gl_Position = projectionMatrix * viewMatrix * vec4(position + d * aEnd, 1.0);
}
