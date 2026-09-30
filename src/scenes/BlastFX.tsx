'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

import { BLAST } from '@/config/animation';
import { GLSL3, glsl } from '@/lib/glsl';
import { blastHandle, markHandles } from '@/scenes/handles';
import billboardVert from '@/shaders/blastBillboard.vert';
import fireballFrag from '@/shaders/blastFireball.frag';
import ringFrag from '@/shaders/blastRing.frag';
import smokeFrag from '@/shaders/blastSmoke.frag';
import smokeVert from '@/shaders/blastSmoke.vert';
import sparkFrag from '@/shaders/blastSpark.frag';
import sparkVert from '@/shaders/blastSpark.vert';
import { sceneState } from '@/store/scene';

const F = BLAST.fx;

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const range = ([a, b]: readonly [number, number]) => rand(a, b);

/** Uniform direction on the unit sphere. */
function randomDir(out: THREE.Vector3): THREE.Vector3 {
  const u = Math.random() * 2 - 1;
  const t = Math.random() * Math.PI * 2;
  const s = Math.sqrt(1 - u * u);
  return out.set(s * Math.cos(t), u, s * Math.sin(t));
}

/** One instanced quad per particle, with the given per-instance attributes. */
function instancedQuad(count: number, attrs: Record<string, number>) {
  const base = new THREE.PlaneGeometry(1, 1);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = base.index;
  geo.setAttribute('position', base.getAttribute('position'));
  geo.setAttribute('uv', base.getAttribute('uv'));
  const out: Record<string, THREE.InstancedBufferAttribute> = {};
  for (const [name, size] of Object.entries(attrs)) {
    const a = new THREE.InstancedBufferAttribute(new Float32Array(count * size), size);
    a.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute(name, a);
    out[name] = a;
  }
  geo.instanceCount = 0;
  return { geo, attrs: out };
}

/**
 * THE DETONATION.
 *
 * Everything the release of a hold throws off the mark: the flash, the core
 * burn, the shockwave, hot filings, graphite chips and a faint haze — see
 * BLAST.fx for what each one is for and why the sequence is in that order.
 *
 * COST. Every mesh here is hidden until a detonation and hidden again once
 * the last particle dies, so at rest this adds nothing to a frame. During one
 * it is a few hundred instanced quads, two small instanced meshes and three
 * billboards, simulated on the CPU in typed arrays with no allocation.
 *
 * NO STALL ON THE FRAME THAT MATTERS. A program compiling the first time it is
 * drawn would land exactly on the detonation frame, the one frame that has to
 * be clean. So every material here is compiled at mount, against the real
 * scene's lights and environment, while the preloader is still covering the
 * page, and with KHR_parallel_shader_compile where the browser has it.
 *
 * Also the one place that knows where the mark is on SCREEN, so it publishes
 * that for the DOM shockwave (blastHandle.center).
 */
