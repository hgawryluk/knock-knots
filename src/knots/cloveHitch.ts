import type { Crossing, WrapSample } from './logAnalysis';
import { surfaceCrossings, windingBetween } from './logAnalysis';

export interface KnotStep {
  title: string;
  hint: string;
}

export interface KnotEvaluation {
  /** Number of leading steps already satisfied (steps.length = tied). */
  completed: number;
}

export interface KnotDefinition {
  id: string;
  name: string;
  type: string;
  summary: string;
  steps: KnotStep[];
  evaluate: (samples: WrapSample[]) => KnotEvaluation;
}

/** Index distance within which two crossings belong to the same diagonal pass of rope. */
const SAME_PASS = 8;

/**
 * Clove hitch around the log. Signature on the unrolled log surface: two turns
 * in the same direction, and one "diagonal" stretch that lies over both the
 * standing part (earlier in the rope) and the tucked end (later in the rope).
 */
export const CLOVE_HITCH: KnotDefinition = {
  id: 'clove-hitch',
  name: 'Clove Hitch',
  type: 'Hitch',
  summary: 'Quick, adjustable hitch to fix a rope to a log, post or carabiner.',
  steps: [
    { title: 'Over the log', hint: 'Drag the blue working end up and over the log.' },
    { title: 'Cross over', hint: 'Bring it around under the log and cross over the standing part.' },
    { title: 'Second turn', hint: 'Go around the log once more, beside the first turn.' },
    { title: 'Tuck under', hint: 'Hold Shift and drag the end under the crossing — it slips beneath the rope it meets.' },
  ],
  evaluate(samples) {
    const last = samples.length - 1;
    const turns = Math.abs(windingBetween(samples, 0, last));
    const crossings = surfaceCrossings(samples);

    if (turns < 0.5) return { completed: 0 };

    const crossesOverEarlier = (c: Crossing): boolean => c.over === c.b;
    const firstCross = crossings.some((c) => crossesOverEarlier(c) && Math.abs(windingBetween(samples, c.a, c.b)) >= 0.7);
    if (!firstCross) return { completed: 1 };

    if (turns < 1.7) return { completed: 2 };

    const tucked = crossings.some(
      (standing) =>
        crossesOverEarlier(standing) &&
        crossings.some(
          (end) =>
            end.over === end.a &&
            Math.abs(end.a - standing.b) <= SAME_PASS &&
            Math.abs(windingBetween(samples, standing.a, end.b)) >= 1.5,
        ),
    );
    return { completed: tucked ? 4 : 3 };
  },
};
