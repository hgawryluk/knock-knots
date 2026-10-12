import * as THREE from 'three';
import type { Clip, KnotPath, Point3, Rail } from '../knots/types';
import { relaxClip } from './clipRelax';
import { layOnGround } from './flat';
import { tightenKnot } from './tighten';

/** Dense, evenly spaced samples along a knot path; progress is measured in sample index. */
const SAMPLES = 900;
/** Clip-in knots: rope shapes precomputed through the tying, blended between. */
const CLIP_FRAMES = 160;
/** How far either side of a step's end (samples) the marker may jump to the next bit of rope you hold. */
export const HANDOFF = 4;

const smooth = (t: number): number => t * t * (3 - 2 * t);

/** Evenly spaced samples along a curve through the given control points. */
function sampleCurve(points: Point3[], out: Float32Array): THREE.CatmullRomCurve3 {
  const curve = new THREE.CatmullRomCurve3(
    points.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
    false,
    'centripetal',
  );
  curve.getSpacedPoints(SAMPLES).forEach((p, i) => p.toArray(out, i * 3));
  return curve;
}

/**
 * A knot path ready to draw: evenly spaced samples of the loose knot and of
 * the frames of it drawing up snug, plus where tracing starts and where each step ends.
 *
 * Progress runs in sample index from `traceFrom` to `end`. For most knots it is
 * how far the rope has been drawn out along the path. For a clip-in knot (see
 * `Clip`) the whole rope is always there and progress is how far through the
 * tying it has moved; you hold a marker on it rather than the end.
 */
export class RopePath {
  readonly sampleCount = SAMPLES;
  readonly traceFrom: number;
  readonly stepEnds: number[];
  /** Knots in two ropes: the second rope is samples 0..partnerEnd (-1 if none); the main rope starts at mainStart. */
  readonly partnerEnd: number;
  readonly mainStart: number;
  private readonly loose: Float32Array;
  /** Loose knot first, snug knot last. */
  private readonly frames: Float32Array[];
  /** Clip-in knots: the rope's shape through the tying, and which sample is held in each. */
  private readonly clip?: { def: Clip; shapes: Float32Array[]; held: Float32Array };

  constructor(path: KnotPath, ropeRadius: number) {
    this.loose = new Float32Array((SAMPLES + 1) * 3);
    const curve = sampleCurve(path.points, this.loose);
    if (path.flat) layOnGround(this.loose, SAMPLES, ropeRadius, path.flat.ground);

    // Control point index → sample index (curve parameter → arc length fraction).
    const divisions = 2000;
    const lengths = curve.getLengths(divisions);
    const total = lengths[divisions];
    const sampleOf = (index: number): number =>
      (lengths[Math.round((index / (path.points.length - 1)) * divisions)] / total) * SAMPLES;

    if (path.clip) {
      this.clip = buildClip(path.clip, ropeRadius, path.rail);
      this.traceFrom = 0;
      this.stepEnds = path.clip.stepEnds.map((t) => t * SAMPLES);
    } else {
      this.traceFrom = sampleOf(path.traceFrom);
      this.stepEnds = path.stepEnds.map(sampleOf);
    }

    const hold = path.hold && ([sampleOf(path.hold[0]), sampleOf(path.hold[1])] as [number, number]);
    const bodies = (path.bodies ?? [[path.knotFrom, path.tailFrom]]).map(([from, to]) => [sampleOf(from), sampleOf(to)] as [number, number]);
    this.frames = tightenKnot(this.loose, SAMPLES, ropeRadius, bodies, hold, path.rail, path.flat?.ground);
    this.partnerEnd = path.partner ? sampleOf(path.partner.end) : -1;
    this.mainStart = path.partner ? sampleOf(path.partner.start) : 0;
  }

  /** Last sample index (the working end when fully traced). */
  get end(): number {
    return SAMPLES;
  }

  /** How long the demo of a clip-in knot takes (seconds), or undefined to go by the length of the path. */
  get demoSeconds(): number | undefined {
    return this.clip?.def.seconds;
  }

  /** A clip-in knot: the whole rope moves, and you hold a marker on it. */
  get clipsIn(): boolean {
    return Boolean(this.clip);
  }

