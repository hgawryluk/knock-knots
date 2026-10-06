import * as THREE from 'three';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { RopeSim } from './ropeSim';

/** Screen-space pick radius in CSS pixels; the working end gets a more generous one. */
const PICK_RADIUS = 18;
const END_PICK_RADIUS = 32;
const DEPTH_STEP = 0.12;

const RING_COLOR = new THREE.Color('#ffffff');
const TUCK_COLOR = new THREE.Color('#5aa2ff');

/**
 * Left-drag on the rope grabs the nearest particle and moves it on a
 * camera-facing plane; the wheel pushes that plane away or pulls it closer.
 * Holding Shift while dragging tucks the end under rope it meets.
 * Presses that miss the rope fall through to the orbit controls.
 */
export class RopeDragger {
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly plane = new THREE.Plane();
  private readonly hit = new THREE.Vector3();
  private readonly temp = new THREE.Vector3();
  private readonly marker: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  private pointerId = -1;
  private hovered = -1;

  constructor(
    private readonly sim: RopeSim,
    private readonly camera: THREE.PerspectiveCamera,
    private readonly surface: HTMLElement,
    private readonly controls: OrbitControls,
    scene: THREE.Scene,
  ) {
    this.marker = new THREE.Mesh(
      new THREE.RingGeometry(sim.radius * 2.2, sim.radius * 2.9, 32),
      new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85, depthTest: false }),
    );
    this.marker.renderOrder = 10;
    this.marker.visible = false;
    scene.add(this.marker);

    // Capture phase on the container runs before OrbitControls' listener on the canvas.
    surface.addEventListener('pointerdown', this.onPointerDown, { capture: true });
    surface.addEventListener('wheel', this.onWheel, { capture: true, passive: false });
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('keyup', this.onKey);
    window.addEventListener('blur', () => (this.sim.tuckUnder = false));
  }

  get dragging(): boolean {
    return this.pointerId !== -1;
  }

  /** Keeps the hover/grab ring on the rope and facing the camera. */
  update(): void {
    const index = this.dragging ? this.sim.grabbedIndex : this.hovered;
    this.marker.visible = index >= 0;
    if (index < 0) return;
    this.marker.material.color.copy(this.sim.tuckUnder ? TUCK_COLOR : RING_COLOR);
    this.marker.scale.setScalar(this.sim.tuckUnder ? 0.8 : 1);
    this.sim.getPosition(index, this.marker.position);
    this.marker.quaternion.copy(this.camera.quaternion);
  }

  private setPointer(event: PointerEvent | WheelEvent): void {
    const rect = this.surface.getBoundingClientRect();
    this.pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
  }

  /** Nearest particle to the cursor on screen, or -1 if none is close enough. */
  private pick(event: PointerEvent): number {
    const rect = this.surface.getBoundingClientRect();
    const last = this.sim.count - 1;
    let best = -1;
    let bestDistance = Infinity;
    for (let i = 0; i < this.sim.count; i++) {
      this.sim.getPosition(i, this.temp).project(this.camera);
      if (this.temp.z > 1) continue;
      const sx = ((this.temp.x + 1) / 2) * rect.width + rect.left;
      const sy = ((1 - this.temp.y) / 2) * rect.height + rect.top;
      const distance = Math.hypot(sx - event.clientX, sy - event.clientY);
      const limit = i >= last - 2 ? END_PICK_RADIUS : PICK_RADIUS;
      // Prefer the working end when it's within reach: that's what you tie with.
      const score = i >= last - 2 ? distance * 0.5 : distance;
      if (distance < limit && score < bestDistance) {
        bestDistance = score;
        best = i;
      }
    }
    return best;
  }

  private updateTarget(): void {
    this.raycaster.setFromCamera(this.pointer, this.camera);
    if (!this.raycaster.ray.intersectPlane(this.plane, this.hit)) return;
    this.hit.y = Math.max(this.hit.y, this.sim.radius);
    this.sim.setGrabTarget(this.hit);
  }

  private onKey = (event: KeyboardEvent): void => {
    if (event.key === 'Shift') this.sim.tuckUnder = event.type === 'keydown';
  };

  private onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0 || this.dragging) return;
    const index = this.pick(event);
    if (index < 0) return;

    event.stopPropagation();
    event.preventDefault();
    this.pointerId = event.pointerId;
    try {
      this.surface.setPointerCapture(event.pointerId);
    } catch {
      // Synthetic events (tests) have no active pointer to capture.
    }
    this.controls.enabled = false;
    this.surface.style.cursor = 'grabbing';

    this.sim.getPosition(index, this.temp);
    const normal = this.camera.getWorldDirection(new THREE.Vector3());
    this.plane.setFromNormalAndCoplanarPoint(normal, this.temp);
    this.sim.grab(index, this.temp);
    this.setPointer(event);
  };

  private onPointerMove = (event: PointerEvent): void => {
    if (this.dragging) {
      if (event.pointerId !== this.pointerId) return;
      this.setPointer(event);
      this.updateTarget();
      return;
    }
    if (event.buttons !== 0) return;
    this.hovered = this.pick(event);
    this.surface.style.cursor = this.hovered >= 0 ? 'grab' : '';
  };

  private onPointerUp = (event: PointerEvent): void => {
    if (event.pointerId !== this.pointerId) return;
    this.pointerId = -1;
    this.sim.release();
    this.controls.enabled = true;
    this.surface.style.cursor = '';
    if (this.surface.hasPointerCapture(event.pointerId)) this.surface.releasePointerCapture(event.pointerId);
  };

  /** While dragging, the wheel moves the drag plane along the view direction instead of zooming. */
  private onWheel = (event: WheelEvent): void => {
    if (!this.dragging) return;
    event.stopPropagation();
    event.preventDefault();
    this.plane.constant += Math.sign(event.deltaY) * DEPTH_STEP;
    this.setPointer(event);
    this.updateTarget();
  };
}
