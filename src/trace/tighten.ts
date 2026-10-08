import type { Rail } from '../knots/types';

/**
 * The knot drawing up snug, as a short film. The knot body is drawn in toward
 * its middle a little at a time, and after every small pull, strands that come
 * too close are pushed apart until they just touch, with a little smoothing to
 * keep curves round. Because each pull is small, rope never passes through
 * rope — so which strand lies over which never changes and the knot can't come
 * undone — and the pull goes on until the strands jam against each other:
 * rope pressed against other rope stops being pulled, the rest keeps coming. The standing part, the
 * tail and any held stretch ease into it and keep their place, and the knot
 * can't push into them either.
 *
 * A knot tied round a rail is drawn in along the rail (and rope off the rail
 * front to back too, never up or down), and rope lying on the rail stays on it
 * (it may slide round, but never lifts off or sinks in).
 *
 * Every frame has the same samples as the loose knot (sample i is the same bit
 * of rope), so playing through the frames shows the knot drawing up.
 */

/** How far the pull would draw the knot body in (fraction of its loose size); strands jam well before. */
const DRAW_IN = 0.12;
/** The same along the rail, for a knot tied round one (its turns jam side by side). */
const RAIL_DRAW_IN = 0.25;
/** Samples over which the pull eases in from the standing part and out into the tail. */
const EASE_SAMPLES = 60;
/** Every Nth dense sample takes part in the relaxation. */
const NODE_STRIDE = 3;
/** Iterations spent pulling in, then settling once fully drawn in. */
const PULL_ITERATIONS = 180;
const SETTLE_ITERATIONS = 60;
/** A frame of the film is kept every this many iterations. */
const FRAME_EVERY = 10;
/** Strands rest a touch more than one rope diameter apart. */
const CONTACT = 2.05;
const SMOOTHING = 0.25;
/** Push-apart passes after each small pull, so strands never sink into each other on the way. */
const SEPARATE_PASSES = 3;
/** Rope within this many contact distances of other rope is jammed against it. */
const JAM = 1.03;
/** Rope this many node spacings along (shrunk by this factor) is a neighbour, never pushed apart. */
const NEIGHBOUR_SPAN = 0.4;
/** Rope this close to the rail (in rope radii beyond touching) counts as lying on it. */
const ON_RAIL_SLACK = 1.5;

