# Performance

How this site is measured, why every number recorded before 2026-08-10 is void,
and the current baseline.

---

## Every performance figure quoted before 2026-08-10 is worthless

Not exaggerated, not "approximate" — measuring the wrong thing entirely.

`__qa.snapshot()` read `gl.info.render.calls` and `gl.info.render.triangles`
after the frame had been drawn. `WebGLRenderer.info` **resets itself at the
start of every `render()` call**, and `EffectComposer` renders several times per
frame, finishing with a fullscreen quad. So the harness was reporting the cost
of that final quad and nothing else:

```
drawCalls: 1, triangles: 1     ← at hero
drawCalls: 1, triangles: 1     ← at the Deconstruction
drawCalls: 1, triangles: 1     ← in the Lab
drawCalls: 1, triangles: 1     ← at Work
```

The same four numbers at every scroll position, on a page whose geometry
changes completely between them. That should have been the tell.

The truth, once `gl.info.autoReset = false` is set and the counters are reset
once per frame *before* drawing:

```
drawCalls: 87, triangles: 45543   ← at hero
```

**Do not treat any pre-2026-08-10 performance claim in a commit message, a code
comment or a report as a baseline.** They are all derived from the broken
counter. If a number matters, re-measure it.

Fixed in `scenes/DevLoop.tsx`.

---

## Method

```js
__qa.profile(150)   // 150 forced frames; p50 / p95 / p99 / worst, over-16ms count
__qa.snapshot()     // draw calls, triangles, programs for one frame
```

`profile()` drives `advance()` in a tight loop and times each call with
`performance.now()`.

### What this measures, and what it does not

**It measures CPU frame cost** — JavaScript, scene graph traversal, uniform
updates and draw-call submission. That is the right instrument for the things
that actually cause jank on this site: per-frame allocation, forced synchronous
layout, ticker ordering.

**It does not measure GPU time.** Draw calls are submitted asynchronously; the
GPU finishes after `advance()` returns. A low number here does not mean the
frame was cheap on the GPU. The `footer` row below reads `p50: 0.5ms` for
exactly this reason — almost nothing is submitted there, but the compositor
still has work to do.

**It has no vsync pacing.** Frames run back to back, so this is raw cost per
frame, not observed frame rate. Divide into 1000 for an upper bound on FPS, not
an estimate of it.

### Cold vs warm

The first visit to a scroll position compiles shaders and touches geometry for
the first time. Those frames are hundreds of milliseconds and they are real —
a visitor pays them once — but they are not steady state and must not be mixed
into a steady-state comparison. Run `profile()` once and discard it, then
profile again for the warm number.

### Conditions matter, and must be recorded

These numbers were taken with the Chrome window at roughly half screen width,
sharing a GPU with other applications drawing at the same time. They are
pessimistic in absolute terms. That is acceptable for a **before/after
comparison taken under the same conditions**, which is what they are for, and
unacceptable as a published figure. Never quote these as "the site runs at X".

---

## Baseline — 2026-08-10, before the frame-loop unification

Renderer: `WebGLRenderer`, three r171. Backend: WebGL2.
Window 1913×889 CSS, DPR capped at 2. `prefers-reduced-motion` forced off.
**Cold** — first profile at each position, shader compiles included.

| Position | scroll | p50 | p95 | p99 | worst | >16.7ms | draws | tris |
|---|---|---|---|---|---|---|---|---|
| hero | 0.00 | 23.8 | 66.4 | 81.7 | 93.4 | 93/150 | 87 | 45,543 |
| deconstruction | 0.28 | 11.6 | 70.9 | 195.1 | 474.1 | 65/150 | 81 | 45,543 |
| lab | 0.50 | 4.4 | 89.9 | 484.5 | 622.5 | 60/150 | 72 | 7,137 |
| work | 0.70 | 28.4 | 67.7 | 151.8 | 160.5 | 86/150 | 76 | 7,249 |
| footer | 0.95 | 0.5 | 0.8 | 1.5 | 6.9 | 0/150 | 79 | 7,249 |

All times in milliseconds.

### Reading it

- **Hero is the worst steady-state position** — p50 23.8ms is already past the
  16.7ms budget before anything else goes wrong, and it carries the whole
  45.5k-triangle mark plus the full post stack.
- **The 474ms and 622ms outliers at deconstruction and lab are shader
  compilation**, not per-frame cost. They appear on first arrival only.
- **Draw calls barely move** (72–87) while triangles drop 6× between hero and
  lab. The cost is not geometry volume; it is per-draw and per-frame CPU work.
- **Footer is nearly free on the CPU** and proves the harness is measuring
  submission rather than GPU completion.

## Baseline — warm, 2026-08-10, before the frame-loop unification

Same build, Edge (`Edg/`), GPU process healthy, window 1912×901 CSS, DPR 1.
One `profile(60)` discarded at each position first, so shader compilation is
excluded. **This is the steady-state baseline the unification must beat.**

