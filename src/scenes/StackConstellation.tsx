'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

import { CONSTELLATION, CONSTELLATION_ORIGIN_Y } from '@/config/animation';
import { CLUSTERS, EDGES, STACK, clusterIndex } from '@/data/stack';
import { GLSL3, glsl } from '@/lib/glsl';
import { constellationHandle } from '@/scenes/handles';
import { travelPresence } from '@/scenes/travel';
import { sceneState, useScene } from '@/store/scene';
import nodeFrag from '@/shaders/constellation.frag';
import nodeVert from '@/shaders/constellation.vert';
import edgeFrag from '@/shaders/constellationEdge.frag';
import edgeVert from '@/shaders/constellationEdge.vert';

/**
 * THE CONSTELLATION.
 *
 * The stack as a graph you can point at: four clusters on a ring, nodes sized
 * by how load-bearing the tool is, links that mean something. The pointer picks
 * the nearest node, that node lifts and goes ember, everything it touches comes
 * up with it, and the DOM prints what it is.
 *
 * ── TWO DRAW CALLS, TOTAL ─────────────────────────────────────────────────
 *
 * Every node is one vertex in a single `Points`, every link is two vertices in
 * a single `LineSegments`. The obvious alternative — a mesh per node so it can
 * be raycast, plus a `Line` per edge — is fifty-nine draw calls for a diagram
 * made of twenty-seven dots, in a scene that is already carrying a raymarched
 * volumetric pass. It would cost more than the mark.
 *
 * ── THE LAYOUT IS DETERMINISTIC, AND THAT IS A REQUIREMENT ────────────────
 *
 * Same nodes in, same positions out, on every machine and every reload. A
 * force-directed layout settling live would look more sophisticated and would
 * be strictly worse: it cannot be screenshotted, it cannot be described in
 * writing, and an arrangement that is different every visit is an arrangement
 * that means nothing. Here the position IS the claim — inner means central to
 * the work — so it has to hold still long enough to be read.
 *
 * ── WHY THIS REPLACED THE VISITOR TRACE ───────────────────────────────────
 *
 * The slot used to hold a shared drawing surface. It was a nice idea with a
 * structural problem: it made the one section a stranger's content, it needed
 * a database and two build-time environment variables to say anything at all,
 * and on a cold table it rendered an empty volume under a caption promising an
 * archive. This says something on the first frame, for every visitor, with no
 * network involved.
 */

/** Golden angle. Even angular spacing at any node count. */
const GOLDEN = 2.399963229728653;

/**
 * Deterministic 0..1 from an integer. Not for anything cryptographic — it
 * places a node's depth inside its lobe, and the only property that matters is
 * that it returns the same number for the same index forever.
 */
