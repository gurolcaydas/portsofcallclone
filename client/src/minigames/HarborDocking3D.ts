import * as THREE from 'three';
import { sounds } from '../sound/SoundManager.js';
import { buildShip3DModel } from './ShipModel3D.js';
import { Port } from '@portofcall/shared';

export interface DockingResult {
  score: number;
  damagePercent: number;
  success: boolean;
}

export type HarborLayoutType = 'straight' | 'angled' | 'obstacle';

export function getHarborLayoutType(portId: string): HarborLayoutType {
  const p = (portId || '').toLowerCase();
  if (['london', 'new_york', 'panama', 'cape_town', 'buenos_aires'].includes(p)) {
    return 'angled';
  }
  if (['singapore', 'tokyo', 'shanghai', 'dubai', 'sydney', 'hong_kong'].includes(p)) {
    return 'obstacle';
  }
  return 'straight';
}

export class HarborDocking3D {
  private container: HTMLElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private animFrameId: number | null = null;

  // 3D World Objects
  private shipGroup: THREE.Group | null = null;
  private harborObjects: THREE.Object3D[] = [];
  private lighthouseBeam: THREE.SpotLight | null = null;
  private waterMesh: THREE.Mesh | null = null;
  private berthMesh: THREE.Mesh | null = null;

  // Ship Physics & Controls
  private throttleSetting: number = 0; // -3 (Full Astern) to +4 (Full Ahead)
  private targetRudderAngle: number = 0; // Commanded rudder helm angle (-35° to +35°)
  private rudderAngle: number = 0; // Actual hydraulic rudder angle (-35° to +35°)
  private currentYawRateRad: number = 0; // Rotational velocity in rad/sec (hydrodynamic yaw momentum)
  private currentSpeedKnots: number = 2.0;
  private shipHeadingRad: number = 0; // 0 = North (towards -Z)
  private shipPos: THREE.Vector3 = new THREE.Vector3(0, 0, 320);
  private hullDamage: number = 0;
  private isDocked: boolean = false;
  private windSpeedKnots: number = 6;
  private windDirRad: number = Math.PI * 0.3;

  // Active Key Input Tracking
  private activeKeys: Set<string> = new Set();
  private isListening: boolean = false;

  // Collision & Berthing
  private colliders: THREE.Box3[] = [];
  private berthBox: THREE.Box3 = new THREE.Box3();
  private currentLayout: HarborLayoutType = 'straight';

  // Callbacks
  private onComplete: (result: DockingResult) => void;

  constructor(containerId: string, onComplete: (result: DockingResult) => void) {
    this.container = document.getElementById(containerId) || document.body;
    this.onComplete = onComplete;

    // Scene
    this.scene = new THREE.Scene();
    // Bright, crisp daylight coastal sky (not dark)
    this.scene.background = new THREE.Color(0x6ba9e2);
    this.scene.fog = new THREE.FogExp2(0x91c4ed, 0.0008);

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      55,
      this.container.clientWidth / (this.container.clientHeight || 1),
      0.5,
      1800
    );

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    // Daylight Lighting
    this.setupDaylight();
    this.waterMesh = this.createWater();

