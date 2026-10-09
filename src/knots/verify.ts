import * as THREE from 'three';
import type { RopePath } from '../trace/ropePath';
import type { KnotDefinition } from './types';

/**
 * Dev-only checks that each authored knot really is the knot it claims to be,
 * against the textbook knot — not against our own construction.
 *
 * - Knots tied in the rope itself: join the ends with an arc over everything
 *   and compute the Jones polynomial (Kauffman bracket), then compare with the
 *   published polynomial of the real knot (KnotInfo). This tells a square knot
 *   from a granny or a stevedore, which a simpler invariant can't.
 * - Noose: the whole rope must be unknotted (it slips), the end alone must be
 *   an overhand knot, and the standing part must thread it exactly once
 *   (linking number ±1).
 * - Hitches: unroll the rope round what it's tied to and read the crossings
 *   and turns: a clove hitch is two turns the same way with both ends pinned
 *   under the diagonal (turns opposite ways would be a cow hitch); a round
 *   turn goes round one and a half times without crossing itself.
 */

// ---- Polynomials in A (Kauffman bracket variable) ----------------------------------------

type Poly = Map<number, number>;

const poly = (terms: [number, number][]): Poly => new Map(terms.filter(([, c]) => c !== 0));
function add(a: Poly, b: Poly): Poly {
  const out = new Map(a);
  for (const [e, c] of b) {
    const v = (out.get(e) ?? 0) + c;
    if (v === 0) out.delete(e);
    else out.set(e, v);
  }
  return out;
}
function mul(a: Poly, b: Poly): Poly {
  let out: Poly = new Map();
  for (const [ea, ca] of a) for (const [eb, cb] of b) out = add(out, poly([[ea + eb, ca * cb]]));
  return out;
}

/** Jones polynomial as {power of t: coefficient}. */
export type Jones = Record<number, number>;

const showJones = (j: Jones): string =>
  Object.entries(j)
    .map(([e, c]) => [Number(e), c] as const)
    .sort((a, b) => b[0] - a[0])
    .map(([e, c]) => `${c < 0 ? '-' : '+'}${Math.abs(c) === 1 && e !== 0 ? '' : Math.abs(c)}${e === 0 ? '' : e === 1 ? 't' : `t^${e}`}`)
    .join(' ')
    .replace(/^\+/, '');

const sameJones = (a: Jones, b: Jones): boolean => {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].every((k) => (a[Number(k)] ?? 0) === (b[Number(k)] ?? 0));
};
const mirror = (j: Jones): Jones => Object.fromEntries(Object.entries(j).map(([e, c]) => [-Number(e), c]));

/** Published Jones polynomials (KnotInfo), one chirality; mirrors are accepted too where the knot is chiral. */
export const KNOWN: Record<string, Jones> = {
  unknot: { 0: 1 },
  trefoil: { 1: 1, 3: 1, 4: -1 },
  'figure-eight': { [-2]: 1, [-1]: -1, 0: 1, 1: -1, 2: 1 },
  'square knot': { [-3]: -1, [-2]: 1, [-1]: -1, 0: 3, 1: -1, 2: 1, 3: -1 },
  'granny knot': { 2: 1, 4: 2, 5: -2, 6: 1, 7: -2, 8: 1 },
  'stevedore (6_1)': { 2: 1, 1: -1, 0: 2, [-1]: -2, [-2]: 1, [-3]: -1, [-4]: 1 },
};

/** Which known knot a Jones polynomial is, if any (either chirality). */
export function identify(j: Jones): string {
  for (const [name, known] of Object.entries(KNOWN)) if (sameJones(j, known) || sameJones(j, mirror(known))) return name;
  return `unknown (${showJones(j)})`;
}

// ---- Diagrams -----------------------------------------------------------------------------

/** A point of a projected rope: position in the picture (u, v) and height toward the viewer (h). */
type P2 = [number, number, number];

interface Crossing {
  /** Position along the closed curve (segment index + fraction) of the strand on top / underneath. */
  over: number;
  under: number;
  /** Directions of the two strands in the picture. */
  dOver: [number, number];
  dUnder: [number, number];
}