| Position | p50 | p95 | >16.7ms | draws | tris |
|---|---|---|---|---|---|
| hero | **1.8** | 15.4 | 6/150 | 87 | 45,543 |
| deconstruction | **1.5** | 8.0 | 1/150 | 81 | 45,543 |
| lab | **1.0** | 2.6 | 4/150 | 72 | 7,137 |
| work | **1.0** | 3.0 | 1/150 | 76 | 7,249 |
| footer | **2.9** | 9.0 | 4/150 | 79 | 7,249 |

Warm p50 is 1–3ms everywhere — an order of magnitude under the cold figures and
comfortably inside a 16.7ms budget. **The CPU frame is not the problem.**

### The tail in this table is not trustworthy

`profile()` runs its whole loop inside one synchronous JS task, so a single
browser-level deschedule lands entirely in one sample. That produced p99/worst
values of 1976ms, 2387ms, 3516ms and 2095ms in this run — implausible as frame
work on a page whose p50 is 1.8ms, and not reproducible in position.

**Compare p50 and p95 only.** The p99 and worst columns are omitted above for
that reason. Fixing this properly means sampling across real animation frames
rather than a tight loop, which is what `latency()` already does.

---

## Input-to-render latency — the number that decides how it feels

```js
await __qa.latency(40)
```

Milliseconds from a `pointermove` being dispatched to the first **rendered
frame that actually used it**, measured on real animation frames. A frame-time
table cannot see this, and it is what "the cursor feels connected" means.

Baseline, hero, before the frame-loop unification:

```
samples 40 · medianMs 28.4 · medianFrames 1 · maxFrames 1
```

### What this rules out

`medianFrames: 1` and `maxFrames: 1` mean **the pointer is consumed by the very
next rendered frame, every single time.** Not once in 40 samples did input wait
two frames.

That is a negative result against the obvious hypothesis. The site runs three
independent rAF loops — `gsap.ticker`, R3F's internal loop, and a raw one in
`Marquee.tsx` — which contradicts the "one loop" invariant stated in the README
and in `lib/useTicker.ts`. The prediction was that this leaves input a frame
stale. **For the pointer path it does not**, and the reason is structural:
pointer events are dispatched before rAF callbacks within a frame, so whichever
loop runs first still sees a value written earlier in the same frame.

The 28.4ms median is therefore not a queueing stall — it is the wait for the
next frame boundary, which implies this window was presenting at roughly 30Hz
rather than 60Hz, plus a partial frame of phase.

### What this does NOT rule out

The **scroll** path has the opposite shape and has not been measured. Lenis is
driven from `gsap.ticker`, `ScrollTrigger.update` fires from Lenis' scroll
event, and the camera reads scroll-derived state inside R3F's `useFrame`. Those
are two different rAF callbacks, and `<SceneRoot />` mounts before
`<SmoothScroll>` in `app/layout.tsx`, so R3F's loop is plausibly registered
first — which would render the scene from *last* frame's scroll position every
frame.

That is a genuine one-frame lag mechanism, it is specific to scroll rather than
pointer, and it must be measured before and after the unification rather than
assumed. Measuring pointer latency and declaring scroll fixed would be exactly
the mistake the `gl.info` bug already taught.

---

## Known measurement hazards in this environment

These cost a session's worth of confusion each and will do it again.

**0. `snapshot()` is only meaningful immediately after `tick()`.**
Found 2026-08-13, verifying the X3595 commit. `gl.info.autoReset = false` is set
once at harness install, but `gl.info.reset()` is called **only inside `tick()`
and `profile()`** — the forced-frame paths. Nothing resets it on a real rAF
frame. So on a page that has simply been sitting there rendering, the counters
accumulate across every frame since load, and a bare `__qa.snapshot()` returns
their running total:

```
drawCalls: 13092, triangles: 6970312    ← bare snapshot(), ~150 frames of drift
drawCalls: 87,    triangles: 45543      ← the same frame, after tick(1/60, 1)
```

The tell is that **both counters are wrong by the same factor** (13092/87 = 150.5,
6970312/45543 = 153.0). Real geometry changes do not scale two independent
counters by one constant; accumulation does. If a snapshot looks impossibly
heavy, check the ratio against a known-good row in the tables above before
believing the page got slower.

This is not the `gl.info` bug returning — the fix for that was correct and is
intact. It is a usage constraint the fix created and nobody wrote down. **Always
`tick()` first, or read the value `tick()` returns, which is a snapshot taken at
the right moment.**

Consequence for the telemetry HUD (§7): a HUD that reads `gl.info` on real
frames cannot rely on the harness, and must own a reset-per-frame of its own.

---

Both of these cost a session's worth of confusion on 2026-08-10 and will do it
again.

**1. R3F never configures its root in a hidden window.**
`<Canvas>` measures its container before creating the renderer. If the Chrome
window is minimised or fully occluded, `innerWidth` reads 0, the container
measures 0×0, the root is never configured, `MarkObject` never renders, and
`window.__qa` is never installed. The symptom is `__boot()` returning `[]` and a
canvas stuck at its default `300x150`.

*This is not a broken build.* Bring the window to the front, on screen, not
behind anything, and reload.

**2. Chrome's GPU process can refuse all further WebGL contexts.**
After a context loss — a large window resize is enough — or after visiting
several heavy WebGL/WebGPU pages in the same browser, Chrome may stop handing
out contexts entirely. The test:

