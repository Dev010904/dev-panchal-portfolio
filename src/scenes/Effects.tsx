'use client';

import { useThree } from '@react-three/fiber';
import { EffectComposer } from '@react-three/postprocessing';
import {
  BlendFunction,
  BloomEffect,
  ChromaticAberrationEffect,
  type EffectComposer as EffectComposerImpl,
  EffectPass,
  NoiseEffect,
  VignetteEffect,
} from 'postprocessing';
import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';

import { POST } from '@/config/animation';
import { compactHdr, compactHdrSupported } from '@/scenes/compactHdr';

/**
 * POST STACK — order matters and is not arbitrary.
 *
 *   Bloom        low intensity, high threshold. Only the chamfer highlights
 *                and the ember keeper should ever cross it. Anything more and
 *                the near-black material starts to look like it is glowing.
 *   Aberration   barely measurable, but it is what stops the render looking
 *                digitally clean. Radial, so the centre stays crisp.
 *   Noise        soft-light grain. Doing the heaviest lifting of anything here:
 *                it hides gradient banding, which is otherwise unavoidable on a
 *                #08080A page, and it reads as film.
 *   Vignette     last, gentle. Pulls the eye to the mark.
 *
 * Mobile drops everything but Bloom.
 *
 * ── SAME PICTURE, ONE FULLSCREEN PASS INSTEAD OF THREE ────────────────────
 *
 * @react-three/postprocessing groups effects into passes by itself, and a
 * convolution effect — the aberration — ends its group: bloom, then the
 * aberration alone, then grain + vignette. Three fullscreen passes, each one
 * a full read and write of a half-float frame, which measured ~5ms apiece on
 * an Iris Xe at 1872x958.
 *
 * The rule postprocessing itself enforces is narrower: two convolution
 * effects cannot share a pass, and a convolution effect must come first in
 * the one it is in, because it samples the pass's INPUT at offsets. So all
 * four are built by hand into one EffectPass — aberration, bloom, grain,
 * vignette — and handed to the composer as a pass. Same effects, same
 * parameters.
 *
 * The one difference is that bloom now lands after the aberration instead of
 * before it, so the glow itself is not colour-split. The split is 0.0003 of
 * the frame, radial, zero across the middle third — about half a pixel at the
 * very edge of a 1080p frame — applied to a glow that is a wide blur to begin
 * with. It is not a visible difference; the pass it saves is ~5ms.
 */
