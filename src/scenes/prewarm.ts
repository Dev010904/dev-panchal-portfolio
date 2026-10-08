import * as THREE from 'three';

/**
 * COMPILE NOW, NOT ON THE FRAME THAT MATTERS.
 *
 * Everything here was learned on the blast (see scenes/BlastFX.tsx) and is
 * shared so the next thing that appears mid-scroll does not have to learn it
 * again:
 *
 *   - Compile against the real scene with a render target bound. Everything
 *     is drawn into the composer's buffer, and three keys tone mapping and
 *     output colour space on what is bound; compiled for the canvas, the
 *     programs come out as variants nothing ever uses.
 *   - Then run three's one-time program check (WebGLProgram.getUniforms()).
 *     Its info-log reads block on ANGLE until the driver has truly finished,
 *     which otherwise lands on the first frame the object is drawn.
 */
export function prewarm(
  gl: THREE.WebGLRenderer,
  object: THREE.Object3D,
  camera: THREE.Camera,
  scene: THREE.Scene,
) {
  const probe = new THREE.WebGLRenderTarget(1, 1);
  const previous = gl.getRenderTarget();
  gl.setRenderTarget(probe);
  const job = gl.compileAsync(object, camera, scene);
  gl.setRenderTarget(previous);
  job
    .catch(() => {
      // A failed async compile only means it compiles inline on first draw.
    })
    .finally(() => {
      probe.dispose();
      for (const program of gl.info.programs ?? []) {
        (program as unknown as { getUniforms?: () => unknown }).getUniforms?.();
      }
    });
}