    // Event Listeners
    window.addEventListener('resize', this.onResize);
    this.setupOnScreenControls();
  }

  private setupDaylight() {
    // Bright natural daylight hemisphere
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x3d7099, 1.7);
    this.scene.add(hemiLight);

    // Brilliant warm coastal sunlight
    const sunLight = new THREE.DirectionalLight(0xfff3db, 2.3);
    sunLight.position.set(180, 260, 220);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 1200;
    sunLight.shadow.camera.left = -300;
    sunLight.shadow.camera.right = 300;
    sunLight.shadow.camera.top = 300;
    sunLight.shadow.camera.bottom = -300;
    this.scene.add(sunLight);

    // Lighthouse searchlight beam
    this.lighthouseBeam = new THREE.SpotLight(0xfff5cc, 12);
    this.lighthouseBeam.position.set(-180, 52, -140);
    this.lighthouseBeam.angle = Math.PI / 10;
    this.lighthouseBeam.penumbra = 0.25;
    this.lighthouseBeam.distance = 800;
    this.scene.add(this.lighthouseBeam);
    this.scene.add(this.lighthouseBeam.target);
  }

  private createWater(): THREE.Mesh {
    const geo = new THREE.PlaneGeometry(2200, 2200, 64, 64);
    geo.rotateX(-Math.PI / 2);

    const mat = new THREE.MeshStandardMaterial({
      color: 0x0c5285,
      roughness: 0.16,
      metalness: 0.65,
      flatShading: true
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = 0;
    this.scene.add(mesh);
    return mesh;
  }

  private buildHarborLayout(layout: HarborLayoutType) {
    // Clear previous harbor objects and colliders
    for (const obj of this.harborObjects) {
      this.scene.remove(obj);
    }
    this.harborObjects = [];
    this.colliders = [];
    this.currentLayout = layout;

    const concreteMat = new THREE.MeshStandardMaterial({ color: 0x576574, roughness: 0.75 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x534031, roughness: 0.85 });
    const yellowStripeMat = new THREE.MeshStandardMaterial({ color: 0xf7b731, roughness: 0.5 });
    const containerColors = [0xeb4d4b, 0x0984e3, 0xf0932b, 0x2ed573, 0x8e44ad, 0x00d2ff];

    const addBuilding = (mesh: THREE.Mesh, addCollider: boolean = true) => {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      this.harborObjects.push(mesh);
      if (addCollider) {
        this.colliders.push(new THREE.Box3().setFromObject(mesh));
      }
    };

    const addContainerStack = (x: number, y: number, z: number) => {
      const col = containerColors[Math.floor(Math.random() * containerColors.length)];
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(10, 8, 22),
        new THREE.MeshStandardMaterial({ color: col, roughness: 0.45 })
      );
      box.position.set(x, y, z);
      addBuilding(box, true);
    };

    if (layout === 'straight') {
      // --- LAYOUT 1: STRAIGHT APPROACH (Rotterdam, Hamburg, etc.) ---
      // Left Breakwater Pier
      const pierL = new THREE.Mesh(new THREE.BoxGeometry(40, 15, 340), concreteMat);
      pierL.position.set(-145, 7.5, 0);
      addBuilding(pierL);

      // Right Breakwater Pier
      const pierR = new THREE.Mesh(new THREE.BoxGeometry(40, 15, 340), concreteMat);
      pierR.position.set(145, 7.5, 0);
      addBuilding(pierR);

      // End Terminal Quay Wall
      const endQuay = new THREE.Mesh(new THREE.BoxGeometry(330, 15, 60), concreteMat);
      endQuay.position.set(0, 7.5, -200);
      addBuilding(endQuay);

      // Finger Pier
      const fingerPier = new THREE.Mesh(new THREE.BoxGeometry(26, 12, 160), woodMat);
      fingerPier.position.set(-30, 6, -100);
      addBuilding(fingerPier);

      // Docking Slipway Guide Markers (Green Berth target box)
      const berthZoneGeo = new THREE.BoxGeometry(50, 1, 140);
      const berthMat = new THREE.MeshBasicMaterial({
        color: 0x2ed573,
        transparent: true,
        opacity: 0.35,
        wireframe: true
      });
      const berthMesh = new THREE.Mesh(berthZoneGeo, berthMat);
      berthMesh.position.set(18, 1, -100);
      this.scene.add(berthMesh);
      this.harborObjects.push(berthMesh);
      this.berthMesh = berthMesh;
      this.berthBox.setFromCenterAndSize(berthMesh.position, new THREE.Vector3(50, 15, 140));

      // Pier yellow hazard stripe
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(4, 1, 140), yellowStripeMat);
      stripe.position.set(-16, 12.1, -100);
      addBuilding(stripe, false);

      // Stacks of containers
      for (let i = 0; i < 24; i++) {
        const x = i % 2 === 0 ? -145 : 145;
        const z = -140 + Math.floor(i / 2) * 25;
        addContainerStack(x, 18, z);
      }

      this.createBuoy(-75, 190, 0xff4757);
      this.createBuoy(75, 190, 0x2ed573);
      this.createBuoy(-75, 70, 0xff4757);
      this.createBuoy(75, 70, 0x2ed573);

    } else if (layout === 'angled') {
      // --- LAYOUT 2: TRICKY ANGLED 90° CANAL BASIN (London, New York, Panama) ---
      // Left Breakwater Pier
      const pierL = new THREE.Mesh(new THREE.BoxGeometry(40, 15, 360), concreteMat);
      pierL.position.set(-145, 7.5, 0);
      addBuilding(pierL);

      // Dead-End Transverse Seawall directly ahead! Ship must turn into lateral canal
      const deadEndQuay = new THREE.Mesh(new THREE.BoxGeometry(240, 16, 60), concreteMat);
      deadEndQuay.position.set(-30, 8, -40);
      addBuilding(deadEndQuay);

      // Right entrance breakwater
      const pierR = new THREE.Mesh(new THREE.BoxGeometry(40, 15, 180), concreteMat);
      pierR.position.set(145, 7.5, 110);
      addBuilding(pierR);

      // Lateral Basin North Wall
      const basinNorth = new THREE.Mesh(new THREE.BoxGeometry(180, 15, 40), concreteMat);
      basinNorth.position.set(160, 7.5, -40);
      addBuilding(basinNorth);

      // Lateral Basin East Wall (End of basin)
      const basinEast = new THREE.Mesh(new THREE.BoxGeometry(40, 15, 140), concreteMat);
      basinEast.position.set(240, 7.5, 20);
      addBuilding(basinEast);

      // Lateral Basin Finger Pier
      const fingerPier = new THREE.Mesh(new THREE.BoxGeometry(130, 12, 24), woodMat);
      fingerPier.position.set(125, 6, -10);
      addBuilding(fingerPier);

      // Berth is inside the East-West lateral basin! Target heading: East (+X)
      const berthZoneGeo = new THREE.BoxGeometry(130, 1, 48);
      const berthMat = new THREE.MeshBasicMaterial({
        color: 0x2ed573,
        transparent: true,
        opacity: 0.35,
        wireframe: true
      });
      const berthMesh = new THREE.Mesh(berthZoneGeo, berthMat);
      berthMesh.position.set(125, 1, 26);
      this.scene.add(berthMesh);
      this.harborObjects.push(berthMesh);
      this.berthMesh = berthMesh;
      this.berthBox.setFromCenterAndSize(berthMesh.position, new THREE.Vector3(130, 15, 48));

      // Container stacks on the dead-end wall
      for (let i = 0; i < 18; i++) {
        const x = -100 + (i % 6) * 22;
        const z = -40 + Math.floor(i / 6) * 12;
        addContainerStack(x, 19, z);
      }

      // Warning marker buoys directing turn into canal
      this.createBuoy(-75, 170, 0xff4757);
      this.createBuoy(75, 170, 0x2ed573);
      this.createBuoy(-75, 30, 0xff4757);
      this.createBuoy(20, 20, 0xf7b731); // Yellow turn pivot buoy
      this.createBuoy(65, -15, 0x2ed573);

    } else {
      // --- LAYOUT 3: TRICKY FAIRWAY OBSTACLE SLALOM (Singapore, Tokyo, etc.) ---
      // Left Breakwater Pier
      const pierL = new THREE.Mesh(new THREE.BoxGeometry(40, 15, 360), concreteMat);
      pierL.position.set(-155, 7.5, 0);
      addBuilding(pierL);

      // Right Breakwater Pier
      const pierR = new THREE.Mesh(new THREE.BoxGeometry(40, 15, 360), concreteMat);
      pierR.position.set(155, 7.5, 0);
      addBuilding(pierR);

      // CENTRAL ISLAND BARRIER & DREDGING CRANE directly in the middle of fairway
      const islandBarrier = new THREE.Mesh(new THREE.BoxGeometry(48, 16, 90), concreteMat);
      islandBarrier.position.set(0, 8, 50);
      addBuilding(islandBarrier);

      // Crane tower on central island
      const craneTower = new THREE.Mesh(
        new THREE.CylinderGeometry(4, 5, 26, 8),
        new THREE.MeshStandardMaterial({ color: 0xffa502 })
      );
      craneTower.position.set(0, 24, 50);
      addBuilding(craneTower);

      // End Terminal Quay Wall
      const endQuay = new THREE.Mesh(new THREE.BoxGeometry(350, 15, 60), concreteMat);
      endQuay.position.set(0, 7.5, -210);
      addBuilding(endQuay);

      // Sheltered Inner Berth Pier on Port side behind the island
      const innerPier = new THREE.Mesh(new THREE.BoxGeometry(26, 12, 140), woodMat);
      innerPier.position.set(-75, 6, -110);
      addBuilding(innerPier);

      // Berth zone nestled behind island
      const berthZoneGeo = new THREE.BoxGeometry(48, 1, 130);
      const berthMat = new THREE.MeshBasicMaterial({
        color: 0x2ed573,
        transparent: true,
        opacity: 0.35,
        wireframe: true
      });
      const berthMesh = new THREE.Mesh(berthZoneGeo, berthMat);
      berthMesh.position.set(-30, 1, -110);
      this.scene.add(berthMesh);
      this.harborObjects.push(berthMesh);
      this.berthMesh = berthMesh;
      this.berthBox.setFromCenterAndSize(berthMesh.position, new THREE.Vector3(48, 15, 130));

      // Container stacks on island and outer piers
      for (let i = 0; i < 6; i++) {
        addContainerStack(-12 + (i % 2) * 24, 19, 35 + Math.floor(i / 2) * 22);
      }
      for (let i = 0; i < 16; i++) {
        const x = i % 2 === 0 ? -155 : 155;
        const z = -120 + Math.floor(i / 2) * 25;
        addContainerStack(x, 19, z);
      }

      // Slalom channel buoys
      this.createBuoy(-95, 190, 0xff4757);
      this.createBuoy(95, 190, 0x2ed573);
      this.createBuoy(-40, 105, 0xff4757);
      this.createBuoy(40, 105, 0x2ed573);
      this.createBuoy(-40, -5, 0xff4757);
      this.createBuoy(40, -5, 0x2ed573);
    }

    // Lighthouse Tower (Universal maritime landmark)
    const lhBase = new THREE.Mesh(new THREE.CylinderGeometry(10, 14, 48, 16), concreteMat);
    lhBase.position.set(-180, 24, -140);
    addBuilding(lhBase);

    const lhTop = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 8, 16), new THREE.MeshStandardMaterial({ color: 0xff4757 }));
    lhTop.position.set(-180, 52, -140);
    addBuilding(lhTop);
  }

  private createBuoy(x: number, z: number, color: number) {
    const buoyGroup = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(2, 3, 7, 8), new THREE.MeshStandardMaterial({ color }));
    body.position.y = 2;
    body.castShadow = true;
    buoyGroup.add(body);

    const light = new THREE.PointLight(color, 2.5, 45);
    light.position.y = 6;
    buoyGroup.add(light);

    buoyGroup.position.set(x, 0, z);
    this.scene.add(buoyGroup);
    this.harborObjects.push(buoyGroup);
    this.colliders.push(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(x, 2, z), new THREE.Vector3(6, 8, 6)));
  }

  private onResize = () => {
    if (!this.container) return;
    this.camera.aspect = this.container.clientWidth / (this.container.clientHeight || 1);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
  };

  private setupOnScreenControls() {
    const hudControls = document.querySelector('.hud-controls');
    if (hudControls && !document.getElementById('hud-steering-pad')) {
      const pad = document.createElement('div');
      pad.id = 'hud-steering-pad';
      pad.style.display = 'flex';
      pad.style.gap = '6px';
      pad.style.alignItems = 'center';

      pad.innerHTML = `
        <button id="btn-dock-port" class="btn btn-secondary btn-sm" title="Turn Port (Left)">◄ PORT</button>
        <button id="btn-dock-mid" class="btn btn-secondary btn-sm" title="Center Rudder">MID</button>
        <button id="btn-dock-stbd" class="btn btn-secondary btn-sm" title="Turn Starboard (Right)">STBD ►</button>
        <span style="border-left: 1px solid rgba(255,255,255,0.2); height: 20px; margin: 0 4px;"></span>
        <button id="btn-dock-faster" class="btn btn-primary btn-sm" title="Throttle Ahead">▲ AHEAD</button>
        <button id="btn-dock-stop" class="btn btn-warning btn-sm" title="Engine Stop (Coast)">◼ STOP</button>
        <button id="btn-dock-slower" class="btn btn-primary btn-sm" title="Throttle Astern (Brake)">▼ ASTERN</button>
      `;
      hudControls.insertBefore(pad, hudControls.firstChild);

      const btnPort = document.getElementById('btn-dock-port');
      btnPort?.addEventListener('mousedown', () => { this.activeKeys.add('a'); });
      btnPort?.addEventListener('mouseup', () => { this.activeKeys.delete('a'); });
      btnPort?.addEventListener('mouseleave', () => { this.activeKeys.delete('a'); });
      btnPort?.addEventListener('touchstart', (e) => { e.preventDefault(); this.activeKeys.add('a'); });
      btnPort?.addEventListener('touchend', () => { this.activeKeys.delete('a'); });
      btnPort?.addEventListener('click', () => {
        this.targetRudderAngle = Math.max(-35, this.targetRudderAngle - 10);
        this.updateHud();
      });

      const btnMid = document.getElementById('btn-dock-mid');
      btnMid?.addEventListener('click', () => {
        this.targetRudderAngle = 0;
        this.updateHud();
      });

      const btnStbd = document.getElementById('btn-dock-stbd');
      btnStbd?.addEventListener('mousedown', () => { this.activeKeys.add('d'); });
      btnStbd?.addEventListener('mouseup', () => { this.activeKeys.delete('d'); });
      btnStbd?.addEventListener('mouseleave', () => { this.activeKeys.delete('d'); });
      btnStbd?.addEventListener('touchstart', (e) => { e.preventDefault(); this.activeKeys.add('d'); });
      btnStbd?.addEventListener('touchend', () => { this.activeKeys.delete('d'); });
      btnStbd?.addEventListener('click', () => {
        this.targetRudderAngle = Math.min(35, this.targetRudderAngle + 10);
        this.updateHud();
      });

      document.getElementById('btn-dock-faster')?.addEventListener('click', () => {
        this.throttleSetting = Math.min(4, this.throttleSetting + 1);
        this.updateHud();
        sounds.setEngineThrottle(Math.abs(this.throttleSetting) * 25);
      });
      document.getElementById('btn-dock-stop')?.addEventListener('click', () => {
        this.throttleSetting = 0;
        this.updateHud();
        sounds.setEngineThrottle(0);
      });
      document.getElementById('btn-dock-slower')?.addEventListener('click', () => {
        this.throttleSetting = Math.max(-3, this.throttleSetting - 1);
        this.updateHud();
        sounds.setEngineThrottle(Math.abs(this.throttleSetting) * 25);
      });
    }
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (this.isDocked) return;

    const key = e.key.toLowerCase();
    const code = e.code;

    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
      e.preventDefault();
    }

    if (key === 'a' || code === 'KeyA' || e.key === 'ArrowLeft') {
      this.activeKeys.add('a');
    }
    if (key === 'd' || code === 'KeyD' || e.key === 'ArrowRight') {
      this.activeKeys.add('d');
    }

    if (key === 'w' || code === 'KeyW' || e.key === 'ArrowUp') {
      this.throttleSetting = Math.min(4, this.throttleSetting + 1);
      this.updateHud();
      sounds.setEngineThrottle(Math.abs(this.throttleSetting) * 25);
    } else if (key === 's' || code === 'KeyS' || e.key === 'ArrowDown') {
      this.throttleSetting = Math.max(-3, this.throttleSetting - 1);
      this.updateHud();
      sounds.setEngineThrottle(Math.abs(this.throttleSetting) * 25);
    } else if (e.key === ' ') {
      // Emergency All Stop & Rudder Midships
      this.throttleSetting = 0;
      this.targetRudderAngle = 0;
      this.activeKeys.clear();
      this.updateHud();
      sounds.setEngineThrottle(0);
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
    port: Port | { id: string; name: string },
    shipName: string = 'MY VESSEL',
    shipType: string = 'freighter',
    playerColor: string = '#00d2ff'
  ) {
    this.isDocked = false;
    this.hullDamage = 0;
    this.throttleSetting = 1; // Dead Slow Ahead
    this.targetRudderAngle = 0;
    this.rudderAngle = 0;
    this.currentYawRateRad = 0;
    this.currentSpeedKnots = 1.8;
    this.shipHeadingRad = 0; // Pointing North (towards -Z)
    this.shipPos.set(0, 0, 310);
    this.activeKeys.clear();

    const layoutType = getHarborLayoutType(port.id);
    this.buildHarborLayout(layoutType);

    // Build specific 3D model matching the vessel blueprint and player color
    if (this.shipGroup) {
      this.scene.remove(this.shipGroup);
      this.shipGroup = null;
    }
    this.shipGroup = buildShip3DModel(shipType, playerColor);
    this.shipGroup.position.copy(this.shipPos);
    this.scene.add(this.shipGroup);

    // Update Port & Layout HUD Display
    const portElem = document.getElementById('docking-port-name');
    if (portElem) {
      const layoutBadge =
        layoutType === 'angled'
          ? ' [TRICKY: 90° LATERAL CANAL]'
          : layoutType === 'obstacle'
          ? ' [TRICKY: FAIRWAY SLALOM]'
          : ' [STRAIGHT FAIRWAY]';
      portElem.innerHTML = `${port.name.toUpperCase()} <span style="font-size: 0.75rem; color: #ffa502;">${layoutBadge}</span>`;
    }

    const shipElem = document.getElementById('docking-ship-name');
    if (shipElem) {
      shipElem.innerHTML = `
        <span style="color: ${playerColor}; font-weight: 700;">${shipName.toUpperCase()}</span>
        <span style="font-size: 0.75rem; color: #90b0d0;"> (${shipType.toUpperCase().replace('_', ' ')})</span>
      `;
    }

    // Hide any previous berth prompt
    const prompt = document.getElementById('docking-berth-prompt');
    if (prompt) prompt.style.display = 'none';

    if (!this.isListening) {
      window.addEventListener('keydown', this.onKeyDown);
      window.addEventListener('keyup', this.onKeyUp);
      this.isListening = true;
    }

    sounds.playFoghorn();
    sounds.setEngineThrottle(25);
    this.updateHud();

    let lastTime = performance.now();
    const animate = (time: number) => {
      const dt = Math.min(0.1, (time - lastTime) / 1000);
      lastTime = time;

      this.updateSimulation(dt, time);
      this.renderer.render(this.scene, this.camera);

      if (!this.isDocked) {
        this.animFrameId = requestAnimationFrame(animate);
      }
    };
    this.animFrameId = requestAnimationFrame(animate);
  }

  private updateSimulation(dt: number, time: number) {
    if (!this.shipGroup) return;

    // 1. Natural Steering & Hydraulic Rudder Control
    // Realistic hydraulic steering gear rate (~22 degrees per second)
    const hydraulicRate = 22 * dt;

    if (this.activeKeys.has('a')) {
      // Helmsman applying Port helm
      this.targetRudderAngle = Math.max(-35, this.targetRudderAngle - 28 * dt);
    } else if (this.activeKeys.has('d')) {
      // Helmsman applying Starboard helm
      this.targetRudderAngle = Math.min(35, this.targetRudderAngle + 28 * dt);
    } else {
      // When helm is released, rudder eases gently toward midships
      if (Math.abs(this.targetRudderAngle) > 0.5) {
        this.targetRudderAngle -= Math.sign(this.targetRudderAngle) * 12 * dt;
      } else {
        this.targetRudderAngle = 0;
      }
    }

    // Actual hydraulic rudder moves toward commanded target angle
    const rudderDiff = this.targetRudderAngle - this.rudderAngle;
    if (Math.abs(rudderDiff) > 0.1) {
      this.rudderAngle += Math.sign(rudderDiff) * Math.min(Math.abs(rudderDiff), hydraulicRate);
    } else {
      this.rudderAngle = this.targetRudderAngle;
    }

    // 2. Natural Propulsion & Realistic Inertia
    // Throttle settings:
    // -3: Full Astern (-4.5 kts)
    // -2: Slow Astern (-2.6 kts)
    // -1: Dead Slow Astern (-1.2 kts)
    //  0: STOP (0.0 kts - coasting)
    // +1: Dead Slow Ahead (1.6 kts)
    // +2: Slow Ahead (3.2 kts)
    // +3: Half Ahead (5.5 kts)
    // +4: Full Ahead (8.5 kts)
    const targetSpeeds = [-4.5, -2.6, -1.2, 0, 1.6, 3.2, 5.5, 8.5];
    const targetSpeed = targetSpeeds[this.throttleSetting + 3];

    if (this.throttleSetting === 0) {
      // Natural water hydrodynamic drag: vessel gently coasts to a stop
      const waterDrag = Math.sign(this.currentSpeedKnots) * Math.min(Math.abs(this.currentSpeedKnots), 0.3 * dt);
      this.currentSpeedKnots -= waterDrag;
    } else if (this.throttleSetting < 0 && this.currentSpeedKnots > 0) {
      // ACTIVE REVERSE BRAKING: Propeller wash in reverse exerts powerful braking force!
      const brakeForce = (Math.abs(this.throttleSetting) * 1.5 + 0.8) * dt;
      this.currentSpeedKnots = Math.max(targetSpeed, this.currentSpeedKnots - brakeForce);
    } else if (this.throttleSetting > 0 && this.currentSpeedKnots < 0) {
      // Forward thrust braking backwards motion
      const brakeForce = (this.throttleSetting * 1.5 + 0.8) * dt;
      this.currentSpeedKnots = Math.min(targetSpeed, this.currentSpeedKnots + brakeForce);
    } else {
      // Normal acceleration with realistic mass inertia
      const accelRate = 0.55 * dt;
      this.currentSpeedKnots += (targetSpeed - this.currentSpeedKnots) * accelRate;
    }

    // 3. Hydrodynamic Turning Physics (Yaw Moment & Rotational Inertia)
    // Turning ability is proportional to water flow speed over rudder (vessel speed + prop wash)
    const propWash = this.throttleSetting > 0 ? this.throttleSetting * 0.35 : 0;
    const effectiveFlowSpeedKnots = Math.abs(this.currentSpeedKnots) + propWash;

    // At dead stop without prop wash, rudder cannot exert turning torque
    let desiredYawRate = 0;
    if (effectiveFlowSpeedKnots > 0.15) {
      const rudderRatio = this.rudderAngle / 35.0;
      // Max steady yaw rate: ~0.032 rad/sec per knot of water flow (smooth, realistic turning circle)
      const yawCapacity = Math.min(0.18, 0.032 * effectiveFlowSpeedKnots);
      // When backing astern, stern kicks opposite direction
      const flowDir = this.currentSpeedKnots >= -0.2 ? 1.0 : -1.0;
      desiredYawRate = rudderRatio * yawCapacity * flowDir;
    }

    // ROTATIONAL INERTIA: Ship's massive displacement resists instant turning!
    // Angular acceleration gradually accelerates / decelerates the yaw rate
    const yawInertiaCoeff = 1.35 * dt;
    this.currentYawRateRad += (desiredYawRate - this.currentYawRateRad) * Math.min(1.0, yawInertiaCoeff);

    // Natural water rotational damping prevents runaway spin when rudder is centered
    if (Math.abs(this.rudderAngle) < 1.0 && Math.abs(desiredYawRate) < 0.005) {
      this.currentYawRateRad -= this.currentYawRateRad * 0.45 * dt;
      if (Math.abs(this.currentYawRateRad) < 0.001) {
        this.currentYawRateRad = 0;
      }
    }

    // Apply smooth heading change
    this.shipHeadingRad += this.currentYawRateRad * dt;

    // 4. Movement Vector with Hydrodynamic Turning Drift (Sideslip)
    const forwardX = Math.sin(this.shipHeadingRad);
    const forwardZ = -Math.cos(this.shipHeadingRad);

    const windPushX = Math.sin(this.windDirRad) * (this.windSpeedKnots * 0.012);
    const windPushZ = Math.cos(this.windDirRad) * (this.windSpeedKnots * 0.012);

    // Lateral leeway / drift: stern kicks out during turn
    const driftX = -forwardZ * (this.currentYawRateRad * 5.5);
    const driftZ = forwardX * (this.currentYawRateRad * 5.5);

    const speedUnitsPerSec = this.currentSpeedKnots * 3.2;
    this.shipPos.x += (forwardX * speedUnitsPerSec + driftX + windPushX) * dt;
    this.shipPos.z += (forwardZ * speedUnitsPerSec + driftZ + windPushZ) * dt;

    // 5. Update Ship 3D Transform
    this.shipGroup.position.copy(this.shipPos);
    this.shipGroup.rotation.y = -this.shipHeadingRad;
    // Roll/heel into turn: subtle centrifugal roll + wave bobbing
    const turnHeel = this.currentYawRateRad * 0.16;
    this.shipGroup.rotation.z = Math.sin(time * 0.002) * 0.018 - turnHeel;
    this.shipGroup.rotation.x = Math.cos(time * 0.0015) * 0.012;

    // 6. Lighthouse Rotation
    if (this.lighthouseBeam) {
      const beamAngle = time * 0.0012;
      this.lighthouseBeam.target.position.set(
        -180 + Math.cos(beamAngle) * 350,
        10,
        -140 + Math.sin(beamAngle) * 350
      );
    }

    // 7. Dynamic Camera Following Smoothly Behind the Vessel
    const camDistance = 130;
    const camHeight = 56;
    const targetCamX = this.shipPos.x - forwardX * camDistance;
    const targetCamZ = this.shipPos.z - forwardZ * camDistance;
    this.camera.position.lerp(new THREE.Vector3(targetCamX, camHeight, targetCamZ), 0.15);
    this.camera.lookAt(this.shipPos.x + forwardX * 35, 10, this.shipPos.z + forwardZ * 35);

    // 8. Collision Detection with Piers & Obstacles
    const shipBox = new THREE.Box3().setFromCenterAndSize(
      this.shipPos,
      new THREE.Vector3(20, 10, 80)
    );

    for (const collider of this.colliders) {
      if (shipBox.intersectsBox(collider)) {
        const impactSpeed = Math.abs(this.currentSpeedKnots);
        if (impactSpeed > 0.6) {
          const dmg = Math.min(25, Math.round(impactSpeed * 3.5));
          this.hullDamage += dmg;
          sounds.playImpact();
          // Rebound from pier
          this.currentSpeedKnots *= -0.3;
          this.shipPos.x -= forwardX * 6;
          this.shipPos.z -= forwardZ * 6;
          this.updateHud();
        }
      }
    }

    // 9. Berthing Check inside Designated Berth Zone:
    // USER MUST STOP THE SHIP TO FINISH THE DOCKING!
    const prompt = document.getElementById('docking-berth-prompt');
    const insideBerth = this.berthBox.containsPoint(this.shipPos);

    if (insideBerth) {
      // Check alignment based on layout type:
      // In straight/obstacle layout: slipway is along North/South axis (heading ~0 rad)
      // In angled layout: slipway is along East/West axis (heading ~±90 deg)
      let isAligned = false;
      if (this.currentLayout === 'angled') {
        isAligned = Math.abs(Math.sin(this.shipHeadingRad)) > 0.82;
      } else {
        isAligned = Math.abs(Math.sin(this.shipHeadingRad)) < 0.42;
      }

      const absSpeed = Math.abs(this.currentSpeedKnots);

      if (isAligned) {
        if (absSpeed > 0.20) {
          // In berth but moving too fast: Prompt user to reverse propulsion to stop!
          if (prompt) {
            prompt.style.display = 'block';
            prompt.style.color = '#ffa502';
            prompt.style.borderColor = '#ffa502';
            prompt.innerHTML = `⚠️ IN BERTH ZONE — REVERSE PROPULSION TO STOP VESSEL (${absSpeed.toFixed(1)} KTS)!`;
          }
        } else {
          // VESSEL IS STOPPED: Complete successful docking!
          if (prompt) {
            prompt.style.display = 'block';
            prompt.style.color = '#2ed573';
            prompt.style.borderColor = '#2ed573';
            prompt.innerHTML = `✅ VESSEL STOPPED (0.0 KTS) — SECURING MOORING LINES...`;
          }
          this.triggerDockingSuccess();
        }
      } else {
        if (prompt) {
          prompt.style.display = 'block';
          prompt.style.color = '#ff4757';
          prompt.style.borderColor = '#ff4757';
          prompt.innerHTML = `⚠️ ALIGN VESSEL PARALLEL TO PIER TO BERTH!`;
        }
      }
    } else {
      if (prompt) prompt.style.display = 'none';
    }

    this.updateHud();
  }

  private triggerDockingSuccess() {
    this.isDocked = true;
    sounds.stopEngine();
    sounds.playBell();
    sounds.playCash();
    sounds.playFanfare();

    const score = Math.max(0, 100 - this.hullDamage * 2);
    const resultModal = document.getElementById('docking-result-modal');
    const breakdown = document.getElementById('docking-breakdown');

    if (resultModal && breakdown) {
      breakdown.innerHTML = `
        <div>Berth Precision: <strong>100% (Dead Stop)</strong></div>
        <div>Impact Hull Damage: <strong style="color: ${this.hullDamage > 0 ? '#ff4757' : '#2ed573'}">${this.hullDamage}%</strong></div>
        <div>Docking Rating: <strong>${score} / 100 PTS</strong></div>
      `;
      resultModal.classList.remove('hidden');
    }

    const confirmBtn = document.getElementById('btn-docking-confirm');
    if (confirmBtn) {
      confirmBtn.onclick = () => {
        resultModal?.classList.add('hidden');
        this.stop();
        this.onComplete({
          score,
          damagePercent: this.hullDamage,
          success: true
        });
      };
    }
  }

  private updateHud() {
    const speedEl = document.getElementById('docking-speed');
    if (speedEl) {
      const absSpeed = Math.abs(this.currentSpeedKnots);
      const dirText = this.currentSpeedKnots > 0.05 ? 'AHEAD' : this.currentSpeedKnots < -0.05 ? 'ASTERN' : 'STOPPED';
      speedEl.textContent = `${absSpeed.toFixed(1)} kts (${dirText})`;
    }

    const rudderEl = document.getElementById('docking-rudder');
    if (rudderEl) {
      const rounded = Math.round(this.rudderAngle);
      const targetRounded = Math.round(this.targetRudderAngle);
      const dir = rounded < 0 ? 'PORT' : rounded > 0 ? 'STBD' : 'MID';

      const swingDegPerSec = Math.abs(this.currentYawRateRad * (180 / Math.PI)).toFixed(1);
      const isSwinging = Math.abs(this.currentYawRateRad) > 0.004;
      const swingText = isSwinging
        ? (this.currentYawRateRad < 0 ? ` ◄ ${swingDegPerSec}°/s` : ` ► ${swingDegPerSec}°/s`)
        : '';

      rudderEl.textContent = `${Math.abs(rounded)}° ${dir} (SET: ${Math.abs(targetRounded)}°)${swingText}`;
      rudderEl.style.color = rounded < 0 ? '#ff4757' : rounded > 0 ? '#2ed573' : '#00d2ff';
    }

    const throttleNames = [
      'FULL ASTERN',
      'SLOW ASTERN',
      'DEAD SLOW ASTERN',
      'STOP',
      'DEAD SLOW AHEAD',
      'SLOW AHEAD',
      'HALF AHEAD',
      'FULL AHEAD'
    ];
    const throttleEl = document.getElementById('docking-throttle');
    if (throttleEl) {
      throttleEl.textContent = throttleNames[this.throttleSetting + 3];
      throttleEl.style.color = this.throttleSetting < 0 ? '#ff4757' : this.throttleSetting > 0 ? '#2ed573' : '#ffa502';
    }

    const fill = document.getElementById('docking-hull-fill');
    if (fill) {
      const integrity = Math.max(0, 100 - this.hullDamage);
      fill.style.width = `${integrity}%`;
      fill.style.backgroundColor = integrity > 60 ? '#2ed573' : integrity > 30 ? '#ffa502' : '#ff4757';
    }
  }

  public stop() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    sounds.stopEngine();
    this.activeKeys.clear();
    const prompt = document.getElementById('docking-berth-prompt');
    if (prompt) prompt.style.display = 'none';

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