```js
const t = document.createElement('canvas');
t.getContext('webgl2');   // null  → GPU process is the problem, not the site
```

When a *fresh detached canvas* cannot get a context, nothing on the page can be
measured and no amount of reloading helps. Fully quit and restart Chrome.

A related tell: `programs` in `__qa.snapshot()` dropping (e.g. 40 → 17) with
`drawCalls` going to 0 means the context was lost and the program cache was
discarded.

---

## The frame-loop question, answered — 2026-08-10

**There is no scroll lag. The unification is not being done.**

The hypothesis recorded above — that `<SceneRoot />` mounting before
`<SmoothScroll>` leaves R3F's rAF registered first, so the camera renders from
last frame's scroll — is **false**. It was a reasonable guess from the mount
order and it is wrong about where the registration happens.

### Derived from source

Three facts, each checked in the installed library code rather than recalled:

1. **`gsap.ticker`'s rAF is registered at module-evaluation time.**
   `gsap-core.js:4459` ends the module with `_windowExists() && _wake()`.
   `wake()` sets `_tickerActive = 1` and calls `_tick(2)`; since `2 !== true`
   that is not the "manual" path, so it runs `_id = _req(_tick)` and the loop is
   live. This happens when the bundle is parsed — **before any React effect**.
   It does not wait for a listener, so `SmoothScroll`'s `gsap.ticker.add()`
   does not determine gsap's slot.

2. **R3F's rAF is registered when the Canvas root is configured**, inside a
   React effect — strictly after module evaluation.

3. **Both loops re-register at the top of their own callback**, so the initial
   order is preserved in perpetuity:
   - gsap: `manual || (_id = _req(_tick));` sits *above* the listener dispatch
     loop, with a source comment saying the request is deliberately made before
     dispatch to keep timing stable.
   - R3F: `frame = requestAnimationFrame(loop)` is the **first statement** of
     `loop`.

Therefore `gsap.ticker` runs first, every frame, permanently. The write/read
chain resolves in the correct order within a single frame:

```
gsap.ticker dispatch ─┬─ SmoothScroll: lenis.raf(t)
                      │    └─ Lenis 'scroll' event (synchronous)
                      │         └─ ScrollTrigger.update()
                      │              └─ Deconstruction onUpdate:
                      │                   markHandles.current.progress.value = self.progress
                      │                                                        ▲ WRITE
R3F loop ─────────────┴─ useFrame → CameraRig reads that value ────────────────┘ READ
                                     and renders
```

**The mount order in `layout.tsx` is a red herring.** It would only matter if
gsap's ticker started lazily on its first `.add()`. It does not.

### Confirmed by measurement — `__qa.loopOrder()`

Four runs, tab visible, dev build, ~35Hz:

| frames | gsapFirst | r3fFirst | freshScroll | staleScroll | single-loop frames |
|---|---|---|---|---|---|
| 118 | 118 | 0 | 118 | 0 | 0 |
| 88 | 88 | 0 | 88 | 0 | 0 |
| 88 | 88 | 0 | 88 | 0 | 0 |
| 88 | 88 | 0 | 88 | 0 | 0 |

Unanimous and reproducible. `freshScroll` is the direct data-path check, not an
inference from callback order: the probe samples `lenis.scroll` at both points,
and its ticker listener is appended so it runs *after* the frame's scroll has
been integrated. Every rendered frame saw the scroll value produced by that same
frame.

**Unanimity is the predicted result here, not a suspicious one.** Because both
loops re-register at the top of their callbacks, the ordering is structurally
invariant once established — a *mixed* result would have been the alarming
outcome, and would have meant something was re-registering mid-callback.

### What was done instead

Per the decision rule: source proved no lag, so no unification. The README and
`lib/useTicker.ts` claimed one loop and were describing an intention rather than
the code; both were corrected. `Marquee`'s stray rAF was removed as an isolated
change, and the step registry landed on its own.

### `scrollLag` was deleted

It returned a best-fit frame lag of **3, 3, 3, 2, 1, 0 across six runs on an
unchanged page**. Two independent defects, either one fatal:

- **The estimator could not discriminate.** The camera is exponentially damped,
  so its velocity is a smoothed copy of the scroll velocity and correlates
  highly at *every* candidate lag. One run returned
  `[0.9571, 0.9570, 0.9569, 0.9556]` — four decimal places of nothing. The three
  1400px runs rose monotonically across all four lags and never peaked, so the
  estimator had not found a maximum at all; it was biased toward higher lag by
  construction.
- **It needed real frames it never got.** ~96 samples against an expected ~240:
  throttling was active throughout.

A probe that returns four different answers for one page is worse than no probe,
because a future session will believe one of them.

`loopOrder()` replaces it and is a different kind of instrument. The question is
an **ordering** property with two possible answers, not a statistic to be
estimated, and ordering is **throttle-invariant** — occlusion changes how often
frames happen, never the order of callbacks within one. It is one of the few
things here that is safe to measure while driving the browser.

