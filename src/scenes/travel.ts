import { TRAVEL, type ShotName } from '@/config/animation';
import { travelHandle } from '@/scenes/handles';

const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(Math.max((x - e0) / (e1 - e0), 0), 1);
  return t * t * (3 - 2 * t);
};

/**
 * How present a section's own scene element should be while a travel band
 * involves its shot, 0..1 — or `null` when no band in progress touches it,
 * in which case the element keeps following its section as it always did.
 *
 * Arriving, it comes up over the second half of the band, so the Lab field or
 * the constellation is already forming as the camera reaches it instead of
 * appearing after the band has finished. Leaving, it goes over the first
 * half, while the camera is still close enough to see it go.
 */
export function travelPresence(shot: ShotName): number | null {
  if (!travelHandle.active) return null;
  const route = TRAVEL[travelHandle.route];
  if (route.to === shot) return smooth(0.45, 0.95, travelHandle.p);
  if (route.from === shot) return 1 - smooth(0.05, 0.55, travelHandle.p);
  return null;
}
