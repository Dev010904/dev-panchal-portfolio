/**
 * RENDER BACKEND — capability detection and the single source of truth for
 * which GPU API this session is actually running on.
 *
 * The site ships on `WebGLRenderer` today. This module exists anyway, and it is
 * not speculative scaffolding: it is the seam the WebGPU migration needs, and
 * having it here means the HUD, the QA harness and every quality tier already
 * ask one question instead of six components each sniffing for `navigator.gpu`
 * and disagreeing about the answer.
 *
 * WHAT IS ACTUALLY TRUE TODAY — see docs/WEBGPU-MIGRATION.md for the full
 * account, because the summary below is the load-bearing part:
 *
 *   `three@0.171` ships `three/webgpu` and `three/tsl`, and `@react-three/fiber`
 *   9.6.1 supports an async custom renderer. So the swap is *possible*. What it
 *   is not is free: `@react-three/postprocessing` is WebGL-only, so the entire
 *   grade — bloom, aberration, the SOFT_LIGHT grain, the vignette — stops
 *   existing the moment `WebGPURenderer` is installed. That is a regression, and
 *   the brief's own gate forbids it.
 *
 * So `active()` reports WEBGL and tells the truth. `supported()` reports what
 * the device could do. The two being different is the honest state of things,
 * and the HUD shows both rather than implying a capability the page is not
 * using.
 */

export type Backend = 'webgpu' | 'webgl2' | 'webgl' | 'none';

/**
 * The one bit of the WebGPU surface this file touches.
 *
 * Declared locally rather than as a global `Navigator.gpu` on purpose. TypeScript
 * 5.7's lib.dom has no WebGPU types, so `'gpu' in navigator` narrows to `unknown`
 * and a truthiness check narrows that to `{}` — which is where the
 * `requestAdapter does not exist` error comes from. A global declaration would
 * fix it and then collide with `@webgpu/types` the moment the migration adds it
 * as a real dependency. A local shape cannot collide with anything.
 */
type GpuLike = { requestAdapter(): Promise<unknown> };

function gpuOf(nav: Navigator): GpuLike | null {
  const g = (nav as Navigator & { gpu?: unknown }).gpu;
  return g && typeof (g as GpuLike).requestAdapter === 'function' ? (g as GpuLike) : null;
}

let cachedSupport: Backend | null = null;

/**
 * The best backend this device could run, independent of what we chose.
 *
 * Deliberately synchronous and deliberately shallow. `navigator.gpu` existing is
 * not proof an adapter can be acquired — that needs an await and can fail on a
 * blocklisted driver — so this is a capability *hint*, and anything that would
 * break on being wrong must call `probeWebGPU()` and wait for the real answer.
 */
export function supported(): Backend {
  if (cachedSupport) return cachedSupport;
  if (typeof window === 'undefined') return 'none';

  if (gpuOf(navigator)) {
    cachedSupport = 'webgpu';
    return cachedSupport;
  }

  // A context probe, not a WEBGL_debug_renderer_info sniff. The debug extension
  // is fingerprinting surface and is being locked down; creating a throwaway
  // context answers the only question that matters and costs nothing once.
  try {
    const c = document.createElement('canvas');
    if (c.getContext('webgl2')) cachedSupport = 'webgl2';
    else if (c.getContext('webgl')) cachedSupport = 'webgl';
    else cachedSupport = 'none';
  } catch {
    cachedSupport = 'none';
  }
  return cachedSupport;
}

/**
 * Does an adapter actually exist? Resolves false on a machine that exposes
 * `navigator.gpu` but cannot hand out a device — which is the common shape of a
 * WebGPU failure, and the reason a bare `'gpu' in navigator` check ships broken
 * sites.
 */
export async function probeWebGPU(): Promise<boolean> {
  if (typeof navigator === 'undefined') return false;
  const gpu = gpuOf(navigator);
  if (!gpu) return false;
  try {
    return (await gpu.requestAdapter()) != null;
  } catch {
    return false;
  }
}

/**
 * What the site is rendering with RIGHT NOW.
 *
 * Resolved from the live renderer instance rather than from a build flag, so it
 * cannot lie: if the WebGPU path is ever switched on and silently falls back,
 * this reports the fallback.
 */
export function active(gl: unknown): Backend {
  const r = gl as { isWebGPURenderer?: boolean; backend?: { isWebGPUBackend?: boolean } } | null;
  if (r?.isWebGPURenderer) {
    return r.backend?.isWebGPUBackend ? 'webgpu' : 'webgl2';
  }
  const legacy = gl as { getContext?: () => unknown } | null;
  try {
    const ctx = legacy?.getContext?.();
    if (typeof WebGL2RenderingContext !== 'undefined' && ctx instanceof WebGL2RenderingContext) {
      return 'webgl2';
    }
  } catch {
    /* a renderer with no getContext is not a WebGL renderer */
  }
  return 'webgl';
}

/** Uppercase label for the HUD and the QA harness. */
export function label(b: Backend): string {
  return b === 'webgpu' ? 'WEBGPU' : b === 'webgl2' ? 'WEBGL2' : b === 'webgl' ? 'WEBGL' : 'NONE';
}
