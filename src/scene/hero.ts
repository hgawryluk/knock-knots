import type { RopePath } from '../trace/ropePath';

/** How far above its place the rope starts, and how long it takes to slide down. */
const SLIDE_FROM = 2.6;
const SLIDE_SECONDS = 1.8;
/** Path samples tied per second, then a breath, then the pull tight. */
const TIE_SAMPLES_PER_SECOND = 230;
const PAUSE_SECONDS = 0.25;
const TIGHTEN_SECONDS = 1.4;
/** The menu's three steps appear one every this many seconds (the first as tying starts, the last while it pulls tight). */
const STEP_SECONDS = 1.8;

const smooth = (t: number): number => t * t * (3 - 2 * t);
const easeOut = (t: number): number => 1 - (1 - t) ** 3;

/**
 * The menu's opening shot: the rope slides down from above, ties the knot
 * along its path and pulls it tight, then stays tied.
 */
export class HeroRope {
  private time = 0;
  /** How many of the menu's three steps have appeared, evenly spaced through the tying. */
  stepsLit = 0;

  constructor(
    private readonly path: RopePath,
    private readonly out: Float32Array,
    private readonly count: number,
    private readonly draw: (points: Float32Array) => void,
  ) {}

  restart(): void {
    this.time = 0;
    this.stepsLit = 0;
  }

  update(dt: number): void {
    this.time += dt;
    const { path } = this;
    const tieSeconds = (path.end - path.traceFrom) / TIE_SAMPLES_PER_SECOND;
    let t = this.time;
    let upTo = path.traceFrom;
    let tightness = 0;
    let drop = 0;
    if (t < SLIDE_SECONDS) {
      drop = SLIDE_FROM * (1 - easeOut(t / SLIDE_SECONDS));
    } else if ((t -= SLIDE_SECONDS) < tieSeconds) {
      upTo = path.traceFrom + (path.end - path.traceFrom) * smooth(t / tieSeconds);
    } else {
      upTo = path.end;
      t -= tieSeconds + PAUSE_SECONDS;
      tightness = t > 0 ? smooth(Math.min(t / TIGHTEN_SECONDS, 1)) : 0;
    }
    this.stepsLit = Math.min(Math.floor(this.time / STEP_SECONDS), 3);
    path.writeRope(upTo, tightness, this.count, this.out);
    if (drop) for (let i = 1; i < this.out.length; i += 3) this.out[i] += drop;
    this.draw(this.out);
  }
}
