# WebGPU scene craft

Three.js scenes at this level fail **silently**. A shader with a reserved word
logs a warning and draws nothing. A geometry missing one attribute is skipped
before the draw call is even counted. A depth texture with the wrong filter
produces rainbow fringing that looks like a lighting bug. None of it is visible
to `tsc`, and most of it is invisible in a screenshot too.

So the discipline recorded here is: **measure the thing, do not reason
about the thing.** Every rule below came from a specific failure where careful
reasoning produced a confident wrong answer.

## The three pillars

1. **Dual-backend architecture** — write today's WebGL2 code so the WebGPU port
   is a change of executor, not a rewrite. → [`dual-backend.md`](./dual-backend.md)
2. **GPGPU particle fields** — simulation on float textures, and the catalogue
   of silent failures. → [`gpgpu-patterns.md`](./gpgpu-patterns.md)
3. **The design system** — dark, instrument-panel, one-accent. →
   [`design-system.md`](./design-system.md)

Read the reference document for the pillar you are working in. Read all three
before proposing an architectural change.

---

## The rule that outranks the others: distrust the instrument first

When a measurement comes back suspiciously clean, or suspiciously broken,
**suspect the measuring apparatus before you suspect the code.** On this
project, that was the correct call seven times running — including
one where the telemetry HUD honestly printed `DRAWS 0` and the *browser's GPU
process* was the thing that had died.

Before trusting any number:

```js
// Is the context alive at all?
gl.isContextLost()                    // false is necessary, not sufficient
// A fresh DETACHED canvas is the real test. If this also fails,
// the whole GPU process is down and only a browser restart clears it.
document.createElement('canvas').getContext('webgl2')
```

Symptoms of a dead GPU process, which are **not** code bugs: linked `programs`
collapsing (e.g. 49 → 13), texture readbacks returning all zeros, honest
`DRAWS 0`. Do not "fix" these.

Two more instrument traps that cost real time:

- **A backgrounded or occluded tab suspends rendering.** `ResizeObserver` never
  fires, the canvas sits at its 300×150 default, and no measurement means
  anything. Note that `document.visibilityState` can still report `"visible"`
  while `requestAnimationFrame` is throttled to near zero — check the actual
  frame delivery, not the flag.
- **An async probe can starve the thing it is measuring.** Counting rAF frames
  from inside a pending `await` in an injected/devtools context measures the
  injection, not the page. Install a free-running counter, return, and read it
  back in a separate call.

**Guard every frame-counting loop with a timeout.** A loop waiting for frames
that never arrive hangs the whole session.

---

## Measure on forced frames

Real frames are not reproducible: they arrive at the compositor's convenience
and accumulate into counters between your read and your write. Drive the clocks
by hand instead.

A forced-frame harness has to advance **every** clock, in production order, or
it lies to you:

```
stamp += dt
gsap.updateRoot(gsapTime)   // tweens
lenis.raf(stamp)            // smooth scroll integrates from the timestamp
runSteps(dt, stamp)         // DOM-side per-frame callbacks
clock.oldTime = now - dt    // make THREE.Clock report exactly dt
advance(...)                // the renderer
```

Two failure modes this shape exists to prevent:

- `gsap.updateRoot()` advances tweens but does **not** dispatch `gsap.ticker`
  callbacks. Miss that line and the whole DOM layer is frozen at the last real
  frame, so a screenshot taken after a forced tick is evidence about the 3D
  scene and nothing else.
- A stopped `THREE.Clock` silently returns a delta of `0`, and every time-based
  animation freezes with no other symptom. Force `running = true`.

**Expose a count of the DOM-side callbacks the harness is driving.** A zero
there, on a page that visibly has a cursor and a marquee, means the step
registry is disconnected and every DOM-side observation through the harness is
void. That number exists to make the failure loud instead of silent.

### `gl.info` has exactly one owner

`gl.info` resets at the start of every `render()` call, and a post-processing
stack calls `render()` several times per frame — finishing with a fullscreen
quad. Read `info.render` after the frame and you get **the cost of that quad**:
`drawCalls: 1, triangles: 1`, at every scroll position, forever.

The fix is `autoReset = false` plus exactly one component that resets before
the frame draws and publishes after. Two owners of that global flag is how the
bug comes back. Consequences to design around:

- Counters accumulate on real frames, so a bare read after idling returns the
  running total since load. Read **immediately after a forced tick**, in the
  same synchronous block, or the number is garbage.
- The published sample is one frame old by necessity: there is no point inside
  the loop that is after this frame's render and before the next frame's reset.
  One frame of lag on a 60 Hz readout is not observable. Reading the frame you
  reset is — it reports zero.

### Pin the scroll before capturing

Smooth-scroll libraries interpolate toward a *target*. Setting current scroll
without setting the target means the page eases back the moment real frames
resume — and taking a screenshot is exactly what causes real frames to resume,
because it fronts the tab. Write the target too, and offer a hold:

