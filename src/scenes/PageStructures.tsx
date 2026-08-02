'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

import { ARCHIVE, PAGE_ORIGIN } from '@/config/animation';
import { credentials } from '@/data/credentials';
import {
  buildArchive,
  buildHelix,
  buildLattice,
  buildStack,
  type StructureId,
} from '@/lib/structures';
import { createMaterials, createSeamMaterial } from '@/scenes/materials';
import { archiveHandle } from '@/scenes/handles';
import { sceneState, useScene } from '@/store/scene';

/** The one anodised seam's colour — the site's single accent. */
const ARCHIVE_ACCENT = '#ff5a1f';

/**
 * The interior pages' 3D structures.
 *
 * Each lives at its own coordinates in the same persistent scene, so moving
 * between pages is a camera flight rather than a scene teardown. That is the
 * reason a route change never produces a white flash or a re-initialised WebGL
 * context — there is nothing to tear down.
 *
 * Geometry is built lazily on first visit and then kept. A visitor who never
 * opens /process never pays for the lattice.
 */
export function PageStructures({ quality }: { quality: 'high' | 'low' }) {
  const structure = useScene((s) => s.structure);

  return (
    <>
      {structure === 'lattice' && <Lattice quality={quality} />}
      {structure === 'stack' && <Stack />}
      {structure === 'helix' && <Helix quality={quality} />}
      {structure === 'archive' && <Archive />}
    </>
  );
}

/** Shared idle motion + blast reaction for every interior structure. */
function useStructureMotion(
  id: StructureId,
  group: React.RefObject<THREE.Group | null>,
  spin: [number, number],
) {
  const fade = useRef(0);

  useFrame((state, delta) => {
    const s = sceneState();
    const dt = Math.min(delta, 0.05);
    const t = state.clock.elapsedTime;
    const g = group.current;
    if (!g) return;

    const goal = s.structure === id ? 1 : 0;
    fade.current += (goal - fade.current) * (1 - Math.exp(-3.2 * dt));
    g.visible = fade.current > 0.01;

    if (!s.reducedMotion) {
      g.rotation.y = t * spin[0];
      g.rotation.x = Math.sin(t * spin[1]) * 0.16;
    }

    // No blast reaction here on purpose. Hold-to-blast belongs to the hero and
    // the Lab and nowhere else; an interior page that jumps because you pressed
    // the mouse while reading is not an easter egg.
    g.scale.setScalar(Math.max(fade.current, 0.001));
  });
}

/* ── Lattice ──────────────────────────────────────────────────────────────── */

function Lattice({ quality }: { quality: 'high' | 'low' }) {
  const group = useRef<THREE.Group>(null);
  const inst = useRef<THREE.InstancedMesh>(null);
  const built = useMemo(() => buildLattice(quality === 'high' ? 9 : 7), [quality]);
  const materials = useMemo(() => createMaterials(), []);

  useEffect(() => {
    const mesh = inst.current;
    if (!mesh) return;
    built.matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.instanceMatrix.needsUpdate = true;
  }, [built]);

  useEffect(
    () => () => {
      built.geometry.dispose();
      Object.values(materials).forEach((m) => m.dispose());
    },
    [built, materials],
  );

  useStructureMotion('lattice', group, [0.13, 0.21]);

  return (
    <group ref={group} position={PAGE_ORIGIN.lattice}>
      <instancedMesh
        ref={inst}
        args={[built.geometry, materials.graphite, built.matrices.length]}
        frustumCulled={false}
      />
    </group>
  );
}

/* ── Stack ────────────────────────────────────────────────────────────────── */

