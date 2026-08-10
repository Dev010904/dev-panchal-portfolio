'use client';

import { useEffect, useRef } from 'react';

import { BLAST } from '@/config/animation';
// `gsap` is still needed here for the timeline at the top of the effect.
// TypeScript will NOT catch its absence: gsap ships a UMD global declaration,
// so a missing import typechecks clean and fails only at runtime.
import { gsap } from '@/lib/gsap';
import { addStep } from '@/lib/steps';
import { blastHandle } from '@/scenes/handles';
import { useScene } from '@/store/scene';

/**
 * HOLD TO BLAST.
 *
 * Press and hold: the mark shatters and stays shattered for exactly as long as
 * the button is down. Let go and it settles home. Half a second or thirty — the
 * recovery starts on release and not before.
 *
 * SCOPE
 * Two places only. The hero, where the mark comes apart, and the Lab, where the
 * particle field detonates. It used to be global, which meant every paragraph
 * on every page jumped when you happened to press the mouse — an easter egg
 * that fires everywhere is not an easter egg, it is a bug you can reproduce.
 *
 * WHY A SCRUBBED TIMELINE
 * `amount` is driven by scrubbing one paused timeline built at mount. Building
 * tweens on pointerdown costs a construction on the input frame — the exact
 * frame that must be free — and play/reverse cannot blend: releasing at 40% of
 * a charge restarts the reverse from its own idea of the playhead and visibly
 * snaps. A damped target driving a scrubbed playhead just changes direction.
 *
 * THE DOM SIDE
 * A blast that only touches the canvas reads as a video playing behind the
 * page; displacing the real type at the same moment is what fuses the two.
 * It is transform and opacity only, both compositor properties, so the whole
 * displacement costs nothing on the main thread. There is no filter: the blur
 * that used to be here forced a full-page raster on every frame of the blast,
 * which is most of what made the recovery feel like it was dragging.
 */
