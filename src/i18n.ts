import { PL_KNOTS, PL_SECTIONS, PL_TYPES } from './knots/textPl';
import type { KnotDefinition, KnotSection, KnotStep } from './knots/types';

/**
 * Interface language: English or Polish. The choice is remembered; the first
 * visit follows the browser. English text lives with the knots themselves
 * (levels.ts) and below; Polish in knots/textPl.ts and below.
 */
export type Lang = 'en' | 'pl';

const STORAGE_KEY = 'knots.lang';

const STRINGS = {
  en: {
    title: 'Knots',
    heroTag: 'The knots that matter, outdoors and on the mountain. Watch each one tie itself, then tie it yourself.',
    chooseKnots: 'Choose your knots',
    pathsTitle: 'Where are you heading?',
    tiedCount: '{n} tied',
    comingSoon: 'Coming soon',
    start: 'Start',
    startMore: 'Start · {n} more on the way',
    inTheWorks: 'In the works',
    menu: '‹ Menu',
    menuTitle: 'Back to the menu',
    reset: 'Reset',
    resetTitle: 'Reset rope (R)',
    knots: 'Knots',
    noteSoon: ' — coming soon',
    noteLocked: ' — tie the earlier knots in this section first',
    noteTied: ' — tied',
    tied: '{name} tied!',
    restart: 'Restart',
    previousStep: 'Previous step',
    nextStep: 'Next step',
    playPause: 'Play / pause (Space)',
    play: 'Play (Space)',
    pause: 'Pause (Space)',
    demoPosition: 'Demo position',
    tryIt: 'Try it yourself',
    tryHints: 'Drag the blue end along the glowing path · Drag anywhere else to look around · Scroll to zoom',
    watchDemo: 'Watch demo',
    demoDone: 'Done — now try it yourself',
    stepOf: 'Step {n} of {total} · {title}',
    praise: 'Nice! ',
    unlockedNext: 'Nicely done. {name} is unlocked above.',
    moreComing: 'Nicely done — more knots are on the way.',
    soonTitle: '{name} is coming soon',
    soonText: 'Its demo isn’t ready yet. Pick one of the bright knots.',
    lockedTitle: '{name} is locked',
    lockedText: 'Tie the {name} first to unlock it.',
    earlierKnots: 'earlier knots',
    language: 'Language',
  },
  pl: {
    title: 'Węzły',
    heroTag: 'Węzły, które się liczą — w terenie i w górach. Zobacz, jak każdy wiąże się sam, a potem zawiąż go samodzielnie.',
    chooseKnots: 'Wybierz węzły',
    pathsTitle: 'Dokąd się wybierasz?',
    tiedCount: 'zawiązane: {n}',
    comingSoon: 'Wkrótce',
    start: 'Zacznij',
    startMore: 'Zacznij · kolejne w drodze: {n}',
    inTheWorks: 'W przygotowaniu',
    menu: '‹ Menu',
    menuTitle: 'Wróć do menu',
    reset: 'Od nowa',
    resetTitle: 'Zacznij od nowa (R)',
    knots: 'Węzły',
    noteSoon: ' — wkrótce',
    noteLocked: ' — najpierw zawiąż wcześniejsze węzły z tej sekcji',
    noteTied: ' — zawiązany',
    tied: 'Gotowe: {name}!',
    restart: 'Od początku',
    previousStep: 'Poprzedni krok',
    nextStep: 'Następny krok',
    playPause: 'Odtwórz / pauza (spacja)',
    play: 'Odtwórz (spacja)',
    pause: 'Pauza (spacja)',
    demoPosition: 'Pozycja pokazu',
    tryIt: 'Twoja kolej',
    tryHints: 'Przeciągnij niebieski koniec wzdłuż świecącej ścieżki · Przeciągnij gdzie indziej, by się rozejrzeć · Przewiń, by przybliżyć',
    watchDemo: 'Zobacz pokaz',
    demoDone: 'Gotowe — teraz twoja kolej',
    stepOf: 'Krok {n} z {total} · {title}',
    praise: 'Dobrze! ',
    unlockedNext: 'Świetnie! Odblokowano: {name} (powyżej).',
    moreComing: 'Świetnie — kolejne węzły są w drodze.',
    soonTitle: '{name} — wkrótce',
    soonText: 'Pokaz jeszcze nie jest gotowy. Wybierz jeden z jasnych węzłów.',
    lockedTitle: '{name} — zablokowany',
    lockedText: 'Najpierw zawiąż: {name}.',
    earlierKnots: 'wcześniejsze węzły',
    language: 'Język',
  },
} satisfies Record<Lang, Record<string, string>>;

export type TextKey = keyof (typeof STRINGS)['en'];

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'en' || saved === 'pl') return saved;
  } catch {
    // Storage unavailable; fall back to the browser's language.
  }
  return navigator.language.toLowerCase().startsWith('pl') ? 'pl' : 'en';
}

let lang: Lang = initialLang();
const listeners: (() => void)[] = [];

export const getLang = (): Lang => lang;

export function setLang(next: Lang): void {
  if (next === lang) return;
  lang = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Not remembered; fine.
  }
  applyDocument();
  for (const fn of listeners) fn();
}

/** Runs `fn` whenever the language changes. */
export const onLangChange = (fn: () => void): void => {
  listeners.push(fn);
};

/** The page's own language and title. */
export function applyDocument(): void {
  document.documentElement.lang = lang;
  document.title = t('title');
}

/** Interface text, with {placeholders} filled in. */
export function t(key: TextKey, vars: Record<string, string | number> = {}): string {
  return STRINGS[lang][key].replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? ''));
}

/** "6 knots" / "6 węzłów", with Polish plural forms. */
export function knotCount(n: number): string {
  if (lang === 'en') return `${n} ${n === 1 ? 'knot' : 'knots'}`;
  const tens = n % 100;
  const ones = n % 10;
  const form = n === 1 ? 'węzeł' : ones >= 2 && ones <= 4 && (tens < 12 || tens > 14) ? 'węzły' : 'węzłów';
  return `${n} ${form}`;
}

/** A knot's name, kind, description and steps in the current language (English where no translation exists). */
export function knotText(knot: KnotDefinition): { name: string; type: string; summary: string; steps: KnotStep[] } {
  const pl = lang === 'pl' ? PL_KNOTS[knot.id] : undefined;
  return {
    name: pl?.name ?? knot.name,
    type: lang === 'pl' ? PL_TYPES[knot.type] : knot.type,
    summary: pl?.summary ?? knot.summary,
    steps: knot.steps.map((step, i) => (pl?.steps?.[i] ? { title: pl.steps[i][0], hint: pl.steps[i][1] } : step)),
  };
}

export function sectionText(section: KnotSection): { name: string; blurb: string } {
  return lang === 'pl' ? PL_SECTIONS[section.id] : { name: section.name, blurb: section.blurb };
}
