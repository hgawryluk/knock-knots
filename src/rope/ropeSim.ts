import * as THREE from 'three';
import type { Log, LogSection } from '../scene/log';

export interface Ellipsoid {
  center: THREE.Vector3;
  radii: THREE.Vector3;
}

export interface RopeColliders {
  log: Log;
  ellipsoids: Ellipsoid[];
  groundY: number;
}

const GRAVITY = -30;
const SUBSTEPS = 4;
const ITERATIONS = 10;
const DAMPING = 0.992;
/** Max distance a grabbed particle moves per substep, so it slides around obstacles instead of tunnelling. */
const MAX_GRAB_STEP = 0.05;
/** How many particles either side of the hand count as "the end being tucked". */
const TUCK_REACH = 4;
/** Within this normalized distance of the log axis, "lift" means away from the log rather than up. */
const LIFT_NEAR_LOG = 1.6;
/** Minimum distance between particles i and i+2, in segment lengths (2 = straight). */
const MIN_BEND_SPAN = 1.85;
const BEND_STIFFNESS = 0.3;
const GROUND_FRICTION = 0.55;
/** Per-iteration grip for rope on the grass (see applyGroundFriction). */
const GROUND_SIDE_GRIP = 0.35;
const GROUND_ALONG_GRIP = 0.06;
/** Particles this close to the hand (≈1.2 units of rope) follow it without grass grip. */
const CARRIED_BY_HAND = 24;
/**
 * Per-iteration share of sliding (since the substep began) cancelled for rope on the log.
 * Rope slides lengthwise along its own path fairly easily (so you can pull it around the
 * log) but strongly resists slipping sideways, which keeps turns where you laid them.
 */
const LOG_SIDE_GRIP = 0.5;
/** Same idea for rope pressing on rope: without it, crossings slide apart and knots won't hold. */
const ROPE_GRIP = 0.7;
/** Near-static sideways grip for turns pinned in place while the end is being worked (see isHeldInPlace). */
const HELD_GRIP = 0.95;
/** Rope this many particles behind the hand (≈1 unit) counts as already laid. */
const HELD_BEHIND_HAND = 20;
const LOG_ALONG_GRIP = 0.08;
const NO_CONTACT = 0;
const GROUND_CONTACT = 1;
const LOG_CONTACT = 2;

/**
 * Position-based rope: a chain of particles with distance constraints, mild
 * bending resistance, self-collision and friction against the log and ground.
 */
export class RopeSim {
  readonly count: number;
  readonly positions: Float32Array;
  private readonly previous: Float32Array;
  private readonly invMass: Float32Array;
  private readonly contact: Uint8Array;
  private readonly hash = new Map<number, number[]>();
  private readonly section: LogSection = { cy: 0, cz: 0, ry: 0, rz: 0 };
  private grabbed = -1;
  /**
   * "Tuck under" assist: rope that the held end runs into is lifted away from
   * the log instead of being pushed aside, so the end slips underneath it.
   */
  tuckUnder = false;
  /** A finished knot is "set" (snugged tight): rope on the log and on itself grips firmly until reset. */
  knotSet = false;
  /**
   * How much the grass holds rope in place (0–1). Knots tied on the grass need laid loops to
   * keep their shape; hitches on the log need the standing part to slide so they can draw up.
   */
  groundGrip = 1;
  private readonly grabTarget = new THREE.Vector3();

  constructor(
    points: THREE.Vector3[],
    readonly segmentLength: number,
    readonly radius: number,
    private readonly colliders: RopeColliders,
  ) {
    this.count = points.length;
    this.positions = new Float32Array(this.count * 3);
    points.forEach((p, i) => p.toArray(this.positions, i * 3));
    this.previous = this.positions.slice();
    this.invMass = new Float32Array(this.count).fill(1);
    this.contact = new Uint8Array(this.count);
  }

  /** Lays the rope back along `points` (same count) at rest. */
  reset(points: THREE.Vector3[]): void {
    points.forEach((p, i) => p.toArray(this.positions, i * 3));
    this.previous.set(this.positions);
    this.release();
    this.knotSet = false;
  }

  /** Fixes a particle in place (e.g. the standing end tied off out of view). */
  pin(index: number): void {
    this.invMass[index] = 0;
  }

  get grabbedIndex(): number {
    return this.grabbed;
  }

  grab(index: number, target: THREE.Vector3Like): void {
    this.grabbed = index;
    this.grabTarget.set(target.x, target.y, target.z);
  }

