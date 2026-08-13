import type { MarkHandles } from './MarkObject';

/**
 * Shared mutable handles between the GSAP/DOM layer and the render loop.
 *
 * These are plain refs on a module singleton rather than React state or
 * context on purpose. GSAP writes to them up to 60 times a second while
 * scrubbing; routing that through React would re-render the entire scene tree
 * every frame. Nothing here is ever read during render — only inside useFrame.
 */
export const markHandles: { current: MarkHandles } = {
  current: {
    progress: { value: 0 },
    spin: { value: 0 },
    drift: { value: 0 },
    group: null,
    anchors: [],
  },
};

/**
 * HOLD TO BLAST.
 *
 * A held state machine, not a fire-and-forget impulse:
 *
 *   pointerdown → CHARGING    ramps to full shatter in BLAST.chargeMs
 *   held        → HELD        stays shattered indefinitely, drifting
 *   pointerup   → RECOVERING  eases home over BLAST.recoverMs
 *
 * `amount` is the single authority — 0 is at rest, 1 is fully blasted — and it
 * is written by scrubbing one pre-built, paused GSAP timeline rather than by
 * play/reverse. That matters for one specific case: releasing at 40% of the
 * charge. A reversed tween restarts from its own idea of where it was and
 * snaps; a scrubbed playhead simply changes direction from wherever it is.
 *
 * These live here rather than in the store because they are written every frame
 * and read every frame by the render loop; pushing them through React would
 * re-render the whole scene tree sixty times a second for three numbers.
 */
export const blastHandle = {
  /** 0..1 shatter. The timeline writes this; everything else reads it. */
  amount: 0,
  /**
   * 0..1 progress through the hold, before anything detonates.
   * Resets to 0 on an early release.
   */
  hold: 0,
  /**
   * 0..1 shake magnitude, already curved. Read by the mark, the Lab field and
   * the DOM, each of which rolls its own randomness from it — a shared random
   * offset would make everything jitter in lockstep and read as one rigid
   * object sliding around rather than as a structure straining.
   */
  shake: 0,
  /** 0..1 brace — peaks early in the charge, then releases. */
  squeeze: 0,
  /** 0..1 tumble, eased separately so the spin lags the translation. */
  spin: 0,
  /** True between pointerdown and pointerup. */
  held: false,
  /** Seconds spent held. Drives the ambient drift so HELD is alive, not frozen. */
  heldFor: 0,
  /** Screen-space origin of the blast, 0..1 UV. */
  origin: [0.5, 0.5] as [number, number],
  /** Bumped on each press so listeners can react once per blast. */
  epoch: 0,
};

/**
 * THE WORK ARC.
 *
 * `progress` is 0..1 through the pinned Work section, written by one scrubbed
 * ScrollTrigger. The scene turns it into an angular position on the ribbon and
 * damps toward it, so the cards keep moving for a beat after the wheel stops
 * instead of freezing on the last scroll event.
 *
 * Same reasoning as markHandles: this is written and read every frame, and
 * routing it through the store would re-render the whole scene tree per frame.
 * The one thing the DOM does need — which card is at the apex — is pushed into
 * the store only when the rounded index actually changes.
 */
export const workHandle = {
  /** 0..1 scroll through the pinned section. */
  progress: 0,
  /** Damped position along the ribbon, in card units. */
  position: 0,
  /** Index of the card nearest the apex. */
  focus: 0,
  /** Index the pointer is over, or -1. */
  hover: -1,
};

/**
 * THE ARCHIVE — /credentials.
 *
 * Two values the DOM owns and the scene reads. `scroll` is 0..1 through the
 * register, which turns the stack; `hover` is the index of the row under the
 * pointer, or -1, which brightens that plate's seam.
 *
 * Same reasoning as the two handles above: `scroll` changes on every scroll
 * frame and `hover` is read every frame by the render loop, so neither belongs
 * in the store. The DOM rows already have their own hover listeners for the
 * cursor, so this costs one extra assignment on an event that was firing anyway.
 */
export const archiveHandle = { scroll: 0, hover: -1 };

/**
 * THE GLASS STATE.
 *
 * `amount` is the single authority — 0 is machined graphite, 1 is optical
 * glass — and it is the MAXIMUM of two independent sources: the Deconstruction
 * scrub window, and the hero hover. Maximum rather than sum, because they can
 * overlap when someone hovers the mark at the top of the pinned section and
 * adding them would drive the crossfade past 1 and clip the solid out early.
 *
 * `hover` is kept separately so the hero's asymmetric ease (slow in, slower
 * out) can be applied to it without the scrub inheriting a lag it should not
 * have — a scrubbed value must track the scroll exactly.
 *
 * Lives here rather than in the store for the usual reason: written and read
 * every frame, and routing it through React would re-render the scene tree.
 */
export const glassHandle = {
  /** 0..1 resolved glassiness. Read by the mark. */
  amount: 0,
  /** 0..1 hero hover, eased. */
  hover: 0,
  /** True while the pointer is genuinely over the mark's geometry. */
  over: false,
};

/**
 * VOLUMETRIC QUALITY, at runtime.
 *
 * The raymarch is the single most expensive thing on the site and its cost is
 * `screen coverage x steps`, neither of which can be reasoned about reliably
 * from source — the first attempt at sizing the volume hung the browser hard
 * enough that screenshot injection timed out. So the step count is a handle
 * the QA harness can turn while the page runs, and the ladder is chosen from a
 * MEASUREMENT rather than from a guess.
 *
 * `steps: 0` disables the layer outright, which is also the mobile path.
 */
export const volumetricHandle = {
  steps: 0,
  /** Set once from the measured hero p50. See Volumetrics.tsx. */
  calibrated: false,
};

/** Section wipe progress, 0..1. Driven by GSAP on navigation. */
export const wipeHandle = { value: 0, active: false };

/**
 * Screen-space positions of each part, projected from inside the render loop
 * so the DOM annotations can anchor to 3D geometry without the DOM ever
 * touching the camera. Written every frame by AnnotationProjector, read every
 * frame by the Deconstruction's leader lines.
 */
export const annotationScreen: { x: number; y: number; z: number; visible: boolean }[] = [];

/** Reset every handle. Called when the scene tears down between routes. */
export function resetHandles() {
  markHandles.current.progress.value = 0;
  markHandles.current.spin.value = 0;
  markHandles.current.drift.value = 0;
  workHandle.progress = 0;
  workHandle.position = 0;
  workHandle.focus = 0;
  workHandle.hover = -1;
  archiveHandle.scroll = 0;
  archiveHandle.hover = -1;
  wipeHandle.value = 0;
  wipeHandle.active = false;
  blastHandle.amount = 0;
  blastHandle.hold = 0;
  blastHandle.shake = 0;
  blastHandle.squeeze = 0;
  blastHandle.spin = 0;
  blastHandle.held = false;
  blastHandle.heldFor = 0;
  glassHandle.amount = 0;
  glassHandle.hover = 0;
  glassHandle.over = false;
}
