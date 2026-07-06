import * as THREE from 'three';
import type { EndlessTuning } from '../types';

type SceneLighting = {
  hemi: THREE.HemisphereLight;
  sun: THREE.DirectionalLight;
};

export function configureRenderer(renderer: THREE.WebGLRenderer) {
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
}

export function createSceneLighting(scene: THREE.Scene, level: EndlessTuning): SceneLighting {
  const hemi = new THREE.HemisphereLight(0xdceeff, 0x8f603a, 1.35);
  const sun = new THREE.DirectionalLight(0xffd49a, 2.35);
  sun.position.set(10, 16, 7);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1536, 1536);
  sun.shadow.camera.left = -18;
  sun.shadow.camera.right = 38;
  sun.shadow.camera.top = 18;
  sun.shadow.camera.bottom = -14;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 70;
  sun.shadow.bias = -0.00025;
  scene.add(hemi, sun);
  applyScenePalette(scene, level, { hemi, sun });
  return { hemi, sun };
}

export function applyScenePalette(scene: THREE.Scene, level: EndlessTuning, lighting?: SceneLighting) {
  scene.background = new THREE.Color(level.skyColor);
  scene.fog = new THREE.Fog(level.fogColor, 44, 155);

  if (lighting) {
    const warmth = THREE.MathUtils.clamp(level.baseInstability / 2.1, 0, 1);
    lighting.hemi.color.set(level.fogColor).lerp(new THREE.Color(0xdceeff), 0.42);
    lighting.hemi.groundColor.set(level.shoulderColor);
    lighting.hemi.intensity = 1.25 + warmth * 0.2;

    lighting.sun.color.set(0xffdfa8).lerp(new THREE.Color(0xff8b52), warmth * 0.55);
    lighting.sun.intensity = 2.15 + warmth * 0.55;
    lighting.sun.position.set(10 - warmth * 2.5, 16 - warmth * 1.7, 7 + warmth * 2.2);
  }
}
