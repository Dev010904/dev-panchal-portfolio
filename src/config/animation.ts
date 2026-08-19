/**
 * ANIMATION CONFIG — the sole source of truth for timing, camera and motion.
 *
 * Generated per the `animation-brief-to-config` method: no timing, distance,
 * camera angle or easing may appear as a literal anywhere in /src/scenes or
 * /src/components. If you want to retime the site, this is the only file you
 * touch. If you find yourself editing a number inside a component, that number
 * belongs here instead.
 *
 * Units: seconds for durations, world units for distance, degrees for angles.
 * Timeline positions are normalised 0..1 of the master Deconstruction timeline
 * so the whole sequence can be stretched by changing `scrollLength` alone.
 */

export const EASE = {
  /** Entrances. */
  enter: 'power3.out',
  /** Moves between two known states. */
  move: 'power2.inOut',
  /** Reveals — the snappier, more dramatic exit. */
  reveal: 'expo.out',
  /** Marquees only. */
  linear: 'none',
} as const;

export const SCROLL = {
  /** Lenis inertia. Lower = heavier. */
  lerp: 0.08,
  wheelMultiplier: 1,
  touchMultiplier: 1.6,
  /** ScrollTrigger scrub smoothing. Never `true` — that snaps. */
  scrub: 1,
} as const;

export const PRELOADER = {
  /** Minimum time the counter is on screen even if assets are instant. */
  minDuration: 1.1,
  /**
   * How fast the counter catches up to real progress. The k in 1 - exp(-k·dt).
   * Converted from the old fixed alpha of 0.075: -ln(1 - 0.075) × 60.
   */
  counterRate: 4.7,
  /**
   * THE CAD VIEWPORT.
   *
   * The preloader is a technical drawing that assembles itself, built from the
   * SAME `PARTS` outlines as the 3D mark — so the thing being drawn is the
   * thing that is loading, and the two can never drift apart.
   *
   * WHY SVG AND NOT A SHADER. This runs while the GPU is compiling every
   * program the site owns. Anything that needs the GPU is competing with the
   * work the preloader exists to cover. 44 SVG elements and one scrubbed GSAP
   * timeline cost effectively nothing and are done on the CPU, which is idle.
   * The research pass found Oryzo's preloader is 43 SVG elements over the
   * canvas for exactly this reason — see docs/research-2026-b.md.
   *
   * THE WORDMARK IS THE DATUM. "DEV PANCHAL" is static hairline type from the
   * first frame; it never scrambles, never resolves, never moves. The drawing
   * registers against it — dimension lines measure to its baseline and cap
   * height, the coordinate grid lands on its set width, and one leader points
   * at it. There is exactly ONE resolution event on this screen: the drawing
   * solidifying into the real mark. A second one competing with it is what
   * made the old glyph-scramble version read as two unrelated loaders stacked.
   *
   * `phases` are fractions of REAL progress, not seconds. Nothing here is on a
   * timer; the drawing is exactly as far along as the site is loaded.
   */
  cad: {
    /** Set width of the wordmark in viewBox units. Forced via `textLength`, so
     *  the dimension line that measures it is correct by construction rather
     *  than by measuring a font that may not have loaded yet. */
    wordWidth: 700,
    /** Cap height as a fraction of font size, for Inter Tight. The cap-height
     *  datum is drawn here, so this is a real typographic value, not a guess. */
    capRatio: 0.727,
    /**
     * Where each layer of the drawing lands, as a fraction of real progress.
     * Ordered the way a draughtsman works: grid, datums, outline, then the
     * things that annotate what is already there.
     */
    phases: {
      grid: { at: 0.0, dur: 0.26, stagger: 0.03 },
      datum: { at: 0.14, dur: 0.2 },
      outline: { at: 0.26, dur: 0.4, stagger: 0.05 },
      circles: { at: 0.42, dur: 0.3, stagger: 0.04 },
      points: { at: 0.55, dur: 0.24, stagger: 0.035 },
      dims: { at: 0.6, dur: 0.24, stagger: 0.03 },
      leader: { at: 0.8, dur: 0.2 },
    },
    /**
     * THE RESOLUTION. Runs once, on real `ready`, and is the only thing on
     * this screen that is time-based rather than progress-based — by then
     * there is nothing left to load, so there is no honest progress to drive it.
     */
    resolve: {
      /** Construction furniture leaves first, so the outline is alone. */
      strip: { duration: 0.42, ease: EASE.move },
      /** Outlines take their fill: the drawing becoming an object. */
      solidify: { duration: 0.5, ease: EASE.enter },
      /** Then the whole drawing pushes toward the camera and hands off. */
      handoff: { duration: 0.7, scale: 1.28, ease: 'power2.in' },
    },
  },
  /** The black panel split. */
  exit: { duration: 1.15, stagger: 0.09, ease: EASE.reveal },
} as const;

/**
 * INTERIOR PAGE LOADER — the plate that covers a route change.
 *
 * Time-based rather than progress-based, because on a client-side navigation
 * there is genuinely nothing left to load. What it covers is the camera's
 * travel to that page's structure, so `hold` is set from the shot durations in
 * SHOTS below. If those get slower, this has to follow or the plate lifts on a
 * camera still in motion.
 */
export const PAGE_LOADER = {
  hold: 1.05,
  exit: { duration: 0.85, ease: 'expo.inOut' },
} as const;

export const CAMERA = {
  fov: 34,
  near: 0.1,
  far: 60,
  /** Cursor orbit, degrees, damped. */
  parallax: { azimuth: 6, elevation: 3.6, damping: 0.055 },
} as const;

/**
 * World-space regions. The whole site is one room; sections are places in it.
 * The mark sits at the origin, the Lab field sits below it, and moving between
 * sections is a camera journey rather than a scene swap.
 */
export const LAB_ORIGIN_Y = -30;
export const WORK_ORIGIN_Y = -60;

/**
 * THE VISITOR TRACE sits ABOVE the mark, and everything else on this site sits
 * below it.
 *
 * Not arbitrary. The room descends through the author's own material — the
 * mark, the Lab, the work, the interior documentation at -90 to -180 — and
 * this is the one region that is not his. Travelling UP to reach it is the
 * only structural way the scene can say that, and the camera passes the mark
 * on the way, which frames the thing everyone is drawing around.
 */
export const TRACE_ORIGIN_Y = 30;

/**
 * Interior pages get their own region too. Routing does not unmount the scene;
 * it flies the camera to a different part of the same room, behind the wipe.
 */
export const PAGE_ORIGIN = {
  lattice: [0, -90, 0] as [number, number, number],
  stack: [0, -120, 0] as [number, number, number],
  helix: [0, -150, 0] as [number, number, number],
  archive: [0, -180, 0] as [number, number, number],
} as const;

