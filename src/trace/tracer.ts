import * as THREE from 'three';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { HANDOFF, type RopePath } from './ropePath';

/** How close (px) you must press to the working end to pick it up. */
const GRAB_PX = 44;
/** How far along the path (samples) one move of the cursor may pull the end, and how close the cursor must be (px). */
const LOOK_AHEAD = 40;
const LOOK_BACK = 25;
const FOLLOW_PX = 80;
/** How quickly the drawn rope catches up with your cursor (per second). */
const GLIDE_RATE = 16;
/** Sample spacing of the ghost tubes. */
const GHOST_STRIDE = 6;

/**
 * "Try it yourself": grab the blue working end and drag it along the knot's
 * path. The end only ever moves along the path — forward or a little back —
 * to wherever your cursor is near it on screen, from any camera angle. The
 * path ahead shows as a faint ghost, with the current step brighter and a ring
 * where it ends. Presses away from the end orbit the camera.
 */
export class Tracer {
  readonly object = new THREE.Group();
  /** Where you've traced to along the path (sample index). */
  progress = 0;
  /** What's drawn: eases after `progress` so the rope glides instead of jumping with the cursor. */
  shown = 0;
  enabled = false;
  /** Called whenever the drawn position along the path changes. */
  onProgress: (shown: number) => void = () => {};

  private path: RopePath | null = null;
  private stepEnd = 0;
  /** Set when a step ends with a change of hold: the drag ends there. */
  private letGo = false;
  private tracing = -1;
  private time = 0;
  private dirty = true;
  private readonly ghost: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  private readonly step: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  private readonly ring: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>;
  private readonly tip: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  private readonly point = new THREE.Vector3();

