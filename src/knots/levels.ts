import {
  CLOVE_HITCH_PATH,
  FIGURE_EIGHT_PATH,
  OVERHAND_NOOSE_PATH,
  OVERHAND_PATH,
  ROUND_TURN_TWO_HALF_HITCHES_PATH,
  SQUARE_KNOT_PATH,
} from './paths';
import type { KnotDefinition, KnotSection, KnotType, SectionId } from './types';

export const OVERHAND: KnotDefinition = {
  id: 'overhand',
  name: 'Overhand Knot',
  type: 'Stopper',
  section: 'survival',
  summary: 'The simplest knot and the base of many others. Stops a rope end from slipping through.',
  steps: [
    { title: 'Make a loop', hint: 'Drag the blue end round to the left and up, crossing over the rope.' },
    { title: 'Around the back', hint: 'Take the end round the right side and behind the rope.' },
    { title: 'Through the loop', hint: 'Bring the end forward through the loop and let it hang down.' },
  ],
  path: OVERHAND_PATH,
};

/** Sections of the learning path, shown as groups in the panel. Each unlocks on its own. */
export const SECTIONS: KnotSection[] = [
  { id: 'survival', name: 'Survival', blurb: 'Camp, shelter and everyday knots for the outdoors.' },
  { id: 'mountains', name: 'Mountains', blurb: 'Climbing knots for tying in, belaying and getting back down.' },
];

/** A knot whose path hasn't been authored yet: listed in its section as "coming soon". */
const soon = (id: string, name: string, type: KnotType, section: SectionId, summary: string): KnotDefinition => ({
  id,
  name,
  type,
  section,
  summary,
  steps: [],
});

/**
 * Every knot, grouped by section in SECTIONS order and simplest first within each.
 * Survival = knots3d.com's "Essential Knots" (names only, our own order and words), plus the overhand they build on.
 */