/** Camera keys per scene state. Position is spherical: [radius, azimuth°, elevation°]. */
export const SHOTS = {
  /**
   * Hero — head-on-ish so the DP ligature is readable, with enough offset that
   * you can see it is a solid object rather than a flat logo.
   *
   * The negative target.x pushes the mark to the right of frame, clearing the
   * headline's column. Composition is solved in the camera, not with CSS: the
   * type sits on a grid and the object moves out of its way.
   */
  hero: {
    orbit: [4.9, -15, 5] as [number, number, number],
    target: [-0.78, 0.06, 0] as [number, number, number],
    duration: 1.6,
    ease: EASE.move,
  },
  /** Deconstruction start — dolly in, rotate to the exact resolve angle. */
  resolve: {
    orbit: [4.35, 0, 0] as [number, number, number],
    target: [0, 0, 0] as [number, number, number],
  },
  /** Mid-explosion — off-axis so the Z separation of the two bowls reads. */
  exploded: {
    orbit: [7.6, 41, 15] as [number, number, number],
    target: [0.1, 0.05, 0] as [number, number, number],
  },
  /** Dissolve — pull back and drop, particles fill the frame. */
  dissolved: {
    orbit: [9.1, 68, -7] as [number, number, number],
    target: [0, -0.1, 0] as [number, number, number],
  },
  /** Release — reassembled, three-quarter hero-ish view for the marquee. */
  release: {
    orbit: [6.9, 24, 9] as [number, number, number],
    target: [0, 0, 0] as [number, number, number],
  },
  /**
   * WORK — sat back off the arc.
   *
   * Near head-on, because the ribbon is built so that the apex card squares up
   * to the camera; any real azimuth here and the "focused" card is never
   * actually facing you. The 8° that is left, plus 6° of elevation, is enough
   * to see along the ribbon rather than straight down it.
   *
   * The negative target.x pushes the arc right of frame — same move as the
   * hero — so the focused card's title and links get the left five columns.
   */
  work: {
    orbit: [9.8, -8, 6] as [number, number, number],
    target: [-2.3, WORK_ORIGIN_Y + 0.15, 0] as [number, number, number],
    duration: 1.5,
    ease: EASE.move,
  },
  /**
   * ACHIEVEMENT — the camera leaves the arc, the way Contact leaves the mark.
   *
   * This used to keep the ribbon deliberately in frame: "small, low and clearly
   * finished with", on the argument that the section should still have
   * something moving in it. In practice it did not read as a ribbon receding,
   * it read as four documents someone had left on screen, drifting behind the
   * number and competing with it for the middle of the frame.
   *
   * Raising the target further does not fix that, and the reason is worth
   * writing down because it is not obvious. The old pose looks DOWN. A frustum
   * pitched below horizontal only gets wider the further it goes, so its lower
   * edge falls away faster than the arc does — a card 60 units down stays
   * inside it no matter how high the target is lifted. Sliding the ribbon along
   * its tangent does not help either, because that tangent runs almost exactly
   * along this camera's own view axis: the arc recedes and shrinks, and never
   * actually leaves.
   *
   * The only thing that works is to pitch the entire frustum ABOVE horizontal.
   * At -24° of elevation the camera sits BELOW its target and looks up, so the
   * lower edge of frame still clears horizontal by 7° after the 17° half-angle
   * and the 3.6° of cursor parallax are taken out of it. Everything at or below
   * the camera's own height is then unconditionally out of shot — which is
   * checked in the verifier, at every ribbon position, not just the parked one.
   *
   * What is left in frame is nothing, and that is the point: this section is one
   * number, and Contact already establishes that an empty frame is a pose the
   * site is allowed to strike.
   */
  credits: {
    orbit: [11, 30, -24] as [number, number, number],
    target: [-2.2, WORK_ORIGIN_Y + 12, 0] as [number, number, number],
    duration: 1.7,
    ease: EASE.move,
  },
  /**
   * The Lab lives in its own region of world space rather than swapping the
   * scene out. The site is one continuous room and the camera travels to a
   * different part of it — which is why the transition into the Lab can be a
   * camera move instead of an unmount.
   */
  lab: {
    orbit: [7.2, 0, 0] as [number, number, number],
    target: [0, LAB_ORIGIN_Y, 0] as [number, number, number],
    duration: 1.4,
    ease: EASE.move,
  },
  /**
   * ABOUT — the mark as atmosphere, not as subject.
   *
   * The previous pose was `[8.4, -70, -10]`, which is very nearly side-on. The
   * mark is an extrusion: its parts have depth but almost no width in Z, so at
   * 70° of azimuth it projects to a dark vertical sliver with the inlay
   * showing as a single orange stripe. It did not read as a designed angle, it
   * read as a rendering fault — and because the Deconstruction leaves the
   * timeline parked at 1, nothing was moving either.
   *
   * The replacement is a three-quarter: 34° of azimuth is well inside the
   * ±45° band where both bowls stay visible and the chamfers still catch the
   * cold rim, and 16° of elevation looks down the stem enough to show that the
   * two bowls sit at different depths.
   *
   * `presence` and the radius do the other half of the job. At 11.4 units the
   * FogExp2 at 0.052 density already eats about a third of the object, and
   * dropping the solids to 58% takes it the rest of the way — it sits clearly
   * behind the copy instead of competing with it. Pushing the target left of
   * the origin moves the mark to the RIGHT of frame (the hero does the same
   * thing for the same reason), clearing the nine columns the paragraph runs
   * across, and dropping it 0.55 keeps it out of the headline's line.
   */
  /**
   * TRACE — inside the accumulated structure, not looking at it from outside.
   *
   * The radius is deliberately short. Every previous visitor's stroke is a
   * filament in one shared volume, and a wide establishing shot turns that
   * into a small object on a dark field — a diagram of the idea rather than
   * the thing. Sitting close enough that filaments pass on both sides of the
   * camera is what makes it read as somewhere you are, which is the whole
   * claim of the section.
   *
   * Elevation is slightly negative so the structure hangs overhead and the
   * mark is below and behind, in the direction the camera just came from.
   */
  trace: {
    /**
     * The first version of this sat at radius 5.6, INSIDE the structure, on
     * the argument that filaments passing either side of the camera is what
     * makes it read as somewhere you are rather than an object you look at.
     *
     * Looked at on screen with 41 strokes in the table, that was wrong. Inside
     * the volume it is a full-frame tangle of lines: it buries the section's
     * own text, it reads as a screensaver rather than as a record, and it gets
     * strictly worse as the archive grows — which is the one direction this
     * section is guaranteed to move in. A section whose art direction degrades
     * with success is broken.
     *
     * From outside, the same geometry reads as a single accumulating body, the
     * ember of the newest stroke is findable, and 200 strokes is denser rather
     * than louder.
     */
    orbit: [11.2, -22, 6] as [number, number, number],
    target: [0, TRACE_ORIGIN_Y, 0] as [number, number, number],
    duration: 1.9,
    ease: EASE.move,
    presence: 0.2,
  },
  /**
   * THE RIG — the camera comes back to the mark so the light can be operated.
   *
   * Every other section either looks at the mark or looks somewhere else. This
   * one hands it over: the visitor drags and the rim light moves, and the
   * shafts, the shadow through the D's counter and the chamfer speculars all
   * answer. So the framing has two jobs the other shots do not have.
   *
   * Radius 5.9 rather than the hero's 4.9, because the shafts are the subject
   * as much as the object is, and they need air around the silhouette to read
   * as light in a room instead of a glow stuck to an edge.
   *
   * Azimuth +20 puts the mark slightly off-axis so the light can travel behind
   * it and come back out the other side visibly. At a head-on angle the whole
   * traverse happens behind the object and the visitor cannot see what their
   * own gesture is doing, which is the one thing this section cannot afford.
   *
   * Target sits a little above origin so the object hangs in the upper half
   * and the readout below it has somewhere to live.
   */
  rig: {
    orbit: [5.9, 20, 7] as [number, number, number],
    target: [0, 0.05, 0] as [number, number, number],
    duration: 1.7,
    ease: EASE.move,
  },
  about: {
    orbit: [11.4, 34, 16] as [number, number, number],
    target: [-3.6, 0.45, 0] as [number, number, number],
    duration: 1.6,
    ease: EASE.move,
    presence: 0.58,
  },
  /**
   * CONTACT — the camera leaves the object behind.
   *
   * This used to target the origin, which parked the monogram directly behind
   * `LET'S BUILD` and the email. The calmest section on the site was also the
   * busiest frame on it, and the reference has no object in its contact area at
   * all — just type, haze and rules.
   *
   * The fix is choreography, not visibility. The target rises to y = 5.6 while
   * the mark stays at the origin, so the camera cranes up and off it and the
   * mark falls out of the bottom of frame. At fov 34 the origin ends up ~38°
   * off the view axis against a 17° half-angle, so it is comfortably gone
   * rather than clipping the edge. Nothing is hidden, nothing unmounts, and
   * scrolling back up flies straight back to it.
   */
  contact: {
    orbit: [6.4, 150, 8] as [number, number, number],
    target: [0, 5.6, 0] as [number, number, number],
    duration: 1.7,
    ease: EASE.move,
  },

  /* ── Interior pages ────────────────────────────────────────────────────── */
  lattice: {
    orbit: [5.2, 28, 14] as [number, number, number],
    target: [0, PAGE_ORIGIN.lattice[1], 0] as [number, number, number],
    duration: 1.6,
    ease: EASE.move,
  },
  stack: {
    orbit: [5.0, -34, 8] as [number, number, number],
    target: [0, PAGE_ORIGIN.stack[1], 0] as [number, number, number],
    duration: 1.6,
    ease: EASE.move,
  },
  helix: {
    orbit: [5.6, 52, 6] as [number, number, number],
    target: [0, PAGE_ORIGIN.helix[1], 0] as [number, number, number],
    duration: 1.6,
    ease: EASE.move,
  },
  /**
   * /credentials — the archive.
   *
   * Elevation is low because the object is a fanned stack of flat plates, and
   * looking at a fan from nearly edge-on is what makes it read as a set of
   * separate records rather than as one blurred block. 15° is enough to see
   * down into the fan and see that the plates are at different angles, without
   * turning it into a plan view of a spiral.
   *
   * Azimuth stays POSITIVE, and that is inherited from the structure this
   * replaces for a reason that still applies. The plates are broad faces seen
   * at a grazing angle, so what they reflect is whatever sits at the mirror
   * direction — roughly horizontal, on the far side of the object. From a
   * negative azimuth that is the ember kicker at +X, and the whole stack came
   * back glowing orange: eleven accent elements on a site whose rule is one.
   * From +26 the same geometry catches the cold steel rim at -X instead, and
   * the only warm thing in frame is the single anodised seam.
   *
   * The radius is a little further out than the bars needed because the fan is
   * a wider object than the stack of rules was.
   */
  archive: {
    orbit: [5.8, 26, 15] as [number, number, number],
    // Target dropped below the structure's own origin, which lifts the object
    // in frame — it sat across the standfirst, and the one ember seam ran
    // straight through a line of it.
    target: [-1.1, PAGE_ORIGIN.archive[1] - 0.42, 0] as [number, number, number],
    duration: 1.6,
    ease: EASE.move,
  },
} as const;

export type ShotName = keyof typeof SHOTS;