function intersect(a: P2, b: P2, c: P2, d: P2): [number, number] | null {
  const rx = b[0] - a[0];
  const ry = b[1] - a[1];
  const sx = d[0] - c[0];
  const sy = d[1] - c[1];
  const denom = rx * sy - ry * sx;
  if (Math.abs(denom) < 1e-12) return null;
  const t = ((c[0] - a[0]) * sy - (c[1] - a[1]) * sx) / denom;
  const u = ((c[0] - a[0]) * ry - (c[1] - a[1]) * rx) / denom;
  return t >= 0 && t < 1 && u >= 0 && u < 1 ? [t, u] : null;
}

/** Crossings of a closed polygon (the last point joins back to the first). */
function crossingsOf(points: P2[]): Crossing[] {
  const n = points.length;
  const out: Crossing[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      const a = points[i];
      const b = points[(i + 1) % n];
      const c = points[j];
      const d = points[(j + 1) % n];
      const hit = intersect(a, b, c, d);
      if (!hit) continue;
      const [t, u] = hit;
      const hi = a[2] + (b[2] - a[2]) * t;
      const hj = c[2] + (d[2] - c[2]) * u;
      const di: [number, number] = [b[0] - a[0], b[1] - a[1]];
      const dj: [number, number] = [d[0] - c[0], d[1] - c[1]];
      out.push(hi > hj ? { over: i + t, under: j + u, dOver: di, dUnder: dj } : { over: j + u, under: i + t, dOver: dj, dUnder: di });
    }
  }
  return out;
}

/**
 * Jones polynomial of a closed curve from its crossings, by the Kauffman
 * bracket state sum. The bracket's smoothing convention is checked against
 * the result (a knot's normalised bracket only has powers of A⁴).
 */
export function jonesOf(points: P2[]): Jones {
  const crossings = crossingsOf(points);
  const m = crossings.length;
  if (m === 0) return { 0: 1 };
  if (m > 22) throw new Error(`too many crossings (${m}) for the state sum`);

  // Edges run between consecutive passages through crossings along the curve.
  const passages = crossings.flatMap((c, i) => [
    { at: c.over, crossing: i, over: true },
    { at: c.under, crossing: i, over: false },
  ]);
  passages.sort((a, b) => a.at - b.at);
  const M = passages.length;
  const ends = crossings.map(() => ({ oIn: 0, oOut: 0, uIn: 0, uOut: 0 }));
  passages.forEach((p, k) => {
    const e = ends[p.crossing];
    if (p.over) {
      e.oIn = (k - 1 + M) % M;
      e.oOut = k;
    } else {
      e.uIn = (k - 1 + M) % M;
      e.uOut = k;
    }
  });
  // Four edge ends counterclockwise from the incoming under-strand; sign by the right-hand rule.
  const pd = crossings.map((c, i) => {
    const e = ends[i];
    const ccw = c.dUnder[0] * c.dOver[1] - c.dUnder[1] * c.dOver[0] > 0;
    return ccw ? [e.uIn, e.oIn, e.uOut, e.oOut] : [e.uIn, e.oOut, e.uOut, e.oIn];
  });
  const writhe = crossings.reduce((w, c) => w + Math.sign(c.dOver[0] * c.dUnder[1] - c.dOver[1] * c.dUnder[0]), 0);

  const bracket = (swap: boolean): Poly => {
    const loop = poly([[2, -1], [-2, -1]]);
    const loopPowers: Poly[] = [poly([[0, 1]])];
    for (let k = 1; k <= M; k++) loopPowers.push(mul(loopPowers[k - 1], loop));
    let total: Poly = new Map();
    const parent = new Int32Array(M);
    const find = (x: number): number => {
      while (parent[x] !== x) x = parent[x] = parent[parent[x]];
      return x;
    };
    for (let state = 0; state < 1 << m; state++) {
      for (let k = 0; k < M; k++) parent[k] = k;
      let aCount = 0;
      for (let i = 0; i < m; i++) {
        const [a, b, c, d] = pd[i];
        const smoothA = ((state >> i) & 1) === 0;
        if (smoothA) aCount++;
        if (smoothA !== swap) {
          parent[find(a)] = find(b);
          parent[find(c)] = find(d);
        } else {
          parent[find(a)] = find(d);
          parent[find(b)] = find(c);
        }
      }
      let loops = 0;
      for (let k = 0; k < M; k++) if (find(k) === k) loops++;
      total = add(total, mul(poly([[aCount - (m - aCount), 1]]), loopPowers[loops - 1]));
    }
    // Normalise: (−A³)^(−writhe) · ⟨D⟩.
    return mul(total, poly([[-3 * writhe, writhe % 2 === 0 ? 1 : -1]]));
  };

  for (const swap of [false, true]) {
    const f = bracket(swap);
    if ([...f.keys()].every((e) => e % 4 === 0)) {
      // A = t^(−1/4).
      return Object.fromEntries([...f].map(([e, c]) => [-e / 4, c]));
    }
  }
  throw new Error('bracket did not normalise to a polynomial in t');
}

