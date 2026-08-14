# WebGPU migration

What it would take to move this site off `WebGLRenderer`, what actually blocks
it today, and the order to do it in when the blocker clears.

`src/lib/backend.ts` and `src/lib/gpgpu/PingPong.ts` both point here. This is
the document those references are for.

---

## Status: NOT DONE, and deliberately so

The site ships on `WebGLRenderer`. `backend.active()` reads that off the live
renderer instance and reports `WEBGL2`, and the telemetry HUD prints whatever
it says rather than a build-time constant — so if the WebGPU path is ever
switched on and silently falls back, the HUD shows the fallback instead of the
intention.

This is not "we did not get round to it". There is one specific blocker and it
is load-bearing.

---

## The blocker: the post stack has no WebGPU path

The grade is four effects, in `src/scenes/Effects.tsx`, and each of them is
there for a reason recorded in that file:

| Effect | Setting | Why it is there |
|---|---|---|
| `Bloom` | low intensity, high threshold | only chamfer highlights and the ember keeper cross it |
| `ChromaticAberration` | 0.00055, **radial**, `modulationOffset 0.32` | stops the render looking digitally clean; centre stays crisp |
| `Noise` | 0.028, **SOFT_LIGHT** | hides gradient banding on a #08080A page; reads as film |
| `Vignette` | gentle, last | pulls the eye to the mark |

All four come from `@react-three/postprocessing` 3.0.4, which wraps
`postprocessing` 6.39.4. **That library is structurally WebGL-only** — its build
carries 171 references to `WebGLRenderer` / `WebGLRenderTarget`, its
`EffectComposer` merges effects into a single fullscreen WebGL pass, and there
is no WebGPU build of it. Installing `WebGPURenderer` does not degrade the
grade; it deletes it.

The brief's own gate forbids shipping a regression, and losing the entire grade
is the largest regression available on this site. So the port waits.

### What three r171 does give you, precisely

r171 ships `three/webgpu` and `three/tsl`, and
`three/examples/jsm/tsl/display/` carries real TSL effect nodes. Parity against
the four effects above, checked against the installed files rather than
recalled:

| Ours | TSL node in r171 | Parity |
|---|---|---|
| Bloom | `bloom(node, strength, radius, threshold)` | **close.** No `luminanceSmoothing`; `mipmapBlur` is internal rather than a flag. Retunable. |
| ChromaticAberration | `rgbShift(node, amount, angle)` | **partial.** No `radialModulation`, no `modulationOffset` — ours is radial and that is the whole point of it. Needs hand-authoring. |
| Noise, SOFT_LIGHT | `film(node, intensity)` | **partial.** No blend-function control. SOFT_LIGHT was chosen over OVERLAY because OVERLAY turned the one light-background element on the site into black-and-white speckle. Needs hand-authoring. |
| Vignette | **none** | absent from r171 entirely. Trivial to write in TSL, but it is writing, not wiring. |

So the honest summary is: **bloom ports, and the other three have to be
re-authored as TSL nodes and then matched by eye against the current look.**
That is a real piece of work and it is not a dependency bump.

### The version gap

The production site studied in `docs/trionn-teardown.md` is on **r182**; this
one is on **r171**. Eleven releases is where most of the TSL surface stabilised
— node-material APIs, the `PostProcessing` pipeline object, and a good deal of
the `three/webgpu` entry point moved in that window. Porting from r171 means
porting to an API that has since changed, twice.

**Upgrade three first, port second.** Doing it in the other order means writing
TSL against r171's shape and then migrating that work again.

---

## What is already done, and why

The GPGPU field was written with this port as an explicit constraint, and that
shaped it more than anything else:

- **The physics lives in `src/shaders/sim/simCore.glsl`**, as pure functions
  with no texture fetches and no `gl_FragCoord`. That file ports into WGSL /
  TSL near enough line for line.
- **The plumbing — read a texel, write a texel, swap buffers — lives in the two
  thin `.frag` wrappers and in `PingPong.ts`.** That is the part that gets
  thrown away.
- **`PingPong`'s surface is `step` / `current`**, nothing more. The WebGPU
  version replaces fragment shaders with compute shaders and render targets
  with storage buffers, which is a change to the *executor*, not to the caller.

A simulation with the physics inlined into the fragment shader works exactly as
well today and cannot be ported without being rewritten. Avoiding that is the
reason this file exists.

`lib/backend.ts` is the other half: one module answers "which backend", so the
HUD, the QA harness and the quality tiers do not each sniff for `navigator.gpu`
and disagree.

---

## Switch-over checklist

In order. Each step is independently revertable, and nothing after step 3 is
worth starting until step 3 passes.

1. **Upgrade three to r182+** on the WebGL path, unchanged. Land it and verify
   the whole regression pass against it. This is the step most likely to break
   something quietly — `MeshPhysicalMaterial`'s transmission/dispersion, which
   the glass state depends on, moved in this window.
