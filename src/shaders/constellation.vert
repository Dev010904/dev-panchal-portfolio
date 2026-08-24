precision highp float;

/**
 * THE CONSTELLATION — one node.
 *
 * `aGlow` is the single interaction channel and it carries two states in one
 * float, which is why nothing else here needs a second attribute:
 *
 *     0.0        idle
 *     ~0.5       a direct neighbour of whatever is focused
 *     1.0        the focused node itself
 *
 * Everything downstream keys off thresholds on that one value. Splitting it
 * into `isFocused` and `isNeighbour` was the first version, and it made an
 * illegal fourth state reachable — both flags high — which showed up as a node
 * that grew and lifted while still being drawn in the neighbour colour.
 */

attribute float aWeight;
attribute float aGlow;

uniform float uPointSize;
uniform float uPixelRatio;
uniform vec2  uSizeRange;
uniform float uLift;
uniform float uGrow;

varying float vGlow;
varying float vWeight;
varying float vDepth;

void main() {
  vGlow = aGlow;
  vWeight = aWeight;

  vec4 mv = modelViewMatrix * vec4(position, 1.0);

  /**
   * The focused node lifts toward the camera in VIEW space, where +z is
   * always "out of the screen". Doing it in world space would push the node
   * toward wherever the camera happened to be when the layout was built, so
   * the lift would point the wrong way for three of the four clusters and
   * would change direction as the structure rotated.
   *
   * The edge shader applies this same offset with the same threshold, so a
   * lifted node keeps its lines attached instead of tearing away from them.
   */
  float lead = smoothstep(0.5, 1.0, aGlow);
  mv.z += uLift * lead;

  gl_Position = projectionMatrix * mv;
  vDepth = -mv.z;

  float scale = mix(uSizeRange.x, uSizeRange.y, aWeight) * mix(1.0, uGrow, lead);

  // Perspective-correct, with a floor so a node in the far lobe never drops to
  // a sub-pixel sprite and starts flickering as the structure turns.
  gl_PointSize = max(
    uPointSize * uPixelRatio * scale * (3.4 / max(vDepth, 0.1)),
    1.5 * uPixelRatio
  );
}
