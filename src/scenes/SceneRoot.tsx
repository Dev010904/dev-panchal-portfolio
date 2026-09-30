'use client';

import { AdaptiveEvents, Preload, useProgress } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Suspense, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

import { bootComplete, bootProgress, markBootStep, onBootProgress } from '@/lib/boot';
import { probeCapability } from '@/lib/gpgpu/PingPong';
import { pointerHandle } from '@/lib/pointer';

import { CAMERA, DPR, LAB, MOBILE, QUALITY, SHOTS } from '@/config/animation';
import { AnnotationProjector } from './AnnotationProjector';
import { CameraRig } from './CameraRig';
import { DevLoop } from './DevLoop';
import { Effects } from './Effects';
import { FooterFloor } from './FooterFloor';
import { LabField } from './LabField';
import { LabFieldGPU } from './LabFieldGPU';
import { MarkObject } from './MarkObject';
import { PageStructures } from './PageStructures';
import { QualityGovernor } from './QualityGovernor';
import { Stage } from './Stage';
import { StackConstellation } from './StackConstellation';
import { SweepLines } from './SweepLines';
import { Telemetry } from './Telemetry';
import { Volumetrics } from './Volumetrics';
import { WipeOverlay } from './WipeOverlay';
import { WorkScene } from './WorkScene';
import { markHandles } from './handles';
import { lensHandle } from './lens';
import { useScene } from '@/store/scene';

/**
 * THE PERSISTENT CANVAS.
 *
 * Mounted once in the root layout and never unmounted. Sections do not own
 * scenes; they set state, and the objects in here morph. That is the reason
 * there is never a white flash and never a re-initialised WebGL context — the
 * two things that give away a "3D section bolted onto a website".
 *
 * The canvas is fixed behind the DOM at z-0. Every section composites over it.
 */
