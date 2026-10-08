precision highp float;

uniform float uOpacity;

varying float vEnd;
varying float vSeed;

out vec4 fragColor;

void main() {
  // Mostly cold steel, one in eight the ember: the palette's two lights.
  vec3 c = mix(vec3(0.72, 0.8, 0.94), vec3(1.0, 0.42, 0.16), step(0.88, vSeed));
  // Bright at the mote, gone at the end of the streak, and each one its own
  // brightness so the column has depth instead of a uniform grain.
  float a = uOpacity * (1.0 - vEnd * 0.92) * (0.3 + 0.7 * fract(vSeed * 7.31));
  fragColor = vec4(c, a);
}
