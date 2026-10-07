import * as THREE from 'three';

/**
 * Dev-only synthetic mouse: dispatches real pointer events so tests go through
 * the same input path as a person (picking, drag targeting, orbit fallthrough).
 * Time advances by calling `step` once per simulated frame, not with timers,
 * so tests behave the same when the page is hidden or throttled.
 */
export function createMouse(canvas: HTMLCanvasElement, camera: THREE.Camera, step: () => void) {
  const fire = (type: string, x: number, y: number, target: EventTarget, shift = false): void => {
    target.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
        pointerId: 7,
        pointerType: 'mouse',
        button: 0,
        buttons: type === 'pointerup' ? 0 : 1,
        shiftKey: shift,
      }),
    );
  };
  const frames = (count: number): void => {
    for (let i = 0; i < count; i++) step();
  };

  return {
    /** World point → client pixel coordinates. */
    screen(x: number, y: number, z: number): [number, number] {
      const v = new THREE.Vector3(x, y, z).project(camera);
      const rect = canvas.getBoundingClientRect();
      return [rect.left + ((v.x + 1) / 2) * rect.width, rect.top + ((1 - v.y) / 2) * rect.height];
    },
    down: (x: number, y: number) => fire('pointerdown', x, y, canvas),
    up: (x: number, y: number) => fire('pointerup', x, y, window),
    /** Moves through screen points over `ms` of simulated time, one event per frame. */
    path(points: [number, number][], ms = 1000): void {
      const segments = points.length - 1;
      const steps = Math.max(10, Math.round(ms / 16));
      for (let s = 0; s <= steps; s++) {
        const t = (s / steps) * segments;
        const i = Math.min(Math.floor(t), segments - 1);
        const f = t - i;
        const [x0, y0] = points[i];
        const [x1, y1] = points[i + 1];
        fire('pointermove', x0 + (x1 - x0) * f, y0 + (y1 - y0) * f, window);
        step();
      }
    },
    shift(down: boolean): void {
      window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { key: 'Shift' }));
    },
    /** Advances the simulation by `ms` without moving the mouse. */
    wait(ms: number): void {
      frames(Math.round(ms / 16));
    },
  };
}