function hash1(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/**
 * Where every node sits, in the constellation's own space.
 *
 * The ring lies in the XY plane — the plane roughly facing the camera — rather
 * than the horizontal one. That is not a style choice: the section's shot sits
 * at 7 degrees of elevation, so a ring laid flat in XZ would be viewed almost
 * edge-on and would collapse into a line. `ringTilt` then pushes alternating
 * lobes forward and back in Z, so the four clusters resolve at different depths
 * instead of reading as a flat wheel painted on the screen.
 */
function buildLayout(): Float32Array {
  const C = CONSTELLATION;
  const pos = new Float32Array(STACK.length * 3);

  const members: number[][] = CLUSTERS.map(() => []);
  STACK.forEach((n, i) => members[clusterIndex(n.cluster)].push(i));

  members.forEach((group, ci) => {
    // The quarter-turn offset puts the lobes at the diagonals rather than at
    // twelve/three/six/nine o'clock, which keeps the widest part of the
    // structure off the horizontal centre line where the section's own text is.
    const a = (ci / CLUSTERS.length) * Math.PI * 2 + Math.PI / 4;
    const cx = Math.cos(a) * C.ringRadius;
    const cy = Math.sin(a) * C.ringRadius;
    /**
     * SIN, not cos. With the quarter-turn offset above, `2a` lands on 90°,
     * 270°, 450° and 630° — every one an odd multiple of 90°, where cosine is
     * zero. So `cos(2a)` evaluated to 0 for all four lobes and `ringTilt` was
     * silently doing nothing at all: the ring was perfectly flat in Z and the
     * only depth in the structure came from the per-node jitter.
     *
     * Sine of the same angles gives +1, -1, +1, -1 — which is the alternating
     * near/far arrangement this was always meant to produce.
     */
    const cz = Math.sin(a * 2) * C.ringRadius * C.ringTilt;

    // Heaviest first, so the load-bearing tool takes the innermost slot and
    // the cluster reads outward from its own centre of gravity.
    const sorted = [...group].sort((p, q) => STACK[q].weight - STACK[p].weight);
    const last = Math.max(sorted.length - 1, 1);

    sorted.forEach((idx, k) => {
      // Phyllotaxis: sqrt radius against the golden angle is the arrangement
      // that keeps areal density even, so no two nodes in a lobe land on top
      // of each other regardless of how many there are.
      const r = C.coreRadius + (C.lobeRadius - C.coreRadius) * Math.sqrt(k / last);
      const th = k * GOLDEN + ci * 1.1;

      pos[idx * 3 + 0] = cx + Math.cos(th) * r;
      pos[idx * 3 + 1] = cy + Math.sin(th) * r;
      pos[idx * 3 + 2] = cz + (hash1(idx + 1) - 0.5) * C.lobeDepth;
    });
  });

  return pos;
}

/** Adjacency, resolved once. Drives which nodes come up with the focused one. */
const NEIGHBOURS: number[][] = (() => {
  const adj: number[][] = STACK.map(() => []);
  for (const [a, b] of EDGES) {
    adj[a].push(b);
    adj[b].push(a);
  }
  return adj;
})();

/** Scratch, reused every frame. Allocating a Vector3 per node per frame is 27
 *  allocations at 60fps, which is the kind of thing that shows up as GC saw-
 *  tooth in a profile and as nothing at all in a screenshot. */
const scratch = new THREE.Vector3();
const originScratch = new THREE.Vector3();

/**
 * The structure's real outer radius, measured from the layout rather than
 * assumed from the config.
 *
 * `ringRadius + lobeRadius` is the intended bound, but the depth jitter pushes
 * some nodes further out and the true extent is what the fit-to-frame scale has
 * to divide by. Deriving it means adding a node, retuning a radius or changing
 * the jitter cannot silently leave part of the graph off-screen.
 */
function measureExtent(pos: Float32Array): number {
  let max = 0;
  for (let i = 0; i < pos.length; i += 3) {
    const d = Math.hypot(pos[i], pos[i + 1], pos[i + 2]);
    if (d > max) max = d;
  }
  return max || 1;
}

export function StackConstellation() {
  const group = useRef<THREE.Group>(null!);
  const active = useScene((s) => s.activeSection === 'CONSTELLATION');
  const setFocus = useScene((s) => s.setConstellationFocus);

  const opacity = useRef(0);
  const spin = useRef(0);

  /** Damped per-node glow. 0 idle, 0.5 neighbour, 1 focused. */
  const glow = useMemo(() => new Float32Array(STACK.length), []);
  /** What each node is heading toward. Recomputed only when focus changes. */
  const goals = useMemo(() => new Float32Array(STACK.length), []);
  const lastTarget = useRef(-2);

  /** Mobile auto-walk. See CONSTELLATION.autoFocusMs. */
  const autoMs = useRef(0);
  const autoIndex = useRef(0);

  const base = useMemo(() => buildLayout(), []);
  const extent = useMemo(() => measureExtent(base), [base]);

  const nodeGeom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(base, 3));
    g.setAttribute(
      'aWeight',
      new THREE.BufferAttribute(
        Float32Array.from(STACK, (n) => n.weight),
        1,
      ),
    );
    g.setAttribute('aGlow', new THREE.BufferAttribute(new Float32Array(STACK.length), 1));
    return g;
  }, [base]);

  const edgeGeom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const p = new Float32Array(EDGES.length * 2 * 3);

    EDGES.forEach(([a, b], i) => {
      p[i * 6 + 0] = base[a * 3 + 0];
      p[i * 6 + 1] = base[a * 3 + 1];
      p[i * 6 + 2] = base[a * 3 + 2];
      p[i * 6 + 3] = base[b * 3 + 0];
      p[i * 6 + 4] = base[b * 3 + 1];
      p[i * 6 + 5] = base[b * 3 + 2];
    });

    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    g.setAttribute('aGlow', new THREE.BufferAttribute(new Float32Array(EDGES.length * 2), 1));
    g.setAttribute('aActive', new THREE.BufferAttribute(new Float32Array(EDGES.length * 2), 1));
    return g;
  }, [base]);

  useEffect(() => {
    return () => {
      nodeGeom.dispose();
      edgeGeom.dispose();
    };
  }, [nodeGeom, edgeGeom]);

  const nodeUniforms = useMemo(
    () => ({
      uOpacity: { value: 0 },
      uColor: { value: new THREE.Color('#8a8a85') },
      uAccent: { value: new THREE.Color('#ff5a1f') },
      uPointSize: { value: CONSTELLATION.nodeSize },
      uFit: { value: 1 },
      uPixelRatio: { value: 1 },
      uSizeRange: {
        value: new THREE.Vector2(CONSTELLATION.sizeRange[0], CONSTELLATION.sizeRange[1]),
      },
      uLift: { value: CONSTELLATION.focus.lift },
      uGrow: { value: CONSTELLATION.focus.grow },
    }),
    [],
  );

  const edgeUniforms = useMemo(
    () => ({
      uOpacity: { value: 0 },
      uColor: { value: new THREE.Color('#8a8a85') },
      uAccent: { value: new THREE.Color('#ff5a1f') },
      uEdgeOpacity: { value: CONSTELLATION.edge.opacity },
      uEdgeActive: { value: CONSTELLATION.edge.activeOpacity },
      uLift: { value: CONSTELLATION.focus.lift },
    }),
    [],
  );

  useEffect(() => {
    nodeUniforms.uPixelRatio.value = Math.min(
      typeof window === 'undefined' ? 1 : window.devicePixelRatio,
      2,
    );
  }, [nodeUniforms]);

  const nodeMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: glsl(nodeVert),
        fragmentShader: glsl(nodeFrag),
        glslVersion: GLSL3,
        uniforms: nodeUniforms,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [nodeUniforms],
  );

  const edgeMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: glsl(edgeVert),
        fragmentShader: glsl(edgeFrag),
        glslVersion: GLSL3,
        uniforms: edgeUniforms,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [edgeUniforms],
  );

  useEffect(
    () => () => {
      nodeMaterial.dispose();
      edgeMaterial.dispose();
    },
    [nodeMaterial, edgeMaterial],
  );

  // Leaving the section must clear the readout, or the DOM keeps printing the
  // last tool the pointer happened to pass on the way out.
  useEffect(() => {
    if (active) return;
    lastTarget.current = -2;
    constellationHandle.focus = -1;
    setFocus(-1);
  }, [active, setFocus]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30);
    const s = sceneState();

    // Inside a band to or from this place, the camera's progress decides;
    // otherwise the section does. See scenes/travel.
    const goal = travelPresence('constellation') ?? (active ? 1 : 0);
    opacity.current += (goal - opacity.current) * (1 - Math.exp(-CONSTELLATION.fadeRate * dt));
    nodeUniforms.uOpacity.value = opacity.current;
    edgeUniforms.uOpacity.value = opacity.current;

    if (!group.current) return;
    group.current.visible = opacity.current > 0.004;

    // Everything below is interaction and per-node bookkeeping. None of it is
    // observable while the section is faded out, so it does not run then —
    // this is the whole reason the section costs nothing on the hero.
    if (opacity.current <= 0.004) return;

    // Accumulates seconds, not angle. The yaw is a sine of it, so reduced
    // motion simply stops advancing the clock and the structure holds at
    // whatever angle it had reached rather than snapping back to square.
    if (!s.reducedMotion) spin.current += dt;
    group.current.rotation.y =
      Math.sin(spin.current * CONSTELLATION.sway.rate) * CONSTELLATION.sway.amplitude;

    const px = s.isMobile || s.reducedMotion ? 0 : s.pointer[0];
    const py = s.isMobile || s.reducedMotion ? 0 : s.pointer[1];
    const lean = 1 - Math.exp(-2.4 * dt);
    group.current.rotation.x += (-py * CONSTELLATION.parallax - group.current.rotation.x) * lean;
    group.current.position.x += (px * CONSTELLATION.parallax * 2 - group.current.position.x) * lean;

    /**
     * FIT TO FRAME.
     *
     * Measured against the live frustum at the group's real distance, so the
     * structure fills the same fraction of the screen on a 21:9 desktop and a
     * portrait phone. `min(halfH, halfW)` picks whichever axis is actually
     * binding — height on a wide window, width on a narrow one — and the scale
     * is never allowed above 1, so a very tall viewport does not inflate the
     * graph past the size it was designed at.
     */
    const cam = state.camera as THREE.PerspectiveCamera;
    group.current.getWorldPosition(originScratch);
    const dist = cam.position.distanceTo(originScratch);
    const halfH = dist * Math.tan((cam.fov * Math.PI) / 360);
    const halfW = halfH * (state.size.width / Math.max(state.size.height, 1));
    const fit = Math.min(1, (Math.min(halfH, halfW) * CONSTELLATION.fitMargin) / extent);
    group.current.scale.setScalar(fit);

    // Nodes shrink with the structure, but only halfway. Scaling them fully
    // would make a phone's nodes genuinely too small to aim at; not scaling
    // them at all would let the sprites overlap once the lobes tighten.
    nodeUniforms.uFit.value = 0.5 + 0.5 * fit;

    // ── Pick ────────────────────────────────────────────────────────────────
    let target = -1;

    if (s.isMobile) {
      /**
       * No pointer, so the section would otherwise be a still picture under a
       * caption that never changes. The focus walks the nodes on its own.
       * Desktop never runs this: an auto-advancing focus would fight the
       * cursor for the same readout.
       */
      autoMs.current += dt * 1000;
      if (autoMs.current >= CONSTELLATION.autoFocusMs) {
        autoMs.current = 0;
        autoIndex.current = (autoIndex.current + 1) % STACK.length;
      }
      target = autoIndex.current;
    } else if (active) {
      const aspect = state.size.width / Math.max(state.size.height, 1);
      // `focus.radius` is a fraction of viewport HEIGHT; NDC y spans 2 over
      // the height, so the comparison happens in half-height units and x has
      // to be scaled by aspect to mean the same thing.
      const limit = CONSTELLATION.focus.radius * 2;

      let bestD = Infinity;
      let best = -1;

      for (let i = 0; i < STACK.length; i++) {
        scratch.set(base[i * 3], base[i * 3 + 1], base[i * 3 + 2]);
        group.current.localToWorld(scratch);
        scratch.project(state.camera);
        // Behind the camera projects to a valid-looking point in front of it.
        if (scratch.z > 1) continue;

        const dx = (scratch.x - s.pointer[0]) * aspect;
        const dy = scratch.y - s.pointer[1];
        const d = Math.hypot(dx, dy);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }

      target = bestD <= limit ? best : -1;
    }

    // ── Glow ────────────────────────────────────────────────────────────────
    if (target !== lastTarget.current) {
      lastTarget.current = target;
      goals.fill(0);
      if (target >= 0) {
        goals[target] = 1;
        for (const n of NEIGHBOURS[target]) goals[n] = 0.5;
      }
      if (target !== constellationHandle.focus) {
        constellationHandle.focus = target;
        setFocus(target);
      }
    }

    const k = 1 - Math.exp(-CONSTELLATION.focus.rate * dt);
    for (let i = 0; i < glow.length; i++) glow[i] += (goals[i] - glow[i]) * k;

    const ng = nodeGeom.getAttribute('aGlow') as THREE.BufferAttribute;
    (ng.array as Float32Array).set(glow);
    ng.needsUpdate = true;

    const eg = edgeGeom.getAttribute('aGlow') as THREE.BufferAttribute;
    const ea = edgeGeom.getAttribute('aActive') as THREE.BufferAttribute;
    const egArr = eg.array as Float32Array;
    const eaArr = ea.array as Float32Array;

    for (let i = 0; i < EDGES.length; i++) {
      const [a, b] = EDGES[i];
      const m = Math.max(glow[a], glow[b]);
      egArr[i * 2 + 0] = glow[a];
      egArr[i * 2 + 1] = glow[b];
      eaArr[i * 2 + 0] = m;
      eaArr[i * 2 + 1] = m;
    }
    eg.needsUpdate = true;
    ea.needsUpdate = true;
  });

  return (
    <group ref={group} position={[0, CONSTELLATION_ORIGIN_Y, 0]} visible={false}>
      {/* Links first so nodes composite over them. Both are additive and
          depth-write is off, so draw order is the only thing deciding which
          one wins where a line passes behind a node's core. */}
      <lineSegments geometry={edgeGeom} material={edgeMaterial} frustumCulled={false} />
      <points geometry={nodeGeom} material={nodeMaterial} frustumCulled={false} />
    </group>
  );
}
