import * as THREE from 'three';
import { CARABINER, CARABINER_GATE as GATE, CARABINER_GATE_SWING, CARABINER_OUTLINE as OUTLINE } from '../knots/paths';
import type { Rail } from '../knots/types';

/**
 * The frame's cross-section: an oval deeper front to back than it is wide, like
 * the I-beam section of a real carabiner (about the same girth as the bar the
 * knots are tied round).
 */
const FRAME_WIDTH = 0.029;
const FRAME_DEPTH = 0.038;
const GATE_RADIUS = 0.021;
/** Top of the outline, where it hangs in the hanger's hole. */
const TOP = new THREE.Vector3(-0.035, 0.69, 0);
/** How far the rock face is behind the carabiner (the hanger's tab spans it). */
export const ROCK_GAP = 0.17;
const HOLE_RADIUS = 0.05;
/** The screw sleeve: how long, how far up the gate it sits when locked, and how far it screws down to unlock. */
const SLEEVE_LENGTH = 0.12;
const SLEEVE_AT = 0.76;
const SLEEVE_TRAVEL = 0.055;

/**
 * A pear-shaped (HMS) screwgate carabiner hanging from a bolt hanger in the
 * rock, its wide bottom bar where the knot is tied. Modelled on real ones: an
 * oval-section anodised frame, a straight steel gate hinged at the top closing
 * onto a keylock nose at the bottom right, and a knurled sleeve that screws down
 * over the nose to lock — screwed up, it shows the red band that warns the gate is unlocked.
 * Hidden until a knot needs it.
 */
export class Carabiner {
  readonly object = new THREE.Group();
  private readonly materials: THREE.MeshStandardMaterial[];
  /** The gate swings in on its hinge; the sleeve screws down it to unlock. */
  private readonly gate = new THREE.Group();
  private readonly sleeve: THREE.Mesh;
  private readonly sleeveAt: THREE.Vector3;
  private readonly sleeveDown: THREE.Vector3;

