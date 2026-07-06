import type { ChaseState, EndlessState } from '../types';
import { describeChaser } from '../systems/chase';
import type { VehicleState } from '../systems/vehiclePhysics';

type HudOptions = {
  host: HTMLElement;
  onRetry: () => void;
};

export class Hud {
  private host: HTMLElement;
  private hud: HTMLElement;
  private status: HTMLElement;
  private fuelFill: HTMLElement;
  private degradationFill: HTMLElement;
  private distanceLabel: HTMLElement;
  private chaserLabel: HTMLElement;
  private restartButton: HTMLButtonElement;

  constructor({ host, onRetry }: HudOptions) {
    this.host = host;

    const hud = document.createElement('div');
    hud.className = 'hud';
    hud.innerHTML = `
      <div class="topbar">
        <div><span class="distance-label">Distance: 0m</span></div>
        <div class="meters">
          <div class="fuel"><span>Fuel</span><div class="fuel-track"><div class="fuel-fill"></div></div></div>
          <div class="degradation"><span>Degradation</span><div class="fuel-track degradation-track"><div class="degradation-fill"></div></div></div>
          <div class="chaser-label">Chaser: Distant</div>
        </div>
      </div>
      <div class="status"></div>
    `;
    this.host.appendChild(hud);
    this.hud = hud;

    this.status = hud.querySelector('.status')!;
    this.fuelFill = hud.querySelector('.fuel-fill')!;
    this.degradationFill = hud.querySelector('.degradation-fill')!;
    this.distanceLabel = hud.querySelector('.distance-label')!;
    this.chaserLabel = hud.querySelector('.chaser-label')!;

    this.restartButton = document.createElement('button');
    this.restartButton.className = 'restart hidden';
    this.restartButton.textContent = 'Retry Chase';
    this.restartButton.addEventListener('click', onRetry);
    this.host.appendChild(this.restartButton);
  }

  updateSurvival(state: EndlessState, vehicle: VehicleState, chase: ChaseState) {
    this.distanceLabel.textContent = `Distance: ${Math.floor(state.distanceSurvived)}m`;
    this.fuelFill.style.width = `${vehicle.fuel}%`;
    this.fuelFill.classList.toggle('low', vehicle.fuel < 25);
    this.degradationFill.style.width = `${vehicle.degradation}%`;
    this.degradationFill.classList.toggle('danger', vehicle.degradation > 65);
    this.chaserLabel.textContent = `Chaser: ${describeChaser(chase)} · ${Math.max(0, chase.distance).toFixed(1)}m`;
    this.chaserLabel.classList.toggle('danger', chase.monsterPressure > 0.7);
    this.status.textContent = `E20 cans: ${state.e20Collected} · Survive until the bargain catches up.`;
  }

  showEndState(message: string) {
    this.status.textContent = `❌ ${message}`;
    this.status.classList.add('fail');
    this.restartButton.classList.remove('hidden');
  }

  resetStatus() {
    this.status.className = 'status';
    this.restartButton.classList.add('hidden');
  }

  flashImpact() {
    this.hud.classList.remove('impact-flash', 'hud-shake');
    void this.hud.offsetWidth;
    this.hud.classList.add('impact-flash', 'hud-shake');
  }

  pulsePickup() {
    this.fuelFill.classList.remove('fuel-jump');
    this.degradationFill.classList.remove('degradation-pulse');
    void this.fuelFill.offsetWidth;
    this.fuelFill.classList.add('fuel-jump');
    this.degradationFill.classList.add('degradation-pulse');
  }

  setControlPressed(key: 'accelerate' | 'brakeReverse' | 'steerUp' | 'steerDown', pressed: boolean) {
    const selector = key === 'accelerate'
      ? '.control.right'
      : key === 'brakeReverse'
        ? '.control.left'
        : key === 'steerUp'
          ? '.control.up'
          : '.control.down';
    this.host.querySelector(selector)?.classList.toggle('pressed', pressed);
  }

}