2. **Re-author the grade as TSL nodes**, still on WebGL, using
   `PostProcessing` rather than `@react-three/postprocessing`. Bloom from
   `bloom()`; aberration, grain and vignette hand-written. Match by A/B
   screenshot at hero, Deconstruction and Work — not by reading the parameters,
   because the parameters do not correspond.
3. **Gate:** the four-effect grade must be indistinguishable from the current
   one at those three positions. If it is not, stop — the port is not ready and
   nothing below this line matters.
4. **Swap the renderer.** R3F 9.6.1 supports an async custom renderer; that is
   the `<Canvas gl={...}>` seam. `backend.active()` should start reporting
   `WEBGPU` with no other change, and the HUD proves it.
5. **Port the sim to compute.** `simCore.glsl` → WGSL, `PingPong` → storage
   buffers, the two `.frag` wrappers deleted. The tier ladder stays a fixed
   ladder — 500k/350k/250k, never a continuous scale, for the reason in
   `PingPong.ts`.
6. **Re-probe capability.** `probeCapability` gates on
   `EXT_color_buffer_float`, which is a WebGL question. Under WebGPU the
   equivalent is adapter limits and storage-buffer support, and the CPU
   fallback must survive the rewrite — it is still the mobile path.
7. **Keep the WebGL path alive.** WebGPU is unavailable or blocklisted often
   enough that a one-way switch would be a regression for a real share of
   visitors. `backend.supported()` and `probeWebGPU()` already exist to make
   this a runtime choice.

### What must NOT change

- The CPU field stays. It is the mobile and low-tier fallback and it is a live
  code path, not dead weight.
- The fixed tier ladder stays fixed. A drifting particle count makes every
  other number in the HUD unreproducible.
- `#08080A` stays `#08080A`. Any grade that lifts the black is wrong regardless
  of which API drew it.

---

## Caustics: why there are none, and what a real one needs

Recorded here rather than only in `docs/PERFORMANCE.md` because it is a piece
of rendering work that a future session will otherwise attempt a third time.
The effect was built twice and cut twice.

### Why both attempts failed

Both derived the caustic from the **Laplacian of the mark's light-space
depth** — the standard cheap approximation, on the reasoning that where the
refracting surface is concave, refracted rays converge.

That reasoning has a geometric precondition this object does not meet.

**The mark is a flat extrusion.** Its depth as seen from the light is
*piecewise constant*: a plateau across each face, with a step at the silhouette
and nowhere else. The Laplacian of a piecewise-constant function is zero on the
plateaus and a **delta function at the discontinuity**. So the estimator can
only ever produce a hard band along the shadow edge. It cannot produce a
focused pool, because there is no curvature anywhere for it to focus.

Widening the stencil blurs that band into a grey wedge. It does not turn it
into a caustic, and no amount of tuning will, because the failure is in the
input signal rather than in the filter. Attempt two, on a clean 512² float map
with a multi-scale stencil, produced exactly the predicted hard-edged wedge.

**This is not a bug to be fixed. It is the wrong method for this geometry.**

### The real bug found underneath it, which is worth keeping

Attempt one also came back stair-stepped with rainbow fringing at every texel
boundary, and that *was* a genuine defect:

> The depth target was `RGBADepthPacking` into an 8-bit target with
> `LinearFilter`. Bilinear filtering blends the four packed BYTES of adjacent
> texels independently — the low byte of one depth interpolated with the low
> byte of another does not decode to anything near the depth between them.
> **Packed depth cannot be filtered.**

The target is half-float now, which fixed the fringing. The volumetric shafts
read from the same map and benefit, so that change stayed after the caustics
were cut.

### What a real one would need

Caustics are about where refracted rays **land**, which means you need the ray
directions, not the depth field:

1. **Both surfaces.** Front and back faces of the glass in light space, with
   their normals — a caustic is formed by refraction through a solid, and one
   depth buffer describes one interface.
2. **A refraction pass.** Trace each light-space texel through both interfaces
   with Snell's law at each, producing an outgoing direction per ray.
3. **A splat/gather pass.** Intersect those rays with the receiver and
   accumulate energy where they land — photon splatting, additively, into a
   caustic map. Convergence is then *emergent* from ray density rather than
   estimated from curvature, which is the entire difference.
4. **Dispersion for free.** Run 3 with three slightly different IORs and the
   red fringing that the glass state already shows on the arc edges appears in
   the caustic too, for the same physical reason.
5. **A receiver worth casting onto.** There is currently no floor under the
   mark at hero. A caustic needs a surface, and adding one is an
   art-direction decision, not a rendering one.

Steps 2 and 3 are a genuine piece of work — and they are also a natural
**compute-shader** job, which is why this section lives in the WebGPU document.
Under WebGPU the splat pass is a storage buffer with atomic adds, which is the
shape the effect actually wants and which WebGL2 cannot express without
render-target tricks. **If caustics are ever attempted a third time, do it
after step 5 of the checklist above, not before.**
