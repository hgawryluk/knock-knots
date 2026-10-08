import * as THREE from 'three';
import { createRng } from '../utils/noise';

/** Where the fire burns: far back in the clearing, right of the rope — a warm, soft glow in the distance, not a prop up close. */
export const FIRE_AT = new THREE.Vector3(2.8, 0, -7.5);
/** It is built at camp scale and shown this much bigger, so it still reads from far away. */
const FIRE_SCALE = 2.3;
/** Radius of the stone ring (grass is kept clear inside it). */
export const FIRE_CLEAR_RADIUS = 0.75 * FIRE_SCALE;

const EMBERS = 70;
const EMBER_RISE = 1.6;

/**
 * A small campfire: a ring of stones, a teepee of charred sticks, soft
 * flames (crossed glowing planes with a noise shader), a few embers drifting
 * up, and a warm flickering light on the grass and the log.
 */
export function createCampfire(stoneSource: THREE.Object3D): { object: THREE.Group; update: (dt: number, elapsed: number) => void } {
  const object = new THREE.Group();
  object.position.copy(FIRE_AT);
  object.scale.setScalar(FIRE_SCALE);
  const rng = createRng(29);

  // Ring of small stones, each a squashed, turned copy of the scanned stone.
  const box = new THREE.Box3().setFromObject(stoneSource);
  const size = box.getSize(new THREE.Vector3());
  const stones = 9;
  for (let i = 0; i < stones; i++) {
    const angle = (i / stones) * Math.PI * 2 + rng() * 0.3;
    const stone = stoneSource.clone();
    const s = (0.22 + rng() * 0.08) / Math.max(size.x, size.z);
    stone.scale.set(s, s * (0.55 + rng() * 0.25), s);
    stone.rotation.y = rng() * Math.PI * 2;
    stone.position.set(Math.cos(angle) * 0.55, -box.min.y * stone.scale.y - 0.02, Math.sin(angle) * 0.55);
    object.add(stone);
  }

  // Thin charred sticks leaning into a teepee, two short logs lying in the fire, over a bed of ash.
  const wood = new THREE.MeshStandardMaterial({ color: '#1f1710', roughness: 1 });
  for (let i = 0; i < 6; i++) {
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.026, 0.62 + rng() * 0.12, 6), wood);
    const angle = (i / 6) * Math.PI * 2 + rng() * 0.5;
    stick.position.set(Math.cos(angle) * 0.15, 0.22, Math.sin(angle) * 0.15);
    stick.rotation.set(0, -angle, 0);
    stick.rotateZ(0.5 + rng() * 0.15);
    stick.castShadow = true;
    object.add(stick);
  }
  for (const [angle, offset] of [
    [0.3, 0.05],
    [1.9, -0.06],
  ]) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.5, 8), wood);
    log.rotation.set(Math.PI / 2, 0, angle);
    log.position.set(Math.sin(angle) * offset, 0.045, Math.cos(angle) * offset);
    log.castShadow = true;
    object.add(log);
  }
  const ash = new THREE.Mesh(new THREE.CircleGeometry(0.4, 24), new THREE.MeshStandardMaterial({ map: emberBedTexture(), roughness: 1 }));
  ash.rotation.x = -Math.PI / 2;
  ash.position.y = 0.005;
  object.add(ash);

  // Flames: three crossed planes sharing one shader, so they read from every side.
  const flameMaterial = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      varying vec2 vUv;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
      }
      void main() {
        vec2 p = vUv;
        // Licks of flame rise and sway; the shape narrows to a tip.
        float n = noise(vec2(p.x * 4.0, p.y * 3.0 - uTime * 2.4)) * 0.6 + noise(vec2(p.x * 9.0, p.y * 6.0 - uTime * 4.0)) * 0.4;
        float x = (p.x - 0.5) * 2.0 + (n - 0.5) * 0.5 * p.y;
        float width = (1.0 - p.y) * 0.9;
        float body = smoothstep(width, width * 0.35, abs(x));
        float flame = body * smoothstep(1.0, 0.25, p.y + (n - 0.5) * 0.35) * smoothstep(0.0, 0.08, p.y);
        vec3 core = vec3(1.0, 0.78, 0.36);
        vec3 edge = vec3(0.95, 0.3, 0.04);
        vec3 color = mix(edge, core, smoothstep(0.4, 0.95, flame) * (1.0 - p.y * 0.7));
        gl_FragColor = vec4(color * flame * 0.85, flame);
      }`,
  });
  for (let i = 0; i < 3; i++) {
    const flame = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 1.0), flameMaterial);
    flame.position.y = 0.5;
    flame.rotation.y = (i / 3) * Math.PI;
    flame.renderOrder = 2;
    object.add(flame);
  }

  // Embers drifting up and fading.
  const emberPositions = new Float32Array(EMBERS * 3);
  const emberSeeds = new Float32Array(EMBERS);
  for (let i = 0; i < EMBERS; i++) emberSeeds[i] = rng();
  const embers = new THREE.Points(
    new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(emberPositions, 3).setUsage(THREE.DynamicDrawUsage)),
    new THREE.PointsMaterial({ color: '#ffb35a', size: 0.025, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  object.add(embers);

  // A soft halo round the flames, like light blooming in the evening air.
  const glow = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: glowTexture(), color: '#ff9a4a', transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  glow.scale.set(1.3, 1.1, 1);
  glow.position.y = 0.55;
  object.add(glow);

  // Warm light that flickers; no shadows, to stay cheap.
  const light = new THREE.PointLight('#ff8a3d', 2.4 * FIRE_SCALE, 7, 1.6);
  light.position.y = 0.5;
  object.add(light);

  const update = (_dt: number, elapsed: number): void => {
    flameMaterial.uniforms.uTime.value = elapsed;
    const flicker = 1 + Math.sin(elapsed * 9.1) * 0.1 + Math.sin(elapsed * 23.7) * 0.06 + Math.sin(elapsed * 3.3) * 0.08;
    light.intensity = 2.2 * FIRE_SCALE * flicker;
    glow.material.opacity = 0.28 * flicker;
    for (let i = 0; i < EMBERS; i++) {
      const seed = emberSeeds[i];
      const t = (elapsed * (0.25 + seed * 0.2) + seed) % 1;
      const angle = seed * 40 + elapsed * 0.6;
      emberPositions[i * 3] = Math.cos(angle) * (0.08 + t * 0.25) * (0.5 + seed);
      emberPositions[i * 3 + 1] = 0.25 + t * EMBER_RISE;
      emberPositions[i * 3 + 2] = Math.sin(angle) * (0.08 + t * 0.25) * (0.5 + seed);
    }
    embers.geometry.attributes.position.needsUpdate = true;
  };
  update(0, 0);
  return { object, update };
}

/** Dark ash with a faint glow of embers at the centre. */
function emberBedTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, '#7a2c0c');
  gradient.addColorStop(0.35, '#3a2018');
  gradient.addColorStop(1, '#22201c');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const rng = createRng(5);
  for (let i = 0; i < 260; i++) {
    const shade = 30 + rng() * 60;
    ctx.fillStyle = `rgba(${shade}, ${shade * 0.95}, ${shade * 0.9}, 0.5)`;
    ctx.fillRect(rng() * size, rng() * size, 1 + rng() * 2, 1 + rng() * 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Soft round falloff for the halo. */
function glowTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(0.35, 'rgba(255, 255, 255, 0.35)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}
