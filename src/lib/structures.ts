import * as THREE from 'three';

/**
 * PROCEDURAL STRUCTURES — one per interior page.
 *
 * Same rules as the mark: generated in code, nothing downloaded, nothing
 * licensed, near-zero payload. Each one is built from the same visual language
 * — chamfered plates, thin rods, hard edges — so the site reads as one object
 * family rather than a gallery of unrelated demos.
 *
 * Geometry is only built when its page is first visited. A page nobody opens
 * costs nothing.
 */

export type StructureId = 'lattice' | 'stack' | 'helix' | 'archive';

/**
 * THE LATTICE — an instanced field of small chamfered blocks, carved by a
 * noise threshold so the volume has erosion rather than being a solid cube.
 * Reads as a material sample or a crystal lattice under magnification.
 */
export function buildLattice(divisions = 9) {
  const geometry = new THREE.BoxGeometry(0.13, 0.13, 0.13);
  const matrices: THREE.Matrix4[] = [];
  const half = (divisions - 1) / 2;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const pos = new THREE.Vector3();

  for (let x = 0; x < divisions; x++) {
    for (let y = 0; y < divisions; y++) {
      for (let z = 0; z < divisions; z++) {
        const nx = (x - half) / half;
        const ny = (y - half) / half;
        const nz = (z - half) / half;
        const r = Math.hypot(nx, ny, nz);

        // Carve: keep a shell, and punch it with a smooth 3D sine field so the
        // erosion looks structural rather than random.
        const carve =
          Math.sin(nx * 3.1) * Math.cos(ny * 2.7) + Math.sin(nz * 3.4) * 0.8;
        if (r > 1.02 || carve < -0.35) continue;

        pos.set(nx, ny, nz).multiplyScalar(1.05);
        // Blocks nearer the surface are slightly larger — the shell reads as
        // denser, which is what stops it looking like a uniform point cloud.
        const scale = 0.6 + r * 0.75;
        s.setScalar(scale);
        q.setFromEuler(new THREE.Euler(nx * 0.6, ny * 0.6, nz * 0.6));
        matrices.push(m.clone().compose(pos, q, s));
      }
    }
  }

  return { geometry, matrices };
}

/**
 * THE STACK — chamfered plates stacked and progressively rotated, forming a
 * twisted column. The rotation per plate is deliberately small: a big twist
 * reads as a decorative spiral, a small one reads as tolerance stack-up in a
 * machined assembly.
 */
export function buildStack(count = 14) {
  const shape = roundedRectShape(1.5, 0.42, 0.06);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.05,
    bevelEnabled: true,
    bevelThickness: 0.014,
    bevelSize: 0.014,
    bevelSegments: 2,
    curveSegments: 8,
  });
  geometry.center();

  const matrices: THREE.Matrix4[] = [];
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const s = new THREE.Vector3(1, 1, 1);
  const pos = new THREE.Vector3();

  const gap = 0.145;
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    pos.set(0, (i - (count - 1) / 2) * gap, 0);
    e.set(Math.PI / 2, 0, t * Math.PI * 0.62);
    q.setFromEuler(e);
    // Plates taper toward the ends, so the column has a waist.
    const taper = 0.72 + Math.sin(t * Math.PI) * 0.42;
    s.set(taper, 1, taper);
    matrices.push(m.clone().compose(pos, q, s));
  }

  return { geometry, matrices };
}

/**
 * THE HELIX — a swept ribbon following a double helix.
 *
 * Built as a TubeGeometry on a custom curve rather than a torus knot: a knot
 * is a recognisable maths-demo shape and would read as a screensaver. A helix
 * with a square-ish cross section reads as a machined spring.
 */
export function buildHelix(turns = 3.2, radius = 0.72, height = 2.4) {
  class HelixCurve extends THREE.Curve<THREE.Vector3> {
    constructor(private phase: number) {
      super();
    }
    getPoint(t: number, target = new THREE.Vector3()) {
      const a = t * Math.PI * 2 * turns + this.phase;
      // Radius breathes along the length so the coil is not a perfect cylinder.
      const r = radius * (0.78 + Math.sin(t * Math.PI) * 0.34);
      return target.set(Math.cos(a) * r, (t - 0.5) * height, Math.sin(a) * r);
    }
  }

  const strands = [0, Math.PI].map((phase) => {
    const g = new THREE.TubeGeometry(new HelixCurve(phase), 260, 0.028, 4, false);
    return g;
  });

  // The rungs between the strands — this is what makes it read as a structure
  // rather than two unrelated wires.
  //
  // Deliberately thin and sparse. The first version used 46 thick rungs in the
  // accent colour and the result was an orange tangle: because the strands are
  // 180° apart, every rung spans the full diameter, and at that density they
  // cross each other constantly. Fewer, finer, and in the same graphite as
  // everything else, they read as tie bars.
  const rungGeometry = new THREE.CylinderGeometry(0.0045, 0.0045, 1, 6);
  const rungs: THREE.Matrix4[] = [];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const mid = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const m = new THREE.Matrix4();
  const c0 = new HelixCurve(0);
  const c1 = new HelixCurve(Math.PI);

  const rungCount = 26;
  for (let i = 0; i <= rungCount; i++) {
    const t = i / rungCount;
    c0.getPoint(t, a);
    c1.getPoint(t, b);
    mid.addVectors(a, b).multiplyScalar(0.5);
    dir.subVectors(b, a);
    const len = dir.length();
    dir.normalize();
    q.setFromUnitVectors(up, dir);
    s.set(1, len, 1);
    rungs.push(m.clone().compose(mid, q, s));
  }

  return { strands, rungGeometry, rungs };
}

