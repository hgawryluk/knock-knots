import * as THREE from 'three';
import { createRopeTextures } from './ropeTexture';

/** How the working end is finished, like the ends of a real rope. */
export type EndStyle = 'cap' | 'dyed' | 'whipped' | 'taped' | 'aglet';
export const END_STYLES: EndStyle[] = ['cap', 'dyed', 'whipped', 'taped', 'aglet'];

const BLUE = '#2f7cf6';
const RADIAL = 18;
const MAX_RINGS = 220;

interface Finish {
  /** How far back from the tip it reaches, in rope radii. */
  length: number;
  /** Sleeve radius (in rope radii) from where it starts (0) to the tip (1). */
  radius: (t: number) => number;
  material: THREE.Material;
  /** UVs: 'braid' continues the rope's weave; 'thread' winds round it. */
  uv: 'braid' | 'thread' | 'plain';
  tip: 'round' | 'cut';
}

/** The rope as the end mesh needs it: ring centres, frames round them, and distance along the rope. */
export interface RopeRings {
  centers: Float32Array;
  normals: Float32Array;
  binormals: Float32Array;
  along: Float32Array;
  count: number;
}

/**
 * The working end's finish: a sleeve over the last few centimetres of rope
 * that follows its curve (dyed braid, whipping thread, tape or a plastic
 * aglet), and a tip — rounded, or cut flat showing the rope's fibres.
 */
export class RopeEnd {
  readonly object = new THREE.Group();
  private readonly geometry = new THREE.BufferGeometry();
  private readonly sleeve: THREE.Mesh;
  private readonly roundTip: THREE.Mesh;
  private readonly cutTip: THREE.Mesh;
  private readonly finishes: Record<Exclude<EndStyle, 'cap'>, Finish>;
  private finish: Finish | null = null;

  constructor(private readonly radius: number) {
    const vertices = MAX_RINGS * (RADIAL + 1);
    this.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices * 3), 3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(vertices * 3), 3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(vertices * 2), 2).setUsage(THREE.DynamicDrawUsage));
    const indices: number[] = [];
    for (let i = 0; i < MAX_RINGS - 1; i++) {
      for (let j = 0; j < RADIAL; j++) {
        const a = i * (RADIAL + 1) + j;
        const b = a + RADIAL + 1;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    this.geometry.setIndex(indices);

    const dyed = createRopeTextures({ strand: '#4d93ff', groove: '#123a80' });
    const thread = threadTextures();
    const plastic = new THREE.MeshPhysicalMaterial({ color: BLUE, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.15 });
    this.finishes = {
      dyed: {
        length: 6,
        radius: () => 1.012,
        material: new THREE.MeshPhysicalMaterial({
          map: dyed.map,
          normalMap: dyed.normalMap,
          normalScale: new THREE.Vector2(1.2, 1.2),
          roughness: 0.6,
          sheen: 0.6,
          sheenRoughness: 0.45,
          sheenColor: new THREE.Color('#a8ccff'),
        }),
        uv: 'braid',
        tip: 'round',
      },
      whipped: {
        length: 3.4,
        radius: () => 1.07,
        material: new THREE.MeshStandardMaterial({ map: thread.map, normalMap: thread.normalMap, roughness: 0.55 }),
        uv: 'thread',
        tip: 'cut',
      },
      taped: {
        length: 3,
        radius: () => 1.09,
        material: new THREE.MeshPhysicalMaterial({ color: BLUE, roughness: 0.38, clearcoat: 0.5, clearcoatRoughness: 0.3 }),
        uv: 'plain',
        tip: 'cut',
      },
      aglet: {
        length: 3.8,
        // Never narrower than the rope inside it; just a slight taper into a rounded tip.
        radius: (t) => 1.1 - 0.08 * t * t,
        material: plastic,
        uv: 'plain',
        tip: 'round',
      },
    };
    for (const finish of Object.values(this.finishes)) finish.material.side = THREE.DoubleSide;

    this.sleeve = new THREE.Mesh(this.geometry, this.finishes.dyed.material);
    this.sleeve.frustumCulled = false;
    this.roundTip = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), this.finishes.dyed.material);
    this.cutTip = new THREE.Mesh(new THREE.CircleGeometry(1, 28), new THREE.MeshStandardMaterial({ map: cutFaceTexture(), roughness: 0.9 }));
    for (const mesh of [this.sleeve, this.roundTip, this.cutTip]) mesh.castShadow = true;
    this.object.add(this.sleeve, this.roundTip, this.cutTip);
  }

  /** Switches finish; 'cap' hides this (the rope's own blue cap shows instead). */
  setStyle(style: EndStyle): void {
    this.finish = style === 'cap' ? null : this.finishes[style];
    this.object.visible = Boolean(this.finish);
    if (!this.finish) return;
    this.sleeve.material = this.finish.material;
    this.roundTip.material = this.finish.material;
    this.roundTip.visible = this.finish.tip === 'round';
    this.cutTip.visible = this.finish.tip === 'cut';
  }

  update(rings: RopeRings): void {
    const finish = this.finish;
    if (!finish) return;
    const { centers: c, normals, binormals, along, count } = rings;
    const r = this.radius;
    const end = along[count - 1];
    const start = Math.max(end - finish.length * r, 0);
    let first = count - 1;
    while (first > 0 && along[first - 1] >= start && count - first < MAX_RINGS) first--;
    const used = count - first;

    const position = this.geometry.attributes.position as THREE.BufferAttribute;
    const normal = this.geometry.attributes.normal as THREE.BufferAttribute;
    const uv = this.geometry.attributes.uv as THREE.BufferAttribute;
    const n = new THREE.Vector3();
    const b = new THREE.Vector3();
    const dir = new THREE.Vector3();
    const circumference = Math.PI * 2 * r;
    for (let k = 0; k < used; k++) {
      const i = first + k;
      const t = finish.length > 0 ? (along[i] - start) / (end - start || 1) : 1;
      const radius = r * finish.radius(t);
      n.fromArray(normals, i * 3);
      b.fromArray(binormals, i * 3);
      for (let j = 0; j <= RADIAL; j++) {
        const angle = (j / RADIAL) * Math.PI * 2;
        dir.copy(n).multiplyScalar(-Math.cos(angle)).addScaledVector(b, Math.sin(angle));
        const v = k * (RADIAL + 1) + j;
        position.setXYZ(v, c[i * 3] + dir.x * radius, c[i * 3 + 1] + dir.y * radius, c[i * 3 + 2] + dir.z * radius);
        normal.setXYZ(v, dir.x, dir.y, dir.z);
        // Braid lines up with the rope's own weave; thread winds many times per rope width.
        const u = finish.uv === 'thread' ? (along[i] - start) / (r * 0.14) : along[i] / circumference;
        uv.setXY(v, u, j / RADIAL);
      }
    }
    position.needsUpdate = true;
    normal.needsUpdate = true;
    uv.needsUpdate = true;
    this.geometry.setDrawRange(0, Math.max(used - 1, 0) * RADIAL * 6);

    // The tip faces along the rope at its very end.
    const last = (count - 1) * 3;
    const before = Math.max(count - 3, 0) * 3;
    const tangent = new THREE.Vector3(c[last] - c[before], c[last + 1] - c[before + 1], c[last + 2] - c[before + 2]).normalize();
    const tipRadius = r * finish.radius(1);
    this.roundTip.position.fromArray(c, last);
    this.roundTip.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent);
    this.roundTip.scale.set(tipRadius, tipRadius * 0.9, tipRadius);
    this.cutTip.position.fromArray(c, last);
    this.cutTip.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent);
    this.cutTip.scale.setScalar(tipRadius);
  }
}

