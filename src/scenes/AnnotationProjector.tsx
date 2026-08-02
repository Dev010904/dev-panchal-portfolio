'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useMemo } from 'react';
import * as THREE from 'three';

import { annotationScreen, markHandles } from './handles';
import { sceneState } from '@/store/scene';

/**
 * Projects each part's world anchor into screen pixels for the DOM leader
 * lines to follow.
 *
 * This lives inside the Canvas because it needs the camera, but it writes to a
 * plain module array rather than React state — the annotations move every
 * frame, and pushing sixty state updates a second through React to reposition
 * six divs would cost more than the entire 3D scene.
 */
export function AnnotationProjector() {
  const { camera, size } = useThree();
  const v = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    const s = sceneState();

    const anchors = markHandles.current.anchors;
    for (let i = 0; i < anchors.length; i++) {
      v.copy(anchors[i]).project(camera);
      const entry = (annotationScreen[i] ??= { x: 0, y: 0, z: 0, visible: false });
      entry.x = (v.x * 0.5 + 0.5) * size.width;
      entry.y = (-v.y * 0.5 + 0.5) * size.height;
      entry.z = v.z;
      // z > 1 means the point is behind the camera; without this check the
      // annotation flips to the opposite side of the screen when the camera
      // passes the object.
      entry.visible = v.z < 1;
    }
  });

  return null;
}
