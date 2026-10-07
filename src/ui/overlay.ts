/** Small brand mark in the corner. */
export function createOverlay(root: HTMLElement): void {
  root.innerHTML = `
    <div class="brand">
      <span class="brand-name">Knots</span>
      <span class="brand-sep">·</span>
      <span class="brand-sub">Survival</span>
    </div>
  `;
}
