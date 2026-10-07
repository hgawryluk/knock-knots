import { ropeCrossings } from '../knots/freeKnot';
import type { RopeSim } from '../rope/ropeSim';
import { createEndDrag, type Mouse, type World } from './drag';

/**
 * Dev-only: ties an overhand knot in the rope on the grass through the real
 * mouse path, from the grass start pose (standing part along z≈3, a straight
 * tail toward the camera). Like a person, later moves aim at the loop as it
 * actually lies. Run: `__knots.mouseOverhand()`.
 */
export function mouseOverhand(sim: RopeSim, mouse: Mouse, status: () => string, stopAfter = ''): string[] {
  const { drag, log } = createEndDrag(sim, mouse, status, stopAfter);
  const p = sim.positions;
  const g = sim.radius;

  /** The loop: rope between the two strands of the first crossing; its middle and the crossing point. */
  const loop = (): { cx: number; cz: number; radius: number; crossX: number; crossZ: number } | null => {
    const first = ropeCrossings(p, sim.count).sort((u, v) => u.a - v.a)[0];
    if (!first) return null;
    let cx = 0;
    let cz = 0;
    for (let i = first.a; i <= first.b; i++) {
      cx += p[i * 3];
      cz += p[i * 3 + 2];
    }
    const n = first.b - first.a + 1;
    cx /= n;
    cz /= n;
    return { cx, cz, radius: Math.hypot(first.x - cx, first.z - cz), crossX: first.x, crossZ: first.z };
  };

  // Swing the end round in a wide arc and over the standing part: it rides over, closing a loop.
  drag('loop', [[1.3, g, 5.2], [1.7, g, 4.0], [1.5, g, 3.0], [1.3, g, 2.2]]);

  // Shift: back under the standing part into the middle of the loop.
  const first = loop();
  if (first) drag('under', [[first.cx, g, first.cz]], true);

  // Out across the far side of the loop (away from the crossing): the end rides over it.
  const second = loop();
  if (second) {
    const dx = second.cx - second.crossX;
    const dz = second.cz - second.crossZ;
    const len = Math.hypot(dx, dz) || 1;
    const out: World = [second.cx + (dx / len) * (second.radius + 0.7), g, second.cz + (dz / len) * (second.radius + 0.7)];
    drag('through', [out]);
  }
  return log;
}
