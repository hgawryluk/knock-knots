import { t as tr } from '../i18n';

/** A demo to play: how many frames, where each knot step starts, and playback speed. */
export interface Timeline {
  frameCount: number;
  /** First frame of each knot step. */
  stepFrames: number[];
  fps: number;
}

export interface DemoBarHandlers {
  /** Leave the demo and tie it yourself. */
  onTry: () => void;
  /** Go back to the demo from "try it yourself". */
  onWatch: () => void;
  /** Show this (possibly fractional) frame of the demo. */
  onFrame: (frame: number, step: number) => void;
}

const icon = (path: string): string =>
  `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="${path}"/></svg>`;
const ICONS = {
  restart: icon('M12 5V2L7 6l5 4V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7z'),
  previous: icon('M6 6h2v12H6zm3.5 6 8.5 6V6z'),
  next: icon('M16 6h2v12h-2zM6 18l8.5-6L6 6z'),
  play: icon('M8 5v14l11-7z'),
  pause: icon('M6 5h4v14H6zm8 0h4v14h-4z'),
};

/**
 * Bottom bar. "Watch": a player for the recorded demo (restart, previous/next
 * step, play/pause, scrubber with a tick per step) plus "Try it yourself".
 * "Try": the control hints and a button back to the demo.
 */
export class DemoBar {
  readonly element: HTMLElement;
  private readonly watchView: HTMLElement;
  private readonly tryView: HTMLElement;
  private readonly playButton: HTMLButtonElement;
  private readonly scrub: HTMLInputElement;
  private readonly ticks: HTMLElement;
  private readonly label: HTMLElement;
  private readonly watchButton: HTMLButtonElement;
  private recording: Timeline | null = null;
  private stepTitles: string[] = [];
  private frame = 0;
  private time = 0;
  private playing = false;

  constructor(root: HTMLElement, private readonly handlers: DemoBarHandlers) {
    this.element = document.createElement('div');
    this.element.className = 'demo-bar';
    this.element.innerHTML = `
      <div class="demo-watch">
        <div class="demo-label" aria-live="polite"></div>
        <div class="demo-controls">
          <button type="button" class="demo-icon" data-action="restart" data-title="restart">${ICONS.restart}</button>
          <button type="button" class="demo-icon" data-action="previous" data-title="previousStep">${ICONS.previous}</button>
          <button type="button" class="demo-icon demo-play" data-action="play" data-title="playPause">${ICONS.play}</button>
          <button type="button" class="demo-icon" data-action="next" data-title="nextStep">${ICONS.next}</button>
          <div class="demo-track">
            <input class="demo-scrub" type="range" min="0" max="0" step="1" value="0" data-label="demoPosition" />
            <div class="demo-ticks" aria-hidden="true"></div>
          </div>
          <button type="button" class="demo-try" data-action="try" data-text="tryIt"></button>
        </div>
      </div>
      <div class="demo-tryview">
        <span class="demo-hints" data-text="tryHints"></span>
        <button type="button" class="demo-watch-again" data-action="watch" data-text="watchDemo"></button>
      </div>
    `;
    this.watchView = this.element.querySelector('.demo-watch')!;
    this.tryView = this.element.querySelector('.demo-tryview')!;
    this.playButton = this.element.querySelector('.demo-play')!;
    this.scrub = this.element.querySelector('.demo-scrub')!;
    this.ticks = this.element.querySelector('.demo-ticks')!;
    this.label = this.element.querySelector('.demo-label')!;
    this.watchButton = this.element.querySelector('.demo-watch-again')!;

    this.element.addEventListener('click', (event) => {
      const action = (event.target as HTMLElement).closest<HTMLElement>('[data-action]')?.dataset.action;
      if (action === 'restart') this.seek(0, true);
      else if (action === 'previous') this.jumpStep(-1);
      else if (action === 'next') this.jumpStep(1);
      else if (action === 'play') this.setPlaying(!this.playing);
      else if (action === 'try') handlers.onTry();
      else if (action === 'watch') handlers.onWatch();
    });
    this.scrub.addEventListener('input', () => {
      this.setPlaying(false);
      this.seek(Number(this.scrub.value));
    });
    window.addEventListener('keydown', (event) => {
      if (event.code !== 'Space' || !this.recording || this.watchView.hidden) return;
      event.preventDefault();
      this.setPlaying(!this.playing);
    });
    root.appendChild(this.element);
    this.applyLanguage();
  }