`loopOrderSelfTest()` validates the analyser against synthetic logs for both
orderings, with a known one-frame lag injected in the second. It must report
`gsapFirst 58/58, freshScroll 58` and `r3fFirst 58/58, staleScroll 58`. **It was
run and passed before the real probe was trusted** — the step `scrollLag` skipped.

---

## Verification pass — 2026-08-13, the four frame-loop / lens commits

`3aa129d`, `ed85d8a`, `220e597`, `f355a87` had landed but had never been
eyes-verified, because the browser dropped in the session that wrote them. They
were already on `origin/main` — `git ls-remote` was checked against the cached
`origin/main` ref, since a stale ref is exactly how the previous session talked
itself into destroying an untracked file.

### The browser, finally identified

The earlier note that the connected browser "reported `Chrome/151.0.0.0` with no
`Edg/` token" was an artefact of reading only one token. The full string carries
both:

```
Edg/151.0.0.0 · Chrome/151.0.0.0
ANGLE (Intel, Intel(R) Iris(R) Xe Graphics (0x0000A7A1) Direct3D11 vs_5_0 ps_5_0, D3D11)
WebGL 2.0 · GLSL ES 3.00 · three r171 · gl.debug.checkShaderErrors = true
```

**It is Edge, and it is on ANGLE's D3D11 path.** That matters for the X3595
result below: X3595 is an FXC HLSL warning, so it is only emitted on this
backend. A zero-warning result on a Vulkan or desktop-GL backend would have been
vacuous. Both preconditions for detecting it — D3D11 translation and
`checkShaderErrors` — were confirmed live before the absence was accepted as
evidence.

### Results

| Check | Result |
|---|---|
| `__qa.snapshot().steps` non-zero | **12** — registry connected |
| Zero `X3595` on a fresh document | **zero warnings of any kind** |
| Lens tracks the cursor with the X-ray view | **confirmed visually** |
| Marquee scrolls and skews with scroll velocity | **confirmed numerically** |

The console reader was proved live on the same document before the absence of
X3595 was believed — it captured the React DevTools INFO lines from that exact
load, so "no matches" meant no warnings rather than no connection. That check is
the whole difference between this result and the `gl.info` era.

Marquee, sampled through `tick()` at its own scroll position:

```
at rest      offsets  -565.5 → -554.6   (base drift ~2.8px/frame, never stops)
under scroll offsets  -510.5 → -25.8    (~44px/frame)
             skewX      0.47° → 5.86°   (rises with velocity)
```

One thing the sample exposed rather than proved: at rest the band reported
`skewX(-1.8639e-74deg)`. A fixed-alpha lerp toward zero decays into denormals
and never arrives. Harmless in itself, and a direct symptom of the
frame-rate-dependent relax fixed in §3.

## §3.8 — lightning arming boundary, verified empirically

```js
__qa.lightningScan(id, y)   // frozen projection, 479 samples across 1912px
```

Scanned at `y = innerHeight / 2`, 4px step, threshold `radius = 16`. Distances
in CSS px, measured by the renderer's own `nearestOnLine`.

| Line | closest approach | armed band | widest armed | closest un-armed |
|---|---|---|---|---|
| a | 0.42px @ x=1360 | [1344, 1376] — 32px | 14.91 | 17.71 |
| b | 0.96px @ x=988 | [968, 1008] — 40px | 15.84 | 16.90 |
| c | 1.45px @ x=1760 | [1748, 1776] — 28px | 13.72 | 16.62 |

**The boundary is exact.** No armed sample exceeds 16.00px; no un-armed sample
falls below 16.62px. The ~1px dead band between the two is the 4px scan step,
not slop in the test.

**One contiguous band per line**, ~2×radius wide and centred within 1.5px of the
stroke. Band width varies with crossing angle — a horizontal scan cuts a
diagonal line obliquely, so the run along x is `2r / sin θ`, which is why `b`
reads 40px and `c` reads 28px.

Under the old nearest-vertex test this scan would have returned several disjoint
bands with ~190px dead gaps between them, each up to 80px wide. It now matches
the visible stroke.

Hysteresis (arm at 16, release at 22.4) and fire-on-entry are wired but are
state-machine behaviour over time, not geometry, so they are not visible in a
single-frame scan. They are covered by the regression pass.

---

## Cursor tracking error — the actual reported lag

`latency()` measures event-to-first-render and reported 1 frame. That was
correct and irrelevant. The cursor is exponentially damped, so its offset under
motion is `e = v / a` — **proportional to pointer speed**. A one-frame pipeline
can still draw the ring 200px from the pointer.

```js
__qa.cursorLag([400, 1200, 2400, 4000])   // px/s
```

### Before — analytic, exact for the old code

`e = v / a`, `a = 1 - e^(-k·dt)`. Ring `k = 0.17·60`, `a = 0.156`. Dot
`k = 0.42·60`, `a = 0.343`.

| Pointer speed | px/frame | ring gap | dot gap |
|---|---|---|---|
| 400 px/s | 6.7 | 43px | 19px |
| 1200 px/s | 20 | 128px | 58px |
| 2400 px/s | 40 | 256px | 117px |
| 4000 px/s | 66.7 | 427px | 194px |

### After — measured

