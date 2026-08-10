'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';

import { cursorDebug, cursorStep } from '@/components/Cursor';
import { getLenis } from '@/components/SmoothScroll';
import { SWEEP } from '@/config/animation';
import { gsap, ScrollTrigger } from '@/lib/gsap';
import { blastHandle } from '@/scenes/handles';
import { nearestOnLine, sweepDebug, sweepScreen } from '@/scenes/sweep';
import { useScene } from '@/store/scene';

/**
 * DEV-ONLY deterministic QA harness. Stripped from production builds.
 *
 * WHY THIS EXISTS
 * Chrome throttles requestAnimationFrame to zero in a hidden or occluded tab.
 * Every moving part of this site — the R3F render loop, gsap.ticker, Lenis —
 * hangs off rAF, so an automated screenshot of a headless/background tab
 * captures frame one forever and tells you nothing.
 *
 * This exposes `window.__qa`, which advances all three clocks by an exact
 * amount of simulated time. That turns visual QA from "screenshot and hope"
 * into something deterministic: step to a known scroll position, advance a
 * known number of frames, capture. Step backwards, capture again, compare.
 *
 * It is also the only honest way to test a scrubbed timeline. A sequence that
 * only looks right playing forwards is a bug, and you cannot find that bug by
 * watching it play forwards.
 */
