import { FIGURE_EIGHT_PATH, OVERHAND_PATH } from './paths';
import type { KnotDefinition } from './types';

export const OVERHAND: KnotDefinition = {
  id: 'overhand',
  name: 'Overhand Knot',
  type: 'Stopper',
  summary: 'The simplest knot and the base of many others. Stops a rope end from slipping through.',
  steps: [
    { title: 'Make a loop', hint: 'Drag the blue end round to the left and up, crossing over the rope.' },
    { title: 'Around the back', hint: 'Take the end round the right side and behind the rope.' },
    { title: 'Through the loop', hint: 'Bring the end forward through the loop and let it hang down.' },
  ],
  path: OVERHAND_PATH,
};

/** The learning path, simplest first (order follows knots3d.com's beginner knots). */
export const LEVELS: KnotDefinition[] = [
  OVERHAND,
  {
    id: 'figure-eight',
    name: 'Figure-Eight Knot',
    type: 'Stopper',
    summary: 'A bulkier, more secure stopper that is easier to untie, and the base of the climber’s tie-in.',
    steps: [
      { title: 'Make a loop', hint: 'Bring the blue end round to form a loop, crossing the rope.' },
      { title: 'Around the standing part', hint: 'Wrap the end once round the rope above the loop.' },
      { title: 'Down through the loop', hint: 'Finish by passing the end back through the first loop. You should see an 8.' },
    ],
    path: FIGURE_EIGHT_PATH,
  },
  { id: 'overhand-loop', name: 'Overhand Loop', type: 'Loop', summary: '', steps: [] },
  { id: 'figure-eight-loop', name: 'Figure-Eight Loop', type: 'Loop', summary: '', steps: [] },
  { id: 'two-half-hitches', name: 'Two Half Hitches', type: 'Hitch', summary: '', steps: [] },
  { id: 'clove-hitch', name: 'Clove Hitch', type: 'Hitch', summary: 'Quick, adjustable hitch to fix a rope to a log, post or carabiner.', steps: [] },
];

const STORAGE_KEY = 'knots.completed';

/** Ids of knots the player has tied. Browser storage may be unavailable; progress then lasts the visit. */
export function loadCompleted(): Set<string> {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    return new Set(Array.isArray(saved) ? saved.filter((id): id is string => typeof id === 'string') : []);
  } catch {
    return new Set();
  }
}

export function saveCompleted(completed: Set<string>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...completed]));
  } catch {
    // Not persisted; fine.
  }
}

/** A level opens once every playable level before it has been tied. Levels without a path are still to come. */
export function isUnlocked(index: number, completed: Set<string>, unlockAll = false): boolean {
  if (!LEVELS[index].path) return false;
  if (unlockAll) return true;
  return LEVELS.slice(0, index).every((level) => !level.path || completed.has(level.id));
}
