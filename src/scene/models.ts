import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);

/** Loads a GLB from `public/assets/` with shadows enabled on every mesh. */
export async function loadModel(file: string): Promise<THREE.Object3D> {
  const gltf = await loader.loadAsync(`${import.meta.env.BASE_URL}assets/${file}`);
  gltf.scene.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  return gltf.scene;
}
