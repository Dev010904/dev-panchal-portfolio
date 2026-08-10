import * as THREE from 'three';

import { lensUniforms, withLens } from '@/scenes/lens';

/**
 * MATERIALS — near-black machined aluminium.
 *
 * The whole look rests on one idea: a dark object in a photo studio is legible
 * almost entirely through its edges. So the diffuse colour is nearly black and
 * does almost nothing, metalness is 1 so the surface is pure reflection, and
 * roughness sits in a narrow band (0.26–0.42) where reflections are soft enough
 * to read as anodised but tight enough to hold a sharp highlight along a
 * chamfer. Raise roughness past ~0.5 and the whole thing turns to charcoal mud;
 * drop it below ~0.2 and it becomes a mirror ball and stops reading as metal.
 *
 * envMapIntensity above 1 is deliberate: the Lightformer rig in Stage.tsx is
 * dim by design (it has to be, on a #08080A page) and this buys the highlight
 * back without lifting the black.
 */

export type MaterialKey = 'graphite' | 'steel' | 'ember' | 'archive';

/**
 * A procedural roughness map.
 *
 * Uniform roughness is the single most reliable tell that a render is CG: real
 * machined metal has swirl, tooling marks and handling, so its highlights break
 * up along a surface instead of sitting there as one clean gradient. This is a
 * few octaves of smooth value noise at 128², generated in code — no download,
 * and it costs 64KB of GPU memory.
 *
 * Values are biased high because `roughnessMap` MULTIPLIES the material's
 * roughness. The material carries the ceiling; the map only ever takes it
 * down, into the 0.15–0.28 band where a dark metal still holds a sharp chamfer
 * highlight but is not a mirror.
 */
function createRoughnessTexture(): THREE.DataTexture {
  const size = 128;
  const data = new Uint8Array(size * size * 4);

  // Three sine octaves at irrational frequency ratios, so the pattern never
  // visibly tiles into a plaid.
  const phase = [0.7, 2.3, 5.1];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x / size) * Math.PI * 2;
      const v = (y / size) * Math.PI * 2;

      let n = 0;
      n += Math.sin(u * 3 + phase[0]) * Math.cos(v * 2 + phase[1]) * 0.5;
      n += Math.sin(u * 7.3 + phase[1]) * Math.cos(v * 5.1 + phase[2]) * 0.3;
      n += Math.sin(u * 17.1 + phase[2]) * Math.cos(v * 13.7 + phase[0]) * 0.2;

      const value = Math.round(THREE.MathUtils.clamp(0.78 + n * 0.22, 0.5, 1) * 255);
      const i = (y * size + x) * 4;
      data[i] = value;
      data[i + 1] = value;
      data[i + 2] = value;
      data[i + 3] = 255;
    }
  }

  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  // The extrusion's UVs are in grid units, not 0..1, so the map already tiles
  // several times across a face at repeat 1. Anything higher turns to sparkle.
  tex.repeat.set(0.35, 0.35);
  tex.needsUpdate = true;
  return tex;
}

