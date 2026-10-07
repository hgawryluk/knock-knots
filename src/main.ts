import * as THREE from 'three';
import './styles.css';
import { isUnlocked, LEVELS, loadCompleted, saveCompleted } from './knots/levels';
import type { KnotContext, KnotDefinition, KnotSetup } from './knots/types';
import { RopeDragger } from './rope/ropeDragger';
import { RopeMesh } from './rope/ropeMesh';
import { layRope, RopeSim } from './rope/ropeSim';
import { createMeadow } from './scene/meadow';
import { Stage } from './scene/stage';
import { KnotPanel, type LevelState } from './ui/knotPanel';
import { createOverlay } from './ui/overlay';

const ROPE_RADIUS = 0.06;
const ROPE_SPACING = 0.05;
const ROPE_LENGTH = 9.4;
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
  grass: { target: new THREE.Vector3(0.6, 0.2, 3.9), distance: 9, polar: Math.PI * 0.27, azimuth: 0.15 },
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
sim.groundGrip = knot.setup === 'grass' ? 1 : 0;

const ropeMesh = new RopeMesh(sim.count, ROPE_RADIUS, { strand: '#ffcf4a', groove: '#b07a12' }, '#2f7cf6');
stage.scene.add(ropeMesh.object);
const dragger = new RopeDragger(sim, meadow.log, stage.camera, container, stage.controls, stage.scene);

const knotContext = (): KnotContext => ({ positions: sim.positions, count: sim.count, ropeRadius: ROPE_RADIUS, log: meadow.log });
const resetView = (): void => {
  const view = VIEWS[knot.setup];
  stage.setView(view.target, view.distance, view.polar, view.azimuth);
};

// ---- UI and progress ----------------------------------------------------------------------

const ui = document.getElementById('ui')!;
createOverlay(ui);

/** Once tied, the knot is set and stays counted as tied until the rope is reset. */
let tied = false;

const refreshLevels = (): void =>
  panel.setLevels(
    LEVELS,
    LEVELS.map((_, i) => levelState(i)),
    levelIndex,
  );

const updateProgress = (): void => {
  if (tied) return;
  const done = knot.evaluate(knotContext());
  tied = done >= knot.steps.length;
  sim.knotSet = tied;
  panel.setProgress(done);
  if (tied && !completed.has(knot.id)) {
    completed.add(knot.id);
    saveCompleted(completed);
    refreshLevels();
  }
};

const resetRope = (): void => {
  dragger.cancel();
  sim.reset(startPoints());
  sim.groundGrip = knot.setup === 'grass' ? 1 : 0;
  tied = false;
  resetView();
  updateProgress();
};

const selectLevel = (index: number, force = false): void => {
  const next = LEVELS[index].knot;
  if (!next || (!force && !isUnlocked(index, completed, unlockAll))) return;
  levelIndex = index;
  knot = next;
  panel.setKnot(knot);
  refreshLevels();
  resetRope();
};

const panel = new KnotPanel(ui, LEVELS, (index) => selectLevel(index), resetRope);
panel.setKnot(knot);
refreshLevels();

window.addEventListener('keydown', (event) => {
  if ((event.key === 'r' || event.key === 'R') && !event.repeat && !(event.target instanceof HTMLInputElement)) resetRope();
});

