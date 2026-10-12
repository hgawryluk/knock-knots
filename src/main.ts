import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import './styles.css';
import { applyDocument, knotText, onLangChange, t } from './i18n';
import { freshProgress, LEVELS, SECTIONS } from './knots/levels';
import { CARABINER, CARABINER_GATE, CARABINER_GATE_SWING, CARABINER_OUTLINE, FIGURE_EIGHT_PATH, TARP } from './knots/paths';
import type { KnotDefinition, SectionId } from './knots/types';
import { END_STYLES, type EndStyle } from './rope/ropeEnd';
import { RopeMesh } from './rope/ropeMesh';
import type { RopeColors } from './rope/ropeTexture';
import { HeroRope } from './scene/hero';
import { Stake } from './scene/stake';
import { Tarp } from './scene/tarp';
import { createMeadow } from './scene/meadow';
import { Carabiner } from './scene/carabiner';
import { createCrag } from './scene/crag';
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
/** A second rope, for knots tied in two ropes: red, so the two are easy to tell apart. */
const PARTNER_COLORS: RopeColors = { strand: '#f05a44', groove: '#8a2418' };
const PARTNER_POINTS = 200;
/** Demo pacing: path samples drawn per second, then the pull-tight and a short rest. */
const DEMO_FPS = 30;
const DEMO_SAMPLES_PER_SECOND = 110;
const TIGHTEN_SECONDS = 1.2;
const REST_SECONDS = 1;
/** When you start tying yourself, the view turns gently to one side and back, to show it can be turned. */
const SWAY_DELAY = 1.1;
const SWAY_SECONDS = 2.6;
const SWAY_ANGLE = 0.2;
/** Depth of field: cinematic on the menu; off in the trainer so the rope you tie stays sharp. */
const MENU_BLUR = 1;

const container = document.getElementById('stage')!;
const stage = new Stage(container);
// Survival knots are learnt lying on a camp tarp in the clearing (grass is kept off it)…
const meadow = await createMeadow(stage.scene, stage.renderer, TARP);
stage.scene.add(meadow.root);
const meadowLook = { background: stage.scene.background, fog: stage.scene.fog };
// …the Mountains knots on a carabiner at a belay stance high on a granite buttress.
const crag = await createCrag();
crag.root.visible = false;
stage.scene.add(crag.root);
stage.onUpdate((dt, elapsed) => (crag.root.visible ? crag : meadow).update(dt, elapsed));
/** The clearing for the menu and Survival, the mountains for Mountains. */
const setWorld = (section: SectionId): void => {
  const mountains = section === 'mountains';
  meadow.root.visible = !mountains;
  crag.root.visible = mountains;
  stage.scene.background = mountains ? null : meadowLook.background;
  stage.scene.fog = mountains ? crag.fog : meadowLook.fog;
  // The far peaks are a long way off.
  stage.camera.far = mountains ? 2600 : 200;
  stage.camera.updateProjectionMatrix();
};

// Free orbit all the way round the hanging knot, from just below eye level to well above.
Object.assign(stage.controls, { minDistance: 1.4, maxDistance: 7, minPolarAngle: Math.PI * 0.08, maxPolarAngle: Math.PI * 0.6 });
const KNOT_VIEW = { target: new THREE.Vector3(0.1, 1.3, 1.9), distance: 4.6, polar: Math.PI * 0.46, azimuth: 0.15 };
/** Looking down at a knot laid out on the tarp, as if standing over it. */
const FLAT_VIEW = { target: new THREE.Vector3(0.05, 0.05, TARP.z + 0.1), distance: 3.0, polar: Math.PI * 0.27, azimuth: 0.12 };
/** Close on a knot tied round the carabiner's bottom bar. */
const CARABINER_VIEW = { target: new THREE.Vector3(CARABINER.x + 0.08, CARABINER.y - 0.08, CARABINER.z), distance: 2.9, polar: Math.PI * 0.48, azimuth: 0.4 };
const knotView = (): typeof KNOT_VIEW => (knot?.path?.flat ? FLAT_VIEW : knot?.path?.rail?.carabiner ? CARABINER_VIEW : KNOT_VIEW);
const resetView = (): void => stage.glideTo(knotView());
/** Menu camera: close on the hero knot at the top of the page, drawing back and aside as the cards scroll in. */
const HERO_VIEW = { target: new THREE.Vector3(0.05, 1.42, 1.9), distance: 2.9, polar: Math.PI * 0.47, azimuth: 0.2 };
const MENU_VIEW = { target: new THREE.Vector3(-0.55, 1.3, 1.9), distance: 3.5, polar: Math.PI * 0.44, azimuth: 0.45 };