/**
 * How solid the mark is in a given shot, 0..1.
 *
 * Only shots that want the object pushed into the background declare it. The
 * lookup is written as an `in` narrow rather than an index signature so that
 * adding `presence` to one more shot is a one-line change and forgetting it on
 * the others stays a non-error.
 */
export function shotPresence(shot: ShotName): number {
  const s = SHOTS[shot];
  return 'presence' in s ? s.presence : 1;
}

/**
 * AMBIENT MOTION AFTER THE DECONSTRUCTION.
 *
 * The hero sways because `HERO.sway` is faded in by `idle`, which is
 * `1 - min(progress*4, 1)` — so it is at full strength only while the
 * Deconstruction timeline is at zero. Once the pin releases, progress is
 * parked at 1 forever, `idle` is 0, and the mark stops dead. That is correct
 * for the sections where the camera has left it behind and wrong for About,
 * which is the one place after the pin where the object is still on screen.
 *
 * This is the second idle layer, gated on the timeline being FINISHED rather
 * than at zero, so the hero path is untouched. Everything is an absolute
 * function of `t - t0` where t0 is the moment the gate opened, which means it
 * starts from exactly zero and cannot jump at the handoff; the whole layer is
 * then multiplied by a damped fade so scrubbing back into the pin blends out
 * instead of cutting.
 *
 * Periods share no common divisor, so the composite never repeats visibly.
 */
export const MARK_AMBIENT = {
  /** How fast the layer fades in and out at the timeline's end. */
  fadeRate: 2.4,
  /** Shallow yaw. Degrees — well inside the band where the mark stays a form. */
  yaw: { amplitude: 11.5, period: 19 },
  /** Even shallower pitch, so the top chamfers move through the rim light. */
  pitch: { amplitude: 3.6, period: 13.3 },
  /** Slow positional drift. World units. */
  drift: { x: 0.16, y: 0.11, periodX: 23.5, periodY: 16.7 },
  /** The same breath the hero uses, at the same amplitude. */
  breath: { amplitude: 0.045, period: 7.5 },
} as const;

/**
 * THE DECONSTRUCTION — the pinned centrepiece.
 *
 * `scrollLength` is how many viewport heights the pin lasts. Every `at`/`dur`
 * below is a fraction of that, so stretching the section retimes everything
 * proportionally and nothing needs re-authoring.
 */
export const DECONSTRUCTION = {
  scrollLength: 4.2,

  /** Base explode distance in world units; each part scales this (paths.ts). */
  explodeDistance: 2.35,

  /** Master timeline segments, normalised 0..1. */
  keys: {
    /** Dolly in and rotate until the DP ligature resolves head-on. */
    resolve: { at: 0.0, dur: 0.19 },
    /** Hold on the resolved monogram so the reveal lands before it breaks. */
    hold: { at: 0.19, dur: 0.07 },
    /** Parts translate out along their own axes. */
    explode: { at: 0.24, dur: 0.26, stagger: 0.035, ease: EASE.move },
    /** Leader lines draw, then annotations type in. */
    annotate: { at: 0.33, dur: 0.16, stagger: 0.045 },
    /** Solid -> wireframe crossfade. */
    wireframe: { at: 0.5, dur: 0.11 },
    /** Wireframe -> particles. */
    dissolve: { at: 0.58, dur: 0.16 },
    /** Particles drift with scroll before pulling back. */
    drift: { at: 0.66, dur: 0.12 },
    /** Particles re-crystallise onto their source surfaces. */
    crystallise: { at: 0.74, dur: 0.14 },
    /** Parts travel home. `back.out` on the final seat — the mechanical click. */
    assemble: { at: 0.82, dur: 0.15, stagger: 0.028, ease: 'back.out(1.25)' },
    /** Camera pulls back into whatever is next. */
    release: { at: 0.9, dur: 0.1 },
  },

  /** Copy for the leader-line annotations. Order follows PARTS in paths.ts. */
  annotations: [
    { part: 'spine', text: 'SHARED STEM · D AND P', side: 'left' },
    { part: 'major-arc', text: 'FULL-HEIGHT BOWL — D', side: 'right' },
    { part: 'minor-arc', text: 'HALF-HEIGHT BOWL — P', side: 'right' },
    { part: 'shim-a', text: 'BACKING PLATE · 1.6', side: 'left' },
    { part: 'shim-b', text: 'BACKING PLATE · 1.6', side: 'left' },
    { part: 'inlay', text: 'INLAY · ANODISED', side: 'right' },
  ] as const,

  /** Rotation applied to the whole assembly across the sequence, degrees. */
  spin: { from: -13, to: 372 },
} as const;

export const HERO = {
  /**
   * The hero SWAYS, it does not spin.
   *
   * A constant yaw was the first instinct and it was wrong: the mark only
   * reads as "DP" within roughly ±30° of head-on, so a full rotation means the
   * monogram is illegible for most of the time anyone is looking at it. A slow
   * sway keeps it readable while still showing enough parallax to prove it is
   * a solid object and not a flat logo. The full 360° belongs to the
   * Deconstruction, where the point is that it stops being a monogram.
   */
  sway: { amplitude: 27, period: 15 },
  /** Sine "breath" — tiny vertical float. */
  breath: { amplitude: 0.045, period: 7.5 },
  /** Copy entrance. */
  intro: { duration: 1.25, stagger: 0.075, ease: EASE.reveal },
  ctaLetterStagger: 0.028,
} as const;

/**
 * THE SWEEP LINES — three hairline arcs drifting through the room.
 *
 * These replaced a fullscreen isoline shader, and the difference is the whole
 * point: a screen-space field is pinned to the glass and can only ever be
 * wallpaper. Three real objects in the scene get depth-tested against the
 * mark, so each one passes in front of it and then behind it as it turns, and
 * that occlusion is what sells the room as a room.
 *
 * Three rules they must keep:
 *
 *   - Not concentric. Different origins, different angles, different depths.
 *     Anything symmetrical reads as a diagram.
 *   - Nearly straight. `bow` is the sagitta in world units and it is small on
 *     purpose — a visible curve becomes a shape, and these are furniture.
 *   - Speeds share no common divisor and are all well under 0.05 rad/s, so a
 *     full turn takes minutes. If you can see it move, it is too fast.
 *
 * `axis` is each line's own rotation axis in its group's local space, close to
 * +X — which is the line's own length. A rod spinning about very nearly its own
 * axis barely translates on screen but swings its bow through Z, which is
 * exactly the parallax we want and none of the motion we don't.
 */
