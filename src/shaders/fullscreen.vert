precision highp float;

varying vec2 vUv;

/**
 * Screen-space pass-through for a fullscreen triangle.
 *
 * The geometry is a single oversized clip-space triangle — vertices at
 * (-1,-1), (3,-1), (-1,3) — so there is no diagonal seam down the middle the
 * way there is with two triangles, and no matrices are involved.
 *
 * UV is derived from the clip position rather than read from a `uv` attribute,
 * because that attribute does not exist: drei's ScreenQuad ships position only.
 * Reading `uv` there silently yields zero for every fragment, which makes any
 * derivative-based shader (the line field is entirely built on fwidth) produce
 * a flat nothing with no error to explain it.
 *
 * position.xy * 0.5 + 0.5 maps the triangle to 0..2 in both axes, which is
 * exactly the standard fullscreen-triangle UV range.
 */
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
