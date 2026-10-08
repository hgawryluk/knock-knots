export interface KnotStep {
  title: string;
  hint: string;
}

export type KnotType = 'Stopper' | 'Loop' | 'Hitch' | 'Bend' | 'Binding';

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
  /** A pole lying along x that the knot is tied round (world units), shown as a camp rail. */
  rail?: Rail;
  /** A grey hand holding part of the rope while the knot is tied (world units). */
  hand?: HandPose;
}

/**
 * A still, open hand — a prop the rope rests on, like the rail, not an animated
 * hand. Fingers and thumb are chains of joint positions (each a run of capsules).
 */
export interface HandPose {
  palm: { center: Point3; size: Point3 };
  fingers: { joints: Point3[]; radius: number }[];
  /** Control point after which the hand is there (once the rope it holds has been formed). */
  appearsAt: number;
}

export interface Rail {
  y: number;
  z: number;
  radius: number;
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
