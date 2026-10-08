import * as THREE from 'three';

/**
 * A TILEABLE NOISE TEXTURE, BAKED ONCE IN CODE.
 *
 * Two decorrelated octave sums of value noise, one per channel, wrapping
 * seamlessly at the edge. The fire reads it three times per pixel instead of
 * evaluating simplex fbm per pixel. That is the difference that makes a
 * many-puff fireball affordable on integrated graphics: three fetches from a
 * 32KB texture that lives in cache against ~150 ALU per octave per puff. The
 * last smoke on this site that did it the expensive way held an Iris Xe at
 * 20fps.
 *
 * Nothing is downloaded — same rule as every other asset in the scene.
 */
export function createNoiseTexture(size = 128, seed = 7): THREE.DataTexture {
  const data = new Uint8Array(size * size * 2);

  // Deterministic, so every visitor gets the same texture and a bug report
  // describes the same pixels.
  let s = seed >>> 0;
  const rnd = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  /** One octave: a `cells`-wide lattice that wraps, sampled with a quintic fade. */
  const octave = (cells: number) => {
    const lattice = new Float32Array(cells * cells);
    for (let i = 0; i < lattice.length; i++) lattice[i] = rnd();
    const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
    return (x: number, y: number) => {
      const fx = (x / size) * cells;
      const fy = (y / size) * cells;
      const x0 = Math.floor(fx);
      const y0 = Math.floor(fy);
      const tx = fade(fx - x0);
      const ty = fade(fy - y0);
      const a = x0 % cells;
      const b = y0 % cells;
      const a1 = (a + 1) % cells;
      const b1 = (b + 1) % cells;
      const top = lattice[b * cells + a] * (1 - tx) + lattice[b * cells + a1] * tx;
      const bot = lattice[b1 * cells + a] * (1 - tx) + lattice[b1 * cells + a1] * tx;
      return top * (1 - ty) + bot * ty;
    };
  };

  const channel = () => {
    const octaves = [4, 8, 16, 32].map(octave);
    const weights = [0.5, 0.27, 0.15, 0.08];
    return (x: number, y: number) =>
      octaves.reduce((sum, o, i) => sum + o(x, y) * weights[i], 0);
  };

  // An octave sum huddles around 0.5 — most of it would land in the middle
  // third of the byte range. Each channel is stretched to the full 0..1 so the
  // shader's thresholds mean what they say.
  for (let c = 0; c < 2; c++) {
    const sample = channel();
    const values = new Float32Array(size * size);
    let lo = Infinity;
    let hi = -Infinity;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const v = sample(x, y);
        values[y * size + x] = v;
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
    }
    const span = hi - lo || 1;
    for (let i = 0; i < values.length; i++) {
      data[i * 2 + c] = Math.round(((values[i] - lo) / span) * 255);
    }
  }

  const tex = new THREE.DataTexture(data, size, size, THREE.RGFormat, THREE.UnsignedByteType);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}
