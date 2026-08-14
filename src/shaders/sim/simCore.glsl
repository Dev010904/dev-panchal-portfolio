// THE PARTICLE PHYSICS. THIS FILE IS THE PART THAT PORTS.
//
// Every function here is pure: it takes values and returns values. There is no
// texture fetch, no `gl_FragCoord`, no render-target plumbing anywhere in it.
// That is not tidiness for its own sake — it is the whole reason the WebGPU
// migration is a change of executor rather than a rewrite. A WGSL compute
// shader reading a storage buffer calls these same functions with the same
// arguments; only the two thin wrappers that fetch and store a texel are
// thrown away. See docs/WEBGPU-MIGRATION.md and lib/gpgpu/PingPong.ts.
//
// Constraint that outlives the backend: NO DERIVATIVES. `fwidth`/`dFdx` in a
// simulation kernel are meaningless (neighbouring texels are unrelated
// particles, not neighbouring pixels) and they are undefined behaviour in the
// divergent control flow this file is full of — the X3595 class of bug that
// docs/PERFORMANCE.md records twice.

const float TAU = 6.28318530718;

/**
 * THE FLOW FIELD — divergence-free ANALYTICALLY, not by finite differences.
 *
 * WHY NOT CURL-OF-NOISE, WHICH IS THE TEXTBOOK ANSWER.
 *
 * It was written that way first and it froze the browser. Curl by central
 * difference needs six samples per axis pair; with two independent scalar
 * fields that is twelve `fbm3` calls, each two octaves, each octave eight
 * gradient hashes with a `sin` in it — about 192 transcendental hashes per
 * particle per frame. At 250,000 particles that is ~48 million, twice a frame,
 * and an Intel Iris Xe simply stops. (Second time this session that a shader
 * was sized by reasoning instead of by counting; see docs/PERFORMANCE.md.)
 *
 * This is an ABC flow — Arnold-Beltrami-Childress — a closed-form solution of
 * Euler whose divergence is EXACTLY zero:
 *
 *     u = A·sin(z) + C·cos(y)
 *     v = B·sin(x) + A·cos(z)
 *     w = C·sin(y) + B·cos(x)
 *
 *     ∂u/∂x + ∂v/∂y + ∂w/∂z = 0 + 0 + 0
 *
 * So it is not an approximation of an incompressible field, it IS one — better
 * than the finite-difference curl it replaces, which is only divergence-free
 * to the order of its epsilon. Three octaves at irrational frequency ratios,
 * each rotated, gives the chaotic advection that reads as turbulence, for
 * eighteen trig ops instead of 192 hashes. Roughly fifty times cheaper and
 * more correct.
 *
 * The octaves are rotated because stacking ABC cells on the same axes leaves
 * a visible cubic lattice — the particles trace out the grid and the smoke
 * looks like it is flowing through a crate.
 */
vec3 abcFlow(vec3 p) {
  vec3 f = vec3(
    sin(p.z) + cos(p.y),
    sin(p.x) + cos(p.z),
    sin(p.y) + cos(p.x)
  );

  // Octave two, at 2.17x and yawed, so the cells do not align with octave one.
  vec3 q = vec3(p.y * 2.17 + 11.3, p.z * 2.17 - 4.1, p.x * 2.17 + 7.7);
  f += vec3(
    sin(q.z) + cos(q.y),
    sin(q.x) + cos(q.z),
    sin(q.y) + cos(q.x)
  ) * 0.42;

  // Octave three, finer again and rotated the other way.
  vec3 r = vec3(p.z * 4.63 - 2.9, p.x * 4.63 + 15.1, p.y * 4.63 + 3.3);
  f += vec3(
    sin(r.z) + cos(r.y),
    sin(r.x) + cos(r.z),
    sin(r.y) + cos(r.x)
  ) * 0.19;

  return f;
}

/**
 * THE LETTERFORM ATTRACTOR.
 *
 * A spring toward the particle's home position on the type. Deliberately a
 * spring and not a lerp: a lerp arrives and stops, which freezes the field into
 * a dead sign the moment it resolves. A spring with the flow field pushing
 * against it never settles — the letters hold their shape while every particle
 * in them keeps moving, which is the whole effect.
 *
 * `formation` is 0 when the field is loose and 1 when the type is the subject,
 * so the flow wins at one end and the spring wins at the other.
 */
vec3 attractorForce(vec3 pos, vec3 home, float formation, float stiffness) {
  return (home - pos) * (stiffness * formation);
}

/**
 * THE CURSOR WELL.
 *
 * Repulsion falling off smoothly to exactly zero at `radius`, rather than an
 * inverse-square that never quite reaches it. A force with an infinite tail
 * means every particle in the field is being nudged by the pointer at all
 * times, which shows up as the whole field breathing when the cursor moves at
 * the far edge of the screen.
 */
vec3 repulsionForce(vec3 pos, vec3 origin, float radius, float strength) {
  vec3 d = pos - origin;
  float dist = length(d);
  if (dist > radius || dist < 1e-5) return vec3(0.0);
  float t = 1.0 - dist / radius;
  return (d / dist) * (t * t * strength);
}

/**
 * THE DETONATION SHOCKWAVE.
 *
 * A travelling shell, not an impulse. `age` drives a radius outward at
 * `speed`, and only particles inside a band of `width` around that radius are
 * pushed — so the blast propagates THROUGH the field, arriving at the far side
 * measurably later than the near side, instead of every particle jumping at
 * once. That difference is the whole reason it reads as a shockwave.
 */
vec3 shockForce(vec3 pos, vec3 origin, float age, float speed, float width, float strength) {
  if (age <= 0.0) return vec3(0.0);
  vec3 d = pos - origin;
  float dist = length(d);
  if (dist < 1e-5) return vec3(0.0);

  float shell = age * speed;
  float band = 1.0 - clamp(abs(dist - shell) / width, 0.0, 1.0);
  // Energy falls with the shell's surface area, so the front weakens as it
  // expands the way a real one does.
  float decay = 1.0 / (1.0 + shell * shell * 0.35);
  return (d / dist) * (band * band * decay * strength);
}

/**
 * One integration step.
 *
 * Semi-implicit Euler — velocity first, then position from the NEW velocity.
 * Explicit Euler at these stiffnesses visibly gains energy and the field
 * slowly boils apart over a minute; semi-implicit is the same cost and is
 * stable for a spring.
 *
 * Damping is `exp(-k·dt)` for the same reason everything else on this site is:
 * so the field behaves identically at 60Hz and 144Hz.
 */
void integrate(inout vec3 pos, inout vec3 vel, vec3 force, float damping, float dt, float maxSpeed) {
  vel += force * dt;
  vel *= exp(-damping * dt);

  float sp = length(vel);
  if (sp > maxSpeed) vel *= maxSpeed / sp;

  pos += vel * dt;
}
