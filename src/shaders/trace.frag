precision highp float;

out vec4 fragColor;

in float vAge;

uniform vec3  uColor;
uniform vec3  uAccent;
uniform float uOpacity;
uniform float uOldest;

/**
 * Self-lit: no lights, no normals, no shading model. A filament is emissive by
 * definition — it is a record of a gesture, not a surface in a room, and
 * lighting it would make it a wire sculpture instead.
 *
 * The newest stroke carries a little ember. That is the only colour signal in
 * the section and it is doing one job: showing an arriving visitor which
 * filament is theirs, immediately, without labelling anything.
 *
 * `uOldest` is the floor, never zero. Fading a stroke to nothing would delete
 * whoever drew it, which is the one thing this section is not allowed to do.
 */
void main() {
  float fade = mix(1.0, uOldest, vAge);
  vec3 col = mix(uAccent, uColor, smoothstep(0.0, 0.22, vAge));
  fragColor = vec4(col * fade, fade * uOpacity);
}
