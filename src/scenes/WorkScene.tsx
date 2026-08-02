'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

import { WORK, WORK_ORIGIN_Y } from '@/config/animation';
import { primaryLink, projects, type Project } from '@/data/projects';
import { GLSL3, glsl } from '@/lib/glsl';
import { drawHeadline } from '@/lib/headlineTexture';
import frag from '@/shaders/card.frag';
import vert from '@/shaders/card.vert';
import { workHandle } from '@/scenes/handles';
import { sceneState, useScene } from '@/store/scene';

/**
 * WORK — the arc.
 *
 * Project screenshots mapped onto panels bent around a large cylinder, sweeping
 * diagonally across the frame. Scroll rotates the ribbon: cards travel through,
 * square up to the camera at the apex, and turn away.
 *
 * THE SHAPE, IN ONE PLACE
 * Every card sits at an angle θ = (i - position) · step on a circle of radius
 * R whose centre is R behind the apex, and is yawed by exactly that θ. That one
 * rule gives all of it — the arc, the tangent lean, the foreshortening, the
 * fact that the apex card is both nearest and square-on — and it means the
 * layout is a pure function of the array length. Nothing about four projects is
 * baked in.
 *
 * WHY THE PANELS ARE IN THE SCENE AND NOT IN THE DOM
 * A DOM card with a CSS 3D transform is a quad the compositor draws after the
 * canvas. It cannot be occluded by the headline plane, it cannot be depth-
 * sorted against its neighbours, and its perspective is a per-element property
 * that does not agree with the camera the rest of the site uses. These are
 * planes in the same room as the mark.
 */
