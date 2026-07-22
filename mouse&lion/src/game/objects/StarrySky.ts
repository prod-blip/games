import * as THREE from 'three';

const SKY_RADIUS = 92;
const STAR_COUNT = 2200;

export class StarrySky {
  readonly group = new THREE.Group();

  private readonly skyMaterial: THREE.ShaderMaterial;
  private readonly starMaterial: THREE.ShaderMaterial;
  private readonly stars: THREE.Points;
  private elapsed = 0;

  constructor() {
    this.group.name = 'StarryNightSky';

    this.skyMaterial = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader: `
        varying vec3 vDirection;

        void main() {
          vDirection = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uDaylight;
        varying vec3 vDirection;

        void main() {
          float height = normalize(vDirection).y * 0.5 + 0.5;
          float upperMix = smoothstep(0.24, 0.9, height);
          float horizonGlow = exp(-pow((height - 0.46) * 5.2, 2.0));
          vec3 horizon = vec3(0.065, 0.075, 0.20);
          vec3 zenith = vec3(0.008, 0.006, 0.055);
          vec3 nightColor = mix(horizon, zenith, upperMix);
          nightColor += vec3(0.11, 0.055, 0.18) * horizonGlow * 0.34;
          vec3 dayHorizon = vec3(0.60, 0.78, 0.84);
          vec3 dayZenith = vec3(0.16, 0.43, 0.72);
          vec3 dayColor = mix(dayHorizon, dayZenith, upperMix);
          dayColor += vec3(0.18, 0.14, 0.06) * horizonGlow * 0.18;
          vec3 color = mix(nightColor, dayColor, uDaylight);
          gl_FragColor = vec4(color, 1.0);
        }
      `,
      uniforms: {
        uDaylight: { value: 0 },
      },
    });

    const sky = new THREE.Mesh(new THREE.SphereGeometry(SKY_RADIUS, 40, 24), this.skyMaterial);
    sky.renderOrder = -20;
    this.group.add(sky);

    const positions = new Float32Array(STAR_COUNT * 3);
    const colors = new Float32Array(STAR_COUNT * 3);
    const scales = new Float32Array(STAR_COUNT);
    const phases = new Float32Array(STAR_COUNT);
    const warm = new THREE.Color(0xffe9cf);
    const white = new THREE.Color(0xf8fbff);
    const blue = new THREE.Color(0x9dbbff);
    const color = new THREE.Color();

    for (let index = 0; index < STAR_COUNT; index += 1) {
      const radius = 72 + Math.random() * 11;
      const y = -0.08 + Math.random() * 1.08;
      const ringRadius = Math.sqrt(1 - y * y);
      const angle = Math.random() * Math.PI * 2;
      const offset = index * 3;

      positions[offset] = Math.cos(angle) * ringRadius * radius;
      positions[offset + 1] = y * radius;
      positions[offset + 2] = Math.sin(angle) * ringRadius * radius;

      const tint = Math.random();
      color.copy(tint < 0.12 ? warm : tint > 0.78 ? blue : white);
      colors[offset] = color.r;
      colors[offset + 1] = color.g;
      colors[offset + 2] = color.b;
      scales[index] = 0.55 + Math.pow(Math.random(), 4) * 1.8;
      phases[index] = Math.random() * Math.PI * 2;
    }

    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    starGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    starGeometry.setAttribute('aScale', new THREE.BufferAttribute(scales, 1));
    starGeometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));

    this.starMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uDaylight: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      fog: false,
      blending: THREE.AdditiveBlending,
      vertexShader: `
        attribute vec3 color;
        attribute float aScale;
        attribute float aPhase;
        uniform float uTime;
        uniform float uDaylight;
        varying vec3 vColor;
        varying float vAlpha;

        void main() {
          float twinkle = 0.76 + sin(uTime * (0.8 + aScale * 0.25) + aPhase) * 0.24;
          vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * viewPosition;
          gl_PointSize = (1.25 + aScale * 1.65) * twinkle;
          vColor = color;
          vAlpha = twinkle * (1.0 - uDaylight);
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vAlpha;

        void main() {
          vec2 centered = gl_PointCoord - vec2(0.5);
          float distanceFromCenter = length(centered);
          float core = 1.0 - smoothstep(0.05, 0.5, distanceFromCenter);
          float glow = 1.0 - smoothstep(0.0, 0.5, distanceFromCenter);
          float alpha = (core * 0.82 + glow * 0.35) * vAlpha;
          if (alpha < 0.02) discard;
          gl_FragColor = vec4(vColor * (1.0 + core * 0.45), alpha);
        }
      `,
    });

    this.stars = new THREE.Points(starGeometry, this.starMaterial);
    this.stars.renderOrder = -10;
    this.group.add(this.stars);
  }

  update(delta: number, camera: THREE.Camera): void {
    this.elapsed += delta;
    this.starMaterial.uniforms.uTime.value = this.elapsed;
    this.stars.rotation.y += delta * 0.0025;
    this.group.position.copy(camera.position);
  }

  setDaylight(amount: number): void {
    const daylight = THREE.MathUtils.clamp(amount, 0, 1);
    this.skyMaterial.uniforms.uDaylight.value = daylight;
    this.starMaterial.uniforms.uDaylight.value = daylight;
    this.stars.visible = daylight < 0.96;
  }

  dispose(): void {
    this.group.traverse((object) => {
      if (!(object instanceof THREE.Mesh || object instanceof THREE.Points)) return;
      object.geometry.dispose();
    });
    this.skyMaterial.dispose();
    this.starMaterial.dispose();
  }
}
