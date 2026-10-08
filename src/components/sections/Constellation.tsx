'use client';

import { useRef } from 'react';

import { CLUSTERS, EDGES, STACK } from '@/data/stack';
import { useCameraTravel } from '@/components/useCameraTravel';
import { useSectionShot } from '@/components/useSectionShot';
import { CornerMarks, SectionTag, useRailFade } from '@/components/ui/primitives';
import { useScene } from '@/store/scene';

/**
 * THE CONSTELLATION — the frame around it.
 *
 * The graph itself lives in the persistent scene (`scenes/StackConstellation`).
 * This is the header, the readout and the legend.
 *
 * Like the Lab, the middle of this section is deliberately empty DOM: the whole
 * area is a pointer target, and anything parked over it is a node the cursor
 * cannot reach. Unlike the Lab, there is not even a transparent capture layer
 * here — the scene reads the document-level pointer the rest of the site
 * already tracks, so the section adds no listeners of its own.
 *
 * ── WHY THE TYPE IS ALL IN THE DOM ────────────────────────────────────────
 *
 * Twenty-seven labels drawn into the canvas would need either an SDF atlas or
 * drei's `Html`, and both are the wrong trade. The atlas costs a texture, a
 * build step and blurry type at small sizes; `Html` costs twenty-seven
 * absolutely-positioned divs being repositioned every frame, which is a layout
 * thrash for text nobody can read while the structure is rotating anyway.
 *
 * One readout, in real DOM type, at a size worth reading, is better on every
 * axis — including the one that matters most here, which is that a portfolio
 * claiming to care about typography cannot render its own type as smeared
 * texture samples.
 */
export function Constellation() {
  const root = useRef<HTMLElement>(null);
  const rail = useRef<HTMLDivElement>(null);
  useRailFade(rail);

  useSectionShot(root, 'constellation', 'CONSTELLATION');
  // Up the shaft from the Lab, past the mark, as this section rises into
  // view; see TRAVEL.
  useCameraTravel(root, 'toConstellation', 'top 55%');

  const focus = useScene((s) => s.constellationFocus);
  const isMobile = useScene((s) => s.isMobile);
  const node = focus >= 0 ? STACK[focus] : null;

  const cluster = node ? CLUSTERS.find((c) => c.id === node.cluster) : null;

  return (
    <section
      ref={root}
      id="constellation"
      aria-label="The stack, as a graph"
      className="relative flex min-h-[110svh] flex-col justify-between py-[clamp(5rem,14vh,9rem)]"
    >
      <CornerMarks />

      <div ref={rail} className="grid12 items-start gap-y-4">
        <div className="col-span-12 flex flex-wrap items-baseline justify-between gap-4">
          <SectionTag name="CONSTELLATION" />
          <span className="t-mono text-[var(--color-fg-dim)]">
            {STACK.length} NODES · {EDGES.length} LINKS
          </span>
        </div>
        <div className="col-span-12 mt-2 h-px bg-[var(--color-rule)]" />
      </div>

      <div className="grid12 mt-auto items-end gap-y-8">
        {/*
          THE READOUT.

          `min-h` is not decoration. The note is one line for some tools and
          three for others, and letting the block resize as the pointer moves
          would reflow everything under it sixty times a second — a CLS of
          exactly the kind this site currently scores zero on. The height is
          reserved for the longest note and never changes.
        */}
        <div className="col-span-12 md:col-span-6">
          <div className="min-h-[9.5rem] md:min-h-[8.5rem]">
            <span className="t-label block text-[var(--color-fg-dim)]">
              {cluster ? cluster.label : 'THE STACK'}
            </span>

            {/* Keyed on the node id so React remounts it and the fade replays
                on every change. Without the key it is the same element with new
                text and the animation runs exactly once, on the first hover. */}
            <h3 key={node ? node.id : 'idle'} className="t-lead readout-in mt-2">
              {node ? node.label : 'Tools, and what they pull in with them.'}
            </h3>

            <p className="t-body mt-3 max-w-[42ch] text-[var(--color-fg-dim)]">
              {node
                ? node.note
                : isMobile
                  ? 'Sized by how load-bearing each one is. Every line is a real dependency.'
                  : 'Point at a node. It lifts, and everything it actually touches comes up with it.'}
            </p>
          </div>
        </div>

        {/*
          THE LEGEND — four labels, and deliberately nothing else.

          The first version printed each cluster's blurb beside its label. Two
          things were wrong with that. It inherited `t-label`, which is
          uppercase at 0.18em tracking, so full sentences rendered as shouty
          wide-tracked mono and ran past the column. And even set correctly it
          put four sentences of prose directly opposite the readout's prose,
          which is two competing paragraphs at the bottom of a section whose
          subject is in the middle of the screen.

          The blurbs still exist — they are in the accessible copy below, where
          they do real work for a reader who has no graph to look at. Here, all
          that is needed is a key: which lobe is which. Dimming the other three
          when a node is picked is what connects the two halves.
        */}
        <div className="col-span-12 flex flex-col gap-2 md:col-span-4 md:col-start-9 md:items-end">
          {CLUSTERS.map((c) => (
            <span
              key={c.id}
              className="t-label flex items-center gap-3 transition-opacity duration-300"
              style={{ opacity: !cluster || cluster.id === c.id ? 1 : 0.3 }}
            >
              <span className="h-px w-6 bg-[var(--color-rule)]" />
              <span>{c.label}</span>
            </span>
          ))}
        </div>
      </div>

      {/*
        THE ACCESSIBLE COPY.

        Everything above communicates through a canvas and a pointer, neither of
        which exists for a screen reader. This is the same information as plain
        structured text: four groups, every tool, every note. It is not a
        fallback bolted on — it is the section's content, and the graph is one
        way of presenting it.
      */}
      <div className="sr-only">
        <h3>The stack in full</h3>
        {CLUSTERS.map((c) => (
          <section key={c.id}>
            <h4>
              {c.label} — {c.blurb}
            </h4>
            <ul>
              {STACK.filter((n) => n.cluster === c.id).map((n) => (
                <li key={n.id}>
                  <strong>{n.label}.</strong> {n.note}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </section>
  );
}
