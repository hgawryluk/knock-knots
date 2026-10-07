/**
 * Knot identification for rope tied in itself (no log involved).
 *
 * The open rope is closed into a loop by a virtual arc that runs high above
 * everything from the working end back to the standing end. Any closing arc
 * that passes over all other rope gives the same knot, so the result doesn't
 * depend on how the ends lie. The loop is then viewed from above (y up),
 * crossings are read off with over/under from height, and the knot
 * determinant is computed from the crossing (Fox colouring) matrix:
 * 1 = no knot, 3 = overhand (trefoil), 5 = figure-eight.
 */

export interface FreeKnotInfo {
  /** Crossings between real rope segments (ignores the virtual closing arc). */
  crossings: number;
  determinant: number;
}

interface CrossingEvent {
  /** Position along the closed loop (segment index + fraction) of the strand on top. */
  over: number;
  /** Same for the strand underneath. */
  under: number;
}

/** Every Nth particle is used; at 5 cm spacing this keeps detail while staying cheap. */
const STRIDE = 2;

export function analyzeFreeKnot(positions: Float32Array, count: number): FreeKnotInfo {
  const xs: number[] = [];
  const ys: number[] = [];
  const zs: number[] = [];
  for (let i = 0; i < count; i += STRIDE) {
    xs.push(positions[i * 3]);
    ys.push(positions[i * 3 + 1]);
    zs.push(positions[i * 3 + 2]);
  }
  if ((count - 1) % STRIDE !== 0) {
    xs.push(positions[(count - 1) * 3]);
    ys.push(positions[(count - 1) * 3 + 1]);
    zs.push(positions[(count - 1) * 3 + 2]);
  }

  // Segments 0..n-2 follow the rope; segment n-1 is the closing arc from the end back to the start.
  const n = xs.length;
  const closing = n - 1;
  const events: CrossingEvent[] = [];
  let realCrossings = 0;

  for (let a = 0; a < n; a++) {
    const a1 = (a + 1) % n;
    for (let b = a + 2; b < n; b++) {
      if (a === 0 && b === closing) continue; // neighbours through the closing arc
      const b1 = (b + 1) % n;
      const hit = intersect(xs[a], zs[a], xs[a1], zs[a1], xs[b], zs[b], xs[b1], zs[b1]);
      if (!hit) continue;
      const [ta, tb] = hit;
      let aOnTop: boolean;
      if (b === closing) {
        aOnTop = false; // the closing arc passes over everything
      } else {
        aOnTop = ys[a] + (ys[a1] - ys[a]) * ta > ys[b] + (ys[b1] - ys[b]) * tb;
        realCrossings++;
      }
      events.push(aOnTop ? { over: a + ta, under: b + tb } : { over: b + tb, under: a + ta });
    }
  }

  return { crossings: realCrossings, determinant: knotDeterminant(events) };
}

/** |det| of the crossing matrix with one row and column removed. */
function knotDeterminant(events: CrossingEvent[]): number {
  const m = events.length;
  if (m < 2) return 1;

  // Arcs run from one under-pass to the next; label them by how many under-passes precede them.
  const unders = events.map((e) => e.under).sort((p, q) => p - q);
  const arcAt = (s: number): number => {
    let i = 0;
    while (i < m && unders[i] < s) i++;
    return i % m;
  };

  const matrix = Array.from({ length: m }, () => new Float64Array(m));
  events.forEach((e, row) => {
    matrix[row][arcAt(e.over)] += 2;
    matrix[row][arcAt(e.under - 1e-7)] -= 1;
    matrix[row][arcAt(e.under + 1e-7)] -= 1;
  });

  return Math.round(Math.abs(determinant(matrix, m - 1)));
}

/** Determinant of the leading size×size block (Gaussian elimination with partial pivoting). */
function determinant(matrix: Float64Array[], size: number): number {
  const a = matrix.slice(0, size).map((row) => Float64Array.from(row.subarray(0, size)));
  let det = 1;
  for (let col = 0; col < size; col++) {
    let pivot = col;
    for (let r = col + 1; r < size; r++) if (Math.abs(a[r][col]) > Math.abs(a[pivot][col])) pivot = r;
    if (Math.abs(a[pivot][col]) < 1e-9) return 0;
    if (pivot !== col) {
      [a[pivot], a[col]] = [a[col], a[pivot]];
      det = -det;
    }
    det *= a[col][col];
    for (let r = col + 1; r < size; r++) {
      const f = a[r][col] / a[col][col];
      if (f === 0) continue;
      for (let c = col; c < size; c++) a[r][c] -= f * a[col][c];
    }
  }
  return det;
}

/** 2D segment intersection; returns the parameters along each segment, or null. */
function intersect(
  ax: number, ay: number, bx: number, by: number,
  cx: number, cy: number, dx: number, dy: number,
): [number, number] | null {
  const rx = bx - ax;
  const ry = by - ay;
  const sx = dx - cx;
  const sy = dy - cy;
  const denom = rx * sy - ry * sx;
  if (Math.abs(denom) < 1e-12) return null;
  const t = ((cx - ax) * sy - (cy - ay) * sx) / denom;
  const u = ((cx - ax) * ry - (cy - ay) * rx) / denom;
  return t >= 0 && t < 1 && u >= 0 && u < 1 ? [t, u] : null;
}

export interface RopeCrossing {
  /** Lower and higher particle index of the two crossing segments. */
  a: number;
  b: number;
  /** The index (a or b) of the segment lying on top. */
  over: number;
  x: number;
  z: number;
}

/** Real rope-over-rope crossings seen from above, at full particle resolution (for hints and dev tools). */
export function ropeCrossings(positions: Float32Array, count: number): RopeCrossing[] {
  const p = positions;
  const out: RopeCrossing[] = [];
  for (let a = 0; a < count - 1; a++) {
    for (let b = a + 2; b < count - 1; b++) {
      const hit = intersect(
        p[a * 3], p[a * 3 + 2], p[(a + 1) * 3], p[(a + 1) * 3 + 2],
        p[b * 3], p[b * 3 + 2], p[(b + 1) * 3], p[(b + 1) * 3 + 2],
      );
      if (!hit) continue;
      const [ta, tb] = hit;
      const ya = p[a * 3 + 1] + (p[(a + 1) * 3 + 1] - p[a * 3 + 1]) * ta;
      const yb = p[b * 3 + 1] + (p[(b + 1) * 3 + 1] - p[b * 3 + 1]) * tb;
      out.push({
        a,
        b,
        over: ya > yb ? a : b,
        x: p[a * 3] + (p[(a + 1) * 3] - p[a * 3]) * ta,
        z: p[a * 3 + 2] + (p[(a + 1) * 3 + 2] - p[a * 3 + 2]) * ta,
      });
    }
  }
  return out;
}
