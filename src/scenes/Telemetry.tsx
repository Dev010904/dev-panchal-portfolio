'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect } from 'react';

import { active, label } from '@/lib/backend';
import { telemetryHandle } from '@/scenes/handles';

/**
 * THE TELEMETRY SAMPLER.
 *
 * Lives inside the Canvas because `gl.info` does. Writes one plain object per
 * real frame; the DOM readout in `components/TelemetryHud` reads it. Draws
 * nothing.
 *
 * ── THIS COMPONENT OWNS `gl.info`. NOTHING ELSE MAY. ──────────────────────
 *
 * `WebGLRenderer.info` resets itself at the start of every `render()` call.
 * `EffectComposer` renders several times per frame and finishes with a
 * fullscreen quad, so anything reading `info.render` after a frame sees the
 * cost of THAT QUAD — `drawCalls: 1, triangles: 1`, at every scroll position,
 * forever. That defect shipped in the QA harness for months and every number it
 * ever produced was void. docs/PERFORMANCE.md opens with it.
 *
 * The fix has two halves and both are required:
 *
 *   1. `autoReset = false`, so the counters accumulate across every pass of a
 *      frame instead of being wiped by each one.
 *   2. exactly ONE reset per frame, before anything draws.
 *
 * The dev harness sets (1) too, and resets inside `tick()` / `profile()` — but
 * ONLY there, on forced frames. Nothing resets on a real rAF frame, which is
 * why a bare `__qa.snapshot()` on a page that has simply been sitting there
 * returns the running total since load: 13092 draws against a true 87. The
 * tell is that both counters are wrong by the same factor, because accumulation
 * scales everything by one constant and real geometry changes do not.
 *
 * So this component supplies half (2) for real frames, which is what makes a
 * live HUD possible at all. It coexists with the harness: on a forced frame
 * `tick()` resets, then `advance()` runs this callback, which reads the
 * previous frame and resets again before the render — so `tick()`'s own
 * snapshot still sees exactly one frame's totals.
 *
 * ── ORDERING ──────────────────────────────────────────────────────────────
 *
 * `priority` is negative so this sorts ahead of every other `useFrame` and the
 * reset lands before any of them can submit. It must stay NEGATIVE and never
 * merely 0: R3F counts any subscriber with `priority > 0` as taking over
 * rendering and stops calling `render()` itself, which would blank the site.
 */
export function Telemetry() {
  const gl = useThree((s) => s.gl);

  useEffect(() => {
    gl.info.autoReset = false;
    telemetryHandle.backend = label(active(gl));
    return () => {
      // Handing the renderer back the way it was found. Nothing else reads
      // these counters in production, but leaving a global flag flipped by a
      // component that has unmounted is how the next confusing session starts.
      gl.info.autoReset = true;
    };
  }, [gl]);

  useFrame((_, delta) => {
    const r = gl.info.render;

    // What the PREVIOUS frame actually drew, across every pass.
    telemetryHandle.drawCalls = r.calls;
    telemetryHandle.triangles = r.triangles;
    telemetryHandle.points = r.points;
    telemetryHandle.programs = gl.info.programs?.length ?? 0;

    /**
     * Frame interval, smoothed.
     *
     * ── WHY STALLED FRAMES ARE DISCARDED RATHER THAN AVERAGED IN ──────────
     *
     * Every browser throttles `requestAnimationFrame` toward zero in a hidden
     * or occluded tab, so the delta across a backgrounded stretch is not a
     * frame time — it is a wall-clock gap with no work in it. Measured here
     * live: an occluded tab produced deltas of 12.8s and 58.4s, and the HUD
     * dutifully printed `58416.3MS`, which is both true and useless. A visitor
     * returning to a backgrounded tab would have seen the same thing and
     * concluded the site was broken.
     *
     * Anything past `STALL_MS` is therefore dropped from the average instead of
     * clamped into it. Dropping keeps the readout meaning "how long a real
     * frame takes"; clamping would quietly fold a 58-second gap in as if it
     * were a 250ms frame and bias the number for the next several seconds.
     *
     * The threshold is well above any genuine frame — a 250ms frame is already
     * fifteen times the budget and would be visible as a hard hitch — so no
     * real cost is being hidden by this.
     */
    const STALL_MS = 250;
    const ms = delta * 1000;
    if (ms <= STALL_MS) {
      // Frame-rate-invariant coefficient, for the same reason every other
      // damped value on this site uses one: a fixed alpha smooths twice as hard
      // at 120Hz as it does at 60.
      const k = 1 - Math.exp(-6 * delta);
      telemetryHandle.frameMs =
        telemetryHandle.frameMs > 0
          ? telemetryHandle.frameMs + (ms - telemetryHandle.frameMs) * k
          : ms;
    }

    telemetryHandle.frame++;

    // Last statement in the callback, so every subsequent draw this frame is
    // counted and none of the previous frame's totals survive into it.
    gl.info.reset();
  }, -1000);

  return null;
}
