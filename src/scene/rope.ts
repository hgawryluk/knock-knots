import * as THREE from 'three';
import { createRopeTexture, type RopeColors } from './ropeTexture';

/** Renders a rope as a textured tube along a smooth curve through control points. */
export class Rope {
  readonly mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  private readonly caps: THREE.Mesh[];
  private readonly texture: THREE.CanvasTexture;

  constructor(
    colors: RopeColors,
    readonly radius = 0.06,
    private readonly tubularSegments = 600,
    private readonly radialSegments = 14,
  ) {
    this.texture = createRopeTexture(colors);
    const material = new THREE.MeshStandardMaterial({ map: this.texture, roughness: 0.85, metalness: 0 });
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;

    const capGeometry = new THREE.SphereGeometry(radius, 20, 12);
    this.caps = [0, 1].map(() => {
      const cap = new THREE.Mesh(capGeometry, material);
      cap.castShadow = true;
      this.mesh.add(cap);
      return cap;
    });
  }

  setPoints(points: THREE.Vector3[]): void {
    const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
    this.mesh.geometry.dispose();
    this.mesh.geometry = new THREE.TubeGeometry(curve, this.tubularSegments, this.radius, this.radialSegments, false);
    this.texture.repeat.set(curve.getLength() / (Math.PI * 2 * this.radius), 1);
    curve.getPointAt(0, this.caps[0].position);
    curve.getPointAt(1, this.caps[1].position);
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.caps[0].geometry.dispose();
    this.mesh.material.dispose();
    this.texture.dispose();
  }
}
