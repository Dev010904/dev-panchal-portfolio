precision highp float;

/**
 * FIRE BILLOWS — instanced, camera-facing, each turned in its own plane so the
 * noise inside one billow never lines up with its neighbour's.
 */

attribute vec4 iPos;   // xyz: world centre, w: rotation in radians
attribute vec4 iData;  // x: world diameter, y: heat (0 cold .. 1 at ignition), z: envelope 0..1, w: seed

varying vec2 vUv;
varying float vHeat;
varying float vFade;
varying float vSeed;

void main() {
  vUv = uv;
  vHeat = iData.y;
  vFade = iData.z;
  vSeed = iData.w;

  float c = cos(iPos.w);
  float s = sin(iPos.w);
  vec2 q = mat2(c, -s, s, c) * position.xy * iData.x;

  vec4 mv = viewMatrix * vec4(iPos.xyz, 1.0);
  mv.xy += q;
  gl_Position = projectionMatrix * mv;
}