export function createMaterials() {
  const roughnessMap = createRoughnessTexture();

  const graphite = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#0b0b0d'),
    metalness: 0.96,
    // Ceiling, not the value. The map pulls this down to ~0.15–0.28 across the
    // surface. The old 0.3 flat was the main reason the object read as dark
    // plastic: at that roughness a near-black metal returns almost no sharp
    // reflection, so the chamfers had nothing to catch.
    roughness: 0.28,
    roughnessMap,
    envMapIntensity: 2.1,
    // Radial brushing on the arcs — catches the rim lights as a swept streak
    // rather than a point, which is what sells "machined" over "moulded".
    anisotropy: 0.6,
    anisotropyRotation: Math.PI * 0.25,
  });

  // Deliberately duller than the graphite. The shims sit behind the mark and
  // must not out-shine it — a bright backing plate pulls the eye straight off
  // the monogram.
  const steel = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#101115'),
    metalness: 0.94,
    roughness: 0.44,
    roughnessMap,
    envMapIntensity: 0.9,
  });

  const ember = createEmberMaterial(roughnessMap);

  /**
   * THE ARCHIVE'S PLATES.
   *
   * Reusing `steel` was the obvious thing and it was wrong here. These plates
   * are broad flat faces fanned through every angle at once, so whatever the
   * rig puts at their mirror direction, one of them is always pointing straight
   * at it — and from a low camera that is the ember kicker, which came back as
   * a row of hard orange edges. The bars this replaced dodged the problem by
   * sitting at one angle and picking a camera azimuth that missed the kicker; a
   * fan has no single angle to pick, so the material has to solve it instead.
   *
   * Roughness up and envMapIntensity down turns a mirror into a record card.
   * The rig still shapes the faces — the cold rim still draws them as they turn
   * — but it no longer paints them, which is the difference between the steel
   * lighting this object and the steel becoming its colour. Metalness comes off
   * 0.94 for the same reason: a full metal has no diffuse at all, so with the
   * environment turned down it would simply be black.
   *
   * None of this costs legibility, because legibility here is the seams' job
   * and they owe the rig nothing. See `createSeamMaterial`.
   */
  const archive = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#12151b'),
    metalness: 0.62,
    // 0.68/0.3 and not 0.58/0.55, which still left a hard orange line down the
    // bevel of every plate that happened to face the kicker. The mirror
    // direction has to be blurred far enough that a narrow warm strip arrives
    // as a wash rather than as an edge — at which point it stops being an
    // accent colour and goes back to being light.
    roughness: 0.68,
    roughnessMap,
    envMapIntensity: 0.3,
  });

  /**
   * The lens goes on the three materials the MARK is made of, and deliberately
   * not on `archive`. The archive is a different object in a different region
   * of the room, it has no design grid and no bolt stations, and giving it the
   * inspection view would turn a considered reveal into a screen-wide gimmick
   * that follows the cursor everywhere. One object answers to the lens.
   */
  withLens(graphite, 'graphite');
  withLens(steel, 'steel');
  withLens(ember, 'ember');

  return { graphite, steel, ember, archive } satisfies Record<MaterialKey, THREE.Material>;
}

/**
 * THE INLAY.
 *
 * The accent strip used to be a flat orange slab with a trace of emissive, and
 * it read exactly like what it was: paint applied to the front of the object.
 *
 * Two changes fix that. First the emissive is graded along the strip's own
 * length — hot in the middle, falling away to almost nothing at the ends — so
 * the colour looks like it is coming from inside the channel rather than
 * covering it. Second the grade is pushed above 1 at the centre, which is what
 * puts it over the bloom threshold and gives the surrounding graphite a faint
 * warm bounce.
 *
 * The gradient is computed from object-space Y in a shader injection rather
 * than from a texture, because the extrusion's UVs are in design-grid units
 * with no normalised range to sample against.
 */