export const SWEEP = {
  /** Cool grey, deliberately off the warm palette so it stays background. */
  color: '#9aa4b4',
  opacity: 0.11,
  /** Points sampled along each arc. */
  segments: 128,
  lines: [
    {
      id: 'a',
      halfLength: 15,
      bow: 1.2,
      position: [0.35, 0.25, -1.7] as [number, number, number],
      tilt: [0, 0.22, 0.62] as [number, number, number],
      axis: [1, 0.22, 0.1] as [number, number, number],
      speed: 0.036,
    },
    {
      id: 'b',
      halfLength: 17,
      bow: 0.95,
      position: [-0.7, -0.55, 0.95] as [number, number, number],
      tilt: [0, -0.55, -0.38] as [number, number, number],
      axis: [1, -0.16, 0.26] as [number, number, number],
      speed: -0.027,
    },
    {
      id: 'c',
      halfLength: 14,
      bow: 1.45,
      position: [0.95, 0.1, -0.35] as [number, number, number],
      tilt: [0, 0.34, 1.15] as [number, number, number],
      axis: [1, 0.3, -0.14] as [number, number, number],
      speed: 0.049,
    },
  ],

  /**
   * THE DISCHARGE.
   *
   * Fires when the cursor comes within `strikeRadius` CSS pixels of a line's
   * projected curve. Everything about it is short: the reach, the life, the
   * pool. Two arcs is the ceiling — a storm of them is a screensaver, and one
   * every few hundred milliseconds is a thing that noticed you.
   */
  strike: {
    /**
     * Screen-space proximity that arms a line, in CSS px, measured to the
     * nearest point ON the projected stroke.
     *
     * This was 80, and 80 was covering for a broken measurement rather than
     * expressing a design intent. The old test took the distance to the nearest
     * of 17 sampled VERTICES spread ~190 CSS px apart, so the threshold had to
     * be enormous to catch anything at all — and even then it left dead zones
     * between the probes while firing 79px clear of the line beside them.
     *
     * With point-to-segment distance the number can mean what it says. 16px is
     * a comfortable cursor's-width either side of a hairline: close enough that
     * every strike reads as "I touched that line", far enough that you do not
     * have to be pixel-perfect on a stroke drawn at 0.11 opacity.
     */
    radius: 16,
    /**
     * Hysteresis. Arm at `radius`, disarm at `radius * exitFactor`.
     *
     * Without it a cursor resting exactly on the boundary crosses it on the
     * sub-pixel jitter of its own damping and the line strobes on and off. The
     * gap has to be wider than that jitter and narrower than anything a hand
     * does on purpose; 1.4 puts the release at ~22px.
     */
    exitFactor: 1.4,
    /** Preallocated bolts. Geometry is rewritten in place, never reallocated. */
    pool: 2,

    /* ── The channel ──────────────────────────────────────────────────────
     * A discharge is not a zigzag. What separates one from a lightning icon
     * is, in order of how much each matters: forks, a tapered width, a white
     * core inside a blue halo, and jitter at two scales. A constant-width
     * single polyline has none of those, which is why it reads as clip art
     * no matter how the angles are randomised. */

    /** Points along the main channel. */
    mainPoints: [11, 15] as [number, number],
    /** World units it travels from the line, roughly perpendicular. */
    reach: [0.5, 0.95] as [number, number],
    /** Half-width at the root, world units. Tapers to `tipWidth` of this. */
    rootWidth: 0.012,
    tipWidth: 0.2,

    /** Forks per strike. They are the single biggest contributor to realism. */
    forks: [2, 4] as [number, number],
    fork: {
      /** Where along the main channel a fork can split, as a fraction. */
      at: [0.22, 0.78] as [number, number],
      /** Fork length as a fraction of the parent's remaining reach. */
      length: [0.28, 0.58] as [number, number],
      points: [4, 7] as [number, number],
      /** Splay from the parent direction, radians. */
      angle: [0.45, 1.15] as [number, number],
      /** Forks are thinner and dimmer, and die out fast. */
      width: 0.42,
      intensity: 0.5,
    },

    /**
     * Two octaves of displacement. `coarse` sets the overall path from three
     * control offsets; `fine` is per-point chatter on top. One octave alone —
     * which is what a per-segment random gives you — makes every deviation the
     * same size, and that uniformity is what looks hand-drawn.
     */
    coarse: 0.34,
    fine: 0.1,

    /** Seconds it stays up before cutting to zero. */
    life: [0.13, 0.19] as [number, number],
    /** Flicker slices across the life. Stepped, never interpolated. */
    flickerSteps: 7,

    /* ── Rhythm ───────────────────────────────────────────────────────────
     * Strikes come in bursts. Evenly spaced firing reads as a loop within a
     * second or two; a cluster followed by an uneven pause reads as weather. */

    /** Strikes per burst. */
    burst: [2, 3] as [number, number],
    /** Gap between strikes inside a burst, seconds. */
    gap: [0.05, 0.11] as [number, number],
    /**
     * Pause between bursts, seconds.
     *
     * BETWEEN bursts only, and never before the first strike after the cursor
     * arrives. The old code gated every strike — including the first — on a
     * timer left over from the previous burst, so touching a line during a
     * 1.05s pause did nothing at all and the whole interaction read as broken
     * roughly half the time you tried it. Entry now fires on the same frame.
     */
    pause: [0.42, 1.05] as [number, number],

    /** The hot core: near-white, tight, high falloff exponent. */
    core: { color: '#eaf7ff', width: 1, falloff: 0.55, opacity: 1, gain: 2.6 },
    /** The halo: cold blue, wide, soft. */
    halo: { color: '#4fb4ff', width: 4.2, falloff: 2.1, opacity: 0.46, gain: 1.5 },
  },
} as const;

/**
 * HOLD TO BLAST — the site-wide press-and-hold detonation.
 *
 * The charge is deliberately shorter than a second. Longer and people let go
 * before anything happens; the interaction has to reward a casual press.
 */
export const BLAST = {
  /**
   * THE HOLD.
   *
   * Two full seconds of pointer-down before anything detonates. A click does
   * nothing; a short press does nothing; letting go at 1.9s does nothing.
   *
   * The reason this does not read as broken input — which is exactly what a
   * silent threshold did in an earlier version — is that the hold is not silent.
   * From the first frame the object and the copy start shaking, and the shake
   * escalates all the way to the release. The feedback is continuous even
   * though the payoff is gated, so the press always feels connected to
   * something. Never reintroduce a threshold without the escalation.
   *
   * Everything downstream is expressed as a FRACTION of this rather than in
   * seconds — the shake curve, the ring that closes in, the label — so this is
   * the only number to change to retime the whole interaction. It was three
   * seconds; two is enough to still feel deliberate and short enough that the
   * escalation does not outstay the payoff.
   */
  holdMs: 2000,
  /**
   * Shake during the hold. Amplitudes are peak values, reached at the very end
   * of the hold.
   *
   * `curve` is the exponent applied to hold progress. Above 1 the first half is
   * a barely perceptible tremor and the last moment is violent, which is the
   * shape that makes the wait feel like it is building rather than like it is
   * waiting. Linear feels flat and gives away the timer.
   */
  shake: { curve: 2.6, dom: 13, mark: 0.075, spin: 0.06, lab: 0.42 },
  /**
   * `chargeMs` is how long the shatter takes to reach full once the hold
   * completes; `recoverMs` is how long it takes to settle back once you let go.
   * The playhead is damped toward its target, so these are ~95% times rather
   * than hard durations — which is what lets a release blend instead of snap.
   */
  chargeMs: 250,
  recoverMs: 800,
  /**
   * Peak DOM displacement in px. Transform and opacity only — no filter.
   * A blur() here was costing a full-page raster on every frame of the blast.
   */
  domPush: 40,
  domRotate: 2.6,
  domFade: 0.32,
  /** How far the mark's parts fly, world units. */
  markPush: 3.4,
  /** Ambient drift while HELD, so a long hold is alive rather than frozen. */
  drift: { amplitude: 0.17, period: 3.4, spin: 0.09 },
  /** Lab field detonation, driven by the same 0..1 amount. */
  lab: { strength: 2.6, drift: 0.55 },
} as const;

/**
 * THE FOOTER FIELD — the quiet plate the site ends on.
 *
 * Sparse dashed rules in irregular column groups over a slow, almost
 * subliminal haze. Everything here is tuned toward *less*: the previous
 * version was a dense deformable rule grid and it read as a grey thread mass.
 * If a number below starts making the field more visible, it is going the
 * wrong way.
 */
export const FOOTER = {
  /** Column groups across the viewport. */
  columns: 9,
  /** Rows per column, min/max. Each column picks its own from this range. */
  rows: [13, 27] as [number, number],
  /** Dash frequency along a rule, min/max. */
  dashes: [7, 24] as [number, number],
  /** Inked fraction of a dash cell. Low = short dashes, wide gaps. */
  duty: [0.28, 0.6] as [number, number],
  /** Rule opacity. Furniture, not feature. */
  opacity: 0.16,
  /** The haze behind them. Low frequency, low contrast, slow. */
  haze: { scale: 1.35, speed: 0.011, strength: 0.028 },
  /**
   * The cloud layer behind the haze — large, slow, soft. This is what gives
   * the section depth; without it the rules sit on flat black and the footer
   * reads as thin. `strength` is the number to distrust: past ~0.09 it stops
   * being depth and starts being visible smoke.
   */
  cloud: { scale: 0.42, speed: 0.004, strength: 0.062 },
  /**
   * Ambient breathing. Two periods with an irrational ratio, so the cycle
   * never lands in the same place twice and the field cannot read as a loop.
   */
  breath: { periodA: 13.7, periodB: 8.3, amount: 1 },
  /**
   * Cursor reaction. Deliberately tiny — the brief for this section is quiet,
   * and the press-into-the-floor interaction that used to live here was
   * dropped rather than tuned down, because a surface that deforms that much
   * cannot be quiet.
   */
  cursor: { radius: 0.24, displace: 0.016 },
  /** How fast the influence point chases the cursor. Lower = heavier. */
  followRate: 6,
  /** The field only reacts below this height in the viewport (0 = bottom). */
  reachTop: 0.62,
  reachFade: 0.32,
} as const;

export const MARQUEE = {
  /** Base drift, px/second, independent of scroll. */
  baseSpeed: 44,
  /** Extra px per unit of scroll velocity. */
  velocityFactor: 5.2,
  /** Skew degrees per unit of scroll velocity, clamped. */
  skewFactor: 0.42,
  skewMax: 9,
  /**
   * How fast skew relaxes back to zero. The k in 1 - exp(-k·dt).
   *
   * Was `relax: 0.09`, applied as a bare per-frame alpha — the last
   * frame-rate-dependent damping on the site. 5.7 is that alpha converted at
   * the rate it was authored for: -ln(1 - 0.09) × 60. Identical at 60Hz,
   * correct everywhere else. On a 144Hz display the old form relaxed the skew
   * 2.4× too fast and the elastic drag that sells the band as mass simply was
   * not there.
   */
  relaxRate: 5.7,
  /**
   * Velocity coast-down, same conversion from the old `velocity *= 0.92`:
   * -ln(0.92) × 60.
   */
  velocityDecay: 5,
  words: ['THREE.JS', 'WEBGL', 'GSAP', 'REACT', 'MOTION'],
} as const;

