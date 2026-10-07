import { ropeCrossings } from '../knots/freeKnot';
import { sampleAroundLog, surfaceCrossings } from '../knots/logAnalysis';
import type { RopeSim } from '../rope/ropeSim';
import type { Log } from '../scene/log';
import type { Drag, World } from './drag';

export interface ScriptEnv {
  sim: RopeSim;
  log: Log;
  ropeRadius: number;
}

/**
 * A scripted tie, done through the real mouse controls from the level's default
 * view. Later moves aim at the rope as it actually lies, like a person would.
 */
export interface DemoScript {
  /** For each knot step, the label of the drag where that step begins. */
  stepStarts: string[];
  run: (drag: Drag, env: ScriptEnv) => void;
}

/** Overhand on the grass, from the start pose: standing part along z≈3, straight tail toward the camera. */
const OVERHAND_SCRIPT: DemoScript = {
  stepStarts: ['loop', 'under'],
  run(drag, { sim }) {
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
      const reach = second.radius + 0.7;
      drag('through', [[second.cx + (dx / len) * reach, g, second.cz + (dz / len) * reach]]);
    }
  },
};

/** Clove hitch around the log, from the log start pose. */
const CLOVE_SCRIPT: DemoScript = {
  stepStarts: ['over', 'under', 'second turn', 'tuck'],
  run(drag, { sim, log, ropeRadius }) {
    // Over the top of the log at x≈0.4, then on past its far edge so the end wraps down the back.
    drag('over', [[0.4, 0.95, 0.1], [0.4, 1.0, -0.3], [0.4, 1.7, -0.5]]);
    // Shift: back to the front along the ground, beneath the log.
    drag('under', [[0.5, 0.06, -1.0], [0.6, 0.06, 0.0], [0.6, 0.06, 1.0]], true, 1200);
    // Up the front, diagonally across the front face over the standing part, over the top at x≈0.05 and down the back.
    drag('cross over', [[0.6, 0.5, 0.42], [0.1, 0.75, 0.42], [0.05, 1.0, 0.0], [0.05, 1.7, -0.5]]);
    // Shift: under the log again to the front — that's the second turn.
    drag('second turn', [[0.05, 0.06, -1.0], [0.05, 0.06, 0.0], [0.0, 0.06, 1.0], [-0.1, 0.06, 1.8]], true, 1200);

    // Shift: slide the end along the standing part, one rope width to the side it hangs on,
    // pressed to the bark, under the X and a little past it.
    const samples = sampleAroundLog(sim.positions, sim.count, log, ropeRadius);
    const crossing = surfaceCrossings(samples).find((c) => c.over === c.b);
    if (!crossing) return;
    const p = sim.positions;
    const side = Math.sign(p[(sim.count - 1) * 3] - p[crossing.a * 3]) || 1;
    const path: World[] = [];
    for (let i = crossing.a - 12; i <= crossing.a + 8; i += 4) {
      const x = p[i * 3] + side * ropeRadius * 2.2;
      const s = log.sectionAt(x);
      const angle = Math.atan2((p[i * 3 + 2] - s.cz) / s.rz, (p[i * 3 + 1] - s.cy) / s.ry);
      path.push([x, s.cy + Math.cos(angle) * (s.ry + ropeRadius), s.cz + Math.sin(angle) * (s.rz + ropeRadius)]);
    }
    drag('tuck', path, true);
  },
};

/** Demos by knot id; knots without one go straight to "try it yourself". */
export const DEMO_SCRIPTS: Record<string, DemoScript> = {
  overhand: OVERHAND_SCRIPT,
  'clove-hitch': CLOVE_SCRIPT,
};
