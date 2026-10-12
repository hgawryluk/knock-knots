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

/** Seamless weathered granite: grey speckled stone with darker streaks, pale lichen patches and fine cracks. */
export function createRockTexture(size = 1024, seed = 5): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(size);
  const tone = createNoise2D(seed);
  const grain = createNoise2D(seed + 7);
  const lichenNoise = createNoise2D(seed + 13);
  const rng = createRng(seed);

  const dark: Rgb = [112, 109, 104];
  const light: Rgb = [160, 156, 149];
  const warm: Rgb = [150, 132, 112];
  const lichen: Rgb = [178, 180, 158];

  const period = 4;
  const image = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x / size) * period;
      const v = (y / size) * period;
      const t = fbm(tone, u, v, 5, period) * 0.5 + 0.5;
      const g = fbm(grain, u * 16, v * 16, 2, period * 16) * 0.5 + 0.5;
      // Water streaks run down the rock.
      const streak = fbm(tone, u * 3 + 17, v * 0.4, 3, period * 3) * 0.5 + 0.5;
      let c = mix(dark, light, smoothstep(0.25, 0.75, t));
      c = mix(c, warm, smoothstep(0.55, 0.8, fbm(grain, u * 2 + 5, v * 2, 3, period * 2) * 0.5 + 0.5) * 0.35);
      c = mix(c, dark, smoothstep(0.62, 0.8, streak) * 0.45);
      // Speckles of the crystals.
      const speck = g > 0.72 ? 1.18 : g < 0.25 ? 0.78 : 1;
      c = [c[0] * speck, c[1] * speck, c[2] * speck];
      // Sparse, small patches of pale lichen.
      c = mix(c, lichen, smoothstep(0.7, 0.78, fbm(lichenNoise, u * 3, v * 3, 4, period * 3) * 0.5 + 0.5) * 0.4);
      const i = (y * size + x) * 4;
      image.data[i] = c[0];
      image.data[i + 1] = c[1];
      image.data[i + 2] = c[2];
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);

  // Fine cracks.
  ctx.strokeStyle = 'rgba(40, 38, 36, 0.55)';
  for (let i = 0; i < 26; i++) {
    let px = rng() * size;
    let py = rng() * size;
    let angle = rng() * Math.PI * 2;
    ctx.lineWidth = 1 + rng() * 1.5;
    const steps = 6 + ((rng() * 10) | 0);
    for (let s = 0; s < steps; s++) {
      const length = 10 + rng() * 25;
      angle += (rng() - 0.5) * 0.9;
      const nx = px + Math.cos(angle) * length;
      const ny = py + Math.sin(angle) * length;
      const [ax, ay, bx, by] = [px, py, nx, ny];
      drawWrapped(size, ax, ay, length + 4, (qx, qy) => {
        ctx.beginPath();
        ctx.moveTo(qx, qy);
        ctx.lineTo(qx + bx - ax, qy + by - ay);
        ctx.stroke();
      });
      px = nx;
      py = ny;
    }
  }

  return toTexture(canvas);
}