// ---- Levels -------------------------------------------------------------------------------

const completed = freshProgress();
const levelState = (index: number): LevelState => {
  const level = LEVELS[index];
  if (!level.path) return 'soon';
  return completed.has(level.id) ? 'done' : 'open';
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
  // Clip-in knots open and close the carabiner's gate as they go.
  const gate = path.gateAt(tightness > 0 ? path.end : upTo);
  carabiner.setGate(gate.open, gate.unscrewed);
  if (path.partnerEnd >= 0) {
    path.writeRange(0, path.partnerEnd, tightness, PARTNER_POINTS, partnerPoints);
    partnerRope.update(partnerPoints);
  }
};

/** The second rope (already in place) and the peg holding it, for knots tied in two ropes. */
const partnerRope = new RopeMesh(PARTNER_POINTS, ROPE_RADIUS, PARTNER_COLORS, PARTNER_COLORS.strand);
const partnerPoints = new Float32Array(PARTNER_POINTS * 3);
// Its loose end is simply cut, fibres showing.
partnerRope.setEndStyle('cut');
stage.scene.add(partnerRope.object);
const stake = new Stake();
stage.scene.add(stake.object);
const tarp = new Tarp(TARP);
stage.scene.add(tarp.object);
const showPartner = (): void => {
  partnerRope.object.visible = screen === 'trainer' && Boolean(knot.path!.partner);
  stake.show(screen === 'trainer' ? knot.path!.partner?.stake : undefined);
  tarp.show(screen === 'trainer' && knot.section === 'survival');
  // Never look from below a knot lying on the ground.
  stage.controls.maxPolarAngle = knot.path!.flat ? Math.PI * 0.42 : Math.PI * 0.6;
};

/** The menu's opening shot ties the figure-eight. */
const hero = new HeroRope(
  new RopePath(FIGURE_EIGHT_PATH, ROPE_RADIUS),
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
/** The carabiner hanging from a bolt, for the Mountains knots. */
const carabiner = new Carabiner();
carabiner.setEnvironment(new THREE.PMREMGenerator(stage.renderer).fromScene(new RoomEnvironment(), 0.04).texture);
stage.scene.add(carabiner.object);
carabiner.show(knot.path!.rail);

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
      `${t('realLife')} ${next >= 0 ? t('nextUp', { name: knotText(LEVELS[next]).name }) : t('moreComing')}`,
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
    refreshLevels();
  }
  prompt(knot.steps.length);
};

// ---- Watch / try --------------------------------------------------------------------------

type DemoTimeline = Timeline & { traceFrames: number; tightenFrames: number };

