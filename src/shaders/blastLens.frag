/**
 * THE LENS — chromatic aberration, plus the blast's two refractions.
 *
 * This is postprocessing's own chromatic-aberration shader with two terms
 * added in front of it, and it replaces that effect in the grade pass. A
 * shockwave is not something you see; it is something you see THROUGH — a
 * thin shell of compressed air that bends the picture behind it as it races
 * out — and heat over a fire does the same thing slowly. Both are an offset to
 * where the frame is sampled, and the aberration already resamples the frame,
 * so they cost no extra pass.
 *
 * AT REST THE PICTURE IS THE SAME, NOT SIMILAR: while both strengths are zero
 * the original aberration code below runs verbatim, behind a uniform branch
 * every pixel takes the same way.
 *
 * Distances are in screen heights (x is scaled by `aspect`), so the front is
 * round on any viewport.
 */

#ifdef RADIAL_MODULATION
uniform float modulationOffset;
#endif
uniform vec4 shock;      // xy: centre (uv), z: radius, w: strength
uniform float shockWidth;
uniform vec4 haze;       // xy: centre (uv), z: radius, w: strength
uniform float hazeTime;
varying float vActive;varying vec2 vUvR;varying vec2 vUvB;

vec2 blastOffset(const in vec2 uv) {
  vec2 o = vec2(0.0);
  if (shock.w > 0.0) {
    vec2 d = (uv - shock.xy) * vec2(aspect, 1.0);
    float r = length(d);
    // Derivative of a gaussian across the shell: the picture is pulled in on
    // one side of the front and pushed out on the other, which is the density
    // step of a pressure wave as a lens sees it.
    float x = (r - shock.z) / shockWidth;
    float bend = x * exp(-x * x);
    o += (d / max(r, 1e-4)) * vec2(1.0 / aspect, 1.0) * bend * shock.w;
  }
  if (haze.w > 0.0) {
    vec2 h = (uv - haze.xy) * vec2(aspect, 1.0);
    float m = exp(-dot(h, h) / (haze.z * haze.z));
    // Two incommensurate ripples advected upward: shimmer, not a wobble.
    float t = hazeTime;
    vec2 w = vec2(
      sin(uv.y * 170.0 - t * 11.0 + sin(uv.x * 63.0 + t * 2.3) * 1.9),
      cos(uv.x * 150.0 + uv.y * 41.0 - t * 8.0)
    );
    o += w * m * haze.w;
  }
  return o;
}

void mainImage(const in vec4 inputColor,const in vec2 uv,out vec4 outputColor){
  if (shock.w > 0.0 || haze.w > 0.0) {
    vec2 st = uv + blastOffset(uv);
    vec4 base = texture2D(inputBuffer, st);
    vec2 ra = base.ra;
    vec2 ba = base.ba;
#ifdef RADIAL_MODULATION
    float m = max(distance(uv, vec2(0.5)) * 2.0 - modulationOffset, 0.0);
    if (vActive > 0.0 && m > 0.0) {
      ra = texture2D(inputBuffer, st + (vUvR - uv) * m).ra;
      ba = texture2D(inputBuffer, st + (vUvB - uv) * m).ba;
    }
#else
    if (vActive > 0.0) {
      ra = texture2D(inputBuffer, st + (vUvR - uv)).ra;
      ba = texture2D(inputBuffer, st + (vUvB - uv)).ba;
    }
#endif
    outputColor = vec4(ra.x, base.g, ba.x, max(max(ra.y, ba.y), base.a));
    return;
  }

  // ── postprocessing 6.39's chromatic-aberration.frag, unchanged ──
  vec2 ra=inputColor.ra;vec2 ba=inputColor.ba;
#ifdef RADIAL_MODULATION
  const vec2 center=vec2(0.5);float d=distance(uv,center)*2.0;d=max(d-modulationOffset,0.0);if(vActive>0.0&&d>0.0){ra=texture2D(inputBuffer,mix(uv,vUvR,d)).ra;ba=texture2D(inputBuffer,mix(uv,vUvB,d)).ba;}
#else
  if(vActive>0.0){ra=texture2D(inputBuffer,vUvR).ra;ba=texture2D(inputBuffer,vUvB).ba;}
#endif
  outputColor=vec4(ra.x,inputColor.g,ba.x,max(max(ra.y,ba.y),inputColor.a));
}