  constructor() {
    const anodised = new THREE.MeshStandardMaterial({ color: '#5d6f84', metalness: 0.65, roughness: 0.42 });
    const steel = new THREE.MeshStandardMaterial({ color: '#c8ccd2', metalness: 0.9, roughness: 0.26 });
    const knurled = new THREE.MeshStandardMaterial({ color: '#dfe2e6', metalness: 0.85, roughness: 0.38, map: knurlTexture(), bumpMap: knurlTexture(), bumpScale: 1.5 });
    const warning = new THREE.MeshStandardMaterial({ color: '#d4302b', metalness: 0.3, roughness: 0.5 });
    this.materials = [anodised, steel, knurled, warning];

    const curve = new THREE.CatmullRomCurve3(
      OUTLINE.map(([x, y]) => new THREE.Vector3(x, y, 0)),
      true,
      'centripetal',
    );
    const at = (i: number): number => frameU(curve, i);
    const hinge = curve.getPointAt(at(GATE.hinge));
    const nose = curve.getPointAt(at(GATE.nose));

    // Frame: all of it but the gate, from the nose round to the hinge, its ends rounded off.
    this.add(new THREE.Mesh(ovalSweep(new SubCurve(curve, at(GATE.hinge), at(GATE.nose) + 1), 220, FRAME_WIDTH, FRAME_DEPTH), anodised));
    for (const end of [hinge, nose]) {
      const cap = this.add(new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), anodised));
      cap.scale.set(FRAME_WIDTH, FRAME_WIDTH, FRAME_DEPTH);
      cap.position.copy(end);
    }
    // The hinge rivet, through the frame front to back.
    const rivet = this.add(new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, FRAME_DEPTH * 2 + 0.008, 14), steel));
    rivet.rotation.x = Math.PI / 2;
    rivet.position.copy(hinge);

    // Gate: a straight steel rod down from the hinge to just short of the nose, swinging about the rivet.
    this.gate.position.copy(hinge);
    const toNose = nose.clone().sub(hinge);
    const length = toNose.length() - FRAME_WIDTH * 0.6;
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(GATE_RADIUS, GATE_RADIUS, length, 18), steel);
    const along = toNose.clone().normalize();
    rod.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), along);
    rod.position.copy(along).multiplyScalar(length / 2);
    this.gate.add(rod);
    // The red "unlocked" band at the nose end, under the sleeve while it is locked.
    const band = new THREE.Mesh(new THREE.CylinderGeometry(GATE_RADIUS + 0.002, GATE_RADIUS + 0.002, SLEEVE_TRAVEL, 18), warning);
    band.quaternion.copy(rod.quaternion);
    band.position.copy(along).multiplyScalar(length * SLEEVE_AT + SLEEVE_LENGTH / 2 - SLEEVE_TRAVEL / 2);
    this.gate.add(band);
    // The sleeve, screwed down over the nose: knurled, with a lip at each end.
    const sleeveShape = [
      new THREE.Vector2(0.034, -SLEEVE_LENGTH / 2),
      new THREE.Vector2(0.042, -SLEEVE_LENGTH / 2 + 0.006),
      new THREE.Vector2(0.042, SLEEVE_LENGTH / 2 - 0.006),
      new THREE.Vector2(0.034, SLEEVE_LENGTH / 2),
    ];
    this.sleeve = new THREE.Mesh(new THREE.LatheGeometry(sleeveShape, 28), knurled);
    this.sleeveAt = along.clone().multiplyScalar(length * SLEEVE_AT);
    this.sleeveDown = along.clone().negate();
    this.sleeve.position.copy(this.sleeveAt);
    this.sleeve.quaternion.copy(rod.quaternion);
    this.gate.add(this.sleeve);
    this.add(this.gate);

    this.add(createHanger(steel));
    this.object.visible = false;
  }

  /** Something for the metal to reflect (it looks dull and dark without). */
  setEnvironment(texture: THREE.Texture): void {
    for (const material of this.materials) {
      material.envMap = texture;
      material.envMapIntensity = 0.9;
      material.needsUpdate = true;
    }
  }

  /**
   * Unlocks and opens the gate: `unscrewed` (0–1) runs the sleeve up off the
   * nose, `open` (0–1) swings the gate in on its hinge.
   */
  setGate(open: number, unscrewed: number): void {
    this.sleeve.position.copy(this.sleeveAt).addScaledVector(this.sleeveDown, SLEEVE_TRAVEL * unscrewed);
    // Unscrewing it turns it a few times round.
    this.sleeve.rotation.set(0, 0, 0);
    this.sleeve.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), this.sleeveDown.clone().negate());
    this.sleeve.rotateY(unscrewed * Math.PI * 6);
    this.gate.rotation.z = CARABINER_GATE_SWING * open;
  }

  /** Shows the carabiner with its bottom bar where `rail` says (if it is a carabiner's), or hides it. */
  show(rail: Rail | undefined): void {
    this.object.visible = Boolean(rail?.carabiner);
    if (rail?.carabiner) this.object.position.set(CARABINER.x, rail.y, rail.z);
  }

  private add<T extends THREE.Mesh | THREE.Group>(part: T): T {
    part.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    this.object.add(part);
    return part;
  }
}

/** Where along the closed outline curve (0–1 of its length) outline point `index` lies. */
function frameU(curve: THREE.CatmullRomCurve3, index: number): number {
  const lengths = curve.getLengths(OUTLINE.length * 100);
  return lengths[Math.round(index * 100)] / lengths[lengths.length - 1];
}

/** Part of a closed curve, from `from` to `to` (fractions of its length; `to` may run past 1 to wrap round). */
class SubCurve extends THREE.Curve<THREE.Vector3> {
  constructor(
    private readonly curve: THREE.Curve<THREE.Vector3>,
    private readonly from: number,
    private readonly to: number,
  ) {
    super();
  }

  override getPoint(t: number, target = new THREE.Vector3()): THREE.Vector3 {
    const u = this.from + (this.to - this.from) * t;
    return this.curve.getPointAt(u - Math.floor(u), target);
  }
}

/**
 * A tube swept along a curve lying in the xy plane, with an oval section:
 * `width` across in the plane, `depth` front to back (radii).
 */
