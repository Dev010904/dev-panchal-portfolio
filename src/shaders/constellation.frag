precision highp float;

out vec4 fragColor;

varying float vGlow;
varying float vWeight;
varying float vDepth;

uniform vec3  uColor;
uniform vec3  uAccent;
uniform float uOpacity;

/**
 * A node is drawn as a CORE plus a RING, not as a soft dot.
 *
 * The soft-dot version was tried first and it is wrong for this section for a
 * reason that only shows up at the real node count: twenty-seven gaussian
 * blobs read as dust, and dust has no topology. You cannot see that one of
 * them is bigger than another, so the weight encoding — the whole reason the
 * data file carries a `weight` at all — is invisible.
 *
 * A hard core with a separated ring around it reads as a discrete object at
 * any size, and the ring's own strength carries the weight: the load-bearing
 * tools get a full ring, the supporting ones get barely a trace of one.
 *
 * Colour is spent, not spread. The four clusters are NOT tinted differently —
 * they are already separated in space, and four hues on a near-black page
 * would turn a restrained section into a chart. The ember is reserved for the
 * one node under the pointer, so the accent means "this one" everywhere on the
 * site rather than meaning "render" here and something else elsewhere.
 */
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  if (d > 0.5) discard;

  float core = 1.0 - smoothstep(0.10, 0.19, d);
  float ring = smoothstep(0.30, 0.36, d) * (1.0 - smoothstep(0.42, 0.48, d));
  float halo = (1.0 - smoothstep(0.0, 0.5, d)) * 0.24 * vGlow;

  float mask = clamp(core + ring * mix(0.30, 1.0, vWeight) + halo, 0.0, 1.0);
  if (mask < 0.004) discard;

  float lead = smoothstep(0.55, 1.0, vGlow);

  vec3 col = mix(uColor, uAccent, lead);
  // Weight sets the resting brightness; glow lifts a neighbour without letting
  // it reach the ember, which is what keeps "focused" unambiguous.
  col *= mix(mix(0.55, 1.0, vWeight), 1.5, vGlow);

  // Depth fade, so the far lobe sits behind rather than competing. Never to
  // zero: a cluster that disappears when it rotates away has been deleted for
  // half of every revolution.
  float fog = 1.0 - smoothstep(6.0, 18.0, vDepth) * 0.55;

  fragColor = vec4(col, mask * uOpacity * fog);
}
