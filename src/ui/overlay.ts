/** Minimal HUD: a centered interaction hint and a small brand mark. */
export function createOverlay(root: HTMLElement): void {
  root.innerHTML = `
    <div class="hint" role="note">
      <span class="hint-row"><span aria-hidden="true">←</span> Drag to rotate <span aria-hidden="true">→</span></span>
      <span class="hint-dot" aria-hidden="true">✦</span>
      <span class="hint-row">Scroll to zoom</span>
    </div>
    <div class="brand">
      <span class="brand-name">Knots</span>
      <span class="brand-sep">·</span>
      <span class="brand-sub">Survival</span>
    </div>
  `;
}
