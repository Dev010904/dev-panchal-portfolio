'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

import { BLAST, LAB, LAB_GPU as G, LAB_ORIGIN_Y } from '@/config/animation';
import { GLSL3, glsl } from '@/lib/glsl';
import {
  FullScreenPass,
  PingPong,
  probeCapability,
  type Capability,
} from '@/lib/gpgpu/PingPong';
import { textToPoints } from '@/lib/textPoints';
import renderFrag from '@/shaders/labGpu.frag';
import renderVert from '@/shaders/labGpu.vert';
import positionFrag from '@/shaders/sim/position.frag';
import velocityFrag from '@/shaders/sim/velocity.frag';
import { blastHandle, gpuFieldHandle } from '@/scenes/handles';
import { sceneState, useScene } from '@/store/scene';

/**
 * THE LAB, ON THE GPU.
 *
 * 250k-500k points advected through a divergence-free turbulent flow, with the
 * letterforms as an attractor the flow fights against, the cursor as a real
 * repulsion well leaving a dissipating wake, and a hold-to-detonate shockwave
 * that propagates THROUGH the field rather than displacing all of it at once.
 *
 * The CPU touches a particle exactly once, at seed time. After that the whole
 * simulation is two fullscreen fragment passes a frame and the main thread has
 * no idea the particles exist. That is the difference that makes 500k possible
 * where the old closed-form path topped out at 46k.
 *
 * ── WHAT HAPPENS IF THE DEVICE CANNOT DO THIS ─────────────────────────────
 *
 * `probeCapability` gates on `EXT_color_buffer_float`. Without it there is
 * nowhere for the simulation to write and the honest answer is the CPU path
 * that was already there — so this component renders nothing and `LabField`
 * stays mounted. Mobile takes the same route unconditionally.
 */
