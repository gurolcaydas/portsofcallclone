import { Port, WORLD_PORTS, GameState, PlayerShip, PlayerCompany, SHIP_BLUEPRINTS } from '@portofcall/shared';
import { sounds } from '../sound/SoundManager.js';

interface RenderedShipTarget {
  ship: PlayerShip;
  player: PlayerCompany;
  x: number;
  y: number;
  radius: number;
}

export class WorldMap {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private onPortClick: (port: Port) => void;
  private onShipClick?: (ship: PlayerShip, player: PlayerCompany) => void;

  private hoveredPort: Port | null = null;
  private hoveredShip: RenderedShipTarget | null = null;
  private selectedShipId: string | null = null;

  private currentState: GameState | null = null;
  private myPlayerId: string | null = null;
  private filterMode: 'all' | 'mine' = 'all';

  private animFrameId: number | null = null;
  private renderedShips: RenderedShipTarget[] = [];
  private tooltipEl: HTMLElement | null = null;

  // Normalized coordinate reference: width 1000, height 550
  private readonly REF_W = 1000;
  private readonly REF_H = 550;

  constructor(
    canvasId: string,
    onPortClick: (port: Port) => void,
    onShipClick?: (ship: PlayerShip, player: PlayerCompany) => void
  ) {
    this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d')!;
    this.onPortClick = onPortClick;
    this.onShipClick = onShipClick;
    this.tooltipEl = document.getElementById('map-tactical-tooltip');

    this.setupResize();
    this.setupEvents();
    this.setupFilterButtons();
    this.startLoop();
  }

  public resize = () => {
    const parent = this.canvas.parentElement;
    if (parent && parent.clientWidth > 0 && parent.clientHeight > 0) {
      const dpr = window.devicePixelRatio || 1;
      const targetW = Math.round(parent.clientWidth * dpr);
      const targetH = Math.round(parent.clientHeight * dpr);

      if (this.canvas.width !== targetW || this.canvas.height !== targetH) {
        this.canvas.width = targetW;
        this.canvas.height = targetH;
      }
    }
  };

  private setupResize() {
    window.addEventListener('resize', this.resize);

    if (typeof ResizeObserver !== 'undefined' && this.canvas.parentElement) {
      const ro = new ResizeObserver(() => {
        this.resize();
      });
      ro.observe(this.canvas.parentElement);
    }
    this.resize();
  }

  private setupFilterButtons() {
    const btnAll = document.getElementById('btn-map-filter-all');
    const btnMine = document.getElementById('btn-map-filter-mine');

    btnAll?.addEventListener('click', () => {
      this.filterMode = 'all';
      btnAll.classList.add('active');
      btnMine?.classList.remove('active');
      sounds.playBell();
    });

    btnMine?.addEventListener('click', () => {
      this.filterMode = 'mine';
      btnMine.classList.add('active');
      btnAll?.classList.remove('active');
      sounds.playBell();
    });
  }

  private getHitTarget(clientX: number, clientY: number, isTouch = false): { ship: RenderedShipTarget | null; port: Port | null; mouseX: number; mouseY: number } {
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = clientX - rect.left;
    const mouseY = clientY - rect.top;

    const scaleX = rect.width / this.REF_W;
    const scaleY = rect.height / this.REF_H;

    // Generous touch tolerance on mobile fingers
    const shipTolerance = isTouch ? 16 : 6;
    const portTolerance = isTouch ? 28 : 18;

    // 1. Hit-test sailing vessels first
    let hitShip: RenderedShipTarget | null = null;
    for (const rs of this.renderedShips) {
      const dist = Math.hypot(mouseX - rs.x, mouseY - rs.y);
      if (dist <= rs.radius + shipTolerance) {
        hitShip = rs;
        break;
      }
    }

    // 2. Hit-test ports
    let hitPort: Port | null = null;
    if (!hitShip) {
      for (const p of WORLD_PORTS) {
        const px = p.x * scaleX;
        const py = p.y * scaleY;
        const dist = Math.hypot(mouseX - px, mouseY - py);
        if (dist < portTolerance) {
          hitPort = p;
          break;
        }
      }
    }

    return { ship: hitShip, port: hitPort, mouseX, mouseY };
  }

  private setupEvents() {
    this.canvas.addEventListener('mousemove', (e) => {
      const hit = this.getHitTarget(e.clientX, e.clientY, false);
      this.hoveredShip = hit.ship;
      this.hoveredPort = hit.port;
      this.canvas.style.cursor = hit.ship || hit.port ? 'pointer' : 'default';

      this.updateTooltip(hit.mouseX, hit.mouseY);
    });

    this.canvas.addEventListener('mouseleave', () => {
      this.hoveredShip = null;
      this.hoveredPort = null;
      if (this.tooltipEl) {
        this.tooltipEl.classList.add('hidden');
      }
    });

    this.canvas.addEventListener('click', (e) => {
      const hit = this.getHitTarget(e.clientX, e.clientY, false);
      if (hit.ship) {
        this.selectedShipId = hit.ship.ship.id;
        sounds.playBell();
        if (this.onShipClick) {
          this.onShipClick(hit.ship.ship, hit.ship.player);
        }
      } else if (hit.port) {
        this.onPortClick(hit.port);
      }
    });

    // Touch support for cellphones and tablets
    this.canvas.addEventListener('touchend', (e) => {
      if (e.changedTouches.length > 0) {
        const touch = e.changedTouches[0];
        const hit = this.getHitTarget(touch.clientX, touch.clientY, true);
        if (hit.ship) {
          e.preventDefault();
          this.selectedShipId = hit.ship.ship.id;
          sounds.playBell();
          if (this.onShipClick) {
            this.onShipClick(hit.ship.ship, hit.ship.player);
          }
        } else if (hit.port) {
          e.preventDefault();
          this.onPortClick(hit.port);
        }
      }
    });
  }

