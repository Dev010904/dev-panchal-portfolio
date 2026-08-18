precision highp float;

/**
 * One filament vertex.
 *
 * `aAge` is 0 for the newest stroke in the set and 1 for the oldest. Nothing
 * else varies per vertex — the structure's whole visual language is that a
 * stroke's only property is when it arrived.
 */

in float aAge;

out float vAge;

void main() {
  vAge = aAge;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
