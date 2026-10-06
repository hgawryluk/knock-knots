/** Minimal HUD: a centered controls hint and a small brand mark. */
export function createOverlay(root: HTMLElement): void {
  root.innerHTML = `
    <div class="hint" role="note">
      <span class="hint-row">Drag the rope to tie</span>
      <span class="hint-dot" aria-hidden="true">✦</span>
      <span class="hint-row hint-sub">Scroll while holding: closer / farther · Shift: tuck under · Drag background to rotate</span>
    </div>
    <div class="brand">
      <span class="brand-name">Knots</span>
      <span class="brand-sep">·</span>
      <span class="brand-sub">Survival</span>
    </div>
  `;
}
