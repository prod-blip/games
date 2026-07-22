import * as THREE from 'three';

export function getPreferredPixelRatio(): number {
  const compactDisplay = Math.min(window.innerWidth, window.innerHeight) <= 820;
  const coarsePointer = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  const maximum = compactDisplay || coarsePointer ? 1.25 : 1.5;
  return Math.min(window.devicePixelRatio, maximum);
}

export function resizeRendererToDisplaySize(
  renderer: THREE.WebGLRenderer,
  camera: THREE.PerspectiveCamera,
): void {
  const canvas = renderer.domElement;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const pixelRatio = getPreferredPixelRatio();
  const needsResize = canvas.width !== Math.floor(width * pixelRatio)
    || canvas.height !== Math.floor(height * pixelRatio);

  if (!needsResize) return;

  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(width, height, false);
  camera.aspect = width / Math.max(height, 1);
  camera.updateProjectionMatrix();
}
