import * as THREE from 'three';
import './styles.css';
import { applyDocument, knotText, onLangChange, t } from './i18n';
import { isUnlocked, LEVELS, loadCompleted, saveCompleted, SECTIONS } from './knots/levels';
import type { KnotDefinition, SectionId } from './knots/types';
import { END_STYLES, type EndStyle } from './rope/ropeEnd';
import { RopeMesh } from './rope/ropeMesh';
import type { RopeColors } from './rope/ropeTexture';
import { HeroRope } from './scene/hero';
import { createMeadow } from './scene/meadow';
import { CampRail } from './scene/rail';
import { Stage } from './scene/stage';
import { RopePath } from './trace/ropePath';
import { Tracer } from './trace/tracer';
import { Coach } from './ui/coach';
import { DemoBar, type Timeline } from './ui/demoBar';
import { KnotPanel, type LevelState } from './ui/knotPanel';
import { Landing } from './ui/landing';
import { createLangSwitch } from './ui/langSwitch';
import { OrbitHint } from './ui/orbitHint';
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
/** When you start tying yourself, the view turns gently to one side and back, to show it can be turned. */
const SWAY_DELAY = 1.1;
const SWAY_SECONDS = 2.6;
const SWAY_ANGLE = 0.2;

const container = document.getElementById('stage')!;
const stage = new Stage(container);
const meadow = await createMeadow(stage.scene, stage.renderer);
stage.scene.add(meadow.root);
stage.onUpdate(meadow.update);

// Free orbit all the way round the hanging knot, from just below eye level to well above.
Object.assign(stage.controls, { minDistance: 1.4, maxDistance: 7, minPolarAngle: Math.PI * 0.08, maxPolarAngle: Math.PI * 0.6 });
const KNOT_VIEW = { target: new THREE.Vector3(0.1, 1.3, 1.9), distance: 4.6, polar: Math.PI * 0.46, azimuth: 0.15 };
const resetView = (): void => stage.glideTo(KNOT_VIEW);
/** Menu camera: close on the hero knot at the top of the page, drawing back and aside as the cards scroll in. */
const HERO_VIEW = { target: new THREE.Vector3(0.05, 1.42, 1.9), distance: 2.9, polar: Math.PI * 0.47, azimuth: 0.2 };
const MENU_VIEW = { target: new THREE.Vector3(-0.55, 1.3, 1.9), distance: 3.5, polar: Math.PI * 0.44, azimuth: 0.45 };

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
/** Working end finish; try others with ?end=dyed|whipped|taped|aglet|cap. */
const endParam = new URLSearchParams(location.search).get('end');
rope.setEndStyle(END_STYLES.includes(endParam as EndStyle) ? (endParam as EndStyle) : 'cap');
stage.scene.add(rope.object);
const ropePoints = new Float32Array(ROPE_POINTS * 3);
/** Draws the rope from the standing end up to `upTo` along the path, `tightness` of the way to snug. */
const drawRope = (upTo: number, tightness = 0): void => {
  path.writeRope(upTo, tightness, ROPE_POINTS, ropePoints);
  rope.update(ropePoints);
};

/** The menu's opening shot ties the figure-eight. */
const hero = new HeroRope(
  new RopePath(LEVELS.find((level) => level.id === 'figure-eight')!.path!, ROPE_RADIUS),
  ropePoints,
  ROPE_POINTS,
  (points) => rope.update(points),
);

const tracer = new Tracer(stage.camera, container, stage.controls, ROPE_RADIUS);
stage.scene.add(tracer.object);

/** The pole hitches are tied round; only there for knots that need it. */
const rail = new CampRail();
stage.scene.add(rail.object);
rail.show(knot.path!.rail);

// ---- UI -----------------------------------------------------------------------------------

