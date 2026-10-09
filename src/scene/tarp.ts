import * as THREE from 'three';

/**
 * A camp tarp spread on the grass: olive canvas with a woven texture, a
 * darker hem and metal eyelets along the edges. Knots tied lying down are
 * laid out on it. Hidden until a knot needs it.
 */
export class Tarp {
  readonly object: THREE.Mesh;

  constructor(area: { x: number; z: number; width: number; depth: number; top: number }) {
    const texture = canvasTexture(area.width / area.depth);
    this.object = new THREE.Mesh(
      new THREE.PlaneGeometry(area.width, area.depth),
      new THREE.MeshStandardMaterial({ map: texture, roughness: 0.95 }),
    );
    this.object.rotation.x = -Math.PI / 2;
    this.object.position.set(area.x, area.top, area.z);
    this.object.receiveShadow = true;
    this.object.visible = false;
  }

  show(visible: boolean): void {
    this.object.visible = visible;
  }
}

function canvasTexture(aspect: number): THREE.CanvasTexture {
  const height = 512;
  const width = Math.round(height * aspect);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#5f6440';
  ctx.fillRect(0, 0, width, height);
  // Woven canvas: fine threads both ways, a little uneven.
  let seed = 3;
  const random = (): number => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let x = 0; x < width; x += 2) {
    ctx.fillStyle = `rgba(30, 32, 18, ${0.08 + random() * 0.1})`;
    ctx.fillRect(x, 0, 1, height);
  }
  for (let y = 0; y < height; y += 2) {
    ctx.fillStyle = `rgba(200, 205, 160, ${0.04 + random() * 0.06})`;
    ctx.fillRect(0, y, width, 1);
  }
  // Soft creases where it was folded.
  for (const at of [0.33, 0.66]) {
    const gradient = ctx.createLinearGradient(width * at - 14, 0, width * at + 14, 0);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(0.5, 'rgba(0, 0, 0, 0.12)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(width * at - 14, 0, 28, height);
  }
  // Hem and eyelets.
  const hem = 14;
  ctx.strokeStyle = 'rgba(30, 32, 18, 0.55)';
  ctx.lineWidth = hem;
  ctx.strokeRect(hem / 2, hem / 2, width - hem, height - hem);
  ctx.strokeStyle = 'rgba(220, 220, 180, 0.35)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 4]);
  ctx.strokeRect(hem + 3, hem + 3, width - 2 * hem - 6, height - 2 * hem - 6);
  ctx.setLineDash([]);
  const eyelet = (x: number, y: number): void => {
    ctx.fillStyle = '#b9b39a';
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2a2a1c';
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
  };
  for (const fx of [0, 0.5, 1]) for (const fy of [0, 0.5, 1]) if (fx !== 0.5 || fy !== 0.5) eyelet(hem / 2 + fx * (width - hem), hem / 2 + fy * (height - hem));
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}
