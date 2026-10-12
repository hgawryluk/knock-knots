import * as THREE from 'three';
import { CARABINER } from '../knots/paths';
import { createNoise2D, fbm } from '../utils/noise';
import { ROCK_GAP } from './carabiner';
import { loadModel } from './models';
import { createRockTexture } from './textures';

/** The valley floor, far below the stance, and the sky dome round everything. */
const VALLEY = -420;
const SKY_RADIUS = 2300;
/** Thin, clear high-altitude air: only a pale blue haze at the horizon. */
const HAZE = '#a9c3e0';
/** The cliff face the bolt is fixed in (world z), right behind the carabiner. */
const FACE = CARABINER.z - ROCK_GAP;
/** Where the bolt hanger sits on the face, kept flat around it. */
const BOLT = { x: CARABINER.x - 0.035, y: CARABINER.y + 0.74 };
/** The buttress: from far left to its rounded right edge just beyond the knot, and its top. */
const LEFT = -4.2;
const RIGHT = 0.55;
const BACK = FACE - 3.2;
const EDGE_ROUND = 0.4;

export interface Crag {
  root: THREE.Group;
  fog: THREE.Fog;
  update: (dt: number, elapsed: number) => void;
}

/**
 * A belay stance high in the mountains: the carabiner hangs from a bolt near the
 * top of a granite buttress whose face drops away below (the rope runs down it to
 * the climber). To its right the ground falls
 * into a deep valley below huge snow-dusted peaks under a deep blue sky (after a
 * photo of a Himalayan trail the user shared).
 */
export async function createCrag(): Promise<Crag> {
  const root = new THREE.Group();
  const stoneSource = await loadModel('stone.glb');

  const rockTexture = createRockTexture();
  const rock = new THREE.MeshStandardMaterial({ map: rockTexture, bumpMap: rockTexture, bumpScale: 3, roughness: 0.95 });
  const buttress = createButtress(rock);
  const ledge = createLedge(rock);
  root.add(buttress, createCliffBelow(rock), ledge, ...placeStones(stoneSource, [buttress, ledge]));
  root.add(createSky(), createValley(), createMountains());

  const hemisphere = new THREE.HemisphereLight('#cfe0f7', '#6e6250', 1.0);
  root.add(hemisphere);
  // Bright high-altitude sun from the front right.
  const sun = new THREE.DirectionalLight('#fff4e2', 2.6);
  sun.position.set(CARABINER.x + 5, CARABINER.y + 7, CARABINER.z + 6);
  sun.target.position.set(CARABINER.x, CARABINER.y, FACE);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  Object.assign(sun.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 1, far: 30 });
  root.add(sun, sun.target);

  return { root, fog: new THREE.Fog(HAZE, 300, 2400), update: () => {} };
}

/** Pseudo-3D fractal noise from three 2D slices, in about [-1, 1]. */
function rockNoise(noise: ReturnType<typeof createNoise2D>, x: number, y: number, z: number, scale: number, octaves = 4): number {
  return (fbm(noise, x * scale, y * scale, octaves) + fbm(noise, z * scale + 31, y * scale + 7, octaves) + fbm(noise, x * scale + 13, z * scale + 57, octaves)) / 3;
}

/** Height of the buttress top above x: high on the left, stepping down to just above the bolt at its right edge. */
function topAt(x: number): number {
  const t = THREE.MathUtils.smoothstep(x, -1.6, RIGHT);
  return THREE.MathUtils.lerp(BOLT.y + 1.05, BOLT.y + 0.22, t);
}

/**
 * The upper buttress: a block shaped by noise into weathered granite. The face
 * stays behind the plane of the hanger plate (flat right round the bolt), its
 * right-hand edge is rounded off, and its top slopes down to the right.
 */
