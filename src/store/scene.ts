'use client';

import { create } from 'zustand';
import type { ShotName } from '@/config/animation';

/** The four states of the mark. Everything else is interpolation between them. */
export type MarkState = 'assembled' | 'exploded' | 'wireframe' | 'dissolved';

interface SceneStore {
  /** Real asset progress, 0..1. Driven by drei's useProgress. */
  progress: number;
  ready: boolean;
  /** Preloader has finished its exit; the site is interactive. */
  entered: boolean;

  /** Which shot the camera should rest at when not scrubbed. */
  shot: ShotName;
  /** Set by the Deconstruction scrub; -1 means "not scrubbing". */
  scrub: number;

  markState: MarkState;
  menuOpen: boolean;

  /** Normalised pointer, -1..1, origin centre. */
  pointer: [number, number];
  /** Pointer in 0..1 UV space, for shaders. */
  pointerUv: [number, number];
  hovering: boolean;

  activeSection: string;
  scrollProgress: number;
  /**
   * The Work chapter is approaching. Gates loading of the project screenshot
   * so a below-the-fold texture never sits in the critical path.
   */
  workNear: boolean;
  /** Index of the project currently framed by the camera. */
  workIndex: number;
  /**
   * Which interior structure the camera is looking at, or null on the home
   * page. Routing sets this; the scene flies to it. Nothing unmounts.
   */
  structure: 'lattice' | 'stack' | 'helix' | 'archive' | null;
  /** The footer plate is in view and should be interactive. */
  footerNear: boolean;

  reducedMotion: boolean;
  isMobile: boolean;
  /** Scene is paused when the tab is hidden — no reason to burn a GPU. */
  visible: boolean;

  setProgress: (p: number) => void;
  setReady: (v: boolean) => void;
  setEntered: (v: boolean) => void;
  setShot: (s: ShotName) => void;
  setScrub: (v: number) => void;
  setMarkState: (s: MarkState) => void;
  toggleMenu: (v?: boolean) => void;
  setPointer: (x: number, y: number, u: number, v: number) => void;
  setHovering: (v: boolean) => void;
  setSection: (s: string) => void;
  setScrollProgress: (v: number) => void;
  setWorkNear: (v: boolean) => void;
  setWorkIndex: (v: number) => void;
  setStructure: (v: 'lattice' | 'stack' | 'helix' | 'archive' | null) => void;
  setFooterNear: (v: boolean) => void;
  setEnv: (v: { reducedMotion?: boolean; isMobile?: boolean; visible?: boolean }) => void;
}

export const useScene = create<SceneStore>((set) => ({
  progress: 0,
  ready: false,
  entered: false,

  shot: 'hero',
  scrub: -1,

  markState: 'assembled',
  menuOpen: false,

  pointer: [0, 0],
  pointerUv: [0.5, 0.5],
  hovering: false,

  activeSection: 'INDEX',
  scrollProgress: 0,
  workNear: false,
  workIndex: 0,
  structure: null,
  footerNear: false,

  reducedMotion: false,
  isMobile: false,
  visible: true,

  setProgress: (progress) => set({ progress }),
  setReady: (ready) => set({ ready }),
  setEntered: (entered) => set({ entered }),
  setShot: (shot) => set({ shot }),
  setScrub: (scrub) => set({ scrub }),
  setMarkState: (markState) => set({ markState }),
  toggleMenu: (v) => set((s) => ({ menuOpen: v ?? !s.menuOpen })),
  setPointer: (x, y, u, v) => set({ pointer: [x, y], pointerUv: [u, v] }),
  setHovering: (hovering) => set({ hovering }),
  setSection: (activeSection) => set({ activeSection }),
  setScrollProgress: (scrollProgress) => set({ scrollProgress }),
  setWorkNear: (workNear) => set({ workNear }),
  setWorkIndex: (workIndex) => set({ workIndex }),
  setStructure: (structure) => set({ structure }),
  setFooterNear: (footerNear) => set({ footerNear }),
  setEnv: (v) => set(v),
}));

/**
 * Non-reactive reads for the render loop. Subscribing a component that runs at
 * 60fps to the store would re-render React 60 times a second; useFrame reads
 * this instead.
 */
export const sceneState = () => useScene.getState();
