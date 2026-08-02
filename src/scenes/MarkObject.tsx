'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

import {
  BLAST,
  DECONSTRUCTION,
  HERO,
  MARK_AMBIENT,
  shotPresence,
  type ShotName,
} from '@/config/animation';
import { blastHandle } from '@/scenes/handles';
import { GLSL3, glsl } from '@/lib/glsl';
import { buildMark, buildPins, sampleMarkSurface } from '@/lib/mark/geometry';
import { MARK_SCALE, PINS } from '@/lib/mark/paths';
import {
  cloneMarkMaterial,
  createEdgeMaterial,
  createGhostMaterial,
  createMaterials,
} from '@/scenes/materials';
import dissolveFrag from '@/shaders/dissolve.frag';
import dissolveVert from '@/shaders/dissolve.vert';
import { sceneState } from '@/store/scene';

/**
 * THE INSTRUMENT — the signature object.
 *
 * One object, four states, morphed between rather than swapped:
 *
 *   assembled  every part at its stored transform; the DP ligature resolves
 *   exploded   parts translated along their own seating axes
 *   wireframe  edges + a fresnel ghost; solid crossfades out
 *   dissolved  area-weighted surface point cloud on a curl field
 *
 * The four are driven by a single `progress` ref the Deconstruction timeline
 * scrubs, so the whole thing is a pure function of scroll and can be run
 * backwards without drift.
 *
 * Assembled transforms are *stored on build*, never authored. Parts are offset
 * away from them to explode and lerp back — the cad-assembly rule. Authoring
 * exploded coordinates by hand is how you end up with parts driving through
 * each other the first time someone changes a depth.
 */

const PARTICLE_COUNT = 24000;

export interface MarkHandles {
  /** 0..1 through the Deconstruction master timeline. */
  progress: { value: number };
  /** Additional spin in radians, applied on top of the autonomous rotation. */
  spin: { value: number };
  /** Scroll-linked drift fed to the dissolve shader. */
  drift: { value: number };
  group: THREE.Group | null;
  /** World positions of each part, refreshed each frame for the leader lines. */
  anchors: THREE.Vector3[];
}

