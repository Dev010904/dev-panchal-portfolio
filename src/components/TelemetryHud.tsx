'use client';

import { useEffect, useRef } from 'react';

import { addStep } from '@/lib/steps';
import { telemetryHandle } from '@/scenes/handles';
import { useScene } from '@/store/scene';

/**
 * THE TELEMETRY HUD.
 *
 * Bottom-left, hairline, no panel, no border, no toggle. It is not a debug
 * overlay that someone forgot to remove — it is the site stating what it is
 * doing, in the same register as the rest of the page, and it stays at 0.25
 * opacity so it reads as a watermark rather than as chrome.
 *
 * ── WHY IT WRITES textContent INSTEAD OF SETTING STATE ────────────────────
 *
 * Six numbers changing sixty times a second through React state would
 * re-render this subtree every frame for the rest of the page's life. The whole
 * site's convention is that per-frame values live on plain handles and are
 * written straight into the DOM; §3 got the page down to 0.5 style-attribute
 * mutations per frame at rest and a naive HUD would put it straight back.
 *
 * Each row is written only when its text actually changes. At rest the draw
 * count, triangle count and particle count are all constant, so the only row
 * that mutates is the frame time — and that one is quantised to 0.1ms so it
 * settles instead of churning on the last decimal forever, which is the same
 * fix the scroll progress bar and the marquee skew both needed.
 *
 * Registered through `addStep` rather than `gsap.ticker.add` so `__qa.tick()`
 * drives it. A HUD the harness cannot step is a HUD that shows a stale frame in
 * every screenshot taken through the harness — precisely the class of defect
 * this instrument exists to expose.
 */
export function TelemetryHud() {
  const root = useRef<HTMLDivElement>(null);
  const values = useRef<Record<string, HTMLSpanElement | null>>({});
  const last = useRef<Record<string, string>>({});

  // Scene state and particle count are React state — they change on section
  // boundaries, not per frame, so subscribing is correct here.
  const section = useScene((s) => s.activeSection);
  const labCount = useScene((s) => s.labCount);

  useEffect(() => {
    const write = (key: string, text: string) => {
      if (last.current[key] === text) return;
      last.current[key] = text;
      const el = values.current[key];
      if (el) el.textContent = text;
    };

    return addStep(() => {
      const t = telemetryHandle;
      write('backend', t.backend || '—');
      // Quantised, so a value that is merely jittering in the third decimal
      // does not rewrite the node on every single frame.
      write('frame', `${t.frameMs.toFixed(1)}MS`);
      write('draws', String(t.drawCalls));
      write('tris', t.triangles.toLocaleString('en-US'));
    });
  }, []);

  const rows: [string, string, string?][] = [
    ['backend', 'BACKEND'],
    ['frame', 'FRAME'],
    ['draws', 'DRAWS'],
    ['tris', 'TRIS'],
    ['points', 'POINTS', labCount > 0 ? labCount.toLocaleString('en-US') : '—'],
    ['section', 'SCENE', section],
  ];

  return (
    <div
      ref={root}
      aria-hidden="true"
      className="pointer-events-none fixed bottom-4 left-4 z-20 hidden select-none flex-col gap-[3px] opacity-25 md:flex"
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '10px',
        letterSpacing: '0.14em',
        lineHeight: 1,
        color: 'var(--color-fg-dim)',
      }}
    >
      {rows.map(([key, name, staticValue]) => (
        <div key={key} className="flex gap-2 tabular-nums">
          <span className="w-[52px]">{name}</span>
          <span
            ref={(el) => {
              values.current[key] = el;
            }}
          >
            {staticValue ?? '—'}
          </span>
        </div>
      ))}
    </div>
  );
}
