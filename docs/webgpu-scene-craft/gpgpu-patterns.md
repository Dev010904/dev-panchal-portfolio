# GPGPU particle patterns

Simulating a large particle field on float textures, structured so the compute
port is cheap — and the catalogue of failures that produce no error message.

## Contents

- [Structure: physics vs plumbing](#structure-physics-vs-plumbing)
- [The ping-pong surface](#the-ping-pong-surface)
- [Capability gating and the tier ladder](#capability-gating-and-the-tier-ladder)
- [The silent-failure catalogue](#the-silent-failure-catalogue)
- [Reading the simulation back](#reading-the-simulation-back)
- [Exposure: making a field look right by measurement](#exposure)
- [Case study: the field that was built and not shipped](#case-study)

---

## Structure: physics vs plumbing

The single decision that determines whether a GPGPU field can be ported:

- **Physics** lives in a shared include as **pure functions** — no texture
  fetches, no `gl_FragCoord`, no sampler uniforms. This file translates into
  WGSL/TSL near enough line for line.
- **Plumbing** — read a texel, write a texel, swap buffers — lives in thin
  fragment wrappers and in the ping-pong helper. This is the part you throw
  away.

A simulation with the physics inlined into the fragment shader works exactly as
well today and **cannot be ported without being rewritten**. That is the entire
reason for the split; it buys nothing else, and it is worth it anyway.

```
shaders/sim/
  simCore.glsl     ← pure functions. ports.
  position.frag    ← wrapper. thrown away.
  velocity.frag    ← wrapper. thrown away.
lib/gpgpu/
  PingPong.ts      ← executor. swapped for storage buffers.
```

## The ping-pong surface

Keep the caller-facing API to two things:

```ts
step()      // advance one simulation step
current     // the target to read from this frame
```

That is deliberately minimal. The WebGPU version replaces fragment shaders with
compute shaders and render targets with storage buffers — a change to the
*executor*, not to the caller. Every extra method you expose is another thing
that has to survive the swap.

Integrate with **semi-implicit Euler** (update velocity, then use the *new*
velocity to update position). It is stable under the spring forces these fields
usually carry, and it is one line different from the explicit version that
quietly explodes.

## Capability gating and the tier ladder

Gate on the actual requirement. For float ping-pong on WebGL2 that is
`EXT_color_buffer_float` — without it, rendering to a float target fails and
you need the CPU path.

**Cache the probe per renderer.** If the call site and the field each probe
independently they can disagree about the tier, and then the header prints one
number while the simulation runs another.

The ladder is **fixed named rungs** — e.g. 500k / 350k / 250k / CPU — never a
formula and never a continuous scale. A particle count that drifts with load
makes every other number in your telemetry unreproducible, which defeats the
point of having telemetry at all.

Expose a dev-only override (`?field=cpu` / `?field=gpu`) so the fallback is a
branch that can actually be exercised. A fallback nobody ever reaches is a
fallback nobody knows is broken.

## The silent-failure catalogue

Every entry here produced **no error** and cost real time.

### 1. Geometry with no `position` attribute never draws

The one that looks most like a physics bug and is not.

A GPGPU field's geometry legitimately carries only a reference attribute (which
texel each particle reads) — positions live in the simulation texture. But the
renderer derives its vertex count from exactly two places:

```js
if ( index !== null )         drawEnd = min(drawEnd, index.count)
else if ( position != null )  drawEnd = min(drawEnd, position.count)
const drawCount = drawEnd - drawStart;
if ( drawCount < 0 || drawCount === Infinity ) return;   // ← silently returns
```

With no index and no `position`, neither clamp runs, `drawRange.count` keeps
its default of `Infinity`, and the renderer **returns before submitting
anything**. No GL error. No shader warning. The draw call is not even counted
in `gl.info`, so telemetry shows nothing missing.

**Fix:** `geometry.setDrawRange(0, count)`. Zero bytes. A dummy `position`
attribute would communicate the same single integer at a cost of megabytes of
zeros.

**Diagnostic tell:** the field appears *faint* rather than absent → you are
probably looking at a different field still drawing underneath it. Absent and
faint are different symptoms; check which one you actually have by unmounting
the other layer.

### 2. `sample` is a reserved word in GLSL ES 3.00

The shader fails to compile with "Illegal use of reserved word". Three logs it
and carries on, so the symptom is a silently invisible pass. Nothing `tsc` can
see. Other names worth avoiding for the same reason: `filter`, `input`,
`output`, `active`.

### 3. GLSL3 needs its own fragment output

Under `glslVersion: GLSL3` there is no `gl_FragColor`. Declare `out vec4
fragColor;` yourself. Forgetting this is a compile error you will only see if
you are reading the console.

### 4. Curl-of-noise will freeze the browser

Curl by central difference is twelve fbm calls, each several octaves, each
octave several sin-based hashes — on the order of **192 transcendental hashes
per particle per frame**, twice a frame. At 250k particles that is tens of
millions of transcendentals per frame.

Use an **ABC flow** instead: divergence-free in *closed form* rather than to
the order of an epsilon, about 18 trig ops, ~50× cheaper **and** more correct.

The general lesson: **size a shader by counting its operations, not by
reasoning about whether it "feels expensive".** Sizing a volume by reasoning
hung a browser hard enough to time out screenshot injection on the same
project.

### 5. Packed depth cannot be filtered

`RGBADepthPacking` into an 8-bit target with `LinearFilter` produces
stair-stepping with rainbow fringing at every texel boundary. Bilinear
filtering blends the four packed **bytes** of adjacent texels independently —
the low byte of one depth interpolated with the low byte of another does not
decode to anything near the depth between them.

Use a **half-float** target. Anything else reading that depth map (volumetric
shafts, SSAO) benefits from the same change.

### 6. `Material.clone()` drops `onBeforeCompile`

Any shader injection you did is silently lost on the clone. Route cloning
through a helper that reattaches it.

### 7. `fwidth` in divergent control flow

Produces driver warnings (ANGLE X3595) and gradient artefacts. Compute every
gradient in **uniform** control flow, then branch on the result — never branch
and then take a derivative inside the branch.

### 8. `tsc` is not a wiring check

GSAP ships a UMD global type declaration, so `gsap.timeline()` with **no
import** typechecks clean and fails at runtime. A passing typecheck is not
evidence a file is connected. Check imports by eye.

## Reading the simulation back

A field that renders as a faint haze is either simulating wrongly or is simply
too small to see, and **those look identical from the outside.** The only way
to tell them apart is to read the numbers off the GPU.

Expose the live simulation targets to a dev harness and report:

- **extent** (min/max per axis) — compare against what the target shape should
  measure. This is the check that distinguishes "converging to the wrong place"
  from "converging correctly but too small to read".
- **non-finite count** — one NaN in a vertex buffer kills the entire draw call,
  not the one bad particle.
- **speed percentiles** (p05 / p50 / p95) — needed for exposure, below.

A worked example of why this matters: a field was reported as converging into a
blob "instead of spreading across the letterforms". The harness said extent
X `[-2.06, 2.39]`, Y `[-0.55, 0.48]` — which *was* the letterform band, given
the raster and scale in use. **The simulation had been correct the whole time
and the measurement had been read wrong.** The real defect was in the render
(entry 1 above). Measuring the right thing and then misreading it is its own
failure mode; state what the expected number is *before* you look.

## Exposure

Additive points on a very dark page will wash the frame if the speed→colour
ramp is set by eye. Set it from the measured distribution instead.

Worked example: measured speeds were p05 `0.96` / p50 `2.28` / p95 `3.61`. A
speed scale of `0.42` saturated the heat term at `2.38` — **below the median**,
pinning more than half the field at full accent every frame. Correct value was
`0.22`, derived from the p95, not guessed.

Two more exposure rules:

- **Depth fade.** If the CPU path has one and the GPU path does not, the two
  will never match no matter how the colours are tuned.
- **Density gain, so total emitted luminance is invariant across the tier
  ladder.** Without it the 500k rung is twice as bright as the 250k one, and
  the section's exposure is decided by the visitor's graphics card.

Settling a field takes a few hundred stepped frames, so a reload per candidate
value costs about a minute each. **Expose the render uniforms to a live
harness** so values can be turned on a running page. Guessing was demonstrably
worse than measuring on every effect where this was tried.

## Case study

A 350k-particle GPGPU field was built, wired, debugged and made correct. Then
it was **shipped off**, and the 46k CPU field it was meant to replace stayed.

Why: side by side, the CPU field's scatter, magnetic reform and shockwaves read
as *a field you are pushing around*. The denser version read as *a static sign
with more dots in it*. Same rule that cut the caustics — **an effect that reads
as a demo gets cut, however much work is in it.**

The GPU path stayed in the tree, mounted and switched off, rather than deleted:
it works, and it is exactly what the compute port will carry over.

One honest loose end recorded rather than quietly fixed: the field **settles**.
The design intent was "a spring against the flow never settles", but the flow
was applied as a *force*, so with a spring and damping each particle reaches a
static equilibrium — measured p50 speed decaying `0.47 → 0.18 → 0.05 → 0.026`
over 300 frames. That is a fixed point, not the limit cycle the comment
described. Real advection would carry the particle *at* the flow velocity
rather than accelerate it by it. Left alone because the path is off — but
written down, because the next person will otherwise rediscover it.

**Record the defects you chose not to fix.** A known bug with a reason is
engineering; an unknown one is a trap.
