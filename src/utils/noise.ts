/** Small deterministic RNG (mulberry32). */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Smooth 2D value noise in [-1, 1]. With `period`, the lattice wraps so the noise tiles. */
export type Noise2D = (x: number, y: number, period?: number) => number;

export function createNoise2D(seed: number): Noise2D {
  const rng = createRng(seed);
  const size = 256;
  const values = new Float32Array(size);
  const perm = new Uint16Array(size * 2);
  for (let i = 0; i < size; i++) {
    values[i] = rng() * 2 - 1;
    perm[i] = i;
  }
  for (let i = size - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }
  for (let i = 0; i < size; i++) perm[i + size] = perm[i];

  const wrap = (i: number, period: number): number => (period > 0 ? ((i % period) + period) % period : i) & 255;
  const fade = (t: number): number => t * t * (3 - 2 * t);

  return (x, y, period = 0) => {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = fade(x - ix);
    const fy = fade(y - iy);
    const x0 = wrap(ix, period);
    const x1 = wrap(ix + 1, period);
    const y0 = wrap(iy, period);
    const y1 = wrap(iy + 1, period);
    const v00 = values[perm[x0 + perm[y0]]];
    const v10 = values[perm[x1 + perm[y0]]];
    const v01 = values[perm[x0 + perm[y1]]];
    const v11 = values[perm[x1 + perm[y1]]];
    const a = v00 + (v10 - v00) * fx;
    const b = v01 + (v11 - v01) * fx;
    return a + (b - a) * fy;
  };
}

/**
 * Fractal sum of octaves, roughly in [-1, 1]. Pass `period` (in lattice cells at
 * the base octave) to get noise that tiles seamlessly.
 */
export function fbm(noise: Noise2D, x: number, y: number, octaves = 4, period = 0): number {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  let freq = 1;
  for (let i = 0; i < octaves; i++) {
    sum += noise(x * freq, y * freq, period * freq) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}
