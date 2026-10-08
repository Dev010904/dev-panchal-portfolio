'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

import { BLAST } from '@/config/animation';
import { GLSL3, glsl } from '@/lib/glsl';
import { createNoiseTexture } from '@/lib/noiseTexture';
import { blastHandle, blastLensHandle, markHandles } from '@/scenes/handles';
import billboardVert from '@/shaders/blastBillboard.vert';
import fireFrag from '@/shaders/blastFire.frag';
import fireVert from '@/shaders/blastFire.vert';
import flashFrag from '@/shaders/blastFlash.frag';
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
 * Everything the release of a hold throws off the mark: the white-hot flash,
 * the fireball, the light it casts, the pressure front and the shimmer after
 * it, hot filings and embers, and graphite chips — see BLAST.fx for what each
 * one is for and why the sequence is in that order.
 *
 * COST. Every mesh here, and the light, is hidden until a detonation and
 * hidden again once the last particle dies, so at rest this adds nothing to a
 * frame. During one it is a few hundred instanced quads, a handful of fire
 * billows reading a baked noise texture, two small instanced meshes and one
 * billboard, simulated on the CPU in typed arrays with no allocation.
 *
 * NO STALL ON THE FRAME THAT MATTERS. A program compiling the first time it is
 * drawn would land exactly on the detonation frame, the one frame that has to
 * be clean. So every material here is compiled at mount, against the real
 * scene's lights and environment, while the preloader is still covering the
 * page, and with KHR_parallel_shader_compile where the browser has it. That
 * includes the light: switching it on changes the light count every lit
 * program was built for, so the mark and the chips are compiled a second time
 * WITH it on, and the switch picks up programs that already exist.
 *
 * Also the one place that knows where the mark is on SCREEN, so it publishes
 * that for the DOM strike (blastHandle.center) and the lens (blastLensHandle).
 */
