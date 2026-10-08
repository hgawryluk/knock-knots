import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { HandPose } from '../knots/types';

/** Seconds to fade the hand in or out. */
const FADE_SECONDS = 0.35;

/**
 * A matt grey hand, like a mannequin's: a rounded palm and fingers built from
 * capsules along their joints. It never moves — it holds part of the rope
 * while you tie, fading in once that part is formed and out as the knot pulls tight.
 */
export class Hand {
  readonly object = new THREE.Group();
  private readonly material = new THREE.MeshStandardMaterial({ color: '#d2cfc8', roughness: 0.8, transparent: true, opacity: 0 });
  private presence = 0;
  private target = 0;

  constructor() {
    this.object.visible = false;
  }

  /** Builds the hand for a knot, or removes it for knots without one. */
  setPose(pose: HandPose | undefined): void {
    for (const child of [...this.object.children]) {
      this.object.remove(child);
      (child as THREE.Mesh).geometry.dispose();
    }
    this.presence = this.target = 0;
    this.object.visible = false;
    if (!pose) return;

    const [w, h, d] = pose.palm.size;
    const palm = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 4, Math.min(w, h, d) * 0.45), this.material);
    palm.position.set(...pose.palm.center);
    this.add(palm);

    const up = new THREE.Vector3(0, 1, 0);
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    for (const { joints, radius } of pose.fingers) {
      joints.forEach((joint, i) => {
        // Rounded knuckles; the tip slightly smaller.
        const knuckle = new THREE.Mesh(new THREE.SphereGeometry(radius * (i === joints.length - 1 ? 0.92 : 1), 16, 12), this.material);
        knuckle.position.set(...joint);
        this.add(knuckle);
        if (i === 0) return;
        a.set(...joints[i - 1]);
        b.set(...joint);
        const length = a.distanceTo(b);
        const bone = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.96, radius, length, 16, 1, true), this.material);
        bone.position.copy(a).add(b).multiplyScalar(0.5);
        bone.quaternion.setFromUnitVectors(up, b.clone().sub(a).normalize());
        this.add(bone);
      });
    }
  }

  /** Whether the hand should be there; it fades toward it. */
  setPresent(present: boolean): void {
    this.target = present ? 1 : 0;
  }

  update(dt: number): void {
    if (this.presence === this.target) return;
    const step = dt / FADE_SECONDS;
    this.presence = this.target > this.presence ? Math.min(this.presence + step, 1) : Math.max(this.presence - step, 0);
    const k = this.presence * this.presence * (3 - 2 * this.presence);
    this.material.opacity = k;
    // Fully there: draw solid, so it sorts and shadows like everything else.
    this.material.transparent = k < 1;
    this.material.depthWrite = k >= 1;
    this.object.visible = k > 0 && this.object.children.length > 0;
  }

  private add(mesh: THREE.Mesh): void {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.object.add(mesh);
  }
}
