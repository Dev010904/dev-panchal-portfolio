'use client';

import { ScreenQuad } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

import { TRANSITION } from '@/config/animation';
import { GLSL3, glsl } from '@/lib/glsl';
import frag from '@/shaders/wipe.frag';
import vert from '@/shaders/fullscreen.vert';
import { wipeHandle } from '@/scenes/handles';
import { sceneState } from '@/store/scene';

/**
 * The section-change wipe. Rendered last in the scene, above everything,
 * depth-test off — but *inside* the canvas rather than as a DOM element, so it
 * goes through the same grain and vignette as the rest of the frame and does
 * not read as a separate layer sliding over the top.
 */
export function WipeOverlay() {
  const mesh = useRef<THREE.Mesh>(null!);

  const uniforms = useMemo(
    () => ({
      uProgress: { value: 0 },
      uEdgeNoise: { value: TRANSITION.edgeNoise },
      uEdgeWidth: { value: TRANSITION.edgeWidth },
      uAberration: { value: TRANSITION.aberration },
      uTime: { value: 0 },
      uColor: { value: new THREE.Color('#08080a') },
      uAccent: { value: new THREE.Color('#ff5a1f') },
    }),
    [],
  );

  useFrame((state) => {
    const s = sceneState();
    uniforms.uTime.value = state.clock.elapsedTime;
    uniforms.uProgress.value = wipeHandle.value;
    if (mesh.current) mesh.current.visible = wipeHandle.active && !s.reducedMotion;
  });

  return (
    <ScreenQuad ref={mesh} renderOrder={1000} visible={false}>
      <shaderMaterial
        vertexShader={glsl(vert)}
        fragmentShader={glsl(frag)}
        uniforms={uniforms}
        glslVersion={GLSL3}
        transparent
        depthTest={false}
        depthWrite={false}
      />
    </ScreenQuad>
  );
}