| Pointer speed | px/frame | ring steady | ring worst | **dot worst** | frames to converge |
|---|---|---|---|---|---|
| 400 px/s | 6.7 | 19.3 | 20.1 | **0** | 18 |
| 1200 px/s | 20 | 6.0 | 21.2 | **0** | 5 |
| 2400 px/s | 40 | 0 | 21.1 | **0** | 1 |
| 4000 px/s | 66.7 | 0 | 14.2 | **0** | 1 |

**The dot is exact at every speed — 0px, structurally, because it is not damped
at all.** The ring never exceeds ~21px against a 26px ceiling, versus 427px
before at the same speed.

The ring's steady gap falls to 0 above ~1560 px/s because that is where
`a = v / maxTrail` saturates at 1 and the ring stops damping entirely. During a
fast flick the ring rides exactly on the dot and relaxes back into its trail
when the pointer stops. That is intended — character is not perceivable mid-flick
— but it is the behaviour to revisit first if the cursor ever feels stiff.

### Caveat on these figures

The probe forces frames while the page's real `gsap.ticker` is also running, so
`cursorStep` is stepped by both and the measured gaps are somewhat SMALLER than
production. The bounds are structural and unaffected: the dot has no damping to
lag with, and the ring's rate is clamped so its error cannot exceed `maxTrail`.
Treat the ring's steady-gap column as a lower bound, not a precise figure.

---

## Harness defect found while measuring

**`__qa.tick()` does not dispatch `gsap.ticker` callbacks.** It calls
`gsap.updateRoot()`, which advances the global timeline — tweens and
ScrollTriggers — but anything registered with `gsap.ticker.add()` is never
stepped. That is every `useTicker` consumer, the Preloader counter, and the
cursor.

So the harness has never driven the DOM-side readouts, and the README's claim
that one loop drives "every DOM readout" and can be stepped by hand is not true
of the readouts. The first attempt to measure cursor damping through it returned
zeros for every speed — a cursor that had simply never moved.

### Every prior DOM-side verification through the harness is void

This has the same shape as the `gl.info` bug and the same consequence, so it
gets the same warning.

**Any DOM-side behaviour ever "verified" by stepping `__qa.tick()` was checked
on a frame that had not advanced.** That includes, at minimum:

- the **preloader counter** — driven by `useTicker`, so its lerp never ran; a
  stepped frame showed whatever value it was already displaying
- the **manifesto stagger** and any other `useTicker`-driven reveal
- the **cursor** — ring and dot both, at every position and speed

A screenshot taken after `__qa.tick(1/60, 120)` is genuine evidence for the 3D
scene, which R3F's `advance()` really does step, and is **no evidence at all**
for any of the above. If a past session reported one of these as verified, it
was reading a static frame. Re-check anything that matters.

Tweens are the exception and are fine: `gsap.updateRoot()` is exactly how the
global timeline advances, so ScrollTrigger-scrubbed and tweened DOM state does
step correctly.

### Fixed — the step registry, 2026-08-10

`lib/steps.ts`. `addStep(fn)` registers with `gsap.ticker` exactly as before AND
keeps a reference the harness can call, so `__qa.tick()` now drives the DOM
layer as well as the scene. `useTicker` routes through it, and the three
components that called `gsap.ticker.add` directly — `Cursor`, `HoldToBlast`,
`Marquee` — now go through it too.

Two things stay on a bare `ticker.add`, deliberately:

- **Lenis**, because `tick()` already drives `lenis.raf(stamp)` with a
  controlled timestamp; registering it as a step would integrate the same frame
  twice against two different clocks.
- **The harness's own probes**, for the same reason.

`__qa.snapshot()` now reports `steps`, the number of registered callbacks. **A
zero there on a page that plainly has a cursor and a marquee means the registry
is disconnected and every DOM-side observation through the harness is worthless
again.** It is there so that failure is visible rather than silent, which is the
one thing the original defect was not.

The `cursorStep(dt)` export is gone — a per-component escape hatch is precisely
what the registry replaces.

Caveat, unchanged: on a visible tab `gsap.ticker` is still running, so a stepped
frame is stepped twice. Damping measured through the harness reads slightly
tighter than production. The bounds in the cursor table above are structural and
unaffected.

### Trap found while landing it: tsc will not catch a missing `gsap` import

Removing `import { gsap }` from `HoldToBlast.tsx` — which uses `gsap.timeline()`
— **typechecked completely clean** and failed only at runtime with
`ReferenceError: gsap is not defined`. GSAP ships a UMD global type declaration,
so a bare `gsap` resolves at compile time whether or not the module imports it.

`npm run typecheck` passing is not evidence that a gsap-touching file is wired
up. Load the page.

A second trap on top of it: the dev console buffer replayed those errors long
after the source was fixed, including one naming a symbol that no longer existed
anywhere in the tree. Stale console output claiming a fixed bug is still broken
will cost time if believed. Verify against a freshly loaded document.

---

## The smoothness pass, verified and landed — 2026-08-13

The smoothness work had been written, typechecked and left uncommitted because
the browser dropped before it could be verified. Verified in Edge
(`Edg/151.0.0.0`, ANGLE D3D11, Intel Iris Xe, DPR 1, dev build) and landed.

