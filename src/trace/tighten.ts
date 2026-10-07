import type { Rail } from '../knots/types';

/**
 * The knot as it looks once it's pulled snug. The knot body is drawn in hard
 * toward its middle across the view while keeping its depth — so which strand
 * lies over which never changes and the knot can't come undone — then the
 * strands that now overlap are pushed apart until they just touch, with a
 * little smoothing to keep curves round. The standing part and the tail ease
 * into it and keep their place.
 *
 * A knot tied round a rail is drawn in along the rail only, and kept wrapped
 * snugly round it rather than pulled into it.
 *
 * Sample i of the result is the same bit of rope as sample i of the loose knot,
 * so blending between them shows the knot drawing up.
 */

/** How far the knot body is drawn in across the view (fraction of its loose spread). */
const DRAW_IN = 0.4;
/** Samples over which the pull eases in from the standing part and out into the tail. */
const EASE_SAMPLES = 60;
/** Every Nth dense sample takes part in the relaxation. */
const NODE_STRIDE = 3;
const RELAX_ITERATIONS = 120;
/** Strands rest a touch more than one rope diameter apart. */
const CONTACT = 2.05;
const SMOOTHING = 0.25;

export function tightenKnot(loose: Float32Array, samples: number, radius: number, bodyStart: number, bodyEnd: number, hold?: [number, number], rail?: Rail): Float32Array {
  // How much each sample belongs to the knot body (0 on the standing part, the tail and any held stretch; 1 inside).
  const ease = (from: number, to: number, s: number): number => {
    const t = Math.max(Math.min((s - from) / EASE_SAMPLES, (to - s) / EASE_SAMPLES, 1), 0);
    return t * t * (3 - 2 * t);
  };
  const free = (s: number): number => (hold ? 1 - ease(hold[0], hold[1], s) : 1);
  const weight = (s: number): number => ease(bodyStart, bodyEnd, s) * free(s);

  // Middle of the knot body (not counting a held stretch).
  let cx = 0;
  let cy = 0;
  let count = 0;
  for (let s = Math.ceil(bodyStart); s <= bodyEnd; s++) {
    const w = free(s);
    cx += loose[s * 3] * w;
    cy += loose[s * 3 + 1] * w;
    count += w;
  }
  cx /= count;
  cy /= count;

  // Coarse chain of nodes for the relaxation.
  const indices: number[] = [];
  for (let s = 0; s < samples; s += NODE_STRIDE) indices.push(s);
  indices.push(samples);
  const n = indices.length;
  const p = new Float32Array(n * 3);
  const w = new Float32Array(n);
  indices.forEach((s, i) => {
    const k = 1 - (1 - DRAW_IN) * weight(s);
    w[i] = weight(s);
    p[i * 3] = cx + (loose[s * 3] - cx) * k;
    p[i * 3 + 1] = rail ? loose[s * 3 + 1] : cy + (loose[s * 3 + 1] - cy) * k;
    p[i * 3 + 2] = loose[s * 3 + 2];
  });

  const minDist = radius * CONTACT;
  const spacing = Math.hypot(p[3] - p[0], p[4] - p[1], p[5] - p[2]) || minDist;
  const skip = Math.ceil(minDist / (spacing * DRAW_IN)) + 2;
  for (let iteration = 0; iteration < RELAX_ITERATIONS; iteration++) {
    separate(p, w, n, minDist, skip);
    smooth(p, w, n);
    if (rail) wrapRound(p, w, n, rail, rail.radius + radius);
  }

  // Map the nodes back onto every dense sample.
  const out = new Float32Array((samples + 1) * 3);
  const last = n - 1;
  for (let s = 0; s <= samples; s++) {
    const f = Math.min(s / NODE_STRIDE, last);
    const i = Math.min(Math.floor(f), last - 1);
    const t = f - i;
    for (let axis = 0; axis < 3; axis++) out[s * 3 + axis] = p[i * 3 + axis] + (p[(i + 1) * 3 + axis] - p[i * 3 + axis]) * t;
  }
  return out;
}

/** Pushes non-neighbouring bits of the knot apart until they're at least `minDist` apart (spatial hash). */
function separate(p: Float32Array, w: Float32Array, n: number, minDist: number, skip: number): void {
  const cell = minDist;
  const key = (x: number, y: number, z: number): number => (x * 73856093) ^ (y * 19349663) ^ (z * 83492791);
  const grid = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    if (w[i] <= 0) continue;
    const k = key(Math.floor(p[i * 3] / cell), Math.floor(p[i * 3 + 1] / cell), Math.floor(p[i * 3 + 2] / cell));
    const bucket = grid.get(k);
    if (bucket) bucket.push(i);
    else grid.set(k, [i]);
  }
  for (const bucket of grid.values()) {
    for (const i of bucket) {
      const cx = Math.floor(p[i * 3] / cell);
      const cy = Math.floor(p[i * 3 + 1] / cell);
      const cz = Math.floor(p[i * 3 + 2] / cell);
      for (let x = -1; x <= 1; x++) {
        for (let y = -1; y <= 1; y++) {
          for (let z = -1; z <= 1; z++) {
            const near = grid.get(key(cx + x, cy + y, cz + z));
            if (!near) continue;
            for (const j of near) {
              if (j <= i + skip) continue;
              const dx = p[j * 3] - p[i * 3];
              const dy = p[j * 3 + 1] - p[i * 3 + 1];
              const dz = p[j * 3 + 2] - p[i * 3 + 2];
              const d2 = dx * dx + dy * dy + dz * dz;
              if (d2 >= minDist * minDist || d2 < 1e-12) continue;
              const total = w[i] + w[j];
              const d = Math.sqrt(d2);
              const c = (d - minDist) / (d * total);
              p[i * 3] += dx * c * w[i];
              p[i * 3 + 1] += dy * c * w[i];
              p[i * 3 + 2] += dz * c * w[i];
              p[j * 3] -= dx * c * w[j];
              p[j * 3 + 1] -= dy * c * w[j];
              p[j * 3 + 2] -= dz * c * w[j];
            }
          }
        }
      }
    }
  }
}

/** Keeps knot nodes resting on the rail's surface instead of sinking into it. */
function wrapRound(p: Float32Array, w: Float32Array, n: number, rail: Rail, contact: number): void {
  for (let i = 0; i < n; i++) {
    if (w[i] <= 0) continue;
    const dy = p[i * 3 + 1] - rail.y;
    const dz = p[i * 3 + 2] - rail.z;
    const d = Math.hypot(dy, dz);
    if (d >= contact || d < 1e-9) continue;
    p[i * 3 + 1] = rail.y + (dy / d) * contact;
    p[i * 3 + 2] = rail.z + (dz / d) * contact;
  }
}

/** Nudges knot nodes toward the midpoint of their neighbours, so the snug knot stays smoothly curved. */
function smooth(p: Float32Array, w: Float32Array, n: number): void {
  for (let i = 1; i < n - 1; i++) {
    if (w[i] <= 0) continue;
    for (let axis = 0; axis < 3; axis++) {
      const mid = (p[(i - 1) * 3 + axis] + p[(i + 1) * 3 + axis]) / 2;
      p[i * 3 + axis] += (mid - p[i * 3 + axis]) * SMOOTHING * w[i];
    }
  }
}
