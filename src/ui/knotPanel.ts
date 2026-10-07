import type { KnotDefinition, KnotSection } from '../knots/types';

export type LevelState = 'done' | 'open' | 'locked' | 'soon';

/**
 * Top-left card: a labelled row of numbered levels per section, then the selected knot's name,
 * live step checklist with the current hint, and a reset button.
 */
export class KnotPanel {
  private readonly levelButtons: HTMLButtonElement[];
  private readonly type: HTMLElement;
  private readonly name: HTMLElement;
  private readonly summary: HTMLElement;
  private readonly steps: HTMLOListElement;
  private readonly status: HTMLElement;
  private items: HTMLLIElement[] = [];
  private knot: KnotDefinition | null = null;
  private completed = -1;
  private announce = true;

  constructor(
    root: HTMLElement,
    sections: KnotSection[],
    levels: KnotDefinition[],
    onSelect: (index: number) => void,
    onReset: () => void,
  ) {
    const panel = document.createElement('section');
    panel.className = 'knot-panel';
    panel.innerHTML = `
      <nav class="knot-levels" aria-label="Knots"></nav>
      <div class="knot-type"></div>
      <h1 class="knot-name"></h1>
      <p class="knot-summary"></p>
      <ol class="knot-steps"></ol>
      <div class="knot-status" aria-live="polite"></div>
      <button class="knot-reset" type="button" title="Reset rope (R)">Reset</button>
    `;
    const nav = panel.querySelector('.knot-levels')!;
    this.levelButtons = [];
    for (const section of sections) {
      const row = document.createElement('div');
      row.className = 'knot-section';
      row.innerHTML = `<span class="knot-section-name"></span><div class="knot-section-levels"></div>`;
      row.querySelector('.knot-section-name')!.textContent = section.name;
      const buttons = row.querySelector('.knot-section-levels')!;
      levels.forEach((level, index) => {
        if (level.section !== section.id) return;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'knot-level';
        button.textContent = String(buttons.childElementCount + 1);
        button.addEventListener('click', () => onSelect(index));
        buttons.appendChild(button);
        this.levelButtons[index] = button;
      });
      nav.appendChild(row);
    }
    this.type = panel.querySelector('.knot-type')!;
    this.name = panel.querySelector('.knot-name')!;
    this.summary = panel.querySelector('.knot-summary')!;
    this.steps = panel.querySelector('.knot-steps')!;
    this.status = panel.querySelector('.knot-status')!;
    panel.querySelector('.knot-reset')!.addEventListener('click', onReset);
    root.appendChild(panel);
  }

  setLevels(levels: KnotDefinition[], states: LevelState[], selected: number): void {
    this.levelButtons.forEach((button, index) => {
      const state = states[index];
      button.className = `knot-level ${state}${index === selected ? ' selected' : ''}`;
      button.disabled = state === 'locked' || state === 'soon';
      const note = state === 'soon' ? ' — coming soon' : state === 'locked' ? ' — tie the earlier knots in this section first' : state === 'done' ? ' — tied' : '';
      button.title = `${levels[index].name}${note}`;
      button.setAttribute('aria-label', button.title);
      button.setAttribute('aria-current', index === selected ? 'true' : 'false');
    });
  }

  setKnot(knot: KnotDefinition): void {
    this.knot = knot;
    this.type.textContent = knot.type;
    this.name.textContent = knot.name;
    this.summary.textContent = knot.summary;
    this.steps.replaceChildren();
    this.items = knot.steps.map((step) => {
      const li = document.createElement('li');
      li.innerHTML = `<span class="step-title"></span><span class="step-hint"></span>`;
      li.querySelector('.step-title')!.textContent = step.title;
      li.querySelector('.step-hint')!.textContent = step.hint;
      this.steps.appendChild(li);
      return li;
    });
    this.completed = -1;
    this.setProgress(0);
  }

  /** `announce` = false while a demo plays: steps tick along, but no "tied!" message. */
  setProgress(completed: number, announce = true): void {
    if (!this.knot || (completed === this.completed && announce === this.announce)) return;
    this.completed = completed;
    this.announce = announce;
    this.items.forEach((li, i) => {
      li.classList.toggle('done', i < completed);
      li.classList.toggle('current', i === completed);
    });
    const tied = announce && completed >= this.knot.steps.length;
    this.status.textContent = tied ? `${this.knot.name} tied!` : '';
    this.status.classList.toggle('visible', tied);
  }
}
