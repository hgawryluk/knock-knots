import * as THREE from 'three';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { Log, LogSection } from '../scene/log';
import type { RopeSim } from './ropeSim';

/** Screen-space pick radius in CSS pixels; the working end gets a more generous one. */
const PICK_RADIUS = 18;
const END_PICK_RADIUS = 32;
/** Default hover height of the held rope above whatever surface is under the cursor. */
const DEFAULT_LIFT = 0.04;
const MIN_LIFT = 0.03;
const MAX_LIFT = 1.6;
const LIFT_STEP = 0.1;
/** Beyond this, a jump from the log to visible ground is treated as a teleport and the end stays on the log. */
const MAX_SURFACE_JUMP = 0.9;
/** Within this distance of the bark the held rope counts as lying on the log. */
const ON_LOG = 0.12;
/** Particles this close to the hand (by index) are the held stretch itself, not rope to climb over. */
const HAND_SPAN = 6;
/** Radians of extra wrap around the back per log-radius the cursor goes past the outline. */
const RIM_WRAP = 2.5;
/** Furthest the end can be wrapped from the side facing the camera (just past underneath). */
const MAX_RIM_ANGLE = Math.PI * 0.95;

const RING_COLOR = new THREE.Color('#ffffff');
const TUCK_COLOR = new THREE.Color('#5aa2ff');

/**
 * Left-drag on the rope grabs the nearest particle. The held point follows the
 * surface under the cursor (the log or the ground), hovering a little above it;
 * the wheel raises or lowers that hover height. Holding Shift means "under":
 * the end keeps to its current surface (beneath the log, or pressed to the
 * bark) and slips under rope it meets. Presses that miss the rope fall
 * through to the orbit controls.
 */
export class RopeDragger {
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly hit = new THREE.Vector3();
  private readonly temp = new THREE.Vector3();
  private readonly section: LogSection = { cy: 0, cz: 0, ry: 0, rz: 0 };
  private readonly marker: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  private pointerId = -1;
  private hovered = -1;
  private lift = DEFAULT_LIFT;

