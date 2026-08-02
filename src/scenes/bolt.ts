import * as THREE from 'three';

import { SWEEP } from '@/config/animation';
import { GLSL3, glsl } from '@/lib/glsl';
import boltFrag from '@/shaders/bolt.frag';
import boltVert from '@/shaders/bolt.vert';

const S = SWEEP.strike;

/**
 * THE DISCHARGE GEOMETRY.
 *
 * One pooled bolt: a main channel plus a handful of forks, written into a
 * single non-indexed ribbon buffer as camera-facing quads.
 *
 * NON-INDEXED, AND ON PURPOSE. A triangle strip would be fewer vertices, but a
 * branching path is not one strip — every fork needs degenerate triangles to
 * jump the gap, and a bolt that changes its branch count every 80ms means
 * rebuilding that degenerate bookkeeping on every strike. Six vertices per
 * segment is a few hundred floats for the whole effect and the write loop stays
 * something you can read.
 *
 * Nothing here allocates after construction. `strike()` rewrites the same typed
 * arrays and moves the draw range; the pool is fixed at two.
 */

/** Upper bound on segments: the longest main channel plus the most forks. */
const MAX_SEGMENTS = S.mainPoints[1] + S.forks[1] * S.fork.points[1];
const VERTS_PER_SEGMENT = 6;
const MAX_VERTS = MAX_SEGMENTS * VERTS_PER_SEGMENT;

const rand = (r: readonly [number, number]) => r[0] + Math.random() * (r[1] - r[0]);
const randInt = (r: readonly [number, number]) =>
  r[0] + Math.floor(Math.random() * (r[1] - r[0] + 1));

export interface Bolt {
  geometry: THREE.BufferGeometry;
  /** Scene time this bolt cuts out at, or -1 when idle. */
  diesAt: number;
  /** Scene time it was fired. */
  bornAt: number;
  /** Stepped brightness across the life. Rewritten per strike. */
  flicker: Float32Array;
}

export function createBolt(): Bolt {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_VERTS * 3), 3));
  geometry.setAttribute('aTangent', new THREE.BufferAttribute(new Float32Array(MAX_VERTS * 3), 3));
  geometry.setAttribute('aSide', new THREE.BufferAttribute(new Float32Array(MAX_VERTS), 1));
  geometry.setAttribute('aWidth', new THREE.BufferAttribute(new Float32Array(MAX_VERTS), 1));
  geometry.setAttribute('aIntensity', new THREE.BufferAttribute(new Float32Array(MAX_VERTS), 1));
  geometry.setDrawRange(0, 0);
  // A bolt is regenerated every frame it exists and lives near the camera;
  // there is no bounding volume worth maintaining.
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);

  return {
    geometry,
    diesAt: -1,
    bornAt: -1,
    flicker: new Float32Array(S.flickerSteps),
  };
}

export function createBoltMaterial(layer: typeof S.core | typeof S.halo) {
  const material = new THREE.ShaderMaterial({
    vertexShader: glsl(boltVert),
    fragmentShader: glsl(boltFrag),
    // GLSL3 throughout — see lib/glsl.ts. The fragment shader declares its own
    // `out vec4 fragColor` because three's GLSL3 path provides no gl_FragColor.
    glslVersion: GLSL3,
    transparent: true,
    blending: THREE.AdditiveBlending,
    // Always on top: a bolt is the brightest thing on screen and clipping it
    // against the object it just jumped off looks like a z-fighting fault.
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uWidth: { value: layer.width },
      uColor: { value: new THREE.Color(layer.color).multiplyScalar(layer.gain) },
      uOpacity: { value: layer.opacity },
      uFalloff: { value: layer.falloff },
      uFlicker: { value: 0 },
    },
  });
  return material;
}

/* ── Scratch. Module-level so a strike allocates nothing. ─────────────────── */

const scratch = {
  p0: new THREE.Vector3(),
  p1: new THREE.Vector3(),
  tan: new THREE.Vector3(),
  cur: new THREE.Vector3(),
  prev: new THREE.Vector3(),
  dir: new THREE.Vector3(),
  forkDir: new THREE.Vector3(),
  offset: new THREE.Vector3(),
  /** Where each fork starts, refilled per strike. */
  forkAt: new Float32Array(S.forks[1]),
  forkStart: Array.from({ length: S.forks[1] }, () => new THREE.Vector3()),
  forkTangent: Array.from({ length: S.forks[1] }, () => new THREE.Vector3()),
};