### Before / after

Same instrument, same machine, same session. `profile(150)` at each position,
**two** profiles discarded first rather than one — the first post-warm run
still reads high (one returned p95 15.5 against 11.5–12.1 for the four runs
after it), and treating that as the measurement would have reported a
regression that does not exist. Median of three runs.

| Position | p50 before | p50 after | p95 before | p95 after | >16.7ms before | after |
|---|---|---|---|---|---|---|
| hero | 9.7 | **6.9** | 14.9 | **11.8** | 3/150 | 3/150 |
| deconstruction | 9.5 | **7.3** | 18.7 | **12.4** | 11/150 | **2/150** |
| lab | 7.3 | **6.1** | 12.6 | **12.1** | 2/150 | 3/150 |
| work | 7.7 | **6.6** | 14.3 | **11.8** | 5/150 | **2/150** |
| footer | 7.6 | **6.7** | 13.1 | **12.1** | 4/150 | **2/150** |

Deconstruction was the target and it moved furthest: **p95 −34%, and
over-budget frames from 11 in 150 to 2.** That is the predicted result — its
p95 was where the forced layout lived.

### The baseline's "deconstruction" row was not measuring the annotations

Worth recording, because it nearly produced a false claim. Scroll fraction
0.28 — the position the baseline table calls "deconstruction" — has **every
annotation at alpha 0**. The annotations are only on between roughly f=0.16
and f=0.19. So the headline improvement at 0.28 is the rail batching and the
new early-out, not the width cache.

The annotation path proper was therefore measured separately, at f=0.175 with
four cards genuinely at partial alpha (0.878 / 0.596 / 0.315 / 0.034):

| Position | p50 | p95 | >16.7ms | draws | tris |
|---|---|---|---|---|---|
| deconstruction, annotations ON | 7.7 | 13.8 | 3/150 | 85 | 39,835 |

There is no "before" for that row — it is not in any earlier table — so the
fix was A/B'd directly against the pattern it replaced instead, timed over 200
iterations on the live nodes:

| Pattern | ms/frame |
|---|---|
| write opacity → **read `offsetWidth`** → write transform, ×6 nodes | **0.255** |
| same writes, width from cache | **0.014** |
| 7 rails: read rect → write opacity, interleaved | **0.117** |
| same rails: read all, then write all | **0.051** |

18× on the annotations. Small in absolute milliseconds — but forced layout is
tail cost, not mean cost, which is exactly why p95 moved three times as far as
p50 everywhere.

### `steps` dropped 12 → 6, and that is the fix working

`__qa.snapshot().steps` read **12** at the last verification and reads **6**
now. That is not the registry coming loose — it is the seven per-rail ticker
callbacks collapsing into one shared `railStep`. A drop here is only alarming
if it goes to zero.

### The rail invariant, checked rather than assumed

The rails were the riskiest part of §3: the per-rail loops became one shared
loop with module-level state, and the geometry is now measured once for the
group instead of once per rail. The requirement is absolute — a rail must be
invisible **before** its top reaches the bottom of the bar, because the bar is
`mix-blend-difference` and two lines of the same monospace land on each other.

Swept 200 scroll positions across the whole page against all three home-page
rails: **zero violations.** No rail is ever above 0.02 opacity once its top is
at or below the bar.

### Also landed: the last three per-frame allocations

The §3 audit turned up three the original pass had missed.

- **`Chrome.tsx`, the scroll progress bar.** Built `scaleY(${float})` and wrote
  it every frame for the entire life of the page, unquantised. Same defect as
  the marquee skew and it had survived that fix. Now snaps its tail, quantises
  to 1e-3 and writes on change — and it settles on exact values (`scaleY(0.5)`
  at 50%, not `scaleY(0.4999987)`), which is the observable proof the write is
  actually being elided.
- **`WorkScene.tsx`, the hover raycast.** `meshes.current.filter(Boolean)`
  allocated an array per frame and `intersectObjects` allocated another. Both
  now reuse scratch arrays; `intersectObjects` already took an optional target.
- **`Cursor.tsx`, the ring and dot transforms.** Written unconditionally every
  frame. The ring is damped so it never arrives and its rounded components
  changed forever; the dot's string was byte-identical whenever the pointer had
  not moved. Both guarded now — **the dot's guard compares the raw pointer
  coordinates**, never a rounded copy, so its defining property survives:
  `cursorLag()` still reports `dotWorstGapPx: 0` at every speed, and the ring
  still reads 19.3 steady / 21.1 worst against its 26px ceiling, matching the
  recorded table exactly.

At rest the whole page now produces **0.5 style-attribute mutations per frame**,
measured with a `MutationObserver` over 120 stepped frames.

### Fixed-alpha damping: none left

Swept every `+= (target - current) * k` and every `.lerp(` on the tree. All of
them resolve `k` through `1 - Math.exp(-rate · dt)`. The three that needed
checking by hand rather than by pattern — `lens.ts`, `Cursor.tsx`'s
speed-adaptive ring rate, and `CameraRig`'s orbit — are all exponential.

### Draw calls: the earlier 81 was the preloader, not a change