export function SceneRoot() {
  const setEnv = useScene((s) => s.setEnv);
  const [mobile, setMobile] = useState(false);
  const [reduced, setReduced] = useState(false);
  /** Index into QUALITY.dprRungs, moved only by the quality governor. */
  const [dprRung, setDprRung] = useState(0);

  /**
   * THE CANVAS IS NOT MOUNTED ON THE FIRST RENDER, AND THAT IS THE WHOLE POINT.
   *
   * Creating the WebGL context, extruding the mark, area-sampling it for the
   * particle cloud, convolving the environment map and compiling every shader
   * program are all synchronous main-thread work. Mounted inline, all of it
   * lands in the same task as the client's first render — so the browser cannot
   * paint the DOM until the 3D scene has finished booting, even though the DOM
   * does not depend on it and the preloader is covering the screen anyway.
   *
   * That is the wrong order. The DOM is the content; the scene is the surface
   * it composites over. Painting the text first costs the scene a few hundred
   * milliseconds it spends behind a preloader regardless, and buys a first
   * paint that does not wait on the GPU.
   *
   * TWO rAFs, THEN IDLE. One rAF fires BEFORE the paint it was scheduled
   * against; two guarantees at least one frame has actually been presented.
   * `requestIdleCallback` then waits for the main thread to have room, so the
   * context creation is not competing with hydration for the same task.
   *
   * The 600ms timeout is the floor, not the target. requestIdleCallback on a
   * genuinely busy thread can be starved indefinitely, and a scene that never
   * mounts because the machine was briefly busy is a far worse failure than a
   * scene that mounts slightly early. Safari has no requestIdleCallback at all,
   * which the fallback covers.
   */
  const [live, setLive] = useState(false);

  useEffect(() => {
    let frame = 0;
    let idle = 0;
    let timer = 0;

    const go = () => setLive(true);

    const whenIdle = () => {
      const ric = (
        window as unknown as {
          requestIdleCallback?: typeof requestIdleCallback;
        }
      ).requestIdleCallback;
      if (ric) idle = ric(go, { timeout: 600 });
      else timer = window.setTimeout(go, 1);
    };

    frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(whenIdle);
    });

    return () => {
      cancelAnimationFrame(frame);
      if (idle) {
        (
          window as unknown as {
            cancelIdleCallback?: typeof cancelIdleCallback;
          }
        ).cancelIdleCallback?.(idle);
      }
      if (timer) clearTimeout(timer);
    };
  }, []);

  // ── Environment probes ────────────────────────────────────────────────────
  useEffect(() => {
    const mqMobile = window.matchMedia(`(max-width: ${MOBILE.breakpoint - 1}px)`);
    const mqMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    const sync = () => {
      setMobile(mqMobile.matches);
      setReduced(mqMotion.matches);
      setEnv({ isMobile: mqMobile.matches, reducedMotion: mqMotion.matches });
    };
    sync();

    mqMobile.addEventListener('change', sync);
    mqMotion.addEventListener('change', sync);
    return () => {
      mqMobile.removeEventListener('change', sync);
      mqMotion.removeEventListener('change', sync);
    };
  }, [setEnv]);

  /**
   * NOTE ON PAUSING WHEN HIDDEN — there is deliberately no code for it.
   *
   * Two obvious approaches were tried and both are wrong here:
   *
   *   `frameloop="demand"` — wrong by design. The hero animates continuously,
   *   so there is no idle state to demand-render from; it would simply never
   *   draw except when something called invalidate().
   *
   *   `frameloop="never"` on document.hidden, or an `if (!visible) return` at
   *   the top of every useFrame — both stop the animation callbacks, which
   *   also stops anything that drives frames manually (the dev QA harness, and
   *   any future offline capture), and the flag version keeps re-rendering the
   *   scene while pretending to be paused.
   *
   * Every browser already throttles requestAnimationFrame to zero for a hidden
   * or occluded tab. The loop stops on its own, for free, and correctly.
   */
  useEffect(() => {
    const onVis = () => setEnv({ visible: !document.hidden });
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [setEnv]);

  // ── Pointer ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (mobile) return;
    const onMove = (e: PointerEvent) => {
      const x = (e.clientX / window.innerWidth) * 2 - 1;
      const y = -((e.clientY / window.innerHeight) * 2 - 1);
      useScene
        .getState()
        .setPointer(x, y, e.clientX / window.innerWidth, 1 - e.clientY / window.innerHeight);

      // The lens wants raw CSS pixels, not the normalised pair above. It is
      // resolved against the drawing buffer in the shader, so normalising here
      // and un-normalising there would lose precision for nothing — and a
      // pointer-driven parallax is already using the normalised pair for a
      // different purpose. Two consumers, two units, one event.
      lensHandle.targetX = e.clientX;
      lensHandle.targetY = e.clientY;

      // The one shared pointer. The Cursor reads this instead of running a
      // second `pointermove` listener of its own.
      pointerHandle.x = e.clientX;
      pointerHandle.y = e.clientY;
      pointerHandle.present = true;
      // A pointer that has never moved must not open the lens at the origin.
      if (!lensHandle.present) {
        lensHandle.present = true;
        lensHandle.x = e.clientX;
        lensHandle.y = e.clientY;
      }

      // Repaint the cursor dot NOW, at the pointer's own event rate, rather
      // than waiting for the next rendered frame. See the note on `onMove` in
      // lib/pointer.ts: everything else here can be a frame late, and the
      // thing you are physically holding cannot.
      pointerHandle.onMove?.();
    };

    // `pointerleave` on the document fires when the cursor exits the window
    // entirely. Without it the lens stays parked wherever the pointer was when
    // it left the viewport, which reads as the effect having got stuck.
    const onLeave = () => {
      lensHandle.present = false;
      pointerHandle.present = false;
    };
    const onEnter = () => {
      lensHandle.present = true;
      pointerHandle.present = true;
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerleave', onLeave);
    document.addEventListener('pointerenter', onEnter);
    return () => {
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerleave', onLeave);
      document.removeEventListener('pointerenter', onEnter);
    };
  }, [mobile]);

  const quality = mobile ? 'low' : 'high';

  return (
    <div className="fixed inset-0 z-0" aria-hidden="true">
      {live && (
        <Canvas
          dpr={resolveDpr(mobile ? MOBILE.dpr : DPR, QUALITY.dprRungs[dprRung])}
          gl={{
            antialias: false,
            alpha: false,
            powerPreference: 'high-performance',
            stencil: false,
            depth: true,
          }}
          camera={{
            fov: CAMERA.fov,
            near: CAMERA.near,
            far: CAMERA.far,
            position: [0, 0, SHOTS.hero.orbit[0]],
          }}
          onCreated={({ gl, scene }) => {
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = 1.05;
            gl.outputColorSpace = THREE.SRGBColorSpace;
            gl.setClearColor('#08080a', 1);
            scene.fog = new THREE.FogExp2('#08080a', 0.052);
          }}
        >
          <ProgressBridge />
          <FrameProbe />
          {/* Owns gl.info: autoReset off, exactly one reset per real frame. Must
            stay outside the Suspense boundary — a suspension in there would
            take the per-frame reset down with it and the counters would start
            accumulating with nothing to say so. */}
          <Telemetry />
          {process.env.NODE_ENV !== 'production' && <DevLoop />}

          {/* Anything that can suspend (the environment map, project textures)
            sits inside this boundary. Without it a suspension inside the
            Canvas takes the whole tree down with no visible error. */}
          <Suspense fallback={null}>
            <Stage mobile={mobile} />
            <CameraRig />

            <MarkObject handles={markHandles} quality={quality} />
            {/* MUST stay after MarkObject. R3F dispatches useFrame subscribers in
              subscription order, so this reads the mark's transforms for THIS
              frame when it renders the light-space depth map. Move it above and
              the shafts silently lag the object by a frame. */}
            <Volumetrics mobile={mobile} />
            {/* Three hairline arcs. Real geometry, so the mark occludes them. */}
            <SweepLines />
            <AnnotationProjector />
            {/* Two Lab fields, exactly one of which draws. See <LabFields>. */}
            <LabFields quality={quality} mobile={mobile} />
            <StackConstellation />
            <WorkScene quality={quality} />
            <PageStructures quality={quality} />
            <FooterFloor />

            <WipeOverlay />

            <Effects mobile={mobile || reduced} />
            {/* Inside this boundary, beside Effects, on purpose: it holds a
              frame callback at priority 1000, which takes rendering away from
              R3F, and only the composer gives it back. The two must mount and
              unmount together. */}
            <QualityGovernor mobile={mobile || reduced} onDprRung={setDprRung} />
          </Suspense>

          {/*
          THERE WAS A PerformanceMonitor + AdaptiveDpr PAIR HERE, AND IT NEVER
          CHANGED THE RESOLUTION. PerformanceMonitor only computes a factor and
          calls the callbacks it is given (none were); AdaptiveDpr only reacts
          to `performance.current`, which nothing lowered on a slow frame. The
          resolution is now a rung of the quality governor, passed in through
          the `dpr` prop above — the prop has to carry it, because R3F re-applies
          `dpr` on every Canvas render and would undo a value set around it.
        */}
          <AdaptiveEvents />
          <Preload all />
        </Canvas>
      )}
    </div>
  );
}

