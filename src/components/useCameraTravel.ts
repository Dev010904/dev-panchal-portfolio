'use client';

import type { TravelRoute } from '@/config/animation';
import { ScrollTrigger, useGsap } from '@/lib/gsap';
import { travelHandle } from '@/scenes/handles';
import { useScene } from '@/store/scene';

/**
 * Binds a stretch of scroll to a camera travel band — see TRAVEL in
 * config/animation for what a band is and why.
 *
 * `end` must be the line where the section's own shot fires (its
 * useSectionShot `start`, or the pin for Work): the band hands over to the
 * shot at exactly the pose the shot holds, and that is the whole reason the
 * resting views did not change.
 *
 * No `scrub`: the rig damps the camera itself, and smoothing the progress a
 * second time is what makes a scroll-driven camera feel like it is on a
 * rubber band. Reduced motion gets no band at all — the camera keeps the
 * plain shot changes it always had.
 */
export function useCameraTravel(
  ref: React.RefObject<HTMLElement | null>,
  route: TravelRoute,
  end: string,
  start = 'top bottom',
) {
  const reducedMotion = useScene((s) => s.reducedMotion);

  useGsap(
    () => {
      const el = ref.current;
      if (!el || reducedMotion) return;

      const write = (self: ScrollTrigger) => {
        const p = self.progress;
        const inside = p > 0 && p < 1;
        // Only the band in progress writes. Two bands never overlap on the
        // page, but a band that has just finished must not clobber the one
        // that has just begun on the same frame.
        if (inside) {
          travelHandle.active = true;
          travelHandle.route = route;
          travelHandle.p = p;
        } else if (travelHandle.route === route) {
          travelHandle.active = false;
          travelHandle.p = p >= 1 ? 1 : 0;
        }
      };

      const st = ScrollTrigger.create({
        trigger: el,
        start,
        end,
        onUpdate: write,
        onToggle: write,
      });

      return () => {
        st.kill();
        if (travelHandle.route === route) travelHandle.active = false;
      };
    },
    [route, end, start, reducedMotion],
    ref,
  );
}
