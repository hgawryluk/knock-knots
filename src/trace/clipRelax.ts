import * as THREE from 'three';
import { CARABINER, CARABINER_GATE, CARABINER_GATE_SWING, CARABINER_OUTLINE } from '../knots/paths';

/** Every Nth rope sample is a node of the simulation; samples between follow their nodes. */
const STRIDE = 3;
const ITERATIONS = 24;
/** How strongly each node is drawn toward where the tying wants it, per iteration… */
const PULL = 0.3;
/** …but never further in one go than this, less than the thinnest metal: rope can't tunnel through. */
const MAX_STEP = 0.012;
/** The frame's and gate's radii as solid obstacles (the frame is oval; this is its larger half-girth). */
const FRAME_RADIUS = 0.038;
const GATE_RADIUS = 0.029;
/** The rock face the bolt is in, behind the carabiner. */
const ROCK_GAP = 0.17;

/**
 * Makes a clip-in knot's tying physically possible, frame by frame: the rope
 * is drawn toward where the tying wants it, but it can never pass through
 * itself, the carabiner's frame, its gate (where the gate is at that moment,
 * open or shut) or the rock. Each frame starts from the one before, so rope that
 * the plan would push through metal is held back on the right side instead of
 * jumping through it.
 *
 * `shapes` are the planned rope shapes (samples 0..samples, xyz), `openAt(f)`
 * how far the gate is open in frame f; they are corrected in place.
 */
export function relaxClip(shapes: Float32Array[], samples: number, ropeRadius: number, openAt: (frame: number) => number): void {
  const nodes = Math.floor(samples / STRIDE) + 1;
  const sampleOf = (k: number): number => Math.min(k * STRIDE, samples);
  const frame = framePoints();
  const [hingeX, hingeY] = CARABINER_OUTLINE[CARABINER_GATE.hinge];
  const [noseX, noseY] = CARABINER_OUTLINE[CARABINER_GATE.nose];
  const rockZ = CARABINER.z - ROCK_GAP + ropeRadius;
  const diameter = 2 * ropeRadius;

  let previous: Float32Array | null = null;
  const target = new Float32Array(nodes * 3);
  const p = new Float32Array(nodes * 3);
  const rest = new Float32Array(nodes);
  const along = new Float32Array(nodes);

  shapes.forEach((shape, f) => {
    for (let k = 0; k < nodes; k++) for (let a = 0; a < 3; a++) target[k * 3 + a] = shape[sampleOf(k) * 3 + a];
    // Start from the last frame, moved on as the plan moves on.
    // Start from the last frame (the pull below moves it on, a little at a time).
    for (let i = 0; i < nodes * 3; i++) p[i] = previous ? previous[i] : target[i];
    for (let k = 1; k < nodes; k++) {
      rest[k] = Math.hypot(target[k * 3] - target[k * 3 - 3], target[k * 3 + 1] - target[k * 3 - 2], target[k * 3 + 2] - target[k * 3 - 1]);
      along[k] = along[k - 1] + rest[k];
    }
    // The gate as a segment from its hinge to its nose, swung in as far as it is open.
    const swing = CARABINER_GATE_SWING * openAt(f);
    const gx = hingeX + (noseX - hingeX) * Math.cos(swing) - (noseY - hingeY) * Math.sin(swing);
    const gy = hingeY + (noseX - hingeX) * Math.sin(swing) + (noseY - hingeY) * Math.cos(swing);
    const gate: [number, number, number, number] = [hingeX, hingeY, gx, gy];

    // Only rope near the carabiner takes part; the strands running off out of sight just follow the plan.
    let first = nodes;
    let last = -1;
    for (let k = 0; k < nodes; k++) {
      if (near(target, k) || near(p, k)) {
        first = Math.min(first, k);
        last = k;
      }
    }
    if (last < 0) first = last = 0;
    first = Math.max(first - 2, 0);
    last = Math.min(last + 2, nodes - 1);
    for (let k = 0; k < nodes; k++) {
      if (k >= first && k <= last) continue;
      for (let a = 0; a < 3; a++) p[k * 3 + a] = target[k * 3 + a];
    }

    for (let it = 0; it < ITERATIONS; it++) {
      for (let k = first; k <= last; k++) {
        const i = k * 3;
        const dx = (target[i] - p[i]) * PULL;
        const dy = (target[i + 1] - p[i + 1]) * PULL;
        const dz = (target[i + 2] - p[i + 2]) * PULL;
        const step = Math.hypot(dx, dy, dz);
        const k2 = step > MAX_STEP ? MAX_STEP / step : 1;
        p[i] += dx * k2;
        p[i + 1] += dy * k2;
        p[i + 2] += dz * k2;
      }
      for (let k = Math.max(first, 1); k <= last; k++) keepLength(p, k - 1, k, rest[k]);
      keepApart(p, first, last, along, diameter);
      for (let k = first; k <= last; k++) {
        const i = k * 3;
        // Only rope near the carabiner can touch it.
        const x = p[i] - CARABINER.x;
        const y = p[i + 1] - CARABINER.y;
        const z = p[i + 2] - CARABINER.z;
        if (x < -0.33 || x > 0.33 || y < -0.17 || y > 0.86 || Math.abs(z) > 0.15) {
          if (p[i + 2] < rockZ) p[i + 2] = rockZ;
          continue;
        }
        let out = pushOffChain(x, y, z, frame, FRAME_RADIUS + ropeRadius);
        out = pushOffSegment(out[0], out[1], out[2], gate, GATE_RADIUS + ropeRadius);
        p[i] = CARABINER.x + out[0];
        p[i + 1] = CARABINER.y + out[1];
        p[i + 2] = Math.max(CARABINER.z + out[2], rockZ);
      }
    }

    // Samples follow their nodes: each moved as its nodes were.
    for (let s = 0; s <= samples; s++) {
      const k = Math.min(Math.floor(s / STRIDE), nodes - 2);
      const t = Math.min((s - sampleOf(k)) / Math.max(sampleOf(k + 1) - sampleOf(k), 1), 1);
      for (let a = 0; a < 3; a++) {
        const d0 = p[k * 3 + a] - target[k * 3 + a];
        const d1 = p[(k + 1) * 3 + a] - target[(k + 1) * 3 + a];
        shape[s * 3 + a] += d0 + (d1 - d0) * t;
      }
    }
    previous = Float32Array.from(p);
  });
}

