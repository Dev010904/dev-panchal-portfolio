# The design system

A dark, instrument-panel visual system for a site whose centrepiece is a 3D
object. Reproduced here because the rendering decisions and the design
decisions constrain each other — the accent ration is why the ember on the mark
reads, and `#08080A` staying `#08080A` is why the grade cannot be replaced
casually.

## Contents

- [Colour and the accent ration](#colour)
- [Type](#type)
- [Structure: furniture instead of cards](#structure)
- [Motion](#motion)
- [3D: one room, one canvas](#3d-one-room-one-canvas)
- [The preloader is a CAD viewport](#the-preloader)
- [Bans](#bans)

---

## Colour

Dark only. There is no light mode.

| Token | Value | Use |
|---|---|---|
| `--color-bg` | `#08080A` | Base. Everything sits on this. |
| `--color-bg-raise` | `#101013` | Raised surfaces. Sparingly. |
| `--color-fg` | `#F2F2F0` | Type. Slightly warm off-white, **never** pure `#FFF`. |
| `--color-fg-dim` | `#8A8A85` | Body copy, labels, anything secondary. |
| `--color-rule` | `#1E1E22` | Hairlines. The structural workhorse. |
| `--color-accent` | `#FF5A1F` | Ember. One hover, one glint, one line. |
| *(3D only)* | `#3A6EA5` | Cold steel rim light. **Never appears in the DOM.** |

### The accent ration

On a page this dark, one warm element is a focal point; three are a theme; five
are a warning label. The ration is the design.

Allowed per screen: the inlay strip on the object, **one** interactive state at
a time, **one** specification value. If you are adding a fourth, take one away.

The second hue exists **only** as a rim light in the 3D scene and is
deliberately absent from the CSS. Putting it into the DOM breaks the
one-accent discipline immediately — and it is the kind of change that looks
harmless in isolation and cheapens every screen at once.

## Type

Two faces, self-hosted (no third-party CDN request, no CLS).

- **Display / body** — a tight grotesque, 400 / 500 / 700
- **Labels / data** — a mono, 400 / 500

| Class | Spec |
|---|---|
| `.t-display` | `clamp(2.75rem, 10.5vw, 11rem)` · 700 · tracking `-0.035em` · lh `0.9` |
| `.t-h2` | `clamp(2rem, 6.2vw, 5.6rem)` · 700 · tracking `-0.03em` · lh `0.92` |
| `.t-lead` | `clamp(1.15rem, 2.5vw, 2.1rem)` · 400 · lh `1.22` |
| `.t-body` | `clamp(0.9rem, 1.05vw, 1.0625rem)` · lh `1.62` · dim |
| `.t-label` | `11–12px` · mono · uppercase · tracking `0.18em` |
| `.t-mono` | `12px` · mono · tabular-nums |

**Headlines are authored as explicit lines, not word-split.** Splitting a
headline on spaces so each word gets a reveal wrapper turns a two-line headline
into a four-line one. Line breaks are a typographic decision, not a side effect
of your animation technique.

## Structure

**12 columns**, `clamp(0.75rem, 1.6vw, 1.75rem)` gutters, page inset
`clamp(1.25rem, 4vw, 4.5rem)`.

**Never centre everything.** The composition is deliberately asymmetric:
headline hard left, object right of centre, chip bottom-right, spec column
starting around column 9.

Composition is solved **in the camera**, not with CSS. Push the 3D object out
of the type's column with a camera target offset; the type sits on the grid and
the object moves out of its way.

### Furniture instead of cards

Hairline rules and `+` registration marks do the work borders and cards would
otherwise do. They read as precision instrumentation, they cost nothing, and —
unlike a card — they cannot look like a UI-kit block.

- a hairline rule
- four `+` corner marks defining an area without drawing a box
- a section tag: accent tick, hairline, label

**No numbering.** Section markers carry no `01 / 02 / 03`. Numbering a six-item
page tells the reader nothing the scrollbar does not, and makes the site read
as a slide deck with an agenda.

## Motion

| Rule | |
|---|---|
| Nothing snaps | Every transition ≥ 400ms; most 700–1200ms |
| Easing vocabulary | `power3.out` entrances · `power2.inOut` moves · `expo.out` reveals · `none` marquees only |
| Everything staggers | Never reveal two siblings on the same frame |
| One authority | GSAP owns motion. A second animation library never touches a property GSAP is touching. |
| One loop | One ticker. No component gets its own `requestAnimationFrame`. |
| Frame-rate independence | Damping is `1 - exp(-k·dt)`, **never** a fixed lerp factor |

**Every timing lives in one config module.** No duration, distance, camera
angle or easing may appear as a literal in a component. If you are editing a
number inside a component, it belongs in the config instead. This is what makes
a scene tunable without archaeology.

### Reduced motion

`prefers-reduced-motion: reduce` hard-cuts to end states and freezes the 3D on
a composed static frame. **The site must still look designed — not stripped.**

Make it togglable from the QA harness. Nobody should have to change their OS
settings to check an accessibility mode, and a mode that is inconvenient to
check is a mode that silently rots.

## 3D: one room, one canvas

One `<Canvas>` at the root layout. **It never unmounts.**

The site is one continuous room; sections and routes are places in it, at
different world Y. Navigating **flies the camera**. Nothing is torn down, which
is why there is never a white flash and never a re-initialised WebGL context —
and re-initialising a context mid-session is a real cost, not a cosmetic one.

The camera is never positioned directly. Always solve it from a spherical orbit
`[radius, azimuth°, elevation°]` plus damped cursor parallax, so every key in
the config is a **rig pose** rather than a world coordinate. Poses can be
interpolated and reasoned about; world coordinates cannot.

A note on framing that is easy to get wrong: a wide establishing shot turns a
volumetric structure into *a small object on a dark field* — a diagram of the
idea rather than the thing. If the intent is "somewhere you are", the camera
has to sit close enough that geometry passes on both sides of it.

## The preloader

A technical drawing that assembles itself, then solidifies into the real
object.

**It is SVG and GSAP, not shader work.** A preloader exists to cover shader
compilation, so a preloader that needs the GPU is competing with the thing it
is covering. ~46 SVG elements and one scrubbed timeline cost nothing on a CPU
that is otherwise idle.

- **Cap the element budget** (~50) and report the live count from the harness.
  If the drawing needs more elements to read, simplify the drawing.
- **Every outline comes from the same source array the 3D object extrudes
  from.** Nothing is traced or re-authored, so the drawing and the object it
  becomes cannot drift.
- **The wordmark is a datum, not a caption.** Static hairline type from the
  first frame — it never scrambles or resolves. Force its set width with
  `textLength` so a dimension measuring it is correct by construction rather
  than dependent on a font that may not have loaded.
- **One resolution event.** Three competing resolutions — wordmark resolving
  *while* the counter climbs *while* panels split — give the eye nowhere to go,
  and the moment that should land does not.
- **Scrub the drawing by real load progress.** One paused timeline; the frame
  loop sets its playhead from the damped progress value. The drawing is exactly
  as far along as the site is loaded, so nothing about the timing is invented.

## Bans

No cartoon or low-poly-cute anything. No mascots. No emoji. No purple-to-blue
gradients. No glassmorphism. No stock photography. No Lottie. No audio.

**If a section could plausibly be a UI-kit block, it is wrong.**