  setGrabTarget(target: THREE.Vector3Like): void {
    this.grabTarget.set(target.x, target.y, target.z);
  }

  release(): void {
    this.grabbed = -1;
  }

  getPosition(index: number, out: THREE.Vector3): THREE.Vector3 {
    return out.fromArray(this.positions, index * 3);
  }

  step(dt: number): void {
    const h = Math.min(dt, 1 / 30) / SUBSTEPS;
    for (let s = 0; s < SUBSTEPS; s++) {
      this.integrate(h);
      this.moveGrabbed();
      for (let it = 0; it < ITERATIONS; it++) {
        this.solveDistances();
        if (it % 2 === 0) this.solveSelfCollisions();
        this.solveColliders();
      }
      this.applyFriction();
    }
  }

  private isFixed(i: number): boolean {
    return this.invMass[i] === 0 || i === this.grabbed;
  }

  private integrate(h: number): void {
    const p = this.positions;
    const q = this.previous;
    const g = GRAVITY * h * h;
    for (let i = 0; i < this.count; i++) {
      const k = i * 3;
      if (this.isFixed(i)) {
        q[k] = p[k];
        q[k + 1] = p[k + 1];
        q[k + 2] = p[k + 2];
        continue;
      }
      for (let a = 0; a < 3; a++) {
        const v = (p[k + a] - q[k + a]) * DAMPING;
        q[k + a] = p[k + a];
        p[k + a] += v + (a === 1 ? g : 0);
      }
    }
  }

  private moveGrabbed(): void {
    if (this.grabbed < 0) return;
    const p = this.positions;
    const k = this.grabbed * 3;
    if (this.moveAroundLog(k)) return;
    const dx = this.grabTarget.x - p[k];
    const dy = this.grabTarget.y - p[k + 1];
    const dz = this.grabTarget.z - p[k + 2];
    const d = Math.hypot(dx, dy, dz);
    const f = d > MAX_GRAB_STEP ? MAX_GRAB_STEP / d : 1;
    p[k] += dx * f;
    p[k + 1] += dy * f;
    p[k + 2] += dz * f;
  }

  /**
   * If the straight line from the held point to its target would cut through
   * the log, step around the log's surface instead (the shorter way), so a
   * target on the far side is reached by wrapping rather than getting stuck.
   */
  private moveAroundLog(k: number): boolean {
    const p = this.positions;
    const { log } = this.colliders;
    const t = this.grabTarget;
    if (p[k] <= log.minX || p[k] >= log.maxX) return false;
    const s = log.sectionAt(p[k], this.section);
    const ry = s.ry + this.radius;
    const rz = s.rz + this.radius;
    const u0 = (p[k + 1] - s.cy) / ry;
    const v0 = (p[k + 2] - s.cz) / rz;
    const u1 = (t.y - s.cy) / ry;
    const v1 = (t.z - s.cz) / rz;
    // Closest approach of the segment to the axis, in normalized coordinates.
    const du = u1 - u0;
    const dv = v1 - v0;
    const len2 = du * du + dv * dv;
    const along = len2 > 1e-9 ? Math.min(Math.max(-(u0 * du + v0 * dv) / len2, 0), 1) : 0;
    if (Math.hypot(u0 + du * along, v0 + dv * along) >= 0.98) return false;

    const a0 = Math.atan2(v0, u0);
    let turn = Math.atan2(v1, u1) - a0;
    turn -= Math.PI * 2 * Math.round(turn / (Math.PI * 2));
    const maxTurn = MAX_GRAB_STEP / Math.min(ry, rz);
    const angle = a0 + Math.max(-maxTurn, Math.min(maxTurn, turn));
    const radius = Math.max(Math.hypot(u0, v0), 1.02);
    const dx = t.x - p[k];
    p[k] += Math.max(-MAX_GRAB_STEP, Math.min(MAX_GRAB_STEP, dx));
    p[k + 1] = s.cy + Math.cos(angle) * radius * ry;
    p[k + 2] = s.cz + Math.sin(angle) * radius * rz;
    return true;
  }