function createButtress(material: THREE.Material): THREE.Mesh {
  const bottom = CARABINER.y - 2.4;
  const height = BOLT.y + 1.1 - bottom;
  const geometry = new THREE.BoxGeometry(RIGHT - LEFT, height, FACE - BACK, 96, 72, 48);
  geometry.translate((LEFT + RIGHT) / 2, bottom + height / 2, (FACE + BACK) / 2);
  boxUv(geometry, [96, 72, 48], 0.45);
  const noise = createNoise2D(21);
  const p = geometry.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    // Top slopes with x.
    const k = (v.y - bottom) / height;
    v.y = bottom + k * (topAt(v.x) - bottom);
    // Round the right front edge.
    const cx = RIGHT - EDGE_ROUND;
    const cz = FACE - EDGE_ROUND;
    if (v.x > cx && v.z > cz) {
      const dx = v.x - cx;
      const dz = v.z - cz;
      const d = Math.hypot(dx, dz);
      const r = EDGE_ROUND * Math.min(1, Math.max(dx, dz) / d);
      v.x = cx + (dx / d) * r;
      v.z = cz + (dz / d) * r;
    }
    // Weathering: lumps pressing in from every face (never out past the face).
    const lump = rockNoise(noise, v.x, v.y, v.z, 0.55) * 0.42 + rockNoise(noise, v.x + 3, v.y, v.z, 1.8, 3) * 0.12 + rockNoise(noise, v.x, v.y, v.z, 6, 2) * 0.025;
    const toCentre = new THREE.Vector3((LEFT + RIGHT) / 2 - v.x, (bottom + height / 2) - v.y, (FACE + BACK) / 2 - v.z).normalize();
    v.addScaledVector(toCentre, Math.abs(lump) + 0.015);
    // Flat round the bolt so the hanger plate sits on the rock.
    const nearBolt = 1 - THREE.MathUtils.smoothstep(Math.hypot((v.x - BOLT.x) / 0.32, (v.y - BOLT.y) / 0.24), 0.6, 1.2);
    if (v.z > FACE - 0.3) v.z = THREE.MathUtils.lerp(v.z, FACE - 0.002, nearBolt);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** The face carrying on down far below the stance, out of sight into the haze. */
function createCliffBelow(material: THREE.Material): THREE.Mesh {
  const top = CARABINER.y - 2.2;
  const geometry = new THREE.BoxGeometry(7, 60, 6, 28, 120, 16);
  geometry.translate(LEFT + 3.2, top - 30, FACE - 3.05);
  boxUv(geometry, [28, 120, 16], 0.3);
  const noise = createNoise2D(33);
  const p = geometry.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    // Leaning back a little further down, with big buttresses and grooves.
    const depth = (top - v.y) * 0.08;
    v.z -= depth;
    v.z -= Math.abs(rockNoise(noise, v.x, v.y, v.z, 0.35)) * 1.2;
    v.x += rockNoise(noise, v.y, v.z, v.x, 0.2) * 0.8;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  return mesh;
}

/** A sloping ledge off to the right of the buttress, below the stance, where the belayer could stand. */
function createLedge(material: THREE.Material): THREE.Mesh {
  const geometry = new THREE.BoxGeometry(3.2, 1.2, 2.6, 48, 12, 40);
  geometry.translate(RIGHT + 1.2, CARABINER.y - 1.75, FACE - 0.2);
  boxUv(geometry, [48, 12, 40], 0.45);
  const noise = createNoise2D(41);
  const p = geometry.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    // Falls away to the right and toward the drop.
    v.y -= (v.x - RIGHT) * 0.22 + Math.max(0, v.z - FACE) * 0.3;
    v.y += rockNoise(noise, v.x, v.y, v.z, 1.2) * 0.18;
    v.z += rockNoise(noise, v.z, v.x, v.y, 0.8) * 0.15;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * The scanned stone, a few copies lying on the ledge and the buttress top. Each is
 * dropped onto `surfaces`: it settles to the lowest point under its footprint and
 * beds in a little, so it never floats over a dip in the rock.
 */
function placeStones(source: THREE.Object3D, surfaces: THREE.Mesh[]): THREE.Object3D[] {
  const box = new THREE.Box3().setFromObject(source);
  const size = box.getSize(new THREE.Vector3());
  for (const surface of surfaces) surface.updateMatrixWorld();
  const raycaster = new THREE.Raycaster();
  const down = new THREE.Vector3(0, -1, 0);
  const from = new THREE.Vector3();
  const groundAt = (x: number, z: number): number | undefined => {
    raycaster.set(from.set(x, 20, z), down);
    return raycaster.intersectObjects(surfaces, false)[0]?.point.y;
  };
  const placements = [
    { x: RIGHT + 0.9, z: FACE + 0.15, height: 0.22, turn: 0.8 },
    { x: RIGHT + 1.6, z: FACE - 0.4, height: 0.32, turn: 2.1 },
    { x: -1.4, z: FACE - 0.9, height: 0.28, turn: 4.0 },
  ];
  return placements.flatMap(({ x, z, height, turn }) => {
    const scale = height / size.y;
    const reach = (Math.max(size.x, size.z) * scale) / 2;
    const heights = [
      [0, 0],
      [reach, 0],
      [-reach, 0],
      [0, reach],
      [0, -reach],
    ].map(([dx, dz]) => groundAt(x + dx, z + dz));
    if (heights.some((h) => h === undefined)) return [];
    const ground = Math.min(...(heights as number[]));
    const stone = source.clone();
    stone.scale.setScalar(scale);
    stone.rotation.y = turn;
    stone.position.set(x, ground - height * 0.15 - box.min.y * scale, z);
    return [stone];
  });
}

/**
 * UVs in metres times `perMetre`, each face of the box projected flat along its
 * own axis (worked out from the box before it is shaped, so the texture never
 * jumps between projections inside a face). `segments` as given to BoxGeometry.
 */
function boxUv(geometry: THREE.BufferGeometry, [sx, sy, sz]: [number, number, number], perMetre: number): void {
  const p = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  // BoxGeometry builds its faces in this order: +x, -x, +y, -y, +z, -z.
  const faces: [number, 'zy' | 'xz' | 'xy'][] = [
    [(sz + 1) * (sy + 1), 'zy'],
    [(sz + 1) * (sy + 1), 'zy'],
    [(sx + 1) * (sz + 1), 'xz'],
    [(sx + 1) * (sz + 1), 'xz'],
    [(sx + 1) * (sy + 1), 'xy'],
    [(sx + 1) * (sy + 1), 'xy'],
  ];
  let i = 0;
  for (const [count, plane] of faces) {
    for (let k = 0; k < count; k++, i++) {
      const [u, w] = plane === 'zy' ? [p.getZ(i), p.getY(i)] : plane === 'xz' ? [p.getX(i), p.getZ(i)] : [p.getX(i), p.getY(i)];
      uv.setXY(i, u * perMetre, w * perMetre);
    }
  }
}

/** Sky dome: deep blue overhead fading to pale haze at the horizon. */
function createSky(): THREE.Mesh {
  const geometry = new THREE.SphereGeometry(SKY_RADIUS, 32, 16);
  const zenith = new THREE.Color('#2a63b0');
  const horizon = new THREE.Color(HAZE);
  const colors: number[] = [];
  const p = geometry.attributes.position;
  const c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const up = Math.max(0, p.getY(i) / SKY_RADIUS);
    c.copy(horizon).lerp(zenith, Math.pow(up, 0.4));
    colors.push(c.r, c.g, c.b);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const sky = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  sky.renderOrder = -1;
  return sky;
}

/** The valley floor far below, lost in haze. */
function createValley(): THREE.Mesh {
  const valley = new THREE.Mesh(new THREE.PlaneGeometry(5000, 5000), new THREE.MeshLambertMaterial({ color: '#7d7050' }));
  valley.rotation.x = -Math.PI / 2;
  valley.position.y = VALLEY - 5;
  return valley;
}

/**
 * The mountains all round: a ring of terrain from the valley floor below the
 * stance out to the horizon, raised into sharp ridges and peaks (higher further
 * out) with snow on the high, gentler slopes and bare rock on the steep ones.
 */
function createMountains(): THREE.Mesh {
  const noise = createNoise2D(5);
  const rings = 110;
  const spokes = 720;
  const inner = 420;
  const outer = 2000;
  const ridged = (x: number, z: number): number => {
    // Crests: folded noise, sharpened.
    const n = 1 - Math.abs(fbm(noise, x, z, 6));
    return Math.pow(n, 1.6);
  };
  const positions: number[] = [];
  for (let i = 0; i <= rings; i++) {
    const t = i / rings;
    const r = inner + (outer - inner) * Math.pow(t, 1.6);
    for (let j = 0; j < spokes; j++) {
      const a = (j / spokes) * Math.PI * 2;
      const x = Math.sin(a) * r;
      const z = CARABINER.z - Math.cos(a) * r;
      // Rises out of the valley, peaks taller toward the horizon.
      const rise = THREE.MathUtils.smoothstep(r, inner, inner + 300);
      const peaks = 200 + 450 * THREE.MathUtils.smoothstep(r, 600, 1800);
      const y = VALLEY + rise * (80 + peaks * ridged(x * 0.0018, z * 0.0018) + 40 * fbm(noise, x * 0.01 + 9, z * 0.01, 3));
      positions.push(x, y, z);
    }
  }
  const indices: number[] = [];
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < spokes; j++) {
      const a = i * spokes + j;
      const b = i * spokes + ((j + 1) % spokes);
      const c = a + spokes;
      const d = b + spokes;
      indices.push(a, b, c, b, d, c);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  // Snow dusted over every slope gentle enough to hold it, dark banded rock on the steep
  // ones, dry brown grass low down.
  const normal = geometry.attributes.normal;
  const colors: number[] = [];
  const rockColor = new THREE.Color('#5e5c5a');
  const lowColor = new THREE.Color('#8d7a55');
  const snow = new THREE.Color('#f4f7fb');
  const c = new THREE.Color();
  for (let k = 0; k < positions.length / 3; k++) {
    const y = positions[k * 3 + 1];
    const flat = normal.getY(k);
    c.copy(lowColor).lerp(rockColor, THREE.MathUtils.smoothstep(y, VALLEY + 60, VALLEY + 130));
    // Darker strata.
    const x = positions[k * 3];
    const z = positions[k * 3 + 2];
    if (Math.sin(y * 0.09 + fbm(noise, x * 0.01, z * 0.01, 2) * 4) > 0.55) c.multiplyScalar(0.72);
    const patchy = 0.55 + 0.45 * fbm(noise, x * 0.02 + 3, z * 0.02 + 8, 3);
    const snowy = THREE.MathUtils.smoothstep(y, -220, -100) * THREE.MathUtils.smoothstep(flat, 0.55, 0.82) * patchy;
    c.lerp(snow, snowy);
    colors.push(c.r, c.g, c.b);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ vertexColors: true }));
}
