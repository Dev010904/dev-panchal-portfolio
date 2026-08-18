'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { TRACE } from '@/config/animation';
import { fetchCount, hasSubmitted, submitStroke, traceConfigured } from '@/lib/trace';
import { useSectionShot } from '@/components/useSectionShot';
import { CornerMarks, SectionTag, useRailFade } from '@/components/ui/primitives';
import { ScrollTrigger, useGsap } from '@/lib/gsap';
import { traceHandle } from '@/scenes/handles';
import { useScene } from '@/store/scene';

/**
 * THE VISITOR TRACE — the frame around it.
 *
 * The structure itself lives in the persistent scene (`scenes/VisitorTrace`).
 * This is the surface you draw on and the one number that says how many people
 * got here first.
 *
 * Like the Lab, the DOM is deliberately almost empty in the middle: the whole
 * section is a gesture target, and anything parked over it is somewhere the
 * cursor cannot go.
 *
 * ── WHAT A STROKE IS ──────────────────────────────────────────────────────
 *
 * Up to 120 points in normalised -1..1, captured from one pointer drag. `z`
 * comes from progress through the gesture rather than from the pointer, so the
 * filament is a genuine curve through the shared volume instead of a decal on
 * a plane — a flat gesture would read as writing on glass.
 *
 * There is no text field anywhere in this section and there will not be one.
 * Strokes are geometry: there is nothing to moderate, and a shared space that
 * cannot carry a message cannot carry an abusive one.
 */
export function Trace() {
  const root = useRef<HTMLElement>(null);
  const rail = useRef<HTMLDivElement>(null);
  const surface = useRef<HTMLDivElement>(null);
  useRailFade(rail);

  useSectionShot(root, 'trace', 'TRACE');

  const setTraceNear = useScene((s) => s.setTraceNear);
  const reducedMotion = useScene((s) => s.reducedMotion);

  const [count, setCount] = useState<number | null>(null);
  const [done, setDone] = useState(false);
  const [drawing, setDrawing] = useState(false);

  const points = useRef<number[]>([]);

  /**
   * A REF, not the `drawing` state, is the source of truth for the gesture.
   *
   * React state does not update inside a synchronous run of handlers: if
   * `pointerdown`, `pointermove` and `pointerup` all land before React
   * flushes, every handler after the first still reads the value from before
   * `setDrawing(true)` — so the move events are dropped and `pointerup`
   * returns early, leaving the section stuck on RELEASE TO COMMIT with a
   * gesture that is never sent.
   *
   * Real input survives that by accident, because a human's events land in
   * separate tasks with a flush between them. A fast pointer, a synthetic
   * sequence or a coalesced batch does not. The state below is kept purely to
   * drive the label; the ref decides what actually happens.
   */
  const drawingRef = useRef(false);

  // Mark the section as near, so the scene spends its request only when the
  // visitor is actually approaching. Same gate as the Work screenshot.
  useGsap(
    () => {
      const el = root.current;
      if (!el) return;
      ScrollTrigger.create({
        trigger: el,
        start: 'top bottom+=60%',
        onEnter: () => setTraceNear(true),
        onEnterBack: () => setTraceNear(true),
      });
    },
    [setTraceNear],
    root,
  );

  useEffect(() => {
    setDone(hasSubmitted());
  }, []);

  const refreshCount = useCallback(() => {
    const ac = new AbortController();
    void fetchCount(ac.signal).then((n) => {
      if (n !== null) setCount(n);
    });
    return () => ac.abort();
  }, []);

  const near = useScene((s) => s.traceNear);
  useEffect(() => {
    if (!near) return;
    return refreshCount();
  }, [near, refreshCount]);

  // ── Capture ─────────────────────────────────────────────────────────────
  const push = useCallback((e: React.PointerEvent) => {
    const el = surface.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 2 - 1;
    const y = -(((e.clientY - r.top) / r.height) * 2 - 1);
    if (points.current.length >= TRACE.maxPoints * 3) return;

    // Depth from progress through the gesture, so the filament travels through
    // the volume as it is drawn rather than lying flat in it.
    const p = points.current.length / 3 / TRACE.maxPoints;
    const z = (p - 0.5) * 0.6;

    points.current.push(
      Math.max(-1, Math.min(1, x)),
      Math.max(-1, Math.min(1, y)),
      Math.max(-1, Math.min(1, z)),
    );
  }, []);

  const onDown = (e: React.PointerEvent) => {
    if (done || !traceConfigured || reducedMotion) return;
    points.current = [];
    drawingRef.current = true;
    setDrawing(true);
    (e.target as Element).setPointerCapture?.(e.pointerId);
    push(e);
  };

  const onMove = (e: React.PointerEvent) => {
    if (!drawingRef.current) return;
    push(e);
  };

  const onUp = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    setDrawing(false);
    const pts = points.current;
    points.current = [];
    if (pts.length < TRACE.minPoints) return;

    // Optimistic: the section stops offering immediately. A failed post leaves
    // the visitor with a stroke that did not persist and no error — which is
    // the intended failure mode, because an error dialog on a portfolio is
    // worse than a stroke that quietly did not save.
    setDone(true);
    void submitStroke(pts).then((ok) => {
      if (!ok) return;
      traceHandle.onCommit?.();
      refreshCount();
    });
  };

  return (
    <section
      ref={root}
      id="trace"
      aria-label="Shared visitor drawing"
      className="relative flex min-h-[110svh] flex-col justify-between py-[clamp(5rem,14vh,9rem)]"
    >
      <CornerMarks />

      <div ref={rail} className="grid12 items-start gap-y-4">
        <div className="col-span-12 flex flex-wrap items-baseline justify-between gap-4">
          <SectionTag name="THE TRACE" />
          <span className="t-mono text-[var(--color-fg-dim)]">
            {count === null
              ? 'SHARED SPACE'
              : `${count.toLocaleString('en-US')} ${count === 1 ? 'STROKE' : 'STROKES'} · SHARED`}
          </span>
        </div>
        <div className="col-span-12 mt-2 h-px bg-[var(--color-rule)]" />
      </div>

      {/* The gesture target. Transparent, full-bleed, and the only interactive
          thing in the middle of the section. */}
      <div
        ref={surface}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        className="absolute inset-x-0 top-[18%] bottom-[18%] z-10"
        style={{ touchAction: 'none', cursor: done || reducedMotion ? 'default' : 'crosshair' }}
      />

      <div className="grid12 mt-auto items-end gap-y-8">
        <div className="col-span-12 md:col-span-5">
          <p className="t-body max-w-[34ch]">
            Everyone who comes here leaves one mark. This is all of them, in one
            volume, still accumulating.
          </p>
        </div>

        <div className="col-span-12 flex flex-col items-start gap-2 md:col-span-5 md:col-start-8 md:items-end">
          <span className="t-label flex items-center gap-3">
            <span className="h-px w-6 bg-[var(--color-rule)]" />
            {!traceConfigured
              ? 'ARCHIVE OFFLINE — VIEWING CACHED'
              : reducedMotion
                ? 'MOTION REDUCED — VIEWING ONLY'
                : done
                  ? 'YOUR MARK IS IN THERE'
                  : drawing
                    ? 'RELEASE TO COMMIT'
                    : 'DRAG TO DRAW YOUR MARK'}
          </span>
          <span className="t-label flex items-center gap-3">
            <span className="h-px w-6 bg-[var(--color-rule)]" />
            ONE PER VISITOR · {TRACE.maxPoints} POINTS MAX
          </span>
        </div>
      </div>
    </section>
  );
}
