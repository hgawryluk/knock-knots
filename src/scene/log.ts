import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

/** Something a rope can wrap around: the visual mesh plus a smooth centerline proxy for collisions. */
export interface Branch {
  object: THREE.Object3D;
  curve: THREE.CatmullRomCurve3;
  radiusAt: (t: number) => number;
  /** Curve parameter closest to world x. */
  tAtX: (x: number) => number;
}

export interface LogPlacement {
  url: string;
  /** Target length along X in world units. */
  length: number;
  /** World height of the log's underside (e.g. resting on stones). */
  baseHeight: number;
}

/** Loads a scanned log lying along X and derives its collision proxy from the mesh itself. */
export async function loadLog({ url, length, baseHeight }: LogPlacement): Promise<Branch> {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.loadAsync(url);
  const object = gltf.scene;

  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const scale = length / size.x;
  object.scale.setScalar(scale);
  const center = box.getCenter(new THREE.Vector3());
  object.position.set(-center.x * scale, baseHeight - box.min.y * scale, -center.z * scale);
  object.updateMatrixWorld(true);

  const { curve, radii } = measureCenterline(object, 28);
  const radiusAt = (t: number): number => {
    const f = t * (radii.length - 1);
    const i = Math.min(Math.floor(f), radii.length - 2);
    return THREE.MathUtils.lerp(radii[i], radii[i + 1], f - i);
  };
  const tAtX = (x: number): number => {
    let best = 0;
    let bestDistance = Infinity;
    for (let i = 0; i <= 400; i++) {
      const distance = Math.abs(curve.getPointAt(i / 400).x - x);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = i / 400;
      }
    }
    return best;
  };

  return { object, curve, radiusAt, tAtX };
}

/**
 * Slices the mesh into bins along X; each bin's YZ bounding box gives a
 * centerline point and a radius. End bins are skipped since they only catch the cut faces.
 */
function measureCenterline(object: THREE.Object3D, bins: number): { curve: THREE.CatmullRomCurve3; radii: number[] } {
  const bounds = new THREE.Box3().setFromObject(object);
  const minY = new Array<number>(bins).fill(Infinity);
  const maxY = new Array<number>(bins).fill(-Infinity);
  const minZ = new Array<number>(bins).fill(Infinity);
  const maxZ = new Array<number>(bins).fill(-Infinity);
  const v = new THREE.Vector3();
  const width = bounds.max.x - bounds.min.x;

  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    const position = child.geometry.attributes.position;
    for (let i = 0; i < position.count; i++) {
      v.fromBufferAttribute(position, i).applyMatrix4(child.matrixWorld);
      const b = Math.min(Math.floor(((v.x - bounds.min.x) / width) * bins), bins - 1);
      minY[b] = Math.min(minY[b], v.y);
      maxY[b] = Math.max(maxY[b], v.y);
      minZ[b] = Math.min(minZ[b], v.z);
      maxZ[b] = Math.max(maxZ[b], v.z);
    }
  });

  const points: THREE.Vector3[] = [];
  const radii: number[] = [];
  for (let b = 1; b < bins - 1; b++) {
    if (!Number.isFinite(minY[b])) continue;
    const x = bounds.min.x + ((b + 0.5) / bins) * width;
    points.push(new THREE.Vector3(x, (minY[b] + maxY[b]) / 2, (minZ[b] + maxZ[b]) / 2));
    radii.push(Math.max(maxY[b] - minY[b], maxZ[b] - minZ[b]) / 2);
  }
  return { curve: new THREE.CatmullRomCurve3(points), radii };
}