export function Effects({ mobile }: { mobile: boolean }) {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);

  /**
   * Aberration → bloom → grain → vignette, one pass. Parameters as before,
   * verbatim. Mobile is the bloom alone, built by hand exactly as <Bloom>
   * built it — additive, 0.85 of the desktop intensity — so that both paths
   * hand the composer a pass, and both expose the bloom whose buffers the
   * effect below re-formats.
   */
  const post = useMemo(() => {
    // As <Bloom> built it: additive, and the four props the component was given.
    const bloom = new BloomEffect({
      blendFunction: BlendFunction.ADD,
      intensity: POST.bloom.intensity * (mobile ? 0.85 : 1),
      luminanceThreshold: POST.bloom.threshold,
      luminanceSmoothing: POST.bloom.smoothing,
      mipmapBlur: true,
    });
    if (mobile) return { bloom, pass: new EffectPass(camera, bloom) };

    const aberration = new ChromaticAberrationEffect({
      offset: new THREE.Vector2(POST.chromaticAberration, POST.chromaticAberration * 0.6),
      radialModulation: true,
      modulationOffset: 0.32,
    });
    aberration.blendMode.blendFunction = BlendFunction.NORMAL;

    /*
      SOFT_LIGHT, not OVERLAY.

      OVERLAY is the usual film-grain choice and it is correct right up until
      the frame contains something bright. Its formula amplifies hard above
      0.5, so the one light-background element on this site — the project
      screenshot — came out as violent black-and-white speckle. SOFT_LIGHT
      has the same effect on the dark 95% of the frame and degrades gracefully
      on the other 5%.

      `premultiply` is also off: it scales the noise by the input colour,
      which compounds exactly the same problem.
    */
    const grain = new NoiseEffect({ blendFunction: BlendFunction.SOFT_LIGHT, premultiply: false });
    grain.blendMode.opacity.value = POST.noise;

    const vignette = new VignetteEffect({
      blendFunction: BlendFunction.NORMAL,
      offset: POST.vignette.offset,
      darkness: POST.vignette.darkness,
    });

    return { bloom, pass: new EffectPass(camera, aberration, bloom, grain, vignette) };
  }, [camera, mobile]);

  // A primitive is not disposed by R3F; this pass owns its effects and a material.
  useEffect(() => () => post.pass.dispose(), [post]);

  /**
   * ONLY THE SCENE TARGET IS MULTISAMPLED, AND NOTHING RESOLVES DEPTH.
   *
   * postprocessing builds its second buffer as `inputBuffer.clone()`, so with
   * `multisampling={2}` BOTH ping-pong buffers carried two samples and a depth
   * buffer. Every fullscreen pass that wrote to one paid for multisampled
   * writes and a resolve — colour AND depth — to antialias a quad that has no
   * edges, and depth that no pass reads. On ANGLE's D3D11 path a depth resolve
   * is not a plain blit (three.js already refuses stencil resolves there for
   * the same reason).
   *
   * The scene still renders into a 2-sample target with a depth buffer — that
   * is what draws the clean edge on the mark — and resolves its colour. The
   * second buffer, which only ever receives fullscreen passes, gets neither
   * samples nor depth. The picture is identical; only unused work goes.
   */
  const [composer, setComposer] = useState<EffectComposerImpl | null>(null);
  useEffect(() => {
    if (!composer) return;
    composer.inputBuffer.resolveDepthBuffer = false;
    composer.inputBuffer.resolveStencilBuffer = false;
    const out = composer.outputBuffer;
    if (out.samples !== 0 || out.depthBuffer) {
      out.samples = 0;
      out.depthBuffer = false;
      // Reallocated on its next use, with the settings above.
      out.dispose();
    }

    // Half the bytes in every full-size buffer, same picture — see
    // scenes/compactHdr.ts for the measurements on both counts.
    if (!compactHdrSupported(gl, composer.inputBuffer.samples)) return;
    for (const target of [composer.inputBuffer, out, ...bloomTargets(post.bloom)]) compactHdr(target);
  }, [composer, gl, post]);

  /*
   * MULTISAMPLING IS 2, AFTER LOOKING AT IT ON SCREEN.
   *
   * The note that used to sit here set 0 and said: if aliasing ever reads as
   * cheap on the mark, the answer is 2 rather than a return to 4 — but look at
   * it on screen first. Looked at, zoomed, on the deployed site: the mark's
   * bowl silhouette is a hard stair-step, and the chromatic aberration lands a
   * magenta fringe on each step, which is the worst possible pairing. Whatever
   * the frame budget says, that is not shippable on a site whose subject is a
   * machined object. (Tried again at 0 on 2026-09-30 for frame rate: the
   * chamfer rims broke into dashes at once. It stays 2; see the note above on
   * where its cost actually was.)
   *
   * MSAA does NOT multiply the full-screen passes — provided they do not
   * render into a multisampled target, which until the change above they did.
   * Nor does it multiply shader cost inside the scene: MSAA evaluates the
   * fragment shader once per pixel per primitive and writes the result to the
   * covered samples, so the expensive raymarch is not run twice. What 2x costs
   * is sample memory and the resolve blit — bandwidth, not shading.
   */
  return (
    <EffectComposer ref={setComposer} multisampling={mobile ? 0 : 2} enableNormalPass={false}>
      {/* There was a scene blur/desaturate pass here, driven by the menu. It
          is gone on purpose: the drawer is opaque and the scene beside it
          stays sharp, so the pass existed only to run a fullscreen blur at
          strength zero on every frame of the site's life. */}
      <primitive object={post.pass} dispose={null} />
    </EffectComposer>
  );
}

/**
 * The bloom's full- and half-size targets: its luminance threshold, and the
 * mip chain's two ladders. postprocessing 6.39 keeps these on fields its types
 * do not declare, so they are read defensively — if an upgrade moves them,
 * bloom simply keeps its own format.
 */
function bloomTargets(bloom: BloomEffect): THREE.WebGLRenderTarget[] {
  const internals = bloom as unknown as {
    luminancePass?: { renderTarget?: unknown };
    mipmapBlurPass?: { downsamplingMipmaps?: unknown[]; upsamplingMipmaps?: unknown[] };
  };
  return [
    internals.luminancePass?.renderTarget,
    ...(internals.mipmapBlurPass?.downsamplingMipmaps ?? []),
    ...(internals.mipmapBlurPass?.upsamplingMipmaps ?? []),
  ].filter((t): t is THREE.WebGLRenderTarget => (t as THREE.WebGLRenderTarget | undefined)?.isWebGLRenderTarget === true);
}
