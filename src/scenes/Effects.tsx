'use client';

import { useThree } from '@react-three/fiber';
import {
  Bloom,
  ChromaticAberration,
  EffectComposer,
  Noise,
  Vignette,
} from '@react-three/postprocessing';
import { BlendFunction, type EffectComposer as EffectComposerImpl } from 'postprocessing';
import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';

import { POST } from '@/config/animation';
import { useScene } from '@/store/scene';

/**
 * POST STACK — order matters and is not arbitrary.
 *
 *   Bloom        low intensity, high threshold. Only the chamfer highlights
 *                and the ember keeper should ever cross it. Anything more and
 *                the near-black material starts to look like it is glowing.
 *   Noise        grain. Doing the heaviest lifting of anything here: it hides
 *                gradient banding, which is otherwise unavoidable on a #08080A
 *                page, and it reads as film.
 *   Vignette     gentle. Pulls the eye to the mark.
 *   Aberration   LAST, and on the full tier only. See below.
 *
 * ── PASS COUNT IS THE COST, AND THE ORDER DECIDES THE PASS COUNT ──────────
 *
 * The composer merges consecutive effects into one fullscreen pass, and a
 * CONVOLUTION effect — the aberration is one — can share a pass with nothing.
 * With the aberration second, the stack ran as three fullscreen passes:
 * [bloom] [aberration] [grain + vignette]. On an Iris Xe at 1872x958 every
 * one of those cost about 5ms of GPU time. Moved to the end it is two, and
 * off it is one. The picture is the same to within a sub-pixel shift: at
 * 0.0003 the aberration moves a channel about half a pixel at the edge of a
 * 1080p frame, and whether that happens before or after the grain is not
 * something an eye can resolve.
 *
 * ── TWO TIERS, CHOSEN BY MEASUREMENT ──────────────────────────────────────
 *
 *   full   MSAA 2, half-float buffers, aberration. The stack as designed.
 *   lean   no MSAA, 8-bit buffers, no aberration.
 *
 * Every page load boots lean and the quality governor promotes to full only
 * when the GPU has measured room for it (scenes/QualityGovernor.tsx).
 *
 * The full tier is the one the notes below argue for, and they are right
 * about what it buys — a clean silhouette on a machined object. What they did
 * not have was its price on common hardware: on the Iris Xe, MSAA 2 alone
 * measured ~14.5ms per frame, and the whole full stack ~37ms. The site was
 * running at 20fps on the kind of laptop most visitors own, and the governor
 * exists so that machine gets 60 while a machine with room still gets the edge.
 *
 * Lean's 8-bit buffers are stored sRGB-encoded (postprocessing does this for
 * UnsignedByteType when the output is sRGB), so darks keep the precision the
 * display has anyway, and the grain still dithers the result. What it gives
 * up is HDR headroom INTO the bloom: a highlight brighter than 1.0 blooms as
 * if it were 1.0. The glints still cross the threshold; they are softer.
 *
 * Mobile drops everything but Bloom.
 */
export function Effects({ mobile }: { mobile: boolean }) {
  const caOffset = useMemo(
    () => new THREE.Vector2(POST.chromaticAberration, POST.chromaticAberration * 0.6),
    [],
  );
  const tier = useScene((s) => s.postTier);

  // State rather than a ref: the effects below have to follow the composer
  // INSTANCE, which is replaced whenever the tier changes its buffers.
  const [composer, setComposer] = useState<EffectComposerImpl | null>(null);

  /**
   * RESIZE THE BUFFERS WHEN THE PIXEL RATIO MOVES, NOT ONLY THE CSS SIZE.
   *
   * The composer sizes its buffers from the renderer's drawing buffer, but
   * @react-three/postprocessing only re-runs that when R3F's `size` changes —
   * and a DPR change leaves `size` alone. So a lower DPR shrank the canvas and
   * left the scene target and every pass at the old resolution. Measured: a
   * quarter of the canvas pixels saved 1.1ms of 8.7, all of it in the final
   * blit. The resolution ladder in the governor does nothing without this.
   */
  const dpr = useThree((s) => s.viewport.dpr);
  const size = useThree((s) => s.size);
  useEffect(() => {
    composer?.setSize(size.width, size.height);
  }, [composer, dpr, size.width, size.height]);

  /**
   * @react-three/postprocessing builds a NEW composer when multisampling or
   * the buffer type changes — which is what a tier change is — and never
   * disposes the old one. Its two full-size buffers, MSAA samples included,
   * would sit in GPU memory for the life of the page. Only those two: the
   * effects themselves are shared with the new composer and must survive.
   */
  useEffect(
    () => () => {
      composer?.inputBuffer.dispose();
      composer?.outputBuffer.dispose();
    },
    [composer],
  );

  if (mobile) {
    return (
      <EffectComposer ref={setComposer} multisampling={0} enableNormalPass={false}>
        <Bloom
          intensity={POST.bloom.intensity * 0.85}
          luminanceThreshold={POST.bloom.threshold}
          luminanceSmoothing={POST.bloom.smoothing}
          mipmapBlur
        />
      </EffectComposer>
    );
  }

  const full = tier === 'full';

  /*
   * MULTISAMPLING IS 2 ON THE FULL TIER, AFTER LOOKING AT IT ON SCREEN.
   *
   * The note that used to sit here set 0 and said: if aliasing ever reads as
   * cheap on the mark, the answer is 2 rather than a return to 4 — but look at
   * it on screen first. Looked at, zoomed, on the deployed site: the mark's
   * bowl silhouette is a hard stair-step, and the chromatic aberration lands a
   * magenta fringe on each step, which is the worst possible pairing. Whatever
   * the frame budget says, that is not shippable on a site whose subject is a
   * machined object.
   *
   * The lean tier drops the aberration along with the MSAA for exactly that
   * reason: the fringe needs both a stair-step and a colour split, and lean
   * never has the second.
   *
   * MSAA does NOT multiply the full-screen passes. `multisampling` applies to
   * the render target the SCENE draws into; that target is resolved to an
   * ordinary texture before bloom, the grain and the vignette ever run, so
   * every one of those passes reads exactly the same number of pixels it did
   * at 0. What 2x costs is sample memory and the resolve — bandwidth, not
   * shading — which on a discrete GPU is cheap and on an integrated one,
   * sharing system memory, measured as the single largest item in the frame.
   */
  return (
    <EffectComposer
      ref={setComposer}
      multisampling={full ? 2 : 0}
      frameBufferType={full ? THREE.HalfFloatType : THREE.UnsignedByteType}
      enableNormalPass={false}
    >
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
      {/* Last, so it costs one extra pass instead of splitting the three above
          into two. A fragment rather than `&&` because the composer's children
          are typed as elements, and an empty fragment adds no pass. */}
      {full ? (
        <ChromaticAberration
          blendFunction={BlendFunction.NORMAL}
          offset={caOffset}
          radialModulation
          modulationOffset={0.32}
        />
      ) : (
        <></>
      )}
    </EffectComposer>
  );
}
