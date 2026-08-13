precision highp float;

/**
 * THE SCATTERING VOLUME.
 *
 * A box around the mark, rendered BACK faces only. That choice is what lets
 * the camera be inside the volume — which it is, permanently: the hero camera
 * sits 4.9 units out and the box is 7.5. Front-face rendering would clip the
 * whole effect away the moment the near plane crossed the box.
 *
 * The fragment shader marches from the camera to this position, so the back
 * face is the ray's exit point and the integration length falls out of the
 * geometry instead of being a guessed constant.
 */

varying vec3 vWorld;

void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
