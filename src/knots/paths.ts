import type { KnotPath, Point3, Rail } from './types';

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
  knotFrom: 1,
  tailFrom: 14,
};


/**
 * Figure-eight knot on a hanging rope, in its familiar "8" shape: a loop below,
 * the end wraps behind the standing part above it, then comes down over the top
 * of the loop, through it, and out under its bottom — over, under, over, under.
 */
export const FIGURE_EIGHT_PATH: KnotPath = {
  points: place([
    [0.3, 3.4, 0], // anchor, above the frame
    [0.3, 2.4, 0],
    [0.28, 1.5, -0.02], // ← tracing starts here
    [0.15, 0.85, 0],
    [-0.15, 0.6, 0.02],
    [-0.48, 0.8, 0.05],
    [-0.5, 1.3, 0.1],
    [-0.15, 1.62, 0.15],
    [0.3, 1.7, 0.2], // over the standing part: the loop is made
    [0.68, 1.75, 0.1],
    [0.6, 2.05, -0.12],
    [0.3, 2.0, -0.22], // behind the standing part, above the loop
    [-0.15, 1.95, -0.1],
    [-0.2, 1.85, 0.25], // round to the front
    [-0.12, 1.3, 0.28], // down over the top of the loop…
    [-0.08, 0.95, -0.05], // …through it…
    [-0.05, 0.55, -0.22], // …and out under its bottom
    [-0.03, 0.0, -0.08],
    [0.0, -0.45, 0.0], // working end hangs down
  ]),
  traceFrom: 2,
  stepEnds: [8, 12, 18],
  knotFrom: 1,
  tailFrom: 17,
};

/**
 * Square (reef) knot by the bight method, closing a ring hung below it as if
 * round a bundle. The standing side is already folded into a bight lying
 * sideways (legs to the left, curve to the right). The end comes up from the
 * ring, under the bight's curve and over its lower leg, round behind both legs,
 * then back over the top leg and out under the curve beside itself. Each end's
 * two legs pass the other bight on the same side: that is what makes it a
 * square knot and not a granny.
 */
export const SQUARE_KNOT_PATH: KnotPath = {
  points: place([
    [-0.85, 3.4, 0], // anchor, above the frame
    [-0.85, 2.4, 0],
    [-0.82, 1.65, 0],
    [-0.72, 1.41, 0.1], // bight: top leg…
    [-0.4, 1.4, -0.1],
    [0.0, 1.4, 0],
    [0.3, 1.38, 0.1],
    [0.43, 1.2, 0.12], // …curve…
    [0.3, 1.02, 0.1],
    [0.0, 1.0, 0],
    [-0.4, 1.0, -0.1],
    [-0.72, 0.99, 0.1], // …lower leg
    [-0.85, 0.78, 0.02],
    [-0.75, 0.3, 0], // ring round the bundle
    [-0.4, -0.02, 0.03],
    [0.2, -0.02, 0.03],
    [0.58, 0.28, 0],
    [0.62, 0.7, -0.03], // ← tracing starts here
    [0.55, 1.05, -0.08],
    [0.3, 1.13, -0.12], // under the bight’s curve…
    [0.0, 1.13, 0], // …along inside the bight…
    [-0.3, 1.1, 0.06],
    [-0.4, 0.98, 0.12], // …and over its lower leg
    [-0.52, 0.84, 0.04],
    [-0.66, 0.94, -0.1],
    [-0.7, 1.2, -0.14], // round behind both legs
    [-0.66, 1.46, -0.1],
    [-0.52, 1.56, 0.04],
    [-0.4, 1.42, 0.12], // over the top leg…
    [-0.3, 1.3, 0.06],
    [0.0, 1.27, 0],
    [0.3, 1.27, -0.12], // …out under the curve, beside itself
    [0.55, 1.3, -0.08],
    [0.75, 1.1, -0.02],
    [0.78, 0.6, 0],
    [0.78, 0.1, 0], // working end hangs beside the ring
  ]),
  traceFrom: 17,
  stepEnds: [22, 27, 35],
  knotFrom: 2,
  tailFrom: 34,
  hold: [12, 17],
};

/**
 * Simple overhand noose: the rope comes down, hangs as a loop, and its end
 * comes back up and ties an overhand knot round the standing part, so pulling
 * the standing part slides it through the knot and closes the loop. The knot
 * is the overhand's shape turned upside down, with the standing part threaded
 * through its loop (over the top, under the bottom).
 */