export function BlastFX({ quality }: { quality: 'high' | 'low' }) {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const scene = useThree((s) => s.scene);
  const size = useThree((s) => s.size);

  const low = quality === 'low';
  const nSparks = low ? F.sparks.countLow : F.sparks.count;
  const nShards = low ? F.shards.countLow : F.shards.count;
  const nHot = Math.round(nShards * F.shards.hot);
  const nSmoke = low ? F.smoke.countLow : F.smoke.count;

  const root = useRef<THREE.Group>(null!);
  const sparkMesh = useRef<THREE.Mesh>(null!);
  const smokeMesh = useRef<THREE.Mesh>(null!);
  const hotMesh = useRef<THREE.InstancedMesh>(null!);
  const coldMesh = useRef<THREE.InstancedMesh>(null!);
  const fireball = useRef<THREE.Mesh>(null!);
  const ring = useRef<THREE.Mesh>(null!);

  // ── Sparks ────────────────────────────────────────────────────────────────
  const sparks = useMemo(() => {
    const { geo, attrs } = instancedQuad(nSparks, { iPos: 3, iVel: 3, iLife: 2 });
    const mat = new THREE.ShaderMaterial({
      vertexShader: glsl(sparkVert),
      fragmentShader: glsl(sparkFrag),
      glslVersion: GLSL3,
      uniforms: {
        uTrail: { value: F.sparks.trail },
        uWidth: { value: F.sparks.width },
        uPixelRatio: { value: 1 },
        uViewport: { value: new THREE.Vector2(1, 1) },
        uIntensity: { value: 1 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    return {
      geo,
      mat,
      attrs,
      pos: new Float32Array(nSparks * 3),
      vel: new Float32Array(nSparks * 3),
      life: new Float32Array(nSparks),
      max: new Float32Array(nSparks),
      width: new Float32Array(nSparks),
    };
  }, [nSparks]);

  // ── Shards: graphite chips, some leaving hot ─────────────────────────────
  const shards = useMemo(() => {
    // A tetrahedron scaled unevenly per instance reads as a flake, a sliver
    // or a chip — the variety is in the scale, not in the geometry.
    const geo = new THREE.TetrahedronGeometry(0.5, 0);
    const cold = new THREE.MeshStandardMaterial({
      color: '#1d1e23',
      roughness: 0.42,
      metalness: 0.7,
      flatShading: true,
    });
    const hot = new THREE.MeshStandardMaterial({
      color: '#1a1614',
      roughness: 0.55,
      metalness: 0.3,
      emissive: new THREE.Color('#ff5a1f'),
      emissiveIntensity: 0,
      flatShading: true,
    });
    return {
      geo,
      cold,
      hot,
      pos: new Float32Array(nShards * 3),
      vel: new Float32Array(nShards * 3),
      axis: new Float32Array(nShards * 3),
      aspect: new Float32Array(nShards * 3),
      angle: new Float32Array(nShards),
      spin: new Float32Array(nShards),
      size: new Float32Array(nShards),
      life: new Float32Array(nShards),
    };
  }, [nShards]);

  // ── Smoke ─────────────────────────────────────────────────────────────────
  const smoke = useMemo(() => {
    const { geo, attrs } = instancedQuad(nSmoke, { iPos: 3, iData: 4 });
    const mat = new THREE.ShaderMaterial({
      vertexShader: glsl(smokeVert),
      fragmentShader: glsl(smokeFrag),
      glslVersion: GLSL3,
      uniforms: {
        uOpacity: { value: F.smoke.opacity },
        uHeat: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
    });
    return {
      geo,
      mat,
      attrs,
      pos: new Float32Array(nSmoke * 3),
      vel: new Float32Array(nSmoke * 3),
      size: new Float32Array(nSmoke),
      seed: new Float32Array(nSmoke),
      rot: new Float32Array(nSmoke),
      turn: new Float32Array(nSmoke),
      life: new Float32Array(nSmoke),
      max: new Float32Array(nSmoke),
    };
  }, [nSmoke]);

  // ── Fireball and shockwave: one billboard each ────────────────────────────
  const billboards = useMemo(() => {
    const quad = new THREE.PlaneGeometry(1, 1);
    const fire = new THREE.ShaderMaterial({
      vertexShader: glsl(billboardVert),
      fragmentShader: glsl(fireballFrag),
      glslVersion: GLSL3,
      uniforms: { uSize: { value: 0 }, uTime: { value: 0 }, uSeed: { value: 0 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const shock = new THREE.ShaderMaterial({
      vertexShader: glsl(billboardVert),
      fragmentShader: glsl(ringFrag),
      glslVersion: GLSL3,
      uniforms: {
        uSize: { value: 0 },
        uProgress: { value: 0 },
        uWidth: { value: F.shockwave.width },
        uIntensity: { value: F.shockwave.intensity },
        uSeed: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    return { quad, fire, shock };
  }, []);

  useEffect(
    () => () => {
      sparks.geo.dispose();
      sparks.mat.dispose();
      shards.geo.dispose();
      shards.cold.dispose();
      shards.hot.dispose();
      smoke.geo.dispose();
      smoke.mat.dispose();
      billboards.quad.dispose();
      billboards.fire.dispose();
      billboards.shock.dispose();
    },
    [sparks, shards, smoke, billboards],
  );

  // Compile every program now, against the real scene's lights, fog and
  // environment — `compile` walks materials whether or not they are visible.
  useEffect(() => {
    if (!root.current) return;
    gl.compileAsync(root.current, camera, scene).catch(() => {
      // A failed async compile only means the first detonation compiles
      // inline, which is the behaviour this exists to avoid, not a break.
    });
  }, [gl, camera, scene, sparks, shards, smoke, billboards]);

  const st = useRef({
    active: false,
    t0: 0,
    lastDetonation: blastHandle.detonations,
    center: new THREE.Vector3(),
    envBase: 1,
  });

  const v = useMemo(() => new THREE.Vector3(), []);
  const dir = useMemo(() => new THREE.Vector3(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const m4 = useMemo(() => new THREE.Matrix4(), []);
  const scl = useMemo(() => new THREE.Vector3(), []);
  const ax = useMemo(() => new THREE.Vector3(), []);

  const spawn = (now: number) => {
    const s = st.current;
    const group = markHandles.current.group;
    if (!group) return;
    group.getWorldPosition(s.center);
    const C = s.center;
    const anchors = markHandles.current.anchors;

    // Sparks: from inside the object, in every direction.
    for (let i = 0; i < nSparks; i++) {
      randomDir(dir);
      const r0 = Math.random() * 0.35;
      const speed = range(F.sparks.speed);
      sparks.pos[i * 3] = C.x + dir.x * r0;
      sparks.pos[i * 3 + 1] = C.y + dir.y * r0;
      sparks.pos[i * 3 + 2] = C.z + dir.z * r0;
      sparks.vel[i * 3] = dir.x * speed;
      sparks.vel[i * 3 + 1] = dir.y * speed;
      sparks.vel[i * 3 + 2] = dir.z * speed;
      sparks.life[i] = sparks.max[i] = range(F.sparks.life);
      sparks.width[i] = rand(0.6, 1.4);
    }

    // Shards: broken off the actual parts, flung away from the core with a
    // little lift so they arc before gravity takes them.
    for (let i = 0; i < nShards; i++) {
      const a = anchors.length ? anchors[(Math.random() * anchors.length) | 0] : C;
      v.set(a.x + rand(-0.28, 0.28), a.y + rand(-0.4, 0.4), a.z + rand(-0.18, 0.18));
      dir.copy(v).sub(C).add(randomDir(ax).multiplyScalar(0.6)).normalize();
      const speed = range(F.shards.speed);
      shards.pos[i * 3] = v.x;
      shards.pos[i * 3 + 1] = v.y;
      shards.pos[i * 3 + 2] = v.z;
      shards.vel[i * 3] = dir.x * speed;
      shards.vel[i * 3 + 1] = dir.y * speed + rand(0.5, 2);
      shards.vel[i * 3 + 2] = dir.z * speed;
      randomDir(ax);
      shards.axis[i * 3] = ax.x;
      shards.axis[i * 3 + 1] = ax.y;
      shards.axis[i * 3 + 2] = ax.z;
      shards.aspect[i * 3] = rand(0.35, 1);
      shards.aspect[i * 3 + 1] = rand(0.6, 1.6);
      shards.aspect[i * 3 + 2] = rand(0.2, 0.8);
      shards.angle[i] = Math.random() * Math.PI * 2;
      shards.spin[i] = range(F.shards.spin) * (Math.random() < 0.5 ? -1 : 1);
      shards.size[i] = range(F.shards.size);
      shards.life[i] = range(F.shards.life);
    }

    // Smoke: slow, low, drifting up.
    for (let i = 0; i < nSmoke; i++) {
      randomDir(dir);
      smoke.pos[i * 3] = C.x + dir.x * 0.3;
      smoke.pos[i * 3 + 1] = C.y + dir.y * 0.3;
      smoke.pos[i * 3 + 2] = C.z + dir.z * 0.3;
      const speed = rand(0.3, 1.1);
      smoke.vel[i * 3] = dir.x * speed;
      smoke.vel[i * 3 + 1] = dir.y * speed * 0.6 + F.smoke.rise;
      smoke.vel[i * 3 + 2] = dir.z * speed;
      smoke.size[i] = range(F.smoke.size);
      smoke.seed[i] = Math.random();
      smoke.rot[i] = Math.random() * Math.PI * 2;
      smoke.turn[i] = rand(-0.3, 0.3);
      smoke.life[i] = smoke.max[i] = range(F.smoke.life);
    }

    fireball.current.position.copy(C);
    ring.current.position.copy(C);
    billboards.fire.uniforms.uSeed.value = Math.random() * 100;
    billboards.shock.uniforms.uSeed.value = Math.random() * 100;

    s.envBase = scene.environmentIntensity;
    s.active = true;
    s.t0 = now;
    blastHandle.kickAt = now;
  };

  useFrame((_, delta) => {
    const s = st.current;
    const env = sceneState();
    const now = performance.now() / 1000;

    // Where the mark is on screen, for the DOM wave. One frame behind the
    // camera, which nobody can see on the origin of a shockwave.
    const group = markHandles.current.group;
    if (group && env.shot === 'hero') {
      group.getWorldPosition(v).project(camera);
      blastHandle.center[0] = (v.x * 0.5 + 0.5) * size.width;
      blastHandle.center[1] = (-v.y * 0.5 + 0.5) * size.height;
      blastHandle.centerValid = v.z < 1;
    } else {
      blastHandle.centerValid = false;
    }

    if (blastHandle.detonations !== s.lastDetonation) {
      s.lastDetonation = blastHandle.detonations;
      // The mark has to be the subject. A detonation in the Lab is the
      // field's, and throwing debris off an object that is not on screen
      // would fill an empty frame with sparks from nowhere.
      if (env.shot === 'hero' && !env.reducedMotion) spawn(now);
    }

    if (!s.active) return;

    const t = now - s.t0;
    const dt = Math.min(delta, 0.05);

    // ── Flash ───────────────────────────────────────────────────────────────
    const flash = Math.exp((-t * 3) / F.flash.duration);
    blastHandle.flash = flash > 0.002 ? flash : 0;
    scene.environmentIntensity = s.envBase * (1 + blastHandle.flash * (F.flash.env - 1));

    // ── Core burn ───────────────────────────────────────────────────────────
    const ft = t / F.fireball.duration;
    fireball.current.visible = ft < 1;
    if (ft < 1) {
      billboards.fire.uniforms.uTime.value = ft;
      billboards.fire.uniforms.uSize.value = F.fireball.size * (0.25 + 0.75 * (1 - (1 - ft) ** 3));
    }

    // ── Shockwave ───────────────────────────────────────────────────────────
    // Decelerating, as a real front does once it has spent its overpressure.
    const rt = t / F.shockwave.duration;
    ring.current.visible = rt < 1;
    if (rt < 1) {
      billboards.shock.uniforms.uProgress.value = rt;
      billboards.shock.uniforms.uSize.value = 2 * F.shockwave.radius * (1 - (1 - rt) ** 2.2) + 0.01;
    }

    // ── Sparks ──────────────────────────────────────────────────────────────
    {
      const drag = Math.exp(-F.sparks.drag * dt);
      const P = sparks.attrs.iPos.array as Float32Array;
      const V = sparks.attrs.iVel.array as Float32Array;
      const L = sparks.attrs.iLife.array as Float32Array;
      let n = 0;
      for (let i = 0; i < nSparks; i++) {
        if (sparks.life[i] <= 0) continue;
        sparks.life[i] -= dt;
        if (sparks.life[i] <= 0) continue;
        const k = i * 3;
        sparks.vel[k] *= drag;
        sparks.vel[k + 1] = sparks.vel[k + 1] * drag - F.sparks.gravity * dt;
        sparks.vel[k + 2] *= drag;
        sparks.pos[k] += sparks.vel[k] * dt;
        sparks.pos[k + 1] += sparks.vel[k + 1] * dt;
        sparks.pos[k + 2] += sparks.vel[k + 2] * dt;
        const o = n * 3;
        P[o] = sparks.pos[k];
        P[o + 1] = sparks.pos[k + 1];
        P[o + 2] = sparks.pos[k + 2];
        V[o] = sparks.vel[k];
        V[o + 1] = sparks.vel[k + 1];
        V[o + 2] = sparks.vel[k + 2];
        L[n * 2] = sparks.life[i] / sparks.max[i];
        L[n * 2 + 1] = sparks.width[i];
        n++;
      }
      sparks.geo.instanceCount = n;
      sparks.attrs.iPos.needsUpdate = true;
      sparks.attrs.iVel.needsUpdate = true;
      sparks.attrs.iLife.needsUpdate = true;
      sparks.mat.uniforms.uPixelRatio.value = gl.getPixelRatio();
      gl.getDrawingBufferSize(sparks.mat.uniforms.uViewport.value);
      sparkMesh.current.visible = n > 0;
    }

    // ── Shards ──────────────────────────────────────────────────────────────
    {
      const drag = Math.exp(-F.shards.drag * dt);
      let hotCount = 0;
      let coldCount = 0;
      for (let i = 0; i < nShards; i++) {
        if (shards.life[i] <= 0) continue;
        shards.life[i] -= dt;
        if (shards.life[i] <= 0) continue;
        const k = i * 3;
        shards.vel[k] *= drag;
        shards.vel[k + 1] = shards.vel[k + 1] * drag - F.shards.gravity * dt;
        shards.vel[k + 2] *= drag;
        shards.pos[k] += shards.vel[k] * dt;
        shards.pos[k + 1] += shards.vel[k + 1] * dt;
        shards.pos[k + 2] += shards.vel[k + 2] * dt;
        shards.angle[i] += shards.spin[i] * dt;

        ax.set(shards.axis[k], shards.axis[k + 1], shards.axis[k + 2]);
        q.setFromAxisAngle(ax, shards.angle[i]);
        // Shrink away over the last third of a second rather than popping out.
        const s01 = shards.size[i] * Math.min(1, shards.life[i] / 0.35);
        scl.set(s01 * shards.aspect[k], s01 * shards.aspect[k + 1], s01 * shards.aspect[k + 2]);
        v.set(shards.pos[k], shards.pos[k + 1], shards.pos[k + 2]);
        m4.compose(v, q, scl);

        if (i < nHot) hotMesh.current.setMatrixAt(hotCount++, m4);
        else coldMesh.current.setMatrixAt(coldCount++, m4);
      }
      hotMesh.current.count = hotCount;
      coldMesh.current.count = coldCount;
      hotMesh.current.instanceMatrix.needsUpdate = true;
      coldMesh.current.instanceMatrix.needsUpdate = true;
      hotMesh.current.visible = hotCount > 0;
      coldMesh.current.visible = coldCount > 0;
      // Every hot chip cools on the same curve: glowing at the release,
      // graphite again within a second.
      shards.hot.emissiveIntensity = 4 * Math.exp((-t * 3) / F.shards.cool);
    }

    // ── Smoke ───────────────────────────────────────────────────────────────
    {
      const drag = Math.exp(-0.9 * dt);
      const P = smoke.attrs.iPos.array as Float32Array;
      const D = smoke.attrs.iData.array as Float32Array;
      let n = 0;
      for (let i = 0; i < nSmoke; i++) {
        if (smoke.life[i] <= 0) continue;
        smoke.life[i] -= dt;
        if (smoke.life[i] <= 0) continue;
        const k = i * 3;
        smoke.vel[k] *= drag;
        smoke.vel[k + 1] = smoke.vel[k + 1] * drag + F.smoke.rise * dt;
        smoke.vel[k + 2] *= drag;
        smoke.pos[k] += smoke.vel[k] * dt;
        smoke.pos[k + 1] += smoke.vel[k + 1] * dt;
        smoke.pos[k + 2] += smoke.vel[k + 2] * dt;
        smoke.size[i] *= 1 + F.smoke.grow * dt;
        smoke.rot[i] += smoke.turn[i] * dt;
        const o = n * 3;
        P[o] = smoke.pos[k];
        P[o + 1] = smoke.pos[k + 1];
        P[o + 2] = smoke.pos[k + 2];
        D[n * 4] = smoke.size[i];
        D[n * 4 + 1] = smoke.life[i] / smoke.max[i];
        D[n * 4 + 2] = smoke.seed[i];
        D[n * 4 + 3] = smoke.rot[i];
        n++;
      }
      smoke.geo.instanceCount = n;
      smoke.attrs.iPos.needsUpdate = true;
      smoke.attrs.iData.needsUpdate = true;
      smoke.mat.uniforms.uHeat.value = Math.exp(-t * 7);
      smokeMesh.current.visible = n > 0;
    }

    // Done when the last thing has died: hand the environment back exactly.
    const alive =
      ft < 1 ||
      rt < 1 ||
      blastHandle.flash > 0 ||
      sparkMesh.current.visible ||
      hotMesh.current.visible ||
      coldMesh.current.visible ||
      smokeMesh.current.visible;
    if (!alive) {
      s.active = false;
      blastHandle.flash = 0;
      scene.environmentIntensity = s.envBase;
    }
  });

  return (
    <group ref={root}>
      {/* Order matters for the transparent layers: haze first, then the burn,
          the ring and the filings over it. The chips are opaque. */}
      <mesh
        ref={smokeMesh}
        geometry={smoke.geo}
        material={smoke.mat}
        frustumCulled={false}
        renderOrder={10}
        visible={false}
      />
      <instancedMesh
        ref={coldMesh}
        args={[shards.geo, shards.cold, Math.max(1, nShards - nHot)]}
        frustumCulled={false}
        visible={false}
      />
      <instancedMesh
        ref={hotMesh}
        args={[shards.geo, shards.hot, Math.max(1, nHot)]}
        frustumCulled={false}
        visible={false}
      />
      <mesh
        ref={fireball}
        geometry={billboards.quad}
        material={billboards.fire}
        frustumCulled={false}
        renderOrder={11}
        visible={false}
      />
      <mesh
        ref={ring}
        geometry={billboards.quad}
        material={billboards.shock}
        frustumCulled={false}
        renderOrder={12}
        visible={false}
      />
      <mesh
        ref={sparkMesh}
        geometry={sparks.geo}
        material={sparks.mat}
        frustumCulled={false}
        renderOrder={13}
        visible={false}
      />
    </group>
  );
}
