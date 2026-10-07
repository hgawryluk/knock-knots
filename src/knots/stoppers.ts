import { analyzeFreeKnot } from './freeKnot';
import type { KnotDefinition } from './types';

/**
 * Knot determinant of each stopper when tied (1 would be no knot at all), and the
 * fewest real crossings its diagram can have. Requiring the crossings too means the
 * end must actually come out across the loop, not just lie inside it.
 */
const TREFOIL = { determinant: 3, crossings: 3 };
const FIGURE_EIGHT_KNOT = { determinant: 5, crossings: 4 };

export const OVERHAND: KnotDefinition = {
  id: 'overhand',
  name: 'Overhand Knot',
  type: 'Stopper',
  summary: 'The simplest knot and the base of many others. Stops a rope end from slipping through.',
  setup: 'grass',
  steps: [
    { title: 'Make a loop', hint: 'Drag the blue end across the rope. It rides over the rope it meets, forming a loop.' },
    { title: 'Through the loop', hint: 'Hold Shift and drag the end under the rope and out through the middle of the loop.' },
  ],
  evaluate({ positions, count }) {
    const { crossings, determinant } = analyzeFreeKnot(positions, count);
    if (determinant === TREFOIL.determinant && crossings >= TREFOIL.crossings) return 2;
    return crossings >= 1 ? 1 : 0;
  },
};

export const FIGURE_EIGHT: KnotDefinition = {
  id: 'figure-eight',
  name: 'Figure-Eight Knot',
  type: 'Stopper',
  summary: 'A bulkier, more secure stopper that is easier to untie, and the base of the climber’s tie-in.',
  setup: 'grass',
  steps: [
    { title: 'Make a loop', hint: 'Drag the blue end across the rope to form a loop.' },
    { title: 'Around the back', hint: 'Hold Shift and take the end under the standing part, wrapping round it once.' },
    { title: 'Down through the loop', hint: 'Bring the end over and Shift-tuck it down through the first loop. You should see an 8.' },
  ],
  evaluate({ positions, count }) {
    const { crossings, determinant } = analyzeFreeKnot(positions, count);
    if (determinant === FIGURE_EIGHT_KNOT.determinant && crossings >= FIGURE_EIGHT_KNOT.crossings) return 3;
    if (crossings >= 2) return 2;
    return crossings >= 1 ? 1 : 0;
  },
};