/** Linking number of two closed curves (half the sum of the signs of the crossings between them). */
function linkingNumber(a: P2[], b: P2[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) {
      const p = a[i];
      const q = a[(i + 1) % a.length];
      const r = b[j];
      const s = b[(j + 1) % b.length];
      const hit = intersect(p, q, r, s);
      if (!hit) continue;
      const [t, u] = hit;
      const ha = p[2] + (q[2] - p[2]) * t;
      const hb = r[2] + (s[2] - r[2]) * u;
      const da = [q[0] - p[0], q[1] - p[1]];
      const db = [s[0] - r[0], s[1] - r[1]];
      const [dO, dU] = ha > hb ? [da, db] : [db, da];
      sum += Math.sign(dO[0] * dU[1] - dO[1] * dU[0]);
    }
  }
  return sum / 2;
}

// ---- Sampling the rope --------------------------------------------------------------------

const STRIDE = 3;

/** Front view of rope samples [from, to]: u = x, v = y, height = z (toward the camera). */
function frontView(path: RopePath, tightness: number, from: number, to: number, flat = false): P2[] {
  const p = new THREE.Vector3();
  const out: P2[] = [];
  for (let s = from; s <= to; s += STRIDE) {
    path.pointAt(s, tightness, p);
    // A knot lying on the ground is read from above: height decides over and under.
    out.push(flat ? [p.x, -p.z, p.y] : [p.x, p.y, p.z]);
  }
  return out;
}

/** Closes an open rope with an arc above everything (so any such arc gives the same knot). */
const closedOver = (points: P2[]): P2[] => {
  const first = points[0];
  const last = points[points.length - 1];
  return [...points, [last[0], last[1], 1e3], [first[0], first[1], 1e3]];
};

/** Closes a strand far away: out along `out` from its end, round and back in to its start (behind or in front). */
function closedFarAway(points: P2[], outEnd: [number, number], outStart: [number, number], height: number): P2[] {
  const first = points[0];
  const last = points[points.length - 1];
  const far = 50;
  return [
    ...points,
    [last[0] + outEnd[0] * far, last[1] + outEnd[1] * far, height],
    [first[0] + outStart[0] * far, first[1] + outStart[1] * far, height],
  ];
}

// ---- Hitches: unrolled round an axis ------------------------------------------------------

interface Axis {
  /** Point on the axis and which way it runs ('x' = along the rail, 'y' = up the standing part). */
  at: THREE.Vector3;
  along: 'x' | 'y';
}

interface Unrolled {
  /** Crossings met along the rope (sample index), each passed twice: over or under. */
  passages: { sample: number; crossing: number; over: boolean }[];
  /** Total turn round the axis (radians, signed) between samples. */
  turn: (from: number, to: number) => number;
}

/**
 * Rope samples within `reach` of an axis, unrolled into (angle round it,
 * distance along it); crossings there are read with the strand farther from
 * the axis on top.
 */
