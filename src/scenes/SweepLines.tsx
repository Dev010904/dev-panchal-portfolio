'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

import { SWEEP } from '@/config/animation';
import { createBolt, createBoltMaterial, strike } from '@/scenes/bolt';
import { sceneState } from '@/store/scene';

const STRIKE = SWEEP.strike;

/**
 * THE SWEEP LINES.
 *
 * Three hairline arcs, each spanning far beyond the viewport, each turning
 * slowly about very nearly its own length. They are real geometry rather than a
 * fullscreen pass for one reason: they depth-test against the mark, so each
 * line crosses in front of it and then disappears behind it as it turns. A
 * screen-space field cannot do that, and that occlusion is the only thing here
 * that actually reads as depth.
 *
 * Everything is a closed-form function of `clock.elapsedTime` rather than an
 * accumulated rotation. That means the pose is reproducible, the frame-stepping
 * QA harness sees exactly what a real visitor sees, and there is no drift after
 * ten minutes on the page.
 *
 * THE DISCHARGE
 * Every frame each line's curve is sampled and projected to screen space. If
 * the cursor is within `strike.radius` pixels of the projected curve the line
 * is armed, and it fires bolts in short bursts from the nearest point on
 * itself. The bolt geometry — branching, tapered, two-layer — lives in
 * scenes/bolt.ts; this file owns proximity, rhythm and lifetime only.
 *
 * Bolts come from a fixed pool of preallocated buffers. A strike rewrites them
 * in place and moves the draw range, so a burst cannot cause a GC hitch.
 */