  /** Point at a (fractional) sample index of the finished knot, `tightness` (0–1) of the way through drawing up snug. */
  pointAt(sample: number, tightness: number, out: THREE.Vector3): THREE.Vector3 {
    const s = Math.min(Math.max(sample, 0), SAMPLES);
    const i = Math.min(Math.floor(s), SAMPLES - 1);
    const f = s - i;
    const a = i * 3;
    const b = a + 3;
    // Between the two frames either side of `tightness`.
    const t = Math.min(Math.max(tightness, 0), 1) * (this.frames.length - 1);
    const k = Math.min(Math.floor(t), this.frames.length - 2);
    const from = this.frames[k];
    const to = this.frames[k + 1];
    const blend = t - k;
    const at = (axis: number): number => {
      const p = from[a + axis] + (from[b + axis] - from[a + axis]) * f;
      const q = to[a + axis] + (to[b + axis] - to[a + axis]) * f;
      return p + (q - p) * blend;
    };
    return out.set(at(0), at(1), at(2));
  }

  /** Where the thing you hold is at `progress`: the working end, or for a clip-in knot the marker on the rope. */
  handleAt(progress: number, out: THREE.Vector3): THREE.Vector3 {
    if (!this.clip) return this.pointAt(progress, 0, out);
    const [k, blend] = this.clipFrame(progress);
    return this.clipPoint(k, blend, this.clip.held[blend < 0.5 ? k : k + 1], out);
  }

  /** Whether the marker jumps to another bit of rope at `progress` (you let go and take hold of it there). */
  handleJumps(progress: number): boolean {
    if (!this.clip) return false;
    const a = this.handleAt(progress - HANDOFF, new THREE.Vector3());
    const b = this.handleAt(progress + HANDOFF, new THREE.Vector3());
    return a.distanceTo(b) > 0.04;
  }

  /** The carabiner's gate at `progress` of a clip-in knot: how far it is open and unscrewed (0–1). */
  gateAt(progress: number): { open: number; unscrewed: number } {
    if (!this.clip) return { open: 0, unscrewed: 0 };
    const t = Math.min(Math.max(progress / SAMPLES, 0), 1);
    const { unscrew, open, close, lock } = this.clip.def.gate;
    const ramp = ([from, to]: [number, number]): number => smooth(Math.min(Math.max((t - from) / (to - from), 0), 1));
    return { open: ramp(open) - ramp(close), unscrewed: ramp(unscrew) - ramp(lock) };
  }

  /** Writes `count` points spread evenly over the main rope from its standing end to `upTo` (a clip-in knot: all of it, as it is at `upTo`). */
  writeRope(upTo: number, tightness: number, count: number, out: Float32Array): void {
    if (this.clip && (upTo < SAMPLES || tightness <= 0)) {
      const [k, blend] = this.clipFrame(upTo);
      const p = new THREE.Vector3();
      for (let j = 0; j < count; j++) this.clipPoint(k, blend, (j / (count - 1)) * SAMPLES, p).toArray(out, j * 3);
      return;
    }
    this.writeRange(this.clip ? 0 : this.mainStart, this.clip ? SAMPLES : upTo, tightness, count, out);
  }

  /** Writes `count` points spread evenly over samples `from`..`to`. */
  writeRange(from: number, to: number, tightness: number, count: number, out: Float32Array): void {
    const p = new THREE.Vector3();
    for (let j = 0; j < count; j++) {
      this.pointAt(from + (j / (count - 1)) * (to - from), tightness, p).toArray(out, j * 3);
    }
  }

  /** The precomputed shapes either side of `progress`, and how far between them. */
  private clipFrame(progress: number): [number, number] {
    const t = Math.min(Math.max(progress / SAMPLES, 0), 1) * (CLIP_FRAMES - 1);
    const k = Math.min(Math.floor(t), CLIP_FRAMES - 2);
    return [k, t - k];
  }

