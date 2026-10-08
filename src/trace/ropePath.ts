import * as THREE from 'three';
import type { KnotPath } from '../knots/types';
import { tightenKnot } from './tighten';

/** Dense, evenly spaced samples along a knot path; progress is measured in sample index. */
const SAMPLES = 900;

/**
 * A knot path ready to draw: evenly spaced samples of the loose knot and of
 * the frames of it drawing up snug, plus where tracing starts and where each step ends.
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

  constructor(path: KnotPath, ropeRadius: number) {
    const curve = new THREE.CatmullRomCurve3(
      path.points.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
      false,
      'centripetal',
    );
    const points = curve.getSpacedPoints(SAMPLES);
    this.loose = new Float32Array((SAMPLES + 1) * 3);
    points.forEach((p, i) => p.toArray(this.loose, i * 3));

    // Control point index → sample index (curve parameter → arc length fraction).
    const divisions = 2000;
    const lengths = curve.getLengths(divisions);
    const total = lengths[divisions];
    const sampleOf = (index: number): number =>
      (lengths[Math.round((index / (path.points.length - 1)) * divisions)] / total) * SAMPLES;
    this.traceFrom = sampleOf(path.traceFrom);
    this.stepEnds = path.stepEnds.map(sampleOf);

    const hold = path.hold && ([sampleOf(path.hold[0]), sampleOf(path.hold[1])] as [number, number]);
    const bodies = (path.bodies ?? [[path.knotFrom, path.tailFrom]]).map(([from, to]) => [sampleOf(from), sampleOf(to)] as [number, number]);
    this.frames = tightenKnot(this.loose, SAMPLES, ropeRadius, bodies, hold, path.rail);
    this.partnerEnd = path.partner ? sampleOf(path.partner.end) : -1;
    this.mainStart = path.partner ? sampleOf(path.partner.start) : 0;
  }

  /** Last sample index (the working end when fully traced). */
  get end(): number {
    return SAMPLES;
  }

  /** Point at a (fractional) sample index, `tightness` (0–1) of the way through drawing up snug. */
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

  /** Writes `count` points spread evenly over the main rope from its standing end to `upTo`. */
  writeRope(upTo: number, tightness: number, count: number, out: Float32Array): void {
    this.writeRange(this.mainStart, upTo, tightness, count, out);
  }

  /** Writes `count` points spread evenly over samples `from`..`to`. */
  writeRange(from: number, to: number, tightness: number, count: number, out: Float32Array): void {
    const p = new THREE.Vector3();
    for (let j = 0; j < count; j++) {
      this.pointAt(from + (j / (count - 1)) * (to - from), tightness, p).toArray(out, j * 3);
    }
  }
}
