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
const OVERHAND_POINTS: Point3[] = [
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
];

export const OVERHAND_PATH: KnotPath = {
  points: place(OVERHAND_POINTS),
  traceFrom: 2,
  stepEnds: [7, 11, 15],
  knotFrom: 1,
  tailFrom: 14,
};

/** The camp tarp the knots are laid out on (world units): centre on the ground, size across and deep. */
export const TARP = { x: 0, z: 1.75, width: 2.2, depth: 2.4, top: 0.012 };
const FLAT_SCALE = 0.55;
/** Authored height that lands in the middle of the tarp. */
const FLAT_MIDDLE = 1.05;
/**
 * Lays an authored (hanging) knot down on the tarp: what was up runs away from
 * the camera across the tarp, and the authored depth — which strand is over
 * which — is kept, faintly, in the height (layOnGround turns it into real
 * crossings: rope on the tarp, rising only over other rope).
 */
const layFlat = (points: Point3[]): Point3[] =>
  points.map(([x, y, z]) => [TARP.x + x * FLAT_SCALE, TARP.top + 0.033 + z * 0.05, TARP.z - (y - FLAT_MIDDLE) * FLAT_SCALE]);

/** Trial: the overhand knot tied lying on the tarp instead of hanging (open with ?flat). */
export const OVERHAND_FLAT_PATH: KnotPath = {
  ...OVERHAND_PATH,
  points: layFlat(OVERHAND_POINTS),
  flat: { ground: TARP.top },
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
 * Square (reef) knot in two ropes, set up like a real one under tension: a red
 * rope pegged to the ground comes up and is already bent over into a hook (its
 * short end hangs down beside it); the gold rope hangs straight from above and
 * its end is taken down behind the top of the hook, down inside it and out over
 * its right leg, round behind both legs, then up over the left leg and out
 * behind the top of the hook, beside itself.
 *
 * The shape is the verified bight-method square knot turned a quarter turn
 * (depths unchanged, so every crossing keeps its over/under): the old bight is
 * the red hook, the working end's bight is the gold loop round it. Each rope's
 * two legs pass the other rope's bend on the same side — a square knot, not a granny.
 */
const SQUARE_CENTRE: [number, number] = [0.05, 1.25];
/** The peg's neck (just under its head, the peg leaning a little) and how far round it the red rope lies. */
const PEG_NECK: Point3 = [0.241, -0.57, 0];
const ROUND_PEG = 0.11;
/** A point of the red rope wound round the peg's neck: `turn` in degrees, rising a little as it goes round. */
const roundPeg = (turn: number, rise: number): Point3 => [
  PEG_NECK[0] + ROUND_PEG * Math.cos((turn * Math.PI) / 180),
  PEG_NECK[1] + rise,
  PEG_NECK[2] + ROUND_PEG * Math.sin((turn * Math.PI) / 180),
];
/** The bight-method knot's points (bight lying sideways) turned a quarter turn about its middle. */
const turnSquare = ([x, y, z]: Point3): Point3 => [SQUARE_CENTRE[0] - (y - 1.2), SQUARE_CENTRE[1] + (x + 0.13), z];
export const SQUARE_KNOT_PATH: KnotPath = {
  points: place([
    // Red rope: tied round the peg's neck, up its right leg, over the top of the hook, down its left leg.
    roundPeg(200, -0.06), // its end, tucked round the peg
    roundPeg(270, -0.045),
    roundPeg(360, -0.025),
    roundPeg(450, -0.005),
    roundPeg(540, 0.015),
    roundPeg(630, 0.035),
    [0.4, -0.42, 0.06], // then up from the peg, out to the side, clear of its head
    [0.29, -0.05, 0.01],
    [0.26, 0.4, 0.05],
    ...(
      [
        [-0.72, 0.99, 0.1],
        [-0.4, 1.0, -0.1],
        [0.0, 1.0, 0],
        [0.3, 1.02, 0.1],
        [0.43, 1.2, 0.12], // top of the hook
        [0.3, 1.38, 0.1],
        [0.0, 1.4, 0],
        [-0.4, 1.4, -0.1],
        [-0.72, 1.41, 0.1],
      ] as Point3[]
    ).map(turnSquare),
    [-0.16, 0.42, 0.05],
    [-0.17, 0.2, 0], // its short end hangs down
    // Never drawn: carries the curve round behind, well clear, to the gold rope.
    [-0.18, -0.05, -0.1],
    [-1.6, -0.1, -2],
    [-1.6, 3.5, -2],
    // Gold rope: straight down from above, then the traced end.
    [0.2, 3.4, 0], // anchor, above the frame
    [0.2, 2.6, 0],
    [0.2, 2.2, -0.03], // ← tracing starts here: the gold rope hangs straight
    ...(
      [
        [0.55, 1.05, -0.08],
        [0.3, 1.13, -0.12], // behind the top of the hook…
        [0.0, 1.13, 0], // …down inside it…
        [-0.3, 1.1, 0.06],
        [-0.4, 0.98, 0.12], // …and out over its right leg
        [-0.52, 0.84, 0.04],
        [-0.66, 0.94, -0.1],
        [-0.7, 1.2, -0.14], // round behind both legs
        [-0.66, 1.46, -0.1],
        [-0.52, 1.56, 0.04],
        [-0.4, 1.42, 0.12], // up over the left leg…
        [-0.3, 1.3, 0.06],
        [0.0, 1.27, 0],
        [0.3, 1.27, -0.12], // …out behind the top of the hook
        [0.55, 1.3, -0.08],
      ] as Point3[]
    ).map(turnSquare),
    [-0.07, 2.2, -0.04],
    [-0.08, 2.45, 0], // working end, up beside the standing part
  ]),
  traceFrom: 25,
  stepEnds: [30, 35, 42],
  knotFrom: 25,
  tailFrom: 41,
  bodies: [
    [8, 19],
    [25, 41],
  ],
  partner: { end: 19, start: 23, stake: place([[0.26, -0.66, 0]])[0] },
};

/**
 * Simple overhand noose: the rope comes down, hangs as a loop, and its end
 * comes back up and ties an overhand knot round the standing part, so pulling
 * the standing part slides it through the knot and closes the loop. The knot
 * is the overhand's shape turned upside down, with the straight standing part
 * threaded through its loop (the loop passes behind it at the top, in front at
 * the bottom).
 */
export const OVERHAND_NOOSE_PATH: KnotPath = {
  points: place([
    [-0.3, 3.4, 0], // anchor, above the frame
    [-0.3, 2.5, 0],
    [-0.3, 1.85, 0],
    [-0.3, 1.53, 0], // the standing part hangs straight: the knot's loop passes behind it at the top…
    [-0.3, 1.12, 0],
    [-0.3, 0.72, 0], // …and in front of it at the bottom
    [-0.3, 0.3, 0], // ← tracing starts here, from the straight rope
    [-0.22, -0.12, 0],
    [0.05, -0.3, 0], // bottom of the noose
    [0.28, -0.1, 0],
    [0.3, 0.25, -0.02],
    [0.28, 0.95, -0.03],
    [0.1, 1.58, -0.08], // up, behind the standing part…
    [-0.38, 1.52, -0.12],
    [-0.52, 1.05, 0.1],
    [-0.22, 0.62, 0.14],
    [0.3, 0.84, 0.17], // …round its left side and over itself: the loop is made
    [0.55, 1.1, 0.08],
    [0.58, 1.42, -0.08],
    [0.36, 1.56, -0.18],
    [0.0, 1.22, -0.16], // round the back, inside the loop
    [-0.18, 1.12, 0.12],
    [-0.12, 1.6, 0.18], // out over the top of the loop
    [-0.1, 1.95, 0.08],
    [-0.1, 2.2, 0.03], // working end: short and straight, up beside the standing part
  ]),
  traceFrom: 6,
  stepEnds: [16, 20, 24],
  knotFrom: 2,
  tailFrom: 23,
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
    [-0.09, RAIL_Y + 0.3, -0.05], // ← tracing starts here, just above the rail (comes down behind where the diagonal will cross)
    onRail(PI / 4, -0.09),
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
  traceFrom: 2,
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