/** Fine thread wound round the rope: stripes across it, each slightly rounded. */
function threadTextures(): { map: THREE.CanvasTexture; normalMap: THREE.CanvasTexture } {
  const w = 64;
  const h = 16;
  const color = document.createElement('canvas');
  color.width = w;
  color.height = h;
  const normal = document.createElement('canvas');
  normal.width = w;
  normal.height = h;
  const cc = color.getContext('2d')!;
  const nc = normal.getContext('2d')!;
  const ci = cc.createImageData(w, h);
  const ni = nc.createImageData(w, h);
  const base = new THREE.Color(BLUE);
  const dark = new THREE.Color('#0d2a66');
  const tint = new THREE.Color();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // One winding per texture repeat along u (x); rounded profile across it.
      const s = (x / w) * 2 - 1;
      const height = Math.sqrt(Math.max(1 - s * s, 0));
      tint.copy(dark).lerp(base, Math.pow(height, 0.5));
      const i = (y * w + x) * 4;
      ci.data.set([tint.r * 255, tint.g * 255, tint.b * 255, 255], i);
      const nx = -s / Math.max(height, 0.2);
      const len = Math.hypot(nx * 0.6, 1);
      ni.data.set([((nx * 0.6) / len * 0.5 + 0.5) * 255, 128, (1 / len * 0.5 + 0.5) * 255, 255], i);
    }
  }
  cc.putImageData(ci, 0, 0);
  nc.putImageData(ni, 0, 0);
  const map = new THREE.CanvasTexture(color);
  map.colorSpace = THREE.SRGBColorSpace;
  const normalMap = new THREE.CanvasTexture(normal);
  for (const texture of [map, normalMap]) {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = 8;
  }
  return { map, normalMap };
}

/** The rope cut straight across: a gold disc of fibre ends, the braid sheath round a softer core. */
function cutFaceTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#b07a12';
  ctx.fillRect(0, 0, size, size);
  let seed = 11;
  const random = (): number => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 900; i++) {
    const angle = random() * Math.PI * 2;
    const d = Math.sqrt(random()) * size * 0.5;
    const sheath = d > size * 0.36;
    ctx.fillStyle = sheath ? `rgba(255, 207, 74, ${0.5 + random() * 0.5})` : `rgba(240, 214, 150, ${0.4 + random() * 0.5})`;
    ctx.beginPath();
    ctx.arc(size / 2 + Math.cos(angle) * d, size / 2 + Math.sin(angle) * d, 1 + random() * 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