```js
lenis.scrollTo(y, { immediate: true, force: true });
lenis.targetScroll = y;   // without this it slides back under you
if (hold) lenis.stop();
```

---

## Silent-failure catalogue

These are the ones that produce **no error**. Full detail and the reasoning in
[`gpgpu-patterns.md`](./gpgpu-patterns.md); this is the recall list.

| Symptom | Cause |
|---|---|
| Geometry draws nothing, not even counted in `gl.info` | No `index` and no `position` attribute, so neither clamp on `drawRange` runs and the renderer returns early. Call `setDrawRange(0, count)`. |
| Shader "compiles" but the pass is invisible | `sample` is a **reserved word** in GLSL ES 3.00. Three logs it and carries on. |
| Fragment output missing under GLSL3 | Declare your own `out vec4`; `gl_FragColor` is not available. |
| Browser freezes on a flow field | Curl-of-noise by central difference is ~192 transcendental hashes per particle per frame. Use an ABC flow — divergence-free in closed form, ~50× cheaper. |
| Stair-stepped depth with rainbow fringing | **Packed depth cannot be filtered.** `RGBADepthPacking` into an 8-bit target with `LinearFilter` blends the packed *bytes* independently. Use half-float. |
| Shader edits silently lost on a cloned material | `Material.clone()` drops `onBeforeCompile`. Clone through a helper that reattaches it. |
| Driver warning X3595 / gradient artefacts | `fwidth` in divergent control flow. Keep every gradient in **uniform** control flow. |
| Field renders but washes the frame orange | Speed→colour ramp tuned by eye. Measure the speed distribution and set the scale against the actual median. |

**`tsc` passing is not evidence a file is wired up.** GSAP ships a UMD global
type declaration, so `gsap.timeline()` with no import typechecks clean and
fails at runtime. Check imports by eye.

---

## Deciding what ships

The hardest-won lesson here is not technical.

A 350k-particle GPGPU field was built, debugged, measured and made correct —
and then **not shipped**, because side by side against the 46k CPU field it
read as *a static sign with more dots in it*, while the cheaper version read as
a field you are pushing around. The work stayed in the tree, mounted and
switched off, because it is what the WebGPU migration ports.

Apply the same test to your own work: **an effect that reads as a demo gets
cut, however much work is in it.** Effort already spent is not an argument for
shipping. When you have built something impressive that is not better, say so
plainly and keep the simpler thing.

Corollaries worth keeping:

- **Keep the CPU path alive.** It is the mobile and low-tier fallback and a
  live code path, not dead weight.
- **Tier ladders are fixed rungs, never a continuous scale.** A particle count
  that drifts with load makes every other number in your telemetry
  unreproducible, which defeats having telemetry.
- **Normalise exposure across the ladder.** Without a density gain, total
  emitted luminance scales with particle count and the section's brightness is
  decided by the visitor's graphics card.
- **Report the live value, never a build-time constant.** A header reading
  "46K POINTS · GPU" while the GPU path ran 350,464 on a CPU-updated field is
  the kind of caption that makes every other claim on the page suspect. If a
  label names a backend, resolve it from the live renderer or drop the word.

---

## When asked to port to WebGPU

Do not start with the renderer swap. The order that works, and why, is in
[`dual-backend.md`](./dual-backend.md). The short version:

1. Find out what the **post-processing stack** costs you. `postprocessing` /
   `@react-three/postprocessing` is structurally WebGL-only; installing
   `WebGPURenderer` does not degrade a grade built on it, it **deletes** it.
2. Upgrade three **first**, on the WebGL path, and re-run the full regression.
   Porting from an old version means porting to an API that has since moved.
3. Re-author the grade as TSL nodes, still on WebGL. Match by A/B screenshot at
   three fixed scroll positions — not by comparing parameters, because the
   parameters do not correspond.
4. **Gate:** if the grade is distinguishable from the current one, stop.
   Nothing below this line matters until it passes.
5. Only then swap the renderer, then port the sim to compute.

Structure today's code so step 5 is cheap: keep the **physics** in pure
functions with no texture fetches and no `gl_FragCoord`, and keep the
plumbing — read a texel, write a texel, swap — in thin wrappers. Physics
inlined into a fragment shader works just as well today and cannot be ported
without being rewritten.

---

## Checklist before calling a scene done

- Context health confirmed, on a real frame, before any number is trusted
- Zero X3595 or driver warnings — and confirm your log reader is live by
  proving it captured something from *this* page load, because console buffers
  replay stale messages
- Telemetry readouts non-zero and changing between sections
- The reduced-motion path still looks *designed*, not stripped
- Every timing, distance, camera angle and easing lives in one config module,
  not as a literal in a component
- Frame-rate independence: damping is `1 - exp(-k·dt)`, never a fixed lerp
  factor