export function DevLoop() {
  const advance = useThree((s) => s.advance);
  const clock = useThree((s) => s.clock);
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);

  /**
   * What the render loop saw, and exactly when.
   *
   * Written once per rendered frame and read by `latency()`. The timestamp is
   * captured HERE rather than by the poller that detects the change, so the
   * measurement is unaffected by when the poller happens to run — the poller
   * only discovers that a frame consumed the input, never how long it took.
   */
  const probe = useRef({ pointerX: 0, at: 0, frame: 0 });

  useFrame(() => {
    const p = probe.current;
    p.pointerX = useScene.getState().pointer[0];
    p.at = performance.now();
    p.frame++;
  });

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;

    let stamp = performance.now();
    // GSAP's root runs on its own time base, not performance.now(). Seeding
    // from the current root time keeps the two in step; feeding it wall-clock
    // milliseconds instead would jump the root hundreds of seconds forward and
    // complete every tween on the page in one frame.
    let gsapTime = gsap.globalTimeline.time();

    /** Advance every clock by `dt` seconds, `count` times. */
    const tick = (dt = 1 / 60, count = 1) => {
      for (let i = 0; i < count; i++) {
        stamp += dt * 1000;
        gsapTime += dt;

        // GSAP's root timeline. Everything tweened on the DOM hangs off this.
        gsap.updateRoot(gsapTime);

        // Lenis integrates its own easing from the timestamp it is handed.
        getLenis()?.raf(stamp);

        // THREE.Clock derives delta from wall time. Rewinding oldTime makes
        // getDelta() report exactly dt, so 60 steps really is one simulated
        // second no matter how fast this loop actually runs. `running` is
        // forced because a stopped clock silently returns a delta of 0 and
        // every time-based animation freezes with no other symptom.
        clock.running = true;
        clock.oldTime = performance.now() - dt * 1000;
        // Reset BEFORE the frame, never after: resetting after would zero the
        // very totals the caller is about to read.
        gl.info.reset();
        advance(stamp);
      }
      return snapshot();
    };

    /**
     * Frame-time distribution over `count` real frames.
     *
     * A mean is useless here — nobody perceives an average frame. The p95 and
     * the single worst frame are what register as jank, so those are what this
     * reports. Timed with `performance.now()` around a forced `advance()`, which
     * measures our own frame cost rather than waiting on the compositor.
     */
    const profile = (count = 180) => {
      const times: number[] = new Array(count);
      let gsapT = gsap.globalTimeline.time();
      let mark = performance.now();
      for (let i = 0; i < count; i++) {
        const t0 = performance.now();
        mark += 1000 / 60;
        gsapT += 1 / 60;
        gsap.updateRoot(gsapT);
        getLenis()?.raf(mark);
        clock.running = true;
        clock.oldTime = performance.now() - 1000 / 60;
        gl.info.reset();
        advance(mark);
        times[i] = performance.now() - t0;
      }
      const sorted = [...times].sort((a, b) => a - b);
      const at = (q: number) => Number(sorted[Math.min(count - 1, Math.floor(count * q))].toFixed(2));
      return {
        frames: count,
        p50: at(0.5),
        p95: at(0.95),
        p99: at(0.99),
        worst: Number(sorted[count - 1].toFixed(2)),
        over16ms: times.filter((x) => x > 16.67).length,
        drawCalls: gl.info.render.calls,
        triangles: gl.info.render.triangles,
      };
    };

    /**
     * INPUT-TO-RENDER LATENCY — milliseconds from a pointer event being
     * dispatched to the first rendered frame that actually used it.
     *
     * This is the number that decides whether the cursor and the scroll feel
     * connected to the hand, and no frame-time table can see it. A page can
     * render every frame in 4ms and still feel laggy if the value it renders is
     * one or two frames stale — which is exactly the failure mode of having
     * several independent rAF loops, because the loop that reads the pointer may
     * run before the loop that wrote it and then always trails by a frame.
     *
     * Deliberately measured on REAL animation frames, not through `tick()`.
     * Forced advancement collapses the very ordering being measured; the only
     * honest way to time the production loop is to let it run.
     */
    const latency = async (samples = 40) => {
      const ms: number[] = [];
      const frames: number[] = [];

      for (let i = 0; i < samples; i++) {
        // Alternate so every dispatch is a genuine change. Re-sending the same
        // coordinate would be consumed with no observable difference and the
        // poll below would match instantly on a stale value.
        const x = i % 2 === 0 ? Math.round(window.innerWidth * 0.3) : Math.round(window.innerWidth * 0.7);
        const expect = (x / window.innerWidth) * 2 - 1;
        const startFrame = probe.current.frame;
        const t0 = performance.now();

        window.dispatchEvent(
          new PointerEvent('pointermove', {
            clientX: x,
            clientY: Math.round(window.innerHeight * 0.5),
            bubbles: true,
            pointerType: 'mouse',
          }),
        );

        const settled = await new Promise<boolean>((resolve) => {
          let waited = 0;
          const check = () => {
            if (Math.abs(probe.current.pointerX - expect) < 1e-9) return resolve(true);
            if (++waited > 30) return resolve(false);
            requestAnimationFrame(check);
          };
          requestAnimationFrame(check);
        });
        if (!settled) continue;

        ms.push(probe.current.at - t0);
        frames.push(probe.current.frame - startFrame);
      }

      if (!ms.length) return 'no samples settled';
      const sorted = [...ms].sort((a, b) => a - b);
      const at = (q: number) => Number(sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))].toFixed(2));
      return {
        samples: ms.length,
        medianMs: at(0.5),
        p95Ms: at(0.95),
        worstMs: Number(sorted[sorted.length - 1].toFixed(2)),
        /** Frames the input waited. 1 is ideal; 2+ means a loop-ordering stall. */
        medianFrames: frames.sort((a, b) => a - b)[Math.floor(frames.length / 2)],
        maxFrames: Math.max(...frames),
      };
    };

    /**
     * Measured distance from a screen position to each sweep line, and whether
     * that position arms it.
     *
     * Calls the renderer's own proximity code — not a copy of it — so a passing
     * result means the thing that actually fires bolts agrees. `settle` frames
     * are advanced first because the projection is refreshed inside useFrame.
     */
    const lightning = (x: number, y: number, settle = 2) => {
      window.dispatchEvent(
        new PointerEvent('pointermove', { clientX: x, clientY: y, bubbles: true, pointerType: 'mouse' }),
      );
      tick(1 / 60, settle);
      return sweepScreen.map((l, i) => ({
        id: l.id,
        distance: Number(sweepDebug.distance[i].toFixed(2)),
        armed: sweepDebug.inside[i],
      }));
    };

    /**
     * CURSOR TRACKING ERROR — the number that describes the reported lag.
     *
     * `latency()` measures event-to-first-render and reports 1 frame, which is
     * correct and beside the point. The cursor is exponentially damped, so its
     * steady-state offset under motion is `e = v / a` — PROPORTIONAL TO SPEED.
     * A one-frame pipeline can still draw the ring 200px from the pointer.
     *
     * This drives a straight sweep at a chosen speed, one `pointermove` per
     * FORCED frame, and records the pixel gap between the true pointer and each
     * rendered element every frame. Then it stops the pointer and counts frames
     * until the ring is within 1px.
     *
     * Forced frames, not real ones, and that is essential in this environment:
     * an occluded window throttles rAF to a few Hz, which would silently stretch
     * every dt and make the damping look far better than it is.
     */
    const cursorLag = (speedsPxPerSec = [400, 1200, 2400, 4000]) => {
      const dt = 1 / 60;
      const y = Math.round(window.innerHeight * 0.5);
      const out: Record<string, unknown> = {};

      for (const speed of speedsPxPerSec) {
        const perFrame = speed * dt;
        const steps = Math.min(90, Math.max(20, Math.floor((window.innerWidth * 0.7) / perFrame)));
        let x = Math.round(window.innerWidth * 0.15);

        // Seed: put the pointer down and let everything settle so the first
        // measured frame is steady-state motion, not the initial catch-up.
        window.dispatchEvent(new PointerEvent('pointermove', { clientX: x, clientY: y, bubbles: true, pointerType: 'mouse' }));
        tick(dt, 30);
        for (let w = 0; w < 30; w++) cursorStep(dt);

        const ringGap: number[] = [];
        const dotGap: number[] = [];
        for (let i = 0; i < steps; i++) {
          x += perFrame;
          window.dispatchEvent(new PointerEvent('pointermove', { clientX: x, clientY: y, bubbles: true, pointerType: 'mouse' }));
          tick(dt, 1);
          cursorStep(dt);
          ringGap.push(Math.hypot(cursorDebug.targetX - cursorDebug.ringX, cursorDebug.targetY - cursorDebug.ringY));
          dotGap.push(Math.hypot(cursorDebug.targetX - cursorDebug.dotX, cursorDebug.targetY - cursorDebug.dotY));
        }

        // Second half only: the first frames are still converging toward the
        // steady state and would drag the average down.
        const tail = ringGap.slice(Math.floor(ringGap.length / 2));
        const mean = tail.reduce((a, b) => a + b, 0) / tail.length;

        let framesToConverge = 0;
        while (framesToConverge < 120) {
          tick(dt, 1);
          cursorStep(dt);
          framesToConverge++;
          if (Math.hypot(cursorDebug.targetX - cursorDebug.ringX, cursorDebug.targetY - cursorDebug.ringY) < 1) break;
        }

        out[`${speed}px/s`] = {
          pxPerFrame: Number(perFrame.toFixed(1)),
          ringSteadyGapPx: Number(mean.toFixed(1)),
          ringWorstGapPx: Number(Math.max(...ringGap).toFixed(1)),
          dotWorstGapPx: Number(Math.max(...dotGap).toFixed(2)),
          framesToConverge,
        };
      }
      return out;
    };

    /**
     * Arming-boundary scan against a FROZEN projection.
     *
     * `lightningSweep` below dispatches a real pointer event per sample, which
     * means it advances a frame per sample — and the lines rotate. Across a
     * 1900px run that is several seconds of rotation, so the geometry being
     * measured moves while it is measured and the boundary smears.
     *
     * This refreshes the projection exactly once and then evaluates the
     * renderer's own `nearestOnLine` at every cursor position against that one
     * frozen pose. Nothing ticks, nothing rotates, and the result is the true
     * shape of the armed region rather than a motion-blurred version of it.
     */
    const lightningScan = (
      lineId: string,
      y: number,
      x0 = 0,
      x1 = window.innerWidth,
      step = 4,
    ) => {
      const idx = sweepScreen.findIndex((l) => l.id === lineId);
      if (idx < 0) return `no line "${lineId}"`;
      tick(1 / 60, 1); // one frame: refresh the projection, then freeze

      const radius = SWEEP.strike.radius;
      const rows: { x: number; d: number; within: boolean }[] = [];
      for (let x = x0; x <= x1; x += step) {
        const d = nearestOnLine(idx, x, y).distance;
        rows.push({ x, d: Number(d.toFixed(2)), within: d <= radius });
      }

      const inside = rows.filter((r) => r.within);
      const outside = rows.filter((r) => !r.within);
      // Where the stroke actually is: the run's single closest approach.
      const closest = rows.reduce((a, b) => (b.d < a.d ? b : a), rows[0]);
      return {
        line: lineId,
        y,
        radius,
        samples: rows.length,
        withinCount: inside.length,
        closestApproach: closest,
        maxDistanceInside: inside.length ? Math.max(...inside.map((r) => r.d)) : null,
        minDistanceOutside: outside.length ? Math.min(...outside.map((r) => r.d)) : null,
        /** Contiguous x-runs that arm, in CSS px. */
        bands: inside.reduce<[number, number][]>((acc, r) => {
          const last = acc[acc.length - 1];
          if (last && r.x - last[1] <= step) last[1] = r.x;
          else acc.push([r.x, r.x]);
          return acc;
        }, []),
      };
    };

    /**
     * Walk the cursor across a horizontal run at fixed Y and report, for one
     * line, measured distance against armed state at every step. This is the
     * empirical check that the arming boundary matches the visible stroke.
     */
    const lightningSweep = (
      lineId: string,
      y: number,
      x0 = 0,
      x1 = window.innerWidth,
      step = 8,
    ) => {
      const idx = sweepScreen.findIndex((l) => l.id === lineId);
      if (idx < 0) return `no line "${lineId}"`;
      const rows: { x: number; d: number; armed: boolean }[] = [];
      for (let x = x0; x <= x1; x += step) {
        lightning(x, y, 1);
        rows.push({ x, d: Number(sweepDebug.distance[idx].toFixed(2)), armed: sweepDebug.inside[idx] });
      }
      const armed = rows.filter((r) => r.armed);
      return {
        line: lineId,
        y,
        samples: rows.length,
        armedCount: armed.length,
        maxDistanceWhileArmed: armed.length ? Math.max(...armed.map((r) => r.d)) : null,
        minDistanceWhileIdle: rows.filter((r) => !r.armed).reduce((m, r) => Math.min(m, r.d), Infinity),
        rows,
      };
    };

    /** Jump to an absolute scroll position and settle it. */
    const scrollTo = (y: number, settleFrames = 30) => {
      const lenis = getLenis();
      if (lenis) lenis.scrollTo(y, { immediate: true, force: true });
      else window.scrollTo(0, y);
      ScrollTrigger.update();
      return tick(1 / 60, settleFrames);
    };

    /** Jump to a fraction of total scrollable height. */
    const scrollToFraction = (f: number, settleFrames = 30) =>
      scrollTo((document.body.scrollHeight - window.innerHeight) * f, settleFrames);

    /**
     * WARNING ABOUT EVERY NUMBER THIS EVER REPORTED BEFORE THIS COMMIT.
     *
     * `gl.info` resets itself at the start of every `render()` call. The post
     * stack calls render several times a frame and finishes with a fullscreen
     * quad, so reading `info.render` after the frame returned the cost of THAT
     * QUAD and nothing else — `drawCalls: 1, triangles: 1`, at every scroll
     * position, forever. Any performance figure quoted from this harness before
     * now is worthless. See docs/PERFORMANCE.md.
     *
     * `autoReset = false` makes the counters accumulate; DevLoop resets them
     * once per frame, before the frame is drawn, so what is read afterwards is
     * one frame's true total across every pass.
     */
    gl.info.autoReset = false;

    const snapshot = () => ({
      elapsed: Number(clock.elapsedTime.toFixed(3)),
      scroll: Math.round(getLenis()?.scroll ?? window.scrollY),
      drawCalls: gl.info.render.calls,
      triangles: gl.info.render.triangles,
      programs: gl.info.programs?.length ?? 0,
    });

    /** Move the virtual pointer without a real mouse. */
    const pointer = (x: number, y: number) => {
      window.dispatchEvent(
        new PointerEvent('pointermove', {
          clientX: x,
          clientY: y,
          bubbles: true,
          pointerType: 'mouse',
        }),
      );
      return tick(1 / 60, 8);
    };

    /** Flat dump of the scene graph — what is actually being drawn, and why not. */
    const inspect = () => {
      const rows: Record<string, unknown>[] = [];
      scene.traverse((o) => {
        const m = (o as unknown as { material?: { uniforms?: unknown; opacity?: number } })
          .material;
        rows.push({
          type: o.type,
          visible: o.visible,
          order: o.renderOrder,
          culled: o.frustumCulled,
          opacity: m && !Array.isArray(m) ? (m.uniforms ? 'shader' : m.opacity) : undefined,
        });
      });
      return rows;
    };

    /**
     * Force the reduced-motion path without changing OS settings.
     *
     * `prefers-reduced-motion` cannot be emulated from page script, and it is
     * the one accessibility mode most likely to be shipped broken precisely
     * because nobody can be bothered to toggle it in system preferences to
     * check. This makes it a one-liner.
     */
    const reducedMotion = (on: boolean) => {
      useScene.getState().setEnv({ reducedMotion: on });
      return tick(1 / 60, 30);
    };

    /**
     * Hold-to-blast state. This one is worth exposing: the blast is driven from
     * a gsap.ticker callback rather than from useFrame, so `tick()` above does
     * not step it — gsap.ticker has no manual-advance API — and the only way to
     * check the state machine is to read the handle against real elapsed time.
     */
    const blast = () => ({ ...blastHandle });

    const state = () => {
      const s = useScene.getState();
      return {
        entered: s.entered,
        shot: s.shot,
        section: s.activeSection,
        structure: s.structure,
        reducedMotion: s.reducedMotion,
        isMobile: s.isMobile,
        footerNear: s.footerNear,
      };
    };

    const w = window as unknown as { __qa: unknown };
    w.__qa = {
      tick,
      scrollTo,
      scrollToFraction,
      pointer,
      snapshot,
      profile,
      latency,
      inspect,
      reducedMotion,
      state,
      blast,
      cursorLag,
      lightning,
      lightningScan,
      lightningSweep,
      scene,
      // The camera is not part of the scene graph in R3F, so a traversal
      // cannot find it. Exposing it here is what lets QA project a piece of
      // scene geometry to screen space and drive the pointer at it exactly,
      // instead of hunting for it with a grid sweep.
      camera,
      gl,
    };

    return () => {
      delete (window as unknown as { __qa?: unknown }).__qa;
    };
  }, [advance, clock, gl, scene, camera]);

  return null;
}