  private setTooltipPosition(mouseX: number, mouseY: number) {
    if (!this.tooltipEl) return;
    const rect = this.canvas.getBoundingClientRect();
    const halfWidth = 140;
    const clampX = Math.max(halfWidth + 8, Math.min(rect.width - halfWidth - 8, mouseX));
    const clampY = Math.max(130, mouseY);
    this.tooltipEl.style.left = `${clampX}px`;
    this.tooltipEl.style.top = `${clampY}px`;
  }

  private updateTooltip(mouseX: number, mouseY: number) {
    if (!this.tooltipEl) return;

    if (this.hoveredShip) {
      const { ship, player } = this.hoveredShip;
      const bp = SHIP_BLUEPRINTS.find((b) => b.id === ship.blueprintId) || SHIP_BLUEPRINTS[0];
      const origin = WORLD_PORTS.find((p) => p.id === ship.currentVoyage?.originPortId)?.name || 'Port';
      const dest = WORLD_PORTS.find((p) => p.id === ship.currentVoyage?.destinationPortId)?.name || 'Port';
      const progress = ship.currentVoyage?.progressPercent || 0;

      const isMyShip = player.id === this.myPlayerId;

      this.tooltipEl.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 4px;">
          <strong style="color: #fff; font-size: 0.95rem; font-family: 'Chakra Petch', sans-serif;">🚢 ${ship.name}</strong>
          ${isMyShip ? '<span style="font-size: 0.65rem; background: #00d2ff; color: #040912; font-weight: 800; padding: 1px 5px; border-radius: 4px;">YOUR FLEET</span>' : ''}
        </div>
        <div style="font-size: 0.76rem; color: ${player.color}; font-weight: 700; margin-bottom: 6px;">
          🏢 ${player.name}
        </div>
        <div style="font-size: 0.78rem; color: #ffa502; font-weight: 600; margin-bottom: 6px;">
          ${origin} ➔ ${dest} (${progress}%)
        </div>
        <div style="font-size: 0.74rem; color: #a0c0e0; display: flex; flex-direction: column; gap: 3px;">
          <div>Vessel Class: <strong style="color: #fff;">${bp.name}</strong> (${bp.capacityTons.toLocaleString()}t DWT)</div>
          <div>Cargo: <strong style="color: #2ed573;">${ship.cargo ? `${ship.cargo.tonnage.toLocaleString()}t ${ship.cargo.commodity}` : 'Empty Holds'}</strong></div>
          <div>Condition: Hull <strong style="color: #fff;">${ship.hullCondition}%</strong> • Engine <strong style="color: #fff;">${ship.engineCondition}%</strong></div>
          <div>Bunkers: <strong style="color: #ffa502;">${Math.round(ship.fuelTons)}t</strong> / ${bp.fuelCapacityTons}t</div>
        </div>
      `;
      this.setTooltipPosition(mouseX, mouseY);
      this.tooltipEl.classList.remove('hidden');
      return;
    }

    if (this.hoveredPort) {
      const port = this.hoveredPort;
      const dockedShips: Array<{ ship: PlayerShip; player: PlayerCompany }> = [];

      for (const pId in this.currentState?.players) {
        const player = this.currentState.players[pId];
        for (const ship of player.ships) {
          if (ship.status === 'docked' && ship.currentPortId === port.id) {
            dockedShips.push({ ship, player });
          }
        }
      }

      const fuelPrice = this.currentState?.bunkerPrices[port.id] || port.fuelPricePerTon;

      let berthedHtml = '';
      if (dockedShips.length > 0) {
        berthedHtml = `
          <div style="margin-top: 8px; border-top: 1px solid rgba(255, 255, 255, 0.12); padding-top: 6px;">
            <div style="font-size: 0.72rem; color: #00d2ff; font-weight: 700; margin-bottom: 4px;">
              ⚓ BERTHED VESSELS (${dockedShips.length}):
            </div>
            ${dockedShips.map((ds) => `
              <div style="font-size: 0.72rem; color: #e2f0fc; display: flex; align-items: center; gap: 4px; margin-bottom: 2px;">
                <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: ${ds.player.color};"></span>
                <strong>${ds.ship.name}</strong>
                <span style="color: #8da4be;">(${ds.player.name})</span>
              </div>
            `).join('')}
          </div>
        `;
      }

      const catBadge = port.category === 'passenger'
        ? '<span style="background: rgba(255,107,129,0.2); color: #ff6b81; border: 1px solid #ff6b81; font-size: 0.65rem; padding: 1px 5px; border-radius: 3px; font-weight: 700;">🚢 CRUISE & PASSENGER HUB</span>'
        : port.category === 'mixed'
        ? '<span style="background: rgba(0,210,255,0.15); color: #00d2ff; border: 1px solid #00d2ff; font-size: 0.65rem; padding: 1px 5px; border-radius: 3px; font-weight: 700;">⚓ COMMERCIAL & PASSENGER</span>'
        : '<span style="background: rgba(46,213,115,0.15); color: #2ed573; border: 1px solid #2ed573; font-size: 0.65rem; padding: 1px 5px; border-radius: 3px; font-weight: 700;">📦 FREIGHT MEGA-PORT</span>';

      const throughputStr = [
        port.annualCargoTonnageMillions ? `${port.annualCargoTonnageMillions}M tons` : '',
        port.annualPassengersThousands ? `${(port.annualPassengersThousands / 1000).toFixed(1)}M passengers` : ''
      ].filter(Boolean).join(' • ');

      this.tooltipEl.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 4px;">
          <strong style="color: #fff; font-size: 0.95rem; font-family: 'Chakra Petch', sans-serif;">⚓ ${port.name}</strong>
          <span style="font-size: 0.7rem; color: #7f9bb6;">${port.country}</span>
        </div>
        <div style="margin-bottom: 6px;">${catBadge}</div>
        <div style="font-size: 0.74rem; color: #a0c0e0; display: flex; flex-direction: column; gap: 2px;">
          <div>Bunker Fuel: <strong style="color: #ffa502;">$${fuelPrice} / ton</strong></div>
          <div>Drydock Facility: <strong style="color: ${port.hasDrydock ? '#2ed573' : '#ff4757'};">${port.hasDrydock ? 'Available' : 'None'}</strong></div>
          <div>Passenger Terminal: <strong style="color: ${port.hasPassengerTerminal ? '#2ed573' : '#a0c0e0'};">${port.hasPassengerTerminal ? 'Dedicated Terminal 🚢' : 'Cargo Only 📦'}</strong></div>
          <div>Port Berth Fee: <strong style="color: #fff;">$${port.portFeePerCall.toLocaleString()}</strong></div>
          ${throughputStr ? `<div style="font-size: 0.7rem; color: #8da4be; margin-top: 2px;">Annual Volume: <strong style="color: #e2f0fc;">${throughputStr}</strong></div>` : ''}
        </div>
        ${berthedHtml}
        <div style="font-size: 0.68rem; color: #00d2ff; margin-top: 6px; font-style: italic;">
          Click port beacon to open freight exchange & shipyard
        </div>
      `;
      this.setTooltipPosition(mouseX, mouseY);
      this.tooltipEl.classList.remove('hidden');
      return;
    }

    this.tooltipEl.classList.add('hidden');
  }

