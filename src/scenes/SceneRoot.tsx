'use client';

import { AdaptiveDpr, AdaptiveEvents, Preload, useProgress } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { Suspense, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

import { bootComplete, bootProgress, markBootStep, onBootProgress } from '@/lib/boot';

import { CAMERA, DPR, MOBILE, SHOTS } from '@/config/animation';
import { AnnotationProjector } from './AnnotationProjector';
import { CameraRig } from './CameraRig';
import { DevLoop } from './DevLoop';
import { Effects } from './Effects';
import { FooterFloor } from './FooterFloor';
import { LabField } from './LabField';
import { MarkObject } from './MarkObject';
import { PageStructures } from './PageStructures';
import { Stage } from './Stage';
import { SweepLines } from './SweepLines';
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
      // A pointer that has never moved must not open the lens at the origin.
      if (!lensHandle.present) {
        lensHandle.present = true;
        lensHandle.x = e.clientX;
        lensHandle.y = e.clientY;
      }
    };

    // `pointerleave` on the document fires when the cursor exits the window
    // entirely. Without it the lens stays parked wherever the pointer was when
    // it left the viewport, which reads as the effect having got stuck.
    const onLeave = () => {
      lensHandle.present = false;
    };
    const onEnter = () => {
      lensHandle.present = true;
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
      <Canvas
        dpr={mobile ? MOBILE.dpr : DPR}
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
        {process.env.NODE_ENV !== 'production' && <DevLoop />}

        {/* Anything that can suspend (the environment map, project textures)
            sits inside this boundary. Without it a suspension inside the
            Canvas takes the whole tree down with no visible error. */}
        <Suspense fallback={null}>
          <Stage mobile={mobile} />
          <CameraRig />

          <MarkObject handles={markHandles} quality={quality} />
          {/* Three hairline arcs. Real geometry, so the mark occludes them. */}
          <SweepLines />
          <AnnotationProjector />
          <LabField quality={quality} />
          <WorkScene quality={quality} />
          <PageStructures quality={quality} />
          <FooterFloor />

          <WipeOverlay />

          <Effects mobile={mobile || reduced} />
        </Suspense>

        <AdaptiveDpr pixelated={false} />
        <AdaptiveEvents />
        <Preload all />
      </Canvas>
    </div>
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
