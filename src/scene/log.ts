import * as THREE from 'three';
import { loadModel } from './models';

/** Cross-section of the log at some x: center and elliptical half-extents (height, depth). */
export interface LogSection {
  cy: number;
  cz: number;
  ry: number;
  rz: number;
}

/** A log lying along X: the visual mesh plus a measured elliptical proxy for rope collisions. */
export interface Log {
  object: THREE.Object3D;
  minX: number;
  maxX: number;
  /** Interpolated cross-section; x is clamped to [minX, maxX]. */
  sectionAt: (x: number, out?: LogSection) => LogSection;
}

export interface LogPlacement {
  /** GLB file name in public/assets/. */
  file: string;
  /** Target length along X in world units. */
  length: number;
  /** World height of the log's underside (e.g. resting on stones). */
  baseHeight: number;
}

/** Loads a scanned log lying along X and derives its collision proxy from the mesh itself. */
export async function loadLog({ file, length, baseHeight }: LogPlacement): Promise<Log> {
  const object = await loadModel(file);

  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const scale = length / size.x;
  object.scale.setScalar(scale);
  const center = box.getCenter(new THREE.Vector3());
  object.position.set(-center.x * scale, baseHeight - box.min.y * scale, -center.z * scale);
  object.updateMatrixWorld(true);

  const { xs, sections } = measureSections(object, 32);
  const sectionAt = (x: number, out: LogSection = { cy: 0, cz: 0, ry: 0, rz: 0 }): LogSection => {
    const last = xs.length - 1;
    const f = THREE.MathUtils.clamp(((x - xs[0]) / (xs[last] - xs[0])) * last, 0, last);
    const i = Math.min(Math.floor(f), last - 1);
    const t = f - i;
    const a = sections[i];
    const b = sections[i + 1];
    out.cy = a.cy + (b.cy - a.cy) * t;
    out.cz = a.cz + (b.cz - a.cz) * t;
    out.ry = a.ry + (b.ry - a.ry) * t;
    out.rz = a.rz + (b.rz - a.rz) * t;
    return out;
  };

  return { object, minX: xs[0], maxX: xs[xs.length - 1], sectionAt };
}

/**
 * Slices the mesh into bins along X; each bin's YZ bounding box gives a
 * cross-section. End bins are skipped since they only catch the cut faces.
 */
function measureSections(object: THREE.Object3D, bins: number): { xs: number[]; sections: LogSection[] } {
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

  const xs: number[] = [];
  const sections: LogSection[] = [];
  for (let b = 1; b < bins - 1; b++) {
    if (!Number.isFinite(minY[b])) continue;
    xs.push(bounds.min.x + ((b + 0.5) / bins) * width);
    sections.push({
      cy: (minY[b] + maxY[b]) / 2,
      cz: (minZ[b] + maxZ[b]) / 2,
      ry: (maxY[b] - minY[b]) / 2,
      rz: (maxZ[b] - minZ[b]) / 2,
    });
  }
  return { xs, sections };
}
