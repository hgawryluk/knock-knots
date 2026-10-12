export interface KnotStep {
  title: string;
  hint: string;
}

export type KnotType = 'Stopper' | 'Loop' | 'Hitch' | 'Bend' | 'Binding';
/** The kinds in the order the menu lists them. */
export const KNOT_TYPES: KnotType[] = ['Stopper', 'Loop', 'Hitch', 'Bend', 'Binding'];

export type SectionId = 'survival' | 'mountains';

export interface KnotSection {
  id: SectionId;
  name: string;
  /** One line for the menu card. */
  blurb: string;
}

export type Point3 = [number, number, number];

/**
 * The one correct way to tie a knot: the rope's path through the finished
 * (loosely dressed) knot, from the anchored standing end to the working end.
 * The demo draws the rope along it; you trace the same path with the mouse.
 */
export interface KnotPath {
  /** Control points in world units, standing end first. */
  points: Point3[];
  /** Control point where tracing starts — the rope above it is already in place. */
  traceFrom: number;
  /** For each step, the control point where that step ends. */
  stepEnds: number[];
  /** Control points where the knot itself begins (on the standing part) and ends (where the tail hangs free) — the part that pulls tight. */
  knotFrom: number;
  tailFrom: number;
  /** Control points of a stretch inside the knot that keeps its shape when pulled tight (e.g. a ring round a bundle). */
  hold?: [number, number];
  /** Knots in two ropes: each rope's knot body (control points), used instead of knotFrom..tailFrom. */
  bodies?: [number, number][];
  /**
   * A second rope, already in place (the learner ties the main rope round it):
   * control points 0..end. The main rope starts at control point `start`; the
   * points in between are never drawn, they just carry the curve from one rope
   * to the other well away from the knot. `stake` is where it is pegged to the ground.
   */
  partner?: { end: number; start: number; stake?: Point3 };
  /** A bar lying along x that the knot is tied round (world units): the camp rail, or the bottom of a carabiner. */
  rail?: Rail;
  /** The knot is tied lying on a tarp whose top is at this height (world units), rather than hanging. */
  flat?: { ground: number };
  /**
   * Tied the way climbers tie it on a carabiner: no free end — loops twisted in
   * the middle of the rope and clipped in through the gate. Instead of drawing the
   * rope out along the path, the whole rope moves through these poses (the last is
   * `points`, the finished knot) and you drag a marker on it.
   */
  clip?: Clip;
}

export interface Clip {
  /** Poses of the whole rope (control points; each is resampled evenly along the rope, so the counts may differ), from the start to the finished knot. */
  poses: Point3[][];
  /** When each pose is reached (0–1 through the tying). */
  times: number[];
  /** For each pose, the control point you hold and move. */
  handle: number[];
  /** Where each step ends (0–1 through the tying). */
  stepEnds: number[];
  /** How long the demo takes to tie it (seconds): slow enough to see each move. */
  seconds: number;
  /** The gate: unscrewed from…to, open from…to, closed again from…to, locked from…to (0–1 through the tying). */
  gate: { unscrew: [number, number]; open: [number, number]; close: [number, number]; lock: [number, number] };
}

export interface Rail {
  y: number;
  z: number;
  radius: number;
  /** The bar is the bottom of a carabiner hanging from a bolt (Mountains), not the camp rail. */
  carabiner?: boolean;
}

export interface KnotDefinition {
  id: string;
  name: string;
  type: KnotType;
  section: SectionId;
  summary: string;
  steps: KnotStep[];
  /** Missing while the knot's path hasn't been authored yet. */
  path?: KnotPath;
}
