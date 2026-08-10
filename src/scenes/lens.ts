import * as THREE from 'three';

import { LENS } from '@/config/animation';
import { glsl } from '@/lib/glsl';
import { CENTER, MARK_SCALE, PINS } from '@/lib/mark/paths';
import xray from '@/shaders/lib/xray.glsl';

/**
 * THE INSPECTION LENS — shared uniform block and material injection.
 *
 * ONE uniform object, shared by reference across every material the lens
 * touches. That matters more than it looks: the mark's parts each get their own
 * cloned material so their opacity can be crossfaded independently, so a
 * per-material uniform would mean six lens positions to keep in step and six
 * chances for one of them to lag a frame behind the pointer. `Object.assign`ing
 * this block into each compiled shader makes them all point at the same
 * `{ value }` objects, so writing the position once moves every part's lens.
 */
export const lensUniforms = {
  uLensPos: { value: new THREE.Vector2(-1e4, -1e4) },
  uLensRadius: { value: 1 },
  uLensEdge: { value: LENS.edge },
  uLensAmount: { value: 0 },
  uLensRefract: { value: LENS.refract },
  /** (1 / MARK_SCALE, CENTER.x, CENTER.y) — the grid conversion, from paths.ts. */
  uMarkGrid: { value: new THREE.Vector3(1 / MARK_SCALE, CENTER[0], CENTER[1]) },
  uLensStep: { value: LENS.gridStep },
  uLensLineW: { value: LENS.lineWidth },
  uBoltX: { value: PINS.positions[0][0] },
  uBoltY: {
    value: new THREE.Vector3(
      PINS.positions[0][1],
      PINS.positions[1][1],
      PINS.positions[2][1],
    ),
  },
  uBoltRing: { value: LENS.boltRing },
  uLensValues: {
    value: new THREE.Vector4(
      LENS.values.solid,
      LENS.values.grid,
      LENS.values.bolt,
      LENS.values.edge,
    ),
  },
  uLensRimValue: { value: LENS.values.rim },
  /** Cold steel. The one hue in the identity that is allowed to be structural. */
  uLensTint: { value: new THREE.Color('#3a6ea5') },
  uLensAccent: { value: new THREE.Color('#ff5a1f') },
};

/**
 * Live lens state, read by the render loop and never by React.
 *
 * `amount` is damped rather than switched. Snapping it means the drawing
 * appears on one frame, which reads as a bug; damping means the lens opens,
 * which reads as an instrument being brought up to the object.
 */
export const lensHandle = {
  /** Target pointer position in CSS pixels, top-left origin. */
  targetX: -1e4,
  targetY: -1e4,
  /** Damped position, CSS pixels. */
  x: -1e4,
  y: -1e4,
  /** 0..1, damped. */
  amount: 0,
  /** Set false on touch, under reduced motion, and while the drawer is open. */
  armed: false,
  /**
   * Is the pointer inside the window at all?
   *
   * Separate from `armed` because they fail differently. `armed` is a policy
   * question — is the mark the subject of this shot — and it is answered in the
   * render loop. This is a fact about the input device, and it is answered by
   * `pointerenter`/`pointerleave` in SceneRoot.
   *
   * It starts false, which is the part that matters: a page loaded and never
   * touched must not open a lens at (0, 0). The first `pointermove` sets it true
   * and seeds the damped position, so the lens opens where the cursor actually
   * is instead of sliding in from the corner.
   */
  present: false,
};

/**
 * Inject the lens into a material.
 *
 * Wraps rather than replaces any `onBeforeCompile` the material already had —
 * the ember's graded emissive is one of those, and losing it turns the inlay
 * back into the flat orange sticker the grade exists to remove.
 *
 * `customProgramCacheKey` has to change too. three keys its program cache on
 * material type plus that string, so without a distinct key every lens material
 * would be handed the stock physical program and the injection would silently
 * do nothing.
 */
export function withLens<T extends THREE.Material>(mat: T, cacheKey: string): T {
  const prior = mat.onBeforeCompile;
  const priorKey = mat.customProgramCacheKey;

  mat.onBeforeCompile = (shader, renderer) => {
    prior?.call(mat, shader, renderer);

    Object.assign(shader.uniforms, lensUniforms);

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vMarkLocal;')
      .replace(
        '#include <fog_vertex>',
        '#include <fog_vertex>\n  vMarkLocal = position;',
      );

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${glsl(xray)}`)
      .replace(
        '#include <opaque_fragment>',
        `
        // Grazing-angle term. vViewPosition is the NEGATED view-space position,
        // so normalising it gives the direction back to the eye — which is what
        // makes this a real fresnel rather than a depth ramp.
        float lensFres = 1.0 - abs(dot(normalize(normal), normalize(vViewPosition)));
        outgoingLight = applyLens(outgoingLight, gl_FragCoord.xy, lensFres);
        #include <opaque_fragment>`,
      );
  };

  mat.customProgramCacheKey = () => `${priorKey ? priorKey.call(mat) : 'base'}|lens|${cacheKey}`;
  return mat;
}

/**
 * Advance the lens toward the pointer.
 *
 * Frame-rate independent damping, `1 - exp(-k·dt)`, per the design system. A
 * fixed lerp factor here would make the lens noticeably heavier on a 144Hz
 * display than on a 60Hz one, which is the class of bug that only ever shows up
 * on someone else's machine.
 */
export function updateLens(dt: number, resolution: THREE.Vector2, pixelRatio: number) {
  const h = lensHandle;
  const follow = 1 - Math.exp(-LENS.followRate * dt);
  const fade = 1 - Math.exp(-LENS.fadeRate * dt);

  h.x += (h.targetX - h.x) * follow;
  h.y += (h.targetY - h.y) * follow;
  h.amount += ((h.armed ? 1 : 0) - h.amount) * fade;

  // Device pixels, and Y flipped: gl_FragCoord counts from the bottom-left,
  // pointer events count from the top-left. Getting this wrong produces a lens
  // that mirrors the cursor about the horizontal centre — which looks like
  // damping gone wrong and is very easy to chase in the wrong place.
  lensUniforms.uLensPos.value.set(h.x * pixelRatio, resolution.y - h.y * pixelRatio);
  lensUniforms.uLensRadius.value = LENS.radius * resolution.y;
  lensUniforms.uLensAmount.value = h.amount;
}
