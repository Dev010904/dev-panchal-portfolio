precision highp float;

/**
 * SMOKE PUFFS — instanced, camera-facing, each rotated in its own plane so the
 * noise inside does not line up from puff to puff.
 */

attribute vec3 iPos;
attribute vec4 iData;  // x: size, y: remaining life 0..1, z: seed, w: rotation

varying vec2 vUv;
varying float vLife;
varying float vSeed;

void main() {
  vUv = uv;
  vLife = iData.y;
  vSeed = iData.z;

  float c = cos(iData.w);
  float s = sin(iData.w);
  vec2 q = mat2(c, -s, s, c) * position.xy * iData.x;

  vec4 mv = viewMatrix * vec4(iPos, 1.0);
  mv.xy += q;
  gl_Position = projectionMatrix * mv;
}
