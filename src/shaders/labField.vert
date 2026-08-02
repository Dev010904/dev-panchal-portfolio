precision highp float;

/**
 * THE LAB — 46k point field, physics evaluated analytically in the vertex shader.
 *
 * WHY NO GPGPU PING-PONG:
 * A stateful FBO simulation is the usual answer and it is the wrong one here.
 * State drifts, it cannot be scrubbed backwards, it doubles the draw calls, and
 * on integrated graphics the extra render targets are exactly what pushes this
 * under 60fps. Everything below is a closed-form function of (home, seed, time),
 * so the field is perfectly reproducible, costs one draw call, and cannot drift.
 *
 * THE SPRING:
 * The pointer's influence is not a static push. The last N pointer samples are
 * kept with birth times, and each contributes a displacement shaped by
 *
 *     e^(-k*age) * cos(w*age)
 *
 * — an analytic damped oscillator. The exponential is the magnetic pull home;
 * the cosine is the overshoot that makes it *snap* rather than slide. The
 * disturbance radius also grows with age, so a stroke leaves a spreading wake
 * that settles, instead of a hole that closes.
 */

#define SAMPLES 16
#define SHOCKS 6

attribute vec3 aHome;
attribute vec3 aCloud;
attribute float aSeed;

uniform float uTime;
uniform float uFormation;     // 0 = dispersed cloud, 1 = resolved text
uniform vec3  uSamples[SAMPLES];   // xy = position, z = birth time
uniform float uScatterRadius;
uniform float uScatterStrength;
uniform float uFalloff;
uniform float uStiffness;     // spring frequency w
uniform float uDamping;       // decay k
uniform vec4  uShocks[SHOCKS];     // xy = origin, z = birth time, w = strength
uniform float uShockSpeed;
uniform float uShockWidth;
uniform float uShockLife;
uniform float uBlast;         // 0..1 held detonation — see components/HoldToBlast
uniform float uBlastStrength;
uniform float uBlastDrift;    // ambient wander while the blast is held open
uniform float uHeldFor;       // seconds the blast has been held
uniform float uShake;         // 0..1 tremor during the hold
uniform float uShakeStrength;
uniform float uPointSize;
uniform float uPixelRatio;
uniform float uFrozen;        // 1 = prefers-reduced-motion: hold the end state

varying float vEnergy;
varying float vDepth;

#include <noise>

void main() {
  vec3 seedv = hash31(aSeed * 137.13);

  // Formation: cloud -> text. Staggered per particle so the letters do not
  // all resolve on the same frame; that stagger is most of the effect.
  float lead = seedv.x * 0.42;
  float f = clamp((uFormation - lead) / max(1.0 - lead, 0.001), 0.0, 1.0);
  f = f * f * (3.0 - 2.0 * f);
  vec3 pos = mix(aCloud, aHome, f);

  float energy = 0.0;

  if (uFrozen < 0.5) {
    // ── Ambient breath ────────────────────────────────────────────────────
    // Without this the resolved text is dead flat and reads as a PNG.
    float bt = uTime * 0.22 + seedv.y * 6.28;
    pos += vec3(
      snoise(pos.xy * 0.55 + bt),
      snoise(pos.yx * 0.55 - bt),
      snoise(pos.xy * 0.31 + bt * 0.7)
    ) * 0.022 * mix(2.6, 1.0, f);

    // ── Pointer wake, damped-oscillator response ──────────────────────────
    for (int i = 0; i < SAMPLES; i++) {
      float age = uTime - uSamples[i].z;
      if (uSamples[i].z < 0.0 || age > 2.2) continue;

      vec2 d = pos.xy - uSamples[i].xy;
      float r = length(d);

      // Radius grows as the disturbance spreads outward and thins.
      float radius = uScatterRadius * (1.0 + age * 0.85);
      float t = clamp(1.0 - r / radius, 0.0, 1.0);
      float shape = pow(t, uFalloff);

      float env = exp(-uDamping * age * 3.4) * cos(uStiffness * age * 3.1);
      float amt = shape * env * uScatterStrength / (1.0 + age * 1.6);

      vec3 dir = vec3(d / max(r, 1e-4), (seedv.z - 0.5) * 0.9);
      pos += dir * amt;
      energy += abs(amt);
    }

    // ── Click shockwaves ──────────────────────────────────────────────────
    for (int i = 0; i < SHOCKS; i++) {
      float birth = uShocks[i].z;
      if (birth < 0.0) continue;
      float age = uTime - birth;
      if (age < 0.0 || age > uShockLife) continue;

      vec2 d = pos.xy - uShocks[i].xy;
      float r = length(d);
      float ring = age * uShockSpeed;
      float band = 1.0 - smoothstep(0.0, uShockWidth, abs(r - ring));
      float decay = 1.0 - age / uShockLife;
      float amt = band * decay * decay * uShocks[i].w;

      pos += vec3(d / max(r, 1e-4), 0.0) * amt;
      pos.z += amt * (seedv.z - 0.5) * 1.4;
      energy += amt * 1.4;
    }

    // ── The hold ─────────────────────────────────────────────────────────
    // Every point jitters on its own seed, re-rolled each frame by quantising
    // time to the frame rate. Per-point rather than per-field: shaking the
    // whole cloud as one body would just look like the camera moving.
    if (uShake > 0.001) {
      vec3 j = hash31(aSeed * 7.31 + floor(uTime * 60.0) * 0.137) - 0.5;
      pos += j * uShake * uShakeStrength;
      energy += uShake * 0.6;
    }

    // ── Hold to detonate ──────────────────────────────────────────────────
    // A held state, not a timed envelope. The field stays blown apart for
    // exactly as long as the pointer is down, because uBlast is driven from
    // the same scrubbed timeline the mark uses. The old version fired on a
    // 1000ms setTimeout and then played out on its own clock, so the press had
    // a full second of dead air in front of it and letting go did nothing.
    if (uBlast > 0.001) {
      vec3 dir = normalize(seedv - 0.5 + vec3(0.0, 0.0, 0.001));
      pos += dir * uBlast * uBlastStrength * (0.5 + seedv.x);

      // While it is held open the cloud keeps wandering, so a long press is a
      // living field rather than a paused frame.
      float w = uHeldFor * 0.6 + seedv.y * 6.28;
      pos += vec3(sin(w), cos(w * 0.83), sin(w * 1.27)) * uBlast * uBlastDrift * (0.2 + seedv.z);

      energy += uBlast * 2.2;
    }
  }

  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;

  vDepth = -mv.z;
  vEnergy = clamp(energy * 1.35, 0.0, 1.0);

  // Perspective-correct point size, with a floor so distant points never
  // vanish into sub-pixel flicker.
  float size = uPointSize * uPixelRatio * (1.0 + vEnergy * 1.1);
  gl_PointSize = max(size * (3.4 / max(vDepth, 0.1)), 0.9 * uPixelRatio);
}