export function SweepLines() {
  const { camera, size } = useThree();

  // ── Curves ────────────────────────────────────────────────────────────────
  // Laid out along local +X with a parabolic bow in +Y. The bow is the sagitta
  // in world units: small enough that the line still reads as straight, large
  // enough that turning it swings the midsection through the mark's depth.
  const curves = useMemo(
    () =>
      SWEEP.lines.map((line) => {
        const n = SWEEP.segments;
        const pts = new Float32Array((n + 1) * 3);
        for (let i = 0; i <= n; i++) {
          const f = (i / n) * 2 - 1;
          pts[i * 3 + 0] = f * line.halfLength;
          pts[i * 3 + 1] = (1 - f * f) * line.bow;
          pts[i * 3 + 2] = 0;
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(pts, 3));
        // A line this long has no useful bounding volume relative to the
        // camera's travel across the site, and being culled mid-scroll is the
        // exact failure this scene has hit before.
        g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), line.halfLength * 1.4);
        return { geometry: g, points: pts };
      }),
    [],
  );

  const lineMaterial = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: new THREE.Color(SWEEP.color),
        transparent: true,
        opacity: SWEEP.opacity,
        // Depth *test* on so the mark occludes them; depth *write* off so three
        // lines crossing each other never punch holes in one another.
        depthTest: true,
        depthWrite: false,
      }),
    [],
  );

  // ── Strike pool ───────────────────────────────────────────────────────────
  // Each pooled bolt owns its own pair of materials rather than sharing one.
  // The flicker uniform is per-bolt, so two bolts alive at once with a shared
  // material would stutter in lockstep — which reads as a single flashing
  // object rather than as two independent discharges.
  const strikes = useMemo(
    () =>
      Array.from({ length: STRIKE.pool }, () => ({
        bolt: createBolt(),
        core: createBoltMaterial(STRIKE.core),
        halo: createBoltMaterial(STRIKE.halo),
      })),
    [],
  );

  useEffect(
    () => () => {
      curves.forEach((c) => c.geometry.dispose());
      strikes.forEach((s) => {
        s.bolt.geometry.dispose();
        s.core.dispose();
        s.halo.dispose();
      });
      lineMaterial.dispose();
    },
    [curves, strikes, lineMaterial],
  );

  // ── Refs and scratch ──────────────────────────────────────────────────────
  const groups = useRef<THREE.Group[]>([]);
  const nextFire = useRef<number[]>(SWEEP.lines.map(() => 0));
  /** Strikes left in the current burst, per line. */
  const burst = useRef<number[]>(SWEEP.lines.map(() => 0));
  const slot = useRef(0);

  // The Line objects are built once and mounted with <primitive>. Constructing
  // them in the returned JSX would make a new THREE.Line on every React render
  // and quietly leak one per render.
  const lineObjects = useMemo(
    () => curves.map((c) => new THREE.Line(c.geometry, lineMaterial)),
    [curves, lineMaterial],
  );

  // Two meshes per bolt sharing one geometry: the halo draws first and wider,
  // the core sits inside it. Same vertices, different uWidth — so the glow can
  // never drift off the channel it belongs to.
  const strikeObjects = useMemo(
    () =>
      strikes.map(({ bolt, core, halo }) => {
        const make = (material: THREE.Material, order: number) => {
          const m = new THREE.Mesh(bolt.geometry, material);
          m.visible = false;
          m.frustumCulled = false;
          m.renderOrder = order;
          return m;
        };
        return { halo: make(halo, 10), core: make(core, 11) };
      }),
    [strikes],
  );

  const axes = useMemo(
    () => SWEEP.lines.map((l) => new THREE.Vector3(...l.axis).normalize()),
    [],
  );

  /** Every temporary this loop needs, allocated once. */
  const scratch = useMemo(
    () => ({
      quat: new THREE.Quaternion(),
      probe: new THREE.Vector3(),
      hit: new THREE.Vector3(),
      before: new THREE.Vector3(),
      after: new THREE.Vector3(),
      tangent: new THREE.Vector3(),
      view: new THREE.Vector3(),
      perp: new THREE.Vector3(),
      lateral: new THREE.Vector3(),
      cursor: new THREE.Vector3(),
    }),
    [],
  );

  useFrame((state) => {
    const s = sceneState();
    const t = s.reducedMotion ? 8.2 : state.clock.elapsedTime;

    // ── Rotation ────────────────────────────────────────────────────────────
    for (let i = 0; i < SWEEP.lines.length; i++) {
      const g = groups.current[i];
      if (!g) continue;
      g.quaternion.setFromAxisAngle(axes[i], t * SWEEP.lines[i].speed);
      // useFrame runs before the renderer's own updateMatrixWorld, so without
      // this the projections below would read last frame's pose — and on the
      // very first frame, no pose at all.
      g.updateMatrixWorld();
    }

    // ── Bolt lifetime and flicker ───────────────────────────────────────────
    // Runs even under reduced motion so a bolt alive when the preference
    // flipped still gets cleaned up.
    for (let i = 0; i < strikes.length; i++) {
      const { bolt, core, halo } = strikes[i];
      const obj = strikeObjects[i];
      if (bolt.diesAt < 0) continue;

      if (t >= bolt.diesAt) {
        // Cut, not fade. The snap to zero is most of what reads as electrical.
        bolt.diesAt = -1;
        bolt.geometry.setDrawRange(0, 0);
        obj.core.visible = false;
        obj.halo.visible = false;
        continue;
      }

      // Stepped brightness across the life — never interpolated, or the
      // stutter smooths out into exactly the fade we are avoiding.
      const age = (t - bolt.bornAt) / Math.max(bolt.diesAt - bolt.bornAt, 1e-4);
      const step = Math.min(Math.floor(age * bolt.flicker.length), bolt.flicker.length - 1);
      const f = bolt.flicker[step];
      core.uniforms.uFlicker.value = f;
      // The halo lags the core slightly, so the glow persists for a beat after
      // a dark slice instead of the whole bolt blinking as one flat shape.
      halo.uniforms.uFlicker.value = Math.max(f, halo.uniforms.uFlicker.value * 0.55);
    }

    if (s.reducedMotion || s.isMobile) return;

    // ── Proximity ───────────────────────────────────────────────────────────
    // The curve is sampled rather than tested exactly: at 16 probes across a
    // line that is mostly off-screen, the error is far below the 80px
    // threshold and it costs 48 projections a frame for the whole set.
    const [pxNdc, pyNdc] = s.pointer;
    const half = SWEEP.segments / 2;

    for (let i = 0; i < SWEEP.lines.length; i++) {
      const g = groups.current[i];
      if (!g) continue;

      const { points } = curves[i];
      let bestDist = Infinity;
      let bestIndex = -1;

      // Only the middle half of the curve can be near the cursor — the rest is
      // far outside the viewport by construction.
      for (let k = 0; k <= 16; k++) {
        const idx = Math.round(half * 0.5 + (half * k) / 16);
        scratch.probe
          .fromArray(points, idx * 3)
          .applyMatrix4(g.matrixWorld)
          .project(camera);

        if (scratch.probe.z < -1 || scratch.probe.z > 1) continue;

        const dx = (scratch.probe.x - pxNdc) * 0.5 * size.width;
        const dy = (scratch.probe.y - pyNdc) * 0.5 * size.height;
        const d = Math.hypot(dx, dy);
        if (d < bestDist) {
          bestDist = d;
          bestIndex = idx;
        }
      }

      if (bestDist > STRIKE.radius || bestIndex < 0) continue;

      // ── Fire ──────────────────────────────────────────────────────────────
      // Strikes come in bursts of two or three, then an uneven pause. Firing at
      // one steady interval — which is what the previous version did — reads as
      // a loop within about two seconds, however random each bolt's geometry is.
      if (t < nextFire.current[i]) continue;

      if (burst.current[i] <= 0) burst.current[i] = randInt(STRIKE.burst);
      burst.current[i] -= 1;
      nextFire.current[i] =
        t + (burst.current[i] > 0 ? randRange(STRIKE.gap) : randRange(STRIKE.pause));

      const { bolt, core, halo } = strikes[slot.current];
      const mesh = strikeObjects[slot.current];
      slot.current = (slot.current + 1) % strikes.length;

      // Origin and tangent, both in world space.
      scratch.hit.fromArray(points, bestIndex * 3).applyMatrix4(g.matrixWorld);
      scratch.before
        .fromArray(points, Math.max(bestIndex - 1, 0) * 3)
        .applyMatrix4(g.matrixWorld);
      scratch.after
        .fromArray(points, Math.min(bestIndex + 1, SWEEP.segments) * 3)
        .applyMatrix4(g.matrixWorld);
      scratch.tangent.subVectors(scratch.after, scratch.before).normalize();

      // Travel perpendicular to the line and across the screen, so the arc
      // always reads at full length instead of foreshortening into a dot.
      camera.getWorldDirection(scratch.view);
      scratch.perp.crossVectors(scratch.tangent, scratch.view).normalize();

      // Aim it at the cursor's side of the line rather than a fixed one.
      scratch.cursor.set(pxNdc, pyNdc, 0.5).unproject(camera).sub(scratch.hit);
      if (scratch.perp.dot(scratch.cursor) < 0) scratch.perp.negate();

      scratch.lateral.crossVectors(scratch.perp, scratch.view).normalize();

      // Branching, tapered, two-octave path — written into the pooled buffers
      // in place. See scenes/bolt.ts.
      strike(bolt, t, scratch.hit, scratch.perp, scratch.lateral, scratch.view);

      core.uniforms.uFlicker.value = 1;
      halo.uniforms.uFlicker.value = 1;
      mesh.core.visible = true;
      mesh.halo.visible = true;
    }
  });

  return (
    <group>
      {SWEEP.lines.map((line, i) => (
        <group key={line.id} position={line.position} rotation={line.tilt}>
          <group
            ref={(el) => {
              if (el) groups.current[i] = el;
            }}
          >
            <primitive object={lineObjects[i]} />
          </group>
        </group>
      ))}

      {strikeObjects.map((obj, i) => (
        <group key={i}>
          <primitive object={obj.halo} />
          <primitive object={obj.core} />
        </group>
      ))}
    </group>
  );
}

const randRange = (r: readonly [number, number]) => r[0] + Math.random() * (r[1] - r[0]);
const randInt = (r: readonly [number, number]) =>
  r[0] + Math.floor(Math.random() * (r[1] - r[0] + 1));
