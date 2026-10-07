import * as THREE from 'three';
import './styles.css';
import { createMouse } from './demo/mouse';
import { recordDemo, type DemoRecording } from './demo/recorder';
import { DEMO_SCRIPTS } from './demo/scripts';
import { isUnlocked, LEVELS, loadCompleted, saveCompleted } from './knots/levels';
import type { KnotContext, KnotDefinition, KnotSetup } from './knots/types';
import { RopeDragger } from './rope/ropeDragger';
import { RopeMesh } from './rope/ropeMesh';
import type { RopeColors } from './rope/ropeTexture';
import { layRope, RopeSim } from './rope/ropeSim';
import { createMeadow } from './scene/meadow';
import { Stage } from './scene/stage';
import { Coach } from './ui/coach';
import { DemoBar } from './ui/demoBar';
import { KnotPanel, type LevelState } from './ui/knotPanel';
import { createOverlay } from './ui/overlay';

const ROPE_RADIUS = 0.06;
const ROPE_SPACING = 0.05;
const ROPE_LENGTH = 9.4;
const ROPE_COLORS: RopeColors = { strand: '#ffcf4a', groove: '#b07a12' };
const WORKING_END_COLOR = '#2f7cf6';
const ANALYSIS_INTERVAL = 0.12;

const onGround = (points: number[][]): THREE.Vector3[] => points.map(([x, z]) => new THREE.Vector3(x, ROPE_RADIUS, z));

/** Where the rope starts for each setup; the first point is the tied-off standing end. Both paths are longer than the rope. */
const START_PATHS: Record<KnotSetup, THREE.Vector3[]> = {
  // On the open grass: the standing part comes in from off to the right, then a long
  // straight tail runs toward you — slack to lay loops with.
  grass: onGround([
    [6.5, 2.6], [5.0, 2.7], [3.5, 2.8], [2.0, 2.9], [0.6, 3.0],
    [0.2, 3.6], [0.1, 4.5], [0.1, 5.5], [0.1, 6.5],
  ]),
  // A loose S-curve on the grass just in front of the log.
  log: onGround([
    [3.2, 2.8], [2.2, 2.0], [1.0, 1.3], [0.0, 1.15], [-1.0, 1.4],
    [-1.7, 2.1], [-1.4, 2.9], [-0.4, 3.2], [0.6, 2.9], [1.1, 2.3],
  ]),
};

const VIEWS: Record<KnotSetup, { target: THREE.Vector3; distance: number; polar: number; azimuth: number }> = {
  grass: { target: new THREE.Vector3(0.6, 0.2, 4.5), distance: 9.5, polar: Math.PI * 0.27, azimuth: 0.15 },
  log: { target: new THREE.Vector3(0, 0.3, 0.6), distance: 9.5, polar: Math.PI * 0.3, azimuth: 0.35 },
};

const container = document.getElementById('stage')!;
const stage = new Stage(container);
const meadow = await createMeadow(stage.scene, stage.renderer);
stage.scene.add(meadow.root);
stage.onUpdate(meadow.update);

// ---- Levels -------------------------------------------------------------------------------

const unlockAll = new URLSearchParams(location.search).has('all');
const completed = loadCompleted();
const levelState = (index: number): LevelState => {
  const knot = LEVELS[index].knot;
  if (!knot) return 'soon';
  if (completed.has(knot.id)) return 'done';
  return isUnlocked(index, completed, unlockAll) ? 'open' : 'locked';
};
/** Start at the first knot that's open but not yet tied (or the first one). */
let levelIndex = Math.max(LEVELS.findIndex((_, i) => levelState(i) === 'open'), 0);
let knot: KnotDefinition = LEVELS[levelIndex].knot!;

// ---- Rope ---------------------------------------------------------------------------------

const startPoints = (): THREE.Vector3[] => layRope(START_PATHS[knot.setup], ROPE_LENGTH, ROPE_SPACING);
const sim = new RopeSim(startPoints(), ROPE_SPACING, ROPE_RADIUS, {
  log: meadow.log,
  ellipsoids: meadow.obstacles,
  groundY: 0,
});
sim.pin(0);