/** Whether node k is anywhere near the carabiner. */
function near(p: Float32Array, k: number): boolean {
  const x = p[k * 3] - CARABINER.x;
  const y = p[k * 3 + 1] - CARABINER.y;
  const z = p[k * 3 + 2] - CARABINER.z;
  return x > -0.6 && x < 0.7 && y > -0.6 && y < 1.1 && z > -0.4 && z < 0.7;
}

/** The carabiner's frame (all but the gate) as a chain of points relative to the bar, the hinge round to the nose. */
function framePoints(): Float32Array {
  const curve = new THREE.CatmullRomCurve3(CARABINER_OUTLINE.map(([x, y]) => new THREE.Vector3(x, y, 0)), true, 'centripetal');
  const lengths = curve.getLengths(CARABINER_OUTLINE.length * 100);
  const total = lengths[lengths.length - 1];
  const from = lengths[CARABINER_GATE.hinge * 100] / total;
  const to = lengths[CARABINER_GATE.nose * 100] / total + 1;
  const count = 60;
  const out = new Float32Array(count * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    const u = from + ((to - from) * i) / (count - 1);
    curve.getPointAt(u - Math.floor(u), v).toArray(out, i * 3);
  }
  return out;
}

/** Keeps two nodes their rest distance apart. */
function keepLength(p: Float32Array, a: number, b: number, length: number): void {
  const dx = p[b * 3] - p[a * 3];
  const dy = p[b * 3 + 1] - p[a * 3 + 1];
  const dz = p[b * 3 + 2] - p[a * 3 + 2];
  const d = Math.hypot(dx, dy, dz);
  if (d === 0) return;
  const k = (d - length) / d / 2;
  p[a * 3] += dx * k;
  p[a * 3 + 1] += dy * k;
  p[a * 3 + 2] += dz * k;
  p[b * 3] -= dx * k;
  p[b * 3 + 1] -= dy * k;
  p[b * 3 + 2] -= dz * k;
}

