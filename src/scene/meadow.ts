import * as THREE from 'three';
import { createNoise2D, createRng } from '../utils/noise';
import { CanopyShadow } from './canopy';
import { loadLog, type Log } from './log';
import { loadModel } from './models';
import { createGroundTexture } from './textures';

const BACKGROUND = '#262b1c';

export interface Meadow {
  root: THREE.Group;
  log: Log;
  update: (dt: number, elapsed: number) => void;
}

/** Forest-floor clearing: ground, grass tufts, two stones and a scanned log resting on them, in dappled sun. */
export async function createMeadow(scene: THREE.Scene, renderer: THREE.WebGLRenderer): Promise<Meadow> {
  scene.background = new THREE.Color(BACKGROUND);
  scene.fog = new THREE.Fog(BACKGROUND, 11, 26);

  const root = new THREE.Group();
  const [log, stones] = await Promise.all([
    loadLog({ file: 'log.glb', length: 4.2, baseHeight: 0.3 }),
    loadStones(0.31),
  ]);
  const wind = { value: 0 };
  root.add(createGround(), createGrass(wind), ...stones);
  root.add(log.object);


  const hemisphere = new THREE.HemisphereLight('#e4ecd2', '#3b3122', 0.9);
  root.add(hemisphere);

  const sun = new THREE.SpotLight('#fff0d4', 3.2, 0, 0.55, 0.75, 0);
  sun.position.set(5, 16, 4);
  const canopy = new CanopyShadow();
  sun.map = canopy.texture;
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  sun.shadow.camera.near = 8;
  sun.shadow.camera.far = 30;
  root.add(sun, sun.target);

  // Canopy shade and grass share one wind clock so gusts feel connected.
  const update = (_dt: number, elapsed: number): void => {
    wind.value = elapsed;
    canopy.update(renderer, elapsed);
  };

  return { root, log, update };
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
function createGrass(wind: { value: number }): THREE.InstancedMesh {
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
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWind = wind;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uWind;')
      .replace(
        '#include <begin_vertex>',
        /* glsl */ `#include <begin_vertex>
        // Bend grows with height; rolling gusts travel across the clearing.
        vec3 bladeRoot = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        float gust = sin(uWind * 1.1 - bladeRoot.x * 0.7 - bladeRoot.z * 0.4) * 0.5 + 0.5;
        float flutter = sin(uWind * 4.0 + bladeRoot.x * 3.1 + bladeRoot.z * 2.3) * 0.25;
        float bend = transformed.y * transformed.y * (0.08 + 0.32 * gust + 0.06 * flutter);
        vec3 localWind = transpose(mat3(instanceMatrix)) * vec3(0.9, 0.0, 0.45);
        transformed.xz += normalize(localWind.xz) * bend;
        transformed.y -= bend * bend * 0.5;`,
      );
  };
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

/** Two copies of the scanned stone, varied in footprint and rotation, with tops at `topHeight` to carry the log. */
async function loadStones(topHeight: number): Promise<THREE.Object3D[]> {
  const source = await loadModel('stone.glb');
  const box = new THREE.Box3().setFromObject(source);
  const sink = 0.04;
  const heightScale = (topHeight + sink) / (box.max.y - box.min.y);

  const placements = [
    { x: -1.45, z: 0.02, spread: 1.0, turn: 0.4 },
    { x: 1.4, z: 0.06, spread: 0.88, turn: 2.3 },
  ];
  return placements.map(({ x, z, spread, turn }) => {
    const stone = source.clone();
    stone.scale.set(heightScale * spread, heightScale, heightScale * spread);
    stone.rotation.y = turn;
    stone.position.set(x, -sink - box.min.y * heightScale, z);
    return stone;
  });
}

