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
};