function Stack() {
  const group = useRef<THREE.Group>(null);
  const inst = useRef<THREE.InstancedMesh>(null);
  const built = useMemo(() => buildStack(14), []);
  const materials = useMemo(() => createMaterials(), []);

  useEffect(() => {
    const mesh = inst.current;
    if (!mesh) return;
    built.matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.instanceMatrix.needsUpdate = true;
  }, [built]);

  useEffect(
    () => () => {
      built.geometry.dispose();
      Object.values(materials).forEach((m) => m.dispose());
    },
    [built, materials],
  );

  useStructureMotion('stack', group, [0.17, 0.26]);

  return (
    <group ref={group} position={PAGE_ORIGIN.stack}>
      <instancedMesh
        ref={inst}
        args={[built.geometry, materials.graphite, built.matrices.length]}
        frustumCulled={false}
      />
      {/* One anodised plate through the middle — the same single-accent rule
          the mark follows. */}
      <mesh material={materials.ember} rotation={[Math.PI / 2, 0, 0.62]}>
        <torusGeometry args={[0.86, 0.012, 6, 96]} />
      </mesh>
    </group>
  );
}

/* ── Helix ────────────────────────────────────────────────────────────────── */

function Helix({ quality }: { quality: 'high' | 'low' }) {
  const group = useRef<THREE.Group>(null);
  const rungs = useRef<THREE.InstancedMesh>(null);
  const built = useMemo(() => buildHelix(quality === 'high' ? 3.2 : 2.4), [quality]);
  const materials = useMemo(() => createMaterials(), []);

  useEffect(() => {
    const mesh = rungs.current;
    if (!mesh) return;
    built.rungs.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.instanceMatrix.needsUpdate = true;
  }, [built]);

  useEffect(
    () => () => {
      built.strands.forEach((g) => g.dispose());
      built.rungGeometry.dispose();
      Object.values(materials).forEach((m) => m.dispose());
    },
    [built, materials],
  );

  useStructureMotion('helix', group, [0.22, 0.18]);

  return (
    <group ref={group} position={PAGE_ORIGIN.helix}>
      {built.strands.map((g, i) => (
        <mesh
          key={i}
          geometry={g}
          material={i === 0 ? materials.graphite : materials.steel}
          frustumCulled={false}
        />
      ))}
      <instancedMesh
        ref={rungs}
        args={[built.rungGeometry, materials.steel, built.rungs.length]}
        frustumCulled={false}
      />
      {/* The single anodised element — a collar at the waist, where the coil
          is widest. One accent, same rule as the mark. */}
      <mesh material={materials.ember} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.78, 0.009, 6, 96]} />
      </mesh>
    </group>
  );
}

/* ── Archive ──────────────────────────────────────────────────────────────── */

/**
 * /credentials — one plate per credential, fanned around a shared spine.
 *
 * Three things are going on every frame, and they are deliberately separate:
 *
 *   - `useStructureMotion` turns the whole group, as it does for the other
 *     three structures.
 *   - The fan breathes, and the page scroll adds a second, larger spread and
 *     yaw on top. That is what ties the register you are reading to the object
 *     behind it: scrolling the list turns the archive.
 *   - Each plate's seam brightens when its row is hovered, and the plate splays
 *     a little out of the stack — the 3D answer to the ember rule the DOM rows
 *     already sweep along their top edge.
 *
 * Eleven plates is eleven matrices and eleven colours per frame, which is
 * nothing; it buys per-plate response that a baked instance buffer cannot give.
 */
