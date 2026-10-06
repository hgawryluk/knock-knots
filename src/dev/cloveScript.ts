import { sampleAroundLog, surfaceCrossings, windingBetween } from '../knots/logAnalysis';
import type { KnotEvaluation } from '../knots/cloveHitch';
import type { RopeSim } from '../rope/ropeSim';
import type { Log } from '../scene/log';

interface Point {
  x: number;
  y: number;
  z: number;
}

/**
 * Dev-only regression check: drives the working end through a clove hitch
 * around the log with the real physics, logging what the knot checker sees
 * after each phase. Run from the console: `__knots.tieClove()`.
 */
export function tieClove(
  sim: RopeSim,
  log: Log,
  ropeRadius: number,
  evaluate: () => KnotEvaluation,
  stopAfter = '',
  x0 = 0.3,
): string[] {
  const end = sim.count - 1;
  const s = log.sectionAt(x0);
  const out: string[] = [];

  // phi: 0 = front of the log, 90 = top, 180 = back, 270 = underneath.
  const around = (x: number, phiDeg: number, gap: number): Point => {
    const phi = (phiDeg * Math.PI) / 180;
    return {
      x,
      y: s.cy + Math.sin(phi) * (s.ry + ropeRadius + gap),
      z: s.cz + Math.cos(phi) * (s.rz + ropeRadius + gap),
    };
  };
  const endPosition = (): Point => {
    const p = sim.positions;
    return { x: p[end * 3], y: p[end * 3 + 1], z: p[end * 3 + 2] };
  };
  const moveTo = (target: Point, frames: number): void => {
    const start = endPosition();
    for (let f = 1; f <= frames; f++) {
      const t = f / frames;
      sim.grab(end, {
        x: start.x + (target.x - start.x) * t,
        y: start.y + (target.y - start.y) * t,
        z: start.z + (target.z - start.z) * t,
      });
      sim.step(1 / 60);
    }
  };
  const sweep = (x1: number, x2: number, phi1: number, phi2: number, gap = 0.08): void => {
    const n = Math.ceil(Math.abs(phi2 - phi1) / 10);
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      moveTo(around(x1 + (x2 - x1) * t, phi1 + (phi2 - phi1) * t, gap), 4);
    }
  };
  class Stop extends Error {}
  const report = (label: string): void => {
    const samples = sampleAroundLog(sim.positions, sim.count, log, ropeRadius);
    const crossings = surfaceCrossings(samples);
    const turns = windingBetween(samples, 0, sim.count - 1);
    out.push(`${label}: completed=${evaluate().completed} turns=${turns.toFixed(2)} crossings=${JSON.stringify(crossings)}`);
    if (label === stopAfter) throw new Stop();
  };

  const hold = (frames: number): void => {
    for (let i = 0; i < frames; i++) sim.step(1 / 60);
  };
  /** Where the rope lying on top of a crossing currently is, as (x, phi) in this script's convention. */
  const diagonalSpot = (): { x: number; phi: number } | null => {
    const samples = sampleAroundLog(sim.positions, sim.count, log, ropeRadius);
    const crossing = surfaceCrossings(samples).find((c) => c.over === c.b);
    if (!crossing) return null;
    const d = samples[crossing.b];
    return { x: d.x, phi: 90 - (d.theta * 180) / Math.PI };
  };

  try {
    // Swing the end around in wide arcs, like a hand laying slack, rather than dragging it along the bark.
    moveTo({ x: x0, y: 0.2, z: s.cz + 0.8 }, 60);
    moveTo(around(x0, -40, 0.3), 40);
    report('reach');
    sweep(x0, x0 + 0.3, -40, 320, 0.5);
    hold(30);
    report('turn 1');
    sweep(x0 + 0.3, x0 - 0.3, 320, 450, 0.5);
    hold(30);
    report('diagonal');
    sweep(x0 - 0.3, x0 - 0.3, 450, 700, 0.5);
    hold(30);
    report('turn 2');

    // Tuck: slide the end along the bark under wherever the diagonal ended up.
    const spot = diagonalSpot();
    if (!spot) throw new Stop();
    // Next occurrence of the diagonal ahead of the end (which sits near phi 700).
    const base = spot.phi + 360 * Math.ceil((650 - spot.phi) / 360);
    moveTo(around(spot.x - 0.3, base - 50, 0.05), 30);
    sim.tuckUnder = true;
    sweep(spot.x - 0.3, spot.x + 0.3, base - 50, base + 50, 0);
    report('tuck');
    moveTo(around(spot.x + 0.45, base + 80, 0.5), 30);
    sim.tuckUnder = false;
    sim.release();
    hold(60);
    report('released');
  } catch (error) {
    if (!(error instanceof Stop)) throw error;
  }
  return out;
}
