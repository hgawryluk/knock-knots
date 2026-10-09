/**
 * Rope lying on the ground: every sample rests on the surface (`ground` plus
 * the rope's radius) except where it passes over other rope — there it rises
 * by one rope thickness and settles back down on either side, like real rope
 * laid on a table. Which strand goes over comes from the authored path: on a
 * flat path the authored depth is carried, very slightly, in the height.
 */

/** Rope stays fully raised this far either side of a crossing (in rope radii of rope length)… */
const PLATEAU_RADII = 1.6;
/** …then settles back to the ground over this much more. */
const SETTLE_RADII = 6;

export function layOnGround(points: Float32Array, samples: number, radius: number, ground: number): void {
  const n = samples + 1;
  const x = (i: number): number => points[i * 3];
  const h = (i: number): number => points[i * 3 + 1];
  const z = (i: number): number => points[i * 3 + 2];

  let length = 0;
  for (let i = 1; i < n; i++) length += Math.hypot(x(i) - x(i - 1), z(i) - z(i - 1));
  const spacing = length / samples || radius;
  const plateau = Math.ceil((PLATEAU_RADII * radius) / spacing);
  const settle = Math.ceil((SETTLE_RADII * radius) / spacing);
  // Neighbours along the rope (within a tight bend) are not crossings.
  const near = Math.ceil((Math.PI * 2 * radius) / spacing) + 2;

  const lift = new Float32Array(n);
  for (let i = 0; i < n - 1; i++) {
    for (let j = i + near; j < n - 1; j++) {
      const rx = x(i + 1) - x(i);
      const rz = z(i + 1) - z(i);
      const sx = x(j + 1) - x(j);
      const sz = z(j + 1) - z(j);
      const denom = rx * sz - rz * sx;
      if (Math.abs(denom) < 1e-12) continue;
      const t = ((x(j) - x(i)) * sz - (z(j) - z(i)) * sx) / denom;
      const u = ((x(j) - x(i)) * rz - (z(j) - z(i)) * rx) / denom;
      if (t < 0 || t >= 1 || u < 0 || u >= 1) continue;
      const over = h(i) + (h(i + 1) - h(i)) * t > h(j) + (h(j + 1) - h(j)) * u ? i + t : j + u;
      for (let s = Math.max(0, Math.floor(over - plateau - settle)); s <= Math.min(n - 1, Math.ceil(over + plateau + settle)); s++) {
        const d = Math.abs(s - over);
        const k = d <= plateau ? 1 : Math.max(0, 1 - (d - plateau) / settle);
        lift[s] = Math.max(lift[s], 2 * radius * k * k * (3 - 2 * k));
      }
    }
  }
  for (let i = 0; i < n; i++) points[i * 3 + 1] = ground + radius + lift[i];
}
