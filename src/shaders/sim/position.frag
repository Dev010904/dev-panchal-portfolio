precision highp float;

/**
 * POSITION PASS — the other thin wrapper.
 *
 * Runs AFTER the velocity pass and reads the velocity it just wrote, so the
 * integration is semi-implicit: position advances on the new velocity, not the
 * old one. Doing it the other way round is explicit Euler, which gains energy
 * against a spring and boils the field apart over a minute.
 *
 * `w` carries the particle's wake charge — how recently the cursor disturbed
 * it — which the render pass turns into brightness. It decays here rather than
 * in the velocity pass because it is a property of where the particle IS.
 */

out vec4 fragColor;

uniform sampler2D uPosition;
uniform sampler2D uVelocity;

uniform vec2  uResolution;
uniform float uDt;
uniform vec3  uPointer;
uniform float uPointerActive;
uniform float uRepelRadius;
uniform float uWakeDecay;
uniform float uBounds;

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;

  vec4 P = textureLod(uPosition, uv, 0.0);
  vec3 vel = textureLod(uVelocity, uv, 0.0).xyz;

  vec3 pos = P.xyz + vel * uDt;

  // ── The wake ────────────────────────────────────────────────────────────
  // Charged by proximity to the cursor, then dissipating on its own. The
  // charge is a MAX rather than an add, so sitting still under the pointer
  // does not accumulate to a blown-out blob — it saturates, and the trail
  // behind a moving cursor is the decay curve made visible.
  float wake = P.w * exp(-uWakeDecay * uDt);
  float d = length(pos - uPointer);
  float near = 1.0 - clamp(d / uRepelRadius, 0.0, 1.0);
  wake = max(wake, near * near * uPointerActive);

  // A soft cage. Particles that wander out are pulled back rather than
  // teleported: a wrap would tear the smoke, and letting them leave means the
  // field slowly empties into space over the length of the page.
  float r = length(pos);
  if (r > uBounds) pos -= normalize(pos) * (r - uBounds) * 0.12;

  fragColor = vec4(pos, wake);
}
