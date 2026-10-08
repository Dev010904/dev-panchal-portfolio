'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

import { BLAST, CAMERA, DECONSTRUCTION, SHOTS, TRAVEL, type ShotName } from '@/config/animation';
import { blastHandle, markHandles, travelHandle } from '@/scenes/handles';
import { sceneState } from '@/store/scene';

/**
 * CAMERA RIG
 *
 * The camera is never positioned directly. It is always solved from a
 * spherical orbit [radius, azimuth, elevation] plus a damped cursor parallax,
 * which means every camera key in the config is a rig pose rather than a world
 * coordinate — retiming or reframing never requires re-deriving positions.
 *
 * Three drivers, in priority order:
 *   1. The Deconstruction scrub, when it is active. Camera keys are laid out
 *      along the same normalised master timeline as the geometry.
 *   2. A travel band between two sections, when one is in progress: the pose
 *      is solved from the scroll (see TRAVEL and resolveTravel below).
 *   3. Otherwise, an eased approach toward the current section's shot.
 *
 * Elevation is clamped away from ±90° — at the poles the up vector degenerates
 * and the camera rolls, which looks like a bug even when it is trigonometry.
 */

const KEYS = DECONSTRUCTION.keys;

/** Camera stops through the Deconstruction, as [t, shot] pairs. */
const DECON_TRACK: [number, keyof typeof SHOTS][] = [
  [0.0, 'hero'],
  [KEYS.resolve.at + KEYS.resolve.dur, 'resolve'],
  [KEYS.explode.at + KEYS.explode.dur, 'exploded'],
  [KEYS.dissolve.at + KEYS.dissolve.dur, 'dissolved'],
  [KEYS.assemble.at, 'exploded'],
  [1.0, 'release'],
];

export function CameraRig() {
  const { camera, size } = useThree();

  const orbit = useRef(new THREE.Vector3(...SHOTS.hero.orbit));
  const target = useRef(new THREE.Vector3(...SHOTS.hero.target));
  const parallax = useRef(new THREE.Vector2());

  const lastPos = useRef<THREE.Vector3 | null>(null);
  const goalOrbit = useMemo(() => new THREE.Vector3(), []);
  const goalTarget = useMemo(() => new THREE.Vector3(), []);
  const a = useMemo(() => new THREE.Vector3(), []);
  const b = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    cam.fov = CAMERA.fov;
    cam.near = CAMERA.near;
    cam.far = CAMERA.far;
    cam.updateProjectionMatrix();
  }, [camera]);

  // Narrow viewports need the camera further back or the mark crops. Solved
  // from aspect rather than a breakpoint so it is continuous, not stepped.
  const distanceScale = useMemo(() => {
    const aspect = size.width / size.height;
    return aspect < 1 ? THREE.MathUtils.lerp(1.65, 1.0, THREE.MathUtils.clamp(aspect, 0.4, 1)) : 1;
  }, [size]);

  useFrame((_, delta) => {
    const s = sceneState();

    const p = markHandles.current.progress.value;
    const scrubbing = p > 0.0005 && p < 0.9995;

    const travelling = !scrubbing && travelHandle.active;

    if (scrubbing) {
      resolveTrack(p, goalOrbit, goalTarget, a, b);
    } else if (travelling) {
      resolveTravel(goalOrbit, goalTarget, a, b);
    } else {
      const shot = SHOTS[s.shot as ShotName];
      goalOrbit.set(...shot.orbit);
      goalTarget.set(...shot.target);
    }

    goalOrbit.x *= distanceScale;

    // Frame-rate independent damping. `1 - exp(-k*dt)` rather than a fixed
    // lerp factor, so the feel does not change on a 120Hz display. A camera
    // driven by scroll follows closely; one easing to a shot takes its time.
    const k = scrubbing || travelling ? 9.5 : 3.2;
    const f = 1 - Math.exp(-k * Math.min(delta, 0.05));
    orbit.current.lerp(goalOrbit, f);
    target.current.lerp(goalTarget, f);

    // Cursor parallax — damped, deliberately slow to arrive.
    if (!s.reducedMotion && !s.isMobile) {
      const pd = 1 - Math.exp(-(1 / CAMERA.parallax.damping) * 0.06 * 60 * Math.min(delta, 0.05));
      parallax.current.x += (s.pointer[0] - parallax.current.x) * pd;
      parallax.current.y += (s.pointer[1] - parallax.current.y) * pd;
    }

    const az = THREE.MathUtils.degToRad(
      orbit.current.y + parallax.current.x * CAMERA.parallax.azimuth,
    );
    const el = THREE.MathUtils.degToRad(
      THREE.MathUtils.clamp(
        orbit.current.z + parallax.current.y * CAMERA.parallax.elevation,
        -78,
        78,
      ),
    );
    const r = orbit.current.x;

    camera.position.set(
      target.current.x + r * Math.cos(el) * Math.sin(az),
      target.current.y + r * Math.sin(el),
      target.current.z + r * Math.cos(el) * Math.cos(az),
    );

    // ── Detonation jolt ─────────────────────────────────────────────────────
    // One hard hit that rings out, applied to the position and not the target,
    // so the camera is knocked while it keeps looking at the mark. Three
    // incommensurate sines rather than random numbers: the same shake at 60Hz
    // and at 144Hz, and no frame-to-frame snapping.
    const kt = performance.now() / 1000 - blastHandle.kickAt;
    if (blastHandle.kickAt > 0 && kt >= 0 && kt < 1.5 && !s.reducedMotion) {
      const J = BLAST.fx.camera;
      const amp = J.amplitude * Math.exp(-J.decay * kt);
      const w = J.frequency * Math.PI * 2 * kt;
      camera.position.x += amp * (Math.sin(w) + 0.5 * Math.sin(w * 2.3 + 1.7));
      camera.position.y += amp * (Math.sin(w * 1.3 + 0.6) + 0.4 * Math.sin(w * 2.9 + 2.1));
      camera.position.z += amp * 0.5 * Math.sin(w * 0.9 + 3.3);
    }

    camera.lookAt(target.current);

    // Published for the instrument shaft's dust, which streaks along the
    // camera's own motion. Clamped: a jump (the menu's wipe, a route change)
    // is a teleport, not a velocity.
    const dt = Math.max(Math.min(delta, 0.05), 1e-3);
    const v = travelHandle.velocity;
    if (lastPos.current) {
      v[0] = THREE.MathUtils.clamp((camera.position.x - lastPos.current.x) / dt, -160, 160);
      v[1] = THREE.MathUtils.clamp((camera.position.y - lastPos.current.y) / dt, -160, 160);
      v[2] = THREE.MathUtils.clamp((camera.position.z - lastPos.current.z) / dt, -160, 160);
      lastPos.current.copy(camera.position);
    } else {
      lastPos.current = camera.position.clone();
    }
  });

  return null;
}

