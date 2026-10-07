import * as THREE from 'three';
import './styles.css';
import { CLOVE_HITCH } from './knots/cloveHitch';
import { sampleAroundLog, surfaceCrossings, windingBetween } from './knots/logAnalysis';
import { RopeDragger } from './rope/ropeDragger';
import { RopeMesh } from './rope/ropeMesh';
import { layRope, RopeSim } from './rope/ropeSim';
import { createMeadow } from './scene/meadow';
import { Stage } from './scene/stage';
import { KnotPanel } from './ui/knotPanel';
import { createOverlay } from './ui/overlay';

const ROPE_RADIUS = 0.06;
const ROPE_SPACING = 0.05;
const ROPE_LENGTH = 9.4;
const ANALYSIS_INTERVAL = 0.12;

/** Loose S-curve on the grass in front of the log; the first point is the tied-off standing end. */
const START_PATH = [
  [3.2, 2.8], [2.2, 2.0], [1.0, 1.3], [0.0, 1.15], [-1.0, 1.4],
  [-1.7, 2.1], [-1.4, 2.9], [-0.4, 3.2], [0.6, 2.9], [1.1, 2.3],
].map(([x, z]) => new THREE.Vector3(x, ROPE_RADIUS, z));

const container = document.getElementById('stage')!;
const stage = new Stage(container);
const meadow = await createMeadow(stage.scene, stage.renderer);
stage.scene.add(meadow.root);
stage.onUpdate(meadow.update);

const startPoints = (): THREE.Vector3[] => layRope(START_PATH, ROPE_LENGTH, ROPE_SPACING);
const sim = new RopeSim(startPoints(), ROPE_SPACING, ROPE_RADIUS, {
  log: meadow.log,
  ellipsoids: meadow.obstacles,
  groundY: 0,
});
sim.pin(0);

const ropeMesh = new RopeMesh(sim.count, ROPE_RADIUS, { base: '#e8742a', strand: '#b4501b', fleck: '#f6d9a6' }, '#2f7cf6');
stage.scene.add(ropeMesh.object);
const dragger = new RopeDragger(sim, meadow.log, stage.camera, container, stage.controls, stage.scene);

const ui = document.getElementById('ui')!;
createOverlay(ui);
const panel = new KnotPanel(ui, CLOVE_HITCH, () => sim.reset(startPoints()));

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
    const samples = sampleAroundLog(sim.positions, sim.count, meadow.log, ROPE_RADIUS);
    panel.setProgress(CLOVE_HITCH.evaluate(samples).completed);
  }
});

if (import.meta.env.DEV) {
  const evaluate = () => CLOVE_HITCH.evaluate(sampleAroundLog(sim.positions, sim.count, meadow.log, ROPE_RADIUS));
  const { tieClove } = await import('./dev/cloveScript');
  const { createMouse } = await import('./dev/mouse');
  const { mouseClove } = await import('./dev/mouseClove');
  const { createRopeBeads } = await import('./dev/ropeBeads');
  const beads = createRopeBeads(sim);
  beads.object.visible = false;
  stage.scene.add(beads.object);
  stage.onUpdate(beads.update);
  const mouse = createMouse(stage.renderer.domElement, stage.camera, () => sim.step(1 / 60));
  Object.assign(window, {
    __knots: { sim, stage, meadow, evaluate, mouse,
    /** Ties a clove hitch through the real mouse path with the sim driven synchronously. */
    mouseClove: (stopAfter?: string) => {
      simPaused = true;
      sim.reset(startPoints());
      resetView();
      const status = (): string => {
        const samples = sampleAroundLog(sim.positions, sim.count, meadow.log, ROPE_RADIUS);
        return `completed=${CLOVE_HITCH.evaluate(samples).completed} turns=${windingBetween(samples, 0, sim.count - 1).toFixed(2)} crossings=${surfaceCrossings(samples).length}`;
      };
      // Like a person eyeing the X from the normal view: carry the end on round the log in the
      // direction it's been wrapping, pressed to the bark (Shift), under the X and just past it.
      const tuckPath = (): [number, number, number][] | null => {
        const samples = sampleAroundLog(sim.positions, sim.count, meadow.log, ROPE_RADIUS);
        const crossing = surfaceCrossings(samples).find((c) => c.over === c.b);
        if (!crossing) return null;
        const { x, theta } = samples[crossing.b];
        const wrap = Math.sign(windingBetween(samples, 0, sim.count - 1)) || -1;
        const side = Math.sign(sim.positions[(sim.count - 1) * 3] - x) || 1;
        const s = meadow.log.sectionAt(x);
        const bark = (dx: number, dTheta: number): [number, number, number] => [
          x + dx * side,
          s.cy + Math.cos(theta + dTheta * wrap) * (s.ry + ROPE_RADIUS),
          s.cz + Math.sin(theta + dTheta * wrap) * (s.rz + ROPE_RADIUS),
        ];
        // Run parallel to the standing part, one rope width to the side, so the end lies beside it under the X.
        const beside = ROPE_RADIUS * 2.2;
        return [bark(beside, -1.6), bark(beside, -1.0), bark(beside, -0.4), bark(beside, 0), bark(beside, 0.45)];
      };
      const log = mouseClove(sim, mouse, status, tuckPath, stopAfter);
      panel.setProgress(evaluate().completed);
      simPaused = false;
      return log;
    },
    pause: (paused: boolean) => (simPaused = paused),
    /** Re-runs the knot checker now and updates the panel. */
    check: () => panel.setProgress(evaluate().completed),
    /** Draws a frame now (the page's own loop stalls while the tab is hidden). */
    render: () => {
      ropeMesh.update(sim.positions);
      stage.renderer.render(stage.scene, stage.camera);
    },
    /** Renders a frame and saves it to .shots/<name>.png via the dev server. */
    beads: (on = true) => (beads.object.visible = on),
    shot: async (name = 'shot') => {
      ropeMesh.update(sim.positions);
      beads.update();
      stage.renderer.render(stage.scene, stage.camera);
      const url = stage.renderer.domElement.toDataURL('image/png');
      await fetch(`/__shot?name=${name}`, { method: 'POST', body: url });
      return name;
    }, reset: () => sim.reset(startPoints()), tieClove: (stopAfter?: string) => tieClove(sim, meadow.log, ROPE_RADIUS, evaluate, stopAfter) },
  });
}

const resetView = (): void => stage.setView(new THREE.Vector3(0, 0.3, 0.6), 9.5, Math.PI * 0.3, 0.35);
resetView();
requestAnimationFrame(() => document.getElementById('fade')!.classList.add('hidden'));