/**
 * WORK — the arc.
 *
 * The projects are panels bent around the outside of a large cylinder whose
 * axis sits behind the camera's target. Scroll rotates the ribbon; each card
 * swings through frame, squares up to the camera at the apex, and turns away
 * again. Everything about the shape is derived, not authored: the angular step
 * comes from the card width and the radius, so adding a fifth project changes
 * nothing except how far the ribbon has to travel.
 *
 * WHY A REAL CYLINDER AND NOT CSS
 * A DOM card with a `rotateY` is still a flat quad composited by the browser:
 * it cannot be occluded by scene geometry, it cannot be depth-sorted against
 * the headline, and its "perspective" is a per-element property that does not
 * agree with the camera the rest of the site is using. These are planes in the
 * same room as the mark, lit by the same rig, so the near ones genuinely cover
 * the far ones and genuinely cover the headline.
 *
 * `radius` is the number to distrust. Too small and the ribbon reads as a
 * carousel of rotating tiles; the depth only appears when the arc is large
 * enough that the far cards recede rather than spin.
 */
export const WORK = {
  arc: {
    /** Cylinder radius, world units. Large — see the note above. */
    radius: 12.6,
    /** Card width, world units. Height follows the screenshot aspect. */
    cardWidth: 3.75,
    /** Centre-to-centre arc length, as a multiple of the card width. */
    step: 1.3,
    /**
     * Ribbon tilt in radians, [x, z]. The z component is what makes the arc
     * sweep diagonally instead of running level across the viewport, and it
     * rolls each card with it — which is why they lean rather than all sitting
     * upright on a horizon line.
     */
    tilt: [0.055, -0.2] as [number, number],
    /**
     * Lead-in and lead-out either side of the first and last card, in card
     * units. Without it the section opens with card one already parked at the
     * apex, and the first thing the scroll does is take it away.
     */
    overscan: 0.5,
    /**
     * THE ENTRY AND THE EXIT.
     *
     * The panels are planes at fixed coordinates in a scene that never
     * unmounts, so "not in the Work section" cannot mean "hidden" — anything
     * the camera happens to frame is on screen. Parking the ribbon at the first
     * card therefore left four panels sitting in the corner through the
     * Deconstruction and the marquee, and again behind the Achievement's
     * number, which read as an object that had forgotten to leave.
     *
     * These are the first and last segments of the SAME pinned timeline, not a
     * second animation: `span` is the fraction of the pinned scroll each sweep
     * takes, and the middle 1 - 2·span still steps card to card at exactly the
     * rate it always did.
     *
     * `lead` is extra rotation and `runOut` is a translation along the tangent
     * at the apex — the direction the ribbon is already travelling. It needs
     * both, and the reason is geometry rather than taste. Four cards at this
     * step and radius span 66° of a closed circle whose centre sits nearly on
     * the camera's view axis, and the widest angular window the work camera
     * does NOT see is about 45°. So there is no rotation that hides all four:
     * push one panel off the right edge and another has come around the back of
     * the cylinder and into frame on the left. Rotation gives the read — the
     * carousel turning into view — and the translation is what actually carries
     * it beyond the frustum.
     *
     * `lead` is small for the same reason: every extra card unit of it wraps
     * one more panel around the back, so a longer lead needs a LONGER run-out,
     * not a shorter one. 1.25 and 19 are verified clear at both parked ends
     * against every neighbouring camera pose, at aspect ratios from 1:1 to
     * 2.4:1, with the cursor parallax at full swing.
     */
    sweep: { lead: 1.25, runOut: 19, span: 0.13 },
    /**
     * How fast the rendered position chases the scrubbed one, as the k in
     * 1 - exp(-k·dt). Deliberately soft: this is the second stage of smoothing
     * after `SCROLL.scrub`, and it is what stops a flick of the wheel from
     * snapping the ribbon.
     */
    damping: 5.4,
    /** Apex card scale-up. Small — it is the light that says "focused". */
    focusScale: 1.06,
    /** Cross-card segments for the bend. 14 is 28 triangles; the bend is smooth. */
    segments: 14,
    /** Hover response. */
    hover: { scale: 1.04, lift: 0.17, rate: 8 },
    /** How fast a card fades up once its texture has arrived. */
    revealRate: 2.6,
  },
  /**
   * THE HEADLINE, IN THE SCENE.
   *
   * Rendered to a canvas texture and hung on a plane rather than set in the
   * DOM, for one reason: the near cards have to cover it. The DOM always
   * composites over the canvas, so a DOM headline can only ever sit in front
   * of the whole arc, and that flat stacking is exactly what kills the depth.
   * On a plane it is depth-tested like everything else, so the apex card
   * passes over the type and the far ones pass behind it.
   *
   * Type this large survives the round trip to a texture; nothing smaller
   * should follow it there — see the note on DOM annotations in Deconstruction.
   */
  headline: {
    lines: ['SELECTED', 'WORK'],
    /** Plane width in world units. */
    width: 5.9,
    /** Position in the work group, world units. */
    position: [-3.8, 0.55, -0.55] as [number, number, number],
    /** Texture width in px. Height follows the line count. */
    resolution: 2048,
    /**
     * Output value, 0..1. The material is untonemapped and the texture
     * round-trips through sRGB unchanged, so this number IS the grey that
     * lands on screen — not a linear intensity.
     *
     * 0.38 rather than full value for two reasons. The bloom threshold is 0.72
     * and a white plane this size goes straight through it and hazes the whole
     * section; and the headline is the room the cards move through, not the
     * subject. If it is competing with the focused card, it is too bright.
     */
    value: 0.38,
  },
  /** Viewport heights of pinned scroll per project. */
  scrollPerProject: 1.15,
} as const;

/**
 * THE ACHIEVEMENT — one number, counted.
 *
 * A counter that runs linearly and stops is a stopwatch. `power3.out` means it
 * covers most of the distance immediately and then crawls the last step or
 * two, which is what makes it read as a value ARRIVING at rest rather than as
 * a number being incremented — and at a rank of 8 the last step is most of the
 * effect, so the easing matters more here than the duration does.
 */
export const ACHIEVEMENT = {
  count: { duration: 1.7, ease: EASE.enter },
  /** Delay after the block reveals, so the number does not start mid-entrance. */
  countDelay: 0.24,
  reveal: { duration: 1.05, stagger: 0.07, ease: EASE.enter },
} as const;

/**
 * THE ARCHIVE — /credentials.
 *
 * Shape lives in lib/structures.ts with the other three builders; this is only
 * what moves. The brief for the motion is "a register that has been sitting
 * there", so every rate here is slow enough that you notice the object has
 * changed rather than watch it change.
 *
 * The fan breathes and the whole stack turns, on periods with no common
 * divisor, so the composite never lands in the same place twice — and the page
 * scroll adds a second, larger rotation on top, which is what ties the register
 * you are reading to the object behind it.
 */
export const ARCHIVE = {
  /** Idle rotation of the whole stack: [yaw rate, pitch rate] in rad/s. */
  spin: [0.075, 0.11] as [number, number],
  /** The fan opening and closing. Degrees of extra spread, and seconds. */
  breathe: { amplitude: 6.5, period: 17.5 },
  /** What a full scroll of the ledger below adds. Degrees. */
  scroll: { fan: 22, yaw: 40 },
  /** How fast the scroll-driven values chase. The k in 1 - exp(-k·dt). */
  scrollRate: 3.2,
  /**
   * Seam brightness. `rest` sits under the 0.72 bloom threshold and `hover`
   * deliberately crosses it, so hovering a row does not merely brighten its
   * plate — it makes that one plate bloom.
   */
  seam: { rest: 0.72, hover: 1.65, rate: 7 },
  /**
   * The single anodised element, as an index into the credentials list. The
   * newest credential, so the one warm seam is also the most recent record.
   */
  accent: 0,
  /** How far a hovered plate lifts off its resting angle, degrees. */
  hoverSplay: 5.5,
} as const;

export const LAB = {
  count: { desktop: 46000, mobile: 15000 },
  /** Cursor scatter. */
  scatter: { radius: 0.42, strength: 0.55, falloff: 2.4 },
  /** Magnetic return. */
  reform: { stiffness: 1.9, damping: 0.82 },
  /** Click shockwave. */
  shock: { speed: 1.5, width: 0.16, strength: 0.9, life: 1.9, maxConcurrent: 6 },
  /* Hold-to-detonate lives in BLAST.lab — it shares the mark's playhead. */
  pointSize: { desktop: 2.0, mobile: 1.6 },
  text: 'DEV PANCHAL',
} as const;

export const TRANSITION = {
  /** Section wipe — hand-written shader, not a fade. */
  duration: 1.05,
  ease: EASE.move,
  /** Noise distortion of the wipe edge. */
  edgeNoise: 0.19,
  edgeWidth: 0.16,
  /** RGB split at the wave front. */
  aberration: 0.02,
} as const;

/**
 * THE MENU — an opaque drawer, not an overlay.
 *
 * The previous version was a transparent full-bleed layer, which put the menu
 * links directly on top of the hero headline and made both unreadable. This is
 * a solid panel sliding in over the right third: hard edge, no transparency, no
 * backdrop blur.
 *
 * The panel is off-white with dark text — the only place on the site where
 * light is allowed. That inversion is the whole idea. It should read as a
 * drawer opening in a dark room, and it only works because the scene behind it
 * stays live, dark and completely unblurred. Desaturating or blurring the
 * remaining 70% flattens the contrast that makes the effect.
 */
