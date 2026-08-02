precision highp float;

out vec4 fragColor;

varying vec2 vUv;
varying float vFacing;

uniform sampler2D uTex;
/** 1 at the apex, falling to 0 a card away either side. */
uniform float uFocus;
uniform float uHover;
/** 0 until the texture has landed; fades the panel up out of the page. */
uniform float uReveal;
uniform vec3 uAccent;

void main() {
  vec3 col = texture2D(uTex, vUv).rgb;

  // Focus is the whole grammar of the section: one card is lit and legible,
  // everything else is a dim grey plate that reads as depth rather than as
  // content competing for attention. Hover borrows a little of the focused
  // treatment so an off-apex card still answers the pointer.
  float f = clamp(uFocus + uHover * 0.4, 0.0, 1.0);

  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(lum), col, mix(0.12, 1.0, f));

  // The dimming is aggressive for the same reason the old chapter mock's was:
  // a light screenshot is the only bright surface on a #08080A page, and at
  // full value it punches a hole in the frame and blows out the bloom pass.
  //
  // 0.09 and not 0.3: this multiply lands in LINEAR space and the frame is
  // written out as sRGB, so a linear 0.26 arrives on screen as a mid grey of
  // about 0.54 — which looked like the off-apex cards were barely dimmed at
  // all. 0.09 linear is the ~0.33 that actually reads as receded.
  col *= mix(0.09, 0.8, f);

  // Rim. Strongest exactly where the panel has turned away from the camera,
  // which is where a real edge would catch the rig's cold back light. The
  // focused card's rim warms to the ember instead — one accent, same rule as
  // the mark. Kept low: at full strength it stops being a lit edge and starts
  // being a selection outline drawn around the card.
  float edge = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
  float rim = (1.0 - smoothstep(0.0, 0.014, edge)) * (1.0 - vFacing * 0.82);
  col += mix(vec3(0.34, 0.41, 0.52), uAccent, f) * rim * 0.5;

  // A hairline inset frame so a panel still has a defined edge when it is
  // square on and the rim above has nothing to catch.
  float inset = 1.0 - smoothstep(0.002, 0.005, abs(edge - 0.008));
  col += vec3(0.16, 0.17, 0.2) * inset * (0.25 + f * 0.4);

  // Fade up from the page colour rather than from transparency: these panels
  // are opaque so they occlude each other and the headline correctly, which a
  // transparent material cannot be relied on to do.
  col *= uReveal;

  fragColor = vec4(col, 1.0);
}
