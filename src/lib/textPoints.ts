/**
 * Text -> point cloud, by rasterising to an offscreen canvas and rejection
 * sampling the alpha channel.
 *
 * The alternative is loading a font as geometry (troika / TextGeometry) and
 * sampling its triangles. That pulls a font parser and a typeface file into
 * the bundle to produce, in the end, a list of xy positions. This does the
 * same job with the 2D canvas that is already there, weighs nothing, and
 * automatically inherits whatever font the page has loaded.
 *
 * Rejection sampling rather than scanning every pixel: at 1100x260 a full scan
 * touches 286k pixels to place 46k points, and biases density toward whichever
 * rows happen to come first when the budget runs out. Rejection sampling is
 * uniform over the glyph area by construction.
 */

export interface TextPointsOptions {
  width?: number;
  height?: number;
  /** World units across the full canvas width. */
  scale?: number;
  fontFamily?: string;
  fontWeight?: number | string;
  letterSpacing?: number;
}

export function textToPoints(
  text: string,
  count: number,
  opts: TextPointsOptions = {},
): Float32Array {
  const {
    width = 1100,
    height = 260,
    scale = 4.2,
    fontFamily = "'Inter Tight', 'Helvetica Neue', Arial, sans-serif",
    fontWeight = 700,
    letterSpacing = -0.02,
  } = opts;

  const out = new Float32Array(count * 3);

  // SSR / no-canvas fallback: a flat slab, so the Lab still renders something
  // coherent rather than collapsing every point onto the origin.
  if (typeof document === 'undefined') {
    for (let i = 0; i < count; i++) {
      out[i * 3] = (Math.random() - 0.5) * scale;
      out[i * 3 + 1] = (Math.random() - 0.5) * scale * 0.25;
      out[i * 3 + 2] = 0;
    }
    return out;
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return out;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Fit the string to the canvas width with a margin, so changing LAB.text
  // never requires re-tuning the font size.
  let fontSize = height * 0.72;
  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  if ('letterSpacing' in ctx) {
    (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing =
      `${letterSpacing}em`;
  }
  const target = width * 0.9;
  const measured = ctx.measureText(text).width;
  if (measured > 0) {
    fontSize *= target / measured;
    ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  }

  ctx.fillText(text, width / 2, height / 2);

  const data = ctx.getImageData(0, 0, width, height).data;

  const aspect = height / width;
  const halfW = scale / 2;
  const halfH = (scale * aspect) / 2;

  let written = 0;
  let attempts = 0;
  const maxAttempts = count * 260;

  while (written < count && attempts < maxAttempts) {
    attempts++;
    const px = Math.floor(Math.random() * width);
    const py = Math.floor(Math.random() * height);
    const alpha = data[(py * width + px) * 4 + 3];
    if (alpha < 128) continue;

    // Jitter within the pixel so the cloud is not visibly gridded at the
    // densities we run at.
    const jx = px + Math.random();
    const jy = py + Math.random();

    out[written * 3 + 0] = (jx / width) * scale - halfW;
    out[written * 3 + 1] = halfH - (jy / height) * scale * aspect;
    // Slight depth so the field has volume under the rim light rather than
    // reading as a decal floating in space.
    out[written * 3 + 2] = (Math.random() - 0.5) * 0.16;
    written++;
  }

  // If the glyph coverage was too sparse to fill the budget, fold the
  // remainder back onto already-placed points instead of leaving zeros at the
  // origin — a bright dot in the middle of the field is very obvious.
  for (let i = written; i < count; i++) {
    const src = written > 0 ? Math.floor(Math.random() * written) : 0;
    out[i * 3 + 0] = out[src * 3 + 0] + (Math.random() - 0.5) * 0.02;
    out[i * 3 + 1] = out[src * 3 + 1] + (Math.random() - 0.5) * 0.02;
    out[i * 3 + 2] = out[src * 3 + 2];
  }

  return out;
}
