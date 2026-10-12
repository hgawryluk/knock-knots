import { knotCount, knotText, sectionText, t, typeGroupText } from '../i18n';
import { KNOT_TYPES, type KnotDefinition, type KnotSection, type KnotType, type SectionId } from '../knots/types';

/** Where the menu sends you: a section, optionally a kind of knot in it or one knot. */
export type MenuChoice = { section: SectionId; type?: KnotType; knot?: string };

/**
 * The main menu: a full-screen page over the 3D scene. First a hero (title
 * over the rope tying itself), then, scrolling down, a card per section of
 * knots to choose from, its knots grouped by kind; a kind or a knot takes you
 * straight to it. `progress` (0 at the top, 1 once the cards are in view) lets
 * the scene move with the scroll.
 */
export class Landing {
  readonly element: HTMLElement;
  private readonly cards = new Map<SectionId, HTMLElement>();
  private completed = new Set<string>();

  constructor(
    root: HTMLElement,
    private readonly sections: KnotSection[],
    private readonly levels: KnotDefinition[],
    private readonly onChoose: (choice: MenuChoice) => void,
  ) {
    this.element = document.createElement('div');
    this.element.className = 'landing';
    this.element.innerHTML = `
      <section class="hero">
        <div class="hero-text">
          <h1 class="hero-title"></h1>
          <p class="hero-tag"></p>
          <ol class="hero-steps">
            <li><span class="hero-step-1"></span></li>
            <li><span class="hero-step-2"></span></li>
            <li class="real"><span class="hero-step-3"></span></li>
          </ol>
          <button class="hero-cta" type="button"><span class="hero-cta-text"></span><span class="hero-cta-arrow" aria-hidden="true"></span></button>
        </div>
      </section>
      <section class="paths">
        <h2 class="paths-title"></h2>
        <div class="path-cards"></div>
      </section>
    `;
    const list = this.element.querySelector('.path-cards')!;
    for (const section of sections) {
      // The whole card opens the section; the kinds and knots on it (buttons of their own) go straight there.
      const card = document.createElement('div');
      card.className = 'path-card';
      card.innerHTML = `
        <div class="path-head"><span class="path-name"></span><span class="path-count"></span></div>
        <p class="path-blurb"></p>
        <div class="path-groups"></div>
        <button class="path-go" type="button"></button>
      `;
      card.addEventListener('click', () => {
        if (card.getAttribute('aria-disabled') !== 'true') onChoose({ section: section.id });
      });
      list.appendChild(card);
      this.cards.set(section.id, card);
    }
    this.element.querySelector('.hero-cta')!.addEventListener('click', () =>
      this.element.querySelector('.paths')!.scrollIntoView({ behavior: 'smooth' }),
    );
    root.appendChild(this.element);
  }

  /** Scroll position: 0 on the hero, 1 once the cards are in view. */
  get progress(): number {
    return Math.min(Math.max(this.element.scrollTop / Math.max(this.element.clientHeight * 0.8, 1), 0), 1);
  }

  get visible(): boolean {
    return !this.element.classList.contains('hidden');
  }

  /** Fills the page in the current language: each card lists the knots ready to learn (ticked when tied) and how many more are coming. */
  update(completed: Set<string> = this.completed): void {
    this.completed = completed;
    const set = (selector: string, text: string): void => {
      this.element.querySelector(selector)!.textContent = text;
    };
    set('.hero-title', t('title'));
    set('.hero-tag', t('heroTag'));
    set('.hero-step-1', t('heroStep1'));
    set('.hero-step-2', t('heroStep2'));
    set('.hero-step-3', t('heroStep3'));
    set('.hero-cta-text', t('chooseKnots'));
    set('.paths-title', t('pathsTitle'));
    this.element.querySelector('.paths')!.setAttribute('aria-label', t('chooseKnots'));
    for (const section of this.sections) {
      const card = this.cards.get(section.id)!;
      const text = sectionText(section);
      card.querySelector('.path-name')!.textContent = text.name;
      card.querySelector('.path-blurb')!.textContent = text.blurb;
      const knots = this.levels.filter((level) => level.section === section.id);
      const ready = knots.filter((level) => level.path);
      const tied = ready.filter((level) => completed.has(level.id)).length;
      const coming = knots.length - ready.length;
      card.querySelector('.path-count')!.textContent = ready.length
        ? `${knotCount(ready.length)}${tied ? ` · ${t('tiedCount', { n: tied })}` : ''}`
        : t('comingSoon');
      // A row per kind that has knots: the kind (to its first knot), then its knots.
      const shown = ready.length ? ready : knots;
      const rows = KNOT_TYPES.filter((type) => shown.some((level) => level.type === type)).map((type) => {
        const row = document.createElement('div');
        row.className = 'path-group';
        const kind = this.choice(ready.length ? { section: section.id, type } : null, typeGroupText(type), 'path-type');
        const items = shown
          .filter((level) => level.type === type)
          .map((level) => {
            const item = this.choice(level.path ? { section: section.id, knot: level.id } : null, knotText(level).name, 'path-knot');
            item.classList.toggle('tied', completed.has(level.id));
            return item;
          });
        row.replaceChildren(kind, ...items);
        return row;
      });
      card.querySelector('.path-groups')!.replaceChildren(...rows);
      card.querySelector('.path-go')!.textContent = ready.length
        ? coming
          ? t('startMore', { n: coming })
          : t('start')
        : t('inTheWorks');
      card.setAttribute('aria-disabled', String(!ready.length));
      card.classList.toggle('soon', !ready.length);
    }
  }

  /** A kind or knot on a card: a button that goes straight to it, or plain text while it is still to come. */
  private choice(target: MenuChoice | null, label: string, className: string): HTMLElement {
    if (!target) {
      const span = document.createElement('span');
      span.className = `${className} soon`;
      span.textContent = label;
      return span;
    }
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.textContent = label;
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      this.onChoose(target);
    });
    return button;
  }

  /** Lights the first `count` of the three steps (the rope behind ties in time with them). */
  lightSteps(count: number): void {
    this.element.querySelectorAll('.hero-steps li').forEach((li, i) => li.classList.toggle('lit', i < count));
    // Once all three are lit, the button glows once: now choose.
    this.element.querySelector('.hero-cta')!.classList.toggle('ready', count >= 3);
  }

  show(): void {
    this.element.classList.remove('hidden');
    this.element.scrollTop = 0;
  }

  hide(): void {
    this.element.classList.add('hidden');
  }
}
