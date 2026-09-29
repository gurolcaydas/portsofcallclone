import * as THREE from 'three';
import { sounds } from '../sound/SoundManager.js';
import { buildShip3DModel } from './ShipModel3D.js';

export interface HazardResult {
  damagePercent: number;
  success: boolean;
}

export class HazardNav3D {
  private container: HTMLElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private animFrameId: number | null = null;

  private shipGroup: THREE.Group | null = null;
  private obstacles: Array<{ mesh: THREE.Mesh; box: THREE.Box3 }> = [];
  private distanceRemaining: number = 2000;
  private hullDamage: number = 0;
  private shipX: number = 0;
  private isFinished: boolean = false;
  private activeKeys: Set<string> = new Set();
  private isListening: boolean = false;

  private onComplete: (result: HazardResult) => void;

  constructor(containerId: string, onComplete: (result: HazardResult) => void) {
    this.container = document.getElementById(containerId) || document.body;
    this.onComplete = onComplete;

    this.scene = new THREE.Scene();
    // Bright, clear daytime maritime polar / coastal atmosphere (not dark)
    this.scene.background = new THREE.Color(0x3a7ba8);
    this.scene.fog = new THREE.FogExp2(0x5696c2, 0.0012);

    this.camera = new THREE.PerspectiveCamera(
      60,
      this.container.clientWidth / (this.container.clientHeight || 1),
      0.5,
      1200
    );

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.container.appendChild(this.renderer.domElement);

    // Bright daylight illumination
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x2a597d, 1.8);
    this.scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfff8ee, 2.2);
    sunLight.position.set(120, 200, -100);
    sunLight.castShadow = true;
    this.scene.add(sunLight);

    // Ocean plane (Crisp blue open sea water)
    const waterGeo = new THREE.PlaneGeometry(1600, 1600, 32, 32);
    waterGeo.rotateX(-Math.PI / 2);
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x094873,
      roughness: 0.18,
      metalness: 0.55,
      flatShading: true
    });
    const water = new THREE.Mesh(waterGeo, waterMat);
    this.scene.add(water);

    window.addEventListener('resize', this.onResize);
    this.setupOnScreenControls();
  }

  private setupOnScreenControls() {
    const controls = document.querySelector('.hazard-controls');
    if (controls && !document.getElementById('hazard-touch-btns')) {
      const btnDiv = document.createElement('div');
      btnDiv.id = 'hazard-touch-btns';
      btnDiv.style.display = 'flex';
      btnDiv.style.justifyContent = 'center';
      btnDiv.style.gap = '15px';
      btnDiv.style.marginTop = '8px';

      btnDiv.innerHTML = `
        <button id="btn-hazard-left" class="btn btn-primary" style="padding: 10px 24px;">◄ STEER PORT</button>
        <button id="btn-hazard-right" class="btn btn-primary" style="padding: 10px 24px;">STEER STBD ►</button>
      `;
      controls.appendChild(btnDiv);

      document.getElementById('btn-hazard-left')?.addEventListener('mousedown', () => this.activeKeys.add('a'));
      document.getElementById('btn-hazard-left')?.addEventListener('mouseup', () => this.activeKeys.delete('a'));
      document.getElementById('btn-hazard-right')?.addEventListener('mousedown', () => this.activeKeys.add('d'));
      document.getElementById('btn-hazard-right')?.addEventListener('mouseup', () => this.activeKeys.delete('d'));
    }
  }

  private createObstacle(type: 'iceberg' | 'reef', zPos: number) {
    const isIceberg = type === 'iceberg';
    const xPos = (Math.random() - 0.5) * 150;

    let geo: THREE.BufferGeometry;
    let mat: THREE.Material;

    if (isIceberg) {
      geo = new THREE.DodecahedronGeometry(13 + Math.random() * 9, 1);
      mat = new THREE.MeshStandardMaterial({
        color: 0xebf8ff,
        roughness: 0.08,
        metalness: 0.18,
        flatShading: true
      });
    } else {
      geo = new THREE.ConeGeometry(15 + Math.random() * 7, 24, 6);
      mat = new THREE.MeshStandardMaterial({
        color: 0x5a4131,
        roughness: 0.85,
        flatShading: true
      });
    }

    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(xPos, 6, zPos);
    mesh.rotation.set(Math.random(), Math.random(), Math.random());
    mesh.castShadow = true;
    this.scene.add(mesh);

    const box = new THREE.Box3().setFromObject(mesh);
    this.obstacles.push({ mesh, box });
  }

  private onResize = () => {
    if (!this.container) return;
    this.camera.aspect = this.container.clientWidth / (this.container.clientHeight || 1);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
  };

  private onKeyDown = (e: KeyboardEvent) => {
    if (this.isFinished) return;
    const key = e.key.toLowerCase();
    const code = e.code;

    if (['ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
      e.preventDefault();
    }

    if (key === 'a' || code === 'KeyA' || e.key === 'ArrowLeft') {
      this.activeKeys.add('a');
    }
    if (key === 'd' || code === 'KeyD' || e.key === 'ArrowRight') {
      this.activeKeys.add('d');
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    const key = e.key.toLowerCase();
    const code = e.code;

    if (key === 'a' || code === 'KeyA' || e.key === 'ArrowLeft') {
      this.activeKeys.delete('a');
    }
    if (key === 'd' || code === 'KeyD' || e.key === 'ArrowRight') {
      this.activeKeys.delete('d');
    }
  };

  public start(
    hazardType: 'iceberg' | 'reef' = 'iceberg',
    shipName: string = 'MY VESSEL',
    shipType: string = 'freighter',
    playerColor: string = '#00d2ff'
  ) {
    this.isFinished = false;
    this.hullDamage = 0;
    this.distanceRemaining = 1800;
    this.shipX = 0;
    this.activeKeys.clear();

    if (!this.isListening) {
      window.addEventListener('keydown', this.onKeyDown);
      window.addEventListener('keyup', this.onKeyUp);
      this.isListening = true;
    }

    // Clean up old obstacles
    for (const obs of this.obstacles) {
      this.scene.remove(obs.mesh);
    }
    this.obstacles = [];

    // Clean up old ship model and build distinct 3D model for current ship
    if (this.shipGroup) {
      this.scene.remove(this.shipGroup);
      this.shipGroup = null;
    }
    this.shipGroup = buildShip3DModel(shipType, playerColor);
    // Face forward along +Z towards oncoming obstacles
    this.shipGroup.rotation.y = Math.PI;
    this.scene.add(this.shipGroup);

    // Spawn obstacles ahead in the distance
    for (let z = 140; z < 2100; z += 95) {
      this.createObstacle(hazardType, z);
    }

    const titleEl = document.getElementById('hazard-title');
    if (titleEl) {
      titleEl.innerHTML = `
        ${hazardType === 'iceberg' ? '🧊 ICEBERG CONVOY ALERT' : '🪨 SHALLOW REEF PASSAGE'}
        <span style="font-size: 0.85rem; color: ${playerColor}; display: block; margin-top: 4px; font-weight: 600;">
          ${shipName.toUpperCase()} — ${shipType.toUpperCase().replace('_', ' ')}
        </span>
      `;
    }

    sounds.playHazardAlarm();
    sounds.setEngineThrottle(45);

    let lastTime = performance.now();
    const animate = (time: number) => {
      const dt = Math.min(0.1, (time - lastTime) / 1000);
      lastTime = time;

      this.update(dt, time);
      this.renderer.render(this.scene, this.camera);

      if (!this.isFinished) {
        this.animFrameId = requestAnimationFrame(animate);
      }
    };
    this.animFrameId = requestAnimationFrame(animate);
  }

  private update(dt: number, time: number) {
    if (!this.shipGroup) return;

    const speed = 45; // Units per second forward
    this.distanceRemaining -= speed * dt;

    // Continuous responsive steering
    const steerSpeed = 65 * dt;
    if (this.activeKeys.has('a')) {
      this.shipX = Math.max(-75, this.shipX - steerSpeed);
    }
    if (this.activeKeys.has('d')) {
      this.shipX = Math.min(75, this.shipX + steerSpeed);
    }

    // Move obstacles towards ship
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const obs = this.obstacles[i];
      obs.mesh.position.z -= speed * dt;
      obs.box.setFromObject(obs.mesh);

      const shipBox = new THREE.Box3().setFromCenterAndSize(
        this.shipGroup.position,
        new THREE.Vector3(18, 10, 65)
      );

      if (shipBox.intersectsBox(obs.box)) {
        sounds.playImpact();
        this.hullDamage += 12;
        obs.mesh.position.x += 45;
        obs.box.setFromObject(obs.mesh);
      }

      if (obs.mesh.position.z < -40) {
        this.scene.remove(obs.mesh);
        this.obstacles.splice(i, 1);
      }
    }

    // Ship position interpolation & dynamic banking
    this.shipGroup.position.x += (this.shipX - this.shipGroup.position.x) * dt * 7;
    this.shipGroup.position.z = 0;
    // Bank ship slightly into turns
    this.shipGroup.rotation.z = (this.shipX - this.shipGroup.position.x) * -0.025;
    this.shipGroup.rotation.x = Math.sin(time * 0.003) * 0.035;

    // Camera following smoothly behind vessel
    this.camera.position.set(this.shipGroup.position.x * 0.55, 30, -75);
    this.camera.lookAt(this.shipGroup.position.x * 0.75, 8, 80);

    // Update HUD
    const distEl = document.getElementById('hazard-dist-left');
    if (distEl) distEl.textContent = `${Math.max(0, Math.round(this.distanceRemaining))}m`;

    const hullEl = document.getElementById('hazard-hull-val');
    if (hullEl) {
      const integrity = Math.max(0, 100 - this.hullDamage);
      hullEl.textContent = `${integrity}%`;
      hullEl.style.color = integrity > 60 ? '#2ed573' : integrity > 30 ? '#ffa502' : '#ff4757';
    }

    if (this.distanceRemaining <= 0) {
      this.isFinished = true;
      sounds.stopEngine();
      sounds.playBell();
      sounds.playFanfare();
      this.stop();
      this.onComplete({
        damagePercent: this.hullDamage,
        success: true
      });
    }
  }

  public stop() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    sounds.stopEngine();
    this.activeKeys.clear();
    if (this.isListening) {
      window.removeEventListener('keydown', this.onKeyDown);
      window.removeEventListener('keyup', this.onKeyUp);
      this.isListening = false;
    }
  }

  public destroy() {
    this.stop();
    window.removeEventListener('resize', this.onResize);
    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }
    this.renderer.dispose();
  }
}
