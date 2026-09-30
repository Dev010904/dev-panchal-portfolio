'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';

import { QUALITY, VOLUMETRIC as V } from '@/config/animation';
import { volumetricHandle } from '@/scenes/handles';
import { useScene } from '@/store/scene';

/** The two constants EXT_disjoint_timer_query_webgl2 adds. lib.dom has no type for it. */
interface TimerExt {
  TIME_ELAPSED_EXT: number;
  GPU_DISJOINT_EXT: number;
}

/**
 * wait        until the preloader has left and the reveal has settled
 * base        lean post, volumetric on its boot rung
 * full        verifying a promotion to the full post stack
 * volumetric  verifying a promotion to the top volumetric rung
 * down        verifying a step down the ladder
 */
type Round = 'wait' | 'base' | 'full' | 'volumetric' | 'down' | 'done';

/**
 * THE QUALITY GOVERNOR.
 *
 * Decides, once per page load and from measurements on the visitor's own
 * machine, what this scene can afford: the post tier, then the volumetric
 * rung, then the resolution rung. The reasoning, the numbers and the budget
 * live with the constants in `QUALITY` (config/animation.ts).
 *
 * WHY ONE OWNER. The volumetric used to calibrate itself from frame deltas and
 * the resolution was meant to follow drei's PerformanceMonitor. Two loops
 * reading the same frame times both react to the same slow frame, and they
 * never talked; this one changes one thing at a time and measures again.
 *
 * HOW THE FRAME IS TIMED. A GPU timer query is opened in the FIRST frame
 * callback (priority -1000) and closed in the LAST (priority 1000), which
 * brackets everything the frame submits: the light-depth pass at priority 0
 * and the composer at priority 1. Closing it at the top of the NEXT frame
 * instead would be simpler and wrong — the GPU executes the end marker when it
 * arrives, so the query would time the idle gap until vsync as well.
 *
 * A priority above 0 takes rendering away from R3F. That is safe only because
 * the composer renders every frame and this sits inside the same Suspense
 * boundary as it, so the two always mount and unmount together.
 *
 * Results arrive a frame or three late. Nothing is timed while a change is
 * warming up, and in-flight queries are discarded on every change, so a sample
 * always belongs to the configuration being judged.
 */