  private solveDistances(): void {
    const p = this.positions;
    const rest = this.segmentLength;
    for (let i = 0; i < this.count - 1; i++) {
      this.solvePair(i, i + 1, rest, 1);
    }
    // Bending resistance: keeps a minimum bend radius (~2 rope diameters) so rope curves instead of kinking.
    for (let i = 0; i < this.count - 2; i++) {
      const a = i * 3;
      const b = (i + 2) * 3;
      const d = Math.hypot(p[b] - p[a], p[b + 1] - p[a + 1], p[b + 2] - p[a + 2]);
      if (d < rest * MIN_BEND_SPAN) this.solvePair(i, i + 2, rest * MIN_BEND_SPAN, BEND_STIFFNESS);
    }
  }

  private solvePair(i: number, j: number, rest: number, stiffness: number): void {
    const wi = this.isFixed(i) ? 0 : this.invMass[i];
    const wj = this.isFixed(j) ? 0 : this.invMass[j];
    const w = wi + wj;
    if (w === 0) return;
    const p = this.positions;
    const a = i * 3;
    const b = j * 3;
    const dx = p[b] - p[a];
    const dy = p[b + 1] - p[a + 1];
    const dz = p[b + 2] - p[a + 2];
    const d = Math.hypot(dx, dy, dz);
    if (d < 1e-6) return;
    const c = ((d - rest) / (d * w)) * stiffness;
    p[a] += dx * c * wi;
    p[a + 1] += dy * c * wi;
    p[a + 2] += dz * c * wi;
    p[b] -= dx * c * wj;
    p[b + 1] -= dy * c * wj;
    p[b + 2] -= dz * c * wj;
  }

  /** Keeps non-neighbouring parts of the rope at least one diameter apart (spatial hash). */
  private solveSelfCollisions(): void {
    const p = this.positions;
    const minDist = this.radius * 2;
    const cell = minDist;
    const key = (x: number, y: number, z: number): number => (x * 73856093) ^ (y * 19349663) ^ (z * 83492791);
    this.hash.clear();
    for (let i = 0; i < this.count; i++) {
      const k = key(Math.floor(p[i * 3] / cell), Math.floor(p[i * 3 + 1] / cell), Math.floor(p[i * 3 + 2] / cell));
      const bucket = this.hash.get(k);
      if (bucket) bucket.push(i);
      else this.hash.set(k, [i]);
    }

    const skip = Math.ceil(minDist / this.segmentLength) + 1;
    for (let i = 0; i < this.count; i++) {
      const cx = Math.floor(p[i * 3] / cell);
      const cy = Math.floor(p[i * 3 + 1] / cell);
      const cz = Math.floor(p[i * 3 + 2] / cell);
      for (let x = -1; x <= 1; x++) {
        for (let y = -1; y <= 1; y++) {
          for (let z = -1; z <= 1; z++) {
            const bucket = this.hash.get(key(cx + x, cy + y, cz + z));
            if (!bucket) continue;
            for (const j of bucket) {
              if (j <= i + skip) continue;
              this.separate(i, j, minDist);
            }
          }
        }
      }
    }
  }

