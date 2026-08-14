import * as THREE from 'three';

/**
 * A DOUBLE-BUFFERED FLOAT TARGET, AND THE THING THAT STEPS IT.
 *
 * This is the whole host-side surface of the particle simulation. Everything
 * above it — the Lab component — only ever calls `step()` and reads
 * `current.texture`. Everything below it is one fullscreen fragment shader per
 * buffer.
 *
 * ── WHY IT IS SHAPED THIS WAY: THE WEBGPU PORT ────────────────────────────
 *
 * The eventual WebGPU version replaces the fragment shader with a compute
 * shader and the render targets with storage buffers. That is a real change,
 * but it is a change to the EXECUTOR, not to the caller: `step(dt)` still
 * steps, `current` still names the buffer holding this frame's state, and the
 * physics still reads (position, velocity, uniforms) and writes the next pair.
 *
 * So the split here is deliberate:
 *
 *   - the PHYSICS lives in `shaders/sim/simCore.glsl` as pure functions with
 *     no texture fetches and no `gl_FragCoord` in them. That file is the part
 *     that ports, near enough line for line, into WGSL.
 *   - the PLUMBING — reading a texel, writing a texel, swapping buffers — lives
 *     in the two thin `.frag` wrappers and in this class. That is the part that
 *     gets thrown away.
 *
 * A simulation written with the physics inlined into the fragment shader works
 * exactly as well and cannot be ported without being rewritten, which is the
 * situation docs/WEBGPU-MIGRATION.md exists to avoid repeating.
 */

export interface PingPongOptions {
  size: number;
  renderer: THREE.WebGLRenderer;
}

export class PingPong {
  readonly size: number;
  private renderer: THREE.WebGLRenderer;
  private a: THREE.WebGLRenderTarget;
  private b: THREE.WebGLRenderTarget;
  private front = true;

  constructor({ size, renderer }: PingPongOptions) {
    this.size = size;
    this.renderer = renderer;
    this.a = PingPong.makeTarget(size);
    this.b = PingPong.makeTarget(size);
  }

  /**
   * `NearestFilter` is not a quality trade — it is correctness. Every texel is
   * one particle's state, and there is no meaning to the value halfway between
   * particle 900 and particle 901. Linear filtering here silently averages
   * unrelated particles whenever a sample lands off-centre.
   */
  private static makeTarget(size: number): THREE.WebGLRenderTarget {
    return new THREE.WebGLRenderTarget(size, size, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat,
      type: THREE.FloatType,
      depthBuffer: false,
      stencilBuffer: false,
      generateMipmaps: false,
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
    });
  }

  /** The buffer holding the CURRENT state — what the render pass should read. */
  get current(): THREE.WebGLRenderTarget {
    return this.front ? this.a : this.b;
  }

  /** The buffer being written this step. */
  get next(): THREE.WebGLRenderTarget {
    return this.front ? this.b : this.a;
  }

  swap(): void {
    this.front = !this.front;
  }

  /**
   * Seed both buffers from a Float32Array of RGBA texels.
   *
   * BOTH, deliberately. Seeding only the front buffer leaves the back one
   * full of zeros, and the very first swap presents that to the renderer —
   * every particle at the origin for one frame, which reads as the field
   * collapsing and re-exploding on entry.
   */
  seed(data: Float32Array): void {
    // `data` is widened to the DataTexture's expected buffer type. Float32Array
    // is structurally correct; the mismatch is only that TS models a typed
    // array's `buffer` as possibly shared.
    const tex = new THREE.DataTexture(
      data as unknown as Float32Array<ArrayBuffer>,
      this.size,
      this.size,
      THREE.RGBAFormat,
      THREE.FloatType,
    );
    tex.needsUpdate = true;

    const quad = new FullScreenPass(
      `
      precision highp float;
      out vec4 fragColor;
      uniform sampler2D uSrc;
      uniform vec2 uSize;
      void main() { fragColor = textureLod(uSrc, gl_FragCoord.xy / uSize, 0.0); }
      `,
      { uSrc: { value: tex }, uSize: { value: new THREE.Vector2(this.size, this.size) } },
    );

    quad.renderTo(this.renderer, this.a);
    quad.renderTo(this.renderer, this.b);
    quad.dispose();
    tex.dispose();
  }

  dispose(): void {
    this.a.dispose();
    this.b.dispose();
  }
}

/**
 * One fullscreen triangle and the machinery to draw it into a target.
 *
 * A TRIANGLE, not a quad. Two triangles meeting on the diagonal make the GPU
 * shade the fragments along that seam twice, and at 500k texels that seam is
 * ~700 wasted invocations per pass per frame for nothing. A single oversized
 * triangle clipped to the viewport covers the same area with no seam — the
 * standard trick, and it matters more here than it does for a post effect
 * because this runs twice a frame.
 */
