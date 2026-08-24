/**
 * THE SHARED POINTER.
 *
 * One listener, in SceneRoot, writes this. Everything that needs the cursor
 * reads it. Before this existed the Cursor component ran its own `pointermove`
 * listener alongside SceneRoot's, which is two handlers dispatched for every
 * move and — worse — two independent notions of where the pointer is, updated
 * at two points in the frame.
 *
 * Raw CSS pixels, top-left origin: the coordinate space pointer events arrive
 * in and the one the DOM cursor is positioned in. The normalised pair the
 * shaders want lives in the zustand store; converting here and back there would
 * lose precision for nothing.
 *
 * A plain mutable object rather than store state, deliberately. This is written
 * on every pointer move and read every frame; routing it through zustand would
 * re-render React subscribers at the pointer's event rate.
 */
export const pointerHandle = {
  /** Latest pointer position, CSS px. */
  x: 0,
  y: 0,
  /** Smoothed speed, CSS px per frame. Drives velocity-adaptive damping. */
  speed: 0,
  /** False until the first real move, and while the pointer is off-window. */
  present: false,

  /**
   * Called synchronously by the one `pointermove` listener, immediately after
   * `x`/`y` are updated.
   *
   * ── WHY A CALLBACK AND NOT JUST A PER-FRAME READ ──────────────────────────
   *
   * The cursor dot's whole promise is that it sits exactly where the pointer
   * is. It did — but it was only ever REDRAWN from inside a `gsap.ticker` step,
   * which runs once per rendered frame. So the dot carried zero spatial error
   * and up to a full frame of TEMPORAL error, and on a machine rendering this
   * scene at 27fps that is 37ms of latency between moving the mouse and the
   * dot moving.
   *
   * 37ms is far above the threshold where a pointer stops feeling attached to
   * the hand. It is also invisible in every screenshot and in every position
   * assertion, because the dot is always in the right PLACE — just late. That
   * is why it survived: the instrument being used to check it could not
   * measure the thing that was wrong.
   *
   * Pointer events arrive at the device's own rate, independent of how long
   * the GPU is taking. Writing the dot's transform here means it tracks at
   * that rate even while the canvas is struggling, which is precisely when a
   * laggy cursor is most noticeable.
   *
   * Only the DOT hangs off this. The ring keeps its damped, ticker-driven
   * motion — a trailing ring is the character, and character is allowed to be
   * a frame late.
   */
  onMove: null as (() => void) | null,
};
