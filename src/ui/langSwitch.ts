import { getLang, onLangChange, setLang, t, type Lang } from '../i18n';

const LANGS: Lang[] = ['pl', 'en'];

/** PL | EN switch, top right, on every screen. */
export function createLangSwitch(root: HTMLElement): void {
  const element = document.createElement('div');
  element.className = 'lang-switch';
  element.setAttribute('role', 'group');
  element.innerHTML = LANGS.map((lang) => `<button type="button" data-lang="${lang}">${lang.toUpperCase()}</button>`).join('');
  element.addEventListener('click', (event) => {
    const lang = (event.target as HTMLElement).closest<HTMLElement>('[data-lang]')?.dataset.lang;
    if (lang === 'pl' || lang === 'en') setLang(lang);
  });
  const refresh = (): void => {
    element.setAttribute('aria-label', t('language'));
    element.querySelectorAll<HTMLButtonElement>('[data-lang]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.lang === getLang()));
    });
  };
  refresh();
  onLangChange(refresh);
  root.appendChild(element);
}
