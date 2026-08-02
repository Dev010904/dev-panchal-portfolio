import * as THREE from 'three';
import noise from '@/shaders/lib/noise.glsl';

/**
 * Minimal `#include <name>` resolver.
 *
 * three has one of these built in via THREE.ShaderChunk, but using it means
 * writing into a global registry that the whole renderer shares — a name
 * collision with a future three version would be silent and very annoying to
 * find. This keeps our chunks local and works identically for ShaderMaterial,
 * RawShaderMaterial and postprocessing Effects.
 */
const CHUNKS: Record<string, string> = { noise };

export function glsl(source: string): string {
  return source.replace(/^[ \t]*#include\s+<([\w-]+)>[ \t]*$/gm, (_, name: string) => {
    const chunk = CHUNKS[name];
    if (!chunk) throw new Error(`glsl: unknown chunk "${name}"`);
    return chunk;
  });
}

/**
 * Every custom ShaderMaterial on this site compiles as GLSL ES 3.00.
 *
 * This is not a modernity preference, it is a correctness fix. Under ESSL1 —
 * which is what three emits by default, even on a WebGL2 context —
 * `fwidth`/`dFdx` require the GL_OES_standard_derivatives pragma, and without
 * it the shader fails to compile. three swallows that failure and the object
 * simply never appears, with no error anywhere obvious. The line field is
 * built entirely on derivative-based antialiasing, so it was rendering
 * nothing at all.
 *
 * Derivatives are core in ESSL3. three's GLSL3 path also injects
 * `#define varying in`, `#define attribute in`, `#define texture2D texture`
 * and an output `pc_fragColor` aliased to `gl_FragColor`, so the shader
 * sources stay in the familiar syntax.
 */
export const GLSL3 = THREE.GLSL3;
