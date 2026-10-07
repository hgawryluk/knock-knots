import * as THREE from 'three';
import './styles.css';
import { isUnlocked, LEVELS, loadCompleted, saveCompleted } from './knots/levels';
import type { KnotDefinition } from './knots/types';
import { RopeMesh } from './rope/ropeMesh';
import type { RopeColors } from './rope/ropeTexture';
import { createMeadow } from './scene/meadow';
import { Stage } from './scene/stage';
import { RopePath } from './trace/ropePath';
import { Tracer } from './trace/tracer';
import { Coach } from './ui/coach';
import { DemoBar, type Timeline } from './ui/demoBar';
import { KnotPanel, type LevelState } from './ui/knotPanel';
import { createOverlay } from './ui/overlay';

const ROPE_RADIUS = 0.033;
/** Points the rope tube is drawn through (spread over however much rope is out). */
const ROPE_POINTS = 320;
const ROPE_COLORS: RopeColors = { strand: '#ffcf4a', groove: '#b07a12' };
const WORKING_END_COLOR = '#2f7cf6';
/** Demo pacing: path samples drawn per second, then the pull-tight and a short rest. */
const DEMO_FPS = 30;
const DEMO_SAMPLES_PER_SECOND = 110;
const TIGHTEN_SECONDS = 1.2;
const REST_SECONDS = 1;

const container = document.getElementById('stage')!;
const stage = new Stage(container);
const meadow = await createMeadow(stage.scene, stage.renderer);
stage.scene.add(meadow.root);
stage.onUpdate(meadow.update);

// Free orbit all the way round the hanging knot, from just below eye level to well above.
Object.assign(stage.controls, { minDistance: 1.4, maxDistance: 7, minPolarAngle: Math.PI * 0.08, maxPolarAngle: Math.PI * 0.6 });
const KNOT_VIEW = { target: new THREE.Vector3(0.1, 1.3, 1.9), distance: 4.6, polar: Math.PI * 0.46, azimuth: 0.15 };
const resetView = (): void => stage.glideTo(KNOT_VIEW);

// ---- Levels -------------------------------------------------------------------------------

const unlockAll = new URLSearchParams(location.search).has('all');
const completed = loadCompleted();
const levelState = (index: number): LevelState => {
  const level = LEVELS[index];
  if (!level.path) return 'soon';
  if (completed.has(level.id)) return 'done';
  return isUnlocked(index, completed, unlockAll) ? 'open' : 'locked';
};
/** Start at the first knot that's open but not yet tied (or the first one). */
let levelIndex = Math.max(LEVELS.findIndex((_, i) => levelState(i) === 'open'), 0);
let knot: KnotDefinition = LEVELS[levelIndex];
let path = new RopePath(knot.path!, ROPE_RADIUS);

// ---- Rope ---------------------------------------------------------------------------------

const rope = new RopeMesh(ROPE_POINTS, ROPE_RADIUS, ROPE_COLORS, WORKING_END_COLOR);
stage.scene.add(rope.object);
const ropePoints = new Float32Array(ROPE_POINTS * 3);
/** Draws the rope from the standing end up to `upTo` along the path, `tightness` of the way to snug. */
const drawRope = (upTo: number, tightness = 0): void => {
  path.writeRope(upTo, tightness, ROPE_POINTS, ropePoints);
  rope.update(ropePoints);
};

const tracer = new Tracer(stage.camera, container, stage.controls, ROPE_RADIUS);
stage.scene.add(tracer.object);

// ---- UI -----------------------------------------------------------------------------------

const ui = document.getElementById('ui')!;
createOverlay(ui);
const coach = new Coach(ui);

/** "watch": the knot draws itself. "try": you trace it. */
let mode: 'watch' | 'try' = 'watch';
/** Set when the traced knot has been pulled tight; animates 0 → 1. */
let tightening = -1;
/** Index of the step currently being traced, to prompt each new one once. */
let promptedStep = -1;

const stepAt = (progress: number): number => {
  const index = path.stepEnds.findIndex((end) => progress < end - 0.5);
  return index < 0 ? knot.steps.length : index;
};

const refreshLevels = (): void =>
  panel.setLevels(
    LEVELS,
    LEVELS.map((_, i) => levelState(i)),
    levelIndex,
  );

const prompt = (step: number): void => {
  if (step >= knot.steps.length) {
    const next = LEVELS.findIndex((_, i) => i > levelIndex && levelState(i) === 'open');
    coach.show(`${knot.name} tied!`, next >= 0 ? `Nicely done. ${LEVELS[next].name} is unlocked above.` : 'Nicely done — more knots are on the way.', 'success');
    return;
  }
  const praise = step > 0 ? 'Nice! ' : '';
  coach.show(`${praise}Step ${step + 1} of ${knot.steps.length} · ${knot.steps[step].title}`, knot.steps[step].hint);
};

