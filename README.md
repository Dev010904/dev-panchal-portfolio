# Dev Panchal — portfolio

A 3D animated site. WebGL is the substrate, not a decoration: one persistent
canvas at the root, and every section either lives in the scene or composites
over one that is doing something.

**Static is a choice.**

---

## Run

```bash
npm install
npm run dev
```

→ http://localhost:3000

```bash
npm run build      # production build — must pass clean
npm start          # serve the build
npm run typecheck  # tsc --noEmit
```

---

## Stack

Next.js 15 (App Router, TypeScript strict) · React 19 · three · @react-three/fiber v9
· drei · @react-three/postprocessing · GSAP + ScrollTrigger · Lenis · Tailwind v4
· zustand · hand-written GLSL

> **Version note.** Next 15's App Router requires React 19, which requires
> `@react-three/fiber` v9 and `drei` v10. R3F v8 uses a React 18 internal that
> React 19 removed and fails at runtime with `ReactCurrentOwner is undefined`.
> Do not downgrade React without downgrading the whole 3D stack with it.

---

## Where things are

```
src/
  app/                    routes — page.tsx, [slug]/page.tsx, sitemap, robots
  components/             DOM layer
    sections/             the home page's sections
    ui/                   primitives (ArrowLink, Email, SectionTag, …)
  scenes/                 R3F — SceneRoot, MarkObject, LabField, FooterFloor, …
  shaders/                hand-written .glsl
  lib/mark/               the procedural mark generator
  lib/structures.ts       procedural geometry for interior pages
  config/animation.ts     ← every timing, camera key and distance
  data/projects.ts        ← the one file to edit to add work
  data/pages.ts           interior page content
  store/scene.ts          zustand scene state
docs/                     IDENTITY · DESIGN-SYSTEM · HOW-TO-ADD-A-PROJECT · verdict
scripts/                  brand asset + screenshot generators
```

### The two files you will actually edit

- **`src/data/projects.ts`** — add work. One object literal. See
  [docs/HOW-TO-ADD-A-PROJECT.md](docs/HOW-TO-ADD-A-PROJECT.md).
- **`src/config/animation.ts`** — retime anything. Every duration, easing,
  camera pose and distance in the site lives here and nowhere else.

---

## Architecture, briefly

**One canvas, one room.** `<SceneRoot />` mounts in the root layout and never
unmounts. The mark sits at the world origin, the Lab field at `y = -30`, the
work mocks at `-60`, and each interior page's structure below that. Changing
section or route flies the camera. Nothing tears down, so there is no white
flash and no re-initialised GL context.

**One animation loop.** `gsap.ticker` drives Lenis, ScrollTrigger, the R3F
render loop and every DOM readout. No component owns a `requestAnimationFrame`.
That buys deterministic ordering, one callback dispatch per frame, and the
ability to drive the whole site manually — which is what the QA harness does.

**Nothing is downloaded.** The mark, the interior structures, the particle
fields and the environment lighting are all generated in code. There is no
model file, no HDRI, no texture except the one real project screenshot.

---

## Dev QA harness

Because everything runs on one loop, the whole site can be stepped by hand.
In the console (dev builds only):

```js
__qa.tick(1/60, 120)        // advance 2 simulated seconds
__qa.scrollToFraction(0.28) // jump to 28% of the page and settle
__qa.pointer(900, 400)      // move the virtual cursor
__qa.reducedMotion(true)    // force the reduced-motion path
__qa.state()                // scene state snapshot
__qa.snapshot()             // draw calls, triangles, programs
__qa.inspect()              // flat scene graph dump
```

This exists because Chrome throttles `requestAnimationFrame` to zero in a
hidden or occluded tab, so an automated screenshot of a WebGL page otherwise
captures frame one forever. It is also the only honest way to verify a scrubbed
timeline — a sequence that only looks right playing forwards is a bug, and you
cannot find that bug by watching it play forwards.

---

## Regenerating assets

```bash
node scripts/generate-brand.mjs                     # SVG mark, wordmark, favicons

# project screenshot
node scripts/capture-shot.mjs "https://site.com" name 9000

# OG card, rendered from the live hero scene
npm run build && npx next start -p 3100
node scripts/capture-shot.mjs "http://localhost:3100" og 12000 1200 630 brand
```

---

## Deploy

Vercel, zero config — it is a stock Next.js App Router build.

```bash
npx vercel
## Contact

devpanchal.web@gmail.com · [WhatsApp](https://wa.me/918460289432) ·
[Instagram](https://www.instagram.com/devp.web_dev/)