function unroll(path: RopePath, tightness: number, axis: Axis, reach: number, from: number, to: number, skip = 0): Unrolled {
  const p = new THREE.Vector3();
  const samples: { s: number; angle: number; along: number; r: number }[] = [];
  let unwrap = 0;
  let previous: number | null = null;
  for (let s = from; s <= to; s += 1) {
    path.pointAt(s, tightness, p);
    const d = p.clone().sub(axis.at);
    const [a, b, along] = axis.along === 'x' ? [d.y, d.z, d.x] : [d.x, d.z, d.y];
    const r = Math.hypot(a, b);
    let angle = Math.atan2(b, a);
    if (previous !== null) {
      while (angle - previous > Math.PI) angle -= 2 * Math.PI;
      while (angle - previous < -Math.PI) angle += 2 * Math.PI;
    }
    previous = angle;
    unwrap = angle;
    samples.push({ s, angle: unwrap, along, r });
  }
  const near = samples.filter((x) => x.r <= reach && x.r >= skip);

  const passages: Unrolled['passages'] = [];
  let id = 0;
  for (let i = 0; i < near.length - 1; i++) {
    if (near[i + 1].s - near[i].s > 1) continue;
    for (let j = i + 8; j < near.length - 1; j++) {
      if (near[j + 1].s - near[j].s > 1) continue;
      for (let k = -4; k <= 4; k++) {
        const shift = k * 2 * Math.PI;
        const a: P2 = [near[i].angle, near[i].along, near[i].r];
        const b: P2 = [near[i + 1].angle, near[i + 1].along, near[i + 1].r];
        const c: P2 = [near[j].angle + shift, near[j].along, near[j].r];
        const d: P2 = [near[j + 1].angle + shift, near[j + 1].along, near[j + 1].r];
        const hit = intersect(a, b, c, d);
        if (!hit) continue;
        const [t, u] = hit;
        const ri = a[2] + (b[2] - a[2]) * t;
        const rj = c[2] + (d[2] - c[2]) * u;
        passages.push({ sample: near[i].s, crossing: id, over: ri > rj });
        passages.push({ sample: near[j].s, crossing: id, over: rj > ri });
        id++;
      }
    }
  }
  passages.sort((x, y) => x.sample - y.sample);
  const angleAt = (s: number): number => samples[Math.max(0, Math.min(samples.length - 1, Math.round(s - from)))].angle;
  return { passages, turn: (a, b) => angleAt(b) - angleAt(a) };
}

/**
 * The clove-hitch pattern round an axis: exactly two crossings, met along the
 * rope as under (standing side), over, over (the diagonal), under (the end),
 * with a full turn between the first two and between the last two, both the
 * same way round. An end may also lie over a turn on its way in or out (round
 * an upright post the standing part runs down over the lower turn): such
 * crossings come first or last along the rope with the end on top, and are
 * set aside before the pattern is read.
 */
function clovePattern(u: Unrolled): { ok: boolean; detail: string } {
  const seq = u.passages.map((p) => `${p.crossing}${p.over ? 'o' : 'u'}`).join(' ');
  let core = u.passages;
  const legs: number[] = [];
  for (;;) {
    const first = core[0];
    const last = core[core.length - 1];
    const leg = first?.over ? first.crossing : last?.over ? last.crossing : -1;
    if (leg < 0 || core.length <= 4) break;
    legs.push(leg);
    core = core.filter((p) => p.crossing !== leg);
  }
  u = { ...u, passages: core };
  const note = legs.length ? ` (${legs.length} where an end lies over a turn: normal)` : '';
  if (u.passages.length !== 4) return { ok: false, detail: `${u.passages.length / 2} crossings (want 2): ${seq}` };
  const [p1, p2, p3, p4] = u.passages;
  const shapeOk = !p1.over && p2.over && p3.over && !p4.over && p1.crossing === p2.crossing && p3.crossing === p4.crossing;
  const t1 = u.turn(p1.sample, p2.sample);
  const t2 = u.turn(p3.sample, p4.sample);
  const deg = (r: number): number => Math.round((r * 180) / Math.PI);
  const turnsOk = Math.abs(Math.abs(t1) - 2 * Math.PI) < Math.PI / 3 && Math.abs(Math.abs(t2) - 2 * Math.PI) < Math.PI / 3 && Math.sign(t1) === Math.sign(t2);
  return {
    ok: shapeOk && turnsOk,
    detail: `crossings ${seq}${note}; turns ${deg(t1)}° then ${deg(t2)}°${Math.sign(t1) === Math.sign(t2) ? ' (same way)' : ' (opposite ways — a cow hitch)'}`,
  };
}

