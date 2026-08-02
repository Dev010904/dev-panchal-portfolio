'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

import { BLAST, LAB, LAB_ORIGIN_Y, MOBILE } from '@/config/animation';
import { blastHandle } from '@/scenes/handles';
import { GLSL3, glsl } from '@/lib/glsl';
import { textToPoints } from '@/lib/textPoints';
import frag from '@/shaders/labField.frag';
import vert from '@/shaders/labField.vert';
import { sceneState, useScene } from '@/store/scene';

const SAMPLES = 16;
const SHOCKS = LAB.shock.maxConcurrent;

/**
 * THE LAB.
 *
 * A field of points that resolves into DEV PANCHAL, scatters under the cursor,
 * and magnetically reassembles. See labField.vert for why the physics is
 * closed-form rather than a GPGPU ping-pong — the short version is that a
 * stateless field cannot drift, can be scrubbed, and holds 60fps on integrated
 * graphics, which a two-target simulation at this count does not.
 *
 * Interaction is registered on a transparent plane rather than on the points
 * themselves. Raycasting 46k points every pointer move is the single easiest
 * way to destroy the frame budget of a section whose entire job is to feel
 * instant.
 */
export function LabField({ quality }: { quality: 'high' | 'low' }) {
  const group = useRef<THREE.Group>(null!);
  const points = useRef<THREE.Points>(null!);
  const { camera } = useThree();

  const isMobile = quality === 'low';
  const count = isMobile
    ? Math.floor(LAB.count.desktop * MOBILE.particleScale)
    : LAB.count.desktop;

  const active = useScene((s) => s.activeSection === 'LAB');

  // ── Geometry ──────────────────────────────────────────────────────────────
  const geometry = useMemo(() => {
    const home = textToPoints(LAB.text, count, { width: 1100, height: 260, scale: 4.2 });

    const cloud = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      // Start as a slab rather than a sphere: the resolve then reads as the
      // field *condensing* out of the room it is already in, not as a ball
      // unfolding into text.
      cloud[i * 3 + 0] = (Math.random() - 0.5) * 11;
      cloud[i * 3 + 1] = (Math.random() - 0.5) * 5.5;
      cloud[i * 3 + 2] = (Math.random() - 0.5) * 3.4;
      seeds[i] = Math.random() * 1000;
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(home, 3));
    g.setAttribute('aHome', new THREE.BufferAttribute(home, 3));
    g.setAttribute('aCloud', new THREE.BufferAttribute(cloud, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 9);
    return g;
  }, [count]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uFormation: { value: 0 },
      uSamples: { value: Array.from({ length: SAMPLES }, () => new THREE.Vector3(0, 0, -1)) },
      uScatterRadius: { value: LAB.scatter.radius },
      uScatterStrength: { value: LAB.scatter.strength },
      uFalloff: { value: LAB.scatter.falloff },
      uStiffness: { value: LAB.reform.stiffness },
      uDamping: { value: LAB.reform.damping },
      uShocks: { value: Array.from({ length: SHOCKS }, () => new THREE.Vector4(0, 0, -1, 0)) },
      uShockSpeed: { value: LAB.shock.speed },
      uShockWidth: { value: LAB.shock.width },
      uShockLife: { value: LAB.shock.life },
      uBlast: { value: 0 },
      uBlastStrength: { value: BLAST.lab.strength },
      uBlastDrift: { value: BLAST.lab.drift },
      uHeldFor: { value: 0 },
      uShake: { value: 0 },
      uShakeStrength: { value: BLAST.shake.lab },
      uPointSize: { value: isMobile ? LAB.pointSize.mobile : LAB.pointSize.desktop },
      uPixelRatio: { value: 1 },
      uFrozen: { value: 0 },
      uColor: { value: new THREE.Color('#8a8a85') },
      uAccent: { value: new THREE.Color('#ff5a1f') },
      uOpacity: { value: 0 },
    }),
    [isMobile],
  );

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: glsl(vert),
        fragmentShader: glsl(frag),
        glslVersion: GLSL3,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms,
      }),
    [uniforms],
  );

  useEffect(() => {
    uniforms.uPixelRatio.value = Math.min(window.devicePixelRatio, isMobile ? 1.75 : 2);
  }, [uniforms, isMobile]);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  // ── Interaction state ─────────────────────────────────────────────────────
  const shockSlot = useRef(0);
  const sampleSlot = useRef(0);
  const holdStart = useRef(0);
  const lastLocal = useRef(new THREE.Vector3(0, 0, -999));
  const opacity = useRef(0);
  const formation = useRef(0);

  // The field lives on world z = 0; the group is only offset in Y. So the
  // pointer is projected onto that plane once and shifted into local space.
  // All objects are preallocated — this runs every frame.
  const pick = useMemo(
    () => ({
      plane: new THREE.Plane(new THREE.Vector3(0, 0, 1), 0),
      ray: new THREE.Raycaster(),
      world: new THREE.Vector3(),
      local: new THREE.Vector3(),
      ndc: new THREE.Vector2(),
    }),
    [],
  );

  /** Pointer -> the Lab's local plane. Returns null if the ray misses. */
  const project = (): THREE.Vector3 | null => {
    const s = sceneState();
    pick.ndc.set(s.pointer[0], s.pointer[1]);
    pick.ray.setFromCamera(pick.ndc, camera);
    if (!pick.ray.ray.intersectPlane(pick.plane, pick.world)) return null;
    return pick.local.set(pick.world.x, pick.world.y - LAB_ORIGIN_Y, 0);
  };

  const pushShock = (local: THREE.Vector3, strength: number) => {
    const arr = uniforms.uShocks.value as THREE.Vector4[];
    arr[shockSlot.current].set(local.x, local.y, uniforms.uTime.value, strength);
    shockSlot.current = (shockSlot.current + 1) % SHOCKS;
  };

  // ── Pointer events ────────────────────────────────────────────────────────
  /**
   * A short press is a shockwave; a long press is a detonation, and there is no
   * timer deciding which. The detonation is `blastHandle.amount`, which starts
   * ramping on the pointerdown frame, so a quick click also fires a small one
   * that never gets far before it recovers — which is exactly right, and is
   * what the old 1000ms setTimeout could not express.
   */
  useEffect(() => {
    if (!active) return;

    const onDown = () => {
      holdStart.current = performance.now();
    };

    const onUp = () => {
      // Only a genuinely short press earns a discrete ring; past that the
      // detonation is the reaction and a ring on top of it is just noise.
      if (performance.now() - holdStart.current > 220) return;
      const local = project();
      if (local) pushShock(local, LAB.shock.strength);
    };

    window.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, uniforms]);

  useFrame((state, delta) => {
    const s = sceneState();

    const dt = Math.min(delta, 0.05);
    uniforms.uTime.value = state.clock.elapsedTime;
    uniforms.uFrozen.value = s.reducedMotion ? 1 : 0;

    // Fade + resolve when the section is in view.
    const goal = active ? 1 : 0;
    opacity.current += (goal - opacity.current) * (1 - Math.exp(-3.4 * dt));
    formation.current += (goal - formation.current) * (1 - Math.exp(-2.1 * dt));

    uniforms.uOpacity.value = opacity.current;
    uniforms.uFormation.value = s.reducedMotion ? goal : formation.current;

    if (points.current) points.current.visible = opacity.current > 0.005;
    if (opacity.current < 0.005 || s.reducedMotion) return;

    // Push a pointer sample only on real movement — a stationary cursor should
    // let its wake relax, not keep re-injecting the same impulse.
    const local = project();
    if (local && local.distanceTo(lastLocal.current) > 0.012) {
      const arr = uniforms.uSamples.value as THREE.Vector3[];
      arr[sampleSlot.current].set(local.x, local.y, uniforms.uTime.value);
      sampleSlot.current = (sampleSlot.current + 1) % SAMPLES;
      lastLocal.current.copy(local);
    }

    // The held detonation. Read straight off the shared handle so the field and
    // the mark are driven by one playhead and cannot disagree about the state.
    uniforms.uBlast.value = blastHandle.amount;
    uniforms.uHeldFor.value = blastHandle.heldFor;
    uniforms.uShake.value = blastHandle.shake;
  });

  return (
    <group ref={group} position={[0, LAB_ORIGIN_Y, 0]}>
      <points ref={points} geometry={geometry} material={material} frustumCulled={false} />
    </group>
  );
}
