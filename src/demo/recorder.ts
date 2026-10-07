import { createEndDrag } from './drag';
import type { Mouse } from './mouse';
import type { DemoScript, ScriptEnv } from './scripts';

export interface DemoRecording {
  /** Rope particle positions, one snapshot per recorded frame. */
  frames: Float32Array[];
  /** First frame of each knot step. */
  stepFrames: number[];
  /** Frames per second the recording should play back at. */
  fps: number;
}

/** Record every other 60 Hz step: 30 fps playback, half the memory. */
const RECORD_EVERY = 2;
/** Let the finished knot rest a moment at the end of the demo. */
const HOLD_FRAMES = 45;

/**
 * Runs a scripted tie on the live rope (synchronously, faster than real time)
 * and records it. The caller resets the rope and view before and after.
 */
export function recordDemo(
  script: DemoScript,
  env: ScriptEnv,
  createMouse: (step: () => void) => Mouse,
  /** True once the knot is tied; the recording then sets the knot so it holds. */
  isTied: () => boolean,
): DemoRecording {
  const { sim } = env;
  const frames: Float32Array[] = [];
  const stepFrames = script.stepStarts.map(() => 0);
  let steps = 0;

  const step = (): void => {
    sim.step(1 / 60);
    if (++steps % RECORD_EVERY === 0) frames.push(sim.positions.slice());
  };
  const mouse = createMouse(step);
  frames.push(sim.positions.slice());

  const drag = createEndDrag(sim, mouse, {
    beforeDrag(label) {
      const index = script.stepStarts.indexOf(label);
      if (index >= 0) stepFrames[index] = frames.length;
    },
    afterDrag() {
      if (!sim.knotSet && isTied()) sim.knotSet = true;
    },
  });
  script.run(drag, env);
  mouse.wait(HOLD_FRAMES * RECORD_EVERY * 16);
  return { frames, stepFrames, fps: 60 / RECORD_EVERY };
}