const ui = document.getElementById('ui')!;
createOverlay(ui);
const coach = new Coach(ui);
const orbitHint = new OrbitHint(ui, stage.controls);
/** Seconds into the gentle sway shown when trying starts; -1 when not swaying. */
let sway = -1;
// Touching the view yourself ends the sway.
stage.controls.addEventListener('start', () => (sway = -1));

/** The main menu, or learning the knots of one section. */
let screen: 'menu' | 'trainer' = 'menu';
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
    const next = LEVELS.findIndex((level, i) => i > levelIndex && level.section === knot.section && levelState(i) === 'open');
    coach.show(
      t('tied', { name: knotText(knot).name }),
      `${t('realLife')} ${next >= 0 ? t('unlockedNext', { name: knotText(LEVELS[next]).name }) : t('moreComing')}`,
      'success',
    );
    return;
  }
  const praise = step > 0 ? t('praise') : '';
  const steps = knotText(knot).steps;
  coach.show(`${praise}${t('stepOf', { n: step + 1, total: steps.length, title: steps[step].title })}`, steps[step].hint);
};

tracer.onProgress = (shown) => {
  // Never move the view while the rope is being traced.
  if (shown > path.traceFrom + 1) sway = -1;
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
  orbitHint.hide();
  sway = -1;
  tracer.stop();
  tightening = -1;
  coach.hide();
  resetView();
  demoBar.showWatch(
    timeline,
    knotText(knot).steps.map((step) => step.title),
  );
};

const tryIt = (): void => {
  mode = 'try';
  tightening = -1;
  promptedStep = -1;
  demoBar.showTry(true);
  resetView();
  tracer.start(path);
  orbitHint.show();
  sway = orbitHint.done || matchMedia('(prefers-reduced-motion: reduce)').matches ? -1 : 0;
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
  const level = LEVELS[index];
  if (!level.path) {
    coach.show(t('soonTitle', { name: knotText(level).name }), t('soonText'));
    return;
  }
  if (!isUnlocked(index, completed, unlockAll)) {
    const first = LEVELS.find((earlier, i) => i < index && earlier.section === level.section && earlier.path && !completed.has(earlier.id));
    coach.show(t('lockedTitle', { name: knotText(level).name }), t('lockedText', { name: first ? knotText(first).name : t('earlierKnots') }));
    return;
  }
  levelIndex = index;
  knot = LEVELS[index];
  path = new RopePath(knot.path!, ROPE_RADIUS);
  rail.show(knot.path!.rail);
  timeline = timelineFor();
  panel.setKnot(knot);
  refreshLevels();
  watch();
};

/** Reset restarts whatever you're doing: the demo, or your tracing. */
const reset = (): void => (mode === 'watch' ? watch() : tryIt());

const panel = new KnotPanel(ui, SECTIONS, LEVELS, selectLevel, reset, () => (location.hash = ''));
panel.setKnot(knot);
refreshLevels();

window.addEventListener('keydown', (event) => {
  if (screen === 'trainer' && (event.key === 'r' || event.key === 'R') && !event.repeat && !(event.target instanceof HTMLInputElement)) reset();
});

stage.onUpdate((dt, elapsed) => {
  if (screen === 'menu') {
    hero.update(dt);
    landing.lightSteps(hero.stepsLit);
    menuCamera(elapsed);
    return;
  }
  if (mode === 'watch') {
    demoBar.update(dt);
    return;
  }
  tracer.update(dt);
  if (sway >= 0) {
    sway += dt;
    const s = sway - SWAY_DELAY;
    if (s >= SWAY_SECONDS) {
      sway = -1;
      stage.setView(KNOT_VIEW);
    } else if (s > 0) {
      stage.setView({ ...KNOT_VIEW, azimuth: KNOT_VIEW.azimuth + SWAY_ANGLE * Math.sin((2 * Math.PI * s) / SWAY_SECONDS) });
    }
  }
  if (tightening >= 0 && tightening < 1) {
    tightening = Math.min(tightening + dt / TIGHTEN_SECONDS, 1);
    drawRope(path.end, tightening * tightening * (3 - 2 * tightening));
    if (tightening >= 1) finishTie();
  }
});

