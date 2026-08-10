# Research — 2026 reference pass

Five sites studied live in Chrome on 2026-08-10, ahead of the WebGPU / lens /
preloader / compute-field work. For each: what was actually observed, the one
technique worth stealing, and whether it survives contact with this site's
identity.

The rule applied throughout: **a portfolio for a solo developer must not read as
a studio showreel.** A technique that makes a brand look like it has a team of
twelve makes this site look like it is pretending to. Rejections are listed as
prominently as adoptions, because the rejections are the part that keeps the
register honest.

---

## Method, and its limits

Everything below was seen in a real browser at 1568×726, scrolled by hand, with
a JS probe run against the live page to read the renderer.

Three things are worth writing down so the next session does not rediscover
them:

- **These sites render to a single full-viewport canvas.** `get_page_text`
  returns almost nothing, and the accessibility tree is a handful of nav links.
  Screenshots and scrolling are the only useful instruments. Do not spend
  round-trips fighting it.
- **A site stalled on its own preloader is usually rAF throttling in a
  backgrounded tab**, not a failed load. The same trap this site's `__qa`
  harness exists to defeat. Bring the tab to the front and wait.
- **The WebGL layer does not always composite into an extension screenshot.**
  Hubtown's hero canvas came back pure black while its DOM chrome captured
  perfectly. That is a capture limitation, not evidence the scene is broken.

### Measured stack, all five

Read directly off each live page (`window.__THREE__`, and probing
`canvas.getContext()` — a canvas that refuses `webgl2` but accepts `webgpu` has
a WebGPU context already bound).

| Site | three | Backend | Canvases | Notes |
|---|---|---|---|---|
| oryzo.ai | `178 — modified by Lusion` | WebGL2 | 6 | **43 SVG elements.** Built by Lusion. |
| hubtown.co.in | present | WebGL2 | 1 | three + GSAP + Lenis |
| brand.ivress.co.jp | `182` | **WebGPU** | 1 | three + GSAP + Lenis |
| explore.ownprimland.com | `179` | WebGL2 | 1 | three + GSAP + Lenis, 1 `<video>` |
| **this site** | `171` | WebGL2 | 1 | three + GSAP + Lenis |

Four of the five are three + GSAP + Lenis on one persistent canvas — the same
architecture this site already has. That is reassuring rather than interesting:
the architecture is not the differentiator. The differentiator is what gets
authored on top of it.

The genuinely load-bearing number is the **three version**. This site is on
r171 (Dec 2024). The only WebGPU site in the set is on r182. See
[WEBGPU-MIGRATION.md](WEBGPU-MIGRATION.md) — that gap is the single biggest
input into the migration plan.

---

## 1. oryzo.ai — the CAD preloader

**Studied for:** object inertia, Z-depth scroll, and the CAD-viewport preloader.

### Observed

The preloader is a technical drawing that builds itself out of a point at the
centre of the screen and scales up: two concentric **dashed** construction
circles, orange control points at every cardinal position — square handles on
the axes, round terminators on the tangent bars — horizontal and vertical
dimension bars extending past the geometry, and a faint dotted coordinate grid
resolving behind all of it. Hairline weight throughout, one accent colour, olive
ground.

Then the thing that actually matters: **the drawing does not get replaced.** The
construction geometry stays exactly where it is and the rendered product fills
in underneath it — first as a flat shaded disc, then as a lit, textured object.
The control points remain pinned to the object and track it as it moves, fading
out only once the render has fully taken over. The background washes from olive
to near-black across the same scroll.

Through the rest of the page one object holds the frame and is re-posed
continuously: it tilts, tumbles through Z, lags the scroll and settles. It is
never cut to a new shot.

### The one reusable technique

**The technical drawing and the finished render are two points on one
continuum, not two screens.** Almost everyone builds a preloader as a panel that
covers the site and then leaves. Oryzo builds it as the *first frame of the
object's own construction*, so the transition is a dissolve between two states
of one thing rather than a curtain going up.