export const MENU = {
  /** Panel width as a fraction of the viewport. */
  width: 0.3,
  open: { duration: 0.6, ease: EASE.enter },
  close: { duration: 0.42, ease: EASE.move },
  /** Nav items reveal after the panel lands. */
  item: { duration: 0.55, stagger: 0.05, delay: 0.26, ease: EASE.enter },
} as const;

/**
 * THE RAILS — every section's label row, and the bar they pass under.
 *
 * The top bar is fixed and painted with mix-blend-difference, so a label that
 * scrolls under it does not pass BEHIND it, it inverts against it: two lines of
 * the same monospace at the same size land on each other and neither is
 * readable. Every rail on the site therefore has to be gone before it arrives.
 *
 * The fade band is not a number here because it cannot be one — it is exactly
 * the clearance each rail already has, `--nav-clear`, read off the rail's own
 * computed `top`. Any fixed band either starts dimming a rail that is still
 * parked, or fails to finish before it reaches the bar, depending on the
 * viewport. See `useRailFade`.
 */
export const RAIL = {
  /** Below this the rail stops taking the pointer, so a ghost cannot be clicked. */
  hidden: 0.04,
} as const;

/**
 * THE CURSOR — a ring with a dot inside it.
 *
 * WHY THE OLD ONE LAGGED, IN CLOSED FORM
 * For `x += (target - x) * a`, the steady-state error under constant velocity is
 * `e = v / a`, where v is pointer travel per frame. That is not a subtlety, it
 * is the defining property of exponential damping: the offset is PROPORTIONAL
 * TO SPEED. Slow movement hides it completely and a fast flick makes it
 * enormous.
 *
 *   ring, damping 0.17  ->  a = 1 - e^-0.17 = 0.156  ->  e = 6.4 * v
 *   dot,  damping 0.42  ->  a = 1 - e^-0.42 = 0.343  ->  e = 2.9 * v
 *
 * At 2000 px/s — an ordinary flick across a 1080p screen — v is 33 px/frame, so
 * the ring sat 213px behind the pointer and the dot 97px behind. That is the
 * reported symptom exactly, and no amount of retuning a single constant fixes
 * it: any fixed `a` large enough to keep a flick tight is large enough to throw
 * away the weight that makes the cursor feel like an object.
 *
 * THE FIX, AND WHY THIS ONE OVER THE ALTERNATIVES — see Cursor.tsx.
 */
export const CURSOR = {
  size: 13,
  hoverScale: 2.9,
  /** Ring damping at rest. Unchanged: this is the character, and it was never the bug. */
  damping: 0.17,
  /**
   * Hard ceiling on how far the ring may trail the pointer, CSS px, at any
   * speed. The damping rate is raised to whatever satisfies it — since
   * `e = v / a`, holding `e <= maxTrail` means `a >= v / maxTrail`.
   *
   * Two ring diameters. Far enough that the trail still reads as weight during
   * ordinary movement, close enough that the ring never separates from the dot
   * badly enough to look like two unrelated objects.
   */
  maxTrail: 26,
  /** Smoothing on the speed estimate. The k in 1 - exp(-k·dt). */
  speedSmoothing: 22,
} as const;

/**
 * THE INSPECTION LENS — the cursor uncovers the mark's internal structure.
 *
 * A soft circular region follows the pointer. Inside it the mark stops being a
 * finished machined object and becomes the drawing it was made from:
 * construction lines on the design grid, the bolt-hole axes, and the hidden
 * edges the solid is covering up.
 *
 * WHY THIS IS A SHADER BRANCH AND NOT A MASK
 * The obvious build is a DOM mask over a second copy of the object, and it is
 * wrong twice over. A mask can only reveal a second *element*, so the two views
 * have to be two draws of the same geometry, which doubles the object's cost and
 * guarantees they will drift out of alignment the moment anything animates. And
 * a mask is a compositing operation, so its edge is a hard alpha cut at exactly
 * one screen resolution. Branching inside the one material that is already
 * drawing the object means both views share every transform for free, and the
 * boundary can be an optical falloff rather than a cut.
 *
 * This was settled by the research pass: hubtown.co.in ships this effect and a
 * sweep of every element's computed style for `mask-image` and circular
 * `clip-path` on that page returns nothing. See docs/research-2026.md.
 *
 * `radius` is in fractions of viewport HEIGHT, not width, so the lens is the
 * same physical size on any aspect ratio. Anything expressed against width
 * grows into a searchlight on a 21:9 monitor.
 */
export const LENS = {
  /** Lens radius as a fraction of viewport height. */
  radius: 0.155,
  /**
   * Width of the soft boundary, as a fraction of the radius. This number is
   * doing most of the work: at 0 it is a mask, and the effect dies. The band
   * has to be wide enough that there is no frame in which a hard circle is
   * visible anywhere on the object.
   */
  edge: 0.42,
  /**
   * Radial warp at the rim, in fractions of the radius. The construction
   * pattern is pushed outward as it approaches the boundary, which is what a
   * real lens does to what is behind it. Small — past ~0.1 it stops reading as
   * glass and starts reading as a heat haze.
   */
  refract: 0.055,
  /** How fast the lens chases the pointer. The k in 1 - exp(-k·dt). */
  followRate: 11,
  /** How fast the lens opens and closes when it arms or disarms. */
  fadeRate: 6.5,
  /**
   * Construction-line spacing in DESIGN-GRID units, not world units — the same
   * 100×120 grid `lib/mark/paths.ts` authors in. That is the point: the lines
   * the lens reveals are the grid the mark was actually drawn on, so they land
   * on the real feature edges instead of being decorative hatching.
   */
  gridStep: 10,
  /** Hairline width in grid units. */
  lineWidth: 0.22,
  /** Bolt-hole axis ring radius, grid units. */
  boltRing: 4.2,
  /**
   * Brightness of each layer inside the lens. The solid is not removed — it is
   * dimmed and drawn over, so the object keeps its mass and the lens reads as
   * seeing INTO it rather than through a hole in it.
   */
  values: { solid: 0.34, grid: 0.30, bolt: 0.62, edge: 0.85, rim: 0.5 },
  /**
   * The shots where the lens is live.
   *
   * It is armed where the mark is the SUBJECT and nowhere else. On About the
   * object is deliberately pushed back to 58% presence as atmosphere behind the
   * copy, and a cursor that lights up background furniture teaches the visitor
   * that the effect is decoration. On Contact the camera has craned off the mark
   * entirely. Restricting it to hero and the Deconstruction is what keeps it
   * reading as an instrument you pick up rather than a filter that is always on.
   */
  shots: ['hero', 'resolve', 'exploded', 'dissolved', 'release'] as const,
} as const;

/**
 * THE GPGPU PARTICLE FIELD.
 *
 * Position and velocity live in float textures and are stepped by two
 * fragment shaders; the CPU never touches a particle. The count comes from a
 * FIXED LADDER chosen at init — 499,849 / 350,464 / 250,000, or the old 46k
 * CPU path if float render targets are unavailable. Fixed rather than
 * continuous because the count is reported in the telemetry HUD, and a number
 * that drifts is not telemetry.
 *
 * All of the physics is in `shaders/sim/simCore.glsl`, deliberately as pure
 * functions with no texture access, so the WebGPU port replaces the executor
 * rather than rewriting the simulation. See docs/WEBGPU-MIGRATION.md.
 */
/**
 * THE VISITOR TRACE.
 *
 * Every number that decides how the shared structure looks and how much of it
 * is kept. The caps are not tuning knobs — they are the contract with the
 * database, and `lib/trace.ts` enforces the same ones before it ever posts.
 */
export const TRACE = {
  /** Hard cap per stroke. The table has a CHECK constraint at this number. */
  maxPoints: 120,
  /** How many strokes are fetched and drawn. Older ones are not kept. */
  renderLimit: 200,
  /** Minimum points before a gesture counts as a stroke rather than a click. */
  minPoints: 6,
  /** World size of the region a normalised stroke is mapped into. */
  extent: 2.6,
  /** How far strokes are spread through depth, so it is a volume not a wall. */
  depth: 2.2,
  /** Slow rotation of the whole structure, radians/sec. */
  spin: 0.045,
  /** Cursor parallax — how far the structure leans toward the pointer. */
  parallax: 0.16,
  /**
   * The oldest stroke's opacity relative to the newest. NEVER zero: the point
   * of the section is that nobody who drew is removed, only layered, and a
   * stroke that fades to nothing has been deleted with extra steps.
   */
  oldestOpacity: 0.16,
  /** The stroke being drawn right now, before it is committed. */
  pendingOpacity: 0.95,
  fadeRate: 2.2,
} as const;