function createEmberMaterial(roughnessMap: THREE.Texture) {
  const mat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#5a1c07'),
    metalness: 0.9,
    roughness: 0.22,
    roughnessMap,
    envMapIntensity: 1.7,
    emissive: new THREE.Color('#ff5a1f'),
    // Read together with the ×1.5 in the shader below: the centre lands around
    // 0.8, which crosses the bloom threshold, and the ends fall to ~0.05.
    emissiveIntensity: 0.5,
  });

  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLocal;')
      .replace('#include <fog_vertex>', '#include <fog_vertex>\n  vLocal = position;');

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLocal;')
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
         // The strip runs roughly -0.85..0.85 in object Y. Grade from a hot
         // centre to cold ends, with a slow shoulder so there is no visible
         // band where the falloff starts.
         float t = clamp(abs(vLocal.y) / 0.85, 0.0, 1.0);
         float glow = mix(1.0, 0.06, smoothstep(0.15, 1.0, t));
         // Above 1 in the middle on purpose — that is the part bloom sees.
         totalEmissiveRadiance *= glow * 1.5;`,
      );
  };

  // Without this every ember material shares one compiled program with the
  // stock physical shader, since three keys the cache on the material type.
  mat.customProgramCacheKey = () => 'ember-graded';

  return mat;
}

/**
 * THE SELF-LIT SEAM — the archive's guarantee that it is never invisible.
 *
 * Every other material on this site is a metal that owes its entire appearance
 * to the rig. That is right for the mark, which is always framed deliberately,
 * and it was fatal for the credentials structure: lit only by a rim, it went to
 * pure black at every angle where nothing caught, and an invisible object on a
 * page about 3D is a bug rather than a mood.
 *
 * A basic material cannot go dark. It ignores lights, normals and environment
 * entirely, so whatever value is written here is what lands — which makes the
 * seams a floor under the object's legibility rather than another thing for the
 * lighting to miss.
 *
 * `toneMapped: false` for that same reason: with ACES in the pipeline a value
 * of 0.62 would arrive as something else, and the whole point is that this
 * number is the grey on screen. It sits just under the 0.72 bloom threshold, so
 * the seams read as lit edges without hazing the section — and the per-instance
 * colour can push one plate OVER that threshold on hover, which is what makes
 * the hover read as a light coming on rather than as a tint change.
 */
export function createSeamMaterial() {
  return new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false });
}

/**
 * Clone a mark material for per-part opacity control.
 *
 * `Material.clone()` does NOT carry `onBeforeCompile` or
 * `customProgramCacheKey` — three's copy() simply does not include them. A
 * plain clone of the ember therefore silently drops the emissive gradient and
 * renders as a flat bar of colour, which is exactly the "orange sticker" look
 * the grade exists to remove. Anything cloning these must come through here.
 */
export function cloneMarkMaterial(source: THREE.Material): THREE.Material {
  const clone = source.clone();
  clone.onBeforeCompile = source.onBeforeCompile;
  clone.customProgramCacheKey = source.customProgramCacheKey;
  return clone;
}

/**
 * THE LENS'S HIDDEN EDGES.
 *
 * The one thing the solid shader genuinely cannot do. A fragment shader only
 * ever runs on the surface that won the depth test, so a grazing-angle term
 * inside the lens finds the chamfers of whatever part is in FRONT and can never
 * find the edges of the part behind it — and "the edges you cannot normally
 * see" is the whole premise of an X-ray view.
 *
 * `depthTest: false` is the answer, and it costs nothing extra because the
 * EdgesGeometry these draw is already built for the wireframe state. The edges
 * of every part draw through every other part, which is what a section view
 * actually looks like. They are then gated to the lens in screen space, so
 * outside it they contribute exactly zero.
 *
 * `depthWrite` stays off for the obvious reason: a line that wrote depth while
 * ignoring it would occlude the solid it is supposed to be drawn over.
 */
export function createXrayEdgeMaterial() {
  const mat = new THREE.LineBasicMaterial({
    color: new THREE.Color('#7fa8d4'),
    transparent: true,
    opacity: 1,
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });

  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, lensUniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform vec2  uLensPos;
         uniform float uLensRadius;
         uniform float uLensEdge;
         uniform float uLensAmount;`,
      )
      .replace(
        '#include <opaque_fragment>',
        `
         float lr = length(gl_FragCoord.xy - uLensPos) / max(uLensRadius, 1.0);
         // Squared falloff rather than the solid's smoothstep: hidden edges are
         // additive, so a linear edge fade leaves a visible disc of haze at the
         // boundary where the solid has already faded out.
         float lm = 1.0 - smoothstep(1.0 - max(uLensEdge, 0.001), 1.0, lr);
         diffuseColor.a *= lm * lm * uLensAmount;
         #include <opaque_fragment>`,
      );
  };

  mat.customProgramCacheKey = () => 'xray-edge';
  return mat;
}

/** Wireframe state — edges only, plus a fresnel ghost of the solid behind them. */
export function createEdgeMaterial() {
  return new THREE.LineBasicMaterial({
    color: new THREE.Color('#f2f2f0'),
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
}

/**
 * The faint volume that sits behind the wireframe. Without it the outline
 * state has no mass and the object looks like it vanished rather than turned
 * to glass. Fresnel-only, so it is invisible face-on and rims the silhouette.
 */
export function createGhostMaterial() {
  const mat = new THREE.MeshBasicMaterial({
    color: new THREE.Color('#3a6ea5'),
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
  });

  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vN;\nvarying vec3 vV;')
      .replace(
        '#include <fog_vertex>',
        `#include <fog_vertex>
         vN = normalize(normalMatrix * normal);
         vV = normalize((modelViewMatrix * vec4(position, 1.0)).xyz);`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vN;\nvarying vec3 vV;')
      .replace(
        '#include <opaque_fragment>',
        `float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.6);
         diffuseColor.a *= fres;
         #include <opaque_fragment>`,
      );
  };

  return mat;
}