/**
 * R3F's own rule for a `[min, max]` pair — the device ratio, clamped — then
 * scaled by the governor's rung and floored at `min` again. Returns a number,
 * so R3F uses it as given. Only called once the Canvas is live, i.e. on the
 * client, where `window` exists.
 */
function resolveDpr([min, max]: readonly [number, number], scale: number): number {
  const target = Math.min(Math.max(min, window.devicePixelRatio || 1), max);
  return Math.max(min, Math.round(target * scale * 100) / 100);
}

/**
 * WHICH LAB FIELD DRAWS.
 *
 * Exactly one of them, always, and the choice is made in one place from one
 * probe. `LabFieldGPU` needs a float colour attachment to have anywhere to
 * write; without `EXT_color_buffer_float` there is no simulation to run and the
 * honest answer is the closed-form 46k CPU path that was already there. Mobile
 * takes that route unconditionally — the ladder's lowest rung is 250k points
 * and two fullscreen float passes a frame, which is not a phone's budget.
 *
 * This lives inside the Canvas because the probe needs the renderer, and it is
 * a component rather than a branch in `SceneRoot` so that `LabField` stays a
 * live, mounted code path rather than a fallback nobody ever exercises.
 *
 * `probeCapability` is cached per renderer, so asking here and asking again
 * inside `LabFieldGPU` cannot produce two different answers.
 */