  /** A point on the rope at (fractional) sample `s`, between shapes k and k + 1. */
  private clipPoint(k: number, blend: number, s: number, out: THREE.Vector3): THREE.Vector3 {
    const shapes = this.clip!.shapes;
    const c = Math.min(Math.max(s, 0), SAMPLES);
    const i = Math.min(Math.floor(c), SAMPLES - 1);
    const f = c - i;
    const at = (shape: Float32Array, axis: number): number => shape[i * 3 + axis] + (shape[i * 3 + 3 + axis] - shape[i * 3 + axis]) * f;
    const axis = (n: number): number => at(shapes[k], n) + (at(shapes[k + 1], n) - at(shapes[k], n)) * blend;
    return out.set(axis(0), axis(1), axis(2));
  }
}

/** Control points per pose once each is resampled evenly along the rope (so poses can be authored with any number). */
const POSE_POINTS = 72;

/**
 * The rope's shape at evenly spaced moments through a clip-in knot: each pose
 * resampled to the same number of points evenly along the rope, eased from pose
 * to pose, then sampled; and which sample is held then. On a carabiner the shapes
 * are then made physically possible (see relaxClip).
 */
function buildClip(def: Clip, ropeRadius: number, bar?: Rail): { def: Clip; shapes: Float32Array[]; held: Float32Array } {
  const shapes: Float32Array[] = [];
  const held = new Float32Array(CLIP_FRAMES);
  // Poses authored point for point are blended point for point; otherwise each is
  // evenly resampled. And where along each pose (0–1) the held point lies.
  const matched = def.poses.every((pose) => pose.length === def.poses[0].length);
  const poses: Point3[][] = [];
  const heldAt: number[] = [];
  def.poses.forEach((pose, k) => {
    const curve = new THREE.CatmullRomCurve3(pose.map(([x, y, z]) => new THREE.Vector3(x, y, z)), false, 'centripetal');
    poses.push(matched ? pose : curve.getSpacedPoints(POSE_POINTS - 1).map((p): Point3 => [p.x, p.y, p.z]));
    heldAt.push(matched ? def.handle[k] / (pose.length - 1) : curve.getLengths(1000)[Math.round((def.handle[k] / (pose.length - 1)) * 1000)] / curve.getLength());
  });
  const count = poses[0].length;
  for (let f = 0; f < CLIP_FRAMES; f++) {
    const t = f / (CLIP_FRAMES - 1);
    let seg = def.times.findIndex((time, i) => i > 0 && t <= time) - 1;
    if (seg < 0) seg = def.times.length - 2;
    const local = smooth(Math.min(Math.max((t - def.times[seg]) / (def.times[seg + 1] - def.times[seg]), 0), 1));
    const a = poses[seg];
    const b = poses[seg + 1];
    const points: Point3[] = [];
    for (let i = 0; i < count; i++) {
      points.push([a[i][0] + (b[i][0] - a[i][0]) * local, a[i][1] + (b[i][1] - a[i][1]) * local, a[i][2] + (b[i][2] - a[i][2]) * local]);
    }
    // Sampled evenly by control point, not by length: each sample stays the same bit of rope from
    // shape to shape even as the rope's length in view changes, so blending never cuts across.
    const shape = new Float32Array((SAMPLES + 1) * 3);
    const curve = new THREE.CatmullRomCurve3(points.map(([x, y, z]) => new THREE.Vector3(x, y, z)), false, 'centripetal');
    const p = new THREE.Vector3();
    for (let i = 0; i <= SAMPLES; i++) curve.getPoint(i / SAMPLES, p).toArray(shape, i * 3);
    shapes.push(shape);
    // The bit of rope you hold while moving toward a pose is that pose's: it changes only from
    // one move to the next (the marker then jumps there and you take hold again).
    held[f] = heldAt[seg + 1] * SAMPLES;
  }
  if (bar?.carabiner) {
    const ramp = ([from, to]: [number, number], t: number): number => smooth(Math.min(Math.max((t - from) / (to - from), 0), 1));
    relaxClip(shapes, SAMPLES, ropeRadius, (f) => {
      const t = f / (CLIP_FRAMES - 1);
      return ramp(def.gate.open, t) - ramp(def.gate.close, t);
    });
  }
  return { def, shapes, held };
}