export function WorkScene({ quality }: { quality: 'high' | 'low' }) {
  const near = useScene((s) => s.workNear);
  const [loaded, setLoaded] = useState<Record<string, THREE.Texture>>({});

  const { gl } = useThree();

  // Textures load on approach, not at boot — a below-the-fold screenshot has no
  // business in the preloader's critical path.
  useEffect(() => {
    if (!near) return;
    let cancelled = false;
    const loader = new THREE.TextureLoader();
    const max = gl.capabilities.getMaxAnisotropy();

    projects.forEach((p) => {
      loader.load(p.image, (tex) => {
        if (cancelled) {
          tex.dispose();
          return;
        }
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = Math.min(max, 8);
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.generateMipmaps = true;
        setLoaded((prev) => ({ ...prev, [p.id]: tex }));
      });
    });

    return () => {
      cancelled = true;
    };
  }, [near, gl]);

  useEffect(
    () => () => {
      Object.values(loaded).forEach((t) => t.dispose());
    },
    // Dispose only on unmount — running this on every texture addition would
    // dispose the texture that was just loaded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  if (!near) return null;

  return (
    <group position={[0, WORK_ORIGIN_Y, 0]}>
      <Headline />
      <Ribbon quality={quality} textures={loaded} />
    </group>
  );
}

/* ── The ribbon ───────────────────────────────────────────────────────────── */

/**
 * The ribbon's own +X, in its parent's space — the tangent at the apex, which
 * is the direction the cards are already travelling. Derived from the tilt so
 * the run-out below stays along the arc even if the ribbon is re-angled.
 */
const TANGENT = new THREE.Vector3(1, 0, 0).applyEuler(
  new THREE.Euler(WORK.arc.tilt[0], 0, WORK.arc.tilt[1]),
);

/**
 * THE PLAYHEAD — one function, three segments, one timeline.
 *
 * The middle is the section as it always was: `from` to `to` at a constant
 * rate, so the card-to-card pacing is untouched. The first and last `span` of
 * the pinned scroll are the entry and the exit, carrying the ribbon a further
 * `lead` card units beyond each end.
 *
 * The sweeps are shaped rather than linear. `lead / span` is a much higher rate
 * than the middle segment's, and handing over between two constant rates that
 * differ several-fold reads as a jolt at the seam; an ease-out would arrive at
 * zero speed and read as a stall. So the shaping quadratic is solved for the
 * one condition that matters — that it arrives at the first card at exactly the
 * middle segment's speed — which makes the whole timeline C1 continuous and
 * means the seam cannot be seen in either scroll direction.
 */
function ribbonPosition(p: number, from: number, to: number): number {
  const { lead, span } = WORK.arc.sweep;
  const rate = (to - from) / (1 - 2 * span);
  // shape(0) = 0, shape(1) = 1, shape'(1) = rate·span/lead.
  const a = 2 - (rate * span) / lead;
  const shape = (u: number) => a * u + (1 - a) * u * u;

  if (p < span) return from - lead + lead * shape(p / span);
  if (p > 1 - span) return to + lead * (1 - shape((1 - p) / span));
  return from + rate * (p - span);
}

/**
 * How far the ribbon has run out along its tangent, world units.
 *
 * Read off the DAMPED position rather than off scroll, so the translation and
 * the rotation are the same playhead and cannot drift apart — a flick of the
 * wheel carries both a beat past the last scroll event together, which is the
 * whole reason the damping is there.
 *
 * See `WORK.arc.sweep`: rotation alone cannot clear the frustum, because the
 * four cards span more of the circle than the widest angle this camera fails to
 * see. Past each end of the reading range the ribbon travels bodily along the
 * arc as well as around it, and only then is it genuinely absent rather than
 * merely dim.
 */
function ribbonRunOut(position: number, from: number, to: number): number {
  const { lead, runOut } = WORK.arc.sweep;
  if (position < from) return runOut * Math.min((from - position) / lead, 1);
  if (position > to) return -runOut * Math.min((position - to) / lead, 1);
  return 0;
}

function Ribbon({
  quality,
  textures,
}: {
  quality: 'high' | 'low';
  textures: Record<string, THREE.Texture>;
}) {
  const A = WORK.arc;
  const count = projects.length;

  /**
   * Angular step, derived. `step` is a multiple of the card width, so the gap
   * between panels stays proportional whatever the card size, and the arc
   * length a project occupies is the same for one project or ten.
   */
  const dTheta = (A.cardWidth * A.step) / A.radius;

  const from = -A.overscan;
  const to = count - 1 + A.overscan;

  const group = useRef<THREE.Group | null>(null);
  const meshes = useRef<THREE.Mesh[]>([]);

  /**
   * CLICK.
   *
   * On `window`, not on the mesh, for the same reason the hover test below is
   * a manual raycast: nothing that happens over this section reaches the
   * canvas. Guarded three ways — the section has to be active, a card has to be
   * under the pointer, and the event must not have started on a real control,
   * which is the same `closest()` check HoldToBlast uses so a click on one of
   * the ArrowLinks never also opens the card behind it.
   */
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (sceneState().activeSection !== 'WORK') return;
      const el = e.target instanceof Element ? e.target : null;
      if (el?.closest('a, button, input, textarea, select')) return;
      const i = workHandle.hover;
      if (i < 0 || i >= projects.length) return;
      window.open(primaryLink(projects[i]).href, '_blank', 'noopener,noreferrer');
    };
    window.addEventListener('click', onClick);
    return () => window.removeEventListener('click', onClick);
  }, []);

  return (
    <group ref={group} rotation={[A.tilt[0], 0, A.tilt[1]]}>
      {/* One driver for the whole ribbon, mounted first so its useFrame runs
          before the cards read the value. Damping the shared position in a
          single place — rather than once per card — keeps every panel on
          exactly the same playhead, which is the difference between a ribbon
          and four things that happen to be moving. */}
      <Driver from={from} to={to} count={count} meshes={meshes} group={group} />

      {projects.map((p, i) => (
        <Card
          key={p.id}
          project={p}
          index={i}
          dTheta={dTheta}
          quality={quality}
          texture={textures[p.id]}
          register={(m) => {
            meshes.current[i] = m;
          }}
        />
      ))}
    </group>
  );
}

/**
 * Advances `workHandle.position` toward the scrubbed target and publishes the
 * focused index. Rendered as a component with no output so it gets a useFrame
 * slot that is guaranteed to run before the cards' — R3F dispatches in mount
 * order, and children mount before later siblings.
 */