export const LEVELS: KnotDefinition[] = [
  OVERHAND,
  {
    id: 'figure-eight',
    name: 'Figure-Eight Knot',
    type: 'Stopper',
    section: 'survival',
    summary: 'A bulkier, more secure stopper that is easier to untie, and the base of the climber’s tie-in.',
    steps: [
      { title: 'Make a loop', hint: 'Bring the blue end round to form a loop, crossing the rope.' },
      { title: 'Around the standing part', hint: 'Wrap the end once round the rope above the loop.' },
      { title: 'Down through the loop', hint: 'Finish by passing the end back through the first loop. You should see an 8.' },
    ],
    path: FIGURE_EIGHT_PATH,
  },
  {
    id: 'square-knot',
    name: 'Square Knot',
    type: 'Binding',
    section: 'survival',
    summary: 'Ties two ends round a bundle. Never use it to join ropes that take a load.',
    steps: [
      { title: 'Make a bight', hint: 'Lead the blue end out to the right and fold it back on itself into a U.' },
      { title: 'Round the bundle', hint: 'Take the end down and round in a loop, as if round a bundle, and back up the right side.' },
      { title: 'Up through the bight', hint: 'Bring the end up under the curve of the bight and over its lower leg.' },
      { title: 'Round the back', hint: 'Take the end round behind both legs of the bight.' },
      { title: 'Back beside itself', hint: 'Come over the top leg and out under the curve, alongside where you went in.' },
    ],
    path: SQUARE_KNOT_PATH,
  },
  {
    id: 'overhand-noose',
    name: 'Simple Overhand Noose',
    type: 'Loop',
    section: 'survival',
    summary: 'A sliding loop that closes when the rope is pulled.',
    steps: [
      { title: 'Round the rope', hint: 'Bring the blue end up, behind the rope, round its left side and across the front over itself.' },
      { title: 'Round the back', hint: 'Swing the end out to the right and round behind, into the loop you just made.' },
      { title: 'Out through the loop', hint: 'Bring the end forward through the loop and out over its top.' },
    ],
    path: OVERHAND_NOOSE_PATH,
  },
  {
    id: 'clove-hitch',
    name: 'Clove Hitch',
    type: 'Hitch',
    section: 'survival',
    summary: 'Quick, adjustable hitch to fix a rope to a pole, post or rail.',
    steps: [
      { title: 'Round the rail', hint: 'Take the blue end down the front of the rail, under it, up the back and over the top.' },
      { title: 'Cross over, round again', hint: 'Come down the front across the rope, then round the rail again beside the first turn.' },
      { title: 'Tuck under the cross', hint: 'Bring the end over the top and down under the diagonal, so it pins the end.' },
    ],
    path: CLOVE_HITCH_PATH,
  },
  {
    id: 'round-turn-two-half-hitches',
    name: 'Round Turn & Two Half Hitches',
    type: 'Hitch',
    section: 'survival',
    summary: 'A strong, easy-to-untie tie-off to a post, ring or log.',
    steps: [
      { title: 'Round turn', hint: 'Take the blue end round the rail one and a half times, coming up the front.' },
      { title: 'First half hitch', hint: 'Lead the end across the front of the rope above the rail, round behind it, and tuck it under itself.' },
      { title: 'Second half hitch', hint: 'Do the same again just above, turning the same way.' },
    ],
    path: ROUND_TURN_TWO_HALF_HITCHES_PATH,
  },
  soon('figure-eight-loop', 'Figure-Eight Loop', 'Loop', 'survival', 'A fixed loop at the end of the rope that won’t slip.'),
  soon('bowline', 'Bowline', 'Loop', 'survival', 'A fixed loop that holds under load and still unties easily afterwards.'),
  soon('sheet-bend', 'Sheet Bend', 'Bend', 'survival', 'Joins two ropes, even when one is thicker than the other.'),
  soon('timber-hitch', 'Timber Hitch', 'Hitch', 'survival', 'Grips a log by twisting round itself — for dragging timber or starting a lashing.'),
  soon('constrictor-knot', 'Constrictor Knot', 'Binding', 'survival', 'A binding that clamps down hard, for closing a bag or holding things together.'),
  soon('anchor-hitch', 'Anchor Hitch', 'Hitch', 'survival', 'A secure way to tie a rope to a ring, anchor or post.'),
  soon('double-fishermans', 'Double Fisherman’s Knot', 'Bend', 'survival', 'Joins two ropes of similar size for good, as climbers do for slings.'),
  soon('alpine-butterfly', 'Alpine Butterfly', 'Loop', 'survival', 'A fixed loop in the middle of the rope that can be loaded any way.'),
  soon('zeppelin-bend', 'Zeppelin Bend', 'Bend', 'survival', 'Joins two ropes and stays easy to untie even after heavy strain.'),
  soon('midshipmans-hitch', 'Midshipman’s Hitch', 'Hitch', 'survival', 'A friction hitch you can slide to tighten a line under tension.'),
  soon('adjustable-grip-hitch', 'Adjustable Grip Hitch', 'Hitch', 'survival', 'Slides to adjust a line, then grips when loaded — ideal for tent guylines.'),
  soon('prusik', 'Prusik', 'Hitch', 'survival', 'A loop wrapped round a rope that grips under load and slides when free.'),
  soon('truckers-hitch', 'Trucker’s Hitch', 'Hitch', 'survival', 'A built-in pulley that lets you pull a line really tight and tie it off.'),
  soon('autolocking-truckers-hitch', 'Autolocking Trucker’s Hitch', 'Hitch', 'survival', 'A trucker’s hitch that holds the tension by itself while you tie off.'),

  soon('figure-eight-follow-through', 'Figure-Eight Follow-Through', 'Loop', 'mountains', 'The climber’s tie-in: a figure-eight loop threaded through the harness.'),
  soon('munter-hitch', 'Munter Hitch', 'Hitch', 'mountains', 'Belay or lower someone using just a carabiner and friction.'),
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

/** A level opens once every playable level before it in its section has been tied. Levels without a path are still to come. */
export function isUnlocked(index: number, completed: Set<string>, unlockAll = false): boolean {
  const level = LEVELS[index];
  if (!level.path) return false;
  if (unlockAll) return true;
  return LEVELS.slice(0, index).every((earlier) => earlier.section !== level.section || !earlier.path || completed.has(earlier.id));
}
