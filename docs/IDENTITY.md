# DP‑01 — "The Instrument"

Why the mark looks the way it does, and how to regenerate it.

---

## The idea

**D and P are the same letter twice.** Both are a vertical stem carrying a bowl.
D's bowl runs the full height; P's bowl runs the top half.

So one stem plus two bowls *is* "DP". Not a visual pun, not a trick — a
ligature. That is the whole mark.

The two bowls sit at **different Z depths**. Head‑on they overlay into a
readable monogram; from any other angle they separate into an abstract object
of arcs floating off a machined rail. Rotating it is the reveal.

```
        ┌──┐
        │▓▓│◜◜◜◜◝            spine  (shared stem, both letters)
        │▓▓│      ◝          minor arc  (top-half bowl → P), forward in Z
        │▓▓│  ◜◝   │         major arc  (full-height bowl → D), back in Z
        │▓▓│   │   │         inlay  (anodised strip in the milled channel)
        │▓▓│  ◟◞   │
        │▓▓│      ◞
        └──┘◟◟◟◟◞
```

---

## Why this direction

Three were considered.

**The Lattice** — a mark made of thousands of instanced points held by a field,
able to dissolve and re-crystallise. Rejected because the site already has a
particle field in the Lab, so the identity and the toy would have been the same
idea twice. It also collapses the four-state requirement: a point cloud is
*already* the dissolved state, so there is nowhere to go.

**The Fold** — a single ribbon folding through itself, liquid-metal material,
environment reflections doing the work. Genuinely beautiful, and rejected on
practicality: a continuous surface has no components, so there is nothing to
explode and annotate, and it produces a mushy 32px favicon.

**The Instrument** — chosen. It has real parts, so the Deconstruction has
something honest to take apart. It reads as designed rather than generated. It
survives to 32px. And its anamorphic quality gives the site its one genuinely
memorable idea: *the logo is only a logo from one angle.*

---

## One source of numbers

The single most important architectural decision in the identity:

```
src/lib/mark/paths.ts        ← the ONLY place any coordinate exists
   ├── lib/mark/geometry.ts  → THREE.Shape → ExtrudeGeometry   (the 3D object)
   └── lib/mark/svg.ts       → SVG path `d`                     (nav, favicon)
```

The flat logo and the hero object are generated from the same outlines. They
**cannot** drift, because there is nothing to keep in sync.

`scripts/generate-brand.mjs` duplicates those numbers deliberately, so brand
assets can be regenerated without a TypeScript toolchain — and it contains a
drift check that reads `paths.ts` and fails loudly if the two disagree.

---

## The parts

| Part | Role | Material |
|---|---|---|
| `spine` | Shared stem. Solid rail with a channel milled down its face. | graphite |
| `major-arc` | Full-height bowl. Stem + this = **D**. Sits furthest back. | graphite |
| `minor-arc` | Half-height bowl. Stem + this = **P**. Sits forward. | graphite |
| `shim-a` / `shim-b` | Thin backing straps. Structurally nothing; they give the rim light more edges and the exploded view its depth. | steel |
| `inlay` | Anodised strip seated in the spine's channel, drilled for the pins. **The only accent in the entire identity.** | ember |
| `pins` | Locating pins through the inlay's holes. Instanced. | steel |

### Two things that were wrong first time

**Bolt-hole pattern.** The spine originally carried four large counterbores
down its centreline. Below about 200px they read as polka dots and made the
mark look playful — the one register it must never be in. A single continuous
milled channel does the same "this is a machined part" job and gets *stronger*
as it scales down.

**Shim size.** The shims started at 74×56 and 58×54 units. At hero size they
read as separate rectangular objects floating behind the mark and the eye went
to them instead of the monogram. Narrow straps sized to the spine support the
object instead of competing with it.

---

## Material

Near-black machined aluminium. The whole look rests on one idea: **a dark
object in a photo studio is legible almost entirely through its edges.**

- Diffuse colour is nearly black and does almost nothing.
- `metalness: 1` — the surface is pure reflection.
- `roughness` sits in a narrow band (0.26–0.42). Past ~0.5 the object turns to
  charcoal mud; below ~0.2 it becomes a mirror ball and stops reading as metal.
- `envMapIntensity` above 1 is deliberate: the light rig has to be dim to work
  on a `#08080A` page, and this buys the highlight back without lifting the black.
- Chamfers on every extrusion, `bevelSegments: 3`. **The bevel is the only thing
  that produces a highlight, so it is the entire reason the object is legible.**

The rig is Lightformers, not a downloaded HDRI — see `src/scenes/Stage.tsx` for
why. Short version: 0 KB, and you can put each softbox exactly where the chamfer
needs to catch.

---

## The four states

Morphed between, never swapped. All driven by one scrubbed `progress` value, so
the whole sequence is a pure function of scroll and runs backwards without drift.

1. **assembled** — every part at its stored transform; the ligature resolves
2. **exploded** — parts translated along their own seating axes, staggered
3. **wireframe** — `EdgesGeometry` lines plus a fresnel ghost; solid crossfades out
4. **dissolved** — area-weighted surface point cloud on a curl-noise field

Assembled transforms are **stored on build, never authored**. Parts are offset
away from them to explode and lerp back. Authoring exploded coordinates by hand
is how you end up with parts driving through each other the first time somebody
changes a depth.

---

## Motion

The hero **sways**, it does not spin. The mark only reads as "DP" within roughly
±30° of head-on, so a full rotation means the monogram is illegible for most of
the time anyone is looking at it. A ±27° sway keeps it readable while still
showing enough parallax to prove it is a solid object. The full 360° belongs to
the Deconstruction, where the point is that it *stops* being a monogram.

Four orbital rings surround it on non-orthogonal axes at mutually irrational
rates — a gimbal the mark is mounted in. Orthogonal axes read as an atom diagram
from a textbook; skewed axes read as a mechanism.

---

## Regenerating

```bash
node scripts/generate-brand.mjs
```

Writes `mark.svg`, `wordmark.svg`, `favicon.svg`, PNG favicons and the
apple-touch icon into `public/brand`.

The OG card is rendered from the **live hero scene**, not from the flat mark:

```bash
npm run build && npx next start -p 3100
node scripts/capture-shot.mjs "http://localhost:3100" og 12000 1200 630 brand
```

To change the mark itself, edit `src/lib/mark/paths.ts`, mirror the numbers in
`scripts/generate-brand.mjs` (it will refuse to run if you forget), and re-run
the generator. The 3D object updates on save.
