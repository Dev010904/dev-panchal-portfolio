# Adding a project

Two steps. Nothing else changes.

---

## 1. Capture the screenshot

```bash
node scripts/capture-shot.mjs "https://the-project-url.com" my-project 9000
```

The last argument is how long to wait in real seconds before capturing. If the
target site has its own preloader or heavy hero, raise it — 9 seconds covers
most sites, 25 covers a cold Cloud Run container. (The script drives headless
Chrome over the DevTools protocol rather than using `--screenshot`, because that
flag fires on the load event and reliably captures other people's loading
spinners.)

If the site opens onboarding or a consent dialog over its own UI on a first
visit, dismiss it before the shutter with `CAPTURE_EVAL`:

```bash
CAPTURE_EVAL='document.querySelector("[data-skip]").click()' \
  node scripts/capture-shot.mjs "https://app.example.com" my-project 25000
```

Then **open the file and look at it.** A capture that came back showing a modal,
a spinner or an error page is worse than no capture.

**Always capture the real site.** Never a mockup, never a design file export. A
portfolio that shows a render of a site instead of the site is lying slightly,
and people can tell.

### Size and aspect

Every card on the arc shares one geometry, so every screenshot has to share one
aspect ratio. The set is **1280×800**. Normalise a fresh capture with:

```bash
node -e "const s=require('sharp'),f=require('fs');const b=f.readFileSync('public/work/my-project.webp');s(b).resize(1280,800,{fit:'cover',position:'top'}).webp({quality:80}).toBuffer().then(o=>f.writeFileSync('public/work/my-project.webp',o))"
```

1280 is a deliberate cap. The cards are never more than about a third of the
viewport wide, so anything larger is texture memory and download weight spent on
detail that is never sampled.

---

## 2. Add one object

In `src/data/projects.ts`:

```ts
{
  id: 'my-project',                       // stable, never reused
  title: 'My Project',
  summary: 'What it is. One line.',       // what it IS, not what it means
  tags: ['WEB', 'DESIGN'],
  links: [
    { label: 'VISIT SITE', href: 'https://the-project-url.com' },
  ],
  image: '/work/my-project.webp',
  imageWidth: 1280,
  imageHeight: 800,
  status: 'live',

  // Optional — include only when true of this project:
  // context: 'Commercial site · design + build',
  // role: 'Front-end',
  // year: 2026,
  // stack: ['Next.js', 'Three.js'],
  // caseStudyUrl: '/work/my-project',
}
```

That's it. Done.

**`links` is ordered.** The first one is the primary: it is what a click on the
card in the arc opens. The rest render as extra ArrowLinks beside the focused
card. A project with a live app, a repository and a write-up gets three; most
get one.

---

## What happens automatically

**The arc lays itself out.** Cards are panels bent around a cylinder, and the
angular step between them is derived from the card width and the radius in
`WORK.arc` — so the spacing is identical whether there are two projects or ten.
Nothing is positioned by hand.

**The pin grows with the list.** The section is pinned for
`projects.length × WORK.scrollPerProject` viewport heights, so each project gets
the same amount of scroll to travel through the apex.

**The copy follows the apex.** Whichever card is nearest the apex writes its
index into the store, and the DOM panel crossfades to that project's title,
summary, spec and links.

**The texture loads lazily.** It starts downloading one viewport before the
section arrives (`workNear` in the store), so a below-the-fold screenshot never
sits in the preloader's critical path.

**Keyboard access is generated.** Every project also renders as a visually
hidden anchor inside the pinned plate, because a raycast mesh in a canvas cannot
be tabbed to.

---

## Rules

- **No invented projects.** If there is one real project, show one.
- **No fake testimonials, no fake clients, no fake metrics.** The site omits
  sections it cannot fill honestly — that is a deliberate choice and it is
  stronger than padding.
- `summary` describes the thing. "Industrial gas and cryogenic oxygen supplier"
  beats "a bold digital experience".
- `status: 'live'` means you can click it right now. If it is not up, say
  `'in-progress'` or leave it out.

---

## Removing a project

Delete the object. Delete the `.webp`. Nothing else references it.
