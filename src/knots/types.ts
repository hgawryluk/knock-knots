import type { Log } from '../scene/log';

/** Everything a knot checker may look at: the rope as it lies right now, and the log. */
export interface KnotContext {
  positions: Float32Array;
  count: number;
  ropeRadius: number;
  log: Log;
}

export interface KnotStep {
  title: string;
  hint: string;
}

export type KnotType = 'Stopper' | 'Loop' | 'Hitch';

/** Where the rope starts: lying loose on the grass (knots tied in the rope) or in front of the log (hitches). */
export type KnotSetup = 'grass' | 'log';

export interface KnotDefinition {
  id: string;
  name: string;
  type: KnotType;
  summary: string;
  setup: KnotSetup;
  steps: KnotStep[];
  /** Number of leading steps the rope currently satisfies; steps.length means tied. */
  evaluate: (context: KnotContext) => number;
}