export function LabFieldGPU({ enabled }: { enabled: boolean }) {
  const gl = useThree((s) => s.gl);
  const group = useRef<THREE.Group>(null!);
  const pointsRef = useRef<THREE.Points>(null!);

  const [cap] = useState<Capability>(() => probeCapability(gl));
  const tier = enabled ? cap.tier : null;

  const opacity = useRef(0);
  const formation = useRef(0);
  const shockAge = useRef(-1);
  const lastEpoch = useRef(blastHandle.epoch);

  /** Scratch — the frame loop allocates nothing. */
  const pointerWorld = useMemo(() => new THREE.Vector3(), []);
  const shockOrigin = useMemo(() => new THREE.Vector3(), []);

  // ── Simulation buffers ──────────────────────────────────────────────────
  const sim = useMemo(() => {
    if (!tier) return null;

    const size = tier.size;
    const count = tier.count;

    // Home positions: the letterforms. Sampled once, on the CPU, and then
    // uploaded as a texture the simulation reads every step — never re-read
    // by JavaScript again.
    const home = textToPoints(LAB.text, count, { width: 1100, height: 260, scale: 4.2 });

    const homeData = new Float32Array(size * size * 4);
    const posData = new Float32Array(size * size * 4);
    const velData = new Float32Array(size * size * 4);

    for (let i = 0; i < count; i++) {
      const o = i * 4;
      homeData[o] = home[i * 3];
      homeData[o + 1] = home[i * 3 + 1];
      homeData[o + 2] = home[i * 3 + 2];
      homeData[o + 3] = 1;

      // Start as a loose slab rather than a sphere, so the resolve reads as
      // the field CONDENSING out of the room it already occupies instead of a
      // ball unfolding into text. Same reasoning as the CPU path it replaces.
      posData[o] = (Math.random() - 0.5) * 12;
      posData[o + 1] = (Math.random() - 0.5) * 6;
      posData[o + 2] = (Math.random() - 0.5) * 4;
      posData[o + 3] = 0;

      velData[o] = 0;
      velData[o + 1] = 0;
      velData[o + 2] = 0;
      velData[o + 3] = Math.random() * 1000;
    }

    const homeTex = new THREE.DataTexture(
      homeData as unknown as Float32Array<ArrayBuffer>,
      size,
      size,
      THREE.RGBAFormat,
      THREE.FloatType,
    );
    homeTex.minFilter = THREE.NearestFilter;
    homeTex.magFilter = THREE.NearestFilter;
    homeTex.needsUpdate = true;

    const position = new PingPong({ size, renderer: gl });
    const velocity = new PingPong({ size, renderer: gl });
    position.seed(posData);
    velocity.seed(velData);

    const resolution = new THREE.Vector2(size, size);

    const velocityPass = new FullScreenPass(glsl(velocityFrag), {
      uPosition: { value: null },
      uVelocity: { value: null },
      uHome: { value: homeTex },
      uResolution: { value: resolution },
      uDt: { value: 1 / 60 },
      uTime: { value: 0 },
      uFormation: { value: 0 },
      uNoiseScale: { value: G.flow.noiseScale },
      uNoiseSpeed: { value: G.flow.noiseSpeed },
      uFlowStrength: { value: G.flow.strength },
      uStiffness: { value: G.attractor.stiffness },
      uDamping: { value: G.damping },
      uMaxSpeed: { value: G.maxSpeed },
      uPointer: { value: new THREE.Vector3(0, 0, -999) },
      uPointerActive: { value: 0 },
      uRepelRadius: { value: G.cursor.radius },
      uRepelStrength: { value: G.cursor.strength },
      uShockOrigin: { value: new THREE.Vector3() },
      uShockAge: { value: -1 },
      uShockSpeed: { value: G.shock.speed },
      uShockWidth: { value: G.shock.width },
      uShockStrength: { value: G.shock.strength },
    });

    const positionPass = new FullScreenPass(glsl(positionFrag), {
      uPosition: { value: null },
      uVelocity: { value: null },
      uResolution: { value: resolution },
      uDt: { value: 1 / 60 },
      uPointer: { value: new THREE.Vector3(0, 0, -999) },
      uPointerActive: { value: 0 },
      uRepelRadius: { value: G.cursor.radius },
      uWakeDecay: { value: G.cursor.wakeDecay },
      uBounds: { value: G.bounds },
    });

    // One vertex per particle, carrying only its own texel coordinate.
    const refs = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
      refs[i * 2] = ((i % size) + 0.5) / size;
      refs[i * 2 + 1] = (Math.floor(i / size) + 0.5) / size;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('aRef', new THREE.BufferAttribute(refs, 2));
    // The positions live in a texture the CPU cannot see, so three has no way
    // to compute bounds. Given explicitly, and frustum culling left on: the
    // field is one draw call and culling it when the camera looks away is free.
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), G.bounds);

    return {
      size,
      count,
      position,
      velocity,
      homeTex,
      velocityPass,
      positionPass,
      geometry,
    };
  }, [tier, gl]);

  const renderUniforms = useMemo(
    () => ({
      uPosition: { value: null as THREE.Texture | null },
      uVelocity: { value: null as THREE.Texture | null },
      uPointSize: { value: G.pointSize },
      uPixelRatio: { value: 1 },
      uOpacity: { value: 0 },
      uColor: { value: new THREE.Color('#8a8a85') },
      uAccent: { value: new THREE.Color('#ff5a1f') },
      uSpeedScale: { value: G.speedScale },
    }),
    [],
  );

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: glsl(renderVert),
        fragmentShader: glsl(renderFrag),
        glslVersion: GLSL3,
        uniforms: renderUniforms,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [renderUniforms],
  );

  useEffect(() => {
    renderUniforms.uPixelRatio.value = Math.min(window.devicePixelRatio, 2);
  }, [renderUniforms]);

  // Publish for the telemetry HUD. The count is exact and fixed, which is the
  // whole reason the ladder has rungs instead of a formula.
  useEffect(() => {
    gpuFieldHandle.count = sim ? sim.count : 0;
    gpuFieldHandle.tier = tier ? tier.name : 'cpu';
    gpuFieldHandle.reason = cap.reason;
    return () => {
      gpuFieldHandle.count = 0;
      gpuFieldHandle.tier = 'cpu';
    };
  }, [sim, tier, cap.reason]);

  useEffect(
    () => () => {
      material.dispose();
      if (!sim) return;
      sim.position.dispose();
      sim.velocity.dispose();
      sim.homeTex.dispose();
      sim.velocityPass.dispose();
      sim.positionPass.dispose();
      sim.geometry.dispose();
    },
    [sim, material],
  );

  const active = useScene((s) => s.activeSection === 'LAB');

  useFrame((state, delta) => {
    if (!sim) return;
    const s = sceneState();
    const dt = Math.min(delta, 1 / 30);

    // ── Presence ────────────────────────────────────────────────────────────
    const goal = active ? 1 : 0;
    opacity.current += (goal - opacity.current) * (1 - Math.exp(-G.fadeRate * dt));
    formation.current += (goal - formation.current) * (1 - Math.exp(-G.fadeRate * 0.7 * dt));

    renderUniforms.uOpacity.value = opacity.current * (s.reducedMotion ? 0.7 : 1);
    if (pointsRef.current) pointsRef.current.visible = opacity.current > 0.004;

    // Off-screen the field is not stepped at all. It is the most expensive
    // thing on the page and nobody is looking at it.
    if (opacity.current <= 0.004) return;

    // ── The cursor, in the field's own space ────────────────────────────────
    // The pointer is a screen position; the field lives at LAB_ORIGIN_Y. This
    // maps one to the other through the camera rather than guessing a plane
    // scale, so the well stays under the cursor at any viewport.
    const pointerActive = !s.isMobile && !s.reducedMotion && active ? 1 : 0;
    if (pointerActive) {
      pointerWorld.set(s.pointer[0], s.pointer[1], 0.5).unproject(state.camera);
      pointerWorld.sub(state.camera.position).normalize();
      const t = (LAB_ORIGIN_Y - state.camera.position.y) / pointerWorld.y;
      pointerWorld.multiplyScalar(t).add(state.camera.position);
      // Into the group's local space — the group is translated to LAB_ORIGIN_Y.
      pointerWorld.y -= LAB_ORIGIN_Y;
    }

    // ── The detonation ──────────────────────────────────────────────────────
    // A new epoch means a fresh press. The shell restarts from the blast's own
    // origin rather than the field centre, so it propagates from where the
    // visitor actually pressed.
    if (blastHandle.epoch !== lastEpoch.current) {
      lastEpoch.current = blastHandle.epoch;
      shockAge.current = 0;
      shockOrigin.copy(pointerWorld);
    }
    if (shockAge.current >= 0) {
      shockAge.current += dt;
      if (shockAge.current > G.shock.life) shockAge.current = -1;
    }

    // ── Step ────────────────────────────────────────────────────────────────
    const vu = sim.velocityPass.material.uniforms;
    vu.uPosition.value = sim.position.current.texture;
    vu.uVelocity.value = sim.velocity.current.texture;
    vu.uDt.value = dt;
    vu.uTime.value = state.clock.elapsedTime;
    vu.uFormation.value = formation.current;
    vu.uPointer.value.copy(pointerWorld);
    vu.uPointerActive.value = pointerActive;
    vu.uShockOrigin.value.copy(shockOrigin);
    vu.uShockAge.value = shockAge.current;
    vu.uShockStrength.value = G.shock.strength * (1 + blastHandle.amount * BLAST.lab.strength * 0.02);
    sim.velocityPass.renderTo(gl, sim.velocity.next);
    sim.velocity.swap();

    const pu = sim.positionPass.material.uniforms;
    pu.uPosition.value = sim.position.current.texture;
    // The velocity JUST written — this is what makes the integration
    // semi-implicit rather than explicit. See position.frag.
    pu.uVelocity.value = sim.velocity.current.texture;
    pu.uDt.value = dt;
    pu.uPointer.value.copy(pointerWorld);
    pu.uPointerActive.value = pointerActive;
    sim.positionPass.renderTo(gl, sim.position.next);
    sim.position.swap();

    renderUniforms.uPosition.value = sim.position.current.texture;
    renderUniforms.uVelocity.value = sim.velocity.current.texture;
    if (process.env.NODE_ENV !== 'production') {
      gpuFieldHandle.positionTarget = sim.position.current;
    }
  });

  if (!sim) return null;

  return (
    <group ref={group} position={[0, LAB_ORIGIN_Y, 0]}>
      <points ref={pointsRef} geometry={sim.geometry} material={material} visible={false} />
    </group>
  );
}
