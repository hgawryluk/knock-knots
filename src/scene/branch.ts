import * as THREE from 'three';
import { createNoise2D } from '../utils/noise';
import { createBarkTexture, createWoodRingsTexture } from './textures';

/**
 * Tube along `curve` whose radius follows `radiusAt(t)`. UV.x runs along the
 * curve and UV.y around it, like TubeGeometry.
 */
export function createTaperedTube(
  curve: THREE.Curve<THREE.Vector3>,
  radiusAt: (t: number, angle: number) => number,
  tubularSegments = 120,
  radialSegments = 24,
): THREE.TubeGeometry {
  const geometry = new THREE.TubeGeometry(curve, tubularSegments, 1, radialSegments, false);
  const position = geometry.attributes.position;
  const center = new THREE.Vector3();
  const vertex = new THREE.Vector3();
  for (let i = 0; i <= tubularSegments; i++) {
    const t = i / tubularSegments;
    curve.getPointAt(t, center);
    for (let j = 0; j <= radialSegments; j++) {
      const index = i * (radialSegments + 1) + j;
      vertex.fromBufferAttribute(position, index).sub(center);
      vertex.multiplyScalar(radiusAt(t, (j / radialSegments) * Math.PI * 2)).add(center);
      position.setXYZ(index, vertex.x, vertex.y, vertex.z);
    }
  }
  geometry.computeVertexNormals();
  return geometry;
}

export interface Branch {
  object: THREE.Group;
  curve: THREE.CatmullRomCurve3;
  radiusAt: (t: number) => number;
  /** Curve parameter closest to world x. */
  tAtX: (x: number) => number;
}

/** A cut, slightly crooked branch with bark, cut-end rings and a twig stub. */
export function createBranch(): Branch {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-2.3, 0.5, 0.12),
    new THREE.Vector3(-1.1, 0.54, -0.02),
    new THREE.Vector3(0.4, 0.55, -0.04),
    new THREE.Vector3(1.5, 0.57, 0.05),
    new THREE.Vector3(2.3, 0.6, 0.12),
  ]);
  const bumps = createNoise2D(21);
  const radiusAt = (t: number): number => 0.22 - 0.05 * t;
  const surface = (t: number, angle: number): number =>
    radiusAt(t) * (1 + bumps(t * 14, Math.cos(angle) * 1.5 + Math.sin(angle) * 1.5) * 0.06);

  const bark = createBarkTexture();
  bark.repeat.set(curve.getLength() / (Math.PI * 2 * 0.2), 1);
  const barkMaterial = new THREE.MeshStandardMaterial({ map: bark, bumpMap: bark, bumpScale: 3, roughness: 0.95 });

  const object = new THREE.Group();
  const log = new THREE.Mesh(createTaperedTube(curve, surface, 160, 32), barkMaterial);
  log.castShadow = log.receiveShadow = true;
  object.add(log);

  const ringsMaterial = new THREE.MeshStandardMaterial({ map: createWoodRingsTexture(), roughness: 0.85 });
  for (const end of [0, 1]) {
    const cap = new THREE.Mesh(new THREE.CircleGeometry(radiusAt(end), 32), ringsMaterial);
    const tangent = curve.getTangentAt(end);
    if (end === 0) tangent.negate();
    cap.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent);
    curve.getPointAt(end, cap.position);
    cap.castShadow = true;
    object.add(cap);
  }

  // Short twig stub so it reads as a branch rather than a dowel.
  const base = curve.getPointAt(0.78);
  const twigCurve = new THREE.CatmullRomCurve3([
    base.clone().add(new THREE.Vector3(0, 0.05, -0.05)),
    base.clone().add(new THREE.Vector3(0.18, 0.3, -0.18)),
    base.clone().add(new THREE.Vector3(0.42, 0.48, -0.3)),
  ]);
  const twig = new THREE.Mesh(createTaperedTube(twigCurve, (t) => 0.07 - 0.045 * t, 24, 12), barkMaterial);
  twig.castShadow = true;
  object.add(twig);

  const tAtX = (x: number): number => {
    let best = 0;
    let bestDistance = Infinity;
    for (let i = 0; i <= 400; i++) {
      const t = i / 400;
      const distance = Math.abs(curve.getPointAt(t).x - x);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = t;
      }
    }
    return best;
  };

  return { object, curve, radiusAt, tAtX };
}
