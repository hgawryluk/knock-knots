/** Top-centre notification telling you what to do now, and confirming when you've done it. */
export class Coach {
  private readonly element: HTMLElement;
  private readonly title: HTMLElement;
  private readonly text: HTMLElement;

  constructor(root: HTMLElement) {
    this.element = document.createElement('div');
    this.element.className = 'coach';
    this.element.setAttribute('role', 'status');
    this.element.setAttribute('aria-live', 'polite');
    this.element.innerHTML = `<div class="coach-title"></div><div class="coach-text"></div>`;
    this.title = this.element.querySelector('.coach-title')!;
    this.text = this.element.querySelector('.coach-text')!;
    root.appendChild(this.element);
  }

  show(title: string, text: string, tone: 'step' | 'success' = 'step'): void {
    this.title.textContent = title;
    this.text.textContent = text;
    this.element.classList.toggle('success', tone === 'success');
    // Re-trigger the entrance animation for each new message.
    this.element.classList.remove('visible');
    void this.element.offsetWidth;
    this.element.classList.add('visible');
  }

  hide(): void {
    this.element.classList.remove('visible');
  }
}
