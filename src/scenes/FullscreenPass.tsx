'use client';

import { forwardRef, useMemo } from 'react';
import * as THREE from 'three';

/**
 * A fullscreen triangle, owned by us rather than borrowed from drei.
 *
 * Two reasons this is not `<ScreenQuad>`:
 *
 *   1. drei's version ships a position attribute and nothing else — no `uv`.
 *      Reading `uv` in the shader silently returns zero for every fragment,
 *      which for a derivative-based shader means a completely blank pass with
 *      no error anywhere. Deriving UV from clip position removes the trap.
 *   2. It must never be frustum-culled. A screen-space pass has no meaningful
 *      bounding volume, and this scene moves the camera tens of units away
 *      from the origin between sections — enough for a quad sitting at 0,0,0
 *      to be culled and the whole effect to vanish mid-scroll.
 *
 * One triangle rather than two: no diagonal seam, and one fewer vertex.
 */
export const FullscreenPass = forwardRef<THREE.Mesh, { renderOrder?: number; children?: React.ReactNode; visible?: boolean }>(
  function FullscreenPass({ renderOrder = 0, children, visible = true }, ref) {
    const geometry = useMemo(() => {
      const g = new THREE.BufferGeometry();
      g.setAttribute(
        'position',
        new THREE.BufferAttribute(
          new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]),
          3,
        ),
      );
      // A dummy uv so three does not warn; the shader derives its own.
      g.setAttribute(
        'uv',
        new THREE.BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2),
      );
      g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
      return g;
    }, []);

    return (
      <mesh
        ref={ref}
        geometry={geometry}
        renderOrder={renderOrder}
        frustumCulled={false}
        matrixAutoUpdate={false}
        visible={visible}
      >
        {children}
      </mesh>
    );
  },
);