function LabFields({ quality, mobile }: { quality: 'high' | 'low'; mobile: boolean }) {
  const gl = useThree((s) => s.gl);
  const [cap] = useState(() => probeCapability(gl));
  const setLabCount = useScene((s) => s.setLabCount);

  /**
   * Dev-only override: `?lab=cpu` or `?lab=gpu`.
   *
   * The comment below claims the CPU path stays a live, already-working code
   * path rather than a branch nobody exercises. That is only true if it can
   * actually be exercised, and on any machine with float render targets the
   * GPU branch always wins — so the fallback was unreachable in practice and
   * the claim was aspirational.
   *
   * It also makes the two fields directly comparable at the same scroll
   * position, which is the only honest way to check that the GPU version is
   * DENSER than the 46k field without being BRIGHTER than it.
   *
   * Read once, in a lazy initialiser, so it cannot change identity mid-session
   * and remount a field on some unrelated re-render.
   */
  const [override] = useState<string | null>(() => {
    if (process.env.NODE_ENV === 'production' || typeof window === 'undefined') return null;
    return new URLSearchParams(window.location.search).get('lab');
  });

  /**
   * ── THE GPU FIELD IS OFF. THIS IS AN ART-DIRECTION DECISION, NOT A BUG. ──
   *
   * The simulation is correct and the render bug that made it invisible is
   * fixed (see `LabFieldGPU`'s `setDrawRange` note) — it draws all 350,464
   * points, reads cleanly as the letterforms, and holds the black. It was
   * looked at on screen, side by side with this path, and the 46k CPU field is
   * simply the better section: its scatter, its magnetic reform and its
   * shockwave read as a field you are pushing around, and the denser GPU
   * version reads as a static sign that happens to have more dots in it.
   *
   * That is the same rule that cut the caustics — an effect that reads as a
   * demo gets cut, however much work is in it.
   *
   * The GPU path stays mounted-and-off rather than deleted: it is a working
   * implementation, it is the thing the WebGPU migration ports, and
   * `?lab=gpu` in dev renders it for comparison whenever this decision is
   * revisited. `?lab=cpu` forces this path.
   */
  const gpu = override === 'gpu' && cap.tier !== null;

  // The section header prints this. It is written here rather than inside
  // either field because this is the only place that knows which one won.
  useEffect(() => {
    const cpu = mobile ? Math.floor(LAB.count.desktop * MOBILE.particleScale) : LAB.count.desktop;
    setLabCount(gpu && cap.tier ? cap.tier.count : cpu);
  }, [gpu, cap.tier, mobile, setLabCount]);

  return (
    <>
      <LabFieldGPU enabled={gpu} />
      <LabField quality={quality} gpuActive={gpu} />
    </>
  );
}

/**
 * Real load progress. Never a fake timer — if shader compilation takes 400ms
 * on a slow machine the counter waits for it, otherwise the preloader lies and
 * the reveal lands on a half-built frame.
 *
 * Two sources, combined: drei's loading manager (for anything actually
 * downloaded) and the boot milestones in lib/boot.ts (for the procedural work,
 * which is where this site's time actually goes). Whichever is further behind
 * holds the bar.
 */
function ProgressBridge() {
  const { progress, total } = useProgress();
  const setProgress = useScene((s) => s.setProgress);
  const setReady = useScene((s) => s.setReady);
  const [boot, setBoot] = useState(bootProgress());

  useEffect(() => onBootProgress(() => setBoot(bootProgress())), []);

  useEffect(() => {
    const assets = total > 0 ? progress / 100 : 1;
    setProgress(Math.min(boot, assets));
  }, [boot, progress, total, setProgress]);

  useEffect(() => {
    if (!bootComplete()) return;
    if (total > 0 && progress < 100) return;
    setReady(true);
  }, [boot, progress, total, setReady]);

  return null;
}

/**
 * Reports the first frames actually drawn. `warm` waits three frames rather
 * than one: the first frame after a shader program links is routinely 100ms+
 * on integrated graphics, and revealing on it means the visitor's first
 * impression of the site is a stutter.
 */
function FrameProbe() {
  const frames = useRef(0);
  useFrame(() => {
    frames.current++;
    if (frames.current === 1) markBootStep('firstFrame');
    if (frames.current === 4) markBootStep('warm');
  });
  return null;
}