/** Write cursor into the ribbon buffers, in vertices. */
let cursor = 0;

/**
 * Fire a bolt from `origin`, travelling along `perp`, jittered in the
 * `lateral`/`view` plane so the whole thing stays legible from the camera.
 */
export function strike(
  bolt: Bolt,
  now: number,
  origin: THREE.Vector3,
  perp: THREE.Vector3,
  lateral: THREE.Vector3,
  view: THREE.Vector3,
) {
  const pos = bolt.geometry.attributes.position.array as Float32Array;
  const tan = bolt.geometry.attributes.aTangent.array as Float32Array;
  const side = bolt.geometry.attributes.aSide.array as Float32Array;
  const width = bolt.geometry.attributes.aWidth.array as Float32Array;
  const inten = bolt.geometry.attributes.aIntensity.array as Float32Array;

  cursor = 0;

  const reach = rand(S.reach);
  const nMain = randInt(S.mainPoints);
  const forkCount = randInt(S.forks);

  // Where the forks will split off. Picked before the walk so the main channel
  // can hand each one its actual jittered position and direction as it passes.
  for (let f = 0; f < forkCount; f++) scratch.forkAt[f] = rand(S.fork.at);

  // ── Coarse octave ───────────────────────────────────────────────────────
  // Three control offsets shape the whole channel. This is the octave that
  // decides where the bolt *goes*; the fine octave only roughens it.
  const c1 = (Math.random() - 0.5) * 2 * S.coarse * reach;
  const c2 = (Math.random() - 0.5) * 2 * S.coarse * reach;
  const d1 = (Math.random() - 0.5) * 2 * S.coarse * reach * 0.6;
  const d2 = (Math.random() - 0.5) * 2 * S.coarse * reach * 0.6;

  let forkCursor = 0;

  for (let i = 0; i < nMain; i++) {
    const f = i / (nMain - 1);

    // Piecewise-linear through the control offsets, zero at the root so the
    // bolt is actually attached to the line it came off.
    const coarseL = f < 0.5 ? THREE.MathUtils.lerp(0, c1, f * 2) : THREE.MathUtils.lerp(c1, c2, (f - 0.5) * 2);
    const coarseV = f < 0.5 ? THREE.MathUtils.lerp(0, d1, f * 2) : THREE.MathUtils.lerp(d1, d2, (f - 0.5) * 2);

    // Fine octave — small, and it opens up toward the tip.
    const fineScale = S.fine * reach * (0.2 + f);
    const fineL = (Math.random() - 0.5) * 2 * fineScale;
    const fineV = (Math.random() - 0.5) * 2 * fineScale;

    scratch.cur
      .copy(origin)
      .addScaledVector(perp, f * reach)
      .addScaledVector(lateral, coarseL + fineL)
      .addScaledVector(view, coarseV + fineV);

    if (i > 0) {
      scratch.tan.subVectors(scratch.cur, scratch.prev);
      const w0 = rootWidthAt((i - 1) / (nMain - 1));
      const w1 = rootWidthAt(f);
      cursor = pushSegment(pos, tan, side, width, inten, cursor, scratch.prev, scratch.cur, scratch.tan, w0, w1, 1, 1);

      // Hand a fork its launch point as the channel passes the split.
      const prevF = (i - 1) / (nMain - 1);
      for (let k = 0; k < forkCount; k++) {
        if (scratch.forkAt[k] > prevF && scratch.forkAt[k] <= f && forkCursor < forkCount) {
          scratch.forkStart[forkCursor].copy(scratch.cur);
          scratch.forkTangent[forkCursor].copy(scratch.tan).normalize();
          forkCursor++;
        }
      }
    }

    scratch.prev.copy(scratch.cur);
  }

  // ── Forks ───────────────────────────────────────────────────────────────
  for (let k = 0; k < forkCursor; k++) {
    const start = scratch.forkStart[k];
    const parent = scratch.forkTangent[k];

    // Splay off the parent direction, in the plane facing the camera so the
    // branch is visible rather than pointing at the lens.
    const angle = rand(S.fork.angle) * (Math.random() < 0.5 ? -1 : 1);
    scratch.forkDir
      .copy(parent)
      .multiplyScalar(Math.cos(angle))
      .addScaledVector(lateral, Math.sin(angle))
      .normalize();

    const len = rand(S.fork.length) * reach;
    const nFork = randInt(S.fork.points);

    scratch.prev.copy(start);
    for (let i = 1; i < nFork; i++) {
      const f = i / (nFork - 1);
      const jitter = S.fine * len * (0.4 + f) * 2;

      scratch.cur
        .copy(start)
        .addScaledVector(scratch.forkDir, f * len)
        .addScaledVector(lateral, (Math.random() - 0.5) * jitter)
        .addScaledVector(view, (Math.random() - 0.5) * jitter * 0.7);

      scratch.tan.subVectors(scratch.cur, scratch.prev);

      // Forks taper to nothing — they die out rather than stopping.
      const w0 = S.rootWidth * S.fork.width * (1 - (i - 1) / (nFork - 1));
      const w1 = S.rootWidth * S.fork.width * (1 - f);
      const intensity = S.fork.intensity * (1 - f * 0.6);

      cursor = pushSegment(
        pos, tan, side, width, inten, cursor,
        scratch.prev, scratch.cur, scratch.tan,
        Math.max(w0, 1e-4), Math.max(w1, 1e-4),
        intensity, intensity * 0.7,
      );

      scratch.prev.copy(scratch.cur);
    }
  }

  // ── Flicker ─────────────────────────────────────────────────────────────
  // Two or three bright slices among dim ones, then the life ends and it cuts.
  // Deliberately not a fade: a discharge that ramps down looks like a light
  // being dimmed, and the snap is most of what makes it read as electrical.
  const spikes = 2 + (Math.random() < 0.5 ? 0 : 1);
  bolt.flicker.fill(0.22);
  bolt.flicker[0] = 1;
  for (let i = 0; i < spikes; i++) {
    bolt.flicker[1 + Math.floor(Math.random() * (S.flickerSteps - 1))] = 0.7 + Math.random() * 0.5;
  }

  bolt.bornAt = now;
  bolt.diesAt = now + rand(S.life);

  for (const name of ['position', 'aTangent', 'aSide', 'aWidth', 'aIntensity']) {
    bolt.geometry.attributes[name].needsUpdate = true;
  }
  bolt.geometry.setDrawRange(0, cursor);
}