function Driver({
  from,
  to,
  count,
  meshes,
  group,
}: {
  from: number;
  to: number;
  count: number;
  meshes: React.MutableRefObject<THREE.Mesh[]>;
  group: React.MutableRefObject<THREE.Group | null>;
}) {
  const { camera } = useThree();
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const ndc = useMemo(() => new THREE.Vector2(), []);

  useFrame((_, delta) => {
    const s = sceneState();
    const dt = Math.min(delta, 0.05);

    const goal = ribbonPosition(workHandle.progress, from, to);

    if (s.reducedMotion) {
      workHandle.position = goal;
    } else {
      workHandle.position += (goal - workHandle.position) * (1 - Math.exp(-WORK.arc.damping * dt));
    }

    // The run-out rides the damped position, so the whole ribbon translates and
    // rotates off the same playhead — see ribbonRunOut.
    if (group.current) {
      group.current.position
        .copy(TANGENT)
        .multiplyScalar(ribbonRunOut(workHandle.position, from, to));
    }

    const focus = THREE.MathUtils.clamp(Math.round(workHandle.position), 0, count - 1);
    if (focus !== workHandle.focus) {
      workHandle.focus = focus;
      // One of only two things that cross into React from here. Guarded on an
      // actual change, so this is a handful of updates across the whole section
      // rather than one per frame.
      useScene.getState().setWorkIndex(focus);
    }

    /**
     * HOVER, BY HAND.
     *
     * R3F's own pointer events never fire here. The DOM layer is `z-10` over a
     * `z-0` canvas and `<main>` is a full-height box, so every pointer event in
     * this section is consumed by the DOM long before it reaches the canvas —
     * and `pointer-events: none` on the section does not help, because that
     * makes the section transparent to hit-testing and hands the event straight
     * to its parent rather than to what is painted underneath. Fixing that
     * properly means making the whole page's DOM layer click-through, which is
     * a much larger change to something load-bearing.
     *
     * So the section does its own hit test against the store's pointer, which
     * SceneRoot already maintains from a `window` listener. It costs one
     * raycast against four quads per frame, it is unaffected by whatever is
     * stacked on top, and — because it reads the same pointer the QA harness
     * writes — `__qa.pointer()` can actually drive it.
     */
    let hit = -1;
    if (!s.isMobile && s.activeSection === 'WORK') {
      ndc.set(s.pointer[0], s.pointer[1]);
      raycaster.setFromCamera(ndc, camera);
      const list = meshes.current.filter(Boolean);
      const hits = raycaster.intersectObjects(list, false);
      if (hits.length) hit = list.indexOf(hits[0].object as THREE.Mesh);
    }

    if (hit !== workHandle.hover) {
      workHandle.hover = hit;
      useScene.getState().setHovering(hit >= 0);
    }
  });
  return null;
}

