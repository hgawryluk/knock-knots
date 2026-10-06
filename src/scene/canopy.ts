import * as THREE from 'three';

/**
 * Animated light cookie: a procedural canopy with gaps, whose branches sway in
 * the wind. Rendered on the GPU into a small texture each frame and projected
 * by the sun spotlight (`SpotLight.map`), like a gobo in film lighting.
 */
export class CanopyShadow {
  private readonly target = new THREE.WebGLRenderTarget(512, 512, { depthBuffer: false });
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly material: THREE.ShaderMaterial;

  constructor() {
    this.material = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        varying vec2 vUv;

        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float noise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
        }
        float fbm(vec2 p) {
          float s = 0.0, a = 0.5;
          for (int i = 0; i < 5; i++) { s += a * noise(p); p *= 2.03; a *= 0.5; }
          return s;
        }

        void main() {
          vec2 p = vUv * 15.0;
          // Big branches sway slowly; leaf clusters flutter faster on top.
          float region = noise(p * 0.35 + 7.0);
          vec2 sway = vec2(sin(uTime * 0.6 + region * 6.28), cos(uTime * 0.45 + region * 4.0)) * 0.35;
          vec2 flutter = vec2(sin(uTime * 2.3 + p.y * 3.0), cos(uTime * 1.9 + p.x * 3.0)) * 0.06;
          float leaves = fbm(p + sway + flutter);
          // Gaps between leaves let sun through; edges stay soft like real penumbra.
          float light = smoothstep(0.52, 0.6, leaves);
          gl_FragColor = vec4(vec3(mix(0.12, 1.0, light)), 1.0);
        }
      `,
      depthTest: false,
      depthWrite: false,
    });
    this.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material));
  }

  get texture(): THREE.Texture {
    return this.target.texture;
  }

  update(renderer: THREE.WebGLRenderer, elapsed: number): void {
    this.material.uniforms.uTime.value = elapsed;
    const previous = renderer.getRenderTarget();
    renderer.setRenderTarget(this.target);
    renderer.render(this.scene, this.camera);
    renderer.setRenderTarget(previous);
  }
}
