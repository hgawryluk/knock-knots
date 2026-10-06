import * as THREE from 'three';
import './styles.css';
import { CLOVE_HITCH } from './knots/cloveHitch';
import { sampleAroundLog } from './knots/logAnalysis';
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
const dragger = new RopeDragger(sim, stage.camera, container, stage.controls, stage.scene);

const ui = document.getElementById('ui')!;
createOverlay(ui);
const panel = new KnotPanel(ui, CLOVE_HITCH, () => sim.reset(startPoints()));

let sinceAnalysis = 0;
stage.onUpdate((dt) => {
  sim.step(dt);
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
  Object.assign(window, {
    __knots: { sim, stage, meadow, evaluate, reset: () => sim.reset(startPoints()), tieClove: (stopAfter?: string) => tieClove(sim, meadow.log, ROPE_RADIUS, evaluate, stopAfter) },
  });
}

stage.setView(new THREE.Vector3(0, 0.3, 0.6), 9.5, Math.PI * 0.3, 0.35);
requestAnimationFrame(() => document.getElementById('fade')!.classList.add('hidden'));
