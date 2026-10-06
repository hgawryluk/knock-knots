import * as THREE from 'three';
import { createNoise2D, createRng, fbm } from '../utils/noise';

type Rgb = [number, number, number];

const smoothstep = (a: number, b: number, x: number): number => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

const mix = (a: Rgb, b: Rgb, t: number): Rgb => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

function makeCanvas(width: number, height = width): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return [canvas, canvas.getContext('2d')!];
}

function toTexture(canvas: HTMLCanvasElement, repeat = true): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  if (repeat) texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

/** Calls `draw` at every tile offset the shape could overlap, so strokes wrap seamlessly. */
function drawWrapped(size: number, x: number, y: number, margin: number, draw: (x: number, y: number) => void): void {
  for (const dx of [-size, 0, size]) {
    for (const dy of [-size, 0, size]) {
      const px = x + dx;
      const py = y + dy;
      if (px > -margin && px < size + margin && py > -margin && py < size + margin) draw(px, py);
    }
  }
}

/** Seamless forest-floor texture: moss and grass over soil, with blades, dry leaves and twigs. */
export function createGroundTexture(size = 1024, seed = 3): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(size);
  const patches = createNoise2D(seed);
  const detail = createNoise2D(seed + 11);
  const rng = createRng(seed);

  const soil: Rgb = [62, 50, 33];
  const moss: Rgb = [70, 94, 40];
  const grass: Rgb = [106, 134, 52];
  const dry: Rgb = [128, 110, 68];

  const period = 6;
  const image = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x / size) * period;
      const v = (y / size) * period;
      const g = fbm(patches, u, v, 4, period) * 0.5 + 0.5;
      const d = fbm(detail, u * 4, v * 4, 3, period * 4) * 0.5 + 0.5;
      const grassy = smoothstep(0.32, 0.6, g);
      let c = mix(soil, moss, grassy);
      c = mix(c, grass, smoothstep(0.55, 0.85, g) * d);
      c = mix(c, dry, smoothstep(0.55, 0.8, d) * (1 - grassy) * 0.7);
      const grain = 0.82 + rng() * 0.3;
      const i = (y * size + x) * 4;
      image.data[i] = c[0] * grain;
      image.data[i + 1] = c[1] * grain;
      image.data[i + 2] = c[2] * grain;
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);

  ctx.lineCap = 'round';
  for (let i = 0; i < 14000; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const length = 4 + rng() * 12;
    const angle = rng() * Math.PI * 2;
    const light = 0.6 + rng() * 0.7;
    ctx.strokeStyle = `rgba(${(88 * light) | 0}, ${(124 * light) | 0}, ${(46 * light) | 0}, ${0.5 + rng() * 0.5})`;
    ctx.lineWidth = 1 + rng() * 1.5;
    drawWrapped(size, x, y, length, (px, py) => {
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + Math.cos(angle) * length, py + Math.sin(angle) * length);
      ctx.stroke();
    });
  }

  const leafColors = ['#8a6a3a', '#a07a3e', '#6e5530', '#b08a48', '#7b5c34'];
  for (let i = 0; i < 160; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const rx = 4 + rng() * 7;
    const ry = rx * (0.35 + rng() * 0.25);
    const angle = rng() * Math.PI;
    ctx.fillStyle = leafColors[(rng() * leafColors.length) | 0];
    drawWrapped(size, x, y, rx, (px, py) => {
      ctx.beginPath();
      ctx.ellipse(px, py, rx, ry, angle, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  ctx.strokeStyle = '#4a3a26';
  for (let i = 0; i < 70; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const length = 15 + rng() * 40;
    const angle = rng() * Math.PI * 2;
    ctx.lineWidth = 1.5 + rng() * 2;
    drawWrapped(size, x, y, length, (px, py) => {
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.quadraticCurveTo(
        px + Math.cos(angle) * length * 0.5 + (rng() - 0.5) * 8,
        py + Math.sin(angle) * length * 0.5 + (rng() - 0.5) * 8,
        px + Math.cos(angle) * length,
        py + Math.sin(angle) * length,
      );
      ctx.stroke();
    });
  }

  return toTexture(canvas);
}

/** Bark: U runs along the branch, so ridges are horizontal streaks. */
export function createBarkTexture(seed = 5): THREE.CanvasTexture {
  const width = 512;
  const height = 256;
  const [canvas, ctx] = makeCanvas(width, height);
  const ridges = createNoise2D(seed);
  const blotch = createNoise2D(seed + 7);
  const dark: Rgb = [58, 44, 32];
  const mid: Rgb = [104, 84, 62];
  const light: Rgb = [146, 128, 104];
  const lichen: Rgb = [138, 146, 104];

  const image = ctx.createImageData(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const u = (x / width) * 4;
      const v = (y / height) * 24;
      const r = 1 - Math.abs(fbm(ridges, u, v, 4, 4));
      const b = fbm(blotch, (x / width) * 6, (y / height) * 3, 3, 3) * 0.5 + 0.5;
      let c = mix(dark, mid, smoothstep(0.35, 0.75, r));
      c = mix(c, light, smoothstep(0.8, 0.98, r) * 0.8);
      c = mix(c, lichen, smoothstep(0.68, 0.8, b) * 0.5);
      const i = (y * width + x) * 4;
      image.data[i] = c[0];
      image.data[i + 1] = c[1];
      image.data[i + 2] = c[2];
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  return toTexture(canvas);
}

/** Cut-end cross-section with growth rings, centered for a circle's UVs. */
export function createWoodRingsTexture(seed = 9): THREE.CanvasTexture {
  const size = 256;
  const [canvas, ctx] = makeCanvas(size);
  const wobble = createNoise2D(seed);
  const image = ctx.createImageData(size, size);
  const heart: Rgb = [176, 132, 82];
  const sap: Rgb = [222, 192, 146];
  const ring: Rgb = [150, 108, 64];
  const bark: Rgb = [70, 52, 36];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x / size - 0.5;
      const dy = y / size - 0.5;
      const d = Math.hypot(dx, dy) * 2;
      const angle = Math.atan2(dy, dx);
      const w = wobble(Math.cos(angle) * 2 + 4, Math.sin(angle) * 2 + 4) * 0.04;
      const rings = Math.sin((d + w) * 70) * 0.5 + 0.5;
      let c = mix(heart, sap, smoothstep(0.1, 0.7, d));
      c = mix(c, ring, smoothstep(0.75, 1, rings) * 0.6);
      c = mix(c, bark, smoothstep(0.86, 0.93, d + w));
      const i = (y * size + x) * 4;
      image.data[i] = c[0];
      image.data[i + 1] = c[1];
      image.data[i + 2] = c[2];
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  return toTexture(canvas, false);
}

/** Soft blotchy canopy mask projected by the sun spotlight for dappled shade. */
export function createLeafShadowTexture(seed = 13): THREE.CanvasTexture {
  const size = 512;
  const [canvas, ctx] = makeCanvas(size);
  const rng = createRng(seed);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, size, size);

  ctx.filter = 'blur(7px)';
  ctx.fillStyle = 'rgba(40, 40, 40, 0.75)';
  for (let i = 0; i < 46; i++) {
    const cx = rng() * size;
    const cy = rng() * size;
    const spread = 25 + rng() * 55;
    for (let j = 0; j < 14; j++) {
      const r = 5 + rng() * 16;
      ctx.beginPath();
      ctx.ellipse(cx + (rng() - 0.5) * spread * 2, cy + (rng() - 0.5) * spread * 2, r, r * (0.5 + rng() * 0.5), rng() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  return toTexture(canvas, false);
}
