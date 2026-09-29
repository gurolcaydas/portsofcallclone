import { NetworkClient } from './network/NetworkClient.js';
import { UIManager } from './ui/UIManager.js';
import { WorldMap } from './ui/WorldMap.js';
import { HarborDocking3D } from './minigames/HarborDocking3D.js';
import { HazardNav3D } from './minigames/HazardNav3D.js';
import { sounds } from './sound/SoundManager.js';
import { WORLD_PORTS, SHIP_BLUEPRINTS, GameState, PublicRoomInfo, getRandomCompanyName, calculateHomePortCost } from '@portofcall/shared';

class App {
  private network: NetworkClient;
  private ui: UIManager;
  private worldMap: WorldMap;
  private dockingGame: HarborDocking3D | null = null;
  private hazardGame: HazardNav3D | null = null;
  private activeMinigameShipId: string | null = null;
  private currentState: GameState | null = null;
  private cachedRooms: PublicRoomInfo[] = [];

  constructor() {
    this.network = new NetworkClient();
    this.ui = new UIManager(this.network);

    this.worldMap = new WorldMap(
      'world-map-canvas',
      (port) => {
        this.ui.openPortModal(port);
      },
      (ship, player) => {
        if (player.id === this.network.playerId) {
          this.ui.selectShip(ship.id);
          this.ui.showToast(`Selected vessel ${ship.name}`, 'info');
        } else {
          this.ui.showToast(`Vessel ${ship.name} belongs to ${player.name}`, 'info');
        }
      }
    );

    this.setupLobbyEvents();
    this.setupNetworkEvents();
    this.checkExistingSession();
    this.refreshRoomBrowser();
  }

  private async refreshRoomBrowser() {
    const badge = document.getElementById('browser-room-count');
    if (badge) badge.textContent = 'Searching...';
    const rooms = await this.network.getRoomList();
    this.renderRoomList(rooms);
  }