  public updateState(state: GameState, myPlayerId?: string | null) {
    this.currentState = state;
    if (myPlayerId) this.myPlayerId = myPlayerId;
    this.updateFleetSummary();
  }

  private updateFleetSummary() {
    const summaryEl = document.getElementById('map-fleet-summary');
    if (!summaryEl || !this.currentState) return;

    let underway = 0;
    let berthed = 0;

    for (const pId in this.currentState.players) {
      if (this.filterMode === 'mine' && pId !== this.myPlayerId) continue;
      const player = this.currentState.players[pId];
      for (const ship of player.ships) {
        if (ship.status === 'docked') {
          berthed++;
        } else {
          underway++;
        }
      }
    }

    summaryEl.innerHTML = `<span>🌊 ${underway} Underway • ⚓ ${berthed} Berthed</span>`;
  }

  private startLoop() {
    const render = (time: number) => {
      this.draw(time);
      this.animFrameId = requestAnimationFrame(render);
    };
    this.animFrameId = requestAnimationFrame(render);
  }

  private draw(time: number) {
    const rect = this.canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    // If tab or container is not currently visible (size 0), skip rendering
    if (w <= 0 || h <= 0) return;

    const dpr = window.devicePixelRatio || 1;
    const targetW = Math.round(w * dpr);
    const targetH = Math.round(h * dpr);

    // Auto-sync canvas pixel buffer if dimensions changed or were initially 0
    if (this.canvas.width !== targetW || this.canvas.height !== targetH) {
      this.canvas.width = targetW;
      this.canvas.height = targetH;
    }

    this.ctx.save();
    this.ctx.scale(dpr, dpr);
    this.ctx.clearRect(0, 0, w, h);

    const scaleX = w / this.REF_W;
    const scaleY = h / this.REF_H;

    this.renderedShips = [];

    // 1. Draw Deep Oceanic Backdrop & Tactical Navigational Grid
    this.drawOceanAndGrid(w, h, scaleX, scaleY);

    // 2. Draw High-Fidelity Geographical Continents & Islands
    this.drawContinents(scaleX, scaleY);

    // 3. Draw Maritime Shipping Lanes (faint dotted lines)
    this.drawMajorShippingRoutes(scaleX, scaleY);

    // 4. Draw Active Voyages & Sailing Ships with direction and wakes
    if (this.currentState) {
      this.drawActiveVoyages(scaleX, scaleY, time);
    }

    // 5. Draw Port Beacons and Docked Vessel Badges
    this.drawPorts(scaleX, scaleY, time);

    this.ctx.restore();
  }

  private drawOceanAndGrid(w: number, h: number, scaleX: number, scaleY: number) {
    const ctx = this.ctx;

    // Deep ocean gradient
    const oceanGrad = ctx.createLinearGradient(0, 0, 0, h);
    oceanGrad.addColorStop(0, '#040d1a');
    oceanGrad.addColorStop(0.5, '#07162b');
    oceanGrad.addColorStop(1, '#030a14');
    ctx.fillStyle = oceanGrad;
    ctx.fillRect(0, 0, w, h);

    // Tactical Coordinates Grid (Meridians & Parallels)
    ctx.lineWidth = 1;

    // Longitude Meridians every 30°
    ctx.setLineDash([2, 6]);
    ctx.strokeStyle = 'rgba(0, 210, 255, 0.04)';
    for (let lng = -150; lng <= 180; lng += 30) {
      const x = ((lng + 180) / 360) * this.REF_W * scaleX;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }

    // Latitude Parallels
    const parallels = [
      { yNorm: 80, label: '66.5° N ARCTIC CIRCLE', major: false },
      { yNorm: 190, label: '23.5° N TROPIC OF CANCER', major: false },
      { yNorm: 290, label: '0° EQUATOR', major: true },
      { yNorm: 390, label: '23.5° S TROPIC OF CAPRICORN', major: false },
      { yNorm: 490, label: '66.5° S ANTARCTIC CIRCLE', major: false }
    ];

    for (const p of parallels) {
      const y = p.yNorm * scaleY;
      ctx.setLineDash(p.major ? [4, 6] : [2, 8]);
      ctx.strokeStyle = p.major ? 'rgba(0, 210, 255, 0.12)' : 'rgba(0, 210, 255, 0.04)';
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();

      // Subtle high-tech latitude tag at right edge
      ctx.fillStyle = p.major ? 'rgba(0, 210, 255, 0.22)' : 'rgba(0, 210, 255, 0.10)';
      ctx.font = '600 7px Chakra Petch';
      ctx.fillText(p.label, w - 120 * scaleX, y - 3);
    }

    ctx.setLineDash([]);
  }

