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
 *   .plot.construct    construction lines: dashed, faint, drawn first
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

    case 'motion':
      return (
        <svg {...common}>
          {Array.from({ length: 10 }, (_, k) => (
            <line
              key={k}
              className="plot construct"
              pathLength={1}
              x1={60 + (k + 1) * 38}
              y1={52}
              x2={60 + (k + 1) * 38}
              y2={250}
            />
          ))}
          <line className="plot" pathLength={1} x1={60} y1={250} x2={446} y2={250} />
          <line className="plot" pathLength={1} x1={60} y1={250} x2={60} y2={40} />
          {/* the handles, then the curve they make */}
          <line className="plot construct" pathLength={1} x1={60} y1={250} x2={118} y2={62} />
          <line className="plot construct" pathLength={1} x1={440} y1={52} x2={210} y2={54} />
          <circle className="plot" pathLength={1} cx={118} cy={62} r={4} />
          <circle className="plot" pathLength={1} cx={210} cy={54} r={4} />
          <path className="plot plot-heavy" pathLength={1} d="M 60 250 C 118 62, 210 54, 440 52" />
          <path className="plot" pathLength={1} d="M 60 244 l 6 6 l -6 6 l -6 -6 z" />
          <path className="plot" pathLength={1} d="M 440 46 l 6 6 l -6 6 l -6 -6 z" />
          {/* the playhead */}
          <line className="plot callout" pathLength={1} x1={250} y1={30} x2={250} y2={262} />
          <text className="fig-label fig-callout" x={256} y={30}>
            t = 0.42
          </text>
          <text className="fig-label" x={446} y={270} textAnchor="end">
            TIME
          </text>
          <text className="fig-label" x={66} y={36}>
            VALUE
          </text>
        </svg>
      );

    case 'performance': {
      // Frame times in ms, one of them blown and called out.
      const frames = [11.2, 12.1, 10.8, 13.4, 12.6, 11.9, 24.8, 12.2, 11.4, 10.9, 12.8, 11.6, 12.3, 11.1, 13.0, 12.4, 11.8];
      const base = 250;
      const scale = 6.4;
      const budgetY = base - 16.7 * scale;
      return (
        <svg {...common}>
          <line className="plot" pathLength={1} x1={44} y1={base} x2={446} y2={base} />
          <line className="plot" pathLength={1} x1={44} y1={base} x2={44} y2={50} />
          {frames.map((ms, i) => {
            const x = 56 + i * 22.5;
            const h = ms * scale;
            return (
              <rect
                key={i}
                className={ms > 16.7 ? 'plot callout' : 'plot'}
                pathLength={1}
                x={x}
                y={base - h}
                width={13}
                height={h}
              />
            );
          })}
          <line className="plot callout plot-dash" pathLength={1} x1={44} y1={budgetY} x2={446} y2={budgetY} />
          <text className="fig-label fig-callout" x={446} y={budgetY - 7} textAnchor="end">
            16.7 MS · 60 FPS
          </text>
          <text className="fig-label" x={50} y={44}>
            FRAME TIME
          </text>
        </svg>
      );
    }
  }
}
