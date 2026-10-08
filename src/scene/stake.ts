import * as THREE from 'three';
import type { Point3 } from '../knots/types';

/**
 * A wooden tent peg knocked into the ground, holding the end of a second rope.
 * Hidden until a knot needs it.
 */
export class Stake {
  readonly object = new THREE.Group();

  constructor() {
    const wood = new THREE.MeshStandardMaterial({ color: '#6b5034', roughness: 0.9 });
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.02, 0.34, 10), wood);
    shaft.position.y = 0.05;
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.03, 0.04, 10), wood);
    head.position.y = 0.23;
    for (const part of [shaft, head]) {
      part.castShadow = true;
      part.receiveShadow = true;
      this.object.add(part);
    }
    // Knocked in at a slight slant, as pegs usually are.
    this.object.rotation.z = 0.12;
    this.object.visible = false;
  }

  /** Puts the peg where the rope is fixed (its head just above that point), or hides it. */
  show(at: Point3 | undefined): void {
    this.object.visible = Boolean(at);
    if (!at) return;
    this.object.position.set(at[0], 0, at[2]);
  }
}
