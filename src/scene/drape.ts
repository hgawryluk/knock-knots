import * as THREE from 'three';
import type { Branch } from './log';

/** Static placeholder rope: lies on the grass, goes once over the branch and trails off the back. */
export function drapeOverBranch(branch: Branch, ropeRadius: number, x = 0.25): THREE.Vector3[] {
  const t = branch.tAtX(x);
  const c = branch.curve.getPointAt(t);
  const r = branch.radiusAt(t) + ropeRadius + 0.01;
  const g = ropeRadius;
  const v = (dx: number, y: number, dz: number): THREE.Vector3 => new THREE.Vector3(c.x + dx, y, c.z + dz);

  const front = [v(0.9, g, 2.4), v(0.55, g, 1.6), v(0.25, g + 0.02, 0.95), v(0.08, 0.2, r + 0.12)];
  const over: THREE.Vector3[] = [];
  for (let a = -0.35; a <= Math.PI + 0.35; a += Math.PI / 10) {
    over.push(v(0, c.y + Math.sin(a) * r, Math.cos(a) * r));
  }
  const back = [v(-0.06, 0.2, -r - 0.12), v(-0.25, g + 0.02, -0.9), v(-0.65, g, -1.5), v(-1.4, g, -1.85), v(-2.2, g, -1.6)];
  return [...front, ...over, ...back];
}
