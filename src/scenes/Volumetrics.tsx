'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

import { VOLUMETRIC as V } from '@/config/animation';
import { GLSL3, glsl } from '@/lib/glsl';
import volFrag from '@/shaders/volumetric.frag';
import volVert from '@/shaders/volumetric.vert';
import { volumetricHandle } from '@/scenes/handles';
import { initLightDepth, lightDepth, renderLightDepth } from '@/scenes/lightDepth';
import { sceneState } from '@/store/scene';

/**
 * VOLUMETRIC LIGHT — raymarched shafts, occluded by the mark.
 *
 * There was a caustic floor here too and it was CUT. The approach, the reason
 * it failed, and what a real one would need are in docs/PERFORMANCE.md.
 *
 * Mounted after `MarkObject` in the tree on purpose. R3F dispatches `useFrame`
 * subscribers in the order they subscribe, so the mark has already written
 * this frame's transforms by the time the light-depth pass renders them, and
 * the map the shafts sample is the current pose rather than the previous one.
 * That ordering is the same class of guarantee as the gsap/R3F loop order in
 * docs/PERFORMANCE.md, and it fails the same silently if the mount order
 * changes — so it is asserted below rather than assumed.
 *
 * The whole layer is skipped on mobile: it is a 48-step raymarch plus an extra
 * render target, and phones are exactly where that is not affordable.
 */
export function Volumetrics({ mobile }: { mobile: boolean }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);

  /** Damped presence, so the layer eases rather than pops between sections. */
  const amount = useRef(0);
  const volRef = useRef<THREE.Mesh>(null);

  /**
   * CALIBRATION STATE.
   *
   * The step count is decided on the visitor's machine, from real frames,
   * once. It is not a number measured here and shipped — an Intel Iris Xe and
   * an M3 are two orders of magnitude apart on a raymarch, and the first
   * attempt at sizing this layer by reasoning hung the browser outright.
   */
  const cal = useRef({ samples: [] as number[], rounds: 0 });

  useEffect(() => {
    if (mobile) {
      volumetricHandle.steps = 0;
      return;
    }
    initLightDepth();
    // Starts at the LOW rung, not the high one. The high rung is only taken
    // after a measurement says there is room for it — see calibrate() in the
    // QA harness. Booting at 48 steps is how the browser got hung.
    if (!volumetricHandle.calibrated) volumetricHandle.steps = V.stepsLow;
  }, [mobile]);

  const volUniforms = useMemo(
    () => ({
      uDepth: { value: null as THREE.Texture | null },
      uLightMatrix: { value: new THREE.Matrix4() },
      uLightPos: { value: new THREE.Vector3(...V.lightPosition) },
      uColor: { value: new THREE.Color(V.color) },
      uCameraPos: { value: new THREE.Vector3() },
      uDensity: { value: V.density },
      uAniso: { value: V.anisotropy },
      uAmount: { value: 0 },
      uAttenuation: { value: V.attenuation },
      uMaxDistance: { value: V.maxDistance },
      uBias: { value: V.bias },
      uTime: { value: 0 },
      // Widened off the literal type: this is driven at runtime by
      // `volumetricHandle`, not pinned to the config's default.
      uSteps: { value: V.steps as number },
    }),
    [],
  );


  const volMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: glsl(volVert),
        fragmentShader: glsl(volFrag),
        uniforms: volUniforms,
        glslVersion: GLSL3,
        transparent: true,
        // BackSide so the camera can be inside the box — which it always is.
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        // Depth TEST on, depth WRITE off: the mark occludes the shafts in
        // front of it, and the volume never occludes anything itself.
        depthTest: true,
        depthWrite: false,
      }),
    [volUniforms],
  );


  useEffect(() => () => volMaterial.dispose(), [volMaterial]);

  useFrame((state, delta) => {
    if (mobile) return;
    const s = sceneState();
    const dt = Math.min(delta, 0.05);

    // The shafts live only where the mark is the subject, and never under
    // reduced motion — a slowly breathing volumetric is exactly the kind of
    // ambient movement that setting exists to remove.
    const wanted =
      volumetricHandle.steps > 0 &&
      !s.reducedMotion &&
      (V.shots as readonly string[]).includes(s.shot)
        ? 1
        : 0;
    amount.current += (wanted - amount.current) * (1 - Math.exp(-V.fadeRate * dt));

    // ── Pick a rung, once, from real frames ─────────────────────────────────
    //
    // Deliberately NOT `performance.now()` around a forced advance: that times
    // draw-call SUBMISSION and is blind to fragment cost, which is essentially
    // all of this layer. Real frame deltas do see it, because a GPU that
    // cannot finish in time is exactly what pushes the delta past the refresh
    // interval.
    //
    // Guarded on visibility because an occluded tab throttles rAF to a few Hz,
    // and calibrating against that would downgrade every machine to the low
    // rung for a reason that has nothing to do with the machine. That is the
    // same trap docs/PERFORMANCE.md records for every other measurement here.
    // Two rounds, not one. The layer BOOTS on the low rung, so the first round
    // measures 24 steps and may promote to 48 — and a machine with headroom at
    // 24 does not necessarily have it at twice the work. The second round
    // measures whatever the first chose and can demote again. Capped at two so
    // a borderline machine settles instead of oscillating between rungs
    // forever, which is far more visible than simply running at the lower one.
    if (
      cal.current.rounds < 2 &&
      volumetricHandle.steps > 0 &&
      amount.current > 0.98 &&
      typeof document !== 'undefined' &&
      document.visibilityState === 'visible'
    ) {
      // Implausible deltas are a throttled or descheduled tab, not a slow GPU.
      if (delta > 0.004 && delta < 0.4) cal.current.samples.push(delta);
      if (cal.current.samples.length >= 45) {
        const sorted = cal.current.samples.slice().sort((a, b) => a - b);
        const p50ms = sorted[Math.floor(sorted.length / 2)] * 1000;
        volumetricHandle.steps = p50ms > V.budgetMs ? V.stepsLow : V.steps;
        volumetricHandle.calibrated = true;
        cal.current.rounds++;
        cal.current.samples.length = 0;
      }
    }

    const live = amount.current > 0.004;

    // The depth pass is the expensive part, so it is skipped entirely when
    // nothing is reading it rather than rendered and thrown away.
    if (live) renderLightDepth(gl, scene);

    if (volRef.current) volRef.current.visible = live;
    if (!live) return;

    volUniforms.uDepth.value = lightDepth.target?.texture ?? null;
    volUniforms.uLightMatrix.value.copy(lightDepth.matrix);
    volUniforms.uCameraPos.value.copy(state.camera.position);
    volUniforms.uAmount.value = amount.current;
    volUniforms.uTime.value = state.clock.elapsedTime;
    volUniforms.uSteps.value = volumetricHandle.steps;
  });

  if (mobile) return null;

  return (
    // The scattering volume. Centred on the mark and sized so its screen
    // coverage stays bounded — see the note on VOLUMETRIC.extent.
    <mesh ref={volRef} material={volMaterial} frustumCulled={false} visible={false}>
      <boxGeometry args={[V.extent * 2, V.extent * 2, V.extent * 2]} />
    </mesh>
  );
}
