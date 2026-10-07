import type { RopeSim } from '../rope/ropeSim';
import { createEndDrag, type Mouse, type World } from './drag';

/**
 * Dev-only: ties a clove hitch through the real mouse input path (picking,
 * surface-following drag, Shift for "under"), the way a person would from
 * the default camera. Returns a log line per move with the checker's verdict.
 * Run from the console: `__knots.mouseClove()`.
 */
export function mouseClove(
  sim: RopeSim,
  mouse: Mouse,
  status: () => string,
  /** Path along the bark that passes under the current crossing, or null if there is none. */
  tuckPath: () => World[] | null,
  stopAfter = '',
): string[] {
  const { drag, log } = createEndDrag(sim, mouse, status, stopAfter);

  // Over the top of the log at x≈0.4, then on past its far edge so the end wraps down the back.
  drag('over', [[0.4, 0.95, 0.1], [0.4, 1.0, -0.3], [0.4, 1.7, -0.5]]);
  // Shift: back to the front along the ground, beneath the log.
  drag('under', [[0.5, 0.06, -1.0], [0.6, 0.06, 0.0], [0.6, 0.06, 1.0]], true, 1200);
  // Up the front, then diagonally across the front face over the standing part, over the top at x≈0.05 and down the back.
  drag('cross over', [[0.6, 0.5, 0.42], [0.1, 0.75, 0.42], [0.05, 1.0, 0.0], [0.05, 1.7, -0.5]]);
  // Shift: under the log again to the front — that's the second turn.
  drag('second turn', [[0.05, 0.06, -1.0], [0.05, 0.06, 0.0], [0.0, 0.06, 1.0], [-0.1, 0.06, 1.8]], true, 1200);
  // Shift: press along the bark up the front face, under the X, and stop just past it on top.
  const path = tuckPath();
  if (path) drag('tuck', path, true);
  return log;
}
