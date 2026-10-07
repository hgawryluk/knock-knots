import type { KnotPath, Point3 } from './types';

/**
 * Hanging knots are authored around a local origin and placed in front of the
 * log, at eye level. x = across, y = up, z = toward the default camera (so
 * larger z is "over" when seen from the front).
 */
const HANG_AT: Point3 = [0, 0.55, 1.9];
/** Authored shapes are scaled down to this size in the scene. */
const KNOT_SCALE = 0.75;
const place = (points: Point3[]): Point3[] =>
  points.map(([x, y, z]) => [x * KNOT_SCALE + HANG_AT[0], y * KNOT_SCALE + HANG_AT[1], z * KNOT_SCALE + HANG_AT[2]]);

/**
 * Overhand knot on a hanging rope: the end comes down, swings left into a loop,
 * crosses over the standing part, goes round behind it and comes out through
 * the loop over its lower side — over, under, over.
 */
export const OVERHAND_PATH: KnotPath = {
  points: place([
    [0.3, 3.4, 0], // anchor, above the frame
    [0.3, 2.0, 0],
    [0.28, 1.25, -0.03], // ← tracing starts here
    [0.1, 0.62, 0],
    [-0.38, 0.68, 0.05],
    [-0.52, 1.15, 0.1],
    [-0.22, 1.58, 0.14],
    [0.3, 1.36, 0.17], // over the standing part: the loop is made
    [0.68, 1.12, 0.08],
    [0.72, 0.76, -0.08],
    [0.42, 0.62, -0.18],
    [0.0, 0.98, -0.16], // behind the standing part, inside the loop
    [-0.18, 1.08, 0.12],
    [-0.12, 0.6, 0.18], // out over the lower side of the loop
    [-0.08, 0.1, 0.08],
    [-0.05, -0.4, 0.0], // working end hangs down
  ]),
  traceFrom: 2,
  stepEnds: [7, 11, 15],
  body: [2, 14],
};