  private drawContinents(scaleX: number, scaleY: number) {
    const ctx = this.ctx;

    // High-fidelity geographic vector continents and major islands (Calibrated for 1000 x 550 canvas)
    const landmasses: Array<Array<[number, number]>> = [
      // 1. North America (Detailed coastlines: Alaska, Canada, Hudson Bay, Nova Scotia, US East Coast, Florida, Gulf of Mexico, Yucatan, Central America, Baja, California, Pacific NW)
      [
        [65, 120], [82, 108], [115, 105], [142, 94], [175, 82], [225, 76], [245, 88],
        [242, 114], [258, 122], [275, 118], [274, 98], [295, 100], [315, 108], [330, 125],
        [348, 148], [338, 160], [328, 160], [338, 168], [320, 168],
        [308, 190], [298, 206], [292, 216], [284, 230], [278, 245], [274, 258], // New York, NJ, Chesapeake, Carolinas
        [272, 270], [276, 287], [268, 290], [264, 274], // Florida Peninsula & Miami
        [254, 274], [244, 268], [236, 266], [226, 268], [220, 280], // Gulf of Mexico / New Orleans / Houston
        [228, 292], [245, 296], [240, 308], // Yucatan Peninsula
        [248, 325], [256, 340], [250, 342], [232, 322], [216, 306], [205, 276], // Central America & Panama isthmus
        [198, 264], [206, 298], [198, 304], [192, 270], // Baja California Peninsula
        [184, 254], [178, 246], [172, 230], [168, 210], [168, 196], [162, 175], [145, 150], // California (LA, SF) & Pacific NW
        [115, 140], [78, 145] // Alaska south coast & Aleutians
      ],

      // 2. Greenland
      [
        [310, 52], [350, 48], [375, 72], [358, 102], [330, 104], [308, 75]
      ],

      // 3. South America (Caribbean, Amazon delta, Brazil bulge, Santos/Rio, River Plate/Buenos Aires, Patagonia, Cape Horn, Chile, Peru)
      [
        [258, 340], [275, 335], [300, 330], [335, 340], [360, 355],
        [380, 362], [405, 385], [398, 415], // Amazon mouth, Recife / Brazil bulge
        [380, 432], [368, 444], [355, 460], // Rio, Santos
        [342, 475], [332, 482], [335, 495], // Rio de la Plata, Buenos Aires
        [325, 515], [318, 538], [308, 534], // Patagonia, Cape Horn tip
        [302, 515], [295, 480], [290, 440], // Chile coast
        [282, 395], [272, 360], [265, 345]  // Peru, Ecuador back to Colombia
      ],

      // 4. Falkland Islands
      [
        [345, 528], [352, 527], [348, 532]
      ],

      // 5. Great Britain
      [
        [462, 156], [474, 162], [480, 174], [476, 185], [468, 186], [458, 190], [455, 175], [458, 160]
      ],

      // 6. Ireland
      [
        [444, 168], [452, 172], [450, 185], [442, 182]
      ],

      // 7. Scandinavia & Jutland (Denmark)
      [
        [506, 100], [520, 96], [534, 98], [546, 106], [542, 118], [528, 122], [522, 134],
        [522, 146], [532, 150], [540, 152], [532, 158], [522, 160], [516, 154], [514, 140],
        [506, 130], [498, 152], [490, 146], [486, 136], [490, 122], [496, 112]
      ],
      [
        [498, 152], [502, 146], [506, 150], [502, 156] // Jutland
      ],

      // 8. Eurasia Mainland (Europe, Russia, Siberia, Kamchatka, China, Korea, Indochina, India, Iran, Mesopotamia, Levant, Anatolia, Greece, Italy, France, Spain)
      [
        // Western Europe & Baltic Coast
        [482, 188], [486, 176], [498, 169], [504, 166], [520, 164], [536, 162], [552, 158],
        // Northern Russia & Siberian Arctic Coast
        [575, 140], [605, 125], [640, 105], [680, 88], [725, 78], [780, 72], [840, 75], [890, 82], [930, 92], [942, 105],
        // Bering Strait, Kamchatka & Sea of Okhotsk
        [935, 140], [915, 160], [890, 180], [875, 195], [855, 210],
        // Korean Peninsula
        [842, 222], [846, 240], [838, 242], [832, 226],
        // China Coast, Bohai, Yangtze, Pearl River Delta
        [824, 220], [808, 228], [816, 238], [824, 254], [822, 264], [806, 280], [796, 292], [788, 284], [780, 290],
        // Indochina & Malay Peninsula
        [775, 290], [765, 320], [746, 325], [745, 338], [748, 358], [755, 368], [758, 350], [750, 332], [735, 320], [728, 295],
        // Bay of Bengal, India, Cape Comorin, Mumbai & Arabian Sea
        [718, 290], [703, 320], [700, 350], [688, 330], [676, 300], [670, 295], [655, 285], [638, 270],
        // Iran, Persian Gulf North, Mesopotamia & Levant
        [625, 268], [608, 262], [594, 255], [568, 254], [562, 245],
        // Southern Anatolia, Aegean & Dardanelles to Istanbul Bosphorus
        [560, 238], [554, 236], [546, 234], [542, 228], [546, 224], [552, 222],
        // Greece, Peloponnese & Adriatic Coast
        [548, 224], [542, 230], [538, 236], [532, 238], [528, 232], [524, 222], [518, 215],
        // Italy Peninsula (Venice, Puglia, toe, Rome, Genoa)
        [514, 218], [520, 235], [512, 240], [502, 228], [496, 212],
        // French Riviera & Iberian Peninsula (Marseille, Barcelona, Valencia, Algeciras, Lisbon, Biscay)
        [490, 214], [486, 214], [482, 218], [476, 218], [480, 222], [473, 229], [465, 236], [456, 237], [448, 232], [445, 225], [446, 216], [465, 214], [482, 195]
      ],

      // 9. Mediterranean Islands (Sicily, Sardinia/Corsica, Crete, Cyprus)
      [
        [506, 236], [514, 235], [512, 242], [505, 241] // Sicily
      ],
      [
        [495, 218], [498, 218], [497, 232], [493, 232] // Sardinia & Corsica
      ],
      [
        [534, 244], [546, 244], [544, 247], [533, 247] // Crete
      ],
      [
        [554, 242], [561, 240], [559, 244], [553, 244] // Cyprus
      ],

      // 10. Africa (Tangier, Maghreb, Egypt/Suez, Red Sea, Horn of Africa, Mozambique, Durban, Cape Town, West Africa)
      [
        [454, 239], [476, 242], [505, 245], [535, 252], [548, 250], [558, 253], // Tangier, Algiers, Tunis, Tripoli, Alexandria, Port Said
        [562, 264], [574, 282], [590, 312], [605, 335], // Red Sea west coast, Bab-el-Mandeb
        [622, 338], [615, 365], [595, 395], [580, 425], // Horn of Africa (Somalia), Kenya, Mozambique
        [568, 450], [557, 464], [540, 475], [523, 476], // Durban, Port Elizabeth, Cape Town
        [515, 470], [498, 440], [490, 400], [488, 360], // Namibia, Angola, Congo
        [482, 335], [450, 332], [425, 315], [420, 290], // Nigeria, Gulf of Guinea, Ivory Coast, Senegal / Dakar
        [432, 265], [445, 248] // Western Sahara, Morocco
      ],

      // 11. Madagascar
      [
        [598, 425], [610, 440], [606, 472], [594, 465], [592, 435]
      ],

      // 12. Arabian Peninsula (Sinai, Jeddah, Yemen, Oman, Dubai / Strait of Hormuz, Persian Gulf)
      [
        [560, 254], [563, 262], [568, 272], [576, 282], [582, 290], [594, 315], [604, 326], // Sinai, Jeddah, Bab-el-Mandeb
        [620, 322], [636, 310], [644, 296], // Yemen, Oman, Ras al Hadd
        [640, 274], [636, 272], [626, 270], [623, 264], [618, 266], // Strait of Hormuz, Dubai, Qatar Peninsula
        [606, 260], [594, 256], [574, 254] // Kuwait, Northern Arabia
      ],

      // 13. Japan (Honshu, Kyushu/Shikoku, Hokkaido)
      [
        [852, 250], [862, 244], [867, 239], [878, 225], [874, 218], [858, 232], [848, 248] // Honshu & Kyushu
      ],
      [
        [876, 212], [890, 208], [885, 220], [874, 216] // Hokkaido
      ],

      // 14. Sri Lanka
      [
        [698, 344], [704, 345], [703, 355], [697, 352]
      ],

      // 15. Taiwan
      [
        [809, 280], [816, 282], [813, 290], [808, 287]
      ],

      // 16. Indonesian Archipelago & Philippines
      [
        [738, 350], [756, 365], [770, 385], [755, 390], [730, 360] // Sumatra
      ],
      [
        [762, 388], [795, 395], [790, 400], [760, 395] // Java (Jakarta)
      ],
      [
        [772, 340], [792, 335], [802, 360], [780, 375], [768, 355] // Borneo
      ],
      [
        [802, 362], [810, 360], [808, 380], [798, 375] // Sulawesi
      ],
      [
        [805, 312], [815, 320], [818, 345], [810, 340], [802, 325] // Philippines (Manila)
      ],

      // 17. Australia & Tasmania
      [
        [825, 420], [845, 410], [860, 425], [880, 410], // Arnhem Land, Gulf of Carpentaria, Cape York
        [890, 435], [888, 470], [878, 480], // Brisbane, Sydney, Melbourne
        [865, 482], [840, 475], [815, 470], // Great Australian Bight, Esperance
        [805, 460], [800, 430], [815, 415]  // Perth, North West Cape, Kimberley
      ],
      [
        [872, 502], [882, 502], [880, 514], [870, 512] // Tasmania
      ],

      // 18. New Zealand
      [
        [940, 475], [955, 470], [950, 490], [938, 485] // North Island
      ],
      [
        [932, 492], [945, 490], [938, 515], [926, 512] // South Island
      ],

      // 19. Caribbean (Cuba, Hispaniola)
      [
        [268, 296], [292, 298], [288, 305], [265, 302] // Cuba
      ],
      [
        [294, 302], [306, 301], [305, 307], [293, 306] // Hispaniola
      ]
    ];

    // Pass 1: Outer Continental Shelf / Bathymetry Halo
    ctx.strokeStyle = 'rgba(0, 210, 255, 0.08)';
    ctx.lineWidth = 3.5;
    for (const poly of landmasses) {
      ctx.beginPath();
      ctx.moveTo(poly[0][0] * scaleX, poly[0][1] * scaleY);
      for (let i = 1; i < poly.length; i++) {
        ctx.lineTo(poly[i][0] * scaleX, poly[i][1] * scaleY);
      }
      ctx.closePath();
      ctx.stroke();
    }

    // Pass 2: Main Tactical Landmass Fill & High-Contrast Crisp Coastlines
    ctx.fillStyle = 'rgba(12, 25, 44, 0.88)';
    ctx.strokeStyle = 'rgba(0, 210, 255, 0.38)';
    ctx.lineWidth = 1.2;
    ctx.shadowColor = 'rgba(0, 210, 255, 0.2)';
    ctx.shadowBlur = 4;

    for (const poly of landmasses) {
      ctx.beginPath();
      ctx.moveTo(poly[0][0] * scaleX, poly[0][1] * scaleY);
      for (let i = 1; i < poly.length; i++) {
        ctx.lineTo(poly[i][0] * scaleX, poly[i][1] * scaleY);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    ctx.shadowBlur = 0;

    // Draw Inland Seas & Major Water Bodies (Black Sea, Caspian Sea, Baltic, Great Lakes)
    this.drawInlandSeas(scaleX, scaleY);
  }

  private drawInlandSeas(scaleX: number, scaleY: number) {
    const ctx = this.ctx;
    const h = this.canvas.height;

    // Match deep ocean gradient backdrop
    const oceanGrad = ctx.createLinearGradient(0, 0, 0, h);
    oceanGrad.addColorStop(0, '#040d1a');
    oceanGrad.addColorStop(0.5, '#07162b');
    oceanGrad.addColorStop(1, '#030a14');

    // High-fidelity vector inland water bodies
    const inlandSeas: Array<{ name: string; polygon: Array<[number, number]> }> = [
      // 1. Black Sea (Calibrated: Bosphorus / Istanbul at [552, 222], Danube delta, Odessa, Crimea peninsula, Sea of Azov, Caucasus, Sinop cape, Turkish north coast)
      {
        name: 'Black Sea',
        polygon: [
          [552, 221], // Bosphorus entrance at Istanbul
          [550, 214], // Bulgaria (Burgas, Varna)
          [552, 205], // Romania (Constanta)
          [555, 198], // Danube delta
          [558, 193], // Odessa, Ukraine
          [563, 194], // Dnieper mouth / Kherson
          [565, 198], // Perekop isthmus (Crimea entrance)
          [564, 203], // Sevastopol (SW Crimea)
          [567, 205], // Yalta (South Crimea tip)
          [571, 201], // Kerch Strait (West)
          [573, 195], // Sea of Azov (South-East)
          [576, 190], // Don river mouth / Rostov
          [574, 186], // Sea of Azov (North)
          [570, 188], // Mariupol
          [568, 193], // Sea of Azov (West)
          [571, 199], // Kerch Strait (East)
          [574, 203], // Novorossiysk
          [579, 207], // Sochi / Abkhazia
          [584, 213], // Georgia coast / Poti
          [587, 216], // Batumi
          [582, 218], // Trabzon, Turkey
          [575, 217], // Samsun
          [568, 214], // Sinop Cape
          [562, 217], // Inebolu
          [556, 219], // Zonguldak
          [552, 221]  // Return to Bosphorus
        ]
      },

      // 2. Caspian Sea (Calibrated: Volga Delta/Astrakhan, Ural Delta, Mangyshlak, Kara-Bogaz-Gol, Turkmen coast, Northern Iran, Absheron/Baku Peninsula, Dagestan)
      {
        name: 'Caspian Sea',
        polygon: [
          [606, 188], // Volga Delta / Astrakhan
          [612, 185], // Northern shallow Caspian basin
          [618, 186], // Ural Delta / Atyrau
          [624, 190], // Kazakhstan northeast coast
          [622, 197], // Mangyshlak Peninsula
          [626, 203], // Kazakh Caspian coast
          [628, 212], // Kara-Bogaz-Gol inlet
          [626, 220], // Turkmenbashi / Krasnovodsk
          [628, 228], // Cheleken Peninsula
          [625, 234], // Bandar Torkaman, Iran
          [618, 235], // Mazandaran, Iran
          [612, 234], // Bandar Anzali, Iran
          [609, 228], // Astara (Azerbaijan border)
          [611, 222], // Baku Bay
          [616, 220], // Absheron Peninsula (Baku)
          [612, 216], // Sumqayit
          [609, 208], // Derbent, Dagestan
          [606, 198], // Makhachkala
          [606, 188]  // Return to Volga Delta
        ]
      },

      // 3. Baltic Sea Cutout (Gulf of Bothnia & Gulf of Finland)
      {
        name: 'Baltic Sea',
        polygon: [
          [514, 138], [520, 130], [523, 142], [538, 151], [538, 155], [524, 154], [516, 150]
        ]
      },

      // 4. North American Great Lakes
      {
        name: 'Lake Superior',
        polygon: [
          [252, 166], [266, 163], [271, 167], [258, 172]
        ]
      },
      {
        name: 'Lake Michigan & Huron',
        polygon: [
          [266, 172], [272, 170], [276, 183], [268, 183]
        ]
      },
      {
        name: 'Lake Erie & Ontario',
        polygon: [
          [276, 180], [285, 177], [287, 182], [277, 184]
        ]
      }
    ];

    // Pass 1: Bathymetry inner glow / shelf halo
    ctx.strokeStyle = 'rgba(0, 210, 255, 0.08)';
    ctx.lineWidth = 3.0;
    for (const body of inlandSeas) {
      ctx.beginPath();
      ctx.moveTo(body.polygon[0][0] * scaleX, body.polygon[0][1] * scaleY);
      for (let i = 1; i < body.polygon.length; i++) {
        ctx.lineTo(body.polygon[i][0] * scaleX, body.polygon[i][1] * scaleY);
      }
      ctx.closePath();
      ctx.stroke();
    }

    // Pass 2: Ocean Fill and Crisp Coastline Stroke
    ctx.fillStyle = oceanGrad;
    ctx.strokeStyle = 'rgba(0, 210, 255, 0.38)';
    ctx.lineWidth = 1.1;
    ctx.shadowColor = 'rgba(0, 210, 255, 0.22)';
    ctx.shadowBlur = 4;

    for (const body of inlandSeas) {
      ctx.beginPath();
      ctx.moveTo(body.polygon[0][0] * scaleX, body.polygon[0][1] * scaleY);
      for (let i = 1; i < body.polygon.length; i++) {
        ctx.lineTo(body.polygon[i][0] * scaleX, body.polygon[i][1] * scaleY);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.shadowBlur = 0;

    // Pass 3: Tactical Sea Designation Typography
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Black Sea Label
    ctx.font = '600 6.5px "Chakra Petch", monospace';
    ctx.fillStyle = 'rgba(0, 210, 255, 0.32)';
    ctx.fillText('BLACK SEA', 568 * scaleX, 209 * scaleY);

    // Caspian Sea Label (stacked vertically to fit the elongated basin)
    ctx.font = '600 5.5px "Chakra Petch", monospace';
    ctx.fillText('CASPIAN', 617 * scaleX, 208 * scaleY);
    ctx.fillText('SEA', 617 * scaleX, 215 * scaleY);
  }

  private drawMajorShippingRoutes(scaleX: number, scaleY: number) {
    const ctx = this.ctx;
    ctx.strokeStyle = 'rgba(70, 130, 200, 0.12)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 5]);

    const routePairs: Array<[string, string]> = [
      // North Atlantic & Transatlantic
      ['newyork', 'rotterdam'],
      ['newyork', 'london'],
      ['miami', 'barcelona'],
      ['savannah', 'rotterdam'],
      ['rotterdam', 'hamburg'],
      ['rotterdam', 'antwerp'],

      // Mediterranean, Suez & Red Sea Corridor
      ['london', 'algeciras'],
      ['algeciras', 'valencia'],
      ['valencia', 'barcelona'],
      ['barcelona', 'marseille'],
      ['marseille', 'genoa'],
      ['genoa', 'piraeus'],
      ['piraeus', 'istanbul'],
      ['piraeus', 'portsaid'],
      ['portsaid', 'jeddah'],
      ['jeddah', 'dubai'],

      // Indian Ocean & Arabian Sea
      ['dubai', 'mumbai'],
      ['mumbai', 'colombo'],
      ['chennai', 'colombo'],
      ['colombo', 'singapore'],
      ['portsaid', 'colombo'],

      // Southeast Asia & Far East
      ['singapore', 'portklang'],
      ['singapore', 'jakarta'],
      ['singapore', 'laemchabang'],
      ['singapore', 'hongkong'],
      ['hongkong', 'manila'],
      ['hongkong', 'shenzhen'],
      ['shenzhen', 'guangzhou'],
      ['hongkong', 'kaohsiung'],
      ['hongkong', 'xiamen'],
      ['xiamen', 'ningbo'],
      ['ningbo', 'shanghai'],
      ['shanghai', 'qingdao'],
      ['qingdao', 'tianjin'],
      ['shanghai', 'busan'],
      ['busan', 'tokyo'],

      // Transpacific Trade
      ['tokyo', 'losangeles'],
      ['shanghai', 'losangeles'],
      ['busan', 'seattle'],
      ['seattle', 'vancouver'],
      ['losangeles', 'longbeach'],

      // Americas, Caribbean & Panama Canal
      ['losangeles', 'panama'],
      ['panama', 'houston'],
      ['panama', 'miami'],
      ['miami', 'newyork'],
      ['houston', 'newyork'],

      // South America & South Atlantic
      ['miami', 'santos'],
      ['santos', 'buenosaires'],
      ['santos', 'algeciras'],
      ['santos', 'capetown'],

      // African Coast & Indian Ocean
      ['capetown', 'durban'],
      ['durban', 'colombo'],
      ['durban', 'singapore'],
      ['algeciras', 'capetown'],

      // Oceania
      ['singapore', 'sydney'],
      ['sydney', 'melbourne'],
      ['jakarta', 'sydney']
    ];

    for (const [id1, id2] of routePairs) {
      const p1 = WORLD_PORTS.find((p) => p.id === id1);
      const p2 = WORLD_PORTS.find((p) => p.id === id2);
      if (p1 && p2) {
        ctx.beginPath();
        ctx.moveTo(p1.x * scaleX, p1.y * scaleY);
        const midX = ((p1.x + p2.x) / 2) * scaleX;
        const midY = ((p1.y + p2.y) / 2 - 15) * scaleY;
        ctx.quadraticCurveTo(midX, midY, p2.x * scaleX, p2.y * scaleY);
        ctx.stroke();
      }
    }
    ctx.setLineDash([]);
  }

  private drawActiveVoyages(scaleX: number, scaleY: number, time: number) {
    const ctx = this.ctx;

    for (const pId in this.currentState?.players) {
      if (this.filterMode === 'mine' && pId !== this.myPlayerId) continue;

      const player = this.currentState.players[pId];
      const playerColor = player.color || '#00d2ff';
      const isMyCompany = pId === this.myPlayerId;

      for (const ship of player.ships) {
        if (
          (ship.status === 'sailing' || ship.status === 'hazard_minigame' || ship.status === 'docking_minigame') &&
          ship.currentVoyage
        ) {
          const origin = WORLD_PORTS.find((p) => p.id === ship.currentVoyage?.originPortId);
          const dest = WORLD_PORTS.find((p) => p.id === ship.currentVoyage?.destinationPortId);
          if (!origin || !dest) continue;

          const ox = origin.x * scaleX;
          const oy = origin.y * scaleY;
          const dx = dest.x * scaleX;
          const dy = dest.y * scaleY;

          const midX = (ox + dx) / 2;
          const midY = (oy + dy) / 2 - 20 * scaleY;

          // Glowing trajectory line
          ctx.strokeStyle = playerColor;
          ctx.lineWidth = isMyCompany ? 2.2 : 1.4;
          ctx.shadowColor = playerColor;
          ctx.shadowBlur = isMyCompany ? 8 : 3;
          ctx.beginPath();
          ctx.moveTo(ox, oy);
          ctx.quadraticCurveTo(midX, midY, dx, dy);
          ctx.stroke();
          ctx.shadowBlur = 0;

          // Ship position along Bezier curve
          const t = Math.max(0, Math.min(1, (ship.currentVoyage.progressPercent || 0) / 100));
          const shipX = (1 - t) * (1 - t) * ox + 2 * (1 - t) * t * midX + t * t * dx;
          const shipY = (1 - t) * (1 - t) * oy + 2 * (1 - t) * t * midY + t * t * dy;

          // Heading angle tangent along Bezier curve
          const tangentX = 2 * (1 - t) * (midX - ox) + 2 * t * (dx - midX);
          const tangentY = 2 * (1 - t) * (midY - oy) + 2 * t * (dy - midY);
          const angle = Math.atan2(tangentY, tangentX);

          const isHovered = this.hoveredShip?.ship.id === ship.id;
          const isSelected = this.selectedShipId === ship.id;

          // Record ship target for interactive hit-testing
          this.renderedShips.push({
            ship,
            player,
            x: shipX,
            y: shipY,
            radius: 12
          });

          // Draw Vector Boat Silhouette with animated wake
          this.drawVessel(ctx, shipX, shipY, angle, playerColor, isSelected, isHovered, time, ship.status);

          // Ship label
          ctx.fillStyle = isHovered || isSelected ? '#ffffff' : 'rgba(235, 245, 255, 0.85)';
          ctx.font = isHovered || isSelected ? '700 10px JetBrains Mono' : '600 9px JetBrains Mono';
          const label = `${ship.name} (${Math.round(ship.currentVoyage.progressPercent)}%)`;
          ctx.fillText(label, shipX + 12, shipY - 8);

          // Minigame indicator badge
          if (ship.status === 'hazard_minigame') {
            const pulse = (Math.sin(time * 0.01) + 1) * 3;
            ctx.fillStyle = '#ff4757';
            ctx.beginPath();
            ctx.arc(shipX - 10, shipY - 10, 5 + pulse, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillText('⚠️ HAZARD', shipX + 12, shipY + 5);
          } else if (ship.status === 'docking_minigame') {
            ctx.fillStyle = '#00d2ff';
            ctx.fillText('⚓ BERTHING', shipX + 12, shipY + 5);
          }
        }
      }
    }
  }

  private drawVessel(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    angle: number,
    playerColor: string,
    isSelected: boolean,
    isHovered: boolean,
    time: number,
    status: string
  ) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    // 1. Foaming Water Wake Trails behind stern
    const wakePhase = (time * 0.005) % 1;
    ctx.strokeStyle = 'rgba(220, 245, 255, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-10, -2);
    ctx.lineTo(-20 - wakePhase * 8, -6 - wakePhase * 3);
    ctx.moveTo(-10, 2);
    ctx.lineTo(-20 - wakePhase * 8, 6 + wakePhase * 3);
    ctx.stroke();

    // 2. Vector Ship Hull
    ctx.beginPath();
    ctx.moveTo(13, 0); // Pointed Bow
    ctx.quadraticCurveTo(6, 5, -8, 4.5); // Starboard curve
    ctx.lineTo(-10, 2.5); // Stern corner
    ctx.lineTo(-10, -2.5); // Stern corner
    ctx.quadraticCurveTo(-8, -4.5, 6, -5); // Port curve
    ctx.closePath();

    ctx.fillStyle = playerColor;
    ctx.shadowColor = isHovered || isSelected ? '#ffffff' : playerColor;
    ctx.shadowBlur = isHovered || isSelected ? 12 : 5;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Dark deck cargo hold section
    ctx.fillStyle = '#06101c';
    ctx.fillRect(-6, -2.5, 7, 5);

    // Bridge / Superstructure cabin
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-1, -1.8, 3.5, 3.6);

    // Hull Outline
    ctx.strokeStyle = isHovered || isSelected ? '#ffffff' : 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = isHovered || isSelected ? 2 : 1;
    ctx.stroke();

    ctx.restore();
  }

  private drawPorts(scaleX: number, scaleY: number, time: number) {
    const ctx = this.ctx;

    // Group docked ships by port ID
    const dockedByPort: Record<string, Array<{ ship: PlayerShip; player: PlayerCompany }>> = {};
    for (const pId in this.currentState?.players) {
      if (this.filterMode === 'mine' && pId !== this.myPlayerId) continue;
      const player = this.currentState.players[pId];
      for (const ship of player.ships) {
        if (ship.status === 'docked' && ship.currentPortId) {
          if (!dockedByPort[ship.currentPortId]) dockedByPort[ship.currentPortId] = [];
          dockedByPort[ship.currentPortId].push({ ship, player });
        }
      }
    }

    for (const port of WORLD_PORTS) {
      const px = port.x * scaleX;
      const py = port.y * scaleY;
      const isHovered = this.hoveredPort?.id === port.id;
      const dockedShips = dockedByPort[port.id] || [];

      // Beacon glow & color
      const beaconColor = isHovered ? '#ffffff' : (port.category === 'passenger' ? '#ff6b81' : '#00d2ff');
      ctx.shadowColor = isHovered ? '#00d2ff' : (port.category === 'passenger' ? 'rgba(255, 107, 129, 0.5)' : 'rgba(0, 210, 255, 0.4)');
      ctx.shadowBlur = isHovered ? 16 : 8;

      ctx.fillStyle = beaconColor;
      ctx.beginPath();
      ctx.arc(px, py, isHovered ? 6 : (port.category === 'passenger' ? 4.5 : 4), 0, Math.PI * 2);
      ctx.fill();

      // Outer ripple animation if hovered
      if (isHovered) {
        ctx.strokeStyle = beaconColor;
        ctx.lineWidth = 1.5;
        const r = 6 + (Math.sin(time * 0.008) + 1) * 3;
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.shadowBlur = 0;

      // Port Name Label
      ctx.fillStyle = isHovered ? '#ffffff' : 'rgba(232, 244, 252, 0.75)';
      ctx.font = isHovered ? '700 11px Chakra Petch' : '500 9px Chakra Petch';
      const labelText = isHovered && port.hasPassengerTerminal ? `🚢 ${port.name}` : port.name;
      ctx.fillText(labelText, px + 8, py + 3);

      // Docked Vessels Harbor Badge
      if (dockedShips.length > 0) {
        const badgeX = px + 8;
        const badgeY = py - 10;
        const width = 24 + Math.min(3, dockedShips.length - 1) * 6;

        ctx.fillStyle = 'rgba(6, 14, 26, 0.88)';
        ctx.strokeStyle = 'rgba(0, 210, 255, 0.45)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        try {
          if (typeof (ctx as any).roundRect === 'function') {
            (ctx as any).roundRect(badgeX, badgeY - 7, width, 14, 4);
          } else {
            ctx.rect(badgeX, badgeY - 7, width, 14);
          }
        } catch {
          ctx.rect(badgeX, badgeY - 7, width, 14);
        }
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#00d2ff';
        ctx.font = '700 9px Chakra Petch';
        ctx.fillText(`⚓${dockedShips.length}`, badgeX + 3, badgeY + 4);

        // Draw small company color dots for docked fleets
        dockedShips.slice(0, 3).forEach((ds, idx) => {
          ctx.fillStyle = ds.player.color || '#00d2ff';
          ctx.beginPath();
          ctx.arc(badgeX + 17 + idx * 5, badgeY, 2, 0, Math.PI * 2);
          ctx.fill();
        });
      }
    }
  }

  public destroy() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
    }
  }
}

