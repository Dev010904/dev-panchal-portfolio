precision highp float;

/**
 * A camera-facing quad centred on the mesh's world position, `uSize` world
 * units across. Expanded in VIEW space, so it always faces the lens without
 * the CPU copying the camera's rotation onto it every frame.
 */

uniform float uSize;

varying vec2 vUv;

void main() {
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  mv.xy += position.xy * uSize;
  gl_Position = projectionMatrix * mv;
}