/** The demo as a timeline: draw the path, pull tight, rest. */
const timelineFor = (): DemoTimeline => {
  const traceFrames = Math.round((path.demoSeconds ?? (path.end - path.traceFrom) / DEMO_SAMPLES_PER_SECOND) * DEMO_FPS);
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
  levelIndex = index;
  knot = LEVELS[index];
  path = new RopePath(knot.path!, ROPE_RADIUS);
  rail.show(knot.path!.rail);
  carabiner.show(knot.path!.rail);
  showPartner();
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
      stage.setView(knotView());
    } else if (s > 0) {
      stage.setView({ ...knotView(), azimuth: knotView().azimuth + SWAY_ANGLE * Math.sin((2 * Math.PI * s) / SWAY_SECONDS) });
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
  setWorld('survival');
  showPartner();
  orbitHint.hide();
  sway = -1;
  tracer.stop();
  tightening = -1;
  coach.hide();
  rail.show(undefined);
  carabiner.show(undefined);
  ui.classList.add('away');
  stage.controls.enabled = false;
  stage.setBlur(MENU_BLUR);
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
  setWorld(section);
  landing.hide();
  ui.classList.remove('away');
  stage.controls.enabled = true;
  stage.setBlur(0);
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
      /**
       * Rope never through rope or metal: the closest two bits of rope come (in rope
       * widths) and, on the carabiner, the closest the rope comes to its metal (in rope
       * radii; the gate where it is, open or shut), all through the tying and the pull-tight.
       */
      audit: () => {
        const metal: { x: number; y: number; gate: boolean }[] = [];
        CARABINER_OUTLINE.forEach(([ax, ay], i) => {
          const [bx, by] = CARABINER_OUTLINE[(i + 1) % CARABINER_OUTLINE.length];
          for (let k = 0; k < 10; k++) metal.push({ x: ax + ((bx - ax) * k) / 10, y: ay + ((by - ay) * k) / 10, gate: i >= CARABINER_GATE.nose && i < CARABINER_GATE.hinge });
        });
        const n = 400;
        const out = new Float32Array(n * 3);
        const along = new Float32Array(n);
        let rope = { gap: Infinity, at: 0, tightness: 0 };
        let steel = { gap: Infinity, at: 0, tightness: 0 };
        /** Every moment where rope comes within a rope width of itself or touches the metal, for finding where. */
        const bad: { at: number; tightness: number; rope: number; metal?: number; where: number[] }[] = [];
        const moments: [number, number][] = [];
        for (let q = 0; q <= 1.0001; q += 0.01) moments.push([path.traceFrom + (path.end - path.traceFrom) * q, 0]);
        for (let t = 0.05; t <= 1.0001; t += 0.05) moments.push([path.end, t]);
        for (const [upTo, tightness] of moments) {
          path.writeRope(upTo, tightness, n, out);
          const at = (upTo - path.traceFrom) / (path.end - path.traceFrom);
          // Only bits of rope at least this far apart along it count as different strands.
          for (let i = 1; i < n; i++) along[i] = along[i - 1] + Math.hypot(out[i * 3] - out[i * 3 - 3], out[i * 3 + 1] - out[i * 3 - 2], out[i * 3 + 2] - out[i * 3 - 1]);
          let here = { gap: Infinity, where: [0, 0, 0] };
          for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
              if (along[j] - along[i] < 6 * ROPE_RADIUS) continue;
              const d = Math.hypot(out[i * 3] - out[j * 3], out[i * 3 + 1] - out[j * 3 + 1], out[i * 3 + 2] - out[j * 3 + 2]) / (2 * ROPE_RADIUS);
              if (d < here.gap) here = { gap: d, where: [out[i * 3], out[i * 3 + 1], out[i * 3 + 2]] };
            }
          }
          if (here.gap < rope.gap) rope = { gap: here.gap, at, tightness };
          if (here.gap < 0.97) bad.push({ at, tightness, rope: here.gap, where: here.where });
          if (!knot.path!.rail?.carabiner) continue;
          // The gate swung in on its hinge as far as it is open.
          const swing = CARABINER_GATE_SWING * path.gateAt(tightness > 0 ? path.end : upTo).open;
          const [hx, hy] = CARABINER_OUTLINE[CARABINER_GATE.hinge];
          const placed = metal.map((p) =>
            p.gate
              ? { ...p, x: hx + (p.x - hx) * Math.cos(swing) - (p.y - hy) * Math.sin(swing), y: hy + (p.x - hx) * Math.sin(swing) + (p.y - hy) * Math.cos(swing) }
              : p,
          );
          for (let i = 0; i < n; i++) {
            const x = out[i * 3] - CARABINER.x;
            const y = out[i * 3 + 1] - CARABINER.y;
            const z = out[i * 3 + 2] - CARABINER.z;
            for (const p of placed) {
              const d = (Math.hypot(x - p.x, y - p.y, z) - (p.gate ? 0.026 : CARABINER.barRadius) - ROPE_RADIUS) / ROPE_RADIUS;
              if (d < steel.gap) steel = { gap: d, at, tightness };
              if (d < -0.15) {
                const last = bad[bad.length - 1];
                if (last?.at === at && last.tightness === tightness) last.metal = Math.min(last.metal ?? d, d);
                else bad.push({ at, tightness, rope: Infinity, metal: d, where: [out[i * 3], out[i * 3 + 1], out[i * 3 + 2]] });
              }
            }
          }
        }
        const round = (o: object): object => JSON.parse(JSON.stringify(o, (_, v) => (typeof v === 'number' ? Math.round(v * 100) / 100 : v)));
        return round({ knot: knot.name, ropeGapInWidths: rope, metalGapInRadii: knot.path!.rail?.carabiner ? steel : undefined, bad });
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
