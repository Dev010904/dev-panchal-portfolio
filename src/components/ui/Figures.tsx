import type { FigureId } from '@/data/capabilities';

/**
 * THE CAPABILITY DRAWINGS — four technical figures, plotted as you scroll.
 *
 * Line art in the site's drawing-sheet language, one per capability. Every
 * stroke carries `pathLength="1"`, so the section can plot any of them with a
 * single dash offset from 1 to 0 regardless of the shape's real length — the
 * pen drawing it in. Three weights, three meanings:
 *
 *   .plot              the object itself, in ink
 *   .plot.construct    construction lines: faint, drawn first
 *   .plot.callout      dimensions and callouts, in the ember
 *
 * Stroke widths are in drawing units, not `non-scaling-stroke`: that moves
 * the dash pattern into screen pixels and breaks the pathLength trick (see the
 * note on .figure .plot in globals.css).
 */
export function Figure({ id }: { id: FigureId }) {
  const common = {
    viewBox: '0 0 480 300',
    className: 'figure h-auto w-full',
    'aria-hidden': true,
    fill: 'none',
  } as const;

  switch (id) {
    case 'websites':
      return (
        <svg {...common}>
          {/* 12-column construction grid inside the frame */}
          {Array.from({ length: 11 }, (_, k) => {
            const x = 40 + ((k + 1) * 400) / 12;
            return <line key={k} className="plot construct" pathLength={1} x1={x} y1={64} x2={x} y2={280} />;
          })}
          <rect className="plot" pathLength={1} x={40} y={40} width={400} height={240} rx={6} />
          <line className="plot" pathLength={1} x1={40} y1={64} x2={440} y2={64} />
          {[56, 68, 80].map((cx) => (
            <circle key={cx} className="plot" pathLength={1} cx={cx} cy={52} r={3} />
          ))}
          <rect className="plot" pathLength={1} x={56} y={76} width={368} height={14} />
          <rect className="plot" pathLength={1} x={56} y={106} width={220} height={22} />
          <rect className="plot" pathLength={1} x={56} y={134} width={150} height={22} />
          <rect className="plot" pathLength={1} x={300} y={106} width={124} height={78} />
          {[56, 189, 322].map((x) => (
            <rect key={x} className="plot" pathLength={1} x={x} y={204} width={102} height={60} />
          ))}
          {/* overall width */}
          <line className="plot callout" pathLength={1} x1={40} y1={22} x2={440} y2={22} />
          <line className="plot callout" pathLength={1} x1={40} y1={16} x2={40} y2={28} />
          <line className="plot callout" pathLength={1} x1={440} y1={16} x2={440} y2={28} />
          <text className="fig-label fig-callout" x={240} y={17} textAnchor="middle">
            1440
          </text>
          {/* a column, called out */}
          <path className="plot callout" pathLength={1} d="M 107 290 L 107 296 L 140 296" />
          <text className="fig-label fig-callout" x={146} y={299}>
            1 COL
          </text>
        </svg>
      );

    case 'realtime': {
      // Isometric projection of a unit cube, computed rather than hand-placed
      // so the hidden edges are actually the hidden ones.
      const s = 72;
      const cx = 240;
      const cy = 158;
      const iso = (x: number, y: number, z: number): [number, number] => [
        cx + (x - z) * Math.cos(Math.PI / 6) * s,
        cy + (x + z) * Math.sin(Math.PI / 6) * s - y * s,
      ];
      const V = [-1, 1].flatMap((x) => [-1, 1].flatMap((y) => [-1, 1].map((z) => [x, y, z] as const)));
      const hidden = (v: readonly [number, number, number]) => v[0] === -1 && v[1] === -1 && v[2] === -1;
      const edges: [number, number][] = [];
      for (let i = 0; i < V.length; i++)
        for (let j = i + 1; j < V.length; j++) {
          const d = V[i].reduce((n, c, k) => n + (c !== V[j][k] ? 1 : 0), 0);
          if (d === 1) edges.push([i, j]);
        }
      const at = (i: number) => {
        const [x, y] = iso(...V[i]);
        return [cx + (x - cx) * 0.62, cy + (y - cy) * 0.62] as const;
      };
      return (
        <svg {...common}>
          <ellipse className="plot construct" pathLength={1} cx={cx} cy={cy + 10} rx={190} ry={54} />
          {edges.map(([a, b]) => {
            const [x1, y1] = at(a);
            const [x2, y2] = at(b);
            const dashed = hidden(V[a]) || hidden(V[b]);
            return (
              <line
                key={`${a}-${b}`}
                className={dashed ? 'plot construct' : 'plot'}
                pathLength={1}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
              />
            );
          })}
          {/* axes, from the near corner */}
          {(() => {
            const [ox, oy] = at(V.findIndex((v) => v[0] === 1 && v[1] === -1 && v[2] === 1));
            return (
              <>
                {/* Out of the near corner, away from the cube: +X down-right,
                    +Z down-left in this projection, and −Y straight down. */}
                <line className="plot callout" pathLength={1} x1={ox} y1={oy} x2={ox + 52} y2={oy + 30} />
                <line className="plot callout" pathLength={1} x1={ox} y1={oy} x2={ox - 52} y2={oy + 30} />
                <line className="plot callout" pathLength={1} x1={ox} y1={oy} x2={ox} y2={oy + 44} />
                <text className="fig-label fig-callout" x={ox + 58} y={oy + 38}>
                  X
                </text>
                <text className="fig-label fig-callout" x={ox - 68} y={oy + 38}>
                  Z
                </text>
                <text className="fig-label fig-callout" x={ox + 6} y={oy + 56}>
                  −Y
                </text>
              </>
            );
          })()}
          {/* the camera on its orbit, and its field of view */}
          <path className="plot" pathLength={1} d="M 418 196 l 16 -8 l 0 16 z" />
          <path className="plot construct" pathLength={1} d="M 418 196 L 300 150 M 418 196 L 300 214" />
          <text className="fig-label" x={392} y={232}>
            FOV 34°
          </text>
        </svg>
      );
    }

    case 'data': {
      // The real distribution, from the cleaned APL Logistics order book:
      // 172,765 realised order lines, binned by profit margin. The first bar
      // is everything below −80%; the rest are 10-point bands up to +60%.
      // Loss-making bands are drawn in the ember.
      const share = [4.25, 2.62, 1.41, 0.42, 0.53, 0.66, 2.91, 2.99, 2.9, 10.83, 10.94, 17.17, 21.52, 19.53, 1.31];
      const base = 250;
      const scale = 7.4;
      const x = (k: number) => 56 + k * 26;
      // Margin m (as a fraction) to x: the gap between bands sits on each edge.
      const at = (m: number) => 56 + (1 + (m + 0.8) / 0.1) * 26 - 4;
      const avg = at(0.1203);
      return (
        <svg {...common}>
          {[5, 10, 15, 20].map((pct) => (
            <line
              key={pct}
              className="plot construct"
              pathLength={1}
              x1={44}
              y1={base - pct * scale}
              x2={446}
              y2={base - pct * scale}
            />
          ))}
          <line className="plot construct" pathLength={1} x1={at(0)} y1={base} x2={at(0)} y2={70} />
          <line className="plot" pathLength={1} x1={44} y1={base} x2={446} y2={base} />
          <line className="plot" pathLength={1} x1={44} y1={base} x2={44} y2={60} />
          {share.map((v, k) => (
            <rect
              key={k}
              className={k < 9 ? 'plot callout' : 'plot'}
              pathLength={1}
              x={x(k)}
              y={base - v * scale}
              width={18}
              height={v * scale}
            />
          ))}
          {/* the loss-making lines, bracketed */}
          <path className="plot callout" pathLength={1} d={`M ${x(0)} 196 L ${x(0)} 190 L ${x(8) + 18} 190 L ${x(8) + 18} 196`} />
          <text className="fig-label fig-callout" x={(x(0) + x(8) + 18) / 2} y={182} textAnchor="middle">
            18.7% OF LINES · −$3.71M
          </text>
          {/* the book's average */}
          <line className="plot callout" pathLength={1} x1={avg} y1={base} x2={avg} y2={60} />
          <text className="fig-label fig-callout" x={avg + 6} y={66}>
            AVG 12.0%
          </text>
          {[-0.8, -0.4, 0, 0.4].map((m) => (
            <text key={m} className="fig-label" x={at(m)} y={266} textAnchor="middle">
              {m === 0 ? '0' : `${m > 0 ? '+' : '−'}${Math.abs(m * 100)}`}
            </text>
          ))}
          <text className="fig-label" x={446} y={286} textAnchor="end">
            MARGIN %
          </text>
          <text className="fig-label" x={50} y={52}>
            SHARE OF LINES
          </text>
        </svg>
      );
    }

    case 'ai': {
      // KAAM KARO's loop, drawn as a schematic: the model plans, the app
      // checks, a critical deadline gets a rescue plan, and a slow or
      // rate-limited model falls back to a local planner instead of failing.
      const node = (x: number, y: number, w: number, h: number, label: string, cls = 'plot') => (
        <g key={label}>
          <rect className={cls} pathLength={1} x={x} y={y} width={w} height={h} rx={4} />
          <text
            className={`fig-label ${cls.includes('callout') ? 'fig-callout' : ''}`}
            x={x + w / 2}
            y={y + h / 2 + 4}
            textAnchor="middle"
          >
            {label}
          </text>
        </g>
      );
      const head = (d: string, cls = 'plot') => <path className={cls} pathLength={1} d={d} />;
      return (
        <svg {...common}>
          {/* the fallback and the daily replan, faint: the paths it takes when it has to */}
          <line className="plot construct" pathLength={1} x1={218} y1={96} x2={218} y2={176} />
          {head('M 214 170 L 218 176 L 222 170', 'plot construct')}
          <path className="plot construct" pathLength={1} d="M 336 262 L 70 262 L 70 96" />
          {head('M 66 102 L 70 96 L 74 102', 'plot construct')}

          {node(24, 56, 92, 40, 'DEADLINE')}
          {node(164, 56, 108, 40, 'GEMINI')}
          {node(320, 56, 136, 40, 'CLASSIFY')}
          <line className="plot" pathLength={1} x1={116} y1={76} x2={164} y2={76} />
          {head('M 158 72 L 164 76 L 158 80')}
          <line className="plot" pathLength={1} x1={272} y1={76} x2={320} y2={76} />
          {head('M 314 72 L 320 76 L 314 80')}

          {/* the verdict, one of four */}
          <line className="plot" pathLength={1} x1={388} y1={96} x2={388} y2={120} />
          {node(336, 120, 104, 20, 'SAFE')}
          {node(336, 146, 104, 20, 'AT RISK')}
          {node(336, 172, 104, 20, 'CRITICAL', 'plot callout')}
          {node(336, 198, 104, 20, 'OVERDUE')}

          {/* the local planner feeds the same check */}
          {node(164, 176, 108, 40, 'LOCAL PLAN')}
          <path className="plot" pathLength={1} d="M 272 196 L 300 196 L 300 86 L 320 86" />
          {head('M 314 82 L 320 86 L 314 90')}

          {/* critical → rescue */}
          {node(336, 244, 104, 36, 'RESCUE PLAN')}
          <path className="plot callout" pathLength={1} d="M 440 182 L 458 182 L 458 262 L 440 262" />
          {head('M 446 258 L 440 262 L 446 266', 'plot callout')}

          <text className="fig-label" x={210} y={140} textAnchor="end">
            TIMEOUT · 429
          </text>
          <text className="fig-label" x={80} y={254}>
            REPLAN DAILY
          </text>
        </svg>
      );
    }
  }
}
