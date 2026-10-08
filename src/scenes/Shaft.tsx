'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

import { SHAFT } from '@/config/animation';
import { GLSL3, glsl } from '@/lib/glsl';
import { travelHandle } from '@/scenes/handles';
import { prewarm } from '@/scenes/prewarm';
import dustFrag from '@/shaders/shaftDust.frag';
import dustVert from '@/shaders/shaftDust.vert';

/**
 * THE INSTRUMENT SHAFT — the room between the sections.
 *
 * The home page's sections sit up to 60 units apart in one vertical room, and
 * the camera used to cross that distance through nothing at all: the mark was
 * gone in a fraction of a second and the rest of the move was black. Now the
 * crossing is a travel band (see TRAVEL) and this is what it travels past — a
 * datum line with depth ticks, a figure every ten units, a label at every
 * place a section lives, two faint guides for parallax, and a column of dust
 * that streaks with the camera's velocity.
 *
 * It is the site's own drawing-sheet language — datums, dimensions, ticks, the
 * same mono labels as the rails — applied to the space between the drawings,
 * so the move reads as travelling through the instrument rather than cutting
 * between pages.
 *
 * COST. Only ever drawn inside a band. Its opacity is a bump over the band,
 * zero at both ends, so it is never seen from any section's resting pose, and
 * the group is hidden outside a band. In one it is two line meshes, a few
 * dozen sprites and a few hundred line segments.
 */
