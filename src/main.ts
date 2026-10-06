import * as THREE from 'three';
import './styles.css';
import { drapeOverBranch } from './scene/drape';
import { createMeadow } from './scene/meadow';
import { Rope } from './scene/rope';
import { Stage } from './scene/stage';
import { createOverlay } from './ui/overlay';

const stage = new Stage(document.getElementById('stage')!);
const meadow = await createMeadow(stage.scene);
stage.scene.add(meadow.root);
stage.onUpdate(meadow.update);

const rope = new Rope({ base: '#e8742a', strand: '#b4501b', fleck: '#f6d9a6' });
rope.setPoints(drapeOverBranch(meadow.branch, rope.radius));
stage.scene.add(rope.mesh);

stage.setView(new THREE.Vector3(0, 0.3, 0.2), 9.5, Math.PI * 0.3, 0.35);
createOverlay(document.getElementById('ui')!);

requestAnimationFrame(() => document.getElementById('fade')!.classList.add('hidden'));
