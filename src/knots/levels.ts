import {
  CLOVE_HITCH_CARABINER_PATH,
  CLOVE_HITCH_PATH,
  FIGURE_EIGHT_FLAT_PATH,
  MUNTER_HITCH_PATH,
  OVERHAND_FLAT_PATH,
  OVERHAND_NOOSE_FLAT_PATH,
  ROUND_TURN_TWO_HALF_HITCHES_PATH,
  SQUARE_KNOT_FLAT_PATH,
} from './paths';
import type { KnotDefinition, KnotSection, KnotType, SectionId } from './types';

export const OVERHAND: KnotDefinition = {
  id: 'overhand',
  name: 'Overhand Knot',
  type: 'Stopper',
  section: 'survival',
  summary: 'The simplest knot, and the start of many others. Stops a rope end slipping through.',
  steps: [
    { title: 'Make a loop', hint: 'Bring the blue end round to the left and over the rope.' },
    { title: 'Under the rope', hint: 'Go round the right side and under the rope.' },
    { title: 'Through the loop', hint: 'Bring the end up through the loop and pull it toward you.' },
  ],
  path: OVERHAND_FLAT_PATH,
};

/** Sections of the learning path, shown as groups in the panel. */
export const SECTIONS: KnotSection[] = [
  { id: 'survival', name: 'Survival', blurb:
      'A few basic knots cover most jobs at camp, by the water and at home: stop a rope end slipping, tie up a bundle, make a loop that closes, fix a rope to a pole. The other knots build on these.' },
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
      { title: 'Make a loop', hint: 'Bring the blue end round to the left and over the rope.' },
      { title: 'Round the rope', hint: 'Wrap the end once round the rope, just above the loop.' },
      { title: 'Through the first loop', hint: 'Pass the end through the first loop and pull it toward you. You should see an 8.' },
    ],
    path: FIGURE_EIGHT_FLAT_PATH,
  },
  {
    id: 'square-knot',
    name: 'Square Knot',
    type: 'Binding',
    section: 'survival',
    summary: 'Ties two ends round a bundle. Never use it to join ropes that take a load.',
    steps: [
      { title: 'Into the hook', hint: 'Take the blue end under the top of the red hook, through the middle and out over its right leg.' },
      { title: 'Under the hook', hint: 'Go under both legs of the hook.' },
      { title: 'Out beside itself', hint: 'Come up over the left leg and out under the top of the hook, next to where you went in.' },
    ],
    path: SQUARE_KNOT_FLAT_PATH,
  },
  {
    id: 'overhand-noose',
    name: 'Simple Overhand Noose',
    type: 'Loop',
    section: 'survival',
    summary: 'A sliding loop that closes when the rope is pulled.',
    steps: [
      { title: 'Round the rope', hint: 'Bring the blue end up, under the rope, round its left side and back over itself.' },
      { title: 'Underneath', hint: 'Swing the end to the right and under, into the loop you just made.' },
      { title: 'Out through the loop', hint: 'Bring the end up through the loop and out over its top.' },
    ],
    path: OVERHAND_NOOSE_FLAT_PATH,
  },
  {
    id: 'clove-hitch',
    name: 'Clove Hitch',
    type: 'Hitch',
    section: 'survival',
    summary: 'Quick, adjustable hitch to fix a rope to a pole, post or rail.',
    steps: [
      { title: 'Round the rail', hint: 'Take the blue end down the front, under the rail, up the back and over the top.' },
      { title: 'Cross over, round again', hint: 'Come down across the rope, then go round the rail again next to the first turn.' },
      { title: 'Tuck under the cross', hint: 'Go over the top and tuck the end under the diagonal.' },
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
      { title: 'Round turn', hint: 'Wrap the blue end round the rail one and a half times, so it comes up at the front.' },
      { title: 'First half hitch', hint: 'Take the end across the front of the rope, round behind it, and tuck it under itself.' },
      { title: 'Second half hitch', hint: 'Do the same again just above, the same way round.' },
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

  {
    id: 'clove-hitch-carabiner',
    name: 'Clove Hitch on a Carabiner',
    type: 'Hitch',
    section: 'mountains',
    summary: 'Ties you in to the anchor. Quick to adjust, and it holds fast once loaded.',
    steps: [
      { title: 'First loop', hint: 'Twist a loop in the rope.' },
      { title: 'Second loop', hint: 'Twist a second loop beside it, the same way round.' },
      { title: 'Right loop behind', hint: 'Slide the right loop behind the left one.' },
      { title: 'Clip them in', hint: 'Unscrew the sleeve, press the gate in with the loops so they slip through, let them drop onto the bar, then lock the gate.' },
    ],
    path: CLOVE_HITCH_CARABINER_PATH,
  },
  {
    id: 'munter-hitch',
    name: 'Munter Hitch',
    type: 'Hitch',
    section: 'mountains',
    summary: 'Belay or lower someone with just a carabiner: the rope runs round it with plenty of friction.',
    steps: [
      { title: 'Make a loop', hint: 'Take hold of the hanging strand and twist a small loop in it, out to the right.' },
      { title: 'To the gate', hint: 'Bring the loop up beside the gate, by its nose at the bottom right.' },
      { title: 'Clip it in', hint: 'Unscrew the sleeve, press the gate in with the loop so it slips through, let it drop onto the bar, then lock the gate.' },
    ],
    path: MUNTER_HITCH_PATH,
  },
  soon('figure-eight-follow-through', 'Figure-Eight Follow-Through', 'Loop', 'mountains', 'The climber’s tie-in: a figure-eight loop threaded through the harness.'),
];

/** Ids of knots the player has tied. Progress lasts only for the current visit: a refresh starts from the beginning. */
export function freshProgress(): Set<string> {
  try {
    localStorage.removeItem('knots.completed'); // Drop progress saved by older builds.
  } catch {
    // Storage unavailable; nothing to clear.
  }
  return new Set();
}