export function HoldToBlast() {
  const ring = useRef<HTMLDivElement>(null);
  const reducedMotion = useScene((s) => s.reducedMotion);
  const section = useScene((s) => s.activeSection);
  const structure = useScene((s) => s.structure);

  // The two armed sections, and nowhere else. `structure` is non-null on the
  // interior pages, which must never arm regardless of what the section label
  // happens to say.
  const armed = !reducedMotion && structure === null && (section === 'INDEX' || section === 'LAB');

  // `armed` changes with scroll; reading it through a ref keeps the effect from
  // tearing down and rebuilding the timeline every time you cross a section.
  const armedRef = useRef(armed);
  armedRef.current = armed;

  useEffect(() => {
    if (reducedMotion) return;

    /**
     * The blast, as one paused normalised timeline. Scrubbed, never played.
     * Durations here are fractions of the playhead, not seconds — the real
     * timing comes from how fast the playhead is driven.
     */
    const tl = gsap
      .timeline({ paused: true })
      // Brace first: the assembly pulls in on itself before it lets go. This
      // peaks at a fifth of the way in and is gone by halfway, so it reads as
      // an anticipation rather than as a second, competing motion.
      .fromTo(
        blastHandle,
        { squeeze: 0 },
        { squeeze: 1, duration: 0.2, ease: 'power2.out' },
        0,
      )
      .to(blastHandle, { squeeze: 0, duration: 0.34, ease: 'power2.inOut' }, 0.2)
      .fromTo(
        blastHandle,
        { amount: 0 },
        { amount: 1, duration: 1, ease: 'power2.inOut' },
        0,
      )
      // The tumble lags the translation slightly, so parts travel first and
      // rotate as they go rather than pirouetting on the spot.
      .fromTo(blastHandle, { spin: 0 }, { spin: 1, duration: 1, ease: 'power1.in' }, 0);

    /**
     * Damping rates. k = 3/t puts the playhead at ~95% of its target after t
     * seconds, which with the power2.inOut on the timeline lands the visible
     * motion right on chargeMs and recoverMs.
     */
    const kCharge = 3 / (BLAST.chargeMs / 1000);
    const kRelease = 3 / (BLAST.recoverMs / 1000);

    let target = 0;
    let playhead = 0;
    /** Seconds the pointer has been down on the current press. */
    let heldSeconds = 0;
    /** True once the hold has completed and the blast has actually fired. */
    let armed = false;

    /** Elements the shockwave displaces. Collected once per press. */
    let targets: { el: HTMLElement; dx: number; dy: number; falloff: number }[] = [];

    const clearTargets = () => {
      for (const t of targets) {
        t.el.style.transform = '';
        t.el.style.opacity = '';
        t.el.style.willChange = '';
      }
      targets = [];
    };

    /**
     * One batched read pass, then one batched write pass. Interleaving the two
     * is what turns a handful of getBoundingClientRect calls into a forced
     * synchronous layout per element, and this runs on the input frame.
     */
    const collect = (ox: number, oy: number) => {
      const nodes = document.querySelectorAll<HTMLElement>('[data-blast]');
      const max = Math.hypot(window.innerWidth, window.innerHeight);
      targets = [];

      nodes.forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.bottom < -200 || r.top > window.innerHeight + 200) return;
        const dx = r.left + r.width / 2 - ox;
        const dy = r.top + r.height / 2 - oy;
        const len = Math.hypot(dx, dy) || 1;
        targets.push({
          el,
          dx: dx / len,
          dy: dy / len,
          // Near the press point things move most. Uniform displacement reads
          // as the page scrolling rather than as something detonating.
          falloff: 1 - Math.min(len / max, 1) * 0.55,
        });
      });

      for (const t of targets) t.el.style.willChange = 'transform, opacity';
    };

    const onDown = (e: PointerEvent) => {
      // Never hijack a real interaction. The instanceof guard is not paranoia:
      // an event whose target is the window (which is what a synthesised one
      // from the QA harness looks like) has no closest() and threw here.
      const el = e.target instanceof Element ? e.target : null;
      if (el?.closest('a, button, input, textarea, select')) return;
      if (!armedRef.current) return;

      blastHandle.held = true;
      blastHandle.heldFor = 0;
      blastHandle.origin = [e.clientX / window.innerWidth, 1 - e.clientY / window.innerHeight];
      blastHandle.epoch++;

      // Note what is NOT here: `target = 1`. The blast is not armed by the
      // press, it is armed by surviving the full hold. Until then the only
      // thing running is the shake.
      heldSeconds = 0;
      armed = false;

      collect(e.clientX, e.clientY);

      if (ring.current) {
        ring.current.style.left = `${e.clientX}px`;
        ring.current.style.top = `${e.clientY}px`;
      }
    };

    const onUp = () => {
      if (!blastHandle.held) return;
      blastHandle.held = false;
      // Releasing before the hold completes cancels outright: the shake stops
      // and nothing detonates. Releasing after it completes starts recovery.
      heldSeconds = 0;
      armed = false;
      target = 0;
    };

    const tick = (delta: number) => {
      const dt = Math.min(delta, 0.05);

      // ── The hold ────────────────────────────────────────────────────────────
      if (blastHandle.held) {
        blastHandle.heldFor += dt;

        if (!armed) {
          heldSeconds += dt;
          if (heldSeconds >= BLAST.holdMs / 1000) {
            // Survived the full hold. Detonate, and keep it detonated
            // for as long as the pointer stays down.
            armed = true;
            target = 1;
          }
        }
      }

      // Shake runs during the hold and stops the instant it detonates — the
      // blast is the release of the tension, so carrying the tremor into it
      // would blur the one frame that has to land cleanly.
      const holdProgress = armed
        ? 0
        : Math.min(heldSeconds / (BLAST.holdMs / 1000), 1);
      blastHandle.hold = holdProgress;
      blastHandle.shake = holdProgress > 0 ? Math.pow(holdProgress, BLAST.shake.curve) : 0;

      // Asymmetric damping is the state machine: fast in, slow out. Written as
      // 1 - exp(-k·dt) so it lands identically at 60Hz and 144Hz.
      const k = target > playhead ? kCharge : kRelease;
      playhead += (target - playhead) * (1 - Math.exp(-k * dt));

      // Snap the tail so the timeline actually reaches its rest pose instead of
      // asymptotically approaching it and leaving the DOM permanently nudged.
      if (target === 0 && playhead < 0.001) playhead = 0;
      if (target === 1 && playhead > 0.999) playhead = 1;

      if (playhead === 0 && blastHandle.amount === 0 && blastHandle.shake === 0) {
        if (targets.length) clearTargets();
        if (ring.current) ring.current.style.opacity = '0';
        return;
      }

      tl.progress(playhead);

      // ── Charge ring ────────────────────────────────────────────────────────
      // Driven per frame rather than through a CSS transition. The transition
      // that used to be here added its own 180ms before the ring even started
      // appearing, on top of everything else.
      // During the hold it tracks BLAST.holdMs and closes in; after the
      // blast it tracks the shatter. It is the only thing on screen that tells
      // you how much of the hold is left.
      if (ring.current) {
        const ringAmount = Math.max(holdProgress, playhead);
        ring.current.style.opacity = String(
          Math.min(ringAmount * 2.2, 1) * (blastHandle.held ? 1 : 0.4),
        );
        ring.current.style.transform = `translate(-50%,-50%) scale(${1.15 - ringAmount * 0.45})`;
      }

      // ── DOM displacement ───────────────────────────────────────────────────
      const a = blastHandle.amount;
      // Ambient drift while held. Absolute function of heldFor, not
      // accumulated, so it cannot drift out of phase with the 3D.
      const wob =
        blastHandle.held && blastHandle.heldFor > 0
          ? Math.sin((blastHandle.heldFor / BLAST.drift.period) * Math.PI * 2) *
            BLAST.drift.amplitude
          : 0;

      // The tremor. Re-rolled every frame and independently per element, which
      // is what makes the copy look like it is being shaken apart rather than
      // sliding around as one rigid block. A shared offset, or a sine, reads as
      // a vibrating panel instead of a structure under load.
      const shake = blastHandle.shake * BLAST.shake.dom;

      for (const t of targets) {
        const amt = a * t.falloff;
        const push = amt * BLAST.domPush * (1 + wob);
        const jx = shake > 0 ? (Math.random() - 0.5) * 2 * shake * t.falloff : 0;
        const jy = shake > 0 ? (Math.random() - 0.5) * 2 * shake * t.falloff : 0;
        t.el.style.transform = `translate3d(${t.dx * push + jx}px, ${t.dy * push + jy}px, 0) rotate(${
          t.dx * amt * BLAST.domRotate + jx * 0.08
        }deg)`;
        t.el.style.opacity = String(1 - amt * BLAST.domFade);
      }
    };

    window.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    // A press that ends outside the window still has to release the hold, or
    // the mark stays shattered until the next click.
    window.addEventListener('blur', onUp);
    const unstep = addStep(tick);

    return () => {
      unstep();
      tl.kill();
      clearTargets();
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      window.removeEventListener('blur', onUp);
      blastHandle.amount = 0;
      blastHandle.squeeze = 0;
      blastHandle.spin = 0;
      blastHandle.held = false;
      blastHandle.heldFor = 0;
    };
  }, [reducedMotion]);

  if (reducedMotion) return null;

  return (
    <div
      ref={ring}
      aria-hidden="true"
      className="pointer-events-none fixed z-[115] h-28 w-28 rounded-full opacity-0"
      // A thin ring that closes in over the hold, not a glowing disc.
      // The heavy inset shadow that used to be here bloomed into a soft orange
      // ball that read as an effect in its own right rather than as a readout.
      style={{
        border: '1px solid var(--color-accent)',
        boxShadow: '0 0 0 1px rgba(255, 90, 31, 0.12)',
        transform: 'translate(-50%,-50%) scale(1.15)',
      }}
    />
  );
}