export const OVERHAND_NOOSE_PATH: KnotPath = {
  points: place([
    [-0.3, 3.4, 0], // anchor, above the frame
    [-0.3, 2.5, 0.05],
    [-0.3, 1.85, 0.22],
    [-0.3, 1.53, 0.28], // standing part passes over the top of the knot's loop…
    [-0.3, 1.12, 0.02],
    [-0.3, 0.72, -0.16], // …and under its bottom
    [-0.3, 0.3, -0.05],
    [-0.22, -0.12, 0],
    [0.05, -0.3, 0], // ← tracing starts here, at the bottom of the noose
    [0.28, -0.1, 0],
    [0.3, 0.25, -0.02],
    [0.28, 0.95, -0.03],
    [0.1, 1.58, 0], // up, behind the standing part…
    [-0.38, 1.52, 0.05],
    [-0.52, 1.05, 0.1],
    [-0.22, 0.62, 0.14],
    [0.3, 0.84, 0.17], // …round its left side and over itself: the loop is made
    [0.68, 1.08, 0.08],
    [0.72, 1.44, -0.08],
    [0.42, 1.58, -0.18],
    [0.0, 1.22, -0.16], // round the back, inside the loop
    [-0.18, 1.12, 0.12],
    [-0.12, 1.6, 0.18], // out over the top of the loop
    [-0.08, 2.05, 0.08],
    [0.08, 2.3, 0.04],
    [0.32, 2.28, 0.02],
    [0.45, 2.08, 0], // working end flops over
  ]),
  traceFrom: 8,
  stepEnds: [16, 20, 26],
  knotFrom: 2,
  tailFrom: 24,
  hold: [6, 11],
};

/** Height of the camp rail's axis and its radius, in authored units (it runs along x through z = 0). */
const RAIL_Y = 0.93;
const RAIL_RADIUS = 0.1;
/** Rope centreline distance from the rail's axis when lying on it. */
const ON_RAIL = RAIL_RADIUS + 0.045;
const RAIL: Rail = { y: RAIL_Y * KNOT_SCALE + HANG_AT[1], z: HANG_AT[2], radius: RAIL_RADIUS * KNOT_SCALE };

/**
 * A point on the rope where it lies round the rail at `x`. `angle` runs from
 * the top (0) down the front (π/2), under (π) and up the back; `lift` raises
 * it off the rail where it crosses over other rope.
 */
const onRail = (angle: number, x: number, lift = 0): Point3 => [
  x,
  RAIL_Y + (ON_RAIL + lift) * Math.cos(angle),
  (ON_RAIL + lift) * Math.sin(angle),
];
const PI = Math.PI;

/**
 * Clove hitch on the camp rail: the rope comes down, goes once round the rail
 * (front, under, back, over), crosses diagonally down the front over the
 * standing part, goes round again beside the first turn, and tucks down under
 * the diagonal. Both turns go round the same way, and the standing part and
 * the end leave from under the diagonal in opposite directions.
 */
export const CLOVE_HITCH_PATH: KnotPath = {
  points: place([
    [-0.09, 3.4, 0], // anchor, above the frame
    [-0.09, 2.2, -0.02],
    [-0.09, RAIL_Y + 0.3, -0.05], // comes down just behind where the diagonal will cross
    onRail(PI / 4, -0.09), // ← tracing starts here, where the rope meets the rail
    onRail(PI / 2, -0.13),
    onRail((3 * PI) / 4, -0.18),
    onRail(PI, -0.22), // under…
    onRail((5 * PI) / 4, -0.22),
    onRail((3 * PI) / 2, -0.22), // …up the back…
    onRail((7 * PI) / 4, -0.22),
    onRail(2 * PI, -0.2, 0.03), // …and over the top: one turn
    onRail((9 * PI) / 4, -0.1, 0.14), // diagonal, over the standing part…
    onRail((5 * PI) / 2, 0, 0.14),
    onRail((11 * PI) / 4, 0.1, 0.14),
    onRail(3 * PI, 0.2, 0.03),
    onRail((13 * PI) / 4, 0.22),
    onRail((7 * PI) / 2, 0.22), // …round again…
    onRail((15 * PI) / 4, 0.22),
    onRail(4 * PI, 0.22),
    onRail((17 * PI) / 4, 0.18),
    onRail((9 * PI) / 2, 0.13),
    onRail((19 * PI) / 4, 0.09), // …and down under the diagonal
    [0.09, RAIL_Y - 0.25, -0.03],
    [0.09, 0.3, -0.02],
    [0.09, -0.1, 0], // working end hangs down
  ]),
  traceFrom: 3,
  stepEnds: [10, 18, 24],
  knotFrom: 2,
  tailFrom: 23,
  rail: RAIL,
};