export class FullScreenPass {
  readonly material: THREE.RawShaderMaterial;
  private mesh: THREE.Mesh;
  private scene: THREE.Scene;
  private camera: THREE.Camera;
  private geometry: THREE.BufferGeometry;

  constructor(fragmentShader: string, uniforms: Record<string, THREE.IUniform>) {
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3),
    );

    this.material = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: `
        precision highp float;
        in vec3 position;
        void main() { gl_Position = vec4(position, 1.0); }
      `,
      fragmentShader,
      uniforms,
      depthTest: false,
      depthWrite: false,
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;
    this.scene = new THREE.Scene();
    this.scene.add(this.mesh);
    this.camera = new THREE.Camera();
  }

  renderTo(renderer: THREE.WebGLRenderer, target: THREE.WebGLRenderTarget): void {
    const prev = renderer.getRenderTarget();
    renderer.setRenderTarget(target);
    renderer.render(this.scene, this.camera);
    renderer.setRenderTarget(prev);
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}

/**
 * WHAT THIS DEVICE CAN ACTUALLY DO.
 *
 * A FIXED LADDER, never a continuous scale. The particle count is reported in
 * the telemetry HUD, and a number that drifts is not telemetry — it is noise
 * that makes every other reading unreproducible. Four rungs, each a square
 * texture, each an exact count.
 *
 * The first check is not a preference, it is a hard gate: without
 * `EXT_color_buffer_float` a float target cannot be rendered to at all, the
 * simulation has nowhere to write, and the only correct answer is the CPU
 * path that was already there.
 */
export const PARTICLE_TIERS = [
  { name: 'ultra', size: 707, count: 707 * 707 },
  { name: 'high', size: 592, count: 592 * 592 },
  { name: 'medium', size: 500, count: 500 * 500 },
] as const;

export type ParticleTier = (typeof PARTICLE_TIERS)[number];

export interface Capability {
  tier: ParticleTier | null;
  /** Why this rung, in a form the HUD and a bug report can both use. */
  reason: string;
  renderer: string;
}

/**
 * Cached per renderer. Two callers need this answer — the call site, to decide
 * which of the two fields mounts, and the field itself, to size its buffers —
 * and they must not be able to disagree. Caching also keeps the answer stable
 * across React re-renders and Strict Mode double-invocation, which a fresh
 * `getExtension` probe is not obliged to be.
 */
const capCache = new WeakMap<THREE.WebGLRenderer, Capability>();

export function probeCapability(renderer: THREE.WebGLRenderer): Capability {
  const cached = capCache.get(renderer);
  if (cached) return cached;
  const result = runProbe(renderer);
  capCache.set(renderer, result);
  return result;
}

function runProbe(renderer: THREE.WebGLRenderer): Capability {
  const gl = renderer.getContext();

  // Hard gate. No float colour attachment, no simulation.
  const floatOk =
    gl.getExtension('EXT_color_buffer_float') !== null ||
    gl.getExtension('WEBGL_color_buffer_float') !== null;

  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  const name = dbg
    ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL))
    : 'unknown renderer';

  if (!floatOk) {
    return { tier: null, reason: 'no EXT_color_buffer_float', renderer: name };
  }

  const maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
  if (maxTex < PARTICLE_TIERS[PARTICLE_TIERS.length - 1].size) {
    return { tier: null, reason: `MAX_TEXTURE_SIZE ${maxTex} too small`, renderer: name };
  }

  /**
   * Tiering off the renderer string is crude and it is the only signal the
   * platform gives. There is no "how fast is this GPU" query in WebGL, and the
   * alternative — a timed warm-up — costs a visible stall on first arrival and
   * is exactly as unreliable on a machine that is briefly busy.
   *
   * The bias is deliberately pessimistic. Guessing one rung low costs some
   * particles nobody counts; guessing high on integrated graphics costs the
   * frame rate of the section, and this project has already hung a browser
   * once this session by being optimistic about an Intel Iris Xe.
   */
  const s = name.toLowerCase();
  const integrated =
    s.includes('intel') || s.includes('uhd') || s.includes('iris') || s.includes('mali') || s.includes('adreno');
  const discrete =
    s.includes('nvidia') || s.includes('geforce') || s.includes('rtx') || s.includes('radeon') ||
    s.includes('apple m');

  if (integrated) return { tier: PARTICLE_TIERS[2], reason: 'integrated GPU', renderer: name };
  if (discrete) return { tier: PARTICLE_TIERS[0], reason: 'discrete GPU', renderer: name };
  return { tier: PARTICLE_TIERS[1], reason: 'unrecognised GPU, middle rung', renderer: name };
}
