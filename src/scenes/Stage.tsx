'use client';

import { Environment, Lightformer } from '@react-three/drei';
import { memo, useEffect } from 'react';

import { markBootStep } from '@/lib/boot';

/**
 * THE STUDIO — three-point lighting for a near-black machined subject.
 *
 * Built from Lightformers rather than a downloaded HDRI. That is a deliberate
 * trade, not a shortcut:
 *
 *   - An HDRI gives you whatever a photographer pointed a camera at. A
 *     Lightformer rig lets you place each softbox exactly where the chamfer
 *     needs to catch, which on a dark object is the entire job.
 *   - It costs 0 KB. The nearest usable studio HDRI is ~1.4 MB, which is most
 *     of the initial JS budget spent on something we can author better.
 *   - The rig can be animated. The key softbox drifts, so the highlight
 *     travels along the arcs instead of sitting there like a decal.
 *
 * The three lights, in the order they matter:
 *   KEY    — large soft box, front-top-left. Establishes the form.
 *   RIM    — cold steel (#3A6EA5), hard and narrow, back-left. This is the
 *            single most important light: it draws the silhouette.
 *   KICKER — ember (#FF5A1F), back-right, low. One warm line so the object
 *            is not monochrome. Restraint here is the difference between
 *            "photographed" and "gamer peripheral".
 */
export const Stage = memo(function Stage({ mobile }: { mobile: boolean }) {
  // Environment mounting means the PMREM convolution has been scheduled; the
  // cubemap is generated on the frames that follow, which `firstFrame` and
  // `warm` then cover.
  useEffect(() => markBootStep('environment'), []);

  return (
    <>
      {/* Barely-there fill so the unlit sides are not pure void. */}
      <ambientLight intensity={0.14} color="#6f7684" />

      {/* Shadow-defining key. Intensity is low because the environment does
          most of the work; this only sharpens the terminator. */}
      <directionalLight position={[-4, 5.5, 6]} intensity={0.85} color="#cfd6e2" />
      <directionalLight position={[5, -2, -4]} intensity={0.3} color="#3a6ea5" />

      <Environment resolution={mobile ? 128 : 256} frames={Infinity} background={false}>
        {/* Void. Everything the metal reflects that is not a light is this. */}
        <mesh scale={60}>
          <sphereGeometry args={[1, 24, 24]} />
          <meshBasicMaterial color="#050507" side={1} />
        </mesh>

        {/* KEY — broad soft box, front-top-left, angled down the mark. */}
        <Lightformer
          form="rect"
          intensity={3.4}
          color="#e8edf6"
          position={[-4.5, 4, 5]}
          rotation={[-0.35, -0.7, 0]}
          scale={[7, 9, 1]}
        />

        {/*
          A second, much tighter front softbox.

          The broad key alone gives a soft wash and no event. This one is
          narrow, so on a low-roughness surface it reflects as a hard bright
          STREAK that runs the length of a chamfer instead of a soft patch —
          which is the reference's signature and the thing that makes an
          extrusion read as machined rather than moulded.
        */}
        <Lightformer
          form="rect"
          intensity={9}
          color="#ffffff"
          position={[-2.6, 3.2, 3.4]}
          rotation={[-0.5, -0.35, 0.3]}
          scale={[0.3, 6.5, 1]}
        />

        {/* RIM — narrow cold strip behind-left. Draws the silhouette, and on a
            near-black object against a near-black page it is the only reason
            there is a silhouette to draw. */}
        <Lightformer
          form="rect"
          intensity={11}
          color="#4d86c4"
          position={[-6, 1.4, -5.5]}
          rotation={[0, 1.15, 0]}
          scale={[0.42, 11, 1]}
        />

        {/* Second rim, tighter and higher — catches the top chamfers. */}
        <Lightformer
          form="rect"
          intensity={6}
          color="#b6cde6"
          position={[-2.2, 6.5, -3.5]}
          rotation={[1.3, 0, 0]}
          scale={[5, 0.38, 1]}
        />

        {/* KICKER — the one warm light. Back-right, low, narrow. */}
        <Lightformer
          form="rect"
          intensity={6.4}
          color="#ff5a1f"
          position={[5.4, -1.2, -4.6]}
          rotation={[0, -1.05, 0]}
          scale={[0.42, 7, 1]}
        />

        {/* Floor bounce — stops the underside going completely black. */}
        <Lightformer
          form="rect"
          intensity={1.1}
          color="#2a2f38"
          position={[0, -5.5, 1]}
          rotation={[Math.PI / 2, 0, 0]}
          scale={[10, 10, 1]}
        />
      </Environment>
    </>
  );
});
