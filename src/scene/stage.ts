import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';

export type Updater = (dt: number, elapsed: number) => void;

export interface View {
  target: THREE.Vector3;
  distance: number;
  polar: number;
  azimuth: number;
}

/** Depth of field: the orbit target stays sharp, the scene behind softens. */
const APERTURE = 0.012;
const MAX_BLUR = 0.012;

const ease = (t: number): number => t * t * (3 - 2 * t);

/** Renderer (with depth of field), camera, orbit controls, smooth camera moves and the frame loop. */
export class Stage {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(32, 1, 0.1, 200);
  readonly renderer: THREE.WebGLRenderer;
  readonly controls: OrbitControls;
  private readonly composer: EffectComposer;
  private readonly bokeh: BokehPass;
  private readonly updaters: Updater[] = [];
  private last = performance.now();
  private elapsed = 0;
  private move: { from: View; to: View; t: number; duration: number } | null = null;

  constructor(container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    container.appendChild(this.renderer.domElement);

    // Multisampled target so edges stay smooth through the post-processing.
    const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(this.renderer, target);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bokeh = new BokehPass(this.scene, this.camera, { focus: 5, aperture: APERTURE, maxblur: MAX_BLUR });
    this.composer.addPass(this.bokeh);
    this.composer.addPass(new OutputPass());

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = false;
    this.controls.rotateSpeed = 0.6;
    this.controls.mouseButtons.RIGHT = THREE.MOUSE.ROTATE;
    // Taking the camera yourself cancels any glide in progress.
    this.controls.addEventListener('start', () => (this.move = null));

    new ResizeObserver(() => this.resize(container)).observe(container);
    this.resize(container);
    this.renderer.setAnimationLoop(() => this.tick());
  }

  onUpdate(fn: Updater): void {
    this.updaters.push(fn);
  }

  /** Points the camera at `view.target` from spherical angles (radians) and distance, instantly. */
  setView(view: View): void {
    this.move = null;
    this.applyView(view);
  }

  /** Glides the camera to `view` over `duration` seconds. */
  glideTo(view: View, duration = 0.9): void {
    const offset = this.camera.position.clone().sub(this.controls.target);
    const spherical = new THREE.Spherical().setFromVector3(offset);
    const from: View = {
      target: this.controls.target.clone(),
      distance: spherical.radius,
      polar: spherical.phi,
      azimuth: spherical.theta,
    };
    // Turn the short way round.
    let azimuth = view.azimuth;
    while (azimuth - from.azimuth > Math.PI) azimuth -= Math.PI * 2;
    while (azimuth - from.azimuth < -Math.PI) azimuth += Math.PI * 2;
    this.move = { from, to: { ...view, azimuth }, t: 0, duration };
  }

  /** Depth of field strength: 1 is the full cinematic blur, 0 keeps everything sharp. */
  setBlur(amount: number): void {
    const uniforms = this.bokeh.uniforms as Record<string, THREE.IUniform>;
    uniforms.aperture.value = APERTURE * amount;
    uniforms.maxblur.value = MAX_BLUR * amount;
    this.bokeh.enabled = amount > 0;
  }

  /** Draws a frame now (also used for saving screenshots). */
  render(): void {
    // Keep whatever the camera orbits around in focus.
    (this.bokeh.uniforms as Record<string, THREE.IUniform>).focus.value = this.camera.position.distanceTo(this.controls.target);
    this.composer.render();
  }

  private applyView({ target, distance, polar, azimuth }: View): void {
    this.controls.target.copy(target);
    this.camera.position.setFromSphericalCoords(distance, polar, azimuth).add(target);
    this.controls.update();
  }

  private resize(container: HTMLElement): void {
    const { clientWidth: w, clientHeight: h } = container;
    if (w === 0 || h === 0) return;
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
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
    if (this.move) {
      const m = this.move;
      m.t = Math.min(m.t + dt / m.duration, 1);
      const k = ease(m.t);
      const lerp = (a: number, b: number): number => a + (b - a) * k;
      this.applyView({
        target: m.from.target.clone().lerp(m.to.target, k),
        distance: lerp(m.from.distance, m.to.distance),
        polar: lerp(m.from.polar, m.to.polar),
        azimuth: lerp(m.from.azimuth, m.to.azimuth),
      });
      if (m.t >= 1) this.move = null;
    }
    for (const fn of this.updaters) fn(dt, this.elapsed);
    this.controls.update();
    this.render();
  }
}
