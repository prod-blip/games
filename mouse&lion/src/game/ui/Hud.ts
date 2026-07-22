export class Hud {
  private readonly root = document.createElement('div');
  private readonly title = document.createElement('div');
  private readonly objective = document.createElement('div');
  private readonly objectiveArrow = document.createElement('div');
  private readonly objectiveDistance = document.createElement('div');

  constructor(parent: HTMLElement) {
    this.root.className = 'hud';
    this.title.className = 'hud__title';
    this.objective.className = 'hud__objective';
    this.objectiveArrow.className = 'hud__objective-arrow';
    this.objectiveArrow.textContent = '▲';
    this.objectiveDistance.className = 'hud__objective-distance';
    this.objective.append(this.objectiveArrow, this.objectiveDistance);
    this.root.classList.add('hud--hidden');

    this.title.textContent = 'The Mouse and the Lion';

    this.root.append(this.title, this.objective);
    parent.appendChild(this.root);
  }

  setVisible(visible: boolean): void {
    this.root.classList.toggle('hud--hidden', !visible);
  }

  updateObjective(
    playerPosition: { x: number; z: number },
    targetPosition: { x: number; z: number },
    label = 'Sleeping lion',
  ): void {
    const dx = targetPosition.x - playerPosition.x;
    const dz = targetPosition.z - playerPosition.z;
    const distance = Math.hypot(dx, dz);
    const angle = Math.atan2(dx, -dz);
    this.objectiveArrow.style.transform = `rotate(${angle}rad)`;
    this.objectiveDistance.textContent = `${label} · ${Math.ceil(distance)}m`;
  }

  setObjectiveVisible(visible: boolean): void {
    this.objective.classList.toggle('hud__objective--hidden', !visible);
  }

  dispose(): void {
    this.root.remove();
  }
}
