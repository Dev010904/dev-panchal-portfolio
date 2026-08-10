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

A warm re-measure was attempted and could not be completed — see below.

---

## Known measurement hazards in this environment

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

## Open work

The frame-loop unification (driving R3F from `gsap.ticker` instead of its own
rAF) has **not** been measured yet. It is to be landed as an isolated commit
with an after-table appended here under identical conditions, and reverted if
the comparison or the feel regresses.
