'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

import { TRACE, TRACE_ORIGIN_Y } from '@/config/animation';
import { GLSL3, glsl } from '@/lib/glsl';
import { fetchStrokes, type Stroke } from '@/lib/trace';
import { traceHandle } from '@/scenes/handles';
import { sceneState, useScene } from '@/store/scene';
import frag from '@/shaders/trace.frag';
import vert from '@/shaders/trace.vert';

/**
 * THE VISITOR TRACE.
 *
 * Every stroke anyone has drawn, in one shared volume, accumulating. The
 * newest is bright and the oldest is faint — but never gone, which is the
 * whole claim of the section and the reason `TRACE.oldestOpacity` is not
 * allowed to be zero.
 *
 * ── ONE DRAW CALL, NOT TWO HUNDRED ────────────────────────────────────────
 *
 * All 200 strokes are packed into a single `LineSegments` buffer, with a
 * per-vertex `aAge` carrying the stroke's position in the list. Drawing each
 * stroke as its own object would be 200 draw calls for roughly 24,000 line
 * segments — this section would cost more than the mark and the Lab together,
 * for geometry that is 1px wide.
 *
 * Rebuilt only when the stroke list actually changes. Never per frame.
 *
 * ── WHY GL LINES RATHER THAN TUBES ────────────────────────────────────────
 *
 * A "thin self-lit filament" is precisely what a 1px GL line is. Meshline or
 * tube geometry would give width control that this design does not want and
 * cost two orders of magnitude more vertices to express the same curve.
 */
export function VisitorTrace() {
  const group = useRef<THREE.Group>(null!);
  const [strokes, setStrokes] = useState<Stroke[]>([]);

  const active = useScene((s) => s.activeSection === 'TRACE');
  const near = useScene((s) => s.traceNear);

  const opacity = useRef(0);
  const spin = useRef(0);

  // ── Load ────────────────────────────────────────────────────────────────
  // Only once the section is within reach. The home page should not spend a
  // request on a section most visitors scroll past before it is on screen.
  useEffect(() => {
    if (!near) return;
    const ac = new AbortController();
    let alive = true;
    void fetchStrokes(ac.signal).then(({ strokes: s }) => {
      if (alive) setStrokes(s);
    });
    return () => {
      alive = false;
      ac.abort();
    };
  }, [near]);

  // Re-read after this visitor commits theirs, so their own filament joins the
  // structure without a reload. `epoch` is bumped by the DOM section.
  const [epoch, setEpoch] = useState(0);
  useEffect(() => {
    traceHandle.onCommit = () => setEpoch((e) => e + 1);
    return () => {
      traceHandle.onCommit = null;
    };
  }, []);
  useEffect(() => {
    if (epoch === 0) return;
    const ac = new AbortController();
    void fetchStrokes(ac.signal).then(({ strokes: s }) => setStrokes(s));
    return () => ac.abort();
  }, [epoch]);

  // ── Geometry ────────────────────────────────────────────────────────────
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    if (strokes.length === 0) {
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(0), 3));
      g.setAttribute('aAge', new THREE.BufferAttribute(new Float32Array(0), 1));
      return g;
    }

    let segments = 0;
    for (const s of strokes) segments += Math.max(0, s.length / 3 - 1);

    const pos = new Float32Array(segments * 2 * 3);
    const age = new Float32Array(segments * 2);
    let v = 0;

    for (let si = 0; si < strokes.length; si++) {
      const s = strokes[si];
      const n = s.length / 3;
      // Newest first out of the database, so index maps straight to age.
      const a = strokes.length > 1 ? si / (strokes.length - 1) : 0;

      /**
       * A stable depth offset per stroke, hashed from the stroke's OWN
       * geometry rather than from its index. Index-derived placement would
       * reshuffle the entire structure every time anyone new drew, so a
       * returning visitor would not find their filament where they left it.
       */
      let h = 0;
      for (let k = 0; k < s.length; k += 3) h += s[k] * 12.9898 + s[k + 1] * 78.233;
      const off = (Math.abs(Math.sin(h)) - 0.5) * TRACE.depth;

      for (let i = 0; i < n - 1; i++) {
        for (const j of [i, i + 1]) {
          pos[v * 3 + 0] = s[j * 3 + 0] * TRACE.extent;
          pos[v * 3 + 1] = s[j * 3 + 1] * TRACE.extent;
          pos[v * 3 + 2] = s[j * 3 + 2] * TRACE.extent + off;
          age[v] = a;
          v++;
        }
      }
    }

    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aAge', new THREE.BufferAttribute(age, 1));
    return g;
  }, [strokes]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  const uniforms = useMemo(
    () => ({
      uOpacity: { value: 0 },
      uColor: { value: new THREE.Color('#8a8a85') },
      uAccent: { value: new THREE.Color('#ff5a1f') },
      uOldest: { value: TRACE.oldestOpacity },
    }),
    [],
  );

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: glsl(vert),
        fragmentShader: glsl(frag),
        glslVersion: GLSL3,
        uniforms,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [uniforms],
  );

  useEffect(() => () => material.dispose(), [material]);

  useEffect(() => {
    traceHandle.rendered = strokes.length;
  }, [strokes.length]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30);
    const s = sceneState();

    const goal = active ? 1 : 0;
    opacity.current += (goal - opacity.current) * (1 - Math.exp(-TRACE.fadeRate * dt));
    uniforms.uOpacity.value = opacity.current;

    if (!group.current) return;
    group.current.visible = opacity.current > 0.004;
    if (opacity.current <= 0.004) return;

    // Slow rotation, so the structure is legible as a volume rather than as a
    // flat tangle. Reduced motion holds it still.
    if (!s.reducedMotion) spin.current += TRACE.spin * dt;
    group.current.rotation.y = spin.current;

    // Cursor parallax — leans toward the pointer rather than following it, so
    // it reads as depth rather than as an object being dragged.
    const px = s.isMobile ? 0 : s.pointer[0];
    const py = s.isMobile ? 0 : s.pointer[1];
    group.current.rotation.x += (-py * TRACE.parallax - group.current.rotation.x) * (1 - Math.exp(-2.4 * dt));
    group.current.position.x += (px * TRACE.parallax * 2 - group.current.position.x) * (1 - Math.exp(-2.4 * dt));
  });

  return (
    <group ref={group} position={[0, TRACE_ORIGIN_Y, 0]} visible={false}>
      <lineSegments geometry={geometry} material={material} frustumCulled={false} />
    </group>
  );
}