  constructor(
    private readonly camera: THREE.Camera,
    private readonly surface: HTMLElement,
    private readonly controls: OrbitControls,
    private readonly radius: number,
  ) {
    const material = (color: string, opacity: number): THREE.MeshBasicMaterial =>
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
    this.ghost = new THREE.Mesh(new THREE.BufferGeometry(), material('#ffffff', 0.16));
    this.step = new THREE.Mesh(new THREE.BufferGeometry(), material('#5ab0ff', 0.55));
    this.ring = new THREE.Mesh(new THREE.TorusGeometry(radius * 2.4, radius * 0.35, 8, 32), material('#5ab0ff', 0.9));
    this.tip = new THREE.Mesh(
      new THREE.RingGeometry(radius * 2.2, radius * 2.9, 32),
      new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85, depthTest: false }),
    );
    this.tip.renderOrder = 10;
    this.object.add(this.ghost, this.step, this.ring, this.tip);
    this.object.visible = false;

    // Capture phase on the container runs before OrbitControls' listener on the canvas.
    surface.addEventListener('pointerdown', this.onPointerDown, { capture: true });
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);
  }

  /** Start tracing a path from its beginning (where the standing part ends). */
  start(path: RopePath): void {
    this.path = path;
    this.setProgress(path.traceFrom);
    this.shown = this.progress;
    this.onProgress(this.shown);
    this.enabled = true;
    this.object.visible = true;
  }

  stop(): void {
    this.enabled = false;
    this.cancel();
    this.object.visible = false;
  }

  get finished(): boolean {
    return !!this.path && this.progress >= this.path.end - 0.5;
  }

  /** Traced to the end and the drawn rope has caught up. */
  get settled(): boolean {
    return this.finished && Math.abs(this.shown - this.progress) < 0.5;
  }

  /** Redraws the ghost (when progress changed) and animates the step ring and tip marker. */
  update(dt: number): void {
    if (!this.path || !this.object.visible) return;
    this.time += dt;
    if (this.shown !== this.progress) {
      this.shown += (this.progress - this.shown) * (1 - Math.exp(-dt * GLIDE_RATE));
      if (Math.abs(this.progress - this.shown) < 0.05) this.shown = this.progress;
      this.onProgress(this.shown);
    }
    if (this.dirty) {
      this.dirty = false;
      this.rebuildGhosts(this.path);
    }
    this.ring.quaternion.copy(this.camera.quaternion);
    this.ring.scale.setScalar(1 + Math.sin(this.time * 5) * 0.12);
    this.ring.visible = !this.finished;
    this.path.handleAt(this.shown, this.tip.position);
    this.tip.quaternion.copy(this.camera.quaternion);
    this.tip.visible = !this.finished;
    this.tip.material.opacity = this.tracing >= 0 ? 0.95 : 0.55 + Math.sin(this.time * 4) * 0.25;
  }

  private setProgress(progress: number): void {
    if (!this.path) return;
    let clamped = Math.min(Math.max(progress, this.path.traceFrom), this.path.end);
    // At the end of a step where you take hold of another bit of rope, you let go: the marker
    // moves there and you pick it up again.
    if (clamped >= this.stepEnd - HANDOFF && this.stepEnd < this.path.end && this.progress < this.stepEnd && this.path.handleJumps(this.stepEnd)) {
      clamped = Math.min(this.stepEnd + HANDOFF + 0.5, this.path.end);
      this.letGo = true;
    }
    if (clamped === this.progress && !this.dirty) return;
    this.progress = clamped;
    this.stepEnd = this.path.stepEnds.find((end) => end > this.progress + 0.5) ?? this.path.end;
    this.dirty = true;
  }

  private rebuildGhosts(path: RopePath): void {
    const tube = (from: number, to: number, radius: number): THREE.BufferGeometry => {
      const points: THREE.Vector3[] = [];
      for (let s = from; s < to; s += GHOST_STRIDE) points.push(path.handleAt(s, new THREE.Vector3()));
      points.push(path.handleAt(to, new THREE.Vector3()));
      if (points.length < 2) return new THREE.BufferGeometry();
      return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), points.length * 2, radius, 8, false);
    };
    this.ghost.geometry.dispose();
    this.step.geometry.dispose();
    this.ghost.geometry = tube(this.stepEnd, path.end, this.radius * 0.9);
    this.step.geometry = tube(this.progress, this.stepEnd, this.radius * 0.55);
    path.handleAt(this.stepEnd, this.ring.position);
  }

  private screenOf(sample: number, rect: DOMRect): [number, number] {
    this.path!.handleAt(sample, this.point).project(this.camera);
    return [rect.left + ((this.point.x + 1) / 2) * rect.width, rect.top + ((1 - this.point.y) / 2) * rect.height];
  }

  private onPointerDown = (event: PointerEvent): void => {
    if (!this.enabled || !this.path || event.button !== 0 || this.finished) return;
    const rect = this.surface.getBoundingClientRect();
    const [x, y] = this.screenOf(this.progress, rect);
    if (Math.hypot(x - event.clientX, y - event.clientY) > GRAB_PX) return;
    event.stopPropagation();
    event.preventDefault();
    this.tracing = event.pointerId;
    try {
      this.surface.setPointerCapture(event.pointerId);
    } catch {
      // Synthetic events (tests) have no active pointer to capture.
    }
    this.controls.enabled = false;
    this.surface.style.cursor = 'grabbing';
  };

  private onPointerMove = (event: PointerEvent): void => {
    if (!this.enabled || !this.path) return;
    const rect = this.surface.getBoundingClientRect();
    if (this.tracing < 0) {
      if (event.buttons !== 0) return;
      const [x, y] = this.screenOf(this.progress, rect);
      this.surface.style.cursor = !this.finished && Math.hypot(x - event.clientX, y - event.clientY) <= GRAB_PX ? 'grab' : '';
      return;
    }
    if (event.pointerId !== this.tracing) return;
    // Move along the path to the nearby sample closest to the cursor on screen.
    let best = this.progress;
    let bestDistance = Infinity;
    const from = Math.max(this.progress - LOOK_BACK, this.path.traceFrom);
    const to = Math.min(this.progress + LOOK_AHEAD, this.path.end);
    for (let s = from; s <= to; s += 0.5) {
      const [x, y] = this.screenOf(s, rect);
      const distance = Math.hypot(x - event.clientX, y - event.clientY);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = s;
      }
    }
    if (bestDistance <= FOLLOW_PX) this.setProgress(best);
    if (this.letGo) {
      this.letGo = false;
      this.cancel();
    }
  };

  private onPointerUp = (event: PointerEvent): void => {
    if (event.pointerId !== this.tracing) return;
    this.cancel();
  };

  private cancel(): void {
    if (this.tracing >= 0 && this.surface.hasPointerCapture(this.tracing)) this.surface.releasePointerCapture(this.tracing);
    this.tracing = -1;
    this.controls.enabled = true;
    this.surface.style.cursor = '';
  }
}
