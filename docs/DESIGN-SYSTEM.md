# Design system

Dark only. There is no light mode and there will not be one.

---

## Colour

| Token | Value | Use |
|---|---|---|
| `--color-bg` | `#08080A` | Base. Everything sits on this. |
| `--color-bg-raise` | `#101013` | Raised surfaces. Used sparingly. |
| `--color-fg` | `#F2F2F0` | Type. Slightly warm off-white, never pure `#FFF`. |
| `--color-fg-dim` | `#8A8A85` | Body copy, labels, anything secondary. |
| `--color-rule` | `#1E1E22` | Hairlines. The structural workhorse. |
| `--color-accent` | `#FF5A1F` | Ember. **One hover, one glint, one line.** |
| *(3D only)* | `#3A6EA5` | Cold steel rim light. **Never appears in the DOM.** |

### The accent rule

Ember is rationed, and the ration is the point. On a page this dark, one warm
element is a focal point; three are a theme; five are a warning label.

Where it is allowed to appear, per screen:
- the inlay strip on the mark (the "one line")
- one interactive state at a time (a hover, the arrow on a CTA)
- one specification value (`LIVE`, `DP—01`)

If you are adding a fourth, take one away.

`--accent-2` (`#3A6EA5`) is deliberately absent from the CSS. It exists only as
a rim light in the 3D scene. Putting a second hue into the DOM breaks the
one-accent discipline immediately.

---

## Type

Two faces, self-hosted by `next/font` (no third-party CDN request, no CLS).

- **Display / body** — Inter Tight (400 / 500 / 700)
- **Labels / data** — JetBrains Mono (400 / 500)

| Class | Spec |
|---|---|
| `.t-display` | `clamp(2.75rem, 10.5vw, 11rem)` · 700 · tracking `-0.035em` · lh `0.9` |
| `.t-h2` | `clamp(2rem, 6.2vw, 5.6rem)` · 700 · tracking `-0.03em` · lh `0.92` |
| `.t-lead` | `clamp(1.15rem, 2.5vw, 2.1rem)` · 400 · lh `1.22` |
| `.t-body` | `clamp(0.9rem, 1.05vw, 1.0625rem)` · lh `1.62` · `--color-fg-dim` |
| `.t-label` | `11–12px` · mono · uppercase · tracking `0.18em` |
| `.t-mono` | `12px` · mono · tabular-nums |

Headlines are authored as **explicit lines**, not word-split. Splitting a
headline on spaces so each word can have a reveal wrapper turns "How it gets
built" into a four-line headline. Line breaks are a typographic decision.

---

## Structure

**12 columns**, `clamp(0.75rem, 1.6vw, 1.75rem)` gutters, page inset
`clamp(1.25rem, 4vw, 4.5rem)`. Use `.grid12`.

**Never centre everything.** The composition is deliberately asymmetric:
headline hard left, object right of centre, chip bottom-right, spec column
`lg:col-start-9`.

### Furniture instead of cards

Hairline rules and `+` registration marks do the work that borders and cards
would otherwise do. They read as precision instrumentation, they cost nothing,
and — unlike a card — they cannot look like a Tailwind UI block.

- `<Rule />` — a hairline
- `<CornerMarks />` — four `+` marks defining an area without drawing a box
- `<SectionTag name="WORK" />` — ember tick, hairline, label

**No numbering.** Section markers carry no `01 / 02 / 03`. Numbering a six-item
page tells the reader nothing the scrollbar does not, and makes the site read
as a slide deck with an agenda.

---

## Motion

| Rule | |
|---|---|
| Nothing snaps | Every transition ≥ 400ms; most 700–1200ms |
| Easing vocabulary | `power3.out` (entrances) · `power2.inOut` (moves) · `expo.out` (reveals) · `none` (marquees only) |
| Everything staggers | Never reveal two siblings on the same frame |
| One authority | GSAP owns motion. Framer Motion never animates a property GSAP is touching. |
| One loop | `gsap.ticker`. No component gets its own `requestAnimationFrame`. |
| Frame-rate independence | Damping is `1 - exp(-k·dt)`, never a fixed lerp factor |

**Every timing lives in `src/config/animation.ts`.** No duration, distance,
camera angle or easing may appear as a literal in a component. If you are
editing a number inside a component, it belongs in the config instead.

### Reduced motion

`prefers-reduced-motion: reduce` hard-cuts to end states and freezes the 3D on a
composed static frame. The site must still look *designed* — not stripped. Test
it with `__qa.reducedMotion(true)` in the console; you should not have to change
your OS settings to check an accessibility mode.

---

## 3D

One `<Canvas>` at the root layout. It never unmounts.

The site is **one continuous room**. Sections and routes are places in it:

| Region | World Y |
|---|---|
| The mark | `0` |
| The Lab field | `-30` |
| Work mocks | `-60` |
| `/process` lattice | `-90` |
| `/stack` stack | `-120` |
| `/notes` helix | `-150` |

Navigating flies the camera. Nothing is torn down, which is why there is never a
white flash and never a re-initialised WebGL context.

The camera is never positioned directly — always solved from a spherical orbit
`[radius, azimuth°, elevation°]` plus damped cursor parallax, so every key in
the config is a rig pose rather than a world coordinate.

---

## Bans

No cartoon or low-poly-cute anything. No mascots. No emoji. No purple-to-blue
gradients. No glassmorphism. No stock photography. No Lottie. No audio.

If a section could plausibly be a Tailwind UI block, it is wrong.
