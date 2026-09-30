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
   * THE STEP COUNT IS DECIDED ON THE VISITOR'S MACHINE, NOT HERE.
   *
   * An Intel Iris Xe and an M3 are two orders of magnitude apart on a
   * raymarch, and the first attempt at sizing this layer by reasoning hung the
   * browser outright. So the layer boots on the LOW rung and the quality
   * governor (QualityGovernor.tsx) moves it from measured GPU time. Booting at
   * 48 steps is how the browser got hung.
   *
   * This component used to calibrate itself from frame deltas, against an 11ms
   * budget. A 60Hz display cannot deliver a delta under 16.7ms, so every 60Hz
   * machine demoted itself to the floor rung whatever its GPU could do — a
   * vsync-capped number cannot show headroom. Measured on an Iris Xe, the
   * rungs cost 6.3ms (14), 9.5ms (24) and 17.2ms (48) of GPU time.
   */
  useEffect(() => {
    if (mobile) {
      volumetricHandle.steps = 0;
      return;
    }
    initLightDepth();
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
