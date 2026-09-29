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

  private setupResize() {
    const resize = () => {
      const parent = this.canvas.parentElement;
      if (parent) {
        this.canvas.width = parent.clientWidth * window.devicePixelRatio;
        this.canvas.height = parent.clientHeight * window.devicePixelRatio;
        this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      }
    };
    window.addEventListener('resize', resize);
    resize();
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

  private setupEvents() {
    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const scaleX = rect.width / this.REF_W;
      const scaleY = rect.height / this.REF_H;

      // 1. Hit-test sailing vessels first
      let hitShip: RenderedShipTarget | null = null;
      for (const rs of this.renderedShips) {
        const dist = Math.hypot(mouseX - rs.x, mouseY - rs.y);
        if (dist <= rs.radius + 6) {
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
          if (dist < 18) {
            hitPort = p;
            break;
          }
        }
      }

      this.hoveredShip = hitShip;
      this.hoveredPort = hitPort;
      this.canvas.style.cursor = hitShip || hitPort ? 'pointer' : 'default';

      this.updateTooltip(mouseX, mouseY);
    });

    this.canvas.addEventListener('mouseleave', () => {
      this.hoveredShip = null;
      this.hoveredPort = null;
      if (this.tooltipEl) {
        this.tooltipEl.classList.add('hidden');
      }
    });

    this.canvas.addEventListener('click', () => {
      if (this.hoveredShip) {
        this.selectedShipId = this.hoveredShip.ship.id;
        sounds.playBell();
        if (this.onShipClick) {
          this.onShipClick(this.hoveredShip.ship, this.hoveredShip.player);
        }
      } else if (this.hoveredPort) {
        this.onPortClick(this.hoveredPort);
      }
    });
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
      this.tooltipEl.style.left = `${mouseX}px`;
      this.tooltipEl.style.top = `${mouseY}px`;
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

      this.tooltipEl.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 4px;">
          <strong style="color: #fff; font-size: 0.95rem; font-family: 'Chakra Petch', sans-serif;">⚓ ${port.name}</strong>
          <span style="font-size: 0.7rem; color: #7f9bb6;">${port.country}</span>
        </div>
        <div style="font-size: 0.74rem; color: #a0c0e0; display: flex; flex-direction: column; gap: 2px;">
          <div>Bunker Fuel: <strong style="color: #ffa502;">$${fuelPrice} / ton</strong></div>
          <div>Drydock Facility: <strong style="color: ${port.hasDrydock ? '#2ed573' : '#ff4757'};">${port.hasDrydock ? 'Available' : 'None'}</strong></div>
          <div>Port Berth Fee: <strong style="color: #fff;">$${port.portFeePerCall.toLocaleString()}</strong></div>
        </div>
        ${berthedHtml}
        <div style="font-size: 0.68rem; color: #00d2ff; margin-top: 6px; font-style: italic;">
          Click port beacon to open freight exchange & shipyard
        </div>
      `;
      this.tooltipEl.style.left = `${mouseX}px`;
      this.tooltipEl.style.top = `${mouseY}px`;
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

    this.ctx.clearRect(0, 0, w, h);

    const scaleX = w / this.REF_W;
    const scaleY = h / this.REF_H;

    this.renderedShips = [];

    // 1. Draw Stylized World Landmasses (Abstract vector continents)
    this.drawContinents(scaleX, scaleY);

    // 2. Draw Maritime Shipping Lanes (faint dotted lines)
    this.drawMajorShippingRoutes(scaleX, scaleY);

    // 3. Draw Active Voyages & Sailing Ships with direction and wakes
    if (this.currentState) {
      this.drawActiveVoyages(scaleX, scaleY, time);
    }

    // 4. Draw Port Beacons and Docked Vessel Badges
    this.drawPorts(scaleX, scaleY, time);
  }

  private drawContinents(scaleX: number, scaleY: number) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(18, 35, 62, 0.45)';
    ctx.strokeStyle = 'rgba(0, 210, 255, 0.15)';
    ctx.lineWidth = 1;

    // Procedural polygonal continents for a clean, sleek tactical map look
    const landmasses = [
      // North America
      [[150, 100], [280, 80], [330, 160], [290, 240], [230, 290], [180, 240], [130, 150]],
      // South America
      [[280, 310], [370, 330], [380, 430], [330, 520], [290, 480], [260, 350]],
      // Europe
      [[440, 110], [530, 100], [560, 190], [470, 230], [420, 180]],
      // Africa
      [[450, 240], [570, 230], [590, 350], [540, 500], [480, 480], [430, 310]],
      // Asia
      [[570, 90], [860, 110], [880, 260], [790, 360], [670, 330], [580, 210]],
      // Australia
      [[820, 420], [920, 410], [930, 500], [830, 510]]
    ];

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
  }

  private drawMajorShippingRoutes(scaleX: number, scaleY: number) {
    const ctx = this.ctx;
    ctx.strokeStyle = 'rgba(70, 130, 200, 0.12)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 5]);

    const routePairs: Array<[string, string]> = [
      ['newyork', 'rotterdam'],
      ['newyork', 'london'],
      ['rotterdam', 'gibraltar'],
      ['gibraltar', 'alexandria'],
      ['alexandria', 'dubai'],
      ['dubai', 'singapore'],
      ['singapore', 'hongkong'],
      ['hongkong', 'shanghai'],
      ['shanghai', 'tokyo'],
      ['panama', 'newyork'],
      ['panama', 'tokyo'],
      ['santos', 'rotterdam'],
      ['capetown', 'singapore'],
      ['sydney', 'singapore']
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

      // Beacon glow
      ctx.shadowColor = isHovered ? '#00d2ff' : 'rgba(0, 210, 255, 0.4)';
      ctx.shadowBlur = isHovered ? 16 : 8;

      ctx.fillStyle = isHovered ? '#ffffff' : '#00d2ff';
      ctx.beginPath();
      ctx.arc(px, py, isHovered ? 6 : 4, 0, Math.PI * 2);
      ctx.fill();

      // Outer ripple animation if hovered
      if (isHovered) {
        ctx.strokeStyle = '#00d2ff';
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
      ctx.fillText(port.name, px + 8, py + 3);

      // Docked Vessels Harbor Badge
      if (dockedShips.length > 0) {
        const badgeX = px + 8;
        const badgeY = py - 10;
        const width = 24 + Math.min(3, dockedShips.length - 1) * 6;

        ctx.fillStyle = 'rgba(6, 14, 26, 0.88)';
        ctx.strokeStyle = 'rgba(0, 210, 255, 0.45)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        if ((ctx as any).roundRect) {
          (ctx as any).roundRect(badgeX, badgeY - 7, width, 14, 4);
        } else {
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

