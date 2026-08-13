import * as THREE from 'three';

import { VOLUMETRIC as V } from '@/config/animation';

/**
 * THE LIGHT-SPACE DEPTH PASS.
 *
 * One orthographic depth render of the mark, taken from the shaft light's
 * position, once per frame. The volumetric shafts test every raymarch sample
 * against it to decide whether that point in mid-air is lit or shadowed —
 * which is what makes the god-rays fan around the mark's actual silhouette
 * instead of being a radial gradient with the mark drawn on top.
 *
 * A caustic floor also read this map, via its Laplacian. That was cut; see
 * docs/PERFORMANCE.md. The half-float note below was found while debugging it
 * and matters to the shafts too, so it stays.
 *
 * WHY A LAYER AND NOT A SEPARATE SCENE.
 *
 * The obvious build is a second `THREE.Scene` holding a copy of the mark, and
 * it is wrong for the usual reason: two copies of the same object drift the
 * moment anything animates, and this one is animated by scroll, by a blast, by
 * an idle sway and by a hover. Restricting the light camera to `MARK_LAYER`
 * renders the ACTUAL mark meshes — same transforms, same frame, no copy.
 *
 * `scene.overrideMaterial` then replaces every material with a depth write, so
 * this costs one draw per part and no shader permutations.
 */

/** Objects on this layer are the ones the light sees. */
export const MARK_LAYER = 1;

export const lightDepth = {
  target: null as THREE.WebGLRenderTarget | null,
  camera: null as THREE.OrthographicCamera | null,
  /** world -> light clip -> [0,1]³, ready to index the map and compare depth. */
  matrix: new THREE.Matrix4(),
  ready: false,
};

/**
 * A HALF-FLOAT DEPTH TARGET, NOT RGBA-PACKED BYTES — AND THIS WAS A REAL BUG.
 *
 * The first version used `RGBADepthPacking` into an 8-bit RGBA target with
 * `LinearFilter`, which is the textbook way to store depth without float
 * textures. It is also silently broken the moment anything samples it with
 * interpolation: bilinear filtering blends the four PACKED BYTES of adjacent
 * texels independently, and the low byte of one depth blended with the low
 * byte of another does not decode to anything near the depth in between.
 *
 * On screen that produced exactly what you would expect once you know it —
 * the caustics came back as a blocky, stair-stepped silhouette of the mark
 * with rainbow fringing at every texel boundary. It looked like a broken
 * effect because it was reading a broken number, not because the caustic
 * maths was wrong.
 *
 * Half-float stores depth as an actual value, so filtering interpolates depth
 * rather than its byte representation, and the five-tap Laplacian downstream
 * gets a smooth field to work on. `BasicDepthPacking` writes that value
 * straight to the red channel.
 */
const depthMaterial = new THREE.MeshDepthMaterial({
  depthPacking: THREE.BasicDepthPacking,
});

/** Clip space is [-1,1]; texture lookups and depth compares want [0,1]. */
const BIAS = new THREE.Matrix4().set(
  0.5, 0, 0, 0.5,
  0, 0.5, 0, 0.5,
  0, 0, 0.5, 0.5,
  0, 0, 0, 1,
);

const prevClear = new THREE.Color();

export function initLightDepth(): void {
  if (lightDepth.target) return;

  lightDepth.target = new THREE.WebGLRenderTarget(V.shadowSize, V.shadowSize, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat,
    // See the note on depthMaterial: byte-packed depth cannot be filtered.
    type: THREE.HalfFloatType,
    depthBuffer: true,
    stencilBuffer: false,
  });

  const e = V.lightExtent;
  const cam = new THREE.OrthographicCamera(-e, e, e, -e, V.lightNear, V.lightFar);
  cam.position.set(...V.lightPosition);
  cam.lookAt(0, 0, 0);
  // ONLY the mark. `set` replaces the mask rather than adding to it, so the
  // sweep lines, the Lab field and the wipe overlay cannot leak in and become
  // phantom occluders casting shafts of their own.
  cam.layers.set(MARK_LAYER);
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld();
  lightDepth.camera = cam;
}

/**
 * Render the mark's depth from the light. Must run inside a `useFrame` — after
 * the mark has written its transforms for this frame and before anything
 * samples the map.
 */
export function renderLightDepth(gl: THREE.WebGLRenderer, scene: THREE.Scene): void {
  const cam = lightDepth.camera;
  const rt = lightDepth.target;
  if (!cam || !rt) return;

  const prevTarget = gl.getRenderTarget();
  const prevOverride = scene.overrideMaterial;
  gl.getClearColor(prevClear);
  const prevAlpha = gl.getClearAlpha();

  scene.overrideMaterial = depthMaterial;
  gl.setRenderTarget(rt);
  // 1.0 is "far" — an unwritten texel must read as nothing-in-the-way, or the
  // entire volume outside the mark's silhouette comes back shadowed and there
  // are no shafts at all.
  gl.setClearColor(0xffffff, 1);
  gl.clear(true, true, false);
  gl.render(scene, cam);

  scene.overrideMaterial = prevOverride;
  gl.setRenderTarget(prevTarget);
  gl.setClearColor(prevClear, prevAlpha);

  lightDepth.matrix
    .copy(BIAS)
    .multiply(cam.projectionMatrix)
    .multiply(cam.matrixWorldInverse);
  lightDepth.ready = true;
}

/**
 * Move the shaft light.
 *
 * The depth camera and the shader's `uLightPos` MUST agree: one decides where
 * the shadow is and the other decides where the scattering peaks, and if they
 * disagree the shafts fan around a silhouette that is not the one being lit.
 * Exposing a setter rather than two independent knobs is what stops that
 * happening — and made it possible to find the right position by moving it on
 * a live page instead of guessing and reloading.
 */
export function setLightPosition(x: number, y: number, z: number): void {
  const cam = lightDepth.camera;
  if (!cam) return;
  cam.position.set(x, y, z);
  cam.lookAt(0, 0, 0);
  cam.updateMatrixWorld();
}

export function disposeLightDepth(): void {
  lightDepth.target?.dispose();
  lightDepth.target = null;
  lightDepth.camera = null;
  lightDepth.ready = false;
}