// ---- Per-knot checks ----------------------------------------------------------------------

export interface CheckResult {
  check: string;
  ok: boolean;
  detail: string;
}

/** Checks a knot (at the given tightness: 0 loose, 1 pulled tight). */
export function verifyKnot(knot: KnotDefinition, path: RopePath, tightness: number): CheckResult[] {
  const end = path.end;
  const results: CheckResult[] = [];
  const jones = (name: string, from: number, to: number, want: string): void => {
    const got = identify(jonesOf(closedOver(frontView(path, tightness, from, to, Boolean(knot.path?.flat)))));
    results.push({ check: `${name} is ${want}`, ok: got === want, detail: got });
  };

  switch (knot.id) {
    case 'overhand':
      jones('rope', 0, end, 'trefoil');
      break;
    case 'figure-eight':
      jones('rope', 0, end, 'figure-eight');
      break;
    case 'square-knot': {
      // Two ropes: join the two working ends over everything, and the two standing ends
      // round the outside — the same pairing as a single rope tied round a bundle.
      const gold = frontView(path, tightness, Math.ceil(path.mainStart), end);
      const red = frontView(path, tightness, 0, Math.floor(path.partnerEnd)).reverse();
      const goldTail = gold[gold.length - 1];
      const redTail = red[0];
      const curve: P2[] = [...gold, [goldTail[0], goldTail[1], 1e3], [redTail[0], redTail[1], 1e3], ...red];
      const got = identify(jonesOf(closedOver(curve)));
      results.push({ check: 'the two ropes make a square knot', ok: got === 'square knot', detail: got });
      break;
    }
    case 'overhand-noose': {
      jones('whole rope (slips free)', 0, end, 'unknot');
      const bottom = Math.round(path.traceFrom);
      jones('working end alone', bottom + 6, end, 'trefoil');
      // Standing part closed far below and round behind; the end closed far off to the right, in front.
      const standing = closedFarAway(frontView(path, tightness, 0, bottom - 6), [0, -1], [-1, 1], -1e3);
      const working = closedFarAway(frontView(path, tightness, bottom + 6, end), [1, 0], [1, -1], 1e3);
      const lk = linkingNumber(standing, working);
      results.push({ check: 'standing part threads the overhand once', ok: Math.abs(lk) === 1, detail: `linking number ${lk}` });
      break;
    }
    case 'clove-hitch': {
      const rail = knot.path!.rail!;
      const u = unroll(path, tightness, { at: new THREE.Vector3(0, rail.y, rail.z), along: 'x' }, rail.radius * 3.2, 0, end);
      const c = clovePattern(u);
      results.push({ check: 'clove hitch round the rail', ok: c.ok, detail: c.detail });
      break;
    }
    case 'round-turn-two-half-hitches': {
      const rail = knot.path!.rail!;
      const railAxis: Axis = { at: new THREE.Vector3(0, rail.y, rail.z), along: 'x' };
      const onRail = unroll(path, tightness, railAxis, rail.radius * 2.2, 0, end);
      const first = Math.round(path.traceFrom);
      const turnEnd = Math.round(path.stepEnds[0]);
      const turnDeg = Math.round((Math.abs(onRail.turn(first, turnEnd)) * 180) / Math.PI);
      results.push({
        check: 'round turn: 1½ times round the rail, not crossing itself',
        ok: onRail.passages.length === 0 && turnDeg >= 500 && turnDeg <= 580,
        detail: `${turnDeg}° round, ${onRail.passages.length / 2} crossings on the rail`,
      });
      const top = new THREE.Vector3();
      path.pointAt(0, tightness, top);
      const standing: Axis = { at: new THREE.Vector3(top.x, 0, top.z), along: 'y' };
      // Only the rope above the rail, close round the standing part (the standing part itself is the axis).
      const u = unroll(path, tightness, standing, 0.2, turnEnd, end, 0.02);
      const c = clovePattern(u);
      results.push({ check: 'two half hitches the same way (a clove hitch round the standing part)', ok: c.ok, detail: c.detail });
      break;
    }
    default:
      results.push({ check: 'no check written for this knot yet', ok: false, detail: knot.id });
  }
  return results;
}
