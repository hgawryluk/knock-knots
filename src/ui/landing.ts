import { knotCount, knotText, sectionText, t } from '../i18n';
import type { KnotDefinition, KnotSection, SectionId } from '../knots/types';

/**
 * The main menu: a full-screen page over the 3D scene. First a hero (title
 * over the rope tying itself), then, scrolling down, a card per section of
 * knots to choose from. `progress` (0 at the top, 1 once the cards are in
 * view) lets the scene move with the scroll.
 */
export class Landing {
  readonly element: HTMLElement;
  private readonly cards = new Map<SectionId, HTMLElement>();
  private completed = new Set<string>();

  constructor(
    root: HTMLElement,
    private readonly sections: KnotSection[],
    private readonly levels: KnotDefinition[],
    onChoose: (section: SectionId) => void,
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
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'path-card';
      card.innerHTML = `
        <div class="path-head"><span class="path-name"></span><span class="path-count"></span></div>
        <p class="path-blurb"></p>
        <ul class="path-knots"></ul>
        <span class="path-go"></span>
      `;
      card.addEventListener('click', () => {
        if (card.getAttribute('aria-disabled') !== 'true') onChoose(section.id);
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
      const items = (ready.length ? ready : knots).map((level) => {
        const li = document.createElement('li');
        li.textContent = knotText(level).name;
        li.classList.toggle('tied', completed.has(level.id));
        return li;
      });
      card.querySelector('.path-knots')!.replaceChildren(...items);
      card.querySelector('.path-go')!.textContent = ready.length
        ? coming
          ? t('startMore', { n: coming })
          : t('start')
        : t('inTheWorks');
      card.setAttribute('aria-disabled', String(!ready.length));
      card.classList.toggle('soon', !ready.length);
    }
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