/**
 * The pose a fraction `p` of the way through the current travel band.
 *
 * The orbit (radius, azimuth, elevation) eases with a smoothstep and the
 * target with a smootherstep. The target is what carries the long vertical
 * distance, and smootherstep's flatter ends are what let the mark leave the
 * frame — and the next section arrive in it — at a walking pace while the
 * empty middle goes by quickly. The bulge rides a sine over the band, so it is
 * zero at both ends and the band starts and finishes exactly on its two shots.
 */
function resolveTravel(
  outOrbit: THREE.Vector3,
  outTarget: THREE.Vector3,
  a: THREE.Vector3,
  b: THREE.Vector3,
) {
  const route = TRAVEL[travelHandle.route];
  const p = THREE.MathUtils.clamp(travelHandle.p, 0, 1);
  const smooth = p * p * (3 - 2 * p);
  const smoother = p * p * p * (p * (p * 6 - 15) + 10);
  const bump = Math.sin(Math.PI * p);

  const s0 = SHOTS[route.from];
  const s1 = SHOTS[route.to];

  a.set(...s0.orbit);
  b.set(...s1.orbit);
  b.y = a.y + shortAngle(a.y, b.y);
  outOrbit.copy(a).lerp(b, smooth);
  outOrbit.x += route.bulge[0] * bump;
  outOrbit.y += route.bulge[1] * bump;
  outOrbit.z += route.bulge[2] * bump;

  a.set(...s0.target);
  b.set(...s1.target);
  outTarget.copy(a).lerp(b, smoother);
}

/** Piecewise-linear walk along DECON_TRACK, eased within each leg. */
function resolveTrack(
  p: number,
  outOrbit: THREE.Vector3,
  outTarget: THREE.Vector3,
  a: THREE.Vector3,
  b: THREE.Vector3,
) {
  for (let i = 0; i < DECON_TRACK.length - 1; i++) {
    const [t0, k0] = DECON_TRACK[i];
    const [t1, k1] = DECON_TRACK[i + 1];
    if (p > t1 && i < DECON_TRACK.length - 2) continue;

    const raw = THREE.MathUtils.clamp((p - t0) / Math.max(t1 - t0, 1e-4), 0, 1);
    const t = raw * raw * (3 - 2 * raw);

    const s0 = SHOTS[k0];
    const s1 = SHOTS[k1];

    a.set(...s0.orbit);
    b.set(...s1.orbit);
    // Take the short way round in azimuth — otherwise a key that crosses 180°
    // sends the camera the long way and the object swings out of frame.
    b.y = a.y + shortAngle(a.y, b.y);
    outOrbit.copy(a).lerp(b, t);

    a.set(...s0.target);
    b.set(...s1.target);
    outTarget.copy(a).lerp(b, t);
    return;
  }
}

function shortAngle(from: number, to: number): number {
  let d = (to - from) % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}