const ropeMesh = new RopeMesh(sim.count, ROPE_RADIUS, ROPE_COLORS, WORKING_END_COLOR);
const demoMesh = new RopeMesh(sim.count, ROPE_RADIUS, ROPE_COLORS, WORKING_END_COLOR);
demoMesh.object.visible = false;
stage.scene.add(ropeMesh.object, demoMesh.object);
const dragger = new RopeDragger(sim, meadow.log, stage.camera, container, stage.controls, stage.scene);

const knotContext = (): KnotContext => ({ positions: sim.positions, count: sim.count, ropeRadius: ROPE_RADIUS, log: meadow.log });
const resetView = (): void => {
  const view = VIEWS[knot.setup];
  stage.setView(view.target, view.distance, view.polar, view.azimuth);
};

// ---- UI -----------------------------------------------------------------------------------

const ui = document.getElementById('ui')!;
createOverlay(ui);
const coach = new Coach(ui);

/** "watch": the recorded demo plays on its own rope. "try": your rope, with step prompts. */
let mode: 'watch' | 'try' = 'try';
/** Once tied, the knot is set and stays counted as tied until the rope is reset. */
let tied = false;
/** Steps done at the last check, to notice progress and prompt the next step. */
let lastDone = -1;

const refreshLevels = (): void =>
  panel.setLevels(
    LEVELS,
    LEVELS.map((_, i) => levelState(i)),
    levelIndex,
  );

const prompt = (done: number): void => {
  if (done >= knot.steps.length) {
    const next = LEVELS.findIndex((_, i) => i > levelIndex && levelState(i) === 'open');
    coach.show(`${knot.name} tied!`, next >= 0 ? `Nicely done. ${LEVELS[next].name} is unlocked above.` : 'Nicely done.', 'success');
    return;
  }
  const step = knot.steps[done];
  const praise = done > lastDone && lastDone >= 0 ? 'Nice! ' : '';
  coach.show(`${praise}Step ${done + 1} of ${knot.steps.length} · ${step.title}`, step.hint);
};

const updateProgress = (): void => {
  if (tied || mode !== 'try') return;
  const done = knot.evaluate(knotContext());
  tied = done >= knot.steps.length;
  sim.knotSet = tied;
  panel.setProgress(done);
  if (tied && !completed.has(knot.id)) {
    completed.add(knot.id);
    saveCompleted(completed);
    refreshLevels();
  }
  if (done !== lastDone) {
    prompt(done);
    lastDone = done;
  }
};

const resetRope = (): void => {
  dragger.cancel();
  sim.reset(startPoints());
  sim.groundGrip = knot.setup === 'grass' ? 1 : 0;
  tied = false;
  lastDone = -1;
  resetView();
  updateProgress();
};

// ---- Demo ---------------------------------------------------------------------------------

const recordings = new Map<string, DemoRecording>();
const demoMouse = (step: () => void) => createMouse(stage.renderer.domElement, stage.camera, step);

/**
 * The demo for a knot: its script tied once on the live rope through the real
 * controls (faster than real time) and recorded. Cached per knot.
 */
const recordingFor = (k: KnotDefinition): DemoRecording | null => {
  const script = DEMO_SCRIPTS[k.id];
  if (!script) return null;
  const cached = recordings.get(k.id);
  if (cached) return cached;
  dragger.enabled = true;
  resetRope();
  const recording = recordDemo(
    script,
    { sim, log: meadow.log, ropeRadius: ROPE_RADIUS },
    demoMouse,
    () => k.evaluate(knotContext()) >= k.steps.length,
  );
  dragger.cancel();
  recordings.set(k.id, recording);
  return recording;
};

const tryIt = (): void => {
  mode = 'try';
  demoMesh.object.visible = false;
  ropeMesh.object.visible = true;
  dragger.enabled = true;
  demoBar.showTry(!!DEMO_SCRIPTS[knot.id]);
  resetRope();
};

const watch = (): void => {
  const recording = recordingFor(knot);
  if (!recording) {
    tryIt();
    return;
  }
  mode = 'watch';
  resetRope();
  dragger.cancel();
  dragger.enabled = false;
  dragger.update(); // hides the hover ring
  ropeMesh.object.visible = false;
  demoMesh.object.visible = true;
  coach.hide();
  demoBar.showWatch(
    recording,
    knot.steps.map((step) => step.title),
  );
};