/** Returns the frames of the knot drawing up: the first is the loose knot itself, the last the snug knot. */
export function tightenKnot(
  loose: Float32Array,
  samples: number,
  radius: number,
  bodies: [number, number][],
  hold?: [number, number],
  rail?: Rail,
): Float32Array[] {
  // How much each sample belongs to the knot body (0 on the standing part, the tail and any held stretch; 1 inside).
  const ease = (from: number, to: number, s: number): number => {
    const t = Math.max(Math.min((s - from) / EASE_SAMPLES, (to - s) / EASE_SAMPLES, 1), 0);
    return t * t * (3 - 2 * t);
  };
  const free = (s: number): number => (hold ? 1 - ease(hold[0], hold[1], s) : 1);
  const weight = (s: number): number => Math.max(...bodies.map(([from, to]) => ease(from, to, s))) * free(s);

  // Middle of the knot body (not counting a held stretch).
  let cx = 0;
  let cy = 0;
  let cz = 0;
  let count = 0;
  for (const [bodyStart, bodyEnd] of bodies) for (let s = Math.ceil(bodyStart); s <= bodyEnd; s++) {
    const w = free(s);
    cx += loose[s * 3] * w;
    cy += loose[s * 3 + 1] * w;
    cz += loose[s * 3 + 2] * w;
    count += w;
  }
  cx /= count;
  cy /= count;
  cz /= count;

  // Coarse chain of nodes for the relaxation.
  const indices: number[] = [];
  for (let s = 0; s < samples; s += NODE_STRIDE) indices.push(s);
  indices.push(samples);
  const n = indices.length;
  const p = new Float32Array(n * 3);
  const w = new Float32Array(n);
  indices.forEach((s, i) => {
    w[i] = weight(s);
    for (let axis = 0; axis < 3; axis++) p[i * 3 + axis] = loose[s * 3 + axis];
  });

  // On a rail: how far from its axis each node lying on it stays (others are free).
  const contact = rail ? rail.radius + radius : 0;
  const railDistance = new Float32Array(n).fill(-1);
  if (rail) {
    for (let i = 0; i < n; i++) {
      const d = Math.hypot(p[i * 3 + 1] - rail.y, p[i * 3 + 2] - rail.z);
      if (w[i] > 0 && d < contact + radius * ON_RAIL_SLACK) railDistance[i] = Math.max(d, contact);
    }
  }

  const drawIn = rail ? RAIL_DRAW_IN : DRAW_IN;
  const minDist = radius * CONTACT;
  const spacing = Math.hypot(p[3] - p[0], p[4] - p[1], p[5] - p[2]) || minDist;
  const skip = Math.ceil(minDist / (spacing * NEIGHBOUR_SPAN)) + 2;
  const frames: Float32Array[] = [Float32Array.from(loose)];
  let drawn = 1;
  const jammed = new Uint8Array(n);
  for (let iteration = 1; iteration <= PULL_ITERATIONS + SETTLE_ITERATIONS; iteration++) {
    // Overall draw-in so far, eased; each node is scaled by its share of the step.
    const g = Math.min(iteration / PULL_ITERATIONS, 1);
    const target = 1 - (1 - drawIn) * g * g * (3 - 2 * g);
    for (let i = 0; i < n; i++) {
      if (w[i] <= 0 || jammed[i]) continue;
      const k = (1 - (1 - target) * w[i]) / (1 - (1 - drawn) * w[i]);
      p[i * 3] = cx + (p[i * 3] - cx) * k;
      if (rail) {
        // Rope on the rail only slides along it; rope off it (hitches above) also draws in front to back.
        if (railDistance[i] < 0) p[i * 3 + 2] = rail.z + (p[i * 3 + 2] - rail.z) * k;
        continue;
      }
      p[i * 3 + 1] = cy + (p[i * 3 + 1] - cy) * k;
      p[i * 3 + 2] = cz + (p[i * 3 + 2] - cz) * k;
    }
    drawn = target;
    smooth(p, w, n);
    jammed.fill(0);
    for (let pass = 0; pass < SEPARATE_PASSES; pass++) separate(p, w, n, minDist, skip, jammed);
    if (rail) keepOnRail(p, n, rail, railDistance);
    if (iteration % FRAME_EVERY === 0) frames.push(toSamples(p, n, samples));
  }
  return frames;
}

/** Maps the nodes back onto every dense sample. */
function toSamples(p: Float32Array, n: number, samples: number): Float32Array {
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

/**
 * Pushes non-neighbouring bits of rope apart until they're at least `minDist`
 * apart (spatial hash). Only the knot moves; the standing part, tail and held
 * stretches are obstacles it can't push into. Marks rope that touches other rope in `jammed`.
 */
function separate(p: Float32Array, w: Float32Array, n: number, minDist: number, skip: number, jammed: Uint8Array): void {
  const jamDist = minDist * JAM;
  const cell = minDist;
  const key = (x: number, y: number, z: number): number => (x * 73856093) ^ (y * 19349663) ^ (z * 83492791);
  const grid = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
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
              const total = w[i] + w[j];
              if (total <= 0) continue;
              const dx = p[j * 3] - p[i * 3];
              const dy = p[j * 3 + 1] - p[i * 3 + 1];
              const dz = p[j * 3 + 2] - p[i * 3 + 2];
              const d2 = dx * dx + dy * dy + dz * dz;
              if (d2 >= jamDist * jamDist) continue;
              jammed[i] = 1;
              jammed[j] = 1;
              if (d2 >= minDist * minDist || d2 < 1e-12) continue;
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

/** Puts rope that lies on the rail back at its distance from the rail's axis (it may slide round it). */
function keepOnRail(p: Float32Array, n: number, rail: Rail, distance: Float32Array): void {
  for (let i = 0; i < n; i++) {
    if (distance[i] < 0) continue;
    const dy = p[i * 3 + 1] - rail.y;
    const dz = p[i * 3 + 2] - rail.z;
    const d = Math.hypot(dy, dz);
    if (d < 1e-9) continue;
    p[i * 3 + 1] = rail.y + (dy / d) * distance[i];
    p[i * 3 + 2] = rail.z + (dz / d) * distance[i];
  }
}
