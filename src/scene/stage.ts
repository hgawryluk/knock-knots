import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export type Updater = (dt: number, elapsed: number) => void;

/** Renderer, camera, orbit controls and the frame loop. */
export class Stage {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(32, 1, 0.1, 200);
  readonly renderer: THREE.WebGLRenderer;
  readonly controls: OrbitControls;
  private readonly updaters: Updater[] = [];
  private last = performance.now();
  private elapsed = 0;

  constructor(container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = false;
    this.controls.rotateSpeed = 0.6;
    this.controls.minDistance = 3.5;
    this.controls.maxDistance = 11;
    this.controls.minPolarAngle = Math.PI * 0.12;
    this.controls.maxPolarAngle = Math.PI * 0.42;

    new ResizeObserver(() => this.resize(container)).observe(container);
    this.resize(container);
    this.renderer.setAnimationLoop(() => this.tick());
  }

  onUpdate(fn: Updater): void {
    this.updaters.push(fn);
  }

  /** Points the camera at `target` from spherical angles (radians) and distance. */
  setView(target: THREE.Vector3, distance: number, polar: number, azimuth: number): void {
    this.controls.target.copy(target);
    this.camera.position.setFromSphericalCoords(distance, polar, azimuth).add(target);
    this.controls.update();
  }

  private resize(container: HTMLElement): void {
    const { clientWidth: w, clientHeight: h } = container;
    if (w === 0 || h === 0) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // Keep the subject comfortably framed on tall, narrow screens.
    this.camera.fov = this.camera.aspect < 1 ? 32 / Math.max(this.camera.aspect, 0.55) : 32;
    this.camera.updateProjectionMatrix();
  }

  private tick(): void {
    const now = performance.now();
    const dt = Math.min((now - this.last) / 1000, 0.1);
    this.last = now;
    this.elapsed += dt;
    for (const fn of this.updaters) fn(dt, this.elapsed);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}
