'use client';

import { useGsap, ScrollTrigger } from '@/lib/gsap';
import type { ShotName } from '@/config/animation';
import { useScene } from '@/store/scene';

/**
 * Binds a DOM section to a camera shot and a scroll-progress label.
 *
 * Every section calls this. It is the whole reason the site can be "one
 * persistent scene": a section does not own a scene, it owns a *state*, and
 * entering it asks the camera to travel there.
 *
 * Uses toggleActions rather than a scrubbed tween so the camera eases to the
 * shot on its own clock instead of being dragged frame-by-frame by scroll —
 * scrubbing every camera move makes fast scrolling feel like the camera is
 * being yanked.
 */
export function useSectionShot(
  ref: React.RefObject<HTMLElement | null>,
  shot: ShotName,
  label: string,
  /**
   * When the camera starts travelling, as a ScrollTrigger start string.
   *
   * The default fires at the halfway mark, which is right for a section whose
   * shot simply reframes the object. A section whose shot has to get the object
   * *out* of frame needs a head start, or the move is still finishing while the
   * headline is already being read — see Contact.
   */
  start = 'top 55%',
) {
  useGsap(
    () => {
      const el = ref.current;
      if (!el) return;

      const apply = () => {
        const s = useScene.getState();
        if (s.shot !== shot) s.setShot(shot);
        if (s.activeSection !== label) s.setSection(label);
      };

      ScrollTrigger.create({
        trigger: el,
        start,
        end: 'bottom 45%',
        onEnter: apply,
        onEnterBack: apply,
      });
    },
    [shot, label, start],
    ref,
  );
}

/** Global scroll progress for the hairline indicator. */
export function useScrollProgress() {
  useGsap(() => {
    ScrollTrigger.create({
      trigger: document.body,
      start: 'top top',
      end: 'bottom bottom',
      onUpdate: (self) => useScene.getState().setScrollProgress(self.progress),
    });
  }, []);
}