function ovalSweep(curve: THREE.Curve<THREE.Vector3>, segments: number, width: number, depth: number, sides = 20): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  const p = new THREE.Vector3();
  const t = new THREE.Vector3();
  for (let i = 0; i <= segments; i++) {
    const u = i / segments;
    curve.getPoint(u, p);
    curve.getTangent(u, t);
    // Across the curve in the plane, and front to back.
    const ax = -t.y;
    const ay = t.x;
    for (let j = 0; j <= sides; j++) {
      const a = (j / sides) * Math.PI * 2;
      const c = Math.cos(a);
      const s = Math.sin(a);
      positions.push(p.x + ax * width * c, p.y + ay * width * c, p.z + depth * s);
      const nx = (ax * c) / width;
      const ny = (ay * c) / width;
      const nz = s / depth;
      const len = Math.hypot(nx, ny, nz);
      normals.push(nx / len, ny / len, nz / len);
    }
  }
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < sides; j++) {
      const a = i * (sides + 1) + j;
      const b = a + sides + 1;
      indices.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setIndex(indices);
  return geometry;
}

/**
 * A bolt hanger: a rounded steel plate bolted flat to the rock, bent out into a
 * tab whose hole the carabiner's top hangs in (the top resting at the bottom of the hole).
 */
function createHanger(steel: THREE.Material): THREE.Group {
  const group = new THREE.Group();
  const thickness = 0.016;
  const holeCentre = TOP.clone().add(new THREE.Vector3(0, HOLE_RADIUS - CARABINER.barRadius, 0));
  const rounded = (shape: THREE.Shape, x0: number, y0: number, x1: number, y1: number, r: number): THREE.Shape => {
    shape.moveTo(x0 + r, y0);
    shape.lineTo(x1 - r, y0);
    shape.quadraticCurveTo(x1, y0, x1, y0 + r);
    shape.lineTo(x1, y1 - r);
    shape.quadraticCurveTo(x1, y1, x1 - r, y1);
    shape.lineTo(x0 + r, y1);
    shape.quadraticCurveTo(x0, y1, x0, y1 - r);
    shape.lineTo(x0, y0 + r);
    shape.quadraticCurveTo(x0, y0, x0 + r, y0);
    return shape;
  };

  // The tab, standing out from the rock: drawn in (z, y), with the hole, then turned to face along x.
  const tab = rounded(new THREE.Shape(), -ROCK_GAP, -0.065, 0.075, 0.068, 0.045);
  const hole = new THREE.Path();
  hole.absarc(0, 0, HOLE_RADIUS, 0, Math.PI * 2, true);
  tab.holes.push(hole);
  const tabMesh = new THREE.Mesh(new THREE.ExtrudeGeometry(tab, { depth: thickness, bevelEnabled: true, bevelSize: 0.003, bevelThickness: 0.003, bevelSegments: 2, curveSegments: 24 }), steel);
  // Shape x → world z, shape y → world y, extrusion → world x.
  tabMesh.rotation.y = -Math.PI / 2;
  tabMesh.position.set(holeCentre.x + thickness / 2, holeCentre.y, holeCentre.z);
  group.add(tabMesh);

  // The plate flat on the rock, rounded, with the bolt's nut and washer.
  const plateShape = rounded(new THREE.Shape(), -0.055, -0.06, 0.055, 0.11, 0.04);
  const plate = new THREE.Mesh(new THREE.ExtrudeGeometry(plateShape, { depth: thickness, bevelEnabled: true, bevelSize: 0.003, bevelThickness: 0.003, bevelSegments: 2, curveSegments: 16 }), steel);
  plate.position.set(holeCentre.x, holeCentre.y, -ROCK_GAP);
  group.add(plate);
  const boltAt = new THREE.Vector3(holeCentre.x, holeCentre.y + 0.055, -ROCK_GAP + thickness);
  const washer = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.006, 20), steel);
  washer.rotation.x = Math.PI / 2;
  washer.position.copy(boltAt).add(new THREE.Vector3(0, 0, 0.003));
  group.add(washer);
  const nut = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.02, 6), steel);
  nut.rotation.x = Math.PI / 2;
  nut.position.copy(boltAt).add(new THREE.Vector3(0, 0, 0.016));
  group.add(nut);
  const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.014, 12), steel);
  bolt.rotation.x = Math.PI / 2;
  bolt.position.copy(boltAt).add(new THREE.Vector3(0, 0, 0.032));
  group.add(bolt);
  return group;
}

/** Fine diagonal ridges for the screw sleeve. */
function knurlTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#d8dbe0';
  ctx.fillRect(0, 0, 64, 64);
  ctx.strokeStyle = '#8b9097';
  ctx.lineWidth = 2;
  for (let i = -64; i < 128; i += 8) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 64, 64);
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 3);
  return texture;
}