  private separate(i: number, j: number, minDist: number): void {
    const p = this.positions;
    const a = i * 3;
    const b = j * 3;
    const dx = p[b] - p[a];
    const dy = p[b + 1] - p[a + 1];
    const dz = p[b + 2] - p[a + 2];
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 >= minDist * minDist || d2 < 1e-12) return;
    if (this.tuckUnder && this.grabbed >= 0) {
      const nearHand = (k: number): boolean => Math.abs(k - this.grabbed) <= TUCK_REACH;
      if (nearHand(i) !== nearHand(j) && this.liftOver(nearHand(i) ? j : i, Math.sqrt(d2), minDist)) return;
    }
    const wi = this.isFixed(i) ? 0 : 1;
    const wj = this.isFixed(j) ? 0 : 1;
    if (wi + wj === 0) return;
    const d = Math.sqrt(d2);
    const c = (d - minDist) / (d * (wi + wj));
    p[a] += dx * c * wi;
    p[a + 1] += dy * c * wi;
    p[a + 2] += dz * c * wi;
    p[b] -= dx * c * wj;
    p[b + 1] -= dy * c * wj;
    p[b + 2] -= dz * c * wj;
    this.applyRopeFriction(i, j, dx / d, dy / d, dz / d, wi, wj);
  }

  /**
   * Rope-on-rope friction for a touching pair: cancels part of their relative
   * sliding (since the substep began) across the contact, so crossings stay put.
   */
  private applyRopeFriction(i: number, j: number, nx: number, ny: number, nz: number, wi: number, wj: number): void {
    const p = this.positions;
    const q = this.previous;
    const a = i * 3;
    const b = j * 3;
    let rx = p[a] - q[a] - (p[b] - q[b]);
    let ry = p[a + 1] - q[a + 1] - (p[b + 1] - q[b + 1]);
    let rz = p[a + 2] - q[a + 2] - (p[b + 2] - q[b + 2]);
    const rn = rx * nx + ry * ny + rz * nz;
    const grip = this.knotSet ? HELD_GRIP : ROPE_GRIP;
    rx = (rx - rn * nx) * grip;
    ry = (ry - rn * ny) * grip;
    rz = (rz - rn * nz) * grip;
    const w = wi + wj;
    p[a] -= (rx * wi) / w;
    p[a + 1] -= (ry * wi) / w;
    p[a + 2] -= (rz * wi) / w;
    p[b] += (rx * wj) / w;
    p[b + 1] += (ry * wj) / w;
    p[b + 2] += (rz * wj) / w;
  }

  /** Pushes particle `i` away from the surface it lies on (the log, else the ground) by the overlap. */
  private liftOver(i: number, distance: number, minDist: number): boolean {
    if (this.invMass[i] === 0) return false;
    const p = this.positions;
    const k = i * 3;
    const lift = minDist - distance;
    const { log } = this.colliders;
    const s = p[k] > log.minX && p[k] < log.maxX ? log.sectionAt(p[k], this.section) : null;
    if (s && Math.hypot((p[k + 1] - s.cy) / s.ry, (p[k + 2] - s.cz) / s.rz) < LIFT_NEAR_LOG) {
      let ny = (p[k + 1] - s.cy) / (s.ry * s.ry);
      let nz = (p[k + 2] - s.cz) / (s.rz * s.rz);
      const len = Math.hypot(ny, nz);
      if (len < 1e-6) return false;
      ny /= len;
      nz /= len;
      p[k + 1] += ny * lift;
      p[k + 2] += nz * lift;
      return true;
    }
    // Away from the log (e.g. rope on the grass) "away from the surface" is simply up.
    p[k + 1] += lift;
    return true;
  }

  private solveColliders(): void {
    const p = this.positions;
    const r = this.radius;
    const { log, ellipsoids, groundY } = this.colliders;
    for (let i = 0; i < this.count; i++) {
      if (this.invMass[i] === 0) continue;
      const k = i * 3;
      this.contact[i] = NO_CONTACT;

      if (p[k] > log.minX && p[k] < log.maxX) {
        const s = log.sectionAt(p[k], this.section);
        const ry = s.ry + r;
        const rz = s.rz + r;
        const dy = p[k + 1] - s.cy;
        const dz = p[k + 2] - s.cz;
        const q = Math.hypot(dy / ry, dz / rz);
        if (q < 1) {
          if (q < 1e-5) {
            p[k + 1] = s.cy + ry;
          } else {
            p[k + 1] = s.cy + dy / q;
            p[k + 2] = s.cz + dz / q;
          }
          this.contact[i] = LOG_CONTACT;
          if (i !== this.grabbed) this.applyLogFriction(i, s.cy, s.cz, ry, rz);
        }
      }

      for (const e of ellipsoids) {
        const ex = e.radii.x + r;
        const ey = e.radii.y + r;
        const ez = e.radii.z + r;
        const dx = p[k] - e.center.x;
        const dy = p[k + 1] - e.center.y;
        const dz = p[k + 2] - e.center.z;
        const q = Math.hypot(dx / ex, dy / ey, dz / ez);
        if (q < 1 && q > 1e-5) {
          p[k] = e.center.x + dx / q;
          p[k + 1] = e.center.y + dy / q;
          p[k + 2] = e.center.z + dz / q;
        }
      }

      if (p[k + 1] < groundY + r) {
        p[k + 1] = groundY + r;
        if (this.contact[i] === NO_CONTACT) {
          this.contact[i] = GROUND_CONTACT;
          if (i !== this.grabbed) this.applyGroundFriction(i);
        }
      }
    }
  }

  /**
   * Position-level friction against the log, measured from where the particle
   * started this substep: sideways slip is cancelled strongly, lengthwise slide weakly.
   */
  /**
   * Rope on the grass behaves like a snake: it slides along its own length
   * easily but resists being dragged sideways, so loops and curves you lay
   * down keep their shape instead of being pulled straight.
   */
  private applyGroundFriction(i: number): void {
    const p = this.positions;
    const q = this.previous;
    const k = i * 3;
    const a = Math.max(i - 1, 0) * 3;
    const b = Math.min(i + 1, this.count - 1) * 3;
    let tx = p[b] - p[a];
    let tz = p[b + 2] - p[a + 2];
    const tl = Math.hypot(tx, tz) || 1;
    tx /= tl;
    tz /= tl;
    const dx = p[k] - q[k];
    const dz = p[k + 2] - q[k + 2];
    const along = dx * tx + dz * tz;
    // Rope just behind your hand is being carried along with it, so it moves freely.
    const carried = this.grabbed >= 0 && Math.abs(this.grabbed - i) <= CARRIED_BY_HAND;
    const side = this.knotSet ? HELD_GRIP : (carried ? GROUND_ALONG_GRIP : GROUND_SIDE_GRIP) * this.groundGrip;
    const lengthwise = this.knotSet ? HELD_GRIP : GROUND_ALONG_GRIP * this.groundGrip;
    p[k] -= (dx - along * tx) * side + along * tx * lengthwise;
    p[k + 2] -= (dz - along * tz) * side + along * tz * lengthwise;
  }

  private applyLogFriction(i: number, cy: number, cz: number, ry: number, rz: number): void {
    const p = this.positions;
    const q = this.previous;
    const k = i * 3;

    // Surface normal of the ellipse (no x component: the log runs along X).
    let ny = (p[k + 1] - cy) / (ry * ry);
    let nz = (p[k + 2] - cz) / (rz * rz);
    const nl = Math.hypot(ny, nz) || 1;
    ny /= nl;
    nz /= nl;

    // Rope direction from its neighbours, flattened onto the surface.
    const a = Math.max(i - 1, 0) * 3;
    const b = Math.min(i + 1, this.count - 1) * 3;
    let tx = p[b] - p[a];
    let ty = p[b + 1] - p[a + 1];
    let tz = p[b + 2] - p[a + 2];
    const tn = ty * ny + tz * nz;
    ty -= tn * ny;
    tz -= tn * nz;
    const tl = Math.hypot(tx, ty, tz) || 1;
    tx /= tl;
    ty /= tl;
    tz /= tl;

    // Slide since substep start, minus its normal part.
    const dx = p[k] - q[k];
    let dy = p[k + 1] - q[k + 1];
    let dz = p[k + 2] - q[k + 2];
    const dn = dy * ny + dz * nz;
    dy -= dn * ny;
    dz -= dn * nz;

    const along = dx * tx + dy * ty + dz * tz;
    const sx = dx - along * tx;
    const sy = dy - along * ty;
    const sz = dz - along * tz;
    const side = this.knotSet || this.isHeldInPlace(i) ? HELD_GRIP : LOG_SIDE_GRIP;
    const lengthwise = this.knotSet ? HELD_GRIP : LOG_ALONG_GRIP;
    p[k] -= sx * side + along * tx * lengthwise;
    p[k + 1] -= sy * side + along * ty * lengthwise;
    p[k + 2] -= sz * side + along * tz * lengthwise;
  }

  /**
   * While you're holding the rope, turns already laid on the log well behind
   * your hand don't slip sideways — as if your other hand were pinning them —
   * so working the end doesn't drag the hitch out of shape. Rope can still
   * slide lengthwise through them. Released rope behaves normally.
   */
  private isHeldInPlace(i: number): boolean {
    return this.grabbed >= 0 && this.grabbed - i > HELD_BEHIND_HAND && this.contact[i] === LOG_CONTACT;
  }

  /** Removes part of the sliding motion of particles resting on the ground. */
  private applyFriction(): void {
    const p = this.positions;
    const q = this.previous;
    for (let i = 0; i < this.count; i++) {
      if (this.isFixed(i)) continue;
      const k = i * 3;
      const vx = p[k] - q[k];
      const vz = p[k + 2] - q[k + 2];
      if (this.contact[i] === GROUND_CONTACT) {
        q[k] += vx * GROUND_FRICTION;
        q[k + 2] += vz * GROUND_FRICTION;
      }
    }
  }
}

/** Evenly spaced points along a smooth path through `waypoints`, `length` long. */
export function layRope(waypoints: THREE.Vector3[], length: number, spacing: number): THREE.Vector3[] {
  const curve = new THREE.CatmullRomCurve3(waypoints, false, 'centripetal');
  const total = curve.getLength();
  const count = Math.floor(Math.min(length, total) / spacing) + 1;
  return Array.from({ length: count }, (_, i) => curve.getPointAt(Math.min((i * spacing) / total, 1)));
}
