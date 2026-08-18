# Dual-backend architecture

How to run on WebGL2 today and keep the WebGPU port to a change of executor
rather than a rewrite.

## Contents

- [One module answers "which backend"](#one-module-answers-which-backend)
- [`active()` vs `supported()` — and why they differ](#active-vs-supported)
- [Typing `navigator.gpu` without a dependency fight](#typing-navigatorgpu)
- [The blocker: post-processing is WebGL-only](#the-blocker)
- [TSL parity, checked rather than recalled](#tsl-parity)
- [The switch-over order](#the-switch-over-order)
- [What must not change](#what-must-not-change)
- [Compute-shaped work worth deferring](#compute-shaped-work)

---

## One module answers "which backend"

The seam is a single module. Without it, the HUD sniffs `navigator.gpu`, the
quality tiers sniff it again, the QA harness sniffs it a third time, and they
disagree — usually at the worst moment, when one of them has fallen back and
the others have not noticed.

Build this module **before** you need it. It costs almost nothing and it is the
thing every later step attaches to.

```ts
export type Backend = 'webgpu' | 'webgl2' | 'webgl' | 'none';

export function active(): Backend;     // read off the LIVE renderer instance
export function supported(): Backend;  // what this device could do
export function probeWebGPU(): Promise<boolean>;  // the real, async answer
```

## `active()` vs `supported()`

These are different questions and conflating them hides fallbacks.

- **`active()`** reads the backend off the live renderer instance. If the
  WebGPU path is ever switched on and silently falls back, `active()` reports
  the fallback. Your telemetry must print **this**, never a build-time
  constant — otherwise the readout shows the intention rather than the reality,
  which is the one thing a readout must never do.
- **`supported()`** is a capability *hint*, deliberately synchronous and
  deliberately shallow. `navigator.gpu` existing is not proof an adapter can be
  acquired; that needs an `await` and can fail on a blocklisted driver.
  Anything that would break on being wrong must call `probeWebGPU()` and wait.

The two being different is the honest state of things. Show both.

For the WebGL capability probe, **create a throwaway context** rather than
sniffing `WEBGL_debug_renderer_info`. The debug extension is fingerprinting
surface and is being locked down — some browsers block it outright, in which
case an honest tier probe reports "unrecognised GPU, middle rung", and that is
correct behaviour rather than a bug. A context probe answers the only question
that matters and costs nothing once cached.

## Typing `navigator.gpu`

TypeScript's `lib.dom` has no WebGPU types. `'gpu' in navigator` narrows to
`unknown`, and a truthiness check narrows that to `{}` — which is where
`requestAdapter does not exist` comes from.

Declare a **local minimal shape**, not a global:

```ts
type GpuLike = { requestAdapter(): Promise<unknown> };

function gpuOf(nav: Navigator): GpuLike | null {
  const g = (nav as Navigator & { gpu?: unknown }).gpu;
  return g && typeof (g as GpuLike).requestAdapter === 'function' ? (g as GpuLike) : null;
}
```

A global `declare global { interface Navigator { gpu: ... } }` would work today
and then collide with `@webgpu/types` the moment the migration adds it as a
real dependency. A local shape cannot collide with anything.

## The blocker

**This is usually the thing that decides the timeline, so establish it first.**

`postprocessing` (and its R3F wrapper) is structurally WebGL-only: the build is
saturated with `WebGLRenderer` / `WebGLRenderTarget` references, and
`EffectComposer` merges effects into a single fullscreen **WebGL** pass. There
is no WebGPU build.

So installing `WebGPURenderer` does not degrade a grade built on it. It
**deletes** it. If your grade is load-bearing — and a colour grade on a very
dark page usually is, because it is what stops the render looking digitally
clean — then the port is gated on re-authoring the grade, not on the renderer.

Say this out loud early. "We're blocked on the post stack, not on WebGPU" is a
much more useful project statement than "the port is hard".

## TSL parity

Check parity against the **installed files**, not against recollection. A
representative audit of a four-effect grade:

| Effect | TSL node | Parity |
|---|---|---|
| Bloom | `bloom(node, strength, radius, threshold)` | **close.** No `luminanceSmoothing`; `mipmapBlur` is internal rather than a flag. Retunable. |
| Chromatic aberration | `rgbShift(node, amount, angle)` | **partial.** No radial modulation — if yours is radial, that is the whole point of it. Hand-author. |
| Film grain | `film(node, intensity)` | **partial.** No blend-function control. If you chose SOFT_LIGHT over OVERLAY for a reason, you need that control. Hand-author. |
| Vignette | **none** | absent. Trivial to write in TSL, but that is writing, not wiring. |

The honest summary of a typical grade: **bloom ports; the rest is
re-authoring.** That is a real piece of work and it is not a dependency bump.

### The version gap

Most of the TSL surface stabilised over a long run of releases — node-material
APIs, the `PostProcessing` pipeline object, and much of the `three/webgpu`
entry point all moved. Porting from an old three means writing TSL against a
shape that has since changed, twice.

**Upgrade three first, port second.** The other order means doing the work
twice.

## The switch-over order

Each step is independently revertable. Nothing after step 3 is worth starting
until step 3 passes.

1. **Upgrade three** on the WebGL path, unchanged. Land it and run the whole
   regression against it. This is the step most likely to break something
   quietly — physical-material transmission and dispersion, which any glass
   look depends on, move in these windows.
2. **Re-author the grade as TSL nodes**, still on WebGL, using the
   `PostProcessing` pipeline object rather than the WebGL composer.
3. **Gate:** the grade must be indistinguishable from the current one at three
   fixed scroll positions, compared by A/B screenshot. Compare *images*, not
   parameters — the parameters do not correspond. If it is distinguishable,
   stop; the port is not ready.
4. **Swap the renderer.** R3F supports an async custom renderer; that is the
   `<Canvas gl={...}>` seam. `active()` should start reporting `WEBGPU` with no
   other change, and the telemetry proves it.
5. **Port the sim to compute.** Physics core → WGSL, ping-pong targets →
   storage buffers, the fragment wrappers deleted.
6. **Re-probe capability.** A float-render-target extension check is a WebGL
   question; under WebGPU the equivalent is adapter limits and storage-buffer
   support. The CPU fallback must survive the rewrite — it is still the mobile
   path.
7. **Keep the WebGL path alive.** WebGPU is unavailable or blocklisted often
   enough that a one-way switch is a regression for a real share of visitors.
   Make it a runtime choice.

## What must not change

- **The CPU field stays.** Mobile and low-tier fallback, live code path.
- **The tier ladder stays fixed.** Named rungs, never a continuous scale.
- **The background colour stays exactly what it was.** Any grade that lifts the
  black is wrong regardless of which API drew it.

## Compute-shaped work

Some effects are worth *deferring to* WebGPU rather than forcing into WebGL2.
The tell is a pass that wants scattered accumulation.

Caustics are the standard example. The cheap approach — deriving them from the
Laplacian of light-space depth — has a geometric precondition worth stating,
because it is easy to attempt twice:

> The estimator assumes curvature. A **flat extrusion**'s depth from the light
> is piecewise constant: a plateau per face, a step at the silhouette. The
> Laplacian of that is zero on the plateaus and a delta at the discontinuity,
> so you can only ever get a hard band along the shadow edge — never a focused
> pool, because there is no curvature anywhere to focus. Widening the stencil
> blurs the band into a grey wedge; it does not become a caustic. **The failure
> is in the input signal, not the filter.**

A real caustic needs ray *directions*, not a depth field: both refracting
interfaces with normals, a Snell's-law refraction pass, and a splat pass that
accumulates energy where rays land — so convergence is emergent from ray
density rather than estimated from curvature. Run it at three IORs and
dispersion falls out for free.

That splat pass is a storage buffer with atomic adds. It is the shape the
effect actually wants and it is what WebGL2 cannot express without
render-target contortions — so it belongs **after** the renderer swap, not
before.
