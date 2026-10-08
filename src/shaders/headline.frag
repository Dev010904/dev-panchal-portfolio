precision highp float;

/**
 * SELECTED WORK — set out as a drawing, then made solid.
 *
 * Two masks from one texture (lib/headlineTexture): red is the filled type,
 * green a hairline outline of it. As the camera comes down the shaft the
 * outline is drawn in left to right behind an ember scan line, like a part
 * being set out on the sheet. As the cards sweep in, the fill follows it
 * across. Leaving, the same two fronts run back. Once it is whole, a slow band
 * of light crosses the face every few seconds — the machined sheen the mark
 * has, at the strength of a reflection, never of a highlight.
 *
 * Premultiplied out (blend ONE, ONE_MINUS_SRC_ALPHA): the type covers what is
 * behind it, and the scan line adds light on top, in one draw. The plane is
 * still depth-tested against the opaque cards, so the apex card passes in
 * front of the words and the receding ones pass behind — the depth the
 * headline was put in the scene for in the first place.
 */

uniform sampler2D uMap;
uniform float uDraw;    // 0..1, the outline's front
uniform float uFill;    // 0..1, the fill's front
uniform float uValue;   // the fill's grey, linear
uniform float uTime;
uniform vec3 uEmber;

varying vec2 vUv;

out vec4 fragColor;

void main() {
  vec2 m = texture(uMap, vUv).rg;
  float fill = m.r;
  float line = m.g;
  float x = vUv.x;

  // Fronts overshoot both ends slightly, so 0 is nothing and 1 is everything.
  float drawAt = uDraw * 1.1 - 0.05;
  float fillAt = uFill * 1.2 - 0.1;
  float drawn = 1.0 - smoothstep(drawAt - 0.012, drawAt, x);
  float filled = 1.0 - smoothstep(fillAt - 0.1, fillAt, x);

  // The scan: a thin ember line at the outline's front while it is moving,
  // brightest where it crosses a stroke.
  float live = step(0.002, uDraw) * (1.0 - step(0.998, uDraw));
  float scan = exp(-pow((x - drawAt) / 0.006, 2.0)) * live;

  // The sheen: one soft band every seven seconds, only over finished fill.
  float sweep = fract(uTime / 7.0) * 1.8 - 0.4;
  float sheen = exp(-pow((x - sweep - (vUv.y - 0.5) * 0.18) / 0.05, 2.0)) * 0.55;

  float lineA = line * drawn * (1.0 - filled * fill);
  float fillA = fill * filled;
  float a = clamp(lineA * 0.75 + fillA, 0.0, 1.0);

  vec3 grey = vec3(uValue);
  vec3 c = grey * (lineA * 1.6 + fillA * (1.0 + sheen * uFill));
  c += uEmber * scan * (0.35 + line * 1.6 + fill * 0.5);

  fragColor = vec4(c, a);
}
