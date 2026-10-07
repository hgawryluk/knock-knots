import * as THREE from 'three';

export interface RopeColors {
  /** Colour of the strands where they're most exposed. */
  strand: string;
  /** Colour down in the grooves between strands. */
  groove: string;
}

export interface RopeTextures {
  map: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
}

/**
 * Tight diamond-braided sheath, like a climbing or accessory cord. U runs along
 * the rope, V around it; one tile spans one circumference, so the two strand
 * sets cross at 45°. Strands alternate over/under like a real weave. Colour and
 * a normal map both come from the same woven height field.
 */
export function createRopeTextures(colors: RopeColors): RopeTextures {
  const size = 256;
  const strands = 8;
  const height = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const a = (u + v) * strands;
      const b = (u - v) * strands + 0.5;
      // Rounded strand profile across each strand's width.
      const profile = (s: number): number => {
        const d = Math.abs(s - Math.floor(s) - 0.5) * 2;
        return Math.sqrt(Math.max(1 - d * d, 0));
      };
      // Over/under: at each crossing one set lies on top, alternating along both directions.
      const aOnTop = (Math.floor(a) + Math.floor(b)) % 2 === 0;
      const ha = profile(a) * (aOnTop ? 1 : 0.62);
      const hb = profile(b) * (aOnTop ? 0.62 : 1);
      height[y * size + x] = Math.max(ha, hb);
    }
  }

  const strand = new THREE.Color(colors.strand);
  const groove = new THREE.Color(colors.groove);
  const tint = new THREE.Color();
  const colorCanvas = makeCanvas(size);
  const normalCanvas = makeCanvas(size);
  const color = colorCanvas.ctx.createImageData(size, size);
  const normal = normalCanvas.ctx.createImageData(size, size);
  const at = (x: number, y: number): number => height[((y + size) % size) * size + ((x + size) % size)];
  const strength = 2.2;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const h = at(x, y);
      tint.copy(groove).lerp(strand, Math.pow(h, 0.45));
      color.data[i] = tint.r * 255;
      color.data[i + 1] = tint.g * 255;
      color.data[i + 2] = tint.b * 255;
      color.data[i + 3] = 255;

      const nx = (at(x - 1, y) - at(x + 1, y)) * strength;
      const ny = (at(x, y - 1) - at(x, y + 1)) * strength;
      const len = Math.hypot(nx, ny, 1);
      normal.data[i] = (nx / len * 0.5 + 0.5) * 255;
      normal.data[i + 1] = (ny / len * 0.5 + 0.5) * 255;
      normal.data[i + 2] = (1 / len * 0.5 + 0.5) * 255;
      normal.data[i + 3] = 255;
    }
  }
  colorCanvas.ctx.putImageData(color, 0, 0);
  normalCanvas.ctx.putImageData(normal, 0, 0);

  const map = toTexture(colorCanvas.canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  return { map, normalMap: toTexture(normalCanvas.canvas) };
}

function makeCanvas(size: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  return { canvas, ctx: canvas.getContext('2d')! };
}

function toTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  return texture;
}