The second, more practical finding: **43 SVG elements on the page.** The
construction lines, control points and dimension marks are DOM SVG composited
over the WebGL canvas — not drawn in the shader. That is the correct call.
Hairline strokes stay crisp at any DPR, `stroke-dasharray` / `stroke-dashoffset`
is the cheapest draw-on animation there is, and GSAP can drive it on the same
ticker as everything else.

### Verdict — **adopt**, and it fits better here than it does there

This is the rare case where the reference is a weaker fit for its own site than
for ours. Oryzo is selling a coaster; the engineering-drawing language is a
flattering costume. DP‑01 is *literally* a machined instrument with a parts
list, a milled channel, locating pins and an exploded state that already exists.
A CAD viewport is not a costume here, it is a document of the object.

Adopted for §3.5, with three deliberate changes:

- Hairlines in `--color-rule` / `--color-fg-dim`, exactly **one** ember accent —
  not orange everywhere. Oryzo's control points are all accent-coloured, which
  is fine on olive and would be five accent violations on `#08080A`.
- The drawing resolves into **the real mark's silhouette**, generated from
  `lib/mark/paths.ts`, so it cannot drift from the object it becomes.
- The existing five-panel split exit is kept. It works, the owner likes it, and
  replacing a good transition with a different good transition is churn.

### Rejected from this site

**The scroll-long object re-posing.** Oryzo holds one object in frame for the
entire page and re-poses it per section. This site already made the opposite
call for a documented reason: the mark only reads as "DP" within ±30° of
head-on, so continuous re-posing would mean the monogram is illegible for most
of the time anyone is looking at it (IDENTITY.md, "Motion"). The ±27° sway plus
a dedicated Deconstruction is the *better* answer for an anamorphic mark. Not
adopted.

---

## 2. hubtown.co.in — the mouse-reveal

**Studied for:** the cursor-driven reveal of geometry detail.

### Observed

One 1920×889 WebGL2 canvas, three + GSAP + Lenis, dark navy-black ground
(`#080d16`-ish) with a cold blue-white type palette. A custom cursor follower
tracks the pointer with a visible lag and carries a live monospace label —
`CLICK TO ENABLE AUDIO` — that damps toward the cursor rather than snapping to
it. A pinned left-hand chapter list (FUTURE / INNOVATION / COLLABORATION /
EXCELLENCE / PURPOSE / LEGACY) marks the current section.

The hero canvas did not composite into the extension's screenshots, so **I did
not see the reveal effect itself with my own eyes.** What I did establish, by
probing the live DOM, is the thing that actually matters for implementation:

```
maskEls: []          // zero elements with mask-image, -webkit-mask-image
                     // or a circle() clip-path
canvases: 1          // one webgl2 context
```

**There is no CSS mask anywhere on the page.** The reveal is therefore done
in the fragment shader, against a pointer uniform — not by masking a DOM layer
over a second render. That is the single most useful thing this site had to
give, and it rules out the approach most people reach for first.

### The one reusable technique

**A pointer-driven mix factor inside one material, not two stacked layers.** The
"second material" under the cursor is not a second pass and not a second mesh —
it is a second shading branch in the same fragment shader, selected by a smooth
radial falloff around a pointer uniform in view space. One draw call, no render
target, no compositing, and the boundary can be perturbed because it is a number
in a shader rather than the edge of a DOM element.

### Verdict — **adopt**

This is §3.3 and it is the highest impact-to-effort item on the list, exactly as
the brief says. It suits DP‑01 unusually well for a reason the reference cannot
claim: this mark genuinely *has* an interior. There are bolt-hole axes, a milled
channel, a seated inlay, locating pins and parts at different Z depths. An X-ray
region is showing something true about the object, not inventing a decorative
under-layer.

