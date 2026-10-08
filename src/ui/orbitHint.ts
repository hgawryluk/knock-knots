import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { t } from '../i18n';

/**
 * While you tie a knot yourself: a pill above the bar with a swinging orbit
 * arrow, saying you can drag the background to turn the view. It goes away for
 * good (this visit) the first time you turn or zoom the view.
 */
export class OrbitHint {
  private readonly element: HTMLElement;
  private used = false;

  constructor(root: HTMLElement, controls: OrbitControls) {
    this.element = document.createElement('div');
    this.element.className = 'orbit-hint';
    this.element.setAttribute('aria-hidden', 'true');
    this.element.innerHTML = `
      <svg class="orbit-icon" viewBox="0 0 48 24" width="40" height="20">
        <path d="M6 14 C 10 4, 38 4, 42 14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" />
        <path d="M37 12.5 L42 14 L43.5 9" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
        <path d="M11 12.5 L6 14 L4.5 9" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
        <circle cx="24" cy="18" r="3" fill="currentColor" />
      </svg>
      <span class="orbit-text"></span>
    `;
    root.appendChild(this.element);
    this.applyLanguage();
    controls.addEventListener('start', () => {
      this.used = true;
      this.hide();
    });
  }

  /** True once the view has been turned (no need to show the hint again). */
  get done(): boolean {
    return this.used;
  }

  show(): void {
    if (!this.used) this.element.classList.add('visible');
  }

  hide(): void {
    this.element.classList.remove('visible');
  }

  applyLanguage(): void {
    this.element.querySelector('.orbit-text')!.textContent = t('rotateHint');
  }
}
