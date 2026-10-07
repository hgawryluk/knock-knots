import type { KnotDefinition } from '../knots/cloveHitch';

/** Top-left card: knot name, live step checklist with the current hint, and a reset button. */
export class KnotPanel {
  private readonly items: HTMLLIElement[];
  private readonly status: HTMLElement;
  private completed = -1;

  constructor(root: HTMLElement, private readonly knot: KnotDefinition, onReset: () => void) {
    const panel = document.createElement('section');
    panel.className = 'knot-panel';
    panel.innerHTML = `
      <div class="knot-type">${knot.type}</div>
      <h1 class="knot-name">${knot.name}</h1>
      <p class="knot-summary">${knot.summary}</p>
      <ol class="knot-steps"></ol>
      <div class="knot-status" aria-live="polite"></div>
      <button class="knot-reset" type="button" title="Reset rope (R)">Reset</button>
    `;
    const list = panel.querySelector('.knot-steps')!;
    this.items = knot.steps.map((step) => {
      const li = document.createElement('li');
      li.innerHTML = `<span class="step-title">${step.title}</span><span class="step-hint">${step.hint}</span>`;
      list.appendChild(li);
      return li;
    });
    this.status = panel.querySelector('.knot-status')!;
    panel.querySelector('.knot-reset')!.addEventListener('click', onReset);
    root.appendChild(panel);
    this.setProgress(0);
  }

  setProgress(completed: number): void {
    if (completed === this.completed) return;
    this.completed = completed;
    this.items.forEach((li, i) => {
      li.classList.toggle('done', i < completed);
      li.classList.toggle('current', i === completed);
    });
    const tied = completed >= this.knot.steps.length;
    this.status.textContent = tied ? `${this.knot.name} tied!` : '';
    this.status.classList.toggle('visible', tied);
  }
}
