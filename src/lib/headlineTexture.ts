import * as THREE from 'three';

/**
 * DISPLAY TYPE, DRAWN TO A TEXTURE.
 *
 * This exists for exactly one element — the Work section's headline — and the
 * reason is depth, not style. The DOM layer composites over the canvas, so type
 * set in the DOM can only ever sit in front of the entire scene. The arc's
 * nearest cards have to pass over the headline for the depth to read, and the
 * only way to get that with one canvas is to put the type in the scene where it
 * can be depth-tested.
 *
 * Nothing is downloaded. The face is the one next/font already loaded and
 * self-hosted for the rest of the page, read back off the document so the
 * texture cannot drift from the DOM's typography, and the glyphs are rasterised
 * by the browser at request time.
 *
 * Only use this for type at display size. At body size a texture loses to real
 * subpixel-rendered DOM text every time — which is why the Deconstruction's
 * annotations are DOM elements tracking projected 3D anchors instead.
 */

export interface HeadlineTexture {
  texture: THREE.CanvasTexture;
  /** width / height of the drawn canvas, so the plane can match it. */
  aspect: number;
  dispose: () => void;
}

export function drawHeadline(
  lines: readonly string[],
  width: number,
  value: number,
): HeadlineTexture | null {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Mirrors .t-display in globals.css. Kept in step by hand rather than parsed
  // out of the stylesheet: the cascade gives no reliable way to read a class's
  // declarations, and a wrong guess here is silent.
  const weight = 700;
  const tracking = -0.035;
  const leading = 0.9;

  const family =
    getComputedStyle(document.body).fontFamily || 'Inter Tight, Helvetica Neue, Arial, sans-serif';

  // Fit the type to the canvas rather than picking a size and hoping. One
  // measure pass at a reference size gives the scale factor for the real one.
  const probe = 100;
  ctx.font = `${weight} ${probe}px ${family}`;
  const widest = Math.max(
    ...lines.map((l) => ctx.measureText(l).width + tracking * probe * (l.length - 1)),
  );

  // 0.94 leaves a hair of bleed so the outermost glyph edge never lands on the
  // texture border, where the wrap mode would smear it.
  const size = (probe * width * 0.94) / widest;
  const lineHeight = size * leading;
  const height = Math.ceil(lineHeight * lines.length + size * 0.34);

  canvas.width = width;
  canvas.height = height;

  ctx.font = `${weight} ${size}px ${family}`;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = `rgb(${Math.round(242 * value)}, ${Math.round(242 * value)}, ${Math.round(
    240 * value,
  )})`;

  const letterSpacing = tracking * size;

  lines.forEach((line, i) => {
    // Drawn glyph by glyph because canvas `letterSpacing` is not in every
    // engine yet, and the tracking is a real part of how this face is set —
    // dropping it makes the headline noticeably looser than the DOM's.
    let x = width * 0.03;
    const y = size * 0.82 + i * lineHeight;
    for (const ch of line) {
      ctx.fillText(ch, x, y);
      x += ctx.measureText(ch).width + letterSpacing;
    }
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;

  return {
    texture,
    aspect: width / height,
    dispose: () => texture.dispose(),
  };
}
