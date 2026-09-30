precision highp float;

/**
 * BLAST SPARKS — motion-stretched streaks, one instanced quad each.
 *
 * A spark is a point moving fast, and a point drawn as a dot reads as a slow
 * ember. What the eye reads as speed is the smear, so each quad is stretched
 * in SCREEN space between where the spark is and where it was `uTrail`
 * seconds ago, at a constant pixel width. Built here from the two projected
 * endpoints, so it stays a hairline at any distance and any speed, for the
 * price of one quad per spark.
 */

attribute vec3 iPos;   // world position now
attribute vec3 iVel;   // world velocity, units/s
attribute vec2 iLife;  // x: remaining life 0..1, y: per-spark width scale

uniform float uTrail;      // seconds of travel the streak shows
uniform float uWidth;      // CSS px
uniform float uPixelRatio;
uniform vec2  uViewport;   // drawing-buffer px

varying float vLife;
varying vec2 vQuad;

void main() {
  vLife = iLife.x;
  // The plane spans [-0.5, 0.5]: x runs tail → head, y across the streak.
  vQuad = position.xy + 0.5;

  vec4 head = projectionMatrix * viewMatrix * vec4(iPos, 1.0);
  vec4 tail = projectionMatrix * viewMatrix * vec4(iPos - iVel * uTrail, 1.0);

  vec2 d = (head.xy / head.w - tail.xy / tail.w) * uViewport;
  float len = length(d);
  vec2 dir = len > 1e-3 ? d / len : vec2(1.0, 0.0);
  vec2 nrm = vec2(-dir.y, dir.x);

  vec4 p = mix(tail, head, vQuad.x);

  // Thins as it cools. The head is padded by its own width so a spark that
  // has nearly stopped is a dot rather than a sliver too thin to raster.
  float w = uWidth * uPixelRatio * iLife.y * (0.35 + 0.65 * iLife.x);
  vec2 offset = nrm * position.y * w + dir * (vQuad.x - 0.5) * w;
  p.xy += offset / uViewport * 2.0 * p.w;

  gl_Position = p;
}