function Archive() {
  const group = useRef<THREE.Group>(null);
  const plates = useRef<THREE.InstancedMesh>(null);
  const seams = useRef<THREE.InstancedMesh>(null);

  const built = useMemo(() => buildArchive(credentials.length), []);
  const materials = useMemo(() => createMaterials(), []);
  const seamMaterial = useMemo(() => createSeamMaterial(), []);

  /** Reused per frame — composing eleven matrices must not allocate. */
  const scratch = useMemo(
    () => ({
      m: new THREE.Matrix4(),
      q: new THREE.Quaternion(),
      e: new THREE.Euler(),
      pos: new THREE.Vector3(),
      scale: new THREE.Vector3(),
      colour: new THREE.Color(),
      cool: new THREE.Color('#c4d2e6'),
      ember: new THREE.Color(ARCHIVE_ACCENT),
      /** Per-plate hover weight, damped so the lift is not a switch. */
      lift: new Float32Array(built.plates.length),
      scrollFan: 0,
      scrollYaw: 0,
    }),
    [built],
  );

  useEffect(
    () => () => {
      built.plateGeometry.dispose();
      built.seamGeometry.dispose();
      built.spineGeometry.dispose();
      Object.values(materials).forEach((m) => m.dispose());
      seamMaterial.dispose();
    },
    [built, materials, seamMaterial],
  );

  useFrame((state, delta) => {
    const s = sceneState();
    const dt = Math.min(delta, 0.05);
    const t = state.clock.elapsedTime;
    const plateMesh = plates.current;
    const seamMesh = seams.current;
    if (!plateMesh || !seamMesh) return;

    // Scroll response, damped rather than read raw: ScrollTrigger already
    // reports a smoothed value, and a second stage here is what keeps a flick
    // of the wheel from snapping the stack round.
    const k = 1 - Math.exp(-ARCHIVE.scrollRate * dt);
    scratch.scrollFan += (archiveHandle.scroll - scratch.scrollFan) * k;
    scratch.scrollYaw += (archiveHandle.scroll - scratch.scrollYaw) * k;

    const breathe = s.reducedMotion
      ? 0
      : Math.sin((t / ARCHIVE.breathe.period) * Math.PI * 2) *
        THREE.MathUtils.degToRad(ARCHIVE.breathe.amplitude);

    const spread =
      1 + breathe + THREE.MathUtils.degToRad(ARCHIVE.scroll.fan) * scratch.scrollFan;
    const yaw = THREE.MathUtils.degToRad(ARCHIVE.scroll.yaw) * scratch.scrollYaw;

    for (let i = 0; i < built.plates.length; i++) {
      const plate = built.plates[i];

      const hovered = archiveHandle.hover === i ? 1 : 0;
      scratch.lift[i] += (hovered - scratch.lift[i]) * (1 - Math.exp(-ARCHIVE.seam.rate * dt));

      const angle =
        plate.angle * spread +
        yaw +
        THREE.MathUtils.degToRad(ARCHIVE.hoverSplay) * scratch.lift[i];

      scratch.pos.set(0, plate.y, 0);
      scratch.e.set(0, angle, 0);
      scratch.q.setFromEuler(scratch.e);

      scratch.scale.set(plate.length, 1, 1);
      plateMesh.setMatrixAt(i, scratch.m.compose(scratch.pos, scratch.q, scratch.scale));
      // The seam rides the plate's tip, so it takes the same X scale.
      seamMesh.setMatrixAt(i, scratch.m.compose(scratch.pos, scratch.q, scratch.scale));

      // One anodised seam and no more — the same single-accent rule the other
      // three structures follow. Everything else is the cold rim's colour, so
      // the steel lights the object without becoming the object.
      const base = i === ARCHIVE.accent ? scratch.ember : scratch.cool;
      const value = THREE.MathUtils.lerp(ARCHIVE.seam.rest, ARCHIVE.seam.hover, scratch.lift[i]);
      seamMesh.setColorAt(i, scratch.colour.copy(base).multiplyScalar(value));
    }

    plateMesh.instanceMatrix.needsUpdate = true;
    seamMesh.instanceMatrix.needsUpdate = true;
    if (seamMesh.instanceColor) seamMesh.instanceColor.needsUpdate = true;
  });

  useStructureMotion('archive', group, ARCHIVE.spin);

  return (
    <group ref={group} position={PAGE_ORIGIN.archive}>
      {/* Its own material rather than steel — a fan points at every angle at
          once, so it cannot dodge the ember kicker the way a fixed stack can.
          See createArchiveMaterial's note. */}
      <instancedMesh
        ref={plates}
        args={[built.plateGeometry, materials.archive, built.plates.length]}
        frustumCulled={false}
      />
      {/* The seams. Unlit, so the object has a legible edge from every camera
          angle — see createSeamMaterial. This is the "never invisible" rule,
          and it is a material property rather than a lighting hope. */}
      <instancedMesh
        ref={seams}
        args={[built.seamGeometry, seamMaterial, built.plates.length]}
        frustumCulled={false}
      />
      {/* The spine the plates hang from. Graphite, so the one vertical element
          separates from the eleven horizontal ones. */}
      <mesh geometry={built.spineGeometry} material={materials.graphite} />
    </group>
  );
}