/** Pushes apart nodes of different strands (far apart along the rope) that come within a rope's width. */
function keepApart(p: Float32Array, first: number, last: number, along: Float32Array, diameter: number): void {
  const cell = diameter;
  const grid = new Map<number, number[]>();
  const key = (x: number, y: number, z: number): number => (x + 512) * 1048576 + (y + 512) * 1024 + (z + 512);
  for (let k = first; k <= last; k++) {
    const id = key(Math.floor(p[k * 3] / cell), Math.floor(p[k * 3 + 1] / cell), Math.floor(p[k * 3 + 2] / cell));
    const list = grid.get(id);
    if (list) list.push(k);
    else grid.set(id, [k]);
  }
  for (let k = first; k <= last; k++) {
    const cx = Math.floor(p[k * 3] / cell);
    const cy = Math.floor(p[k * 3 + 1] / cell);
    const cz = Math.floor(p[k * 3 + 2] / cell);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          const list = grid.get(key(cx + dx, cy + dy, cz + dz));
          if (!list) continue;
          for (const j of list) {
            if (j <= k || along[j] - along[k] < 3 * diameter) continue;
            const ex = p[j * 3] - p[k * 3];
            const ey = p[j * 3 + 1] - p[k * 3 + 1];
            const ez = p[j * 3 + 2] - p[k * 3 + 2];
            const d = Math.hypot(ex, ey, ez);
            if (d >= diameter || d === 0) continue;
            const push = (diameter - d) / d / 2;
            p[k * 3] -= ex * push;
            p[k * 3 + 1] -= ey * push;
            p[k * 3 + 2] -= ez * push;
            p[j * 3] += ex * push;
            p[j * 3 + 1] += ey * push;
            p[j * 3 + 2] += ez * push;
          }
        }
      }
    }
  }
}

/** A point pushed out to `reach` from a chain of points (in the z = 0 plane). */
function pushOffChain(x: number, y: number, z: number, chain: Float32Array, reach: number): [number, number, number] {
  let out: [number, number, number] = [x, y, z];
  if (Math.abs(z) >= reach) return out;
  for (let i = 0; i < chain.length / 3 - 1; i++) {
    // Skip segments clearly out of reach.
    if (Math.min(chain[i * 3], chain[i * 3 + 3]) - reach > out[0] || Math.max(chain[i * 3], chain[i * 3 + 3]) + reach < out[0]) continue;
    if (Math.min(chain[i * 3 + 1], chain[i * 3 + 4]) - reach > out[1] || Math.max(chain[i * 3 + 1], chain[i * 3 + 4]) + reach < out[1]) continue;
    const seg: [number, number, number, number] = [chain[i * 3], chain[i * 3 + 1], chain[i * 3 + 3], chain[i * 3 + 4]];
    out = pushOffSegment(out[0], out[1], out[2], seg, reach);
  }
  return out;
}

/** A point pushed out to `reach` from a segment lying in the z = 0 plane. */
function pushOffSegment(x: number, y: number, z: number, [ax, ay, bx, by]: [number, number, number, number], reach: number): [number, number, number] {
  const sx = bx - ax;
  const sy = by - ay;
  const t = Math.min(Math.max(((x - ax) * sx + (y - ay) * sy) / (sx * sx + sy * sy), 0), 1);
  const cx = ax + sx * t;
  const cy = ay + sy * t;
  const dx = x - cx;
  const dy = y - cy;
  const d = Math.hypot(dx, dy, z);
  if (d >= reach) return [x, y, z];
  if (d === 0) return [x, y, reach];
  const k = reach / d;
  return [cx + dx * k, cy + dy * k, z * k];
}