/** Half-width along the main channel: thick at the root, tapering to the tip. */
function rootWidthAt(f: number) {
  return S.rootWidth * THREE.MathUtils.lerp(1, S.tipWidth, f);
}

/**
 * Write one ribbon quad as six vertices. The vertex shader turns `aSide` into
 * an offset perpendicular to `aTangent` and facing the camera.
 */
function pushSegment(
  pos: Float32Array,
  tan: Float32Array,
  side: Float32Array,
  width: Float32Array,
  inten: Float32Array,
  at: number,
  p0: THREE.Vector3,
  p1: THREE.Vector3,
  tangent: THREE.Vector3,
  w0: number,
  w1: number,
  i0: number,
  i1: number,
): number {
  if (at + VERTS_PER_SEGMENT > MAX_VERTS) return at;

  // v0/v1 at p0, v2/v3 at p1 — emitted as two triangles.
  const order = [0, 0, 1, 0, 1, 1] as const;
  const sides = [-1, 1, -1, 1, 1, -1] as const;

  for (let v = 0; v < VERTS_PER_SEGMENT; v++) {
    const end = order[v];
    const p = end === 0 ? p0 : p1;
    const i = at + v;

    pos[i * 3 + 0] = p.x;
    pos[i * 3 + 1] = p.y;
    pos[i * 3 + 2] = p.z;

    tan[i * 3 + 0] = tangent.x;
    tan[i * 3 + 1] = tangent.y;
    tan[i * 3 + 2] = tangent.z;

    side[i] = sides[v];
    width[i] = end === 0 ? w0 : w1;
    inten[i] = end === 0 ? i0 : i1;
  }

  return at + VERTS_PER_SEGMENT;
}
