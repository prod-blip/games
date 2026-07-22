import * as THREE from 'three';

export class QuestMarker {
  readonly group = new THREE.Group();

  private elapsed = 0;

  constructor() {
    this.group.name = 'LionQuestMarker';

    const goldMaterial = new THREE.MeshStandardMaterial({
      color: 0xe8c76a,
      emissive: 0x69501a,
      emissiveIntensity: 1.1,
      roughness: 0.58,
      flatShading: true,
    });
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0xffe28a,
      transparent: true,
      opacity: 0.48,
      depthWrite: false,
    });

    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.3, 6), goldMaterial);
    shaft.position.y = 0.15;
    shaft.castShadow = true;
    this.group.add(shaft);

    const arrowHead = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.28, 7), goldMaterial);
    arrowHead.rotation.z = Math.PI;
    arrowHead.position.y = -0.1;
    arrowHead.castShadow = true;
    this.group.add(arrowHead);

    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.018, 5, 18), glowMaterial);
    halo.rotation.x = Math.PI / 2;
    halo.position.y = 0.34;
    this.group.add(halo);
  }

  update(delta: number): void {
    this.elapsed += delta;
    this.group.position.y = 2.25 + Math.sin(this.elapsed * 2.2) * 0.12;
    this.group.rotation.y += delta * 0.75;
  }

  setVisible(visible: boolean): void {
    this.group.visible = visible;
  }

  dispose(): void {
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    this.group.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      geometries.add(object.geometry);
      const material = object.material;
      if (Array.isArray(material)) material.forEach((item) => materials.add(item));
      else materials.add(material);
    });
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
  }
}