const demoBar = new DemoBar(ui, {
  onTry: tryIt,
  onWatch: watch,
  onFrame(frame, step) {
    const recording = recordings.get(knot.id);
    if (recording) demoMesh.update(recording.frames[frame]);
    panel.setProgress(step, false);
  },
});

const selectLevel = (index: number, force = false): void => {
  const next = LEVELS[index].knot;
  if (!next || (!force && !isUnlocked(index, completed, unlockAll))) return;
  levelIndex = index;
  knot = next;
  panel.setKnot(knot);
  refreshLevels();
  watch();
};

/** Reset restarts whatever you're doing: the demo, or your rope. */
const reset = (): void => (mode === 'watch' ? watch() : resetRope());

const panel = new KnotPanel(ui, LEVELS, (index) => selectLevel(index), reset);
panel.setKnot(knot);
refreshLevels();

window.addEventListener('keydown', (event) => {
  if ((event.key === 'r' || event.key === 'R') && !event.repeat && !(event.target instanceof HTMLInputElement)) reset();
});

let sinceAnalysis = 0;
/** Dev tests drive the simulation themselves; the frame loop then only renders. */
let simPaused = false;
stage.onUpdate((dt) => {
  if (mode === 'watch') {
    demoBar.update(dt);
    return;
  }
  if (!simPaused) sim.step(dt);
  ropeMesh.update(sim.positions);
  dragger.update();

  sinceAnalysis += dt;
  if (sinceAnalysis >= ANALYSIS_INTERVAL) {
    sinceAnalysis = 0;
    updateProgress();
  }
});

if (import.meta.env.DEV) {
  const { analyzeFreeKnot } = await import('./knots/freeKnot');
  const { createEndDrag } = await import('./demo/drag');
  const { createRopeBeads } = await import('./dev/ropeBeads');
  const beads = createRopeBeads(sim);
  beads.object.visible = false;
  stage.scene.add(beads.object);
  stage.onUpdate(beads.update);
  const evaluate = (): number => knot.evaluate(knotContext());

  /** Regression: tie a knot's demo script on your own rope (try mode) and log the checker after each move. */
  const runScript = (id: string): string[] => {
    const index = LEVELS.findIndex((level) => level.knot?.id === id);
    simPaused = true;
    levelIndex = index;
    knot = LEVELS[index].knot!;
    panel.setKnot(knot);
    tryIt();
    const lines: string[] = [];
    const drag = createEndDrag(sim, demoMouse(() => sim.step(1 / 60)), {
      afterDrag(label) {
        updateProgress();
        lines.push(`${label}: tied=${tied} completed=${evaluate()}`);
      },
    });
    DEMO_SCRIPTS[id].run(drag, { sim, log: meadow.log, ropeRadius: ROPE_RADIUS });
    simPaused = false;
    return lines;
  };

  Object.assign(window, {
    __knots: {
      sim,
      stage,
      meadow,
      evaluate,
      reset: resetRope,
      select: (index: number) => selectLevel(index, true),
      freeKnot: () => analyzeFreeKnot(sim.positions, sim.count),
      runScript,
      mouseOverhand: () => runScript('overhand'),
      mouseClove: () => runScript('clove-hitch'),
      recording: () => recordings.get(knot.id),
      mode: () => mode,
      pause: (paused: boolean) => (simPaused = paused),
      beads: (on = true) => (beads.object.visible = on),
      /** Renders a frame and saves it to .shots/<name>.png via the dev server. */
      shot: async (name = 'shot') => {
        if (mode === 'try') ropeMesh.update(sim.positions);
        beads.update();
        stage.renderer.render(stage.scene, stage.camera);
        const url = stage.renderer.domElement.toDataURL('image/png');
        await fetch(`/__shot?name=${name}`, { method: 'POST', body: url });
        return name;
      },
    },
  });
}

// Open on the current knot's demo (or straight into "try" if it has none).
watch();
requestAnimationFrame(() => document.getElementById('fade')!.classList.add('hidden'));
