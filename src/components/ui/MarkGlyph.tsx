'use client';

import { useMemo } from 'react';
import { markSvg } from '@/lib/mark/svg';

/**
 * The nav mark. Generated from the same path data as the 3D object
 * (lib/mark/paths.ts), so it is impossible for the flat logo and the hero
 * object to drift apart — there is only one set of numbers.
 */
export function MarkGlyph({ className = '', size = 26 }: { className?: string; size?: number }) {
  const svg = useMemo(
    () => markSvg({ size, fg: 'currentColor', accent: 'var(--color-accent)', sized: false }),
    [size],
  );

  return (
    <span
      className={`inline-block ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
