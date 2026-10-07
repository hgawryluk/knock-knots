import { CLOVE_HITCH } from './cloveHitch';
import { FIGURE_EIGHT, OVERHAND } from './stoppers';
import type { KnotDefinition, KnotType } from './types';

export interface Level {
  name: string;
  type: KnotType;
  /** Missing while the level is still to come. */
  knot?: KnotDefinition;
}

/** The learning path, simplest first (order follows knots3d.com's beginner knots). */
export const LEVELS: Level[] = [
  { name: OVERHAND.name, type: OVERHAND.type, knot: OVERHAND },
  { name: FIGURE_EIGHT.name, type: FIGURE_EIGHT.type, knot: FIGURE_EIGHT },
  { name: 'Overhand Loop', type: 'Loop' },
  { name: 'Figure-Eight Loop', type: 'Loop' },
  { name: 'Two Half Hitches', type: 'Hitch' },
  { name: CLOVE_HITCH.name, type: CLOVE_HITCH.type, knot: CLOVE_HITCH },
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

/** A level opens once every playable level before it has been tied. */
export function isUnlocked(index: number, completed: Set<string>, unlockAll = false): boolean {
  if (!LEVELS[index].knot) return false;
  if (unlockAll) return true;
  return LEVELS.slice(0, index).every((level) => !level.knot || completed.has(level.knot.id));
}
