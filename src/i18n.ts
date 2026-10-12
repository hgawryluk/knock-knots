import { PL_KNOTS, PL_SECTIONS, PL_TYPE_GROUPS, PL_TYPES } from './knots/textPl';
import type { KnotDefinition, KnotSection, KnotStep, KnotType } from './knots/types';

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
    heroTag: 'Knots you will really use — outdoors and in the mountains.',
    heroStep1: 'Watch it tie itself',
    heroStep2: 'Tie it here',
    heroStep3: 'Try it in real life!',
    realLife: 'Nicely done! Now grab a real rope or cord and tie it for real.',
    chooseKnots: 'Choose your knots',
    pathsTitle: 'Knot categories',
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
    moreSoon: '+{n} more coming soon',
    noteTied: ' — tied',
    tied: '{name} tied!',
    restart: 'Restart',
    previousStep: 'Previous step',
    nextStep: 'Next step',
    playPause: 'Play / pause (Space)',
    speed: 'Playback speed',
    play: 'Play (Space)',
    pause: 'Pause (Space)',
    demoPosition: 'Demo position',
    tryIt: 'Try it yourself',
    tryHints: 'Drag the blue end along the glowing path · Drag anywhere else to look around · Scroll to zoom',
    watchDemo: 'Watch demo',
    rotateHint: 'Drag the background to turn the view',
    demoDone: 'Done — now try it yourself',
    stepOf: 'Step {n} of {total} · {title}',
    praise: 'Nice! ',
    nextUp: 'Next up: {name}.',
    moreComing: 'More knots are on the way.',
    soonTitle: '{name} is coming soon',
    soonText: 'Its demo isn’t ready yet. Pick one of the bright knots.',
    language: 'Language',
  },
  pl: {
    title: 'Węzły',
    heroTag: 'Węzły, które naprawdę się przydają — w terenie i w górach.',
    heroStep1: 'Zobacz, jak się wiąże',
    heroStep2: 'Zawiąż go tutaj',
    heroStep3: 'Spróbuj w prawdziwym życiu!',
    realLife: 'Świetnie! Teraz chwyć prawdziwą linę lub linkę i zawiąż go naprawdę.',
    chooseKnots: 'Wybierz węzły',
    pathsTitle: 'Kategorie węzłów',
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
    moreSoon: '+{n} kolejnych wkrótce',
    noteTied: ' — zawiązany',
    tied: 'Gotowe: {name}!',
    restart: 'Od początku',
    previousStep: 'Poprzedni krok',
    nextStep: 'Następny krok',
    playPause: 'Odtwórz / pauza (spacja)',
    speed: 'Prędkość odtwarzania',
    play: 'Odtwórz (spacja)',
    pause: 'Pauza (spacja)',
    demoPosition: 'Pozycja pokazu',
    tryIt: 'Twoja kolej',
    tryHints: 'Przeciągnij niebieski koniec wzdłuż świecącej ścieżki · Przeciągnij gdzie indziej, by się rozejrzeć · Przewiń, by przybliżyć',
    watchDemo: 'Zobacz pokaz',
    rotateHint: 'Przeciągnij tło, aby obrócić widok',
    demoDone: 'Gotowe — teraz twoja kolej',
    stepOf: 'Krok {n} z {total} · {title}',
    praise: 'Dobrze! ',
    nextUp: 'Następny: {name}.',
    moreComing: 'Kolejne węzły są w drodze.',
    soonTitle: '{name} — wkrótce',
    soonText: 'Pokaz jeszcze nie jest gotowy. Wybierz jeden z jasnych węzłów.',
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

const TYPE_GROUPS: Record<KnotType, string> = { Stopper: 'Stoppers', Loop: 'Loops', Hitch: 'Hitches', Bend: 'Bends', Binding: 'Bindings' };

/** A kind of knot as a group name ("Hitches" / "Zaczepowe"). */
export function typeGroupText(type: KnotType): string {
  return lang === 'pl' ? PL_TYPE_GROUPS[type] : TYPE_GROUPS[type];
}

export function sectionText(section: KnotSection): { name: string; blurb: string } {
  return lang === 'pl' ? PL_SECTIONS[section.id] : { name: section.name, blurb: section.blurb };
}
