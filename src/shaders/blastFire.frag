precision highp float;

/**
 * THE FIREBALL, ONE BILLOW AT A TIME.
 *
 * A real fireball is not a lit disc. It is a cluster of rolling billows, each
 * white at its heart and cooling outward, the cooled edges turning to soot
 * while the core still burns — so the ball is bright inside and dark-rimmed,
 * and as a whole it goes white → yellow → orange → red → smoke in about a
 * second while it lifts.
 *
 * Each pixel works out a TEMPERATURE — the billow's own heat (from the CPU),
 * hotter toward its centre and in its densest folds — and everything else
 * follows from that one number: the colour off a blackbody ramp, how much
 * light it gives, and how much soot it leaves.
 *
 * Output is premultiplied (blend ONE, ONE_MINUS_SRC_ALPHA): rgb is the light
 * the fire emits plus the soot's own colour, alpha is only how much the soot
 * occludes. So the hot part adds light like a flame does, and the cold part
 * darkens what is behind it like smoke does, in a single draw.
 *
 * Noise is three fetches from a small baked texture (lib/noiseTexture.ts),
 * one of them bending the other two — domain warp is what folds blobs into
 * billows. Per-pixel simplex fbm here would cost ~150 ALU an octave across
 * every overlapping billow; this costs three cached reads.
 */

uniform sampler2D uNoise;
uniform float uTime;  // seconds since the detonation
uniform float uEmit;  // light output
uniform float uSoot;  // smoke opacity once cold

varying vec2 vUv;
varying float vHeat;
varying float vFade;
varying float vSeed;

out vec4 fragColor;

/**
 * Heat → linear radiance. Above 1.0 on purpose for the hot end: it is what
 * crosses the bloom threshold, and the channels clip toward yellow-white the
 * way an overexposed flame does on a sensor.
 */
vec3 blackbody(float t) {
  vec3 c = vec3(0.0);
  c = mix(c, vec3(0.1, 0.012, 0.002), smoothstep(0.06, 0.18, t));   // last glow
  c = mix(c, vec3(0.62, 0.085, 0.012), smoothstep(0.16, 0.34, t));  // deep red
  c = mix(c, vec3(2.0, 0.6, 0.1), smoothstep(0.32, 0.56, t));       // orange
  c = mix(c, vec3(3.4, 2.0, 0.6), smoothstep(0.54, 0.84, t));       // yellow
  c = mix(c, vec3(4.2, 3.6, 2.6), smoothstep(0.84, 1.15, t));       // white heat
  return c;
}

void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  // The quad's corners can never hold fire; dropping them saves the blend.
  if (r >= 1.0) discard;

  // Domain warp: one coarse fetch bends the coordinates of the next two. The
  // sample point also drifts inward over time, so the folds appear to roll
  // outward as the billow grows.
  vec2 q = vUv * 0.7 + vec2(vSeed * 7.13, vSeed * 3.71);
  vec2 warp = texture(uNoise, q + vec2(0.0, -uTime * 0.09)).rg - 0.5;
  vec2 q2 = q * 1.6 + warp * 0.62 - p * (0.16 * uTime);
  float n1 = texture(uNoise, q2).r;
  float n2 = texture(uNoise, q2 * 2.3 - warp * 0.5 + 0.37).g;
  float detail = n1 * 0.68 + n2 * 0.32;

  // A soft silhouette pushed in and out by the folds — never a clean disc.
  float edge = r + (0.5 - detail) * 0.8;
  float density = 1.0 - smoothstep(0.32, 0.92, edge);
  if (density < 0.003) discard;

  float t = vHeat * (1.15 - 0.6 * r) * (0.45 + detail * 1.1);

  vec3 emit = blackbody(t) * uEmit;
  // Soot takes over where it has cooled. A little of the dying glow is left
  // in it, so the edge of the smoke is lit from inside for a moment.
  float soot = 1.0 - smoothstep(0.1, 0.42, t);
  float a = density * soot * uSoot * vFade;
  vec3 smoke = vec3(0.0065, 0.006, 0.0062) + blackbody(t * 1.6) * 0.04;

  fragColor = vec4(emit * density * vFade + smoke * a, a);
}
