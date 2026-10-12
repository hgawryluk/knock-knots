import * as THREE from 'three';
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
const FIGURE_EIGHT_POINTS: Point3[] = [
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
];

export const FIGURE_EIGHT_PATH: KnotPath = {
  points: place(FIGURE_EIGHT_POINTS),
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
/** The red rope's hook, and the gold end's loop round it. */
const SQUARE_HOOK: Point3[] = (
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
).map(turnSquare);
const SQUARE_LOOP: Point3[] = (
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
).map(turnSquare);

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
    ...SQUARE_HOOK,
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
    ...SQUARE_LOOP,
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
const OVERHAND_NOOSE_POINTS: Point3[] = [
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
];

export const OVERHAND_NOOSE_PATH: KnotPath = {
  points: place(OVERHAND_NOOSE_POINTS),
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

// ---- On a carabiner (Mountains) -----------------------------------------------------------
// The carabiner hangs from a bolt in the rock; its straight bottom bar runs along x and the
// knot is tied round it, like a rail (world units throughout). Both knots are tied the way
// climbers tie them — loops twisted in the middle of the rope and clipped in through the
// gate (see Clip) — with both strands running down out of the frame.

/** Where the carabiner's bottom bar runs (its axis), and its radius: a touch thicker than the rope. */
export const CARABINER = { x: 0, y: 0.98, z: 1.9, barRadius: 0.034 };
/**
 * Centreline of the carabiner (relative to the bar's axis: x across, y up),
 * anticlockwise from the bottom left. Pear-shaped (HMS): a wide, straight bottom
 * bar for the knot, narrowing to the top where it hangs.
 */
export const CARABINER_OUTLINE: [number, number][] = [
  [-0.14, 0],
  [-0.07, 0],
  [0, 0],
  [0.07, 0],
  [0.14, 0], // straight bottom bar, wide enough for two turns and a diagonal: the knot sits here
  [0.195, 0.026],
  [0.215, 0.09], // the gate's nose (keylock), just above the bar's corner…
  [0.166, 0.251], // …the gate, straight…
  [0.112, 0.43],
  [0.066, 0.579],
  [0.04, 0.665], // …up to its hinge, under the narrow top that hangs from the bolt
  [-0.035, 0.69],
  [-0.115, 0.655],
  [-0.165, 0.53], // spine
  [-0.2, 0.32],
  [-0.215, 0.09],
  [-0.195, 0.026],
];
/**
 * The gate, as on a real pear-shaped HMS: hinged at the top (outline point
 * `hinge`, by the narrow end it hangs from), closing on a keylock nose at the
 * bottom right (`nose`), just above the corner of the wide bottom bar. It opens
 * inward, its lower end swinging up and in, so the gap opens right by the bar.
 */
export const CARABINER_GATE = { nose: 6, hinge: 10 };
/** How far the gate swings about its hinge when fully open (radians, about z: negative swings it in). */
export const CARABINER_GATE_SWING = -0.32;

/** The carabiner's centreline as a closed curve, and where along it (0–1 of its length) each outline point lies. */
const FRAME = new THREE.CatmullRomCurve3(CARABINER_OUTLINE.map(([x, y]) => new THREE.Vector3(x, y, 0)), true, 'centripetal');
const FRAME_LENGTH = FRAME.getLength();
const FRAME_LENGTHS = FRAME.getLengths(CARABINER_OUTLINE.length * 100);
const frameAt = (index: number): number => FRAME_LENGTHS[Math.round(index * 100)] / FRAME_LENGTH;
/** The middle of the bottom bar, where knots are authored. */
const BAR_MIDDLE = frameAt(2);

/**
 * Rope round the bar's middle moved to `along` (0–1 round the outline) on the
 * carabiner, bent to follow it, `out` further out from it, opened up `grow`
 * times round it and drawn together `spread` times along it: along the bar
 * becomes along the outline, up becomes into the carabiner, front stays front.
 * A loop round the bar stays round the metal wherever it is put — on the gate,
 * round the corner — so sliding it there never passes rope through metal.
 */
function onFrame(points: Point3[], along: number, out = 0, grow = 1, spread = 1): Point3[] {
  return points.map(([x, y, z]): Point3 => {
    const across = (x - CARABINER.x) * spread;
    const up = (y - CARABINER.y) * grow - out;
    z = CARABINER.z + (z - CARABINER.z) * grow;
    const u = (((along + across / FRAME_LENGTH) % 1) + 1) % 1;
    const p = FRAME.getPointAt(u);
    const t = FRAME.getTangentAt(u);
    // Into the carabiner: the tangent turned a quarter turn (up, along the bottom bar).
    return [CARABINER.x + p.x - t.y * up, CARABINER.y + p.y + t.x * up, z];
  });
}
/** Rope centreline distance from the bar's axis when lying on it. */
const ON_BAR = CARABINER.barRadius + 0.033 + 0.006;
const BAR: Rail = { y: CARABINER.y, z: CARABINER.z, radius: CARABINER.barRadius, carabiner: true };

/**
 * A point on the rope where it lies round the bar at `x`. `angle` runs from the
 * top (0) down the front (π/2), under (π) and up the back — the same as onRail;
 * the rope here goes round the other way (front, over the top, down the back), so angles fall.
 */
const onBar = (angle: number, x: number, lift = 0): Point3 => [
  CARABINER.x + x,
  CARABINER.y + (ON_BAR + lift) * Math.cos(angle),
  CARABINER.z + (ON_BAR + lift) * Math.sin(angle),
];


/** How far each of a loop's 8 points sits in front of (+) or behind (−) its plane: the crossing's two passes apart. */
const CROSSING_DEPTH = [-0.02, -0.05, -0.02, 0, 0.015, 0.035, 0.05, 0.03];
/** A point given relative to the carabiner's bar (x along it, y up, z toward the front). */
const rel = ([x, y, z]: Point3): Point3 => [CARABINER.x + x, CARABINER.y + y, CARABINER.z + z];

/**
 * Clove hitch on a carabiner — the climber's tie-in to an anchor — tied the way
 * climbers tie it, in the middle of the rope: hold the rope below the
 * carabiner, twist two identical loops side by side, slide the right loop behind
 * the left, open the gate and clip both loops in; close and lock the gate. Both
 * strands hang down.
 *
 * The finished knot is the clove pattern round the bar: a turn, a diagonal over
 * the standing part, a second turn the same way round beside the first, and the
 * other strand out from under the diagonal (it then hangs down the back).
 */
export const CLOVE_HITCH_CARABINER_PATH: KnotPath = (() => {
  // Every pose has the same points, each always the same bit of rope: three on the strand
  // to the climber, 22 for the two loops and the rope between them, two going down.
  const climber: Point3[] = [
    [-0.05, -2.4, 0.42],
    [-0.1, -1.0, 0.25],
    [-0.16, -0.4, 0.21],
  ];
  const down: Point3[] = [
    [0.1, -1.6, 0.1],
    [0.04, -2.4, -0.15],
  ];
  // The rope held in a low arch below the carabiner.
  const held: Point3[] = [
    ...climber,
    ...([
      [-0.15, -0.32], [-0.14, -0.26], [-0.12, -0.21], [-0.09, -0.18], [-0.06, -0.165], [-0.03, -0.16], [0.0, -0.158], [0.03, -0.16],
      [0.06, -0.165], [0.09, -0.18], [0.12, -0.21], [0.14, -0.26], [0.15, -0.32], [0.16, -0.4], [0.16, -0.48], [0.155, -0.56],
      [0.15, -0.64], [0.145, -0.72], [0.14, -0.8], [0.135, -0.88], [0.13, -0.96], [0.125, -1.04],
    ] as [number, number][]).map(([x, y], i): Point3 => [x, y, 0.22 + (CROSSING_DEPTH[i] ?? 0)]),
    ...down,
  ];
  /**
   * A loop (8 points): up from below left, across behind itself, round, and out across the front heading down right; in the plane z, `dx` to the right.
   * The two passes where it crosses itself are already apart, front and back, in the rope before it
   * is twisted (CROSSING_DEPTH), so they never meet as the loop forms.
   */
  const loopAt = (dx: number, z: number): Point3[] =>
    (
      [
        [-0.13, -0.27],
        [-0.09, -0.19],
        [-0.02, -0.115],
        [-0.09, -0.04], // its top
        [-0.165, -0.115],
        [-0.135, -0.17],
        [-0.09, -0.19],
        [-0.04, -0.23],
      ] as [number, number][]
    ).map(([x, y], i): Point3 => [x + dx, y, z + CROSSING_DEPTH[i]]);
  /** A loop shrunk to `size` about its middle and moved by (dx, dy): how it looks as it is first twisted in. */
  const smallLoop = (dx: number, dy: number, z: number, size: number): Point3[] =>
    loopAt(0, z).map(([x, y, zz]): Point3 => [(x + 0.09) * size - 0.09 + dx, (y + 0.115) * size - 0.115 + dy, zz]);
  const loopStarting: Point3[] = [
    ...climber,
    ...smallLoop(0.0, -0.1, 0.22, 0.85),
    [0.0, -0.31, 0.23], [0.05, -0.29, 0.22], [0.1, -0.27, 0.22], [0.13, -0.28, 0.21], [0.15, -0.33, 0.2], [0.155, -0.4, 0.2], [0.16, -0.47, 0.2],
    [0.155, -0.55, 0.2], [0.15, -0.63, 0.2], [0.145, -0.72, 0.2], [0.14, -0.8, 0.2], [0.135, -0.88, 0.19], [0.13, -0.96, 0.18], [0.125, -1.04, 0.17],
    ...down,
  ];
  const oneLoop: Point3[] = [
    ...climber,
    ...loopAt(0, 0.22),
    // The rope on from the loop already runs where it will lead to the second loop.
    [-0.01, -0.27, 0.25], [0.0, -0.34, 0.245], [0.005, -0.43, 0.24], [0.02, -0.53, 0.235], [0.07, -0.62, 0.225],
    ...([
      [0.12, -0.66], [0.17, -0.7], [0.21, -0.76], [0.23, -0.84], [0.24, -0.92], [0.24, -1.0], [0.235, -1.08], [0.23, -1.16], [0.22, -1.24],
    ] as [number, number][]).map(([x, y], i): Point3 => [x, y, 0.21 + (CROSSING_DEPTH[i] ?? 0)]),
    ...down,
  ];
  // The strand swung out to the right and up over itself in an open hook…
  const secondSwung: Point3[] = [
    ...climber,
    ...loopAt(0, 0.22),
    [-0.01, -0.27, 0.25], [0.0, -0.34, 0.245], [0.005, -0.43, 0.24], [0.02, -0.53, 0.235], [0.07, -0.62, 0.225],
    [0.12, -0.66, 0.2], [0.17, -0.67, 0.17], [0.24, -0.62, 0.22], [0.26, -0.52, 0.22], [0.22, -0.44, 0.235], [0.16, -0.42, 0.255], [0.11, -0.45, 0.27], [0.12, -0.54, 0.27],
    [0.14, -0.65, 0.27],
    ...down,
  ];
  // …and closed into a second loop, down across the front of where it started.
  const secondStarting: Point3[] = [
    ...climber,
    ...loopAt(0, 0.22),
    [-0.01, -0.27, 0.25], [0.0, -0.34, 0.245], [0.005, -0.43, 0.24], [0.02, -0.53, 0.235], [0.07, -0.62, 0.225],
    ...smallLoop(0.25, -0.36, 0.22, 0.85),
    [0.2, -0.75, 0.2],
    ...down,
  ];
  const twoLoops: Point3[] = [
    ...climber,
    ...loopAt(0, 0.22),
    [-0.01, -0.27, 0.25], [0.0, -0.31, 0.24], [0.04, -0.34, 0.23], [0.08, -0.33, 0.22], [0.1, -0.3, 0.21],
    ...loopAt(0.23, 0.22),
    [0.16, -0.4, 0.2],
    ...down,
  ];
  // The right loop taken back behind the left one's plane…
  const secondBack: Point3[] = [
    ...climber,
    ...loopAt(0, 0.22),
    [-0.01, -0.27, 0.25], [0.0, -0.31, 0.22], [0.04, -0.34, 0.17], [0.08, -0.33, 0.12], [0.1, -0.3, 0.08],
    ...loopAt(0.23, 0.07),
    [0.19, -0.4, 0.06],
    ...down,
  ];
  // …and slid across behind it: a stack of two. Between them the rope runs down in
  // front of the strand leaving the back loop, then left behind the front loop's lower strand.
  const stackRegion: Point3[] = [
    ...loopAt(0, 0.27),
    [0.03, -0.3, 0.27],
    [0.04, -0.37, 0.22],
    [-0.03, -0.43, 0.2],
    [-0.11, -0.4, 0.13],
    [-0.16, -0.33, 0.07],
    ...loopAt(0, 0.07),
    [-0.03, -0.4, 0.05],
  ];
  const stacked: Point3[] = [...climber, ...stackRegion, [0.03, -1.0, 0.05], [0.04, -2.4, -0.15]];
  /**
   * The stack turned `angle` round (a quarter turn faces it along the bar, the left
   * loop to the left), its loops opened up by `grow` and spread apart by `spread`,
   * centred at `at`.
   */
  const turned = (at: Point3, angle: number, grow: number, spread = 1): Point3[] =>
    stackRegion.map(([x, y, z]): Point3 => {
      const dx = (x + 0.09) * grow;
      const dy = (y + 0.115) * grow;
      const dz = (z - 0.17) * spread;
      return [at[0] + dx * Math.cos(angle) - dz * Math.sin(angle), at[1] + dy, at[2] + dx * Math.sin(angle) + dz * Math.cos(angle)];
    });
  const below = (to: Point3): Point3[] => [to, [0.04, -2.4, -0.15]];
  /** The strands into and out of the stack, kept clear of it: up from the climber to its first loop, and down from its last. */
  const leads = (at: Point3, angle: number): [Point3[], Point3[]] => [
    [[-0.05, -2.4, 0.42], [-0.1, -1.0, 0.25], [at[0] - 0.1 * Math.sin(angle) - 0.04 * Math.cos(angle), at[1] - 0.55, at[2] + 0.1 * Math.cos(angle)]],
    below([at[0] + 0.08 * Math.sin(angle) - 0.03 * Math.cos(angle), at[1] - 0.75, at[2] - 0.07 * Math.cos(angle)]),
  ];
  const around = (at: Point3, angle: number, grow: number, spread = 1): Point3[] => {
    const [into, out] = leads(at, angle);
    return [...into, ...turned(at, angle, grow, spread), ...out];
  };
  // The finished knot: the two loops drawn down onto the bar, spread a little along it.
  const tied = around([0, 0, 0], PI / 2, 1.0, 0.85);
  // The stack, in the shape it will have on the bar but drawn close together, carried to the
  // gate's nose: beside it outside, then — the sleeve unscrewed, the gate pressed in — in through
  // the gap just above the nose and down onto the corner of the bar; the gate shuts above it and
  // the loops slide along the bar into place. (Their rope follows the carabiner the whole way.)
  const tiedAt = tied.map(rel);
  // (The strands into and out of the stack hang straight down from it wherever it is.)
  const carried = (along: number, out: number, grow: number, spread: number): Point3[] => {
    const stack = onFrame(tiedAt.slice(3, 25), along, out, grow, spread);
    const [ax, ay, az] = stack[0];
    const [bx, by, bz] = stack[stack.length - 1];
    return [...tiedAt.slice(0, 2), [ax - 0.02, ay - 0.3, az + 0.04], ...stack, [bx + 0.02, by - 0.35, bz - 0.03], tiedAt[26]];
  };
  /**
   * The stack just as it was made — two loops, one behind the other — carried whole, its loops'
   * holes turned to face along the carabiner at `along` (0–1 round the outline), `out` beyond it;
   * the strands into and out of it hanging straight down. Turned, not mirrored, so nothing
   * passes through anything on the way.
   */
  const stackAt = (along: number, out: number, grow: number, shift: Point3 = [0, 0, 0]): Point3[] => {
    const f = FRAME.getPointAt(along);
    const t = FRAME.getTangentAt(along);
    // Into the carabiner, in its plane.
    const nx = -t.y;
    const ny = t.x;
    const cx = CARABINER.x + f.x - nx * out;
    const cy = CARABINER.y + f.y - ny * out;
    const stack = stackRegion.map(([x, y, z]): Point3 => {
      const dx = (x + 0.09) * grow;
      const dy = (y + 0.115) * grow;
      const dz = z - 0.17;
      // Up the stack → into the carabiner, its front loop → back along the outline, across → front.
      return [cx + nx * dy - t.x * dz + shift[0], cy + ny * dy - t.y * dz + shift[1], CARABINER.z + dx + shift[2]];
    });
    const [ax, ay, az] = stack[0];
    const [bx, by, bz] = stack[stack.length - 1];
    return [rel([-0.05, -2.4, 0.42]), rel([-0.1, -1.0, 0.25]), [ax - 0.02, ay - 0.3, az + 0.04], ...stack, [bx + 0.02, by - 0.35, bz - 0.03], rel([0.04, -2.4, -0.15])];
  };
  const atGap = frameAt(6.8);
  const atCorner = frameAt(3.8);
  const poses = [
    ...[held, loopStarting, oneLoop, secondSwung, secondStarting, twoLoops, secondBack, stacked].map((pose) => pose.map(rel)),
    stackAt(atGap, 0.3, 1.7, [0.05, -0.15, 0.3]), // brought up in front of the carabiner, the loops held open…
    stackAt(atGap, 0.3, 1.7), // …beside the gate, by the nose
    stackAt(atGap, -0.03, 1.65), // in through the gap
    stackAt(atCorner, -0.02, 1.6), // down onto the corner of the bar
    carried(atCorner + (BAR_MIDDLE - atCorner) / 3, 0, 1, 0.8), // drawing into the clove as it slides along
    carried(atCorner + ((BAR_MIDDLE - atCorner) * 2) / 3, 0, 1, 0.85),
    tiedAt,
  ];
  return {
    points: poses[poses.length - 1],
    traceFrom: 0,
    stepEnds: [],
    knotFrom: 2,
    tailFrom: tied.length - 3,
    rail: BAR,
    clip: {
      poses,
      // You hold the first loop, then the second (from its first loop on), then the stack.
      // Making the loops gets as long as clipping them in, so each move can be followed.
      times: [0, 0.1, 0.22, 0.27, 0.33, 0.42, 0.5, 0.58, 0.64, 0.69, 0.76, 0.83, 0.9, 0.95, 1],
      handle: [6, 6, 6, 19, 19, 19, 19, 19, 6, 6, 6, 6, 6, 6, 6],
      stepEnds: [0.22, 0.42, 0.58, 1],
      gate: { unscrew: [0.69, 0.71], open: [0.71, 0.74], close: [0.84, 0.87], lock: [0.87, 0.9] },
      seconds: 12,
    },
  };
})();

/**
 * Munter hitch (Italian hitch, HMS — "half clove hitch belay"), tied the way
 * climbers tie it: the rope is clipped in — the strand to the climber comes up
 * behind the carabiner (along the rock), over the bar, and hangs down in front.
 * You twist a loop in the hanging strand, bring it to the gate, open the gate and
 * clip the loop in so it drops over the bar beside the first pass; close and lock
 * the gate. Both strands hang down; pulling the free (front) strand runs the rope
 * round the carabiner and round itself with plenty of friction.
 *
 * The finished knot: the rope crosses the bar twice the same way (back over to
 * the front), and between the two passes the loop's lower side wraps the free
 * strand just below the carabiner — the collar.
 */
export const MUNTER_HITCH_PATH: KnotPath = (() => {
  const { y, z } = CARABINER;
  // The strand to the climber: up behind the carabiner and over the bar (never moves).
  const load: Point3[] = [
    [-0.09, y - 2.4, z - 0.13],
    [-0.08, y - 1.0, z - 0.115],
    [-0.07, y - 0.22, z - 0.085],
    onBar(-PI / 2 - 0.45, -0.065),
    onBar(-PI / 2, -0.062),
    onBar(-PI / 4, -0.06),
    onBar(0, -0.058),
    onBar(PI / 4, -0.055),
    onBar(PI / 2, -0.052),
    onBar(PI / 2 + 0.25, -0.05),
  ];
  // The rest — the free strand that the loop is made in — in each pose (14 points, then 2 far below).
  const hanging: Point3[] = [
    ...Array.from({ length: 14 }, (_, i): Point3 => [-0.05, y - 0.05 - 0.075 * i, z + 0.1 + 0.004 * i]),
    [-0.05, y - 1.6, z + 0.25],
    [-0.05, y - 2.6, z + 0.38],
  ];
  const below: Point3[] = [
    [0.045, y - 1.2, z + 0.22],
    [0.05, y - 2.4, z + 0.42],
  ];
  // A small loop twisted in the strand, below the carabiner…
  const loopStarted: Point3[] = [
    [-0.05, y - 0.05, z + 0.1],
    [-0.048, y - 0.14, z + 0.105],
    [-0.04, y - 0.23, z + 0.13],
    [0.0, y - 0.3, z + 0.18],
    [0.06, y - 0.31, z + 0.185],
    [0.09, y - 0.26, z + 0.15],
    [0.08, y - 0.2, z + 0.13],
    [0.06, y - 0.19, z + 0.115],
    [0.042, y - 0.24, z + 0.09],
    [0.04, y - 0.32, z + 0.078],
    [0.035, y - 0.4, z + 0.085],
    [0.04, y - 0.5, z + 0.1],
    [0.045, y - 0.6, z + 0.105],
    [0.045, y - 0.72, z + 0.11],
    ...below,
  ];
  // …grown: across in front to the right, up, over and down behind where it started.
  const loopMade: Point3[] = [
    [-0.05, y - 0.05, z + 0.1],
    [-0.045, y - 0.15, z + 0.11],
    [-0.02, y - 0.28, z + 0.17],
    [0.06, y - 0.33, z + 0.185],
    [0.14, y - 0.29, z + 0.16],
    [0.17, y - 0.2, z + 0.14],
    [0.13, y - 0.11, z + 0.13], // the top of the loop
    [0.075, y - 0.11, z + 0.12],
    [0.04, y - 0.17, z + 0.1],
    [0.035, y - 0.25, z + 0.08],
    [0.04, y - 0.33, z + 0.072],
    [0.04, y - 0.42, z + 0.085],
    [0.045, y - 0.52, z + 0.1],
    [0.045, y - 0.64, z + 0.11],
    ...below,
  ];
  const tied: Point3[] = [
    [-0.05, y - 0.05, z + 0.1],
    [-0.025, y - 0.11, z + 0.145],
    [0.04, y - 0.145, z + 0.165], // the collar, in front of the free strand…
    [0.1, y - 0.165, z + 0.12],
    [0.135, y - 0.155, z + 0.03],
    [0.11, y - 0.11, z - 0.05], // …round under the carabiner to the back…
    onBar(-PI / 2 - 0.8, 0.075, 0.01),
    onBar(-PI / 2 - 0.35, 0.055),
    onBar(-PI / 4, 0.054),
    onBar(0, 0.052), // …over the bar a second time…
    onBar(PI / 4, 0.048),
    onBar(PI / 2, 0.045),
    onBar(PI / 2 + 0.55, 0.045),
    [0.04, y - 0.32, z + 0.09], // …and down the front, behind the collar: the free strand
    ...below,
  ];
  // The loop, in the shape it will have on the bar, brought up to the gate's nose (bottom right):
  // beside it outside, then — the sleeve unscrewed, the gate pressed in — in through the gap just
  // above the nose and down onto the corner of the bar; the gate shuts above it, and the loop
  // slides along the bar into place beside the first pass. (Its rope follows the carabiner the
  // whole way. Its lower side — the collar, where it will cross the free strand — stays below
  // the carabiner, as it is in the finished knot; only its top goes to the gate. The free strand
  // below it always hangs straight down.)
  const collar = tied.slice(1, 4);
  const loopRegion = tied.slice(4, 13);
  const atGap = frameAt(6.45) - 0.05 / FRAME_LENGTH;
  const atCorner = frameAt(4.0) - 0.05 / FRAME_LENGTH;
  const carried = (along: number, out: number, grow: number, shift: Point3 = [0, 0, 0]): Point3[] => {
    const loop = onFrame(loopRegion, along, out, grow).map(([x, y, z]): Point3 => [x + shift[0], y + shift[1], z + shift[2]]);
    const [x, y, z] = loop[loop.length - 1];
    return [tied[0], ...collar, ...loop, [x, y - 0.28, z], ...below];
  };
  const sliding = [1, 2, 3].map((k) => carried(atCorner + ((BAR_MIDDLE - atCorner) * k) / 4, 0, 1));
  const poses = [
    hanging,
    loopStarted,
    loopMade,
    carried(atGap, 0.15, 1.1), // up beside the gate, by the nose
    carried(atGap, 0, 1.05), // in through the gap
    carried(atCorner, 0, 1), // down onto the corner of the bar
    ...sliding,
    tied,
  ].map((rest) => [...load, ...rest]);
  const loop = (i: number): number => load.length + i;
  return {
    points: poses[poses.length - 1],
    traceFrom: 0,
    stepEnds: [],
    knotFrom: 2,
    tailFrom: loop(13),
    rail: BAR,
    clip: {
      poses,
      times: [0, 0.12, 0.26, 0.4, 0.55, 0.65, 0.75, 0.83, 0.91, 1],
      handle: [loop(6), loop(6), loop(6), loop(9), loop(9), loop(9), loop(9), loop(9), loop(9), loop(9)],
      stepEnds: [0.26, 0.4, 1],
      gate: { unscrew: [0.4, 0.44], open: [0.44, 0.5], close: [0.66, 0.71], lock: [0.71, 0.76] },
      seconds: 10,
    },
  };
})();

// ---- Tied lying on the camp tarp ----------------------------------------------------------
// The same verified knots laid down on the tarp (see layFlat): rope rests on the
// canvas and only rises where it passes over other rope, so nothing hangs in mid-air.

const ON_TARP = { ground: TARP.top };

export const FIGURE_EIGHT_FLAT_PATH: KnotPath = { ...FIGURE_EIGHT_PATH, points: layFlat(FIGURE_EIGHT_POINTS), flat: ON_TARP };

export const OVERHAND_NOOSE_FLAT_PATH: KnotPath = { ...OVERHAND_NOOSE_PATH, points: layFlat(OVERHAND_NOOSE_POINTS), flat: ON_TARP };

/** On the tarp the red rope needs no peg: it comes in straight from the near edge and lies in a hook. */
export const SQUARE_KNOT_FLAT_PATH: KnotPath = {
  points: layFlat([
    [0.26, -0.95, 0], // red rope, in from the near edge of the tarp…
    [0.26, -0.45, 0],
    [0.26, 0.4, 0.05],
    ...SQUARE_HOOK, // …laid in a hook
    [-0.16, 0.42, 0.05],
    [-0.17, 0.2, 0], // its short end
    // Never drawn: carries the curve round, well clear, to the gold rope.
    [-0.18, -0.05, -0.1],
    [-1.6, -0.1, -2],
    [-1.6, 3.5, -2],
    // Gold rope: straight in from the far side, then the traced end.
    [0.2, 3.4, 0],
    [0.2, 2.6, 0],
    [0.2, 2.2, -0.03], // ← tracing starts here
    ...SQUARE_LOOP,
    [-0.07, 2.2, -0.04],
    [-0.08, 2.45, 0], // working end, beside the gold rope
  ]),
  traceFrom: 19,
  stepEnds: [24, 29, 36],
  knotFrom: 19,
  tailFrom: 35,
  bodies: [
    [2, 13],
    [19, 35],
  ],
  partner: { end: 13, start: 17 },
  flat: ON_TARP,
};