export const LAB_GPU = {
  /**
   * The flow field: an ABC (Arnold-Beltrami-Childress) flow, three rotated
   * octaves. Divergence-free in CLOSED FORM rather than by finite-differencing
   * noise — see simCore.glsl. The curl-of-noise version cost roughly 192
   * sin-based hashes per particle per frame and froze the browser.
   */
  flow: {
    noiseScale: 0.19,
    noiseSpeed: 0.06,
    strength: 2.7,
  },
  /**
   * The letterforms, as a spring rather than a lerp. A lerp arrives and stops,
   * which freezes the field into a dead sign; a spring against the flow never
   * settles, so the type holds while every particle in it keeps moving.
   */
  attractor: { stiffness: 7.5 },
  /** Global drag. The k in exp(-k·dt), so the feel is refresh-rate invariant. */
  damping: 1.35,
  /** Speed clamp, world units/sec. Stops a shock event flinging strays to infinity. */
  maxSpeed: 9,
  /** Soft cage radius. Particles outside are eased back, never wrapped. */
  bounds: 13,

  /** The cursor, as a repulsion well with a dissipating wake. */
  cursor: {
    radius: 2.4,
    strength: 26,
    /** How fast the wake charge fades. The k in exp(-k·dt). */
    wakeDecay: 1.9,
  },

  /**
   * THE DETONATION. A travelling shell, not an impulse — only particles within
   * `width` of the expanding front are pushed, so the blast arrives at the far
   * side of the field measurably later than the near side.
   */
  shock: {
    speed: 11,
    width: 1.6,
    strength: 46,
    /** Seconds before the front is spent. */
    life: 1.9,
  },

  /** Render. */
  pointSize: 1.25,
  /**
   * Speed -> ember ramp. DERIVED FROM A MEASUREMENT, not chosen by eye — the
   * formed field's speed distribution is p05 0.96 / p50 2.28 / p95 3.61, so
   * this puts the median at heat 0.50 and saturates only the fastest tail.
   * The previous 0.42 saturated below the median and made the whole field one
   * flat orange. Re-derive with `__qa.particles().speed` if the flow strength,
   * stiffness or damping change.
   */
  speedScale: 0.22,
  /**
   * The particle count the render brightness is authored against — the CPU
   * field's 46k. `uDensityGain` is this over the live count, which holds total
   * emitted luminance constant across the whole tier ladder. Changing this
   * re-exposes the section on every rung at once, which is the point: there is
   * one exposure control, not one per rung.
   */
  referenceCount: 46000,
  /**
   * Final exposure trim on top of the density normalisation, set by eye against
   * the CPU field at the same scroll position. 1.0 means "as bright as 46k
   * was"; the field is finer-grained at 350k, so it carries slightly more.
   */
  exposure: 1.35,
  /** Fade in/out with the section. The k in 1 - exp(-k·dt). */
  fadeRate: 2.6,
} as const;

/**
 * VOLUMETRIC LIGHT — raymarched scattering from the key light.
 *
 * Atmosphere, not lens flare. The distinction is not stylistic: a flare is
 * drawn AT the light and a volumetric is integrated ALONG the view ray, so the
 * shafts here are occluded by the mark's own geometry and fan around its
 * silhouette. If it ever reads as a sprite pinned to a bright spot, it is
 * broken rather than merely ugly.
 *
 * HOW THE OCCLUSION IS REAL. A small orthographic depth map is rendered from
 * the key light's position each frame, containing the mark and nothing else
 * (it is restricted to `MARK_LAYER`). Every raymarch sample projects into that
 * map and is either lit or shadowed. That is the same test a shadow map does,
 * evaluated at points in mid-air instead of on a surface, which is exactly
 * what a god-ray is.
 */
export const VOLUMETRIC = {
  /**
   * Raymarch steps, desktop. Dropped to `stepsLow` when the hero's measured
   * p50 exceeds `budgetMs`, and the volume is not mounted at all on mobile.
   * The shader's loop bound is a compile-time constant of 64 — a `uniform`
   * loop count is legal in ESSL3 but generates a dynamic loop that ANGLE
   * unrolls badly, so the count is a uniform BREAK inside a fixed loop.
   */
  steps: 48,
  stepsLow: 24,
  /**
   * The floor rung.
   *
   * 24 was the bottom of the ladder, and on a machine that misses the budget
   * AT 24 there was nowhere left to go — it simply ran over frame after frame.
   * Measured on the deployed site: p50 frame 31ms against an 11ms budget, so
   * the low rung was still three times too expensive and the ladder had no
   * answer for it.
   *
   * 14 is safe to drop to because the march is jittered per fragment by an
   * animated hash, so fewer steps become noise rather than concentric shells,
   * and the grain pass absorbs that noise. Banding is what usually stops you
   * lowering a raymarch; here it was already solved.
   */
  stepsFloor: 14,
  budgetMs: 11,
  /**
   * Half-extent of the scattering volume, world units.
   *
   * THIS NUMBER IS A PERFORMANCE PARAMETER, NOT AN ART ONE, AND IT WAS
   * ORIGINALLY 7.5 — WHICH HUNG THE BROWSER.
   *
   * The hero camera sits 4.9 units out, so a 7.5 half-extent put the camera
   * INSIDE the box and its back faces covered the entire viewport. That is
   * 1905x901 fragments x 48 steps x a texture fetch each — around 82 million
   * dependent samples per frame — and an Intel Iris Xe simply stops. The tab
   * became unresponsive to the point that screenshot injection timed out.
   *
   * 3.2 keeps the volume a region AROUND the mark rather than a global haze:
   * the camera is outside it, its screen coverage is roughly a third of the
   * frame, and the cost falls with it. It is also the better art direction —
   * shafts belong to the object, and a full-screen scattering layer is what
   * makes a volumetric read as a filter rather than as light in a room.
   */
  extent: 3.2,
  /** Longest distance any single ray integrates, world units. */
  maxDistance: 14,
  /**
   * Scattering strength. Chosen by looking, not by arithmetic: 0.19 was
   * visible but lifted the upper-left of the frame off black, and this page's
   * entire design rests on #08080A staying #08080A. Above ~0.3 it stops being
   * air and becomes smoke.
   */
  density: 0.14,
  /**
   * Henyey-Greenstein anisotropy. Positive is forward scattering, which is
   * what makes shafts brighten as the view aligns with the light rather than
   * glowing uniformly — the single parameter that separates atmosphere from
   * a screen-space glow.
   */
  anisotropy: 0.72,
  /** Inverse-square softening, so the falloff is not a hard 1/d². */
  attenuation: 0.045,
  /**
   * Light-space depth map resolution.
   *
   * 256, because the shafts only need a silhouette. This was 512 for one
   * reason: the caustic floor took a LAPLACIAN of this map, and a second
   * derivative is far more sensitive to resolution than a threshold is. THE
   * CAUSTICS WERE CUT, so that requirement went with them and the extra
   * resolution was left behind paying for nothing — four times the fill on a
   * pass that runs every frame, to sharpen an edge no remaining effect reads.
   *
   * If a caustic is ever attempted again it needs 512 back. Nothing else does.
   */
  shadowSize: 256,
  /** Orthographic half-extent of the light camera, world units. */
  lightExtent: 2.8,
  lightNear: 0.5,
  lightFar: 16,
  /**
   * THE RIM, NOT THE KEY — and this was a real error, caught on screen.
   *
   * The first version used the KEY Lightformer's position, `[-4.5, 4.2, 5]`,
   * on the reasoning that the key is the light that defines the form. It
   * produced no visible shafts at all, and the phase function says exactly why:
   * the key sits at z = +5, the SAME side as the camera. So `dot(viewRay,
   * toLight)` is about -1, and Henyey-Greenstein at g = +0.72 returns 0.0075
   * there against 1.75 at its peak — a factor of 230. The volume was being
   * integrated correctly and scattering almost nothing toward the eye.
   *
   * God-rays are a BACKLIT phenomenon. You see shafts when the source is
   * behind the subject and the light scatters forward, around the silhouette,
   * into your eye. So the volumetric light is the RIM Lightformer at
   * `[-6, 1.4, -5.5]` — the one Stage.tsx already calls "the single most
   * important light: it draws the silhouette". It is now drawing the silhouette
   * in the air as well as on the object, which is the same job.
   *
   * The colour follows it: cold, off the rim's #4d86c4, so the shafts belong to
   * that light rather than introducing a third one.
   *
   * The final position is the rim pulled ONTO the object's axis: above, behind
   * and a little left of the mark rather than out at x = -6. At the rim's own
   * position the mark subtends almost none of the light's cone from the hero
   * camera, so the volume integrated a smooth gradient with no structure in it
   * — atmosphere, but no shafts. Verified by moving it directly behind the
   * mark, where the spine's shadow column and light through the D's counter
   * both appear exactly as a real occluder would produce them. That test is
   * what proves the depth pass is connected; this position is the restrained
   * version of it, chosen on screen with `__qa.shaftLight()`.
   */
  lightPosition: [-1.1, 3.1, -4.5] as [number, number, number],
  /** Depth-compare bias. Too small and the mark self-shadows into stripes. */
  bias: 0.0025,
  color: '#8fb6dd',
  /** How fast the whole layer fades in and out. The k in 1 - exp(-k·dt). */
  fadeRate: 2.2,
  /**
   * Shots where shafts are live. The mark has to be the subject.
   *
   * `rig` is on this list for a stronger reason than the others: in that
   * section the shafts ARE the subject, and the visitor is moving the light
   * that casts them. Take it off this list and the section has nothing to do.
   */
  shots: ['hero', 'resolve', 'exploded', 'dissolved', 'release', 'rig'] as const,
} as const;