  private renderRoomList(rooms: PublicRoomInfo[]) {
    this.cachedRooms = rooms || [];
    const container = document.getElementById('browser-room-list');
    const badge = document.getElementById('browser-room-count');
    if (!container) return;

    if (badge) {
      badge.textContent = `${this.cachedRooms.length} active`;
    }

    if (this.cachedRooms.length === 0) {
      container.innerHTML = `
        <div class="empty-room-state">
          <div class="empty-anchor-icon">⚓</div>
          <h4>No Active Fleets Found</h4>
          <p>Be the first captain to establish a shipping line and set sail on the world trade lanes!</p>
          <button id="btn-empty-found" class="btn btn-primary btn-glow" style="margin-top: 0.8rem;">Found New Company</button>
        </div>
      `;

      document.getElementById('btn-empty-found')?.addEventListener('click', () => {
        document.getElementById('tab-host')?.click();
      });
      return;
    }

    container.innerHTML = this.cachedRooms.map((room) => {
      const isLobby = room.status === 'lobby';
      const isPlaying = room.status === 'playing';
      const statusBadge = isLobby
        ? `<span class="room-status-badge badge-lobby">● IN PORT (LOBBY)</span>`
        : room.isOpen
        ? `<span class="room-status-badge badge-sailing">🚢 AT SEA (DAY ${room.currentDay})</span>`
        : `<span class="room-status-badge badge-closed">🔒 CLOSED (IN VOYAGE)</span>`;

      const lateJoinTag = room.allowLateJoin
        ? `<span class="room-tag-open">Open to New Captains</span>`
        : `<span class="room-tag-closed">Private Voyage</span>`;

      const minutesAgo = Math.max(1, Math.round((Date.now() - room.createdAt) / 60000));
      const timeText = minutesAgo === 1 ? 'Just started' : `${minutesAgo}m ago`;

      const actionButton = room.isOpen
        ? `<button class="btn btn-primary btn-sm btn-join-card" data-code="${room.roomCode}">
             ${isPlaying ? '🚢 Join Active Voyage' : '⚓ Join Fleet'}
           </button>`
        : `<button class="btn btn-secondary btn-sm" disabled style="opacity: 0.5; cursor: not-allowed;">
             🔒 Locked
           </button>`;

      return `
        <div class="room-card glass-panel ${room.isOpen ? 'card-open' : 'card-locked'}">
          <div class="room-card-header">
            <div class="room-code-tag">
              <span class="code-label">ROOM</span>
              <strong class="code-val">${room.roomCode}</strong>
            </div>
            <div class="room-header-status">
              ${statusBadge}
              ${lateJoinTag}
            </div>
          </div>

          <div class="room-card-body">
            <div class="room-info-row">
              <span class="info-label">Founder:</span>
              <strong class="info-val">${room.hostName}</strong>
              <span class="info-separator">•</span>
              <span class="info-label">Created:</span>
              <span class="info-val text-muted">${timeText}</span>
            </div>

            <div class="room-fleets-wrap">
              <div class="fleets-count-header">
                <span>REGISTERED FLEETS (${room.playerCount}/${room.maxPlayers}):</span>
              </div>
              <div class="room-fleet-chips">
                ${room.playerNames.map((name) => `<span class="fleet-chip">🚢 ${name}</span>`).join('')}
              </div>
            </div>
          </div>

          <div class="room-card-footer">
            <span class="room-footer-hint">${room.isOpen ? 'Ready for immediate dispatch' : 'Voyage restricted to departed fleets'}</span>
            ${actionButton}
          </div>
        </div>
      `;
    }).join('');

    // Attach join click listeners on dynamically generated room cards
    container.querySelectorAll('.btn-join-card').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const target = e.currentTarget as HTMLElement;
        const code = target.getAttribute('data-code');
        if (!code) return;

        const nameInput = document.getElementById('input-browser-company') as HTMLInputElement;
        const homePortSelect = document.getElementById('select-browser-homeport') as HTMLSelectElement | null;
        const companyName = nameInput?.value.trim() || getRandomCompanyName();
        const homePortId = homePortSelect?.value || 'rotterdam';
        const color = '#00d2ff';

        const res = await this.network.joinRoom(code, companyName, color, homePortId);
        if (res.success && res.sessionToken) {
          localStorage.setItem(
            'poc_session',
            JSON.stringify({ roomCode: code, sessionToken: res.sessionToken, companyName, color, homePortId })
          );
          this.showWaitingLobby(code, false);
          sounds.playFoghorn();
          this.ui.showToast(`Joined Shipping Syndicate ${code}!`, 'success');
        } else {
          this.ui.showToast(res.error || 'Failed to join room', 'error');
        }
      });
    });
  }

  private async checkExistingSession() {
    const saved = localStorage.getItem('poc_session');
    if (!saved) return;
    try {
      const session = JSON.parse(saved);
      if (session.roomCode && session.sessionToken) {
        console.log('Attempting session reconnection:', session.roomCode);
        const res = await this.network.reconnect(session.roomCode, session.sessionToken);
        if (res.success) {
          this.ui.showToast(`Reconnected to Shipping Company (${session.roomCode})!`, 'success');
          sounds.playBell();
        } else {
          console.log('Session expired:', res.error);
          localStorage.removeItem('poc_session');
        }
      }
    } catch (e) {
      localStorage.removeItem('poc_session');
    }
  }

  private setupLobbyEvents() {
    // 3 Tabs: Browser, Host & Join
    const tabBrowse = document.getElementById('tab-browse');
    const tabHost = document.getElementById('tab-host');
    const tabJoin = document.getElementById('tab-join');
    const panelBrowse = document.getElementById('panel-browse');
    const panelHost = document.getElementById('panel-host');
    const panelJoin = document.getElementById('panel-join');

    const switchLobbyTab = (activeTab: HTMLElement | null, activePanel: HTMLElement | null) => {
      [tabBrowse, tabHost, tabJoin].forEach((t) => t?.classList.remove('active'));
      [panelBrowse, panelHost, panelJoin].forEach((p) => p?.classList.remove('active'));
      activeTab?.classList.add('active');
      activePanel?.classList.add('active');
    };

    tabBrowse?.addEventListener('click', () => {
      switchLobbyTab(tabBrowse, panelBrowse);
      this.refreshRoomBrowser();
    });

    tabHost?.addEventListener('click', () => {
      switchLobbyTab(tabHost, panelHost);
    });

    tabJoin?.addEventListener('click', () => {
      switchLobbyTab(tabJoin, panelJoin);
    });

    // Refresh Rooms Button
    const refreshBtn = document.getElementById('btn-refresh-rooms');
    refreshBtn?.addEventListener('click', () => {
      this.refreshRoomBrowser();
      sounds.playBell();
    });

    // Initialize random company names across inputs and wire up 🎲 dice buttons
    const initialCompanyName = getRandomCompanyName();
    const companyInputs = [
      document.getElementById('input-browser-company') as HTMLInputElement,
      document.getElementById('input-host-company') as HTMLInputElement,
      document.getElementById('input-join-company') as HTMLInputElement
    ].filter(Boolean);

    companyInputs.forEach((inp) => {
      if (!inp.value.trim()) inp.value = initialCompanyName;
    });

    document.querySelectorAll('.btn-dice-reroll').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const targetId = (e.currentTarget as HTMLElement).getAttribute('data-target');
        const input = targetId ? (document.getElementById(targetId) as HTMLInputElement) : null;
        if (input) {
          const newName = getRandomCompanyName([input.value]);
          input.value = newName;
          input.classList.remove('flash-update');
          void input.offsetWidth;
          input.classList.add('flash-update');
          sounds.playBell();
        }
      });
    });

    // Color Pickers
    this.setupColorPicker('host-color-picker');
    this.setupColorPicker('join-color-picker');

    // Home Port Selectors & Preview
    this.setupHomePortSelectors();

    // Create Room Button
    const createBtn = document.getElementById('btn-create-room');
    createBtn?.addEventListener('click', async () => {
      const nameInput = document.getElementById('input-host-company') as HTMLInputElement;
      const homePortSelect = document.getElementById('select-host-homeport') as HTMLSelectElement | null;
      const color = this.getSelectedColor('host-color-picker');
      const companyName = nameInput?.value.trim() || getRandomCompanyName();
      const allowLateJoin = (document.getElementById('check-allow-late-join') as HTMLInputElement)?.checked ?? true;
      const homePortId = homePortSelect?.value || 'rotterdam';

      const res = await this.network.createRoom(companyName, color, allowLateJoin, homePortId);
      if (res.success && res.roomCode && res.sessionToken) {
        localStorage.setItem(
          'poc_session',
          JSON.stringify({ roomCode: res.roomCode, sessionToken: res.sessionToken, companyName, color, homePortId })
        );
        this.showWaitingLobby(res.roomCode, true);
        sounds.playFoghorn();
      } else {
        this.ui.showToast(res.error || 'Failed to establish room', 'error');
      }
    });

    // Join Room Button
    const joinBtn = document.getElementById('btn-join-room');
    joinBtn?.addEventListener('click', async () => {
      const codeInput = document.getElementById('input-join-code') as HTMLInputElement;
      const nameInput = document.getElementById('input-join-company') as HTMLInputElement;
      const homePortSelect = document.getElementById('select-join-homeport') as HTMLSelectElement | null;
      const color = this.getSelectedColor('join-color-picker');
      const code = codeInput?.value.trim().toUpperCase();
      const companyName = nameInput?.value.trim() || getRandomCompanyName();
      const homePortId = homePortSelect?.value || 'rotterdam';

      if (!code || code.length < 4) {
        this.ui.showToast('Please enter a valid 4-character room code', 'warning');
        return;
      }

      const res = await this.network.joinRoom(code, companyName, color, homePortId);
      if (res.success && res.sessionToken) {
        localStorage.setItem(
          'poc_session',
          JSON.stringify({ roomCode: code, sessionToken: res.sessionToken, companyName, color, homePortId })
        );
        this.showWaitingLobby(code, false);
        sounds.playFoghorn();
      } else {
        this.ui.showToast(res.error || 'Failed to join room', 'error');
      }
    });

    // Start Game Button (Host only)
    const startBtn = document.getElementById('btn-start-game');
    startBtn?.addEventListener('click', () => {
      this.network.startGame();
    });

    // Leave Game Button in Header
    const leaveBtn = document.getElementById('btn-leave-game');
    leaveBtn?.addEventListener('click', () => {
      if (confirm('Leave current shipping company and return to lobby?')) {
        localStorage.removeItem('poc_session');
        this.network.leaveRoom();
        window.location.reload();
      }
    });

    // Hire Tugs (auto-dock) button inside 3D docking HUD
    const hireTugsBtn = document.getElementById('btn-hire-tugs');
    hireTugsBtn?.addEventListener('click', () => {
      if (this.activeMinigameShipId) {
        this.dockingGame?.stop();
        this.network.autoDock(this.activeMinigameShipId);
      }
    });
  }

  private setupColorPicker(containerId: string) {
    const dots = document.querySelectorAll(`#${containerId} .color-dot`);
    dots.forEach((dot) => {
      dot.addEventListener('click', () => {
        dots.forEach((d) => d.classList.remove('active'));
        dot.classList.add('active');
      });
    });
  }

  private getSelectedColor(containerId: string): string {
    const active = document.querySelector(`#${containerId} .color-dot.active`) as HTMLElement;
    return active?.getAttribute('data-color') || '#00d2ff';
  }

  private setupHomePortSelectors() {
    const selectorConfigs = [
      { selectId: 'select-host-homeport', infoId: 'host-homeport-info' },
      { selectId: 'select-join-homeport', infoId: 'join-homeport-info' },
      { selectId: 'select-browser-homeport', infoId: 'browser-homeport-info' }
    ];

    // Sort ports alphabetically by name
    const sortedPorts = [...WORLD_PORTS].sort((a, b) => a.name.localeCompare(b.name));

    selectorConfigs.forEach(({ selectId, infoId }) => {
      const select = document.getElementById(selectId) as HTMLSelectElement | null;
      const info = document.getElementById(infoId);
      if (!select) return;

      select.innerHTML = '';
      sortedPorts.forEach((port) => {
        const cost = calculateHomePortCost(port);
        const opt = document.createElement('option');
        opt.value = port.id;
        const catBadge = port.category === 'mixed' ? '⚡ Dual Hub' : port.category === 'passenger' ? '🚢 Cruise Port' : '📦 Heavy Cargo';
        opt.textContent = `${port.name} (${port.country}) — $${cost.toLocaleString()} [${catBadge}]`;
        if (port.id === 'rotterdam') {
          opt.selected = true;
        }
        select.appendChild(opt);
      });

      const updateInfo = () => {
        if (!info) return;
        const selectedId = select.value || 'rotterdam';
        const port = WORLD_PORTS.find((p) => p.id === selectedId) || sortedPorts[0];
        const cost = calculateHomePortCost(port);
        const startingCash = 400000 - cost;

        const terminalDesc = port.category === 'mixed'
          ? 'Dual Cargo + Passenger Cruise Terminal'
          : port.category === 'passenger'
          ? 'Dedicated International Cruise Waterfront'
          : 'Heavy Industrial Cargo Terminal';

        info.innerHTML = `
          <div class="cost-line">
            <span>Establishment License Fee:</span>
            <span class="cost-amount">$${cost.toLocaleString()}</span>
          </div>
          <div class="cost-line">
            <span>Starting Treasury Capital:</span>
            <span class="cash-left">$${startingCash.toLocaleString()}</span>
          </div>
          <div style="font-size: 0.73rem; color: #7f9bb6; margin-top: 2px;">
            Facilities: <strong>${terminalDesc}</strong>${port.hasDrydock ? ' • ⚓ Shipyard Drydock' : ''}
          </div>
        `;
      };

      select.addEventListener('change', () => {
        updateInfo();
        sounds.playBell();
      });
      updateInfo();
    });
  }

  private showWaitingLobby(code: string, isHost: boolean) {
    document.getElementById('panel-browse')?.classList.remove('active');
    document.getElementById('panel-host')?.classList.remove('active');
    document.getElementById('panel-join')?.classList.remove('active');
    document.querySelector('.lobby-tabs')?.classList.add('hidden');

    const waiting = document.getElementById('lobby-waiting-area');
    waiting?.classList.remove('hidden');

    const codeDisplay = document.getElementById('lobby-code-display');
    if (codeDisplay) codeDisplay.textContent = code;

    const startBtn = document.getElementById('btn-start-game');
    if (startBtn) {
      startBtn.style.display = isHost ? 'block' : 'none';
    }
  }

  private setupNetworkEvents() {
    this.network.onRoomListUpdate = (rooms: PublicRoomInfo[]) => {
      this.renderRoomList(rooms);
    };

    this.network.onStateUpdate = (state: GameState) => {
      this.currentState = state;
      this.worldMap.updateState(state, this.network.playerId);
      this.ui.updateState(state, this.network.playerId);

      // If in lobby, update roster
      if (state.status === 'lobby') {
        this.updateLobbyRoster(state);
      } else if (state.status === 'playing') {
        // Switch to game screen if not already
        const lobbyView = document.getElementById('view-lobby');
        const gameView = document.getElementById('view-game');
        const header = document.getElementById('global-header');

        if (lobbyView?.classList.contains('active')) {
          lobbyView.classList.remove('active');
          gameView?.classList.remove('hidden');
          gameView?.classList.add('active');
          header?.classList.remove('hidden');
          sounds.playBell();
          this.ui.showToast('Global Simulation active! Charter your first cargo at Rotterdam.', 'success');
        }
      }
    };

    this.network.onNews = (news) => {
      const ticker = document.getElementById('news-ticker-text');
      if (ticker) {
        ticker.textContent = news.headline;
        ticker.style.color = news.type === 'alert' ? '#ff4757' : news.type === 'warning' ? '#ffa502' : '#90b0d0';
      }
    };

    this.network.onActionResult = (res) => {
      if (res.success) {
        this.ui.showToast(res.message, 'success');
        if (
          res.action === 'accept_charter' ||
          res.action === 'bank_transaction' ||
          res.action === 'buy_ship' ||
          res.action === 'repair_ship' ||
          res.action === 'bunker_fuel'
        ) {
          sounds.playCash();
        } else if (res.action === 'start_voyage') {
          sounds.playDepartureWhistle();
          setTimeout(() => sounds.playFoghorn(), 700);
        } else if (res.action === 'minigame_complete' || res.action === 'auto_dock' || res.action === 'bypass_hazard') {
          sounds.playBell();
          sounds.playCash();
          this.returnToGameView();
        }
      } else {
        this.ui.showToast(res.message, 'error');
        sounds.playErrorBuzz();
      }
    };

    this.network.onMinigameStart = (data) => {
      this.activeMinigameShipId = data.shipId;
      if (data.type === 'docking') {
        this.startDockingMinigame(data.shipId, data.portId || 'rotterdam');
      } else if (data.type === 'hazard') {
        this.startHazardMinigame(data.shipId, (data.hazardType as any) || 'iceberg');
      }
    };

    this.ui.onLaunchMinigame = (data) => {
      this.activeMinigameShipId = data.shipId;
      if (data.type === 'docking') {
        this.startDockingMinigame(data.shipId, data.portId || 'rotterdam');
      } else if (data.type === 'hazard') {
        this.startHazardMinigame(data.shipId, (data.hazardType as any) || 'iceberg');
      }
    };

    this.network.onError = (msg) => {
      this.ui.showToast(msg, 'error');
    };
  }

  private updateLobbyRoster(state: GameState) {
    const list = document.getElementById('roster-list');
    const count = document.getElementById('roster-count');
    if (!list) return;

    const players = Object.values(state.players);
    if (count) count.textContent = `${players.length}`;

    list.innerHTML = '';
    players.forEach((p) => {
      const li = document.createElement('li');
      li.className = 'roster-item';
      li.innerHTML = `
        <span class="roster-dot" style="background: ${p.color};"></span>
        <span>${p.name}</span>
        ${p.id === state.hostId ? '<span style="color: #ffa502; font-size: 0.75rem; margin-left: auto;">[HOST]</span>' : ''}
      `;
      list.appendChild(li);
    });
  }

  private startDockingMinigame(shipId: string, portId: string) {
    const port = WORLD_PORTS.find((p) => p.id === portId) || WORLD_PORTS[0];
    const player = this.network.playerId && this.currentState ? this.currentState.players[this.network.playerId] : null;
    const ship = player?.ships.find((s) => s.id === shipId);
    const blueprint = SHIP_BLUEPRINTS.find((b) => b.id === ship?.blueprintId) || SHIP_BLUEPRINTS[0];
    const playerColor = player?.color || '#00d2ff';
    const shipName = ship?.name || 'MY VESSEL';

    const gameView = document.getElementById('view-game');
    const dockingView = document.getElementById('view-docking-3d');

    gameView?.classList.remove('active');
    gameView?.classList.add('hidden');
    dockingView?.classList.remove('hidden');
    dockingView?.classList.add('active');

    if (!this.dockingGame) {
      this.dockingGame = new HarborDocking3D('three-docking-container', (result) => {
        this.network.completeMinigame(shipId, result.score, result.damagePercent, result.success);
      });
    }

    this.dockingGame.start(port, shipName, blueprint.type, playerColor);
  }

  private startHazardMinigame(shipId: string, hazardType: 'iceberg' | 'reef') {
    const player = this.network.playerId && this.currentState ? this.currentState.players[this.network.playerId] : null;
    const ship = player?.ships.find((s) => s.id === shipId);
    const blueprint = SHIP_BLUEPRINTS.find((b) => b.id === ship?.blueprintId) || SHIP_BLUEPRINTS[0];
    const playerColor = player?.color || '#00d2ff';
    const shipName = ship?.name || 'MY VESSEL';

    const gameView = document.getElementById('view-game');
    const hazardView = document.getElementById('view-hazard-3d');

    gameView?.classList.remove('active');
    gameView?.classList.add('hidden');
    hazardView?.classList.remove('hidden');
    hazardView?.classList.add('active');

    if (!this.hazardGame) {
      this.hazardGame = new HazardNav3D('three-hazard-container', (result) => {
        this.network.completeMinigame(shipId, 100, result.damagePercent, result.success);
      });
    }

    this.hazardGame.start(hazardType, shipName, blueprint.type, playerColor);
  }

  private returnToGameView() {
    this.dockingGame?.stop();
    this.hazardGame?.stop();

    const dockingView = document.getElementById('view-docking-3d');
    const hazardView = document.getElementById('view-hazard-3d');
    const gameView = document.getElementById('view-game');

    dockingView?.classList.remove('active');
    dockingView?.classList.add('hidden');
    hazardView?.classList.remove('active');
    hazardView?.classList.add('hidden');

    gameView?.classList.remove('hidden');
    gameView?.classList.add('active');
    this.activeMinigameShipId = null;
  }
}

// Boot application
window.addEventListener('DOMContentLoaded', () => {
  new App();
});