Hero read 81 draws while `entered` was still false and **87** once the
preloader had actually left. 87/45,543 at hero and 72/7,137 in the Lab both
match the figures on record, so the §6 HUD targets stand unchanged.

### X3595: still zero, and the absence is still meaningful

Fresh document, 40 programs linked after visiting every scroll position. Seven
console messages, all of them the React DevTools INFO line — so the reader was
live on this exact load. Both preconditions re-confirmed before believing the
absence: `ANGLE (Intel, Intel(R) Iris(R) Xe Graphics, Direct3D11 vs_5_0 ps_5_0,
D3D11)` and `gl.debug.checkShaderErrors = true`.

---

## The SVG draw-on trap, found by looking at the page — 2026-08-13

Recorded because it cost a rebuild of the preloader's whole reveal layer, and
because the broken version *typechecked, rendered, and looked plausible*.

The obvious way to draw an SVG on is `pathLength="1"` plus an animated
`stroke-dashoffset`: it normalises every shape's length to 1, so one dasharray
works for every element and nothing has to be measured. It is the standard
trick and it is what was written first.

**It rendered every element fully drawn at progress 0.** Two independent
causes, either one sufficient:

1. **`vector-effect: non-scaling-stroke` resolves the dash pattern in SCREEN
   space**, which defeats `pathLength` normalisation entirely. `getComputedStyle`
   returns `stroke-dasharray: 1px` — a 1px-on, 1px-off pattern on a 540-unit
   line, which at hairline width is indistinguishable from a solid stroke. The
   same breakage applies to a dasharray computed from `getTotalLength()`: the
   user-unit length gets applied as pixels against a path whose screen length is
   3x that.
2. **A dashed construction line needs `stroke-dasharray` for its APPEARANCE**
   and cannot also use it for its reveal. The second use silently destroys the
   first, with no error anywhere.

The tell was the computed style, not the source. The source is correct SVG; it
is the interaction between two features that is not.

### What replaced it

Each element gets the reveal that matches what it physically is, which is also
the more truthful drawing:

| Element | Reveal | Why |
|---|---|---|
| grid, datums | `x2`/`y2` extends from the start point | works with any dasharray |
| construction arcs | `r` grows from 0 | what a compass actually does |
| solid outlines | real `getTotalLength()` dashoffset | genuine draw-on |
| control points | `r` with a back ease | a discrete event, not a sweep |
| labels | opacity | nothing to draw |

`getTotalLength()` is called once per solid element at mount — never per frame,
and only while the preloader is up and nothing else is competing for the main
thread.

### And a second one on top of it: a paused timeline has applied nothing

With the reveal fixed, the drawing still rendered with every *label* visible at
progress 0. A paused GSAP timeline has not applied any `from` state until
something scrubs it, and on an occluded tab nothing ever does. Elements whose
initial state is only expressed in the timeline will render in their authored
DOM state — for text, `opacity: 1`.

Anything whose hidden state matters on frame one must be hidden in CSS or in
the markup, not only in the tween. `.cad-t { opacity: 0 }` for that reason.

### Verification note: rAF polling does not work on an occluded tab

Two probes timed out at 45s here. `requestAnimationFrame` loops and
`setTimeout` polls both stall because the window is behind — real-time GSAP
timelines barely advance between calls. What does work:

- `__qa.cad(p)` to park the drawing at a known progress and freeze it, then
  screenshot. This is the only way to see a progress-scrubbed sequence at a
  chosen point, and it is the SVG-side equivalent of `tick()`.
- Successive screenshots. Each one fronts the tab briefly and advances the
  animation, which is how the resolution was caught mid-flight at 081 with the
  outlines taking their fill and the construction still present.
- Temporarily raising `PRELOADER.minDuration` to hold the plate open. Reverted
  after — a held preloader that ships is a broken site.

### Fixed while in here: the panel seams

Five `flex-1` panels across a viewport whose width is not divisible by five
land on fractional boundaries — 313.6px, 627.2px and so on at 1568px — and each
edge rounds independently, leaving hairline gaps. The scene renders live behind
the plate, so those gaps showed as two or three short bright slivers wherever
the mark or a sweep line sat behind a seam. Present since the panels were
introduced; `elementsFromPoint` at the sliver returned no SVG element, which is
what identified it as a gap rather than something drawn. One pixel of overlap
closes them, and the panels leave vertically so overlapping horizontally costs
nothing.

---

## Volumetric light and the glass state — 2026-08-13

Three things in this section were wrong on the first attempt and each was found
by looking at the page, not by reasoning about the code. Recording all three,
because two of them are the kind that look like a broken effect and are
actually a broken *number*.

### 1. Sizing the volume by reasoning hung the browser

The scattering volume started at a half-extent of 7.5 world units. The hero
camera sits 4.9 units out, so the camera was INSIDE the box and its back faces
covered the entire viewport: 1905×901 fragments × 48 steps × a dependent
texture fetch each, about **82 million samples a frame**. The Intel Iris Xe
stopped dead — screenshot injection timed out at 5s, then again, and the tab
had to be navigated away to recover.

3.2 keeps the volume a region around the mark. It is also the better art
direction: a full-screen scattering layer reads as a filter, not as light in a
room.

