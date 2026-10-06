import type { Log, LogSection } from '../scene/log';

/** A rope particle expressed relative to the log: position along it, angle around it, and radial distance. */
export interface WrapSample {
  x: number;
  theta: number;
  /** 1 = rope resting on the bark; larger is farther out. */
  rho: number;
  /** Mean radius at x, to turn angles into arc length on the unrolled surface. */
  arcRadius: number;
  near: boolean;
  /** Loosely around the log, including rope sagging into the gap underneath. */
  around: boolean;
}

export interface Crossing {
  /** Segment indices (segment k joins particles k and k+1), a < b. */
  a: number;
  b: number;
  /** Which of the two segments lies on top (farther from the log). */
  over: number;
}

/** Particles within this normalized distance lie on the log (used for crossings). */
const NEAR = 1.6;
/** Looser band for counting turns: rope sagging under the log still goes around it. */
const AROUND = 2.4;
const TAU = Math.PI * 2;

const wrapAngle = (a: number): number => a - TAU * Math.round(a / TAU);

export function sampleAroundLog(positions: Float32Array, count: number, log: Log, ropeRadius: number): WrapSample[] {
  const section: LogSection = { cy: 0, cz: 0, ry: 0, rz: 0 };
  const samples: WrapSample[] = [];
  for (let i = 0; i < count; i++) {
    const x = positions[i * 3];
    const y = positions[i * 3 + 1];
    const z = positions[i * 3 + 2];
    log.sectionAt(x, section);
    const ry = section.ry + ropeRadius;
    const rz = section.rz + ropeRadius;
    const dy = (y - section.cy) / ry;
    const dz = (z - section.cz) / rz;
    const rho = Math.hypot(dy, dz);
    const inside = x > log.minX && x < log.maxX;
    samples.push({ x, theta: Math.atan2(dz, dy), rho, arcRadius: (ry + rz) / 2, near: inside && rho < NEAR, around: inside && rho < AROUND });
  }
  return samples;
}

/** Signed turns around the log between particles `from` and `to`, counting only wrapped stretches. */
export function windingBetween(samples: WrapSample[], from: number, to: number): number {
  let sum = 0;
  for (let i = Math.max(from, 0); i < Math.min(to, samples.length - 1); i++) {
    if (samples[i].around && samples[i + 1].around) sum += wrapAngle(samples[i + 1].theta - samples[i].theta);
  }
  return sum / TAU;
}

/**
 * Crossings of wrapped rope on the unrolled log surface (x, arc length).
 * Neighbouring segments are skipped; over/under comes from radial distance.
 */
export function surfaceCrossings(samples: WrapSample[]): Crossing[] {
  const segments: number[] = [];
  for (let k = 0; k < samples.length - 1; k++) {
    if (samples[k].near && samples[k + 1].near) segments.push(k);
  }

  const crossings: Crossing[] = [];
  for (let m = 0; m < segments.length; m++) {
    const a = segments[m];
    const a0 = samples[a];
    const a1 = samples[a + 1];
    const r = a0.arcRadius;
    const aEnd = a0.theta + wrapAngle(a1.theta - a0.theta);

    for (let n = m + 1; n < segments.length; n++) {
      const b = segments[n];
      if (b - a < 4) continue;
      const b0 = samples[b];
      const b1 = samples[b + 1];
      // Shift b by whole turns so it lands next to a on the unrolled surface.
      const bStartRaw = b0.theta;
      const bEndRaw = bStartRaw + wrapAngle(b1.theta - b0.theta);
      const shift = TAU * Math.round(((a0.theta + aEnd) / 2 - (bStartRaw + bEndRaw) / 2) / TAU);

      const hit = intersect(
        a0.x, a0.theta * r, a1.x, aEnd * r,
        b0.x, (bStartRaw + shift) * r, b1.x, (bEndRaw + shift) * r,
      );
      if (!hit) continue;
      const rhoA = a0.rho + (a1.rho - a0.rho) * hit[0];
      const rhoB = b0.rho + (b1.rho - b0.rho) * hit[1];
      crossings.push({ a, b, over: rhoA > rhoB ? a : b });
    }
  }
  return crossings;
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
  if (Math.abs(denom) < 1e-9) return null;
  const t = ((cx - ax) * sy - (cy - ay) * sx) / denom;
  const u = ((cx - ax) * ry - (cy - ay) * rx) / denom;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? [t, u] : null;
}
