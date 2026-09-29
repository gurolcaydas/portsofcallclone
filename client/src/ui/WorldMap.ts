import { Port, WORLD_PORTS, GameState, PlayerShip } from '@portofcall/shared';

export class WorldMap {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private onPortClick: (port: Port) => void;
  private hoveredPort: Port | null = null;
  private currentState: GameState | null = null;
  private animFrameId: number | null = null;

  // Normalized coordinate reference: width 1000, height 550
  private readonly REF_W = 1000;
  private readonly REF_H = 550;

  constructor(canvasId: string, onPortClick: (port: Port) => void) {
    this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d')!;
    this.onPortClick = onPortClick;

    this.setupResize();
    this.setupEvents();
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

  private setupEvents() {
    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const scaleX = rect.width / this.REF_W;
      const scaleY = rect.height / this.REF_H;

      let found: Port | null = null;
      for (const p of WORLD_PORTS) {
        const px = p.x * scaleX;
        const py = p.y * scaleY;
        const dist = Math.hypot(mouseX - px, mouseY - py);
        if (dist < 14) {
          found = p;
          break;
        }
      }

      if (this.hoveredPort !== found) {
        this.hoveredPort = found;
        this.canvas.style.cursor = found ? 'pointer' : 'default';
      }
    });

    this.canvas.addEventListener('click', () => {
      if (this.hoveredPort) {
        this.onPortClick(this.hoveredPort);
      }
    });
  }

  public updateState(state: GameState) {
    this.currentState = state;
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

    // 1. Draw Stylized World Landmasses (Abstract vector continents)
    this.drawContinents(scaleX, scaleY);

    // 2. Draw Maritime Shipping Lanes (faint dotted lines)
    this.drawMajorShippingRoutes(scaleX, scaleY);

    // 3. Draw Active Voyages & Sailing Ships
    if (this.currentState) {
      this.drawActiveVoyages(scaleX, scaleY, time);
    }

    // 4. Draw Port Beacons
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
      const p1 = WORLD_PORTS.find(p => p.id === id1);
      const p2 = WORLD_PORTS.find(p => p.id === id2);
      if (p1 && p2) {
        ctx.beginPath();
        ctx.moveTo(p1.x * scaleX, p1.y * scaleY);
        // Slight curve
        const midX = (p1.x + p2.x) / 2 * scaleX;
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
      const player = this.currentState.players[pId];
      const playerColor = player.color || '#00d2ff';

      for (const ship of player.ships) {
        if (ship.status === 'sailing' && ship.currentVoyage) {
          const origin = WORLD_PORTS.find(p => p.id === ship.currentVoyage?.originPortId);
          const dest = WORLD_PORTS.find(p => p.id === ship.currentVoyage?.destinationPortId);
          if (!origin || !dest) continue;

          const ox = origin.x * scaleX;
          const oy = origin.y * scaleY;
          const dx = dest.x * scaleX;
          const dy = dest.y * scaleY;

          // Animated glowing trajectory line
          ctx.strokeStyle = playerColor;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(ox, oy);
          const midX = (ox + dx) / 2;
          const midY = (oy + dy) / 2 - 20 * scaleY;
          ctx.quadraticCurveTo(midX, midY, dx, dy);
          ctx.stroke();

          // Calculate current ship position along quadratic curve
          const t = ship.currentVoyage.progressPercent / 100;
          const shipX = (1 - t) * (1 - t) * ox + 2 * (1 - t) * t * midX + t * t * dx;
          const shipY = (1 - t) * (1 - t) * oy + 2 * (1 - t) * t * midY + t * t * dy;

          // Pulse halo
          const pulse = Math.sin(time * 0.005) * 3;
          ctx.fillStyle = playerColor;
          ctx.shadowColor = playerColor;
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.arc(shipX, shipY, 5 + pulse, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;

          // Vessel Icon / Label
          ctx.fillStyle = '#ffffff';
          ctx.font = '600 10px JetBrains Mono';
          ctx.fillText(`🚢 ${ship.name}`, shipX + 8, shipY - 6);
        }
      }
    }
  }

  private drawPorts(scaleX: number, scaleY: number, time: number) {
    const ctx = this.ctx;

    for (const port of WORLD_PORTS) {
      const px = port.x * scaleX;
      const py = port.y * scaleY;
      const isHovered = this.hoveredPort?.id === port.id;

      // Glow beacon
      ctx.shadowColor = isHovered ? '#00d2ff' : 'rgba(0, 210, 255, 0.4)';
      ctx.shadowBlur = isHovered ? 16 : 8;

      ctx.fillStyle = isHovered ? '#ffffff' : '#00d2ff';
      ctx.beginPath();
      ctx.arc(px, py, isHovered ? 6 : 4, 0, Math.PI * 2);
      ctx.fill();

      // Outer ripple on hovered
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
    }
  }

  public destroy() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
    }
  }
}
