import { t } from '../i18n';

/** Small brand mark in the corner; call again to relabel it after a language change. */
export function createOverlay(root: HTMLElement): void {
  let brand = root.querySelector<HTMLElement>('.brand');
  if (!brand) {
    brand = document.createElement('div');
    brand.className = 'brand';
    brand.innerHTML = `<span class="brand-name"></span>`;
    root.prepend(brand);
  }
  brand.querySelector('.brand-name')!.textContent = t('title');
}