Implementation consequence, taken directly from the probe: build it as a branch
in the mark material with a view-space pointer uniform and a `smoothstep`
falloff, refracted at the rim by offsetting the sample position along the
gradient of the falloff. Do **not** build it as a masked second canvas.

### Rejected from this site

- **The audio.** DESIGN-SYSTEM.md bans it outright. A "CLICK TO ENABLE AUDIO"
  prompt on a solo developer's portfolio is a studio move and reads as one.
- **The six-chapter pinned rail.** This site already rejected section numbering
  for a stated reason — it makes a page read as a slide deck with an agenda. A
  named chapter rail is the same idea wearing a better font.
- **The heavy full-screen preloader with a percentage.** Hubtown sat on a
  black screen for ~12 seconds before first paint. This site's preloader is
  gated on real boot milestones and should stay that way.

---

## 3. cartier.com/watchesandwonders — **not studied**

`https://www.cartier.com/en-us/watchesandwonders` returns Cartier's error page:
*"Sorry, something went wrong — the page you are looking for might have been
removed or is temporarily unavailable."* Watches and Wonders is an annual
campaign and the microsite for the referenced edition has been taken down. The
page also raised a cookie-consent modal, which was **not** accepted.

**No findings are recorded for this site.** I am not going to describe six
self-contained 3D rooms I did not see. If the intended reference is a specific
archived build, point me at the URL and I will study it properly.

What the brief describes — six self-contained 3D rooms entered and exited on
scroll — is worth one honest note *without* claiming it as an observation: this
site already solves the same problem the other way round, and better for its
purpose. DESIGN-SYSTEM.md's "one continuous room" model puts every section at a
known world Y and flies the camera between them. Discrete rooms would mean
tearing down and rebuilding scene contents at each boundary, which is precisely
the thing the persistent-canvas architecture exists to avoid. **Rejected on
architecture, not on taste.**

---

## 4. brand.ivress.co.jp — WebGPU in production

**Studied for:** WebGPU with WebGL fallback, TSL-authored materials, scene-graph
budgeting.

### Observed

A near-black site (`#000` ground) that opens on a long preloader — a line-drawn
character head with a percentage counter — then resolves to a single line of
Japanese set in a very low-contrast grey: 「ここは、光を拒む世界」 *("this is a
world that refuses light")*. Extremely restrained, extremely dark, one canvas
holding the entire experience.

The finding that matters is not visual. It is this:

```
canvas.getContext('webgl2')  →  false
canvas.getContext('webgl')   →  false
canvas.getContext('webgpu')  →  true
window.__THREE__             →  "182"
```

**This is a real, shipping, commercial site running three's `WebGPURenderer`.**
The WebGL contexts fail precisely because a WebGPU context is already bound to
that canvas. On three **r182**.

### The one reusable technique

**WebGPU is production-viable — on a current three, which is not the one this
site is on.** The version number is the entire lesson. r182 is roughly a year of
releases past this project's r171, and that year is exactly the period in which
the node/TSL system and the WebGPU backend stabilised. The reference does not
prove "WebGPU works"; it proves "WebGPU works *if you are on r182*."

That reframes §3.1 from a renderer swap into a dependency upgrade with a
renderer swap on the end of it, and it is why the migration is scoped as a
follow-up rather than attempted in place on r171. Full reasoning, blockers and
switch-over checklist: [WEBGPU-MIGRATION.md](WEBGPU-MIGRATION.md).

I could not confirm TSL authoring or scene-graph budgeting from outside the
bundle — both are compile-time concerns with no runtime signature to probe. Not
claiming otherwise.

### Verdict — **adopt the conclusion, not the aesthetic**

The technical direction is adopted and is the backbone of the migration doc.

### Rejected from this site

**The near-invisible first screen.** Ivress opens on grey type at maybe 12%
contrast against pure black, after a long preloader. It is a confident piece of
art direction for a brand site and it would be malpractice here. This site has a
job — it has to communicate, at a glance, that a specific developer is available
for work. A hero that withholds is a hero that fails at that. Legibility is not
negotiable on a portfolio.

---

## 5. explore.ownprimland.com — atmosphere

**Studied for:** atmospheric fog and a scroll-driven camera gliding through a
world.

### Observed

three r179, WebGL2, GSAP + Lenis, one canvas, one `<video>`. A circular arc
preloader draws itself around a centred leaf mark, then hands off to an aerial
view of forested terrain — rivers, fairways, roads, scattered buildings — with
the camera slowly gliding over it.

The whole effect rests on one thing: **cloud and mist layers at several distinct
depths, moving at different rates, some passing in front of the terrain and
some behind.** A bank of mist crosses the lower-left foreground while thinner
haze sits over the ridgeline behind. Nothing else in the frame is doing heavy
lifting — the terrain itself is close to a static asset. The depth is entirely
manufactured by the atmosphere.

The colour discipline is worth noting: the entire frame is one hue family
(greens from near-black to pale sage), and the preloader ground is the *same*
green the scene resolves into, so the handoff has no colour jump.

### The one reusable technique

**Parallaxed atmosphere at multiple depths does more for perceived scale than
geometry does.** Cheap, and it scales down gracefully — drop layers, not
resolution.

The second, subtler one, already partly practised here: **the preloader's ground
colour should be the scene's ground colour.** This site does that (`#08080A`
throughout) and should keep doing it through the new preloader.

