export interface KnotStep {
  title: string;
  hint: string;
}

export type KnotType = 'Stopper' | 'Loop' | 'Hitch' | 'Bend' | 'Binding';

export type SectionId = 'basic' | 'climbing';

export interface KnotSection {
  id: SectionId;
  name: string;
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
