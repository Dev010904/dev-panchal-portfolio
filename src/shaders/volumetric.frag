precision highp float;

/**
 * RAYMARCHED VOLUMETRIC SCATTERING.
 *
 * For every fragment of the volume's back face, walk the view ray from the
 * camera to that exit point and integrate how much light is scattered toward
 * the eye at each sample. A sample contributes only if the key light can
 * actually SEE it, which is decided by projecting it into the light-space
 * depth map — the same test a shadow map performs on a surface, done in
 * mid-air. That is what a god-ray is, and it is why the shafts here fan around
 * the mark's real silhouette rather than around a circle.
 *
 * ── TWO RULES THIS FILE EXISTS TO OBEY ────────────────────────────────────
 *
 * 1. NO IMPLICIT-LOD TEXTURE FETCHES INSIDE THE LOOP.
 *    `texture()` computes derivatives to pick a mip level. The loop below is
 *    divergent — neighbouring fragments break at different iterations and take
 *    different branches on the frustum test — and a derivative in divergent
 *    flow is undefined behaviour that ANGLE's D3D path reports as X3595. Every
 *    fetch is `textureLod(..., 0.0)`, which needs no derivatives at all. The
 *    depth map has no mips, so nothing is lost.
 *
 * 2. THE LOOP BOUND IS A COMPILE-TIME CONSTANT.
 *    `for (i < uSteps)` with a uniform bound is legal ESSL3 and compiles to a
 *    dynamic loop that ANGLE unrolls poorly. A constant bound with a uniform
 *    `break` gives the same adaptivity and a shader the driver can actually
 *    optimise.
 */

out vec4 fragColor;

varying vec3 vWorld;

uniform sampler2D uDepth;
uniform mat4  uLightMatrix;
uniform vec3  uLightPos;
uniform vec3  uColor;
uniform vec3  uCameraPos;
uniform float uDensity;
uniform float uAniso;
uniform float uAmount;
uniform float uAttenuation;
uniform float uMaxDistance;
uniform float uBias;
uniform float uTime;
uniform int   uSteps;

/** Hard ceiling. Must be >= the largest value ever written to uSteps. */
const int MAX_STEPS = 64;
const float PI = 3.14159265359;

/**
 * The map is a HALF-FLOAT target with BasicDepthPacking, so depth is the red
 * channel directly. It is not byte-packed: packed depth cannot be linearly
 * filtered, which is what broke the caustics before this changed.
 */
float readDepth(const in vec2 uv) {
  return textureLod(uDepth, uv, 0.0).r;
}

/**
 * Henyey-Greenstein phase function.
 *
 * The single most important term here. Without it the volume glows uniformly
 * and reads as fog with a hole in it; with it, scattering peaks when the view
 * ray points back toward the light, so shafts brighten as you look along them.
 * That angular dependence is what the eye reads as "air", and it is the
 * difference between atmosphere and a lens flare.
 */
float henyeyGreenstein(const in float cosTheta, const in float g) {
  float g2 = g * g;
  float d = 1.0 + g2 - 2.0 * g * cosTheta;
  return (1.0 - g2) / (4.0 * PI * max(d * sqrt(d), 1e-4));
}

/** Per-fragment hash, so step banding becomes noise the grain pass absorbs. */
float hash(const in vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec3 origin = uCameraPos;
  vec3 delta = vWorld - origin;
  float total = length(delta);
  if (total < 1e-4) discard;

  vec3 dir = delta / total;
  total = min(total, uMaxDistance);

  float stepLen = total / float(uSteps);

  // Jitter the first sample by up to one step. 48 steps across 16 units is a
  // 0.33-unit gap, which without this reads as concentric shells rather than
  // as a shaft. Animated so the pattern does not sit still between frames.
  float jitter = hash(gl_FragCoord.xy + uTime * 60.0);

  float acc = 0.0;

  for (int i = 0; i < MAX_STEPS; i++) {
    if (i >= uSteps) break;

    float t = (float(i) + jitter) * stepLen;
    vec3 p = origin + dir * t;

    // Into the light's clip space, already biased to [0,1] by uLightMatrix.
    vec4 lp = uLightMatrix * vec4(p, 1.0);
    vec3 luv = lp.xyz / lp.w;

    // Outside the light frustum there is no occluder information, so treat the
    // sample as lit. Clamping to the border instead would smear the mark's
    // edge texels across the whole volume as a shadow.
    float lit = 1.0;
    if (luv.x >= 0.0 && luv.x <= 1.0 && luv.y >= 0.0 && luv.y <= 1.0 && luv.z <= 1.0) {
      float occluder = readDepth(luv.xy);
      lit = step(luv.z - uBias, occluder);
    }

    vec3 toLight = uLightPos - p;
    float dist = length(toLight);
    float atten = 1.0 / (1.0 + dist * dist * uAttenuation);
    float phase = henyeyGreenstein(dot(dir, toLight / max(dist, 1e-4)), uAniso);

    acc += lit * atten * phase * stepLen;
  }

  float v = acc * uDensity * uAmount;
  // Additive: the alpha carries the same value so the blend works whether the
  // target is premultiplied or not.
  fragColor = vec4(uColor * v, v);
}
