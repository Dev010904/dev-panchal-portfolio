precision highp float;

out vec4 fragColor;

varying vec2 vUv;
varying float vRipple;

uniform sampler2D uTex;
uniform float uHover;
uniform float uReveal;
uniform vec3  uAccent;

void main() {
  // Sample with a small chromatic offset driven by the ripple crest, so the
  // deformation is visible in the image and not only in the lighting.
  float off = vRipple * 0.012;
  float r = texture2D(uTex, vUv + vec2(off, 0.0)).r;
  vec4 g = texture2D(uTex, vUv);
  float b = texture2D(uTex, vUv - vec2(off, 0.0)).b;

  vec3 col = vec3(r, g.g, b);

  // Crests catch an ember specular — the same accent the mark uses.
  col += uAccent * max(vRipple, 0.0) * 0.22 * uHover;

  // Idle state sits desaturated and DIM; hovering brings it up.
  //
  // The dimming is aggressive on purpose. A light-background screenshot is the
  // only bright surface anywhere in this site, and dropped in at full value it
  // does two bad things: it punches a white hole in a #08080A page, and it
  // pushes the frame's brightest pixels into the bloom and grain passes, which
  // were tuned for near-black and blow out spectacularly on anything near white.
  // Keeping it dim at rest puts it in the site's value range and makes the
  // hover a genuine reveal.
  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(lum), col, mix(0.5, 1.0, uHover));
  col *= mix(0.62, 1.0, uHover);

  // Reveal wipes bottom-up as the chapter enters.
  float rev = smoothstep(0.0, 0.35, uReveal * 1.35 - (1.0 - vUv.y) * 0.35);

  fragColor = vec4(col, g.a * rev);
}
