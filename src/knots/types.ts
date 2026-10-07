export interface KnotStep {
  title: string;
  hint: string;
}

export type KnotType = 'Stopper' | 'Loop' | 'Hitch';

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
  /** Control points spanning the knot itself, which gets pulled tight at the end. */
  body: [number, number];
}

export interface KnotDefinition {
  id: string;
  name: string;
  type: KnotType;
  summary: string;
  steps: KnotStep[];
  /** Missing while the knot's path hasn't been authored yet. */
  path?: KnotPath;
}