/** Round turn & two half hitches: where the standing part hangs behind the rail, and how the hitches sit round it. */
const RT_STANDING: [number, number] = [0, -ON_RAIL];
const RT_AROUND = 0.095;
/**
 * A point on the end where it wraps round the standing part (which hangs
 * straight down behind the rail). `angle` runs from the right (0) round the
 * front (π/2), left (π) and back; `lift` holds it off where it crosses over rope.
 */
const aroundStanding = (angle: number, y: number, lift = 0): Point3 => [
  RT_STANDING[0] + (RT_AROUND + lift) * Math.cos(angle),
  y,
  RT_STANDING[1] + (RT_AROUND + lift) * Math.sin(angle),
];

/**
 * Round turn and two half hitches on the camp rail. The rope comes down behind
 * the rail and goes round it one and a half times (the round turn), coming up
 * the front. The end then makes two half hitches round the standing part above
 * the rail, both turning the same way — which together are a clove hitch round
 * the standing part: one turn, across the front over itself, a second turn, and
 * tucked under that crossing. (Same pattern as CLOVE_HITCH_PATH, stood upright.)
 */
export const ROUND_TURN_TWO_HALF_HITCHES_PATH: KnotPath = (() => {
  const hitchY = RAIL_Y + 0.55;
  /** Like onRail, but round the standing part: `along` runs up it. */
  const hitch = (angle: number, along: number, lift = 0): Point3 => aroundStanding(angle, hitchY + along, lift);
  const turn: Point3[] = [];
  for (let k = 0; k <= 12; k++) turn.push(onRail((3 * PI) / 2 - (k * PI) / 4, (k * 0.11) / 8));
  const hitches: Point3[] = [
    hitch(PI / 4, -0.09), // first half hitch: round the standing part…
    hitch(PI / 2, -0.13),
    hitch((3 * PI) / 4, -0.18),
    hitch(PI, -0.22),
    hitch((5 * PI) / 4, -0.22),
    hitch((3 * PI) / 2, -0.22),
    hitch((7 * PI) / 4, -0.22),
    hitch(2 * PI, -0.2, 0.03),
    hitch((9 * PI) / 4, -0.1, 0.14), // …and across the front over itself
    hitch((5 * PI) / 2, 0, 0.14),
    hitch((11 * PI) / 4, 0.1, 0.14), // second: round again…
    hitch(3 * PI, 0.2, 0.03),
    hitch((13 * PI) / 4, 0.22),
    hitch((7 * PI) / 2, 0.22),
    hitch((15 * PI) / 4, 0.22),
    hitch(4 * PI, 0.22),
    hitch((17 * PI) / 4, 0.18),
    hitch((9 * PI) / 2, 0.13),
    hitch((19 * PI) / 4, 0.09), // …and tucked under the crossing
  ];
  const points: Point3[] = [
    [0, 3.4, -ON_RAIL], // anchor, above the frame
    [0, 2.4, -ON_RAIL],
    [0, RAIL_Y + 0.85, -ON_RAIL],
    [0, RAIL_Y + 0.2, -ON_RAIL],
    ...turn, // ← tracing starts at turn[0]: down the back, under, up the front, over, down the back, under, up the front
    [0.165, RAIL_Y + 0.14, ON_RAIL],
    [0.28, hitchY - 0.1, -0.05], // up wide on the right…
    hitch(0, -0.09), // …and in round the side of the standing part, like the rope meeting the rail
    ...hitches,
    [-0.17, hitchY + 0.06, -0.19], // the end carries on round under the crossing…
    [-0.3, hitchY, -0.17],
    [-0.36, hitchY - 0.2, -0.12], // …and hangs off to the side
  ];
  const turnFrom = 4;
  const hitchesFrom = turnFrom + 13 + 3;
  return {
    points: place(points),
    traceFrom: turnFrom,
    stepEnds: [turnFrom + 12, hitchesFrom + 9, points.length - 1],
    knotFrom: 2,
    tailFrom: points.length - 2,
    rail: RAIL,
  };
})();
