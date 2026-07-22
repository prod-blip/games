import * as THREE from 'three';
import { getPreferredPixelRatio } from '../responsive';

export function createRenderer(): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(getPreferredPixelRatio());
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  return renderer;
}

export interface DefaultLighting {
  ambient: THREE.HemisphereLight;
  key: THREE.DirectionalLight;
  fill: THREE.DirectionalLight;
}

export function addDefaultLighting(scene: THREE.Scene): DefaultLighting {
  const ambient = new THREE.HemisphereLight(0x7184d8, 0x07130b, 1.25);
  scene.add(ambient);

  const moonlight = new THREE.DirectionalLight(0xb9c7ff, 1.85);
  moonlight.position.set(-5, 9, 4);
  moonlight.castShadow = true;
  const compactDisplay = Math.min(window.innerWidth, window.innerHeight) <= 820;
  moonlight.shadow.mapSize.setScalar(compactDisplay ? 512 : 1024);
  scene.add(moonlight);

  const fill = new THREE.DirectionalLight(0x7657b7, 0.45);
  fill.position.set(5, 3, -4);
  scene.add(fill);

  return { ambient, key: moonlight, fill };
}
