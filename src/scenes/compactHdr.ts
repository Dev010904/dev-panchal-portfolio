import * as THREE from 'three';

/**
 * R11F_G11F_B10F — HALF THE BYTES, THE SAME PICTURE.
 *
 * Every buffer the frame moves through at full size was RGBA16F: eight bytes a
 * pixel, two of them an alpha channel nothing reads (the canvas is opaque, and
 * the glass samples its buffer's alpha as 1 either way). R11F_G11F_B10F keeps
 * what those buffers are for — HDR, so the ember and the bolts still clear the
 * bloom threshold instead of clipping at 1.0 — in four bytes, by dropping alpha
 * and trimming each mantissa to 6/6/5 bits.
 *
 * On an Iris Xe at 1872x958 this site is bandwidth-bound, not shading-bound:
 * the costly passes are the MSAA resolves, the bloom threshold and the mip
 * chain, not the shaders. So halving the bytes is most of the frame. Measured
 * A/B on the deployed site, alternating so drift could not favour either side:
 *
 *   hero, at rest    GPU 11.5ms → ~8ms (median); missed vsyncs ~1 in 3 → ~1 in 20
 *   glass hover      25fps → 40fps, the transmission buffer being the largest
 *                    single cost in that state
 *
 * WHAT IT COSTS IN THE PICTURE, MEASURED RATHER THAN ARGUED: consecutive
 * frames read back across the switch differ by less than two ordinary frames
 * differ from each other (0.8 vs 0.9 levels mean absolute, grain and all). The
 * one systematic shift is blue, lower by a third of one 8-bit level, because
 * the conversion truncates. The 5-bit blue mantissa is finer than the 8-bit
 * output everywhere below mid-grey, which on a #08080A page is nearly all of
 * it, and the grain dithers the rest.
 */
export const COMPACT_HDR = 'R11F_G11F_B10F' as const;

/**
 * Colour-renderable under EXT_color_buffer_float, like half float. A
 * multisampled target also needs the driver to offer that many samples for
 * this format, which is a separate question with a separate answer.
 */
export function compactHdrSupported(renderer: THREE.WebGLRenderer, samples: number) {
  const gl = renderer.getContext();
  if (typeof WebGL2RenderingContext === 'undefined' || !(gl instanceof WebGL2RenderingContext)) return false;
  if (!renderer.extensions.has('EXT_color_buffer_float')) return false;
  if (samples === 0) return true;
  const counts = gl.getInternalformatParameter(gl.RENDERBUFFER, gl.R11F_G11F_B10F, gl.SAMPLES) as Int32Array | null;
  return !!counts && Array.prototype.some.call(counts, (n: number) => n >= samples);
}

/**
 * Only ever from half float — that is what these buffers were chosen to hold,
 * and R11F_G11F_B10F is not a valid pairing with 8-bit data. Returns whether
 * the target now uses the compact format.
 */
export function compactHdr(target: THREE.WebGLRenderTarget) {
  const texture = target.texture;
  if (texture.internalFormat === COMPACT_HDR) return true;
  if (texture.type !== THREE.HalfFloatType) return false;
  texture.format = THREE.RGBFormat;
  texture.internalFormat = COMPACT_HDR;
  // Reallocated on its next use, in the new format; a no-op if it never has
  // been. A resize keeps it: three rebuilds a target from these same settings.
  target.dispose();
  return true;
}

/**
 * THE GLASS STATE'S BUFFER.
 *
 * Hovering the mark turns it to glass, and glass in three is a transmission
 * pass: a whole extra render of the scene into a private full-size target —
 * 4x multisampled, mipmapped, half float — resolved and mipmapped TWICE a
 * frame, because the glass is double-sided and its back faces are drawn into
 * the same buffer the front faces then refract. That buffer was the largest
 * single cost in the frame while the glass was up.
 *
 * three r171 builds it privately and exposes no handle, so the only moment it
 * is visible is the call that binds it. This watches `setRenderTarget` for that
 * one call, switches the target to the compact format BEFORE it is first
 * allocated — so it is never built twice — and then takes itself back off.
 * The target is recognised by what three builds it with: 4 samples and a mip
 * chain, which nothing else in this scene has.
 */
export function compactTransmissionTarget(renderer: THREE.WebGLRenderer) {
  const original = renderer.setRenderTarget;
  const watch: typeof original = function (this: THREE.WebGLRenderer, target, ...rest) {
    const texture = target && !Array.isArray(target.texture) ? target.texture : null;
    if (
      target &&
      texture &&
      target.samples === 4 &&
      texture.generateMipmaps &&
      texture.minFilter === THREE.LinearMipmapLinearFilter
    ) {
      renderer.setRenderTarget = original;
      if (compactHdrSupported(renderer, target.samples)) compactHdr(target as THREE.WebGLRenderTarget);
    }
    return original.call(this, target, ...rest);
  };
  renderer.setRenderTarget = watch;
  return () => {
    if (renderer.setRenderTarget === watch) renderer.setRenderTarget = original;
  };
}