/**
 * THE ARCHIVE — one plate per credential, hung off a shared spine and fanned.
 *
 * This replaces a stack of thin bars that failed on two counts. It read as
 * scattered debris rather than as a form; and being a near-black metal lit only
 * by the rig, it fell to pure black at every camera angle where nothing caught
 * the rim — an invisible structure on the one page whose whole subject is 3D.
 *
 * The fix for the second problem is structural, not a lighting tweak: every
 * plate carries a self-lit seam along its outer edge (see `createSeamMaterial`),
 * which is unlit material and owes the light rig nothing. The object therefore
 * cannot go dark from any angle. The rig is still what shapes it — the cold
 * steel rim draws the plate faces as they turn — but it is no longer the only
 * thing keeping it on screen.
 *
 * The fix for the first is to make it mean something. Eleven plates, one per
 * row in the register below, stacked and fanned like cards in an index so you
 * read them edge-on. It is the page's own content as an object.
 *
 * Two rules it keeps from the bars it replaces. The plate lengths run off a
 * pair of sines with an irrational period ratio rather than off random(), so
 * the fan has a ragged outer edge — the shape a column of left-aligned text of
 * varying length makes — and it is stable between reloads instead of
 * reshuffling on every visit. And there is exactly one anodised element.
 *
 * Geometry is returned in its rest layout plus the per-plate parameters the
 * scene needs to re-fan it every frame; nothing here is animated, because a
 * builder that owns motion cannot be re-used at two different qualities.
 */
export interface ArchivePlate {
  /** Height on the spine, world units. */
  y: number;
  /** Resting yaw about the spine, radians. */
  angle: number;
  /** Length as a multiple of the base plate width. */
  length: number;
}

export function buildArchive(count = 11) {
  /** Plate proportions. A document, not a tile. */
  const width = 0.92;
  const depth = 0.6;
  const thickness = 0.017;
  const gap = 0.132;

  // The plate lies flat, so its extrusion depth is its THICKNESS and the shape
  // carries the footprint. Origin is moved to the spine edge afterwards, so a
  // per-plate X scale grows the plate outward instead of about its middle.
  const shape = roundedRectShape(width, depth, 0.035);
  const plateGeometry = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: 0.006,
    bevelSize: 0.006,
    bevelSegments: 2,
    curveSegments: 6,
  });
  plateGeometry.center();
  // Lay it flat — thickness becomes vertical — then move the pivot to the edge
  // that meets the spine.
  plateGeometry.rotateX(-Math.PI / 2);
  plateGeometry.translate(width / 2, 0, 0);

  /**
   * The seam. A hairline along the plate's outer edge, in its own geometry so
   * it can take an unlit material and a per-plate colour while the plate itself
   * stays a proper metal.
   */
  // Two things about this placement are load-bearing, and both were wrong once.
  //
  // It is translated by the FULL width, not half: the plate's pivot is already
  // at its spine edge and it spans 0..width from there, so half buries the seam
  // down the plate's centreline.
  //
  // And it stands PROUD of the plate rather than flush with it. Sitting exactly
  // on the edge, inside a thickness of `thickness`, the plate's own body
  // occluded the seam from every angle except dead-on, and all that survived
  // was the end cap — eleven bright dots instead of eleven lit edges. A hair
  // beyond the edge in X, and slightly taller than the plate is thick, means
  // there is no view direction in which the plate can hide it.
  const seamGeometry = new THREE.BoxGeometry(0.016, thickness * 1.45, depth * 0.99);
  seamGeometry.translate(width + 0.006, 0, 0);

  const plates: ArchivePlate[] = [];
  for (let i = 0; i < count; i++) {
    const t = count > 1 ? i / (count - 1) : 0;
    // Two octaves, no common divisor. One sine alone gives a lens, which is a
    // diagram; two give a ragged edge, which is a list.
    const length = 1 + Math.sin(t * 7.3) * 0.19 + Math.sin(t * 2.9 + 1.4) * 0.12;
    plates.push({
      y: (i - (count - 1) / 2) * gap,
      // Fanned, but not evenly: a constant step reads as a machine part. The
      // second term crowds the middle of the stack slightly, the way a deck of
      // cards actually sits.
      angle: (t - 0.5) * 1.02 + Math.sin(t * Math.PI * 2) * 0.075,
      length,
    });
  }

  /** The spine every plate hangs from. Full height, with a little overshoot. */
  const spineGeometry = new THREE.CylinderGeometry(
    0.014,
    0.014,
    count * gap + 0.26,
    10,
  );

  return { plateGeometry, seamGeometry, spineGeometry, plates, width };
}

function roundedRectShape(w: number, h: number, r: number): THREE.Shape {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