  /** Labels in the current language; `stepTitles` renames the demo's steps too. */
  applyLanguage(stepTitles = this.stepTitles): void {
    type Key = Parameters<typeof tr>[0];
    this.element.querySelectorAll<HTMLElement>('[data-title]').forEach((el) => (el.title = tr(el.dataset.title as Key)));
    this.element.querySelectorAll<HTMLElement>('[data-label]').forEach((el) => el.setAttribute('aria-label', tr(el.dataset.label as Key)));
    this.element.querySelectorAll<HTMLElement>('[data-text]').forEach((el) => (el.textContent = tr(el.dataset.text as Key)));
    this.stepTitles = stepTitles;
    this.ticks.querySelectorAll<HTMLElement>('span').forEach((tick, i) => (tick.title = stepTitles[i] ?? ''));
    if (this.recording) this.showLabel();
    this.playButton.title = this.playing ? tr('pause') : tr('play');
  }

  /** Switch to the demo player and start playing from the beginning. */
  showWatch(recording: Timeline, stepTitles: string[]): void {
    this.recording = recording;
    this.stepTitles = stepTitles;
    this.watchView.hidden = false;
    this.tryView.hidden = true;
    const last = recording.frameCount - 1;
    this.scrub.max = String(last);
    this.ticks.replaceChildren(
      ...recording.stepFrames.map((frame, i) => {
        const tick = document.createElement('span');
        tick.style.left = `${(frame / last) * 100}%`;
        tick.title = stepTitles[i];
        return tick;
      }),
    );
    this.seek(0, true);
  }

  /** Switch to the "try it yourself" bar; the demo button only appears if there is a demo. */
  showTry(hasDemo: boolean): void {
    this.setPlaying(false);
    this.watchView.hidden = true;
    this.tryView.hidden = false;
    this.watchButton.hidden = !hasDemo;
  }

  update(dt: number): void {
    if (!this.playing || !this.recording) return;
    this.time += dt;
    const frame = Math.floor(this.time * this.recording.fps);
    if (frame >= this.recording.frameCount - 1) {
      this.seek(this.recording.frameCount - 1);
      this.setPlaying(false);
      return;
    }
    if (frame !== this.frame) this.seek(frame);
    // Between whole frames, keep the picture moving smoothly.
    const exact = this.time * this.recording.fps;
    this.handlers.onFrame(exact, this.stepAt(frame));
  }

  private stepAt(frame: number): number {
    const starts = this.recording?.stepFrames ?? [];
    let step = 0;
    starts.forEach((start, i) => {
      if (frame >= start) step = i;
    });
    return step;
  }

  private seek(frame: number, play = false): void {
    if (!this.recording) return;
    this.frame = Math.max(0, Math.min(frame, this.recording.frameCount - 1));
    this.time = this.frame / this.recording.fps;
    this.scrub.value = String(this.frame);
    const step = this.stepAt(this.frame);
    const finished = this.frame >= this.recording.frameCount - 1;
    this.showLabel();
    this.handlers.onFrame(this.frame, finished ? this.stepTitles.length : step);
    if (play) this.setPlaying(true);
  }

  private showLabel(): void {
    if (!this.recording) return;
    const step = this.stepAt(this.frame);
    this.label.textContent =
      this.frame >= this.recording.frameCount - 1
        ? tr('demoDone')
        : tr('stepOf', { n: step + 1, total: this.stepTitles.length, title: this.stepTitles[step] });
  }

  private jumpStep(direction: 1 | -1): void {
    if (!this.recording) return;
    const starts = this.recording.stepFrames;
    const current = this.stepAt(this.frame);
    // "Previous" from the middle of a step goes back to that step's start.
    const target = direction < 0 && this.frame > starts[current] + 5 ? current : current + direction;
    this.setPlaying(false);
    if (target >= starts.length) this.seek(this.recording.frameCount - 1);
    else this.seek(starts[Math.max(target, 0)], true);
  }

  private setPlaying(playing: boolean): void {
    if (playing && this.recording && this.frame >= this.recording.frameCount - 1) this.seek(0);
    this.playing = playing && !!this.recording;
    this.playButton.innerHTML = this.playing ? ICONS.pause : ICONS.play;
    this.playButton.title = this.playing ? tr('pause') : tr('play');
  }
}
