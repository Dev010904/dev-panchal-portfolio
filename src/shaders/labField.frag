precision highp float;

out vec4 fragColor;

varying float vEnergy;
varying float vDepth;

uniform vec3 uColor;
uniform vec3 uAccent;
uniform float uOpacity;

/**
 * Points are drawn as soft discs, not squares. The falloff is deliberately
 * tight — a wide glow at 46k points turns the whole field into fog and you
 * lose the letterforms entirely.
 *
 * Displaced particles shift toward ember. That is the only feedback the Lab
 * gives, and it is enough: you can see exactly what your cursor touched and
 * watch the heat drain out of the field as it settles.
 */
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = dot(c, c);
  if (d > 0.25) discard;

  float disc = 1.0 - smoothstep(0.06, 0.25, d);

  // Fade with distance so the far side of the field reads as depth.
  float fog = 1.0 - smoothstep(3.0, 11.0, vDepth);

  vec3 col = mix(uColor, uAccent, vEnergy * 0.92);
  col += vEnergy * 0.35;

  float a = disc * uOpacity * fog * (0.55 + vEnergy * 0.9);
  fragColor = vec4(col, a);
}
