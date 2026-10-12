'use client';

import { addStep } from '@/lib/steps';

/**
 * THE READOUT — text that resolves the way an instrument settles on a value.
 *
 * Every character starts as a glyph from a small engineering set and locks to
 * its real letter in turn, left to right with a little scatter, re-rolling
 * every few frames until it does. It is the site's one text effect, used for
 * labels and titles that ARRIVE — a transition's destination, a section's tag —
 * never for body copy, and never on something the eye is already reading.
 *
 * Driven by the step registry (gsap.ticker), so it shares the DOM's frame and
 * can be stepped by the QA harness. Spaces and punctuation are never scrambled:
 * they hold the word shapes, which is what keeps it legible while it settles.
 */
const GLYPHS = '0123456789ABCDEFHKLMNPRSTUVXYZ#%+=/<>';
const STATIC = /[\s·.,:;!?'’"“”()—–\-]/;

export interface DecodeOptions {
  /** Seconds for the whole string to lock. */
  duration?: number;
  /** Seconds before the first character starts settling. */
  delay?: number;
  /** Seconds between re-rolls of an unlocked character. */
  rate?: number;
}

export function decode(el: HTMLElement, text: string, opts: DecodeOptions = {}): () => void {
  const { duration = 0.6, delay = 0, rate = 0.045 } = opts;
  const chars = [...text];
  const n = chars.length || 1;
  // When each character locks: in order, with up to 35% of the run as scatter.
  const lockAt = chars.map((_, i) => delay + (i / n) * duration * 0.65 + Math.random() * duration * 0.35);
  const shown = chars.map((c) => (STATIC.test(c) ? c : GLYPHS[(Math.random() * GLYPHS.length) | 0]));

  let t = 0;
  let sinceRoll = 0;
  let last = '';
  let done = false;

  const write = () => {
    const next = shown.join('');
    if (next !== last) {
      el.textContent = next;
      last = next;
    }
  };
  write();

  const stop = addStep((delta) => {
    if (done) return;
    t += delta;
    sinceRoll += delta;
    const roll = sinceRoll >= rate;
    if (roll) sinceRoll = 0;
    let locked = 0;
    for (let i = 0; i < chars.length; i++) {
      if (t >= lockAt[i] || STATIC.test(chars[i])) {
        shown[i] = chars[i];
        locked++;
      } else if (roll) {
        shown[i] = GLYPHS[(Math.random() * GLYPHS.length) | 0];
      }
    }
    write();
    if (locked === chars.length) {
      done = true;
      stop();
    }
  });

  return () => {
    if (done) return;
    done = true;
    stop();
    el.textContent = text;
  };
}