/**
 * THE GLASS STATE — the mark's fifth state.
 *
 * assembled / exploded / wireframe / dissolved / GLASS. Real transmission,
 * thickness, dispersion and caustics, not a tinted transparent material: the
 * point is that you can see the two bowls sitting at different depths THROUGH
 * the object, which is the one thing the opaque graphite version can never
 * show and the whole reason the mark is built the way it is.
 *
 * The ember inlay keeps its own attenuation, so it refracts and splits through
 * the surrounding glass instead of being a flat orange bar behind it.
 */
/**
 * THE RIG — the section where the visitor moves the light.
 *
 * The light is driven in SPHERICAL coordinates around the mark, not in x/y/z,
 * and that is the decision the whole section rests on. A drag mapped to world
 * axes lets the visitor put the light inside the object, in front of it, or a
 * hundred units away — and every one of those states looks broken rather than
 * exploratory. On a sphere at fixed radius there is no wrong answer: every
 * position the gesture can reach is a lit frame someone might have art-directed.
 *
 * ── WHY THE AZIMUTH IS CLAMPED BEHIND THE OBJECT ──────────────────────────
 *
 * God-rays are a BACKLIT phenomenon. Henyey-Greenstein at g = 0.72 returns
 * about 0.0075 when the light is on the camera's side against 1.75 at its
 * peak — a factor of 230. Let the drag bring the light round to the front and
 * the shafts do not dim, they vanish, and the visitor concludes the feature is
 * broken when it is in fact obeying physics. So the range keeps cos(azimuth)
 * negative: the light travels the whole way across the BACK of the mark, left
 * to right, which is exactly the traverse where the shafts and the shadow
 * through the D's counter sweep most visibly.
 *
 * The rest position is the one already chosen on screen for the hero — see
 * VOLUMETRIC.lightPosition — expressed in this coordinate system rather than
 * re-picked, so the section starts from the framing the rest of the site uses.
 */
export const RIG = {
  /** Orbit radius, world units. Matches |VOLUMETRIC.lightPosition| (~5.57). */
  radius: 5.57,
  /**
   * Azimuth limits, degrees, measured from +Z toward +X. Both ends keep the
   * light behind the mark — see the note above, this is not a taste boundary.
   */
  azimuthRange: [-214, -126] as [number, number],
  /**
   * Elevation limits, degrees. The floor stays above the horizon because a
   * light level with the mark rakes along the extrusion and stops reading as
   * a source in a room; the ceiling stops short of overhead, where the shafts
   * foreshorten into a halo and the shadow collapses under the object.
   */
  elevationRange: [12, 58] as [number, number],
  /** Rest pose — VOLUMETRIC.lightPosition in spherical, not a second opinion. */
  restAzimuth: -166,
  restElevation: 34,
  /** How fast the light chases the drag. The k in 1 - exp(-k·dt). */
  followRate: 7.5,
  /** Degrees of light travel per full viewport width / height of drag. */
  dragAzimuth: 150,
  dragElevation: 80,
  /**
   * Idle drift, so the section is alive before anyone touches it — the single
   * most important property this section has, and the reason it replaced one
   * that started empty and waited to be given something.
   */
  driftAzimuthDeg: 9,
  driftElevationDeg: 4,
  driftRate: 0.11,
  /** How long after release before the idle drift resumes, seconds. */
  driftResumeDelay: 2.4,
} as const;

export const GLASS = {
  ior: 1.52,
  thickness: 1.35,
  /**
   * Dispersion — the wavelength split. `MeshPhysicalMaterial.dispersion`
   * landed in three r166 and this project is on r171, so it is available; it
   * is still read defensively at construction because a silent downgrade of
   * the whole material is worse than a missing sparkle.
   */
  dispersion: 0.42,
  roughness: 0.06,
  /** Glass is a dielectric. Metalness above 0 here just makes it look dirty. */
  envMapIntensity: 1.7,
  /** Beer-Lambert tint through the body. */
  attenuationDistance: 4.0,
  attenuationColor: '#9fb4d0',
  emberAttenuationDistance: 1.1,
  emberAttenuationColor: '#ff8a4f',
  /**
   * THE HERO HOVER. Slow in, slower out — a snap here would read as a
   * rollover state on a button rather than as a material change in an object.
   * The k in 1 - exp(-k·dt), so it is frame-rate independent like everything
   * else.
   */
  hover: { inRate: 1.7, outRate: 1.15 },
  /**
   * THE DECONSTRUCTION WINDOW.
   *
   * Sits between the resolve hold and the annotations — the object turns to
   * glass, explodes while still glass, then returns to metal before the
   * leader lines arrive. Nothing else is competing for the material there, so
   * this is additive and none of the existing keys move.
   */
  keys: {
    in: { at: 0.19, dur: 0.075 },
    out: { at: 0.32, dur: 0.09 },
  },
  /**
   * CAUSTICS WERE CUT. Kept as a note rather than a config block.
   *
   * Two implementations were built and both read as an artefact rather than
   * as light — see docs/PERFORMANCE.md for the full account. The short version
   * is that this mark is a FLAT EXTRUSION, so its light-space depth is
   * piecewise constant and the Laplacian that drives a screen-space caustic is
   * a delta function at the silhouette and zero everywhere else. That is a
   * hard band along the shadow edge, not a focused pool, and no amount of
   * blurring turns one into the other.
   *
   * A real one needs the refracted ray directions, not the depth — i.e. a
   * second pass that traces through both surfaces of the glass and splats
   * where the rays land. That is a genuine piece of work and it is not this.
   */
} as const;

/**
 * TELEMETRY HUD — the permanent bottom-corner readout.
 *
 * Furniture, not a feature. Every value is read off the renderer; nothing here
 * is ever estimated, which is the entire reason it is allowed to exist on a
 * page that claims to be about how things are built.
 */
export const HUD = {
  /** Readout refresh, seconds. Faster than this and the digits are unreadable. */
  interval: 0.25,
  /** Frame-time smoothing. The k in 1 - exp(-k·dt). */
  smoothing: 3.5,
} as const;

/** Post-processing. Restrained: this is a studio photo, not a music video. */
export const POST = {
  bloom: { intensity: 0.42, threshold: 0.72, smoothing: 0.3, mipmapBlur: true },
  chromaticAberration: 0.00055,
  /**
   * Grain. This is doing engineering work, not styling: 8-bit colour has 256
   * steps per channel, a gradient across a near-black page crosses very few of
   * them, and it bands visibly. Grain dithers that away.
   *
   * 0.032 is enough to kill the banding and low enough not to speckle the one
   * bright element on the site (the project screenshot).
   */
  noise: 0.032,
  vignette: { offset: 0.28, darkness: 0.72 },
  dof: { focusDistance: 0.012, focalLength: 0.04, bokehScale: 3.1 },
} as const;

/** Mobile overrides. Applied when viewport width < `breakpoint`. */
export const MOBILE = {
  breakpoint: 820,
  bloomOnly: true,
  particleScale: 0.32,
  /** Same reasoning as DPR: the floor is the part that has to be reachable. */
  dpr: [0.75, 1.75] as [number, number],
} as const;

/**
 * DEVICE PIXEL RATIO — the floor matters more than the ceiling.
 *
 * `[min, max]`, driven by PerformanceMonitor + AdaptiveDpr in SceneRoot. The
 * ceiling is what a fast machine gets; the FLOOR is what a slow one is allowed
 * to fall back to, and it was 1.
 *
 * That floor was the whole problem. Measured on the deployed site: p50 frame
 * 29ms on a 60Hz display, which is two vsync intervals — every frame missed
 * 16.7ms and landed on 33.3ms, locking the site at 30fps. The adaptive system
 * was working exactly as designed and had nowhere left to go, because it was
 * already sitting on its own floor. Same shape of bug as the volumetric step
 * ladder having no bottom rung: a mechanism that can only choose between two
 * options it cannot afford.
 *
 * The site is fill-bound, which was measured rather than assumed — shrinking
 * the canvas 7x took the best achievable frame from 33.4ms to 3.5ms. So pixels
 * are the currency, and 0.7 spends 49% of them.
 *
 * WHY THIS IS THE RIGHT LEVER HERE AND NOT A COP-OUT: every word on this site
 * is real DOM, not canvas. Dropping below 1 softens the mark, the shafts and
 * the particle field — all of which sit under a grain pass on a near-black
 * frame, where it is close to invisible — and touches the typography not at
 * all. A machine that can hold 60fps at dpr 2 still gets dpr 2; only the
 * machines that were dropping frames pay, and they were already paying more.
 */
export const DPR: [number, number] = [0.7, 2];
