precision highp float;

out vec4 fragColor;

varying float vActive;
varying float vDepth;

uniform vec3  uColor;
uniform vec3  uAccent;
uniform float uOpacity;
uniform float uEdgeOpacity;
uniform float uEdgeActive;

/**
 * Links are context; nodes are content.
 *
 * At thirty-odd edges the lines are the majority of the ink on screen, and
 * drawing them at anything near the node brightness turns the section into a
 * ball of wire with the structure lost inside it. They sit low enough to read
 * as connective tissue, and only the ones touching the focused node come up to
 * full — which is the section's actual argument made visible: not "here are my
 * tools" but "here is what each one pulls in with it".
 */
void main() {
  float lead = smoothstep(0.3, 1.0, vActive);

  float a = mix(uEdgeOpacity, uEdgeActive, lead);
  vec3 col = mix(uColor, uAccent, lead * 0.85);

  float fog = 1.0 - smoothstep(6.0, 18.0, vDepth) * 0.6;

  fragColor = vec4(col, a * uOpacity * fog);
}
