import type { RopeSim } from '../rope/ropeSim';
import type { Mouse } from './mouse';

export type World = [number, number, number];

export interface DragHooks {
  /** Called before each labelled drag starts (demos mark step boundaries here). */
  beforeDrag?: (label: string) => void;
  /** Called after each drag has been released and settled. */
  afterDrag?: (label: string) => void;
}

/** One move of a scripted tie: grab the working end, follow world points, let go. */
export type Drag = (label: string, points: World[], shift?: boolean, ms?: number) => void;

/**
 * Builds a `drag` that grabs the working end, moves it through world points
 * (projected to the screen, like a hand following what it sees), lets go and
 * lets the rope settle.
 */
export function createEndDrag(sim: RopeSim, mouse: Mouse, hooks: DragHooks = {}): Drag {
  const p = sim.positions;
  const end = sim.count - 1;
  const endWorld = (): World => [p[end * 3], p[end * 3 + 1], p[end * 3 + 2]];

  return (label, points, shift = false, ms = 900) => {
    hooks.beforeDrag?.(label);
    let previous = mouse.screen(...endWorld());
    mouse.down(...previous);
    if (shift) mouse.shift(true);
    for (const point of points) {
      const next = mouse.screen(...point);
      mouse.path([previous, next], ms);
      previous = next;
      mouse.wait(150);
    }
    mouse.up(...previous);
    if (shift) mouse.shift(false);
    mouse.wait(1000);
    hooks.afterDrag?.(label);
  };
}