### Verdict — **adopt in a strictly limited form**

There is already `FogExp2` at density 0.052 on this scene. The adoptable part is
using *occlusion* as the depth cue in §3.4: the volumetric shafts must be
occluded by the mark's own geometry, so the light is demonstrably behind the
object. That is the same principle as Primland's mist crossing in front of the
ridge, applied to a single object instead of a landscape.

### Rejected from this site

- **The world.** Primland has a place to fly over. This site has one object in a
  studio. Building terrain to glide across would be inventing content to justify
  a camera move — the exact failure mode where an effect looks like a demo
  rather than a product.
- **The heavy foreground mist banks.** At the scale of a single mark, mist
  crossing in front reads as a dirty lens, not as atmosphere. The shafts stay
  behind and around the silhouette. Subtle — atmosphere, not a lens flare.

---

## Summary — what is being taken

| From | Technique | Where it lands |
|---|---|---|
| oryzo.ai | Drawing and render as one continuum; construction geometry in **SVG**, not shader | §3.5 preloader |
| hubtown.co.in | Pointer-driven branch inside one material — **no CSS mask, no second canvas** | §3.3 mouse-reveal |
| brand.ivress.co.jp | WebGPU is viable **on r182**; r171 is the blocker | §3.1 → WEBGPU-MIGRATION.md |
| explore.ownprimland.com | Occlusion by real geometry is the depth cue | §3.4 volumetric shafts |
| cartier.com | — not studied, URL is dead — | — |

## What is being rejected, and why

| Rejected | Reason |
|---|---|
| Scroll-long object re-posing (oryzo) | The mark is anamorphic; it is only legible near head-on |
| Audio (hubtown) | Banned in DESIGN-SYSTEM.md |
| Named chapter rail (hubtown) | Same failure as section numbering — reads as a slide deck |
| Long opaque preloader (hubtown, ivress) | Boot milestones already gate this honestly |
| Discrete 3D rooms (cartier, as briefed) | Contradicts the one-continuous-room architecture |
| Withholding low-contrast hero (ivress) | A portfolio has to communicate at a glance |
| Terrain to fly over (primland) | Inventing content to justify a camera move |
| Foreground mist banks (primland) | At single-object scale, reads as a dirty lens |

Seven rejections against four adoptions is the right ratio. Every one of these
sites is selling something with a budget behind it. This one is selling one
person, and the moment it looks like it had a team, it stops being true.
