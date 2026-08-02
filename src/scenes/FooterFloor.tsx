'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

import { FOOTER } from '@/config/animation';
import { GLSL3, glsl } from '@/lib/glsl';
import frag from '@/shaders/footerGrid.frag';
import vert from '@/shaders/fullscreen.vert';
import { FullscreenPass } from '@/scenes/FullscreenPass';
import { sceneState, useScene } from '@/store/scene';

/**
 * THE FOOTER FIELD.
 *
 * Rendered as a screen-space pass rather than as a real ground plane. That is
 * not a shortcut: a genuine plane would need to be positioned, lit and
 * depth-sorted against whatever region of the world the camera happens to be
 * in, and the footer has to look identical on every page. A pass is the same
 * everywhere and costs one draw call.
 *
 * See footerGrid.frag for what it actually draws and why it is irregular.
 */
export function FooterFloor() {
  const { size } = useThree();
  const mesh = useRef<THREE.Mesh>(null);

  const active = useScene((s) => s.footerNear);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uRes: { value: new THREE.Vector2(1, 1) },
      uPointer: { value: new THREE.Vector2(0.5, 0.1) },
      uPresence: { value: 0 },
      uHover: { value: 0 },
      uColumns: { value: FOOTER.columns },
      uRows: { value: new THREE.Vector2(...FOOTER.rows) },
      uDashes: { value: new THREE.Vector2(...FOOTER.dashes) },
      uDuty: { value: new THREE.Vector2(...FOOTER.duty) },
      uOpacity: { value: FOOTER.opacity },
      uHazeScale: { value: FOOTER.haze.scale },
      uHazeSpeed: { value: FOOTER.haze.speed },
      uHazeStrength: { value: FOOTER.haze.strength },
      uCloudScale: { value: FOOTER.cloud.scale },
      uCloudSpeed: { value: FOOTER.cloud.speed },
      uCloudStrength: { value: FOOTER.cloud.strength },
      uBreath: { value: 0 },
      uCursorRadius: { value: FOOTER.cursor.radius },
      uCursorDisplace: { value: FOOTER.cursor.displace },
      uColor: { value: new THREE.Color('#8a8a85') },
    }),
    [],
  );

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: glsl(vert),
        fragmentShader: glsl(frag),
        uniforms,
        // GLSL3 is mandatory, not stylistic. The rules are antialiased with
        // fwidth, which under three's default ESSL1 fails to compile silently
        // and leaves the whole pass blank with no error anywhere.
        glslVersion: GLSL3,
        transparent: true,
        depthTest: false,
        depthWrite: false,
      }),
    [uniforms],
  );

  useEffect(() => () => material.dispose(), [material]);

  useEffect(() => {
    uniforms.uRes.value.set(size.width, size.height);
  }, [size, uniforms]);

  const presence = useRef(0);
  const hover = useRef(0);
  const smoothed = useRef(new THREE.Vector2(0.5, 0.1));

  useFrame((state, delta) => {
    const s = sceneState();
    const dt = Math.min(delta, 0.05);

    uniforms.uTime.value = state.clock.elapsedTime;

    const goal = active ? 1 : 0;
    presence.current += (goal - presence.current) * (1 - Math.exp(-3 * dt));
    uniforms.uPresence.value = presence.current;

    if (mesh.current) mesh.current.visible = presence.current > 0.005;
    if (presence.current < 0.005) return;

    if (s.reducedMotion) {
      uniforms.uHover.value = 0;
      uniforms.uBreath.value = 0;
      return;
    }

    // Two slow sines with an irrational period ratio. Computed here rather than
    // in the shader so it is one value per frame instead of per fragment, and
    // so reduced motion can hold it flat.
    const t = uniforms.uTime.value;
    uniforms.uBreath.value =
      (Math.sin((t / FOOTER.breath.periodA) * Math.PI * 2) * 0.6 +
        Math.sin((t / FOOTER.breath.periodB) * Math.PI * 2) * 0.4) *
      FOOTER.breath.amount;

    // The influence point trails the cursor. Smoothing on the CPU rather than
    // in the shader keeps it frame-rate independent and costs nothing.
    const [u, v] = s.pointerUv;
    const k = 1 - Math.exp(-FOOTER.followRate * dt);
    smoothed.current.x += (u - smoothed.current.x) * k;
    smoothed.current.y += (v - smoothed.current.y) * k;
    uniforms.uPointer.value.copy(smoothed.current);

    // Only react when the cursor is actually low on the screen. The field is
    // the floor, so rules bending around a cursor up in the headline would
    // give away that it is a flat pass.
    const near = 1 - THREE.MathUtils.clamp((v - FOOTER.reachTop) / FOOTER.reachFade, 0, 1);
    hover.current += (near - hover.current) * (1 - Math.exp(-5 * dt));
    uniforms.uHover.value = hover.current;
  });

  return (
    <FullscreenPass ref={mesh} renderOrder={-90} visible={false}>
      <primitive object={material} attach="material" />
    </FullscreenPass>
  );
}