let sinceAnalysis = 0;
/** Dev tests drive the simulation themselves; the frame loop then only renders. */
let simPaused = false;
stage.onUpdate((dt) => {
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
  const { sampleAroundLog, surfaceCrossings, windingBetween } = await import('./knots/logAnalysis');
  const { analyzeFreeKnot } = await import('./knots/freeKnot');
  const { createMouse } = await import('./dev/mouse');
  const { mouseClove } = await import('./dev/mouseClove');
  const { mouseOverhand } = await import('./dev/mouseOverhand');
  const { createRopeBeads } = await import('./dev/ropeBeads');
  const beads = createRopeBeads(sim);
  beads.object.visible = false;
  stage.scene.add(beads.object);
  stage.onUpdate(beads.update);
  const mouse = createMouse(stage.renderer.domElement, stage.camera, () => sim.step(1 / 60));
  const evaluate = (): number => knot.evaluate(knotContext());
  const cloveLevel = LEVELS.findIndex((level) => level.knot?.id === 'clove-hitch');

  Object.assign(window, {
    __knots: {
      sim,
      stage,
      meadow,
      mouse,
      evaluate,
      reset: resetRope,
      select: (index: number) => selectLevel(index, true),
      freeKnot: () => analyzeFreeKnot(sim.positions, sim.count),
      /** Ties a clove hitch through the real mouse path with the sim driven synchronously. */
      mouseClove: (stopAfter?: string) => {
        simPaused = true;
        selectLevel(cloveLevel, true);
        const status = (): string => {
          updateProgress();
          const samples = sampleAroundLog(sim.positions, sim.count, meadow.log, ROPE_RADIUS);
          return `tied=${tied} completed=${evaluate()} turns=${windingBetween(samples, 0, sim.count - 1).toFixed(2)} crossings=${surfaceCrossings(samples).length}`;
        };
        // Like a person eyeing the X: slide the end along the standing part, one rope width to
        // the side the end hangs on, pressed to the bark (Shift), under the X and a little past it.
        const tuckPath = (): [number, number, number][] | null => {
          const samples = sampleAroundLog(sim.positions, sim.count, meadow.log, ROPE_RADIUS);
          const crossing = surfaceCrossings(samples).find((c) => c.over === c.b);
          if (!crossing) return null;
          const p = sim.positions;
          const side = Math.sign(p[(sim.count - 1) * 3] - p[crossing.a * 3]) || 1;
          const path: [number, number, number][] = [];
          for (let i = crossing.a - 12; i <= crossing.a + 8; i += 4) {
            const x = p[i * 3] + side * ROPE_RADIUS * 2.2;
            const s = meadow.log.sectionAt(x);
            const angle = Math.atan2((p[i * 3 + 2] - s.cz) / s.rz, (p[i * 3 + 1] - s.cy) / s.ry);
            path.push([x, s.cy + Math.cos(angle) * (s.ry + ROPE_RADIUS), s.cz + Math.sin(angle) * (s.rz + ROPE_RADIUS)]);
          }
          return path;
        };
        const log = mouseClove(sim, mouse, status, tuckPath, stopAfter);
        updateProgress();
        simPaused = false;
        return log;
      },
      /** Ties an overhand knot on the grass through the real mouse path. */
      mouseOverhand: (stopAfter?: string) => {
        simPaused = true;
        selectLevel(LEVELS.findIndex((level) => level.knot?.id === 'overhand'), true);
        const status = (): string => {
          updateProgress();
          const info = analyzeFreeKnot(sim.positions, sim.count);
          return `tied=${tied} completed=${evaluate()} crossings=${info.crossings} det=${info.determinant}`;
        };
        const log = mouseOverhand(sim, mouse, status, stopAfter);
        updateProgress();
        simPaused = false;
        return log;
      },
      pause: (paused: boolean) => (simPaused = paused),
      /** Re-runs the knot checker now and updates the panel. */
      check: updateProgress,
      beads: (on = true) => (beads.object.visible = on),
      /** Renders a frame and saves it to .shots/<name>.png via the dev server. */
      shot: async (name = 'shot') => {
        ropeMesh.update(sim.positions);
        beads.update();
        stage.renderer.render(stage.scene, stage.camera);
        const url = stage.renderer.domElement.toDataURL('image/png');
        await fetch(`/__shot?name=${name}`, { method: 'POST', body: url });
        return name;
      },
    },
  });
}

resetView();
requestAnimationFrame(() => document.getElementById('fade')!.classList.add('hidden'));
