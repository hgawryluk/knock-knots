import * as THREE from 'three';
import type { RopeSim } from '../rope/ropeSim';

/** Dev-only: colored beads every few particles (red = standing end → blue = working end) to read strand order. */
export function createRopeBeads(sim: RopeSim, every = 6): { object: THREE.Object3D; update: () => void } {
  const count = Math.ceil(sim.count / every);
  const mesh = new THREE.InstancedMesh(
    new THREE.SphereGeometry(sim.radius * 0.75, 10, 8),
    new THREE.MeshBasicMaterial({ depthTest: false }),
    count,
  );
  mesh.renderOrder = 5;
  mesh.frustumCulled = false;
  const color = new THREE.Color();
  for (let b = 0; b < count; b++) mesh.setColorAt(b, color.setHSL((b / count) * 0.66, 1, 0.5));
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const update = (): void => {
    for (let b = 0; b < count; b++) {
      sim.getPosition(Math.min(b * every, sim.count - 1), position);
      mesh.setMatrixAt(b, matrix.makeTranslation(position.x, position.y, position.z));
    }
    mesh.instanceMatrix.needsUpdate = true;
  };
  return { object: mesh, update };
}