function Card({
  project,
  index,
  dTheta,
  quality,
  texture,
  register,
}: {
  project: Project;
  index: number;
  dTheta: number;
  quality: 'high' | 'low';
  texture?: THREE.Texture;
  register: (m: THREE.Mesh) => void;
}) {
  const A = WORK.arc;
  const mesh = useRef<THREE.Mesh>(null!);

  const aspect = project.imageWidth / project.imageHeight;
  const W = A.cardWidth;
  const H = W / aspect;

  const uniforms = useMemo(
    () => ({
      uTex: { value: texture ?? null },
      uFocus: { value: 0 },
      uHover: { value: 0 },
      uReveal: { value: 0 },
      uRadius: { value: A.radius },
      uAccent: { value: new THREE.Color('#ff5a1f') },
    }),
    // The texture is assigned in an effect below so the material is not rebuilt
    // when it arrives mid-section.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    if (texture) uniforms.uTex.value = texture;
  }, [texture, uniforms]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: glsl(vert),
        fragmentShader: glsl(frag),
        uniforms,
        glslVersion: GLSL3,
        // Opaque on purpose. These panels overlap each other and the headline,
        // and only an opaque material writes the depth that makes the near one
        // genuinely cover the far one.
        transparent: false,
        side: THREE.DoubleSide,
      }),
    [uniforms],
  );

  useEffect(() => () => material.dispose(), [material]);

  const hover = useRef(0);

  useFrame((_, delta) => {
    const s = sceneState();
    const dt = Math.min(delta, 0.05);
    const m = mesh.current;
    if (!m) return;

    const offset = index - workHandle.position;
    const theta = offset * dTheta;

    m.position.set(
      A.radius * Math.sin(theta),
      0,
      A.radius * Math.cos(theta) - A.radius,
    );
    m.rotation.y = theta;

    // Focus: 1 at the apex, 0 by three quarters of a card away. Smoothstepped
    // so the handover between two cards is a crossfade rather than a switch at
    // the midpoint, and steeper than a straight 1/card falloff because the
    // brightest screenshots stay legible long after they should have receded.
    const d = THREE.MathUtils.clamp(1 - Math.abs(offset) * 1.3, 0, 1);
    uniforms.uFocus.value = d * d * (3 - 2 * d);

    const goalHover = workHandle.hover === index ? 1 : 0;
    hover.current += (goalHover - hover.current) * (1 - Math.exp(-A.hover.rate * dt));
    uniforms.uHover.value = hover.current;

    const ready = texture ? 1 : 0;
    uniforms.uReveal.value += (ready - uniforms.uReveal.value) * (1 - Math.exp(-A.revealRate * dt));

    // Scale and lift. Both ride the same focus weight so the apex card is
    // simply the biggest, brightest thing on the arc — no separate state.
    const scale = 1 + (A.focusScale - 1) * uniforms.uFocus.value + (A.hover.scale - 1) * hover.current;
    m.scale.setScalar(s.reducedMotion ? 1 : scale);
    m.translateZ(A.hover.lift * hover.current);
  });

  const segments = quality === 'high' ? A.segments : Math.round(A.segments / 2);

  return (
    // No R3F pointer handlers: hover and click are resolved from a manual
    // raycast in Driver and a window listener in Ribbon. See the note there.
    <mesh
      ref={(m) => {
        if (m) {
          mesh.current = m;
          register(m);
        }
      }}
      material={material}
      frustumCulled={false}
    >
      <planeGeometry args={[W, H, segments, 1]} />
    </mesh>
  );
}

/* ── The headline ─────────────────────────────────────────────────────────── */

/**
 * The section headline, on a plane behind the nearest cards.
 *
 * Transparent with `depthWrite` off, so it never occludes anything itself, but
 * `depthTest` on, so the opaque cards drawn before it in the frame occlude it.
 * That asymmetry is the whole trick: the apex card passes in front of the type
 * and the receding ones pass behind.
 */
function Headline() {
  const [drawn, setDrawn] = useState<ReturnType<typeof drawHeadline>>(null);
  const mat = useRef<THREE.MeshBasicMaterial>(null!);
  const fade = useRef(0);

  useEffect(() => {
    let cancelled = false;
    let made: ReturnType<typeof drawHeadline> = null;

    // Wait for the face. Rasterising before next/font has swapped in gives a
    // headline set in the fallback, permanently, with no error.
    document.fonts.ready.then(() => {
      if (cancelled) return;
      made = drawHeadline(WORK.headline.lines, WORK.headline.resolution, WORK.headline.value);
      setDrawn(made);
    });

    return () => {
      cancelled = true;
      made?.dispose();
    };
  }, []);

  useFrame((_, delta) => {
    if (!mat.current) return;
    const s = sceneState();
    const dt = Math.min(delta, 0.05);
    const goal = s.activeSection === 'WORK' ? 1 : 0;
    fade.current += (goal - fade.current) * (1 - Math.exp(-2.2 * dt));
    mat.current.opacity = s.reducedMotion ? goal : fade.current;
  });

  if (!drawn) return null;

  const w = WORK.headline.width;

  return (
    <mesh position={WORK.headline.position} renderOrder={2}>
      <planeGeometry args={[w, w / drawn.aspect]} />
      <meshBasicMaterial
        ref={mat}
        map={drawn.texture}
        transparent
        depthWrite={false}
        toneMapped={false}
        fog={false}
        opacity={0}
      />
    </mesh>
  );
}
