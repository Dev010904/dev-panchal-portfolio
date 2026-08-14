precision highp float;

/**
 * THE GPGPU FIELD'S RENDER PASS.
 *
 * The geometry is a dummy: one vertex per particle carrying nothing but its
 * own texel coordinate. Every position comes out of the simulation texture, so
 * the CPU never touches a particle and the vertex buffer never changes after
 * upload. That is the entire point of moving this to the GPU — the old path
 * rebuilt 46k positions in JavaScript every frame, and this one moves 250k+
 * without the main thread knowing they exist.
 */

in vec2 aRef;

out float vWake;
out float vSpeed;
out float vSeed;
out float vDepth;

uniform sampler2D uPosition;
uniform sampler2D uVelocity;
uniform float uPointSize;
uniform float uPixelRatio;
uniform float uOpacity;

void main() {
  vec4 P = textureLod(uPosition, aRef, 0.0);
  vec4 V = textureLod(uVelocity, aRef, 0.0);

  vWake = P.w;
  vSpeed = length(V.xyz);
  vSeed = V.w;

  vec4 mv = modelViewMatrix * vec4(P.xyz, 1.0);
  gl_Position = projectionMatrix * mv;

  // Eye-space distance, for the depth fade in the fragment shader. The CPU
  // path has always had this and the GPU path was written without it, which is
  // why the first version read as a flat sheet: with no depth cue, the far
  // side of a 13-unit-deep field is exactly as bright as the near side.
  vDepth = -mv.z;

  // Perspective-correct size, with a floor. Below about one device pixel a
  // point stops being antialiased and starts flickering in and out as it
  // crosses the sample grid, which at this count reads as static.
  float size = uPointSize * uPixelRatio * (8.0 / max(-mv.z, 0.1));
  gl_PointSize = max(size, uPixelRatio * 0.9) * step(0.001, uOpacity);
}
