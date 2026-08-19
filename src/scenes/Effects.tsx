'use client';

import {
  Bloom,
  ChromaticAberration,
  EffectComposer,
  Noise,
  Vignette,
} from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import { useMemo } from 'react';
import * as THREE from 'three';

import { POST } from '@/config/animation';

/**
 * POST STACK — order matters and is not arbitrary.
 *
 *   Bloom        low intensity, high threshold. Only the chamfer highlights
 *                and the ember keeper should ever cross it. Anything more and
 *                the near-black material starts to look like it is glowing.
 *   Aberration   0.00055 — barely measurable, but it is what stops the render
 *                looking digitally clean. Radial, so the centre stays crisp.
 *   Noise        overlay blend, 0.028. Grain is doing the heaviest lifting of
 *                anything here: it hides gradient banding, which is otherwise
 *                unavoidable on a #08080A page, and it reads as film.
 *   Vignette     last, gentle. Pulls the eye to the mark.
 *
 * Mobile drops everything but Bloom.
 */
export function Effects({ mobile }: { mobile: boolean }) {
  const caOffset = useMemo(
    () => new THREE.Vector2(POST.chromaticAberration, POST.chromaticAberration * 0.6),
    [],
  );

  if (mobile) {
    return (
      <EffectComposer multisampling={0} enableNormalPass={false}>
        <Bloom
          intensity={POST.bloom.intensity * 0.85}
          luminanceThreshold={POST.bloom.threshold}
          luminanceSmoothing={POST.bloom.smoothing}
          mipmapBlur
        />
      </EffectComposer>
    );
  }

  /*
   * MULTISAMPLING IS OFF, AND THAT IS A MEASURED DECISION.
   *
   * This was 4. MSAA on the composer's targets multiplies the samples taken by
   * every full-screen pass in the stack — bloom's mip chain, the aberration,
   * the grain, the vignette — and this site is fill-rate bound, which was
   * measured rather than assumed: shrinking the canvas from 1.79M pixels to
   * 256k took the BEST achievable frame from 33.4ms to 3.5ms. Cost that falls
   * that hard with pixel count is fill, and 4x MSAA is a 4x multiplier on the
   * most expensive pixels in the frame.
   *
   * What it buys back is edge quality on the mark's chamfers. What already
   * covers that: bloom softens exactly the high-contrast edges MSAA would have
   * smoothed, and the grain sits over the whole frame. The mobile path above
   * has run at 0 since it was written, for the same reason.
   *
   * If aliasing ever reads as cheap on the mark, the answer is 2 rather than a
   * return to 4 — but look at it on screen before paying for it again.
   */
  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      {/* There was a scene blur/desaturate pass here, driven by the menu. It
          is gone on purpose: the drawer is opaque and the scene beside it
          stays sharp, so the pass existed only to run a fullscreen blur at
          strength zero on every frame of the site's life. */}
      <Bloom
        intensity={POST.bloom.intensity}
        luminanceThreshold={POST.bloom.threshold}
        luminanceSmoothing={POST.bloom.smoothing}
        mipmapBlur
      />
      <ChromaticAberration
        blendFunction={BlendFunction.NORMAL}
        offset={caOffset}
        radialModulation
        modulationOffset={0.32}
      />
      {/*
        SOFT_LIGHT, not OVERLAY.

        OVERLAY is the usual film-grain choice and it is correct right up until
        the frame contains something bright. Its formula amplifies hard above
        0.5, so the one light-background element on this site — the project
        screenshot — came out as violent black-and-white speckle. SOFT_LIGHT
        has the same effect on the dark 95% of the frame and degrades gracefully
        on the other 5%.

        `premultiply` is also gone: it scales the noise by the input colour,
        which compounds exactly the same problem.
      */}
      <Noise blendFunction={BlendFunction.SOFT_LIGHT} opacity={POST.noise} />
      <Vignette
        offset={POST.vignette.offset}
        darkness={POST.vignette.darkness}
        blendFunction={BlendFunction.NORMAL}
      />
    </EffectComposer>
  );
}