tracer.onProgress = (shown) => {
  drawRope(shown);
  const step = stepAt(shown);
  panel.setProgress(Math.min(step, knot.steps.length - 1), false);
  if (step !== promptedStep && step < knot.steps.length) {
    promptedStep = step;
    prompt(step);
  }
  if (tracer.settled && tightening < 0) tightening = 0;
};

const finishTie = (): void => {
  panel.setProgress(knot.steps.length);
  if (!completed.has(knot.id)) {
    completed.add(knot.id);
    saveCompleted(completed);
    refreshLevels();
  }
  prompt(knot.steps.length);
};

// ---- Watch / try --------------------------------------------------------------------------

type DemoTimeline = Timeline & { traceFrames: number; tightenFrames: number };

/** The demo as a timeline: draw the path, pull tight, rest. */
const timelineFor = (): DemoTimeline => {
  const traceFrames = Math.round(((path.end - path.traceFrom) / DEMO_SAMPLES_PER_SECOND) * DEMO_FPS);
  const tightenFrames = Math.round(TIGHTEN_SECONDS * DEMO_FPS);
  const frameOf = (sample: number): number => Math.round(((sample - path.traceFrom) / (path.end - path.traceFrom)) * traceFrames);
  return {
    frameCount: traceFrames + tightenFrames + Math.round(REST_SECONDS * DEMO_FPS),
    stepFrames: [0, ...path.stepEnds.slice(0, -1).map(frameOf)],
    fps: DEMO_FPS,
    traceFrames,
    tightenFrames,
  };
};
let timeline = timelineFor();

const watch = (): void => {
  mode = 'watch';
  tracer.stop();
  tightening = -1;
  coach.hide();
  resetView();
  demoBar.showWatch(
    timeline,
    knot.steps.map((step) => step.title),
  );
};

const tryIt = (): void => {
  mode = 'try';
  tightening = -1;
  promptedStep = -1;
  demoBar.showTry(true);
  resetView();
  tracer.start(path);
};

const demoBar = new DemoBar(ui, {
  onTry: tryIt,
  onWatch: watch,
  onFrame(frame, step) {
    const { traceFrames, tightenFrames } = timeline;
    if (frame <= traceFrames) {
      drawRope(path.traceFrom + ((path.end - path.traceFrom) * frame) / traceFrames);
    } else {
      const t = Math.min((frame - traceFrames) / tightenFrames, 1);
      drawRope(path.end, t * t * (3 - 2 * t));
    }
    panel.setProgress(step, false);
  },
});

const selectLevel = (index: number): void => {
  if (!isUnlocked(index, completed, unlockAll)) return;
  levelIndex = index;
  knot = LEVELS[index];
  path = new RopePath(knot.path!, ROPE_RADIUS);
  timeline = timelineFor();
  panel.setKnot(knot);
  refreshLevels();
  watch();
};

/** Reset restarts whatever you're doing: the demo, or your tracing. */
const reset = (): void => (mode === 'watch' ? watch() : tryIt());

const panel = new KnotPanel(ui, LEVELS, selectLevel, reset);
panel.setKnot(knot);
refreshLevels();

window.addEventListener('keydown', (event) => {
  if ((event.key === 'r' || event.key === 'R') && !event.repeat && !(event.target instanceof HTMLInputElement)) reset();
});

stage.onUpdate((dt) => {
  if (mode === 'watch') {
    demoBar.update(dt);
    return;
  }
  tracer.update(dt);
  if (tightening >= 0 && tightening < 1) {
    tightening = Math.min(tightening + dt / TIGHTEN_SECONDS, 1);
    drawRope(path.end, tightening * tightening * (3 - 2 * tightening));
    if (tightening >= 1) finishTie();
  }
});

if (import.meta.env.DEV) {
  const { analyzeFreeKnot } = await import('./knots/freeKnot');
  Object.assign(window, {
    __knots: {
      stage,
      tracer,
      path: () => path,
      mode: () => mode,
      select: selectLevel,
      /** Checks the authored path really is the knot: crossings and knot determinant as seen from the front. */
      checkPath: () => {
        const n = path.end + 1;
        const front = new Float32Array(n * 3);
        const p = new THREE.Vector3();
        for (let i = 0; i < n; i++) {
          path.pointAt(i, 0, p);
          // View from +z: depth toward the camera plays the role of height.
          front.set([p.x, p.z, p.y], i * 3);
        }
        return analyzeFreeKnot(front, n);
      },
      /** Renders a frame and saves it to .shots/<name>.png via the dev server. */
      shot: async (name = 'shot') => {
        stage.render();
        await fetch(`/__shot?name=${name}`, { method: 'POST', body: stage.renderer.domElement.toDataURL('image/png') });
        return name;
      },
    },
  });
}

stage.setView(KNOT_VIEW);
watch();
requestAnimationFrame(() => document.getElementById('fade')!.classList.add('hidden'));
