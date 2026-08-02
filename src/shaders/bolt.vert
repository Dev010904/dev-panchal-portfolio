precision highp float;

/**
 * THE DISCHARGE — camera-facing ribbon expansion.
 *
 * The centreline, its tangent and its half-width all arrive as attributes; the
 * ribbon is widened here rather than on the CPU. That is what lets one geometry
 * serve both render layers: the hot core and the soft halo are the same mesh
 * drawn twice with a different uWidth, so the halo is guaranteed to track the
 * core exactly instead of being a second path that can drift off it.
 *
 * Expanding toward the camera each frame also means the ribbon never
 * foreshortens into a hairline when the arc happens to fire along the view
 * axis, which a fixed-plane strip does constantly.
 */

attribute float aSide;       // -1 / +1 — which edge of the ribbon
attribute float aWidth;      // half-width at this point, world units
attribute float aIntensity;  // per-point brightness; forks come in dimmer
attribute vec3  aTangent;    // centreline direction at this point

uniform float uWidth;        // layer multiplier: 1 for the core, wide for halo

varying float vSide;
varying float vIntensity;

void main() {
  vec3 toCam = normalize(cameraPosition - position);
  vec3 side = cross(normalize(aTangent), toCam);

  // A fork can double back far enough that its tangent is briefly parallel to
  // the view ray, which collapses the cross product. Falling back to any stable
  // perpendicular keeps that segment from flickering to zero width.
  float len = length(side);
  side = len < 1e-4 ? vec3(1.0, 0.0, 0.0) : side / len;

  vec3 p = position + side * aSide * aWidth * uWidth;

  vSide = aSide;
  vIntensity = aIntensity;

  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
