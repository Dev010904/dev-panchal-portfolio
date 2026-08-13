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