**The step count is now chosen on the visitor's machine, not here.** The layer
boots on the LOW rung (24) and a calibration pass over 45 real frame deltas at
hero either promotes it to 48 or leaves it. Two rounds, so a machine that has
headroom at 24 but not at 48 can come back down; capped at two so a borderline
machine settles instead of oscillating. Guarded on `visibilityState`, because
an occluded tab throttles rAF and would downgrade every machine for a reason
that has nothing to do with the machine.

`__qa.volumetric(n)` and `__qa.shaftLight(x,y,z)` turn both knobs on a live
page. Both exist because guessing was demonstrably worse.

### 2. The shafts were invisible, and the phase function said why

The first light position was the KEY Lightformer's, `[-4.5, 4.2, 5]`, on the
reasoning that the key defines the form. It produced no shafts at all.

The key sits at **z = +5, the same side as the camera**. So `dot(viewRay,
toLight) ≈ -1`, and Henyey-Greenstein at g = +0.72 returns **0.0075** there
against **1.75** at its peak — a factor of 230. The volume was integrating
correctly and scattering essentially nothing toward the eye.

God-rays are a backlit phenomenon. The light moved to `[-1.1, 3.1, -4.5]` —
above and behind the mark, the rim's role rather than the key's.

**The occlusion was then proved, not assumed.** Putting the light directly
behind the mark produces the spine's shadow column and visible light through
the D's counter — exactly what a real occluder does and nothing a radial
gradient could fake. The shipped position is the restrained version of that.

Density came down from 0.19 to 0.14 for one reason: at 0.19 the upper-left of
the frame came off black, and this page's design rests on #08080A staying
#08080A.

### 3. `profile()` cannot see any of this

`profile()` times `advance()`, which returns when draw calls are SUBMITTED. The
volumetric is almost pure fragment cost, so the profiler is blind to it — three
alternating A/B runs read 9.3/9.5/9.1ms with the layer off and 9.0/6.0/8.4ms
with it on, i.e. no measurable difference and sometimes *faster*, which is not
a believable result. GPU-inclusive timing needs `gl.finish()` after the frame,
and the shipped calibration uses real frame deltas instead.

### The glass state: transmission over a void is nothing

Turning every part to glass made the mark **vanish completely**, and that was
correct behaviour rather than a bug. `transmission: 1` shows what is behind the
surface; what is behind this object is #08080A void, lit by a deliberately dim
environment. Clear glass in front of nothing is nothing.

The fix is also the brief: **the ember inlay stays solid.** It sits inside the
spine's channel, the spine is now glass around it, and the bar is seen through
1.35 units of dispersive glass and splits at its edges. The locating pins
follow the same rule. Now there is something in the object to refract, and the
dispersion is visible as red fringing on the arc edges.

Two further notes:

- **The glass takes over from the lens.** Hovering the mark previously armed
  both the X-ray lens and the glass, putting a cyan scan region on top of a
  refracting body on one gesture. `lensHandle.armed` now requires
  `glassHandle.amount < 0.5`, which crossfades rather than switches because
  `armed` feeds a damped value.
- **A separate material set, not an animated `transmission`.** Crossing
  `transmission` above 0 flips a shader define and recompiles the program,
  which would drop a frame on the first hover.

### Caustics were built twice and CUT

Both attempts read as an artefact rather than as light, and the brief's own
rule is that an effect which reads as a demo gets cut.

**Attempt one** derived the caustic from the Laplacian of the mark's
light-space depth — where the surface is concave, refracted rays converge. It
came back as a blocky, stair-stepped silhouette with rainbow fringing at every
texel boundary. **That was a real bug and it is worth knowing:** the depth
target was `RGBADepthPacking` into an 8-bit target with `LinearFilter`, and
bilinear filtering blends the four packed BYTES of adjacent texels
independently. The low byte of one depth interpolated with the low byte of
another does not decode to anything near the depth between them. Packed depth
cannot be filtered. The target is half-float now, which fixed the fringing —
and which the shafts benefit from too, so the change stayed.

**Attempt two**, on a clean 512² float map with a multi-scale stencil, still
produced a hard-edged wedge with a stair-stepped boundary.

The reason is geometric and not fixable by tuning: **this mark is a flat
extrusion.** Its light-space depth is piecewise constant, so the Laplacian is a
delta function at the silhouette and zero everywhere else — a hard band along
the shadow edge, never a focused pool. Widening the stencil blurs the band into
a grey wedge; it does not turn it into a caustic.

A real one needs the refracted ray DIRECTIONS, not the depth: a pass that
traces through both surfaces of the glass and splats where the rays land. That
is a genuine piece of work and was out of scope here.

### Browser note

Edge dropped mid-section (the extension disconnected and the dev server on 3000
went with it). The rest of this section was verified in **Brave** —
`Chrome/151.0.0.0`, no `Edg/` token — on the **same GPU and the same ANGLE
D3D11 path**, `checkShaderErrors: true`. Both preconditions for detecting X3595
therefore still hold, and the result is still zero: 47 programs linked, two
console messages, both the React DevTools INFO line, with the reader proved
live on that exact load before the absence was believed.