export function QualityGovernor({
  mobile,
  onDprRung,
}: {
  /** True whenever Effects runs its bloom-only composer: mobile OR reduced motion. */
  mobile: boolean;
  onDprRung: (rung: number) => void;
}) {
  const gl = useThree((s) => s.gl);

  const g = useRef({
    round: 'wait' as Round,
    enteredAt: -1,
    warm: 0,
    /** Visible frames spent in the current round, to detect a timer that never reports. */
    frames: 0,
    samples: [] as number[],
    /** Fastest frame delta seen this round: the refresh interval, for the fallback. */
    fastest: Infinity,
    dprRung: 0,
    /** False when something else (the QA harness) pinned the volumetric rung first. */
    ownsVolumetric: true,
    ctx: null as WebGL2RenderingContext | null,
    ext: null as TimerExt | null,
    open: null as WebGLQuery | null,
    pending: [] as WebGLQuery[],
  });

  useEffect(() => {
    const s = g.current;
    const ctx = gl.getContext() as WebGL2RenderingContext;
    s.ctx = ctx;
    s.ext = ctx.getExtension('EXT_disjoint_timer_query_webgl2') as TimerExt | null;
    return () => {
      for (const q of s.pending) ctx.deleteQuery(q);
      s.pending.length = 0;
    };
  }, [gl]);

  const drain = () => {
    const s = g.current;
    if (s.ctx) for (const q of s.pending) s.ctx.deleteQuery(q);
    s.pending.length = 0;
  };

  const begin = (round: Round) => {
    const s = g.current;
    s.round = round;
    s.samples.length = 0;
    s.fastest = Infinity;
    s.frames = 0;
    s.warm = QUALITY.warmFrames;
    drain();
  };

  const finish = (p50: number) => {
    const s = g.current;
    s.round = 'done';
    if (s.ownsVolumetric) volumetricHandle.calibrated = true;
    drain();
    // One line of evidence on the element, for checking a deployed page from
    // devtools without a harness. Written once; nothing reads it.
    gl.domElement.dataset.quality = [
      mobile ? 'mobile' : useScene.getState().postTier,
      `dpr ${QUALITY.dprRungs[s.dprRung]}`,
      `vol ${volumetricHandle.steps}`,
      `${s.ext ? 'gpu' : 'frame'} ${p50.toFixed(1)}ms`,
    ].join(' · ');
  };

  /** Cheapest visible loss first: the volumetric floor, then resolution, then the shafts. */
  const stepDown = (p50: number) => {
    const s = g.current;
    if (s.ownsVolumetric && volumetricHandle.steps > V.stepsFloor) {
      volumetricHandle.steps = V.stepsFloor;
      return begin('down');
    }
    if (s.dprRung < QUALITY.dprRungs.length - 1) {
      s.dprRung++;
      onDprRung(s.dprRung);
      return begin('down');
    }
    if (s.ownsVolumetric && volumetricHandle.steps > 0) volumetricHandle.steps = 0;
    finish(p50);
  };

  /** Only worth raising while the shafts are actually on screen to be measured. */
  const canRaiseVolumetric = () => {
    const s = g.current;
    return (
      s.ownsVolumetric &&
      volumetricHandle.steps > 0 &&
      volumetricHandle.steps < V.steps &&
      (V.shots as readonly string[]).includes(useScene.getState().shot)
    );
  };

  const decide = (p50: number) => {
    const s = g.current;
    const timed = s.ext !== null;
    // Without a GPU timer the only honest signal is a missed vsync.
    const over = timed ? p50 > QUALITY.budgetMs : p50 > s.fastest * QUALITY.missFactor;
    const roomy = timed && p50 <= QUALITY.budgetMs * QUALITY.volumetricHeadroom;

    switch (s.round) {
      case 'base':
        if (timed && !mobile && p50 <= QUALITY.promoteMs) {
          useScene.getState().setPostTier('full');
          return begin('full');
        }
        if (over) return stepDown(p50);
        if (roomy && canRaiseVolumetric()) {
          volumetricHandle.steps = V.steps;
          return begin('volumetric');
        }
        return finish(p50);

      case 'full':
        // Lean was already measured well inside the budget to get here.
        if (over) {
          useScene.getState().setPostTier('lean');
          return finish(p50);
        }
        if (roomy && canRaiseVolumetric()) {
          volumetricHandle.steps = V.steps;
          return begin('volumetric');
        }
        return finish(p50);

      case 'volumetric':
        if (over) volumetricHandle.steps = V.stepsLow;
        return finish(p50);

      case 'down':
        return over ? stepDown(p50) : finish(p50);
    }
  };

  // FIRST callback of the frame: open the timer.
  useFrame(() => {
    const s = g.current;
    if (!s.ctx || !s.ext || s.round === 'wait' || s.round === 'done') return;
    if (s.warm > 0 || s.pending.length > 3) return;
    const q = s.ctx.createQuery();
    if (!q) return;
    s.ctx.beginQuery(s.ext.TIME_ELAPSED_EXT, q);
    s.open = q;
  }, -1000);

  // LAST callback: close it, harvest whatever has finished, and judge.
  useFrame((_, delta) => {
    const s = g.current;
    if (s.open && s.ctx && s.ext) {
      s.ctx.endQuery(s.ext.TIME_ELAPSED_EXT);
      s.pending.push(s.open);
      s.open = null;
    }
    if (s.round === 'done') return;

    if (s.round === 'wait') {
      if (!useScene.getState().entered) return;
      const now = performance.now();
      if (s.enteredAt < 0) s.enteredAt = now;
      if (now - s.enteredAt < QUALITY.settle * 1000) return;
      s.ownsVolumetric = !volumetricHandle.calibrated;
      return begin('base');
    }

    // An occluded or background tab throttles frames for reasons that have
    // nothing to do with the machine. Pause, and re-warm on return.
    if (document.visibilityState !== 'visible') {
      s.warm = QUALITY.warmFrames;
      drain();
      return;
    }

    if (s.ctx && s.ext) {
      if (s.ctx.getParameter(s.ext.GPU_DISJOINT_EXT)) {
        // A GPU reset or clock change voids everything in flight.
        drain();
      } else {
        while (
          s.pending.length &&
          s.ctx.getQueryParameter(s.pending[0], s.ctx.QUERY_RESULT_AVAILABLE)
        ) {
          const q = s.pending.shift() as WebGLQuery;
          s.samples.push((s.ctx.getQueryParameter(q, s.ctx.QUERY_RESULT) as number) / 1e6);
          s.ctx.deleteQuery(q);
        }
      }
    } else if (s.warm <= 0 && delta > 0.004 && delta < 0.25) {
      s.samples.push(delta * 1000);
      s.fastest = Math.min(s.fastest, delta * 1000);
    }

    if (s.warm > 0) s.warm--;

    // A driver that accepts queries and never answers them would stall here
    // forever. Give it six rounds' worth of frames, then fall back to deltas.
    if (++s.frames > QUALITY.samples * 6 && s.samples.length < QUALITY.samples) {
      drain();
      s.ext = null;
      return begin(s.round);
    }

    if (s.samples.length < QUALITY.samples) return;
    const sorted = s.samples.slice().sort((a, b) => a - b);
    decide(sorted[sorted.length >> 1]);
  }, 1000);

  return null;
}