// ---- Menu -------------------------------------------------------------------------------

const landing = new Landing(document.body, SECTIONS, LEVELS, (section) => (location.hash = section));
landing.update(completed);

/** Camera follows the page: a slow drift on the hero knot, blending to the menu view as you scroll. */
const menuCamera = (elapsed: number): void => {
  const p = landing.progress;
  const k = p * p * (3 - 2 * p);
  const drift = Math.sin(elapsed * 0.15) * 0.12;
  stage.setView({
    target: HERO_VIEW.target.clone().lerp(MENU_VIEW.target, k),
    distance: HERO_VIEW.distance + (MENU_VIEW.distance - HERO_VIEW.distance) * k,
    polar: HERO_VIEW.polar + (MENU_VIEW.polar - HERO_VIEW.polar) * k,
    azimuth: HERO_VIEW.azimuth + (MENU_VIEW.azimuth - HERO_VIEW.azimuth) * k + drift,
  });
};

const openMenu = (): void => {
  screen = 'menu';
  orbitHint.hide();
  sway = -1;
  tracer.stop();
  tightening = -1;
  coach.hide();
  rail.show(undefined);
  ui.classList.add('away');
  stage.controls.enabled = false;
  landing.update(completed);
  landing.show();
  hero.restart();
};

const openSection = (section: SectionId): void => {
  const first = LEVELS.findIndex((level, i) => level.section === section && levelState(i) === 'open');
  const index = first >= 0 ? first : LEVELS.findIndex((level) => level.section === section && level.path);
  if (index < 0) {
    history.replaceState(null, '', location.pathname + location.search);
    return openMenu();
  }
  screen = 'trainer';
  landing.hide();
  ui.classList.remove('away');
  stage.controls.enabled = true;
  panel.showSection(section);
  levelIndex = -1;
  selectLevel(index);
};

/** The address says where you are (#survival), so Back returns to the menu. */
const route = (): void => {
  const section = SECTIONS.find((s) => `#${s.id}` === location.hash);
  if (section) openSection(section.id);
  else openMenu();
};
window.addEventListener('hashchange', route);

// ---- Language -----------------------------------------------------------------------------

applyDocument();
createLangSwitch(document.body);
/** Relabel everything in place; the demo, tracing and menu carry on where they are. */
onLangChange(() => {
  createOverlay(ui);
  orbitHint.applyLanguage();
  coach.hide();
  landing.update();
  panel.applyLanguage();
  panel.setKnot(knot);
  refreshLevels();
  demoBar.applyLanguage(knotText(knot).steps.map((step) => step.title));
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
      endStyle: (style: EndStyle) => rope.setEndStyle(style),
      /** Checks every finished knot against the real knot, loose and pulled tight (see knots/verify.ts). */
      verify: async () => {
        const { verifyKnot } = await import('./knots/verify');
        return LEVELS.filter((level) => level.path).map((level) => {
          const levelPath = new RopePath(level.path!, ROPE_RADIUS);
          const results = [0, 1].flatMap((tightness) =>
            verifyKnot(level, levelPath, tightness).map((r) => ({ ...r, form: tightness ? 'tight' : 'loose' })),
          );
          return { knot: level.name, ok: results.every((r) => r.ok), results };
        });
      },
      /** Freezes the rope `traced` (0–1) of the way along the traced part, `tightness` (0–1) pulled snug — for shots. */
      pose: (traced = 1, tightness = 0) => {
        mode = 'try';
        tracer.stop();
        tightening = -1;
        drawRope(path.traceFrom + (path.end - path.traceFrom) * traced, tightness);
      },
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

route();
requestAnimationFrame(() => document.getElementById('fade')!.classList.add('hidden'));
