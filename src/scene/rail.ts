import * as THREE from 'three';
import type { Rail } from '../knots/types';

/** Half the pole's length, and how far out the forked stakes stand. */
const HALF_LENGTH = 0.85;
const STAKE_X = 0.68;
const STAKE_RADIUS = 0.032;
const PRONG_LENGTH = 0.16;
const PRONG_TILT = 0.45;

/**
 * A camp rail for knots tied round something: a straight pole resting in the
 * forks of two stakes pushed into the ground. Hidden until a knot needs it.
 */
export class CampRail {
  readonly object = new THREE.Group();

  constructor() {
    const material = new THREE.MeshStandardMaterial({ map: barkTexture(), roughness: 0.95 });
    const part = (geometry: THREE.BufferGeometry): THREE.Mesh => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.object.add(mesh);
      return mesh;
    };

    // Unit-height pieces, sized by `place`.
    const pole = part(new THREE.CylinderGeometry(1, 1, 1, 20, 1));
    pole.rotation.z = Math.PI / 2;
    pole.name = 'pole';
    for (const side of [-1, 1]) {
      const stake = part(new THREE.CylinderGeometry(STAKE_RADIUS * 0.85, STAKE_RADIUS, 1, 10));
      stake.name = 'stake';
      stake.userData.side = side;
      for (const lean of [-1, 1]) {
        const prong = part(new THREE.CylinderGeometry(STAKE_RADIUS * 0.5, STAKE_RADIUS * 0.8, PRONG_LENGTH, 8));
        prong.name = 'prong';
        prong.userData.side = side;
        prong.userData.lean = lean;
      }
    }
    this.object.visible = false;
  }

  /** Shows the rail where `rail` says, or hides it. */
  show(rail: Rail | undefined): void {
    this.object.visible = Boolean(rail);
    if (!rail) return;
    const forkY = rail.y - rail.radius;
    for (const mesh of this.object.children) {
      const { side, lean } = mesh.userData as { side?: number; lean?: number };
      if (mesh.name === 'pole') {
        mesh.scale.set(rail.radius, HALF_LENGTH * 2, rail.radius);
        mesh.position.set(0, rail.y, rail.z);
      } else if (mesh.name === 'stake') {
        mesh.scale.set(1, forkY, 1);
        mesh.position.set(side! * STAKE_X, forkY / 2, rail.z);
      } else if (mesh.name === 'prong') {
        // The fork opens front and back, cradling the pole.
        mesh.rotation.x = lean! * PRONG_TILT;
        mesh.position.set(
          side! * STAKE_X,
          forkY + (Math.cos(PRONG_TILT) * PRONG_LENGTH) / 2,
          rail.z + (lean! * Math.sin(PRONG_TILT) * PRONG_LENGTH) / 2,
        );
      }
    }
  }
}

/** Lengthwise bark streaks, wrapped round the pole and stakes. */
function barkTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#8a6d4f';
  ctx.fillRect(0, 0, 256, 256);
  let seed = 7;
  const random = (): number => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 140; i++) {
    const x = random() * 256;
    const shade = 90 + random() * 90;
    ctx.strokeStyle = `rgba(${shade}, ${shade * 0.8}, ${shade * 0.6}, ${0.25 + random() * 0.4})`;
    ctx.lineWidth = 1 + random() * 4;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.bezierCurveTo(x + random() * 12 - 6, 85, x + random() * 12 - 6, 170, x + random() * 8 - 4, 256);
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 1);
  return texture;
}
