import * as THREE from 'three';
import { createRopeTextures, type RopeColors } from './ropeTexture';

const SUBDIVISIONS = 3;
const RADIAL = 18;

/**
 * Tube skinned over the simulated particles every frame. Geometry is
 * allocated once and rewritten in place, with parallel-transport frames so
 * the braid pattern doesn't twist or pop.
 */
export class RopeMesh {
  readonly object = new THREE.Group();
  private readonly geometry = new THREE.BufferGeometry();
  private readonly rings: number;
  private readonly centers: Float32Array;
  private readonly startCap: THREE.Mesh;
  private readonly endCap: THREE.Mesh;

  constructor(
    private readonly particleCount: number,
    private readonly radius: number,
    colors: RopeColors,
    workingEndColor: THREE.ColorRepresentation,
  ) {
    this.rings = (particleCount - 1) * SUBDIVISIONS + 1;
    this.centers = new Float32Array(this.rings * 3);

    const vertices = this.rings * (RADIAL + 1);
    this.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices * 3), 3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(vertices * 3), 3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(vertices * 2), 2).setUsage(THREE.DynamicDrawUsage));
    const indices: number[] = [];
    for (let i = 0; i < this.rings - 1; i++) {
      for (let j = 0; j < RADIAL; j++) {
        const a = i * (RADIAL + 1) + j;
        const b = a + RADIAL + 1;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    this.geometry.setIndex(indices);

    const { map, normalMap } = createRopeTextures(colors);
    // Braided fibres: matte, with a soft fabric sheen along the strands.
    const material = new THREE.MeshPhysicalMaterial({
      map,
      normalMap,
      normalScale: new THREE.Vector2(1.2, 1.2),
      roughness: 0.6,
      sheen: 0.6,
      sheenRoughness: 0.45,
      sheenColor: new THREE.Color('#ffe2a0'),
    });
    const tube = new THREE.Mesh(this.geometry, material);
    tube.castShadow = tube.receiveShadow = true;
    tube.frustumCulled = false;

    const capGeometry = new THREE.SphereGeometry(radius, 20, 12);
    this.startCap = new THREE.Mesh(capGeometry, material);
    this.endCap = new THREE.Mesh(
      new THREE.SphereGeometry(radius * 1.08, 20, 12),
      new THREE.MeshStandardMaterial({ color: workingEndColor, roughness: 0.5 }),
    );
    this.endCap.scale.set(1, 1, 1.35);
    for (const cap of [this.startCap, this.endCap]) cap.castShadow = true;
    this.object.add(tube, this.startCap, this.endCap);
  }

  update(positions: Float32Array): void {
    this.sampleCenters(positions);
    this.writeTube();
    const c = this.centers;
    const last = (this.rings - 1) * 3;
    this.startCap.position.fromArray(c, 0);
    this.endCap.position.fromArray(c, last);
    // Elongated tip (like a whipped end) points along the rope.
    this.endCap.lookAt(c[last] * 2 - c[last - 3], c[last + 1] * 2 - c[last - 2], c[last + 2] * 2 - c[last - 1]);
  }

  /** Uniform Catmull-Rom through the particles. */
  private sampleCenters(p: Float32Array): void {
    const n = this.particleCount;
    const at = (i: number, a: number): number => p[Math.min(Math.max(i, 0), n - 1) * 3 + a];
    let r = 0;
    for (let i = 0; i < n - 1; i++) {
      for (let s = 0; s < SUBDIVISIONS; s++) {
        const t = s / SUBDIVISIONS;
        const t2 = t * t;
        const t3 = t2 * t;
        for (let a = 0; a < 3; a++) {
          const p0 = at(i - 1, a);
          const p1 = at(i, a);
          const p2 = at(i + 1, a);
          const p3 = at(i + 2, a);
          this.centers[r * 3 + a] =
            0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
        }
        r++;
      }
    }
    for (let a = 0; a < 3; a++) this.centers[r * 3 + a] = at(n - 1, a);
  }

  private writeTube(): void {
    const c = this.centers;
    const position = this.geometry.attributes.position as THREE.BufferAttribute;
    const normal = this.geometry.attributes.normal as THREE.BufferAttribute;
    const uv = this.geometry.attributes.uv as THREE.BufferAttribute;
    const tangent = new THREE.Vector3();
    const frameN = new THREE.Vector3();
    const frameB = new THREE.Vector3();
    const dir = new THREE.Vector3();
    const circumference = Math.PI * 2 * this.radius;
    let along = 0;

    for (let i = 0; i < this.rings; i++) {
      const prev = Math.max(i - 1, 0) * 3;
      const next = Math.min(i + 1, this.rings - 1) * 3;
      tangent.set(c[next] - c[prev], c[next + 1] - c[prev + 1], c[next + 2] - c[prev + 2]).normalize();

      if (i === 0) {
        frameN.set(0, 1, 0);
        if (Math.abs(tangent.y) > 0.9) frameN.set(1, 0, 0);
      } else {
        along += Math.hypot(c[i * 3] - c[prev], c[i * 3 + 1] - c[prev + 1], c[i * 3 + 2] - c[prev + 2]);
      }
      // Parallel transport: remove the tangent component from the previous normal.
      frameN.addScaledVector(tangent, -frameN.dot(tangent)).normalize();
      frameB.crossVectors(tangent, frameN);

      for (let j = 0; j <= RADIAL; j++) {
        const angle = (j / RADIAL) * Math.PI * 2;
        dir.copy(frameN).multiplyScalar(-Math.cos(angle)).addScaledVector(frameB, Math.sin(angle));
        const v = i * (RADIAL + 1) + j;
        position.setXYZ(v, c[i * 3] + dir.x * this.radius, c[i * 3 + 1] + dir.y * this.radius, c[i * 3 + 2] + dir.z * this.radius);
        normal.setXYZ(v, dir.x, dir.y, dir.z);
        uv.setXY(v, along / circumference, j / RADIAL);
      }
    }
    position.needsUpdate = true;
    normal.needsUpdate = true;
    uv.needsUpdate = true;
  }
}