export function Shaft({ quality }: { quality: 'high' | 'low' }) {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const scene = useThree((s) => s.scene);

  const group = useRef<THREE.Group>(null!);
  const labelGroup = useRef<THREE.Group>(null!);
  const [labels, setLabels] = useState<THREE.Sprite[] | null>(null);

  const S = SHAFT;
  const [lx, lz] = S.line;

  // ── Line work: the datum, its ticks and the two guides ──────────────────
  const lines = useMemo(() => {
    const datum: number[] = [lx, S.top, lz, lx, S.bottom, lz];
    for (let y = Math.ceil(S.bottom); y <= Math.floor(S.top); y += S.minorEvery) {
      const len = y % S.majorEvery === 0 ? S.majorLength : S.minorLength;
      datum.push(lx, y, lz, lx + len, y, lz);
    }
    // A datum crosses the line: it is a reference, not a reading.
    for (const d of S.datums) {
      if (d.y < S.bottom - 3 || d.y > S.top + 3) continue;
      datum.push(lx - 0.32, d.y, lz, lx + S.majorLength * 1.5, d.y, lz);
    }

    const guide: number[] = [];
    // The floors: a ring at each section's level, with a tick every 30°.
    const [cx, cz] = S.ring.centre;
    for (const d of S.datums) {
      if (d.y < S.bottom - 3 || d.y > S.top + 3) continue;
      const n = S.ring.segments;
      for (let i = 0; i < n; i++) {
        const a0 = (i / n) * Math.PI * 2;
        const a1 = ((i + 1) / n) * Math.PI * 2;
        guide.push(
          cx + Math.cos(a0) * S.ring.radius, d.y, cz + Math.sin(a0) * S.ring.radius,
          cx + Math.cos(a1) * S.ring.radius, d.y, cz + Math.sin(a1) * S.ring.radius,
        );
      }
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const r0 = S.ring.radius;
        const r1 = S.ring.radius * (i % 3 === 0 ? 0.9 : 0.96);
        guide.push(
          cx + Math.cos(a) * r0, d.y, cz + Math.sin(a) * r0,
          cx + Math.cos(a) * r1, d.y, cz + Math.sin(a) * r1,
        );
      }
    }
    for (const [gx, gz] of S.guides) {
      guide.push(gx, S.top, gz, gx, S.bottom, gz);
      for (let y = Math.ceil(S.bottom / S.majorEvery) * S.majorEvery; y <= S.top; y += S.majorEvery) {
        guide.push(gx, y, gz, gx + S.minorLength, y, gz);
      }
    }

    const geometry = (arr: number[]) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
      return g;
    };
    const material = (color: string) =>
      new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        toneMapped: false,
        fog: false,
      });

    return {
      datumGeo: geometry(datum),
      guideGeo: geometry(guide),
      datumMat: material('#9aa0aa'),
      guideMat: material('#5d6470'),
    };
  }, [lx, lz, S]);

  // ── Dust: one segment per mote, stretched by the camera's velocity ──────
  const dust = useMemo(() => {
    const n = quality === 'low' ? S.dust.countLow : S.dust.count;
    const pos = new Float32Array(n * 6);
    const end = new Float32Array(n * 2);
    const seed = new Float32Array(n * 2);
    const [sx, sz] = S.dust.spread;
    for (let i = 0; i < n; i++) {
      // Mostly behind and around the datum, thinning toward the camera, so the
      // nearest motes are few and fast and the far ones many and slow — that
      // spread of speeds is the parallax.
      const x = (Math.random() - 0.5) * sx;
      const z = -sz * 0.78 + Math.random() * sz;
      const y = S.bottom + Math.random() * (S.top - S.bottom);
      const r = Math.random();
      for (let k = 0; k < 2; k++) {
        pos[i * 6 + k * 3] = x;
        pos[i * 6 + k * 3 + 1] = y;
        pos[i * 6 + k * 3 + 2] = z;
        end[i * 2 + k] = k;
        seed[i * 2 + k] = r;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    const mat = new THREE.ShaderMaterial({
      vertexShader: glsl(dustVert),
      fragmentShader: glsl(dustFrag),
      glslVersion: GLSL3,
      uniforms: {
        uVel: { value: new THREE.Vector3() },
        uTrail: { value: S.dust.trail },
        uMaxLen: { value: S.dust.maxLength },
        uOpacity: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    return { geo, mat };
  }, [quality, S]);

  // ── Labels: a figure every ten units, and the places sections live ──────
  // Mono, at the rails' tracking and colours, rasterised once the face has
  // loaded — the same reason the work headline waits for it.
  useEffect(() => {
    let cancelled = false;
    const made: THREE.Sprite[] = [];

    document.fonts.ready.then(() => {
      if (cancelled) return;
      const probe = document.createElement('span');
      probe.className = 't-label';
      document.body.appendChild(probe);
      const family = getComputedStyle(probe).fontFamily || 'ui-monospace, monospace';
      probe.remove();

      const entries: { y: number; text: string; datum: boolean }[] = [];
      const datumYs = new Set<number>(S.datums.map((d) => d.y));
      for (
        let y = Math.ceil(S.bottom / S.labelEvery) * S.labelEvery;
        y <= S.top;
        y += S.labelEvery
      ) {
        if (datumYs.has(y)) continue;
        const sign = y > 0 ? '+' : y < 0 ? '−' : '';
        entries.push({ y, text: `${sign}${String(Math.abs(y)).padStart(2, '0')}`, datum: false });
      }
      for (const d of S.datums) {
        if (d.y < S.bottom - 3 || d.y > S.top + 3) continue;
        entries.push({ y: d.y, text: d.text, datum: true });
      }

      for (const e of entries) {
        const px = 40;
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) continue;
        const font = `500 ${px}px ${family}`;
        ctx.font = font;
        const tracking = 0.18 * px;
        const width = [...e.text].reduce((w, ch) => w + ctx.measureText(ch).width + tracking, 0);
        canvas.width = Math.ceil(width + px * 0.4);
        canvas.height = Math.ceil(px * 1.5);
        ctx.font = font;
        ctx.textBaseline = 'middle';
        ctx.fillStyle = e.datum ? '#f2f2f0' : '#8a8a85';
        let x = px * 0.2;
        for (const ch of e.text) {
          ctx.fillText(ch, x, canvas.height / 2);
          x += ctx.measureText(ch).width + tracking;
        }

        const tex = new THREE.CanvasTexture(canvas);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.generateMipmaps = true;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        const mat = new THREE.SpriteMaterial({
          map: tex,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          toneMapped: false,
          fog: false,
        });
        const sprite = new THREE.Sprite(mat);
        const h = S.labelHeight * (e.datum ? 1.15 : 1);
        sprite.center.set(0, 0.5);
        sprite.scale.set((h * canvas.width) / canvas.height, h, 1);
        sprite.position.set(lx + (e.datum ? S.majorLength * 1.5 : S.majorLength) + 0.1, e.y, lz);
        sprite.userData.datum = e.datum;
        made.push(sprite);
      }
      setLabels(made);
    });

    return () => {
      cancelled = true;
      for (const s of made) {
        s.material.map?.dispose();
        s.material.dispose();
      }
    };
  }, [lx, lz, S]);

  useEffect(() => {
    const g = labelGroup.current;
    if (!g || !labels) return;
    for (const s of labels) g.add(s);
    return () => {
      for (const s of labels) g.remove(s);
    };
  }, [labels]);

  useEffect(
    () => () => {
      lines.datumGeo.dispose();
      lines.guideGeo.dispose();
      lines.datumMat.dispose();
      lines.guideMat.dispose();
      dust.geo.dispose();
      dust.mat.dispose();
    },
    [lines, dust],
  );

  // Compile everything once the labels exist, then draw it twice at zero
  // opacity under whatever is on screen — see scenes/prewarm and the warm-up
  // in BlastFX for why compiling alone is not enough on ANGLE.
  const warm = useRef(-1);
  useEffect(() => {
    if (!labels || !group.current) return;
    group.current.visible = true;
    prewarm(gl, group.current, camera, scene);
    group.current.visible = false;
    warm.current = 0;
  }, [labels, gl, camera, scene]);

  const vis = useRef(0);

  useFrame((_, delta) => {
    const g = group.current;
    if (!g) return;
    const dt = Math.min(delta, 0.05);

    const T = travelHandle;
    const p = THREE.MathUtils.clamp(T.p, 0, 1);
    const goal = T.active ? Math.pow(Math.sin(Math.PI * p), 0.6) : 0;
    vis.current += (goal - vis.current) * (1 - Math.exp(-12 * dt));
    if (!T.active && vis.current < 0.003) vis.current = 0;

    const warming = warm.current >= 0 && warm.current < 2 && scene.environment !== null;
    if (warming) warm.current++;

    const v = warming ? 0 : vis.current;
    g.visible = warming || v > 0;
    if (!g.visible) return;

    lines.datumMat.opacity = S.opacity.line * v;
    lines.guideMat.opacity = S.opacity.guide * v;
    dust.mat.uniforms.uOpacity.value = S.opacity.dust * v;
    dust.mat.uniforms.uVel.value.fromArray(T.velocity);
    if (labels) {
      for (const s of labels) s.material.opacity = v * (s.userData.datum ? 0.95 : 0.7);
    }
  });

  return (
    <group ref={group} visible={false}>
      <lineSegments geometry={lines.guideGeo} material={lines.guideMat} renderOrder={3} />
      <lineSegments geometry={lines.datumGeo} material={lines.datumMat} renderOrder={4} />
      <group ref={labelGroup} />
      <lineSegments
        geometry={dust.geo}
        material={dust.mat}
        frustumCulled={false}
        renderOrder={5}
      />
    </group>
  );
}
