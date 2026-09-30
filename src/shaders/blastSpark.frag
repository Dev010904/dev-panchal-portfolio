precision highp float;

varying float vLife;
varying vec2 vQuad;

uniform float uIntensity;

out vec4 fragColor;

/**
 * The cooling ramp: white-hot, then the ember, then a dull red, then gone.
 * The ember is the site's one accent (#FF5A1F); nothing here adds a hue.
 */
vec3 heat(float t) {
  vec3 white = vec3(1.0, 0.95, 0.86);
  vec3 ember = vec3(1.0, 0.353, 0.122);
  vec3 red = vec3(0.45, 0.06, 0.02);
  return t > 0.6 ? mix(ember, white, (t - 0.6) / 0.4) : mix(red, ember, t / 0.6);
}

void main() {
  // Soft across the width; brightest at the head, so the smear has a front.
  float across = 1.0 - abs(vQuad.y * 2.0 - 1.0);
  float along = smoothstep(0.0, 1.0, vQuad.x);
  float fade = smoothstep(0.0, 0.18, vLife);

  // Above 1.0 while hot, on purpose: the core crosses the bloom threshold and
  // glows, and the glow dies as the spark cools.
  vec3 c = heat(vLife) * (0.6 + 2.4 * vLife * vLife);

  fragColor = vec4(c, across * across * along * fade * uIntensity);
}
