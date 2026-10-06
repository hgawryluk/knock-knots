import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { createNoise2D, createRng } from '../utils/noise';
import { createBranch, type Branch } from './branch';
import { createGroundTexture, createLeafShadowTexture } from './textures';

const BACKGROUND = '#262b1c';

export interface Meadow {
  root: THREE.Group;
  branch: Branch;
  update: (dt: number, elapsed: number) => void;
}

/** Forest-floor clearing: ground, grass tufts, two stones and a branch resting on them, in dappled sun. */
export function createMeadow(scene: THREE.Scene): Meadow {
  scene.background = new THREE.Color(BACKGROUND);
  scene.fog = new THREE.Fog(BACKGROUND, 11, 26);

  const root = new THREE.Group();
  root.add(createGround(), createGrass(), ...createStones());

  const branch = createBranch();
  root.add(branch.object);

  const hemisphere = new THREE.HemisphereLight('#e4ecd2', '#3b3122', 0.9);
  root.add(hemisphere);

  const sun = new THREE.SpotLight('#fff0d4', 3.2, 0, 0.55, 0.75, 0);
  sun.position.set(5, 16, 4);
  sun.map = createLeafShadowTexture();
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  sun.shadow.camera.near = 8;
  sun.shadow.camera.far = 30;
  root.add(sun, sun.target);

  // A slow drift of the sun makes the canopy shade feel alive.
  const update = (_dt: number, elapsed: number): void => {
    sun.position.x = 5 + Math.sin(elapsed * 0.35) * 0.25;
    sun.position.z = 4 + Math.cos(elapsed * 0.27) * 0.2;
  };

  return { root, branch, update };
}

function createGround(): THREE.Mesh {
  const texture = createGroundTexture();
  texture.repeat.set(6, 6);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 60),
    new THREE.MeshStandardMaterial({ map: texture, bumpMap: texture, bumpScale: 2, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  return ground;
}

/** Instanced blades scattered in patches; denser where the ground noise says grass. */
function createGrass(): THREE.InstancedMesh {
  const blade = new THREE.PlaneGeometry(0.035, 1, 1, 4);
  blade.translate(0, 0.5, 0);
  const position = blade.attributes.position;
  for (let i = 0; i < position.count; i++) {
    const y = position.getY(i);
    position.setX(i, position.getX(i) * (1 - y * 0.85));
    position.setZ(i, y * y * 0.18);
  }
  blade.computeVertexNormals();

  const count = 9000;
  const material = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.9 });
  const mesh = new THREE.InstancedMesh(blade, material, count);
  mesh.receiveShadow = true;

  const rng = createRng(17);
  const patches = createNoise2D(4);
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const scale = new THREE.Vector3();
  const offset = new THREE.Vector3();
  const color = new THREE.Color();

  let placed = 0;
  while (placed < count) {
    const radius = Math.sqrt(rng()) * 10;
    const angle = rng() * Math.PI * 2;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    if (patches(x * 0.6, z * 0.6) * 0.5 + 0.5 < rng() * 0.9) continue;

    euler.set((rng() - 0.5) * 0.5, rng() * Math.PI * 2, (rng() - 0.5) * 0.5);
    quaternion.setFromEuler(euler);
    const height = 0.07 + rng() * 0.2;
    scale.set(0.7 + rng() * 0.8, height, 1);
    offset.set(x, 0, z);
    matrix.compose(offset, quaternion, scale);
    mesh.setMatrixAt(placed, matrix);
    color.setHSL(0.21 + rng() * 0.06, 0.45 + rng() * 0.2, 0.2 + rng() * 0.16);
    mesh.setColorAt(placed, color);
    placed++;
  }
  return mesh;
}

function createStones(): THREE.Mesh[] {
  return [
    createStone(0.48, 0.34, new THREE.Vector3(-1.45, 0, 0.02), 31),
    createStone(0.44, 0.31, new THREE.Vector3(1.4, 0, 0.06), 47),
  ];
}

/** Lumpy, slightly flattened stone whose top sits at `height`. */
function createStone(radius: number, height: number, position: THREE.Vector3, seed: number): THREE.Mesh {
  const sphere = new THREE.IcosahedronGeometry(radius, 5);
  sphere.deleteAttribute('normal');
  sphere.deleteAttribute('uv');
  // Icosahedron vertices are unshared; merge them so normals smooth across faces.
  const geometry = mergeVertices(sphere);
  const noise = createNoise2D(seed);
  const p = geometry.attributes.position;
  const v = new THREE.Vector3();
  const colors: number[] = [];
  const color = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = v.clone().normalize();
    const bump = noise(n.x * 2.2 + n.y * 1.3, n.z * 2.2 - n.y * 0.7) * 0.12 + noise(n.x * 7, n.z * 7 + n.y * 3) * 0.03;
    v.multiplyScalar(1 + bump);
    v.y *= 0.72;
    p.setXYZ(i, v.x, v.y, v.z);
    color.setHSL(0.11, 0.05, 0.32 + bump * 1.2 + noise(n.x * 12, n.z * 12) * 0.04);
    colors.push(color.r, color.g, color.b);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();

  const stone = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
  stone.position.copy(position);
  stone.position.y = height - geometry.boundingBox!.max.y;
  stone.rotation.y = seed;
  stone.castShadow = stone.receiveShadow = true;
  return stone;
}
