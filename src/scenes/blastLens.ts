import { ChromaticAberrationEffect } from 'postprocessing';
import * as THREE from 'three';

import { blastLensHandle } from '@/scenes/handles';
import lensFrag from '@/shaders/blastLens.frag';

/**
 * THE GRADE PASS'S ABERRATION, WITH THE BLAST'S REFRACTION IN IT.
 *
 * A drop-in for `ChromaticAberrationEffect`: same constructor, same vertex
 * shader, same uniforms, same convolution attribute, so it takes the same
 * slot at the front of the one EffectPass (see Effects.tsx for why there is
 * only one). The fragment shader is the original with the shockwave and the
 * heat shimmer added ahead of it — see shaders/blastLens.frag.
 *
 * Why here and not a ShockWaveEffect: postprocessing's shockwave transforms
 * UVs, and an effect that does is refused in a pass that holds a convolution
 * effect — which the aberration is. A pass of its own would be a full read and
 * write of the frame, ~5ms on an Iris Xe, for something on screen for half a
 * second. Resampling where the aberration already samples costs nothing extra
 * while it runs, and nothing at all at rest.
 *
 * BlastFX writes `blastLensHandle`; this copies it into the uniforms once a
 * frame, in the pass's own update, so nothing has to hold a reference to the
 * effect.
 */
export class BlastLensEffect extends ChromaticAberrationEffect {
  private readonly shock = new THREE.Vector4(0.5, 0.5, 0, 0);
  private readonly haze = new THREE.Vector4(0.5, 0.5, 0.2, 0);

  constructor(options?: ConstructorParameters<typeof ChromaticAberrationEffect>[0]) {
    super(options);
    this.uniforms.set('shock', new THREE.Uniform(this.shock));
    this.uniforms.set('shockWidth', new THREE.Uniform(0.03));
    this.uniforms.set('haze', new THREE.Uniform(this.haze));
    this.uniforms.set('hazeTime', new THREE.Uniform(0));
    this.setFragmentShader(lensFrag);
  }

  override update(): void {
    const L = blastLensHandle;
    this.shock.fromArray(L.shock);
    this.haze.fromArray(L.haze);
    this.uniforms.get('shockWidth')!.value = L.shockWidth;
    this.uniforms.get('hazeTime')!.value = L.hazeTime;
  }
}
