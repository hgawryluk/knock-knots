/**
 * Rope lying on the ground: every sample rests on the surface (`ground` plus
 * the rope's radius) except where it passes over other rope — there it rises
 * just enough to clear it and settles back down on either side, like real rope
 * laid on a table. That covers crossings and strands that merely lie too close
 * side by side. Which strand goes on top comes from the authored path: on a
 * flat path the authored depth is carried, very slightly, in the height.
 */

/** Rope stays fully raised this far either side of where it rests on other rope (in rope radii of rope length)… */
const PLATEAU_RADII = 1.6;
/** …then settles back to the ground over this much more. */
const SETTLE_RADII = 6;
/** Passes of "lift whatever still sinks into rope below it". */
const PASSES = 4;

export function layOnGround(points: Float32Array, samples: number, radius: number, ground: number): void {
  const n = samples + 1;
  const x = (i: number): number => points[i * 3];
  const z = (i: number): number => points[i * 3 + 2];
  // Authored order (which strand is on top), before the heights are rewritten.
  const order = Float32Array.from({ length: n }, (_, i) => points[i * 3 + 1]);

  let length = 0;
  for (let i = 1; i < n; i++) length += Math.hypot(x(i) - x(i - 1), z(i) - z(i - 1));
  const spacing = length / samples || radius;
  const plateau = Math.ceil((PLATEAU_RADII * radius) / spacing);
  const settle = Math.ceil((SETTLE_RADII * radius) / spacing);
  // Neighbours along the rope (within a tight bend) never rest on each other.
  const near = Math.ceil((Math.PI * 2 * radius) / spacing) + 2;
  const contact = 2 * radius;

  const lift = new Float32Array(n);
  const raise = (at: number, height: number): void => {
    for (let s = Math.max(0, Math.floor(at - plateau - settle)); s <= Math.min(n - 1, Math.ceil(at + plateau + settle)); s++) {
      const d = Math.abs(s - at);
      const k = d <= plateau ? 1 : Math.max(0, 1 - (d - plateau) / settle);
      lift[s] = Math.max(lift[s], height * k * k * (3 - 2 * k));
    }
  };

  for (let pass = 0; pass < PASSES; pass++) {
    for (let i = 0; i < n; i++) {
      for (let j = i + near; j < n; j++) {
        const d = Math.hypot(x(i) - x(j), z(i) - z(j));
        if (d >= contact) continue;
        // The strand authored on top rests on the other: high enough to just touch it.
        const [top, below] = order[i] > order[j] ? [i, j] : [j, i];
        const needed = lift[below] + Math.sqrt(contact * contact - d * d);
        if (lift[top] < needed - 1e-4) raise(top, needed);
      }
    }
  }
  for (let i = 0; i < n; i++) points[i * 3 + 1] = ground + radius + lift[i];
}
