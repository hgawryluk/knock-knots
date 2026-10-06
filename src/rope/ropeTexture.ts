import * as THREE from 'three';

export interface RopeColors {
  base: string;
  strand: string;
  fleck: string;
}

/**
 * Braided-sheath texture. U runs along the rope, V around it; one texture
 * tile spans one circumference so the diagonal strands sit at 45°.
 */
export function createRopeTexture(colors: RopeColors): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = colors.base;
  ctx.fillRect(0, 0, size, size);

  const strands = 8;
  const period = size / strands;
  const drawDiagonals = (offset: number, width: number, style: string, step = 1, mirrored = false): void => {
    ctx.lineWidth = width;
    ctx.strokeStyle = style;
    for (let k = -strands; k <= strands * 2; k += step) {
      const x = k * period + offset;
      ctx.beginPath();
      ctx.moveTo(x, mirrored ? size : 0);
      ctx.lineTo(x + size, mirrored ? 0 : size);
      ctx.stroke();
    }
  };

  // Two counter-rotating strand sets give the woven look.
  drawDiagonals(0, period * 0.32, colors.strand);
  drawDiagonals(period * 0.5, period * 0.2, colors.strand, 1, true);
  drawDiagonals(period * 0.25, period * 0.14, colors.fleck, 4);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  return texture;
}
