'use client';

import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';

import { getLenis } from '@/components/SmoothScroll';
import { gsap, ScrollTrigger } from '@/lib/gsap';
import { blastHandle } from '@/scenes/handles';
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
        advance(stamp);
      }
      return snapshot();
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
      inspect,
      reducedMotion,
      state,
      blast,
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
