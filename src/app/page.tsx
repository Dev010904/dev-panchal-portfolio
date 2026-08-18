'use client';

import { About } from '@/components/sections/About';
import { Achievements } from '@/components/sections/Achievements';
import { Contact } from '@/components/sections/Contact';
import { Deconstruction } from '@/components/sections/Deconstruction';
import { Hero } from '@/components/sections/Hero';
import { Lab } from '@/components/sections/Lab';
import { Manifesto } from '@/components/sections/Manifesto';
import { Marquee } from '@/components/sections/Marquee';
import { Trace } from '@/components/sections/Trace';
import { Work } from '@/components/sections/Work';
import { useScrollProgress } from '@/components/useSectionShot';

/**
 * The spine. Every section composites over the same persistent canvas; the
 * order below is also the order the camera travels through the scene.
 */
export default function Page() {
  useScrollProgress();

  return (
    <>
      <Hero />
      <Deconstruction />
      <Marquee />
      <Work />
      {/* Between the work and the Lab on purpose: it is the one claim on the
          page that is externally verifiable, and it lands best straight after
          the evidence rather than filed near the CV-shaped material. */}
      <Achievements />
      <Lab />
      {/* Between the Lab and About on purpose. The Lab is the one section the
          visitor is invited to push around, and this is the one they are
          invited to add to — the hand-off from "play with mine" to "leave
          yours" only reads in that order. It is also the only region of the
          room that is not the author's, which is why the camera travels UP to
          reach it. */}
      <Trace />
      <About />
      {/* Sits between About and Contact on purpose: the reader has just been
          told what I do, and this says how it actually gets made — which is
          the argument that has to land before a contact form is worth reading.
          Home page only; the interior pages are documentation, not opinion. */}
      <Manifesto />
      <Contact />
    </>
  );
}
