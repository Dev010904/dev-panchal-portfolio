precision highp float;

out vec4 fragColor;

varying float vFade;
varying float vSeed;

uniform vec3 uColor;
uniform vec3 uAccent;
uniform float uOpacity;

void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d2 = dot(c, c);
  if (d2 > 0.25) discard;
  float disc = 1.0 - smoothstep(0.04, 0.25, d2);

  // A small deterministic fraction of the cloud burns ember as it leaves the
  // surface — a scattering of sparks off machined metal, not a colour wash.
  float spark = step(0.94, vSeed) * vFade;
  vec3 col = mix(uColor, uAccent, spark);

  fragColor = vec4(col, disc * uOpacity * (0.35 + vFade * 0.75));
}
