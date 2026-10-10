import { knotText, sectionText, t } from '../i18n';
import type { KnotDefinition, KnotSection, SectionId } from '../knots/types';

export type LevelState = 'done' | 'open' | 'soon';

/**
 * Top-left card: back to the menu, the chosen section's numbered levels, then the selected
 * knot's name, live step checklist with the current hint, and a reset button.
 */
export class KnotPanel {
  private readonly levelButtons: HTMLButtonElement[];
  private readonly rows = new Map<SectionId, HTMLElement>();
  private readonly panel: HTMLElement;
  private readonly sections: KnotSection[];
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
    onMenu: () => void,
  ) {
    const panel = document.createElement('section');
    panel.className = 'knot-panel';
    panel.innerHTML = `
      <button class="knot-menu" type="button"></button>
      <nav class="knot-levels"></nav>
      <div class="knot-type"></div>
      <h1 class="knot-name"></h1>
      <p class="knot-summary"></p>
      <ol class="knot-steps"></ol>
      <div class="knot-status" aria-live="polite"></div>
      <button class="knot-reset" type="button"></button>
    `;
    const nav = panel.querySelector('.knot-levels')!;
    this.levelButtons = [];
    for (const section of sections) {
      const row = document.createElement('div');
      row.className = 'knot-section';
      row.innerHTML = `<span class="knot-section-name"></span><div class="knot-section-levels"></div>`;
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
      row.dataset.section = section.id;
      this.rows.set(section.id, row);
    }
    this.type = panel.querySelector('.knot-type')!;
    this.name = panel.querySelector('.knot-name')!;
    this.summary = panel.querySelector('.knot-summary')!;
    this.steps = panel.querySelector('.knot-steps')!;
    this.status = panel.querySelector('.knot-status')!;
    panel.querySelector('.knot-reset')!.addEventListener('click', onReset);
    panel.querySelector('.knot-menu')!.addEventListener('click', onMenu);
    root.appendChild(panel);
    this.panel = panel;
    this.sections = sections;
    this.applyLanguage();
  }

  /** Fixed labels in the current language (the knot itself is redrawn by setKnot / setLevels). */
  applyLanguage(): void {
    const menu = this.panel.querySelector<HTMLElement>('.knot-menu')!;
    menu.textContent = t('menu');
    menu.title = t('menuTitle');
    const reset = this.panel.querySelector<HTMLElement>('.knot-reset')!;
    reset.textContent = t('reset');
    reset.title = t('resetTitle');
    this.panel.querySelector('.knot-levels')!.setAttribute('aria-label', t('knots'));
    for (const section of this.sections) this.rows.get(section.id)!.querySelector('.knot-section-name')!.textContent = sectionText(section).name;
  }

  /** Shows only one section's knots. */
  showSection(id: SectionId): void {
    for (const [section, row] of this.rows) row.hidden = section !== id;
  }

  setLevels(levels: KnotDefinition[], states: LevelState[], selected: number): void {
    this.levelButtons.forEach((button, index) => {
      const state = states[index];
      button.className = `knot-level ${state}${index === selected ? ' selected' : ''}`;
      // Still clickable, so a coming-soon knot can say so.
      button.setAttribute('aria-disabled', String(state === 'soon'));
      const note = state === 'soon' ? t('noteSoon') : state === 'done' ? t('noteTied') : '';
      button.title = `${knotText(levels[index]).name}${note}`;
      button.setAttribute('aria-label', button.title);
      button.setAttribute('aria-current', index === selected ? 'true' : 'false');
    });
  }

  setKnot(knot: KnotDefinition): void {
    this.knot = knot;
    const text = knotText(knot);
    this.type.textContent = text.type;
    this.name.textContent = text.name;
    this.summary.textContent = text.summary;
    this.steps.replaceChildren();
    this.items = text.steps.map((step) => {
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
    this.status.textContent = tied ? t('tied', { name: knotText(this.knot).name }) : '';
    this.status.classList.toggle('visible', tied);
  }
}
