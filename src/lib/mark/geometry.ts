import * as THREE from 'three';
import { markBootStep } from '@/lib/boot';
import { CENTER, GRID, MARK_SCALE, PARTS, PINS, type Cmd, type Outline, type PartSpec } from './paths';

/** Emit a 2D command list into a THREE.Path/Shape. */
function trace(target: THREE.Path, cmds: Cmd[]) {
  for (const c of cmds) {
    switch (c.t) {
      case 'M':
        target.moveTo(c.x, c.y);
        break;
      case 'L':
        target.lineTo(c.x, c.y);
        break;
      case 'A':
        target.absarc(c.cx, c.cy, c.r, c.a0, c.a1, c.ccw === false);
        break;
      case 'Z':
        target.closePath();
        break;
    }
  }
}

export function outlineToShape(o: Outline): THREE.Shape {
  const shape = new THREE.Shape();
  trace(shape, o.contour);
  for (const h of o.holes ?? []) {
    const path = new THREE.Path();
    trace(path, h);
    shape.holes.push(path);
  }
  return shape;
}

/**
 * Extrude a part. Chamfers are non-negotiable: on a near-black material the
 * bevel is the only thing that produces a highlight, so it is the entire
 * reason the object is legible. `bevelSegments: 3` keeps the chamfer reading
 * as a machined facet rather than a soft round-over.
 */
export function buildPartGeometry(part: PartSpec): THREE.BufferGeometry {
  const shape = outlineToShape(part.outline);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: part.depth - part.bevel * 2,
    bevelEnabled: true,
    bevelThickness: part.bevel,
    bevelSize: part.bevel,
    bevelOffset: 0,
    bevelSegments: 3,
    curveSegments: 44,
  });

  // Author in grid space, deliver in world space, centred on the mark's axis.
  geo.translate(-CENTER[0], -CENTER[1], part.z + part.bevel);
  geo.scale(MARK_SCALE, MARK_SCALE, MARK_SCALE);
  geo.computeVertexNormals();
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

export interface BuiltPart {
  spec: PartSpec;
  geometry: THREE.BufferGeometry;
  /** Local-space centroid, used as the anchor for annotation leader lines. */
  anchor: THREE.Vector3;
}

let cache: BuiltPart[] | null = null;

export function buildMark(): BuiltPart[] {
  if (cache) return cache;
  cache = PARTS.map((spec) => {
    const geometry = buildPartGeometry(spec);
    const b = geometry.boundingBox!;
    return {
      spec,
      geometry,
      anchor: new THREE.Vector3().addVectors(b.min, b.max).multiplyScalar(0.5),
    };
  });
  markBootStep('geometry');
  return cache;
}

/** Locating pins as one instanced cylinder set. */
export function buildPins() {
  const geo = new THREE.CylinderGeometry(
    PINS.radius * MARK_SCALE,
    PINS.radius * MARK_SCALE,
    PINS.length * MARK_SCALE,
    16,
    1,
  );
  // Cylinders are Y-up; the pins run through the plate on Z.
  geo.rotateX(Math.PI / 2);
  const matrices = PINS.positions.map(([x, y]) =>
    new THREE.Matrix4().makeTranslation(
      (x - CENTER[0]) * MARK_SCALE,
      (y - CENTER[1]) * MARK_SCALE,
      0,
    ),
  );
  return { geometry: geo, matrices };
}

/**
 * Surface point cloud used by the "dissolved" state. Sampling by triangle area
 * keeps density even across parts of very different size — without it the
 * shims (large, flat) swamp the arcs and the mark stops being readable as
 * particles.
 */
export function sampleMarkSurface(count: number): Float32Array {
  const parts = buildMark();
  const sampler = new THREE.Vector3();
  const out = new Float32Array(count * 3);

  const merged: { geo: THREE.BufferGeometry; area: number }[] = parts.map((p) => ({
    geo: p.geometry,
    area: surfaceArea(p.geometry),
  }));
  const total = merged.reduce((s, m) => s + m.area, 0);

  let written = 0;
  for (let i = 0; i < merged.length; i++) {
    const isLast = i === merged.length - 1;
    const n = isLast ? count - written : Math.floor((merged[i].area / total) * count);
    const pos = merged[i].geo.attributes.position as THREE.BufferAttribute;
    const triCount = pos.count / 3;
    for (let k = 0; k < n; k++) {
      randomPointInTriangle(pos, Math.floor(Math.random() * triCount) * 3, sampler);
      out[(written + k) * 3 + 0] = sampler.x;
      out[(written + k) * 3 + 1] = sampler.y;
      out[(written + k) * 3 + 2] = sampler.z;
    }
    written += n;
  }
  markBootStep('particles');
  return out;
}

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();

function surfaceArea(geo: THREE.BufferGeometry): number {
  const pos = geo.attributes.position as THREE.BufferAttribute;
  let area = 0;
  for (let i = 0; i < pos.count; i += 3) {
    _a.fromBufferAttribute(pos, i);
    _b.fromBufferAttribute(pos, i + 1);
    _c.fromBufferAttribute(pos, i + 2);
    area += _b.sub(_a).cross(_c.sub(_a)).length() * 0.5;
  }
  return area;
}

function randomPointInTriangle(pos: THREE.BufferAttribute, i: number, out: THREE.Vector3) {
  _a.fromBufferAttribute(pos, i);
  _b.fromBufferAttribute(pos, i + 1);
  _c.fromBufferAttribute(pos, i + 2);
  let u = Math.random();
  let v = Math.random();
  if (u + v > 1) {
    u = 1 - u;
    v = 1 - v;
  }
  out.copy(_a)
    .addScaledVector(_b.sub(_a), u)
    .addScaledVector(_c.sub(_a), v);
}

export const MARK_GRID = GRID;
