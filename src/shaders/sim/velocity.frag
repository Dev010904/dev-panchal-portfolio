precision highp float;

/**
 * VELOCITY PASS — a thin wrapper. All the physics is in simCore.glsl.
 *
 * This file does exactly three things: read this particle's state out of two
 * textures, call the force functions, and write the result. That is the part
 * that gets thrown away in the WebGPU port; simCore.glsl is the part that
 * survives it.
 */

#include <simCore>

out vec4 fragColor;

uniform sampler2D uPosition;
uniform sampler2D uVelocity;
uniform sampler2D uHome;

uniform vec2  uResolution;
uniform float uDt;
uniform float uTime;
uniform float uFormation;

uniform float uNoiseScale;
uniform float uNoiseSpeed;
uniform float uFlowStrength;

uniform float uStiffness;
uniform float uDamping;
uniform float uMaxSpeed;

uniform vec3  uPointer;
uniform float uPointerActive;
uniform float uRepelRadius;
uniform float uRepelStrength;

uniform vec3  uShockOrigin;
uniform float uShockAge;
uniform float uShockSpeed;
uniform float uShockWidth;
uniform float uShockStrength;

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;

  vec4 P = textureLod(uPosition, uv, 0.0);
  vec4 V = textureLod(uVelocity, uv, 0.0);
  vec3 home = textureLod(uHome, uv, 0.0).xyz;

  vec3 pos = P.xyz;
  vec3 vel = V.xyz;
  float seed = V.w;

  // ── Flow ────────────────────────────────────────────────────────────────
  // The field itself drifts, so the turbulence evolves rather than the
  // particles merely touring a static pattern.
  //
  // NOT named `sample`: that is a RESERVED WORD in GLSL ES 3.00 and the
  // shader fails to compile with "Illegal use of reserved word". three logs it
  // and carries on, so the symptom is a silently invisible field — nothing
  // TypeScript or a lint pass can see.
  vec3 flowP = pos * uNoiseScale + vec3(0.0, 0.0, uTime * uNoiseSpeed);
  vec3 flow = abcFlow(flowP) * uFlowStrength;

  // The flow is what the letterforms fight against, so it is strongest when
  // the type is NOT formed and never quite disappears when it is.
  flow *= mix(1.0, 0.22, uFormation);

  vec3 force = flow;
  force += attractorForce(pos, home, uFormation, uStiffness);
  force += repulsionForce(pos, uPointer, uRepelRadius, uRepelStrength) * uPointerActive;
  force += shockForce(pos, uShockOrigin, uShockAge, uShockSpeed, uShockWidth, uShockStrength);

  vec3 nextPos = pos;
  vec3 nextVel = vel;
  integrate(nextPos, nextVel, force, uDamping, uDt, uMaxSpeed);

  fragColor = vec4(nextVel, seed);
}