export function MarkObject({
  handles,
  quality,
}: {
  handles: React.MutableRefObject<MarkHandles>;
  quality: 'high' | 'low';
}) {
  const group = useRef<THREE.Group>(null!);
  const inner = useRef<THREE.Group>(null!);
  const partRefs = useRef<THREE.Mesh[]>([]);
  const edgeRefs = useRef<THREE.LineSegments[]>([]);
  const ghostRefs = useRef<THREE.Mesh[]>([]);
  const pinsRef = useRef<THREE.InstancedMesh>(null!);
  const pointsRef = useRef<THREE.Points>(null!);

  const parts = useMemo(() => buildMark(), []);
  const pins = useMemo(() => buildPins(), []);
  const materials = useMemo(() => createMaterials(), []);

  // Per-part clones so opacity can be crossfaded independently of the shared
  // base materials (which stay untouched and reusable).
  const solidMats = useMemo(
    () =>
      parts.map((p) => {
        const m = cloneMarkMaterial(materials[p.spec.material]);
        m.transparent = true;
        return m;
      }),
    [parts, materials],
  );

  const edgeMats = useMemo(() => parts.map(() => createEdgeMaterial()), [parts]);
  const ghostMats = useMemo(() => parts.map(() => createGhostMaterial()), [parts]);

  const edgeGeos = useMemo(
    () => parts.map((p) => new THREE.EdgesGeometry(p.geometry, 26)),
    [parts],
  );

  const pinMat = useMemo(() => {
    const m = materials.steel.clone();
    m.transparent = true;
    return m;
  }, [materials]);

  /** Stored assembled transforms — the only authored positions in the object. */
  const home = useMemo(
    () => parts.map(() => new THREE.Vector3(0, 0, 0)),
    [parts],
  );

  const explodeVecs = useMemo(
    () =>
      parts.map((p) =>
        new THREE.Vector3(...p.spec.explode)
          .normalize()
          .multiplyScalar(DECONSTRUCTION.explodeDistance * p.spec.explodeScale),
      ),
    [parts],
  );

  const pinExplode = useMemo(
    () =>
      new THREE.Vector3(...PINS.explode)
        .normalize()
        .multiplyScalar(DECONSTRUCTION.explodeDistance * PINS.explodeScale),
    [],
  );

  // ── Dissolve point cloud ──────────────────────────────────────────────────
  const count = quality === 'high' ? PARTICLE_COUNT : Math.floor(PARTICLE_COUNT * 0.34);

  const pointsGeo = useMemo(() => {
    const positions = sampleMarkSurface(count);
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) seeds[i] = Math.random() * 1000;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.setAttribute('aHome', new THREE.BufferAttribute(positions, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    g.computeBoundingSphere();
    return g;
  }, [count]);

  const pointsMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: glsl(dissolveVert),
        fragmentShader: glsl(dissolveFrag),
        glslVersion: GLSL3,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uDissolve: { value: 0 },
          uDrift: { value: 0 },
          uPointSize: { value: quality === 'high' ? 1.7 : 1.4 },
          uPixelRatio: { value: 1 },
          uScale: { value: 1 },
          uColor: { value: new THREE.Color('#8a8a85') },
          uAccent: { value: new THREE.Color('#ff5a1f') },
          uOpacity: { value: 0 },
        },
      }),
    [quality],
  );

  useEffect(() => {
    pointsMat.uniforms.uPixelRatio.value = Math.min(window.devicePixelRatio, 2);
  }, [pointsMat]);

  useEffect(() => {
    handles.current.group = group.current;
    handles.current.anchors = parts.map(() => new THREE.Vector3());
  }, [handles, parts]);

  useEffect(() => {
    const inst = pinsRef.current;
    if (!inst) return;
    pins.matrices.forEach((m, i) => inst.setMatrixAt(i, m));
    inst.instanceMatrix.needsUpdate = true;
  }, [pins]);

  useEffect(() => {
    return () => {
      edgeGeos.forEach((g) => g.dispose());
      pointsGeo.dispose();
      pointsMat.dispose();
      [...solidMats, ...edgeMats, ...ghostMats, pinMat].forEach((m) => m.dispose());
      Object.values(materials).forEach((m) => m.dispose());
    };
  }, [edgeGeos, pointsGeo, pointsMat, solidMats, edgeMats, ghostMats, pinMat, materials]);

  const tmp = useMemo(() => new THREE.Vector3(), []);
  const K = DECONSTRUCTION.keys;

  /**
   * Ambient-layer state. `restY` is the yaw the Deconstruction left behind, so
   * the drift oscillates around wherever the timeline actually parked rather
   * than snapping to some authored angle; `t0` is when the gate opened, so the
   * sines start at zero and the handoff is continuous.
   */
  const ambient = useRef({ fade: 0, restY: 0, t0: 0, latched: false });
  /** Damped solid opacity multiplier — see SHOTS.about.presence. */
  const presence = useRef(1);

  /**
   * Per-part blast vectors, derived once from each part's seating axis with a
   * deterministic jitter. Deterministic matters: a random direction per frame
   * would make the shatter shimmer, and a random direction per blast would
   * make repeat blasts feel arbitrary rather than mechanical.
   */
  const blastDirs = useMemo(
    () =>
      parts.map((p, i) => {
        const seed = (i * 2654435761) % 1000 / 1000;
        return new THREE.Vector3(...p.spec.explode)
          .normalize()
          .add(new THREE.Vector3(seed - 0.5, (seed * 7) % 1 - 0.5, (seed * 13) % 1 - 0.5).multiplyScalar(0.55))
          .normalize();
      }),
    [parts],
  );
  const blastSeeds = useMemo(
    () => parts.map((_, i) => ((i * 2654435761) % 997) / 997),
    [parts],
  );
  const blastSpin = useMemo(
    () => parts.map((_, i) => (((i * 7919) % 200) / 100 - 1) * 1.6),
    [parts],
  );

  useFrame((state, delta) => {
    const s = sceneState();

    const t = state.clock.elapsedTime;
    const p = handles.current.progress.value;
    const frozen = s.reducedMotion;

    // ── Autonomous motion ───────────────────────────────────────────────────
    // Sway plus a sine breath, both absolute functions of time rather than
    // accumulated. That matters: the Deconstruction writes rotation.y directly
    // from scroll, so an accumulating idle rotation would fight it and the
    // object would visibly jump at the handoff. Here the idle motion is simply
    // faded out as the scrub takes over.
    const scrubbing = p > 0.001;
    if (group.current) {
      const idle = 1 - Math.min(p * 4, 1);

      if (!scrubbing) {
        const sway = frozen
          ? 0
          : Math.sin((t / HERO.sway.period) * Math.PI * 2) *
            THREE.MathUtils.degToRad(HERO.sway.amplitude);
        group.current.rotation.y = sway * idle;
      }
      group.current.rotation.y += handles.current.spin.value;
      handles.current.spin.value = 0;

      const breath = frozen
        ? 0
        : Math.sin((t / HERO.breath.period) * Math.PI * 2) * HERO.breath.amplitude;
      group.current.position.y = breath * idle;
      group.current.position.x = 0;
      group.current.rotation.x = 0;
    }

    // ── Ambient layer, after the Deconstruction ─────────────────────────────
    // Gated on the timeline being FINISHED, not on it being at zero, which is
    // what the hero's `idle` uses. The two never overlap, so the hero's motion
    // is bit-for-bit what it was.
    const A = MARK_AMBIENT;
    const amb = ambient.current;
    const post = !frozen && p >= 0.9995;

    if (post && !amb.latched) {
      amb.latched = true;
      amb.restY = group.current ? group.current.rotation.y : 0;
      amb.t0 = t;
    } else if (!post) {
      amb.latched = false;
    }

    const dt = Math.min(delta, 0.05);
    amb.fade += ((post ? 1 : 0) - amb.fade) * (1 - Math.exp(-A.fadeRate * dt));

    if (group.current) {
      // While the gate is open the ambient layer owns the yaw and holds the
      // angle the scrub finished on. While it is closing, the Deconstruction's
      // spin tween is writing rotation.y again, so the residue is ADDED on top
      // and decays away rather than fighting it.
      if (post) group.current.rotation.y = amb.restY;

      if (amb.fade > 0.001) {
        const e = t - amb.t0;
        const wave = (period: number) => Math.sin((e / period) * Math.PI * 2);

        group.current.rotation.y +=
          amb.fade * THREE.MathUtils.degToRad(A.yaw.amplitude) * wave(A.yaw.period);
        group.current.rotation.x +=
          amb.fade * THREE.MathUtils.degToRad(A.pitch.amplitude) * wave(A.pitch.period);
        group.current.position.x += amb.fade * A.drift.x * wave(A.drift.periodX);
        group.current.position.y +=
          amb.fade *
          (A.drift.y * wave(A.drift.periodY) + A.breath.amplitude * wave(A.breath.period));
      }
    }

    // Per-shot presence. Damped rather than switched so arriving at About
    // fades the object back instead of dimming it on one frame.
    const goalPresence = frozen ? 1 : shotPresence(s.shot as ShotName);
    presence.current += (goalPresence - presence.current) * (1 - Math.exp(-2.6 * dt));

    // ── Blast ───────────────────────────────────────────────────────────────
    // Charging squeezes the assembly inward and the release throws it apart.
    // This rides on top of the scroll-driven explode rather than replacing it,
    // so detonating mid-Deconstruction does something coherent instead of
    // fighting the timeline.
    const blastAmt = frozen ? 0 : blastHandle.amount;
    const squeeze = frozen ? 0 : blastHandle.squeeze * 0.13;
    const tumble = frozen ? 0 : blastHandle.spin;

    // Ambient drift while the blast is HELD. Without it a long press freezes
    // into a still life and the whole thing stops reading as live simulation.
    // An absolute function of heldFor rather than an accumulation, so it cannot
    // desynchronise from the DOM side, which computes the same wobble.
    const drift = blastHandle.held
      ? Math.sin((blastHandle.heldFor / BLAST.drift.period) * Math.PI * 2) *
        BLAST.drift.amplitude *
        blastAmt
      : 0;

    // The hold. Each part is jittered independently and re-rolled
    // every frame, so the assembly reads as straining against itself rather
    // than as one object being waggled. Escalates hard toward the end — see
    // BLAST.shake.curve.
    const shake = frozen ? 0 : blastHandle.shake * BLAST.shake.mark;

    // ── State weights ───────────────────────────────────────────────────────
    const explodeAmt = seg(p, K.explode) - seg(p, K.assemble);
    const wireAmt = seg(p, K.wireframe) - seg(p, K.crystallise);
    const dissolveAmt = seg(p, K.dissolve) - seg(p, K.crystallise);

    const solidOpacity = (1 - Math.max(wireAmt, dissolveAmt)) * presence.current;
    const edgeOpacity = Math.min(wireAmt, 1 - dissolveAmt * 0.85);

    // ── Parts ───────────────────────────────────────────────────────────────
    for (let i = 0; i < parts.length; i++) {
      const mesh = partRefs.current[i];
      if (!mesh) continue;

      // Stagger: later parts leave later and arrive earlier, so the assembly
      // reads as one gesture rather than six.
      const lead = i * K.explode.stagger;
      const e = THREE.MathUtils.clamp(explodeAmt * (1 + lead * 2) - lead, 0, 1);
      const eased = e * e * (3 - 2 * e);

      tmp.copy(home[i]).addScaledVector(explodeVecs[i], eased);

      // Blast: each part flies along its own seating axis, same as the
      // scroll explode, but further and with a tumble. Reusing the stored
      // axis rather than a random direction is what keeps it looking like a
      // mechanism coming apart instead of confetti.
      if (blastAmt > 0.001 || squeeze > 0.001) {
        // Each part drifts on its own phase, seeded from its index, so a held
        // blast breathes unevenly instead of pulsing as one block.
        const phase = drift * (0.5 + blastSeeds[i]);
        const push = blastAmt * BLAST.markPush * (0.6 + blastSeeds[i] * 0.8) + phase;
        tmp.addScaledVector(blastDirs[i], push - squeeze);
        mesh.rotation.x = tumble * blastSpin[i] + drift * BLAST.drift.spin * blastSpin[i];
      } else if (mesh.rotation.x !== 0) {
        mesh.rotation.x = 0;
      }

      if (shake > 0) {
        tmp.x += (Math.random() - 0.5) * 2 * shake;
        tmp.y += (Math.random() - 0.5) * 2 * shake;
        tmp.z += (Math.random() - 0.5) * shake;
      }

      mesh.position.copy(tmp);
      mesh.rotation.z =
        eased * (i % 2 === 0 ? 0.14 : -0.11) +
        tumble * blastSpin[i] * 0.6 +
        (shake > 0 ? (Math.random() - 0.5) * 2 * blastHandle.shake * BLAST.shake.spin : 0);

      const m = solidMats[i];
      m.opacity = solidOpacity;
      m.visible = solidOpacity > 0.01;

      const edge = edgeRefs.current[i];
      if (edge) {
        edge.position.copy(tmp);
        edge.rotation.z = mesh.rotation.z;
        edgeMats[i].opacity = edgeOpacity;
        edge.visible = edgeOpacity > 0.01;
      }

      const ghost = ghostRefs.current[i];
      if (ghost) {
        ghost.position.copy(tmp);
        ghost.rotation.z = mesh.rotation.z;
        ghostMats[i].opacity = edgeOpacity * 0.42;
        ghost.visible = edgeOpacity > 0.01;
      }

      // Publish world anchors for the DOM leader lines.
      const anchor = handles.current.anchors[i];
      if (anchor) {
        anchor.copy(parts[i].anchor).add(tmp);
        mesh.parent!.localToWorld(anchor);
      }
    }

    // Pins ride out last and furthest — they are the loose hardware.
    if (pinsRef.current) {
      const e = THREE.MathUtils.clamp(explodeAmt * 1.35 - 0.25, 0, 1);
      pinsRef.current.position.copy(tmp.copy(pinExplode).multiplyScalar(e * e));
      pinMat.opacity = solidOpacity;
      pinsRef.current.visible = solidOpacity > 0.01;
    }

    // ── Dissolve ────────────────────────────────────────────────────────────
    const u = pointsMat.uniforms;
    u.uTime.value = frozen ? 0 : t;
    u.uDissolve.value = dissolveAmt;
    u.uDrift.value = handles.current.drift.value;
    u.uOpacity.value = Math.max(dissolveAmt, wireAmt * 0.22);
    if (pointsRef.current) pointsRef.current.visible = u.uOpacity.value > 0.01;
  });

  return (
    <group ref={group}>
      <group ref={inner}>
        {parts.map((part, i) => (
          <group key={part.spec.id}>
            <mesh
              ref={(el) => {
                if (el) partRefs.current[i] = el;
              }}
              geometry={part.geometry}
              material={solidMats[i]}
              castShadow={false}
              receiveShadow={false}
            />
            <mesh
              ref={(el) => {
                if (el) ghostRefs.current[i] = el;
              }}
              geometry={part.geometry}
              material={ghostMats[i]}
              visible={false}
            />
            <lineSegments
              ref={(el) => {
                if (el) edgeRefs.current[i] = el;
              }}
              geometry={edgeGeos[i]}
              material={edgeMats[i]}
              visible={false}
            />
          </group>
        ))}

        <instancedMesh
          ref={pinsRef}
          args={[pins.geometry, pinMat, pins.matrices.length]}
          frustumCulled={false}
        />

        <points ref={pointsRef} geometry={pointsGeo} material={pointsMat} frustumCulled={false} />
      </group>
    </group>
  );
}

/** Progress through one timeline segment, 0..1, with a smoothstep. */
function seg(p: number, k: { at: number; dur: number }): number {
  const x = THREE.MathUtils.clamp((p - k.at) / k.dur, 0, 1);
  return x * x * (3 - 2 * x);
}

export const MARK_UNIT = MARK_SCALE;
