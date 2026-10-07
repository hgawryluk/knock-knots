import * as THREE from 'three';
import type { KnotPath } from '../knots/types';
import { tightenKnot } from './tighten';

/** Dense, evenly spaced samples along a knot path; progress is measured in sample index. */
const SAMPLES = 900;

/**
 * A knot path ready to draw: evenly spaced samples of the loose knot and of
 * its tightened form, plus where tracing starts and where each step ends.
 */
export class RopePath {
  readonly sampleCount = SAMPLES;
  readonly traceFrom: number;
  readonly stepEnds: number[];
  private readonly loose: Float32Array;
  private readonly tight: Float32Array;

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

    this.tight = tightenKnot(this.loose, SAMPLES, ropeRadius, sampleOf(path.knotFrom), sampleOf(path.tailFrom));
  }

  /** Last sample index (the working end when fully traced). */
  get end(): number {
    return SAMPLES;
  }

  /** Point at a (fractional) sample index, blended toward the tightened knot by `tightness`. */
  pointAt(sample: number, tightness: number, out: THREE.Vector3): THREE.Vector3 {
    const s = Math.min(Math.max(sample, 0), SAMPLES);
    const i = Math.min(Math.floor(s), SAMPLES - 1);
    const f = s - i;
    const a = i * 3;
    const b = a + 3;
    const at = (axis: number): number => {
      const loose = this.loose[a + axis] + (this.loose[b + axis] - this.loose[a + axis]) * f;
      const tight = this.tight[a + axis] + (this.tight[b + axis] - this.tight[a + axis]) * f;
      return loose + (tight - loose) * tightness;
    };
    return out.set(at(0), at(1), at(2));
  }

  /** Writes `count` points spread evenly over the rope from the standing end to `upTo`. */
  writeRope(upTo: number, tightness: number, count: number, out: Float32Array): void {
    const p = new THREE.Vector3();
    for (let j = 0; j < count; j++) {
      this.pointAt((j / (count - 1)) * upTo, tightness, p).toArray(out, j * 3);
    }
  }
}
