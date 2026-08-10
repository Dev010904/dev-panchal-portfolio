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
  /** How long the counter takes to catch up to real progress. */
  counterLerp: 0.075,
  /** Glyph-scramble resolve of "DEV PANCHAL". */
  scramble: { perLetter: 0.055, cycles: 9, tickRate: 0.045 },
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
    /** Screen-space proximity that arms a line, in CSS px. */
    radius: 80,
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
    /** Pause between bursts, seconds. */
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
  /** How fast skew relaxes back to zero. */
  relax: 0.09,
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

export const CURSOR = {
  size: 13,
  hoverScale: 2.9,
  damping: 0.17,
  /** The dot at the centre tracks faster than the ring — that lag is the tell. */
  dotDamping: 0.42,
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
  dpr: [1, 1.75] as [number, number],
} as const;

export const DPR: [number, number] = [1, 2];