export function BlastFX({ quality }: { quality: 'high' | 'low' }) {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const scene = useThree((s) => s.scene);
  const size = useThree((s) => s.size);

  const low = quality === 'low';
  const nSparks = low ? F.sparks.countLow : F.sparks.count;
  const nEmbers = Math.round(nSparks * F.sparks.embers);
  const nShards = low ? F.shards.countLow : F.shards.count;
  const nHot = Math.round(nShards * F.shards.hot);
  const nFire = low ? F.fire.countLow : F.fire.count;

  const root = useRef<THREE.Group>(null!);
  const sparkMesh = useRef<THREE.Mesh>(null!);
  const fireMesh = useRef<THREE.Mesh>(null!);
  const hotMesh = useRef<THREE.InstancedMesh>(null!);
  const coldMesh = useRef<THREE.InstancedMesh>(null!);
  const flashMesh = useRef<THREE.Mesh>(null!);

  // ── Sparks and embers ─────────────────────────────────────────────────────
  // One buffer, two populations: the first `nSparks - nEmbers` are filings on
  // ballistic arcs, the rest are slow buoyant embers. Each carries its own
  // drag, gravity and jitter, so the integrator does not branch on the kind.
  const sparks = useMemo(() => {
    const { geo, attrs } = instancedQuad(nSparks, { iPos: 3, iVel: 3, iLife: 4 });
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
        uTime: { value: 0 },
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
      heat: new Float32Array(nSparks),
      seed: new Float32Array(nSparks),
      drag: new Float32Array(nSparks),
      gravity: new Float32Array(nSparks),
      jitter: new Float32Array(nSparks),
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

  // ── The fireball, as billows ──────────────────────────────────────────────
  const fire = useMemo(() => {
    const { geo, attrs } = instancedQuad(nFire, { iPos: 4, iData: 4 });
    const noise = createNoiseTexture();
    const mat = new THREE.ShaderMaterial({
      vertexShader: glsl(fireVert),
      fragmentShader: glsl(fireFrag),
      glslVersion: GLSL3,
      uniforms: {
        uNoise: { value: noise },
        uTime: { value: 0 },
        uEmit: { value: F.fire.emit },
        uSoot: { value: F.fire.soot },
      },
      transparent: true,
      depthWrite: false,
      // Premultiplied: the hot part adds light, the soot occludes. See the
      // note at the top of blastFire.frag.
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
    });
    return {
      geo,
      mat,
      noise,
      attrs,
      pos: new Float32Array(nFire * 3),
      vel: new Float32Array(nFire * 3),
      size0: new Float32Array(nFire),
      grow: new Float32Array(nFire),
      cool: new Float32Array(nFire),
      rise: new Float32Array(nFire),
      delay: new Float32Array(nFire),
      age: new Float32Array(nFire),
      life: new Float32Array(nFire),
      rot: new Float32Array(nFire),
      turn: new Float32Array(nFire),
      seed: new Float32Array(nFire),
      /** Draw order, far to near, rebuilt each frame — the soot is alpha-blended. */
      order: new Int16Array(nFire),
      depth: new Float32Array(nFire),
    };
  }, [nFire]);

  // ── The white-hot point, and the light the fire throws ────────────────────
  const flash = useMemo(() => {
    const quad = new THREE.PlaneGeometry(1, 1);
    const mat = new THREE.ShaderMaterial({
      vertexShader: glsl(billboardVert),
      fragmentShader: glsl(flashFrag),
      glslVersion: GLSL3,
      uniforms: { uSize: { value: F.flash.size }, uIntensity: { value: 0 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    return { quad, mat };
  }, []);

  const fireLight = useMemo(() => {
    const light = new THREE.PointLight(F.light.color, 0, F.light.distance, 2);
    light.visible = false;
    return light;
  }, []);

  useEffect(
    () => () => {
      sparks.geo.dispose();
      sparks.mat.dispose();
      shards.geo.dispose();
      shards.cold.dispose();
      shards.hot.dispose();
      fire.geo.dispose();
      fire.mat.dispose();
      fire.noise.dispose();
      flash.quad.dispose();
      flash.mat.dispose();
      fireLight.dispose();
      blastLensHandle.shock[3] = 0;
      blastLensHandle.haze[3] = 0;
    },
    [sparks, shards, fire, flash, fireLight],
  );

  /**
   * Compile every program now, against the real scene's lights, fog and
   * environment — `compile` walks materials whether or not they are visible.
   *
   * WITH A RENDER TARGET BOUND, OR IT COMPILES THE WRONG PROGRAMS. three bakes
   * tone mapping and output colour space into each program, and it picks them
   * from whatever is bound: the canvas gets the renderer's settings, any
   * render target gets NoToneMapping and linear output. Everything here is
   * drawn into the composer's buffer, never to the canvas. Compiled with
   * nothing bound, every program came out as a variant that is never used,
   * and the real ones were built on the detonation frame — measured at 184ms,
   * on the one frame that has to be clean.
   *
   * AND ONCE MORE WITH THE FIRE LIGHT ON, for everything it will light: the
   * mark and the chips. `compile` reads the light set at the moment it is
   * called, so the light is switched on around the calls and straight off
   * again. It must not sit inside a subtree being compiled — `compile` counts
   * the lights of the subtree AND the scene, and would build for two.
   */
  const compiledMark = useRef<THREE.Object3D | null>(null);
  const compileLit = (targets: THREE.Object3D[]) => {
    const probe = new THREE.WebGLRenderTarget(1, 1);
    const previous = gl.getRenderTarget();
    gl.setRenderTarget(probe);
    fireLight.visible = true;
    const jobs = targets.map((t) => gl.compileAsync(t, camera, scene));
    fireLight.visible = false;
    gl.setRenderTarget(previous);
    // A failed async compile only means the first detonation compiles inline,
    // which is the behaviour this exists to avoid, not a break.
    Promise.allSettled(jobs).finally(() => probe.dispose());
  };

  useEffect(() => {
    if (!root.current) return;
    const probe = new THREE.WebGLRenderTarget(1, 1);
    const previous = gl.getRenderTarget();
    gl.setRenderTarget(probe);
    gl.compileAsync(root.current, camera, scene)
      .catch(() => {})
      .finally(() => probe.dispose());
    gl.setRenderTarget(previous);

    const mark = markHandles.current.group;
    compileLit(mark ? [root.current, mark] : [root.current]);
    compiledMark.current = mark;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, camera, scene, sparks, shards, fire, flash, fireLight]);

  const st = useRef({
    active: false,
    t0: 0,
    lastDetonation: blastHandle.detonations,
    center: new THREE.Vector3(),
    envBase: 1,
    /** The mark's centre in uv, frozen at the detonation: the front leaves from where it was. */
    uvX: 0.5,
    uvY: 0.5,
  });

  const v = useMemo(() => new THREE.Vector3(), []);
  const dir = useMemo(() => new THREE.Vector3(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const m4 = useMemo(() => new THREE.Matrix4(), []);
  const scl = useMemo(() => new THREE.Vector3(), []);
  const ax = useMemo(() => new THREE.Vector3(), []);
  const fwd = useMemo(() => new THREE.Vector3(), []);

  const spawn = (now: number) => {
    const s = st.current;
    const group = markHandles.current.group;
    if (!group) return;
    group.getWorldPosition(s.center);
    const C = s.center;
    const anchors = markHandles.current.anchors;

    // Sparks: from inside the object, in every direction. Most are slow; the
    // speed is skewed so only a few streak across the frame.
    const nFast = nSparks - nEmbers;
    for (let i = 0; i < nSparks; i++) {
      const ember = i >= nFast;
      randomDir(dir);
      const r0 = Math.random() * (ember ? 0.5 : 0.3);
      const speed = ember
        ? range(F.sparks.ember.speed)
        : F.sparks.speed[0] +
          (F.sparks.speed[1] - F.sparks.speed[0]) * Math.pow(Math.random(), F.sparks.bias);
      sparks.pos[i * 3] = C.x + dir.x * r0;
      sparks.pos[i * 3 + 1] = C.y + dir.y * r0;
      sparks.pos[i * 3 + 2] = C.z + dir.z * r0;
      sparks.vel[i * 3] = dir.x * speed;
      sparks.vel[i * 3 + 1] = dir.y * speed + (ember ? 0.4 : 0);
      sparks.vel[i * 3 + 2] = dir.z * speed;
      sparks.life[i] = sparks.max[i] = ember ? range(F.sparks.ember.life) : range(F.sparks.life);
      sparks.width[i] = ember ? rand(0.9, 1.5) : rand(0.55, 1.3);
      // Embers are born orange and never see white; a filing is born at a
      // heat that decides whether it ever does.
      sparks.heat[i] = ember ? rand(0.5, 0.68) : rand(0.78, 1);
      sparks.seed[i] = Math.random();
      sparks.drag[i] = ember ? F.sparks.ember.drag : F.sparks.drag;
      sparks.gravity[i] = ember ? -F.sparks.ember.rise : F.sparks.gravity;
      sparks.jitter[i] = ember ? F.sparks.ember.jitter : 0;
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

    // Fire: billows thrown out of the core, fast at first and stalling, the
    // hottest at the middle. A share of them ignite a beat late, so the ball
    // keeps rolling for a moment instead of appearing whole on one frame.
    for (let i = 0; i < nFire; i++) {
      randomDir(dir);
      const r0 = Math.random() * 0.14;
      const speed = range(F.fire.speed);
      fire.pos[i * 3] = C.x + dir.x * r0;
      fire.pos[i * 3 + 1] = C.y + dir.y * r0;
      fire.pos[i * 3 + 2] = C.z + dir.z * r0;
      fire.vel[i * 3] = dir.x * speed;
      fire.vel[i * 3 + 1] = dir.y * speed * 0.8 + 0.25;
      fire.vel[i * 3 + 2] = dir.z * speed;
      fire.size0[i] = range(F.fire.size);
      fire.grow[i] = range(F.fire.grow);
      fire.cool[i] = range(F.fire.cool);
      fire.rise[i] = Math.random();
      fire.delay[i] = Math.random() < F.fire.late ? rand(0.03, 0.14) : 0;
      fire.age[i] = -fire.delay[i];
      fire.life[i] = range(F.fire.life);
      fire.rot[i] = Math.random() * Math.PI * 2;
      fire.turn[i] = rand(-0.9, 0.9);
      fire.seed[i] = Math.random();
    }

    flashMesh.current.position.copy(C);
    fireLight.position.copy(C);

    // Where the front leaves from, on screen. Frozen here: the camera is about
    // to be jolted, and a front that followed the jolt would wobble.
    v.copy(C).project(camera);
    s.uvX = v.x * 0.5 + 0.5;
    s.uvY = v.y * 0.5 + 0.5;

    s.envBase = scene.environmentIntensity;
    s.active = true;
    s.t0 = now;
    blastHandle.kickAt = now;
  };

  useFrame((_, delta) => {
    const s = st.current;
    const env = sceneState();
    const now = performance.now() / 1000;

    // Where the mark is on screen, for the DOM strike. One frame behind the
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

    // The mark mounted after this did, so its lit programs were not built at
    // mount. A press is two seconds of hold before anything can detonate —
    // plenty for a parallel compile to land.
    if (group && compiledMark.current !== group && blastHandle.held) {
      compileLit([group]);
      compiledMark.current = group;
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
    const flare = Math.exp((-t * 3) / F.flash.duration);
    blastHandle.flash = flare > 0.002 ? flare : 0;
    scene.environmentIntensity = s.envBase * (1 + blastHandle.flash * (F.flash.env - 1));

    const core = Math.exp(-t / F.flash.core);
    flashMesh.current.visible = core > 0.01;
    flash.mat.uniforms.uIntensity.value = core;
    flash.mat.uniforms.uSize.value = F.flash.size * (0.7 + 0.5 * (1 - core));

    // ── Fire light ──────────────────────────────────────────────────────────
    // Dies with the heat, and gutters while it does: two incommensurate sines
    // rather than noise, so it is the same at 60Hz and 144Hz.
    const heat = Math.exp(-t / F.light.cool);
    const gutter = 0.82 + 0.18 * Math.sin(t * 37) * Math.sin(t * 23 + 1.3);
    fireLight.intensity = F.light.intensity * heat * gutter;
    fireLight.position.y = s.center.y + 0.35 * (1 - Math.exp(-t * 2));
    fireLight.visible = heat > 0.02;

    // ── The front and the shimmer ───────────────────────────────────────────
    {
      const S = F.shockwave;
      const rt = t / S.duration;
      const L = blastLensHandle;
      if (rt < 1) {
        const r = S.radius * (1 - (1 - rt) ** 2.4);
        L.shock[0] = s.uvX;
        L.shock[1] = s.uvY;
        L.shock[2] = r;
        L.shock[3] = S.strength * (1 - rt) ** 1.6;
        L.shockWidth = S.width + S.spread * r;
      } else {
        L.shock[3] = 0;
      }

      const H = F.haze;
      const ht = t / H.duration;
      if (ht < 1) {
        L.haze[0] = s.uvX;
        L.haze[1] = s.uvY + 0.06 + 0.05 * ht;
        L.haze[2] = H.radius * (0.8 + 0.5 * ht);
        // In over the first moment (the front owns the first frames), out slowly.
        L.haze[3] = H.strength * Math.min(1, t / 0.15) * (1 - ht) ** 1.5;
        L.hazeTime = t;
      } else {
        L.haze[3] = 0;
      }
    }

    // ── Fire ────────────────────────────────────────────────────────────────
    {
      const Fi = F.fire;
      const drag = Math.exp(-Fi.drag * dt);
      const P = fire.attrs.iPos.array as Float32Array;
      const D = fire.attrs.iData.array as Float32Array;
      camera.getWorldDirection(fwd);
      let n = 0;
      /** Billows still to come or still burning — a late one keeps the mesh alive. */
      let pending = false;
      for (let i = 0; i < nFire; i++) {
        fire.age[i] += dt;
        const age = fire.age[i];
        if (age >= fire.life[i]) continue;
        pending = true;
        if (age < 0) continue;
        const k = i * 3;
        const h = Math.exp(-age / fire.cool[i]);
        // Hot gas rises, and keeps rising as smoke once it has cooled.
        const lift = Fi.rise[0] + (Fi.rise[1] - Fi.rise[0]) * (0.4 + 0.6 * fire.rise[i]) * (1 - h * 0.6);
        fire.vel[k] *= drag;
        fire.vel[k + 1] = fire.vel[k + 1] * drag + lift * dt;
        fire.vel[k + 2] *= drag;
        fire.pos[k] += fire.vel[k] * dt;
        fire.pos[k + 1] += fire.vel[k + 1] * dt;
        fire.pos[k + 2] += fire.vel[k + 2] * dt;
        fire.rot[i] += fire.turn[i] * dt;
        fire.depth[n] =
          (fire.pos[k] - camera.position.x) * fwd.x +
          (fire.pos[k + 1] - camera.position.y) * fwd.y +
          (fire.pos[k + 2] - camera.position.z) * fwd.z;
        fire.order[n] = i;
        n++;
      }

      // Far to near. Insertion sort: a couple of dozen entries, already
      // nearly in order from the frame before, and no allocation.
      for (let a = 1; a < n; a++) {
        const idx = fire.order[a];
        const d = fire.depth[a];
        let b = a - 1;
        while (b >= 0 && fire.depth[b] < d) {
          fire.order[b + 1] = fire.order[b];
          fire.depth[b + 1] = fire.depth[b];
          b--;
        }
        fire.order[b + 1] = idx;
        fire.depth[b + 1] = d;
      }

      for (let o = 0; o < n; o++) {
        const i = fire.order[o];
        const k = i * 3;
        const age = fire.age[i];
        const life = fire.life[i];
        // Swells fast while it burns, then keeps spreading slowly as smoke.
        const diameter =
          fire.size0[i] + fire.grow[i] * (1 - Math.exp(-age * 5)) + Fi.swell * age;
        const h = 1.15 * Math.exp(-age / fire.cool[i]);
        const fadeIn = Math.min(1, age / 0.035);
        const fadeOut = 1 - THREE.MathUtils.smoothstep(age, life * 0.5, life);
        P[o * 4] = fire.pos[k];
        P[o * 4 + 1] = fire.pos[k + 1];
        P[o * 4 + 2] = fire.pos[k + 2];
        P[o * 4 + 3] = fire.rot[i];
        D[o * 4] = diameter;
        D[o * 4 + 1] = h;
        D[o * 4 + 2] = fadeIn * fadeOut;
        D[o * 4 + 3] = fire.seed[i];
      }
      fire.geo.instanceCount = n;
      fire.attrs.iPos.needsUpdate = true;
      fire.attrs.iData.needsUpdate = true;
      fire.mat.uniforms.uTime.value = t;
      fireMesh.current.visible = pending;
    }

    // ── Sparks and embers ───────────────────────────────────────────────────
    {
      const P = sparks.attrs.iPos.array as Float32Array;
      const V = sparks.attrs.iVel.array as Float32Array;
      const L = sparks.attrs.iLife.array as Float32Array;
      let n = 0;
      for (let i = 0; i < nSparks; i++) {
        if (sparks.life[i] <= 0) continue;
        sparks.life[i] -= dt;
        if (sparks.life[i] <= 0) continue;
        const k = i * 3;
        const drag = Math.exp(-sparks.drag[i] * dt);
        const j = sparks.jitter[i];
        sparks.vel[k] = sparks.vel[k] * drag + (j > 0 ? (Math.random() - 0.5) * j * dt : 0);
        sparks.vel[k + 1] = sparks.vel[k + 1] * drag - sparks.gravity[i] * dt;
        sparks.vel[k + 2] = sparks.vel[k + 2] * drag + (j > 0 ? (Math.random() - 0.5) * j * dt : 0);
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
        L[n * 4] = sparks.life[i] / sparks.max[i];
        L[n * 4 + 1] = sparks.width[i];
        L[n * 4 + 2] = sparks.heat[i];
        L[n * 4 + 3] = sparks.seed[i];
        n++;
      }
      sparks.geo.instanceCount = n;
      sparks.attrs.iPos.needsUpdate = true;
      sparks.attrs.iVel.needsUpdate = true;
      sparks.attrs.iLife.needsUpdate = true;
      sparks.mat.uniforms.uPixelRatio.value = gl.getPixelRatio();
      sparks.mat.uniforms.uTime.value = t;
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

    // Done when the last thing has died: hand the environment back exactly,
    // and the lens back to its untouched path.
    const alive =
      blastHandle.flash > 0 ||
      flashMesh.current.visible ||
      fireLight.visible ||
      blastLensHandle.shock[3] > 0 ||
      blastLensHandle.haze[3] > 0 ||
      fireMesh.current.visible ||
      sparkMesh.current.visible ||
      hotMesh.current.visible ||
      coldMesh.current.visible;
    if (!alive) {
      s.active = false;
      blastHandle.flash = 0;
      scene.environmentIntensity = s.envBase;
    }
  });

  return (
    <>
      <group ref={root}>
        {/* Order matters for the transparent layers: the fire first, then the
            white-hot point and the filings over it. The chips are opaque. */}
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
          ref={fireMesh}
          geometry={fire.geo}
          material={fire.mat}
          frustumCulled={false}
          renderOrder={10}
          visible={false}
        />
        <mesh
          ref={flashMesh}
          geometry={flash.quad}
          material={flash.mat}
          frustumCulled={false}
          renderOrder={11}
          visible={false}
        />
        <mesh
          ref={sparkMesh}
          geometry={sparks.geo}
          material={sparks.mat}
          frustumCulled={false}
          renderOrder={12}
          visible={false}
        />
      </group>
      {/* Outside the group on purpose: the group is compiled as a subtree,
          and a light inside it would be counted twice. See compileLit. */}
      <primitive object={fireLight} />
    </>
  );
}