  constructor(
    private readonly sim: RopeSim,
    private readonly log: Log,
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

  /**
   * Aims the held point at the surface under the cursor (log or ground), `lift`
   * above it. Off the log's outline it wraps around the far side instead of
   * jumping to distant ground. If the target ends up behind the log, the sim
   * carries the end around the log. Shift ("under") presses it flat, lets it
   * slip beneath strands, and keeps rope that's on the log on its current side
   * (far face, or the ground beneath) so it can pass under the log; otherwise
   * it rides over strands.
   */
  private updateTarget(): void {
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const ray = this.raycaster.ray;
    const under = this.sim.tuckUnder;
    const offset = this.sim.radius + (under ? 0 : this.lift);

    const current = this.sim.getPosition(this.sim.grabbedIndex, this.temp);
    const tLog = this.rayToLog(ray, offset);
    const tGround = ray.direction.y < -1e-4 ? (offset - ray.origin.y) / ray.direction.y : -1;

    if (tLog >= 0) {
      let t = tGround >= 0 ? Math.min(tLog, tGround) : tLog;
      if (under && this.distanceToLog(current) < ON_LOG) {
        let best = Infinity;
        for (const candidate of [tLog, this.rayToLog(ray, offset, true), tGround]) {
          if (candidate < 0) continue;
          const distance = ray.at(candidate, this.hit).distanceTo(current);
          if (distance < best) {
            best = distance;
            t = candidate;
          }
        }
      }
      this.aim(ray.at(t, this.hit), under);
      return;
    }

    // Cursor is off the log. If the rope is on the log and the only ground in
    // view is far behind it (hidden by the log), slide along the log's edge
    // instead of teleporting; letting go there drops the end down the far side.
    const ground = tGround >= 0 ? ray.at(tGround, new THREE.Vector3()) : null;
    const onLog = this.distanceToLog(current) < ON_LOG * 2;
    if (onLog && (!ground || ground.distanceTo(current) > MAX_SURFACE_JUMP)) {
      if (this.rimPoint(ray, offset, this.hit)) this.aim(this.hit, under);
      return;
    }
    if (ground) this.aim(ground, under);
  }

  private aim(target: THREE.Vector3, under: boolean): void {
    if (!under) this.rideOverRope(target);
    this.sim.setGrabTarget(target);
  }

  /**
   * Default "over" behaviour: where the target overlaps other rope, raise it by
   * a rope thickness (away from the log, or up off the ground) so the held end
   * climbs over strands instead of shoving them sideways.
   */
  private rideOverRope(target: THREE.Vector3): void {
    const p = this.sim.positions;
    const clearance = this.sim.radius * 2.1;
    const grabbed = this.sim.grabbedIndex;
    const normal = new THREE.Vector3();
    for (let pass = 0; pass < 3; pass++) {
      let lifted = false;
      for (let i = 0; i < this.sim.count; i++) {
        if (Math.abs(i - grabbed) <= HAND_SPAN) continue;
        const dx = target.x - p[i * 3];
        const dy = target.y - p[i * 3 + 1];
        const dz = target.z - p[i * 3 + 2];
        if (dx * dx + dy * dy + dz * dz >= clearance * clearance) continue;
        this.outwardNormal(p[i * 3], p[i * 3 + 1], p[i * 3 + 2], normal);
        // Sit on top of that strand: one rope thickness outward from it, keeping the sideways offset.
        const along = dx * normal.x + dy * normal.y + dz * normal.z;
        if (along < clearance) {
          target.addScaledVector(normal, clearance - along);
          lifted = true;
        }
      }
      if (!lifted) return;
    }
  }

  /** Outward direction at a point: away from the log axis when on the log, otherwise straight up. */
  private outwardNormal(x: number, y: number, z: number, out: THREE.Vector3): THREE.Vector3 {
    if (x > this.log.minX && x < this.log.maxX) {
      const s = this.log.sectionAt(x, this.section);
      if (Math.hypot((y - s.cy) / s.ry, (z - s.cz) / s.rz) < 1.6) {
        return out.set(0, (y - s.cy) / (s.ry * s.ry), (z - s.cz) / (s.rz * s.rz)).normalize();
      }
    }
    return out.set(0, 1, 0);
  }

  /** Distance from a point to the log's (un-inflated) surface, outside only; Infinity beyond its ends. */
  private distanceToLog(p: THREE.Vector3): number {
    if (p.x <= this.log.minX || p.x >= this.log.maxX) return Infinity;
    const s = this.log.sectionAt(p.x, this.section);
    const q = Math.hypot((p.y - s.cy) / s.ry, (p.z - s.cz) / s.rz);
    return Math.max(q - 1, 0) * Math.min(s.ry, s.rz);
  }

  /**
   * Point on the log (inflated by `offset`) for a cursor just off its outline:
   * starts at the silhouette edge and wraps further around the far side the
   * farther the cursor goes past it, so you can pull rope over and down the back.
   */
  private rimPoint(ray: THREE.Ray, offset: number, out: THREE.Vector3): boolean {
    const { origin: o, direction: d } = ray;
    const dd = d.y * d.y + d.z * d.z;
    if (dd < 1e-9) return false;
    let s = this.log.sectionAt(THREE.MathUtils.clamp(o.x, this.log.minX, this.log.maxX), this.section);
    const t = Math.max(-((o.y - s.cy) * d.y + (o.z - s.cz) * d.z) / dd, 0);
    ray.at(t, out);
    out.x = THREE.MathUtils.clamp(out.x, this.log.minX + 0.05, this.log.maxX - 0.05);
    s = this.log.sectionAt(out.x, this.section);
    const ry = s.ry + offset;
    const rz = s.rz + offset;

    // Work in ellipse-normalized coordinates around the log axis.
    const u = (out.y - s.cy) / ry;
    const v = (out.z - s.cz) / rz;
    const beyond = Math.hypot(u, v) - 1;
    const angle = Math.atan2(v, u);
    const cameraAngle = Math.atan2((o.z - s.cz) / rz, (o.y - s.cy) / ry);
    let fromCamera = angle - cameraAngle;
    fromCamera -= Math.PI * 2 * Math.round(fromCamera / (Math.PI * 2));
    const wrapped = cameraAngle + Math.sign(fromCamera) * Math.min(Math.abs(fromCamera) + Math.max(beyond, 0) * RIM_WRAP, MAX_RIM_ANGLE);
    out.y = s.cy + Math.cos(wrapped) * ry;
    out.z = s.cz + Math.sin(wrapped) * rz;
    return true;
  }

  /**
   * Where the ray enters (or with `far`, leaves) the log's elliptical proxy
   * inflated by `offset`, or -1. The section varies along X, so it's refined
   * once at the hit's x.
   */
  private rayToLog(ray: THREE.Ray, offset: number, far = false): number {
    const { origin: o, direction: d } = ray;
    let x = THREE.MathUtils.clamp(o.x, this.log.minX, this.log.maxX);
    let t = -1;
    for (let pass = 0; pass < 2; pass++) {
      const s = this.log.sectionAt(x, this.section);
      const ry = s.ry + offset;
      const rz = s.rz + offset;
      const oy = (o.y - s.cy) / ry;
      const oz = (o.z - s.cz) / rz;
      const dy = d.y / ry;
      const dz = d.z / rz;
      const a = dy * dy + dz * dz;
      const b = 2 * (oy * dy + oz * dz);
      const c = oy * oy + oz * oz - 1;
      const disc = b * b - 4 * a * c;
      if (a < 1e-9 || disc < 0) return -1;
      t = (-b + (far ? 1 : -1) * Math.sqrt(disc)) / (2 * a);
      if (t < 0) return -1;
      x = o.x + d.x * t;
    }
    return x > this.log.minX && x < this.log.maxX ? t : -1;
  }

  private onKey = (event: KeyboardEvent): void => {
    if (event.key !== 'Shift') return;
    this.sim.tuckUnder = event.type === 'keydown';
    if (this.dragging) this.updateTarget();
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
    this.lift = DEFAULT_LIFT;

    this.sim.grab(index, this.sim.getPosition(index, this.temp));
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

  /** While dragging, the wheel raises or lowers the held rope instead of zooming. */
  private onWheel = (event: WheelEvent): void => {
    if (!this.dragging) return;
    event.stopPropagation();
    event.preventDefault();
    this.lift = THREE.MathUtils.clamp(this.lift - Math.sign(event.deltaY) * LIFT_STEP, MIN_LIFT, MAX_LIFT);
    this.setPointer(event);
    this.updateTarget();
  };
}
