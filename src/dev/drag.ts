import type { RopeSim } from '../rope/ropeSim';
import type { createMouse } from './mouse';

export type Mouse = ReturnType<typeof createMouse>;
export type World = [number, number, number];

/**
 * Dev-only: builds a `drag` that grabs the working end, moves it through world
 * points (projected to the screen, like a hand following what it sees), lets
 * go and logs what the knot checker says. `stopAfter` ends the run after that
 * labelled drag.
 */
export function createEndDrag(sim: RopeSim, mouse: Mouse, status: () => string, stopAfter = '') {
  const p = sim.positions;
  const end = sim.count - 1;
  const endWorld = (): World => [p[end * 3], p[end * 3 + 1], p[end * 3 + 2]];
  const log: string[] = [];
  let stopped = false;

  const drag = (label: string, points: World[], shift = false, ms = 900): void => {
    if (stopped) return;
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
    log.push(`${label}: end=${endWorld().map((v) => v.toFixed(2))} ${status()}`);
    stopped = label === stopAfter;
  };

  return { drag, log, endWorld };
}
