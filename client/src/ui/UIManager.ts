import {
  GameState,
  PlayerCompany,
  PlayerShip,
  Port,
  WORLD_PORTS,
  SHIP_BLUEPRINTS,
  CharterContract,
  COMMODITIES,
  canShipAcceptContract,
  getWorldShipStock
} from '@portofcall/shared';
import { NetworkClient } from '../network/NetworkClient.js';
import { sounds } from '../sound/SoundManager.js';
import { getShipIllustrationSVG } from './ShipIllustrations.js';

export class UIManager {
  private network: NetworkClient;
  private selectedShipId: string | null = null;
  private currentState: GameState | null = null;
  public onLaunchMinigame: ((data: { shipId: string; type: 'docking' | 'hazard'; portId?: string; hazardType?: string }) => void) | null = null;

  constructor(network: NetworkClient) {
    this.network = network;
    this.setupNavigation();
    this.setupPortModal();
    this.setupBankActions();
    this.setupSliderArrows();
  }

  public showToast(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(50px)';
      setTimeout(() => toast.remove(), 300);
    }, 4500);
  }

  public selectShip(shipId: string) {
    this.selectedShipId = shipId;
  }

  public switchTab(targetId: string) {
    const navTabs = document.querySelectorAll('.nav-tab');
    navTabs.forEach((t) => {
      if (t.getAttribute('data-target') === targetId) {
        t.classList.add('active');
      } else {
        t.classList.remove('active');
      }
    });

    const subviews = document.querySelectorAll('.game-subview');
    subviews.forEach((sub) => {
      if (sub.id === targetId) {
        sub.classList.add('active');
      } else {
        sub.classList.remove('active');
      }
    });

    // Trigger subview specific updates
    if (targetId === 'tab-broker') {
      this.renderBrokerView();
    } else if (targetId === 'tab-shipyard') {
      this.renderShipyardView();
    } else if (targetId === 'tab-worldmap') {
      window.dispatchEvent(new Event('resize'));
    }
  }

  private setupNavigation() {
    const navTabs = document.querySelectorAll('.nav-tab');
    navTabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const targetId = tab.getAttribute('data-target');
        if (targetId) this.switchTab(targetId);
      });
    });

    // Sound toggle button
    const soundBtn = document.getElementById('btn-sound-toggle');
    if (soundBtn) {
      soundBtn.addEventListener('click', () => {
        const unmuted = sounds.toggleMute();
        soundBtn.textContent = unmuted ? '🔊' : '🔇';
      });
    }

    const brokerTopBack = document.getElementById('btn-broker-top-back');
    if (brokerTopBack) {
      brokerTopBack.addEventListener('click', () => this.switchTab('tab-fleet'));
    }
  }

  private setupSliderArrows() {
    const bindArrow = (prevId: string, nextId: string, sliderId: string) => {
      const prev = document.getElementById(prevId);
      const next = document.getElementById(nextId);
      const slider = document.getElementById(sliderId);
      if (prev && slider) {
        prev.onclick = () => slider.scrollBy({ left: -190, behavior: 'smooth' });
      }
      if (next && slider) {
        next.onclick = () => slider.scrollBy({ left: 190, behavior: 'smooth' });
      }
    };

    bindArrow('btn-broker-ship-prev', 'btn-broker-ship-next', 'broker-vessel-slider');
    bindArrow('btn-yard-ship-prev', 'btn-yard-ship-next', 'yard-vessel-slider');
  }

  private renderVesselSlider(
    containerId: string,
    player: PlayerCompany,
    onSelect: () => void,
    allowDockedOnly: boolean = false
  ) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const dockedShips = player.ships.filter((s) => s.status === 'docked');

    if (allowDockedOnly) {
      if (!this.selectedShipId || !dockedShips.some((s) => s.id === this.selectedShipId)) {
        this.selectedShipId = dockedShips[0]?.id || null;
      }
    } else {
      if (!this.selectedShipId || !player.ships.some((s) => s.id === this.selectedShipId)) {
        this.selectedShipId = player.ships[0]?.id || null;
      }
    }

    container.innerHTML = player.ships.map((ship) => {
      const bp = SHIP_BLUEPRINTS.find((b) => b.id === ship.blueprintId) || SHIP_BLUEPRINTS[0];
      const isSelected = ship.id === this.selectedShipId;
      const isDocked = ship.status === 'docked';
      const isDisabled = allowDockedOnly && !isDocked;
      const port = WORLD_PORTS.find((p) => p.id === ship.currentPortId);
      const portName = port ? port.name : 'Unknown Port';

      let statusBadge = '';
      if (isDocked) {
        statusBadge = `<span class="vsc-badge badge-docked">⚓ DOCKED @ ${portName.toUpperCase()}</span>`;
      } else if (ship.status === 'sailing') {
        statusBadge = isDisabled
          ? `<span class="vsc-badge badge-disabled">🌊 AT SEA (DISABLED)</span>`
          : `<span class="vsc-badge badge-sailing">🌊 AT SEA (${ship.currentVoyage?.progressPercent || 0}%)</span>`;
      } else {
        statusBadge = isDisabled
          ? `<span class="vsc-badge badge-disabled">⚠️ HAZARD (DISABLED)</span>`
          : `<span class="vsc-badge badge-hazard">⚠️ IN HAZARD</span>`;
      }

      return `
        <div class="vessel-selector-card ${isSelected ? 'active' : ''} ${isDocked ? 'is-docked' : 'is-sailing'} ${isDisabled ? 'is-disabled' : ''}" 
             data-ship-id="${ship.id}"
             data-disabled="${isDisabled ? 'true' : 'false'}"
             title="${isDisabled ? `${ship.name} is currently at sea (cannot charter or service)` : `Select ${ship.name}`}">
          <div class="vsc-icon-wrap">
            ${getShipIllustrationSVG(bp.type, player.color)}
          </div>
          <div class="vsc-info">
            <div class="vsc-name-row">
              <strong class="vsc-name">${ship.name}</strong>
              ${isSelected ? '<span class="vsc-active-pill">SELECTED</span>' : ''}
            </div>
            <div class="vsc-specs">${bp.name} • ${bp.capacityTons.toLocaleString()}t DWT</div>
            <div class="vsc-status-row">${statusBadge}</div>
          </div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.vessel-selector-card').forEach((card) => {
      card.addEventListener('click', () => {
        if (card.getAttribute('data-disabled') === 'true') return;
        const shipId = card.getAttribute('data-ship-id');
        if (shipId && shipId !== this.selectedShipId) {
          this.selectedShipId = shipId;
          sounds.playBell();
          onSelect();
        }
      });
    });

    // Auto-scroll active card into visible track area
    const activeCard = container.querySelector('.vessel-selector-card.active') as HTMLElement | null;
    if (activeCard) {
      setTimeout(() => {
        activeCard.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }, 50);
    }
  }

  private setupPortModal() {
    const closeBtn = document.getElementById('btn-close-port-modal');
    const modal = document.getElementById('port-modal');
    if (closeBtn && modal) {
      closeBtn.onclick = () => modal.classList.add('hidden');
      modal.onclick = (e) => {
        if (e.target === modal) modal.classList.add('hidden');
      };
    }
  }

  public openPortModal(port: Port) {
    const modal = document.getElementById('port-modal');
    if (!modal) return;

    document.getElementById('port-modal-title')!.textContent = port.name;
    document.getElementById('port-modal-country')!.textContent = port.country;
    document.getElementById('port-modal-desc')!.textContent = port.description;

    const fuelPrice = this.currentState?.bunkerPrices[port.id] || port.fuelPricePerTon;
    document.getElementById('port-modal-fuel')!.textContent = `$${fuelPrice} / ton`;
    document.getElementById('port-modal-fee')!.textContent = `$${port.portFeePerCall.toLocaleString()}`;
    document.getElementById('port-modal-drydock')!.textContent = port.hasDrydock ? 'Available' : 'None';

    const jumpBtn = document.getElementById('btn-jump-to-charters');
    if (jumpBtn) {
      jumpBtn.onclick = () => {
        modal.classList.add('hidden');
        // Switch to broker tab
        const brokerTab = document.querySelector('[data-target="tab-broker"]') as HTMLButtonElement;
        if (brokerTab) brokerTab.click();
      };
    }

    modal.classList.remove('hidden');
  }

  private setupBankActions() {
    const borrowBtn = document.getElementById('btn-bank-borrow');
    const repayBtn = document.getElementById('btn-bank-repay');

    if (borrowBtn) {
      borrowBtn.onclick = () => {
        const input = document.getElementById('input-borrow-amount') as HTMLInputElement;
        const amount = parseInt(input?.value || '0', 10);
        if (amount > 0) {
          this.network.bankTransaction('borrow', amount);
        }
      };
    }

    if (repayBtn) {
      repayBtn.onclick = () => {
        const input = document.getElementById('input-repay-amount') as HTMLInputElement;
        const amount = parseInt(input?.value || '0', 10);
        if (amount > 0) {
          this.network.bankTransaction('repay', amount);
        }
      };
    }
  }

  public updateState(state: GameState, myPlayerId: string | null) {
    this.currentState = state;

    // 1. Header Global Info
    const codeEl = document.getElementById('display-room-code');
    if (codeEl) codeEl.textContent = state.roomCode;

    const dateEl = document.getElementById('display-game-date');
    if (dateEl) dateEl.textContent = `DAY ${state.currentDay}`;

    // 2. Player Financial Pills
    const myPlayer = myPlayerId ? state.players[myPlayerId] : null;
    if (myPlayer) {
      const cashEl = document.getElementById('display-cash');
      if (cashEl) {
        cashEl.textContent = `$${myPlayer.cash.toLocaleString()}`;
        cashEl.style.color = myPlayer.cash < 0 ? '#ff4757' : '#e8f4fc';
      }

      const loanEl = document.getElementById('display-loan');
      if (loanEl) loanEl.textContent = `$${myPlayer.loanBalance.toLocaleString()}`;

      const repEl = document.getElementById('display-rep');
      if (repEl) repEl.textContent = `${myPlayer.reputation}/100`;

      // Select first ship by default if not set
      if (!this.selectedShipId && myPlayer.ships.length > 0) {
        this.selectedShipId = myPlayer.ships[0].id;
      }

      // Update Bank tab info
      const limitEl = document.getElementById('bank-credit-limit');
      if (limitEl) limitEl.textContent = `$${myPlayer.creditLimit.toLocaleString()}`;

      const debtEl = document.getElementById('bank-current-debt');
      if (debtEl) debtEl.textContent = `$${myPlayer.loanBalance.toLocaleString()}`;

      const availEl = document.getElementById('bank-avail-credit');
      if (availEl) {
        const avail = Math.max(0, myPlayer.creditLimit - myPlayer.loanBalance);
        availEl.textContent = `$${avail.toLocaleString()}`;
      }
    }

    // 3. Render Fleet Cards
    this.renderFleetView(myPlayer);

    // 4. Render Active Voyages list in Map overlay
    this.renderMapVoyages(state);

    // 5. Render Leaderboard
    this.renderLeaderboard(state);

    // 6. Refresh current tab
    const activeSub = document.querySelector('.game-subview.active');
    if (activeSub?.id === 'tab-broker') {
      this.renderBrokerView();
    } else if (activeSub?.id === 'tab-shipyard') {
      this.renderShipyardView();
    }
  }

  private renderFleetView(player: PlayerCompany | null) {
    const container = document.getElementById('fleet-card-container');
    if (!container || !player) return;

    container.innerHTML = '';

    player.ships.forEach((ship) => {
      const bp = SHIP_BLUEPRINTS.find((b) => b.id === ship.blueprintId) || SHIP_BLUEPRINTS[0];
      const isDocked = ship.status === 'docked';
      const card = document.createElement('div');
      card.className = isDocked ? 'ship-card is-docked-disabled' : 'ship-card is-sailing-active';

      const port = WORLD_PORTS.find((p) => p.id === ship.currentPortId);
      const portName = port ? port.name : 'PORT';

      const statusClass = isDocked
        ? 'status-disabled'
        : ship.status === 'sailing'
        ? 'status-sailing'
        : 'status-minigame';

      const statusText = isDocked
        ? `⚓ DOCKED IN ${portName.toUpperCase()} (INACTIVE IN FLEET)`
        : ship.status === 'sailing'
        ? `SAILING TO ${WORLD_PORTS.find((p) => p.id === ship.currentVoyage?.destinationPortId)?.name || 'PORT'}`
        : 'NAVIGATING OBSTACLE';

      const fuelPercent = Math.round((ship.fuelTons / bp.fuelCapacityTons) * 100);

      card.innerHTML = `
        <div class="ship-card-header">
          <div>
            <div class="ship-name-title">${ship.name}</div>
            <div class="ship-class-tag">${bp.name} (${bp.capacityTons.toLocaleString()}t DWT)</div>
          </div>
          <span class="ship-status-badge ${statusClass}">${statusText}</span>
        </div>

        <div class="ship-card-illustration">
          ${getShipIllustrationSVG(bp.type, player.color)}
        </div>

        <div class="ship-gauges">
          <div class="gauge-item">
            <div class="gauge-label">
              <span>Hull Integrity</span>
              <strong>${ship.hullCondition}%</strong>
            </div>
            <div class="gauge-track">
              <div class="gauge-fill ${ship.hullCondition > 60 ? 'fill-emerald' : 'fill-crimson'}" style="width: ${ship.hullCondition}%;"></div>
            </div>
          </div>

          <div class="gauge-item">
            <div class="gauge-label">
              <span>Engine Status</span>
              <strong>${ship.engineCondition}%</strong>
            </div>
            <div class="gauge-track">
              <div class="gauge-fill ${ship.engineCondition > 60 ? 'fill-cyan' : 'fill-gold'}" style="width: ${ship.engineCondition}%;"></div>
            </div>
          </div>

          <div class="gauge-item">
            <div class="gauge-label">
              <span>Bunker Fuel</span>
              <strong>${ship.fuelTons}t (${fuelPercent}%)</strong>
            </div>
            <div class="gauge-track">
              <div class="gauge-fill fill-gold" style="width: ${fuelPercent}%;"></div>
            </div>
          </div>

          <div class="gauge-item">
            <div class="gauge-label">
              <span>Cruising Speed</span>
              <strong>${bp.maxSpeedKnots} knots</strong>
            </div>
            <div class="gauge-track">
              <div class="gauge-fill fill-cyan" style="width: 100%;"></div>
            </div>
          </div>
        </div>

        <div class="ship-cargo-box">
          <h5>${ship.cargo && (ship.cargo.commodity.toLowerCase().includes('passenger') || ship.cargo.commodity.toLowerCase().includes('cruise') || ship.cargo.commodity.toLowerCase().includes('tour')) ? 'PASSENGER MANIFEST' : 'CARGO MANIFEST'}</h5>
          ${
            ship.cargo
              ? `
            <div class="cargo-active-line">${ship.cargo.commodity.toLowerCase().includes('passenger') || ship.cargo.commodity.toLowerCase().includes('cruise') || ship.cargo.commodity.toLowerCase().includes('tour') ? '🚢' : '📦'} ${ship.cargo.tonnage.toLocaleString()}${ship.cargo.commodity.toLowerCase().includes('passenger') || ship.cargo.commodity.toLowerCase().includes('cruise') || ship.cargo.commodity.toLowerCase().includes('tour') ? ' pax' : 't'} ${ship.cargo.commodity}</div>
            <div class="cargo-payout-line">Payout: +$${ship.cargo.payment.toLocaleString()} (Due Day ${ship.cargo.deadlineDay})</div>
          `
              : `<div class="text-muted">Holds & cabins empty. Available for charter.</div>`
          }
        </div>

        ${
          ship.currentVoyage
            ? `
          <div class="voyage-progress-box">
            <div class="gauge-label">
              <span>Voyage Progress</span>
              <strong>${ship.currentVoyage.progressPercent}%</strong>
            </div>
            <div class="voyage-progress-bar">
              <div class="voyage-progress-fill" style="width: ${ship.currentVoyage.progressPercent}%;"></div>
            </div>
          </div>
        `
            : ''
        }

        ${
          ship.status === 'hazard_minigame'
            ? `
          <div class="hazard-alert-box" style="background: rgba(255, 71, 87, 0.15); border: 1px solid #ff4757; border-radius: 8px; padding: 8px 12px;">
            <div style="color: #ff4757; font-weight: 700; font-size: 0.85rem;">⚠️ OCEAN OBSTACLE ENCOUNTERED</div>
            <div style="font-size: 0.78rem; color: #e8f4fc; margin: 4px 0;">Floating ${ship.currentVoyage?.hazardPending || 'hazard'} in shipping lane! Take control or steer clear.</div>
            <div style="display: flex; gap: 6px; margin-top: 6px;">
              <button class="btn btn-warning btn-sm btn-helm-hazard" data-id="${ship.id}" data-hazard="${ship.currentVoyage?.hazardPending || 'iceberg'}">🎮 Take Helm (3D)</button>
              <button class="btn btn-secondary btn-sm btn-bypass-hazard" data-id="${ship.id}">🛡️ Cautious Bypass</button>
            </div>
          </div>
        `
            : ''
        }

        ${
          ship.status === 'docking_minigame'
            ? `
          <div class="docking-alert-box" style="background: rgba(0, 210, 255, 0.15); border: 1px solid #00d2ff; border-radius: 8px; padding: 8px 12px;">
            <div style="color: #00d2ff; font-weight: 700; font-size: 0.85rem;">⚓ ARRIVED OFF HARBOR BERTH</div>
            <div style="font-size: 0.78rem; color: #e8f4fc; margin: 4px 0;">Vessel waiting to enter harbor slip. Manual steer or hire tugs.</div>
            <div style="display: flex; gap: 6px; margin-top: 6px;">
              <button class="btn btn-primary btn-sm btn-manual-dock" data-id="${ship.id}" data-port="${ship.currentVoyage?.destinationPortId || 'rotterdam'}">🎮 Manual Docking (3D)</button>
              <button class="btn btn-warning btn-sm btn-hire-tugs-card" data-id="${ship.id}">⚓ Hire Tugs ($12k)</button>
            </div>
          </div>
        `
            : ''
        }

        <div class="ship-actions-row">
          ${
            isDocked
              ? `<div class="docked-inactive-notice">⚓ Berthed in ${portName} — Non-clickable in Fleet view. Manage in Freight Market or Shipyard.</div>`
              : ship.status === 'sailing'
              ? `<button class="btn btn-primary btn-sm btn-track-voyage" data-id="${ship.id}">🗺️ Track on Sea Map (${ship.currentVoyage?.progressPercent || 0}%)</button>`
              : ''
          }
        </div>
      `;

      // Event listeners for action buttons
      if (!isDocked) {
        card.addEventListener('click', (e) => {
          if ((e.target as HTMLElement).closest('button')) return;
          this.switchTab('tab-worldmap');
        });
      }

      const trackBtn = card.querySelector('.btn-track-voyage');
      if (trackBtn) {
        trackBtn.addEventListener('click', () => {
          this.switchTab('tab-worldmap');
        });
      }

      const helmHazardBtn = card.querySelector('.btn-helm-hazard') as HTMLButtonElement;
      if (helmHazardBtn) {
        helmHazardBtn.addEventListener('click', () => {
          const hazardType = helmHazardBtn.getAttribute('data-hazard') || 'iceberg';
          if (this.onLaunchMinigame) {
            this.onLaunchMinigame({ shipId: ship.id, type: 'hazard', hazardType });
          }
        });
      }

      const bypassHazardBtn = card.querySelector('.btn-bypass-hazard');
      if (bypassHazardBtn) {
        bypassHazardBtn.addEventListener('click', () => {
          this.network.bypassHazard(ship.id);
        });
      }

      const manualDockBtn = card.querySelector('.btn-manual-dock') as HTMLButtonElement;
      if (manualDockBtn) {
        manualDockBtn.addEventListener('click', () => {
          const portId = manualDockBtn.getAttribute('data-port') || 'rotterdam';
          if (this.onLaunchMinigame) {
            this.onLaunchMinigame({ shipId: ship.id, type: 'docking', portId });
          }
        });
      }

      const hireTugsCardBtn = card.querySelector('.btn-hire-tugs-card');
      if (hireTugsCardBtn) {
        hireTugsCardBtn.addEventListener('click', () => {
          this.network.autoDock(ship.id);
        });
      }

      container.appendChild(card);
    });
  }

  private renderMapVoyages(state: GameState) {
    const list = document.getElementById('map-active-voyages');
    if (!list) return;

    let hasVoyages = false;
    let html = '';

    for (const pId in state.players) {
      const p = state.players[pId];
      for (const ship of p.ships) {
        if (ship.status === 'sailing' && ship.currentVoyage) {
          hasVoyages = true;
          const origin = WORLD_PORTS.find((pt) => pt.id === ship.currentVoyage?.originPortId)?.name || 'Origin';
          const dest = WORLD_PORTS.find((pt) => pt.id === ship.currentVoyage?.destinationPortId)?.name || 'Destination';

          html += `
            <div class="voyage-item">
              <div class="voyage-vessel-name">
                <span>${ship.name}</span>
                <span style="color: ${p.color}">${ship.currentVoyage.progressPercent}%</span>
              </div>
              <div class="voyage-route-tag">${origin} ➔ ${dest}</div>
              <div class="voyage-progress-bar">
                <div class="voyage-progress-fill" style="width: ${ship.currentVoyage.progressPercent}%; background: ${p.color};"></div>
              </div>
            </div>
          `;
        }
      }
    }

    list.innerHTML = hasVoyages
      ? html
      : `<div class="empty-hint">No vessels currently at sea. Dock at a port to charter cargo.</div>`;
  }

  private renderBrokerView() {
    if (!this.currentState || !this.network.playerId) return;

    const player = this.currentState.players[this.network.playerId];
    if (!player) return;

    this.renderVesselSlider('broker-vessel-slider', player, () => {
      this.renderBrokerView();
    }, true);

    const dockedShips = player.ships.filter((s) => s.status === 'docked');
    const container = document.getElementById('contract-list-container');
    if (!container) return;

    if (dockedShips.length === 0) {
      container.innerHTML = `
        <div class="glass-panel" style="padding: 2.5rem; grid-column: 1 / -1; text-align: center;">
          <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">🌊</div>
          <h3 style="color: #00d2ff;">All Vessels Currently at Sea</h3>
          <p class="text-secondary" style="max-width: 500px; margin: 0.5rem auto 1.5rem auto;">
            Charter contracts can only be negotiated and loaded while a vessel is berthed in a harbor. Wait for a vessel to arrive in port, or view voyages in Fleet Management.
          </p>
          <button id="btn-broker-to-fleet" class="btn btn-primary">
            🏢 Open Fleet Management
          </button>
        </div>
      `;
      document.getElementById('btn-broker-to-fleet')?.addEventListener('click', () => this.switchTab('tab-fleet'));
      return;
    }

    const currentShip = player.ships.find((s) => s.id === this.selectedShipId && s.status === 'docked') || dockedShips[0];
    if (!currentShip || !currentShip.currentPortId) return;

    if (currentShip.cargo) {
      const isPaxCargo = currentShip.cargo.commodity.toLowerCase().includes('passenger') ||
                         currentShip.cargo.commodity.toLowerCase().includes('cruise') ||
                         currentShip.cargo.commodity.toLowerCase().includes('tour');
      container.innerHTML = `
        <div class="glass-panel" style="padding: 2rem; grid-column: 1 / -1; text-align: center;">
          <h3>${isPaxCargo ? 'Passengers Already Embarked' : 'Holds Already Loaded'}</h3>
          <p class="text-secondary">${currentShip.name} is carrying ${currentShip.cargo.tonnage.toLocaleString()}${isPaxCargo ? ' passengers on ' : 't of '}${currentShip.cargo.commodity}. Cast off to deliver this ${isPaxCargo ? 'voyage' : 'freight'}!</p>
          <div style="display: flex; gap: 12px; justify-content: center; align-items: center; margin-top: 1.25rem; flex-wrap: wrap;">
            <button id="btn-broker-sail" class="btn btn-success">Cast Off Now</button>
            <button id="btn-broker-back-loaded" class="btn btn-primary">⬅ Return to Fleet Management</button>
          </div>
        </div>
      `;
      const sailBtn = document.getElementById('btn-broker-sail');
      if (sailBtn) {
        sailBtn.onclick = () => this.network.startVoyage(currentShip.id);
      }
      const backLoadedBtn = document.getElementById('btn-broker-back-loaded');
      if (backLoadedBtn) {
        backLoadedBtn.onclick = () => this.switchTab('tab-fleet');
      }
      return;
    }

    const portContracts = this.currentState.availableContracts[currentShip.currentPortId] || [];
    const originPort = WORLD_PORTS.find((p) => p.id === currentShip.currentPortId);
    const bp = SHIP_BLUEPRINTS.find((b) => b.id === currentShip.blueprintId) || SHIP_BLUEPRINTS[0];

    if (portContracts.length === 0) {
      container.innerHTML = `
        <div class="glass-panel" style="padding: 2rem; grid-column: 1 / -1; text-align: center;">
          <h3>No Freights or Passenger Charters Available in ${originPort?.name}</h3>
          <p class="text-secondary">All local charter requests have been chartered. Wait for the market refresh.</p>
          <button id="btn-broker-back-empty" class="btn btn-primary btn-sm" style="margin-top: 1.25rem;">
            ⬅ Return to Fleet Management
          </button>
        </div>
      `;
      document.getElementById('btn-broker-back-empty')?.addEventListener('click', () => this.switchTab('tab-fleet'));
      return;
    }

    container.innerHTML = '';
    portContracts.forEach((contract) => {
      const destPort = WORLD_PORTS.find((p) => p.id === contract.destinationPortId);
      const card = document.createElement('div');
      card.className = 'contract-card';

      const commDef = COMMODITIES.find((c) => c.name === contract.commodity);
      const category = contract.category || commDef?.category || 'cargo';
      const specialTitle = contract.specialEventTitle || commDef?.specialEventTitle;

      const check = canShipAcceptContract(bp, contract.commodity);
      const canCarryCapacity = contract.tonnage <= bp.capacityTons;
      const isAllowed = check.allowed && canCarryCapacity;

      const isSpecial = category === 'special_event';
      const isPax = category === 'passenger' || isSpecial;
      const icon = isSpecial
        ? (specialTitle?.includes('WEDDING') ? '💍' : specialTitle?.includes('HOSTAGE') ? '🕊️' : '🔬')
        : (isPax ? '🚢' : '📦');
      const payloadLabel = isPax ? 'Passengers' : 'Tonnage';

      const typeBadge = isSpecial
        ? `<span class="badge-contract-special">${specialTitle || '🌟 SPECIAL EVENT'}</span>`
        : isPax
        ? `<span class="badge-contract-pax">🚢 PASSENGER LINE</span>`
        : `<span class="badge-contract-cargo">📦 CARGO FREIGHT</span>`;

      let btnText = 'Book Charter';
      if (!check.allowed) {
        if (bp.type === 'passenger') {
          btnText = 'Passenger Liner Only';
        } else if (['freighter', 'bulk', 'container', 'tanker'].includes(bp.type)) {
          btnText = 'Cargo Ship: No Pax';
        } else if (bp.type === 'tramp') {
          btnText = 'Special Events Only (Tramp)';
        } else {
          btnText = 'Incompatible Vessel';
        }
      } else if (!canCarryCapacity) {
        btnText = 'Capacity Exceeded';
      } else if (isSpecial) {
        btnText = 'Accept Special Charter';
      } else if (isPax) {
        btnText = 'Embark Passengers';
      }

      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
          <div class="contract-cargo-name">${icon} ${contract.commodity}</div>
          ${typeBadge}
        </div>
        <div class="contract-route">
          <span>${originPort?.name}</span> ➔ <strong>${destPort?.name}</strong>
        </div>
        <div class="contract-specs">
          <div>${payloadLabel}: <strong>${contract.tonnage.toLocaleString()}${isPax ? ' pax' : 't'}</strong></div>
          <div>Distance: <strong>${contract.distanceNauticalMiles.toLocaleString()} nm</strong></div>
          <div>Deadline: <strong>Day ${contract.deadlineDay}</strong></div>
          <div>Expires: <strong>Day ${contract.expiryDay}</strong></div>
        </div>
        <div class="contract-payout">+$${contract.payment.toLocaleString()}</div>
        <button class="btn ${isAllowed ? 'btn-primary' : 'btn-secondary btn-disabled'} btn-sm btn-accept-contract" title="${!check.allowed ? check.reason : ''}">
          ${btnText}
        </button>
      `;

      const btn = card.querySelector('.btn-accept-contract');
      if (btn) {
        btn.addEventListener('click', () => {
          if (!check.allowed) {
            sounds.playErrorBuzz();
            this.showToast(check.reason || 'This vessel is not permitted to accept this charter.', 'warning');
            return;
          }
          if (!canCarryCapacity) {
            sounds.playErrorBuzz();
            this.showToast(`${isPax ? 'Passenger count' : 'Cargo tonnage'} (${contract.tonnage.toLocaleString()}${isPax ? ' pax' : 't'}) exceeds ship capacity (${bp.capacityTons.toLocaleString()}t)!`, 'warning');
            return;
          }
          this.network.acceptCharter(currentShip.id, contract.id);
        });
      }

      container.appendChild(card);
    });

    // Last step of freight exchange: Action footer to return to fleet operations
    const footerBar = document.createElement('div');
    footerBar.style.gridColumn = '1 / -1';
    footerBar.style.marginTop = '1.25rem';
    footerBar.style.paddingTop = '1rem';
    footerBar.style.borderTop = '1px solid rgba(255, 255, 255, 0.1)';
    footerBar.style.display = 'flex';
    footerBar.style.justifyContent = 'space-between';
    footerBar.style.alignItems = 'center';
    footerBar.style.flexWrap = 'wrap';
    footerBar.style.gap = '10px';

    footerBar.innerHTML = `
      <button id="btn-broker-back-bottom" class="btn btn-primary btn-sm" style="display: inline-flex; align-items: center; gap: 6px;">
        <span>⬅ Return to Fleet Management</span>
      </button>
      <span style="font-size: 0.8rem; color: #90b0d0;">Review active fleet voyages and manage vessels in Fleet Operations</span>
    `;
    container.appendChild(footerBar);

    const backBtnBottom = document.getElementById('btn-broker-back-bottom');
    if (backBtnBottom) {
      backBtnBottom.onclick = () => this.switchTab('tab-fleet');
    }
  }

  private renderShipyardView() {
    if (!this.currentState || !this.network.playerId) return;
    const player = this.currentState.players[this.network.playerId];
    if (!player) return;

    this.renderVesselSlider('yard-vessel-slider', player, () => {
      this.renderShipyardView();
    }, true);

    const dockedShips = player.ships.filter((s) => s.status === 'docked');
    const detailsContainer = document.getElementById('yard-ship-details');
    if (detailsContainer) {
      if (dockedShips.length === 0) {
        detailsContainer.innerHTML = `
          <div style="padding: 2.5rem 1rem; text-align: center;">
            <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">⚓</div>
            <h4 style="color: #00d2ff;">No Vessels in Drydock Berth</h4>
            <p class="text-secondary" style="font-size: 0.85rem; margin-top: 0.5rem; line-height: 1.5;">
              All company vessels are sailing at sea. Ships must be berthed at a port facility to overhaul hull plates, service engines, or pump bunker fuel.
            </p>
            <button id="btn-yard-to-fleet" class="btn btn-secondary btn-sm" style="margin-top: 1.25rem;">
              🏢 View Sailing Fleets
            </button>
          </div>
        `;
        document.getElementById('btn-yard-to-fleet')?.addEventListener('click', () => this.switchTab('tab-fleet'));
        return;
      }

      const currentShip = player.ships.find((s) => s.id === this.selectedShipId && s.status === 'docked') || dockedShips[0];
      if (!currentShip || !currentShip.currentPortId) return;
      const bp = SHIP_BLUEPRINTS.find((b) => b.id === currentShip.blueprintId) || SHIP_BLUEPRINTS[0];
      const port = WORLD_PORTS.find((p) => p.id === currentShip.currentPortId);
      const fuelPrice = port ? this.currentState.bunkerPrices[port.id] || port.fuelPricePerTon : 500;
      const fuelNeeded = Math.round(bp.fuelCapacityTons - currentShip.fuelTons);
      const fillCost = Math.round(fuelNeeded * fuelPrice);

      detailsContainer.innerHTML = `
        <div class="ship-card-illustration" style="margin-bottom: 1rem;">
          ${getShipIllustrationSVG(bp.type, player.color)}
        </div>

        <div class="ship-gauges">
          <div class="gauge-item">
            <div class="gauge-label">
              <span>Hull Condition</span>
              <strong>${currentShip.hullCondition}%</strong>
            </div>
            <div class="gauge-track">
              <div class="gauge-fill ${currentShip.hullCondition > 60 ? 'fill-emerald' : 'fill-crimson'}" style="width: ${currentShip.hullCondition}%;"></div>
            </div>
          </div>

          <div class="gauge-item">
            <div class="gauge-label">
              <span>Marine Engine</span>
              <strong>${currentShip.engineCondition}%</strong>
            </div>
            <div class="gauge-track">
              <div class="gauge-fill fill-cyan" style="width: ${currentShip.engineCondition}%;"></div>
            </div>
          </div>
        </div>

        <div class="bunker-box" style="background: rgba(5, 11, 20, 0.6); padding: 12px; border-radius: 8px;">
          <div style="font-weight: 700; margin-bottom: 6px;">BUNKER FUEL DEPOT</div>
          <div style="font-size: 0.85rem; color: #90b0d0;">Local Fuel Price: <strong style="color: #ffa502;">$${fuelPrice} / ton</strong></div>
          <div style="font-size: 0.85rem; color: #90b0d0; margin-top: 4px;">Tanks: ${currentShip.fuelTons}t / ${bp.fuelCapacityTons}t</div>
          <button id="btn-fill-fuel" class="btn btn-warning btn-sm ${fuelNeeded <= 0 || !port ? 'btn-disabled' : ''}" style="margin-top: 8px;">
            ${fuelNeeded <= 0 ? 'Tanks Full (100%)' : `Fill Tanks (+${fuelNeeded}t for $${fillCost.toLocaleString()})`}
          </button>
        </div>

        <div class="drydock-box" style="background: rgba(5, 11, 20, 0.6); padding: 12px; border-radius: 8px;">
          <div style="font-weight: 700; margin-bottom: 6px; display: flex; align-items: center; justify-content: space-between;">
            <span>DRYDOCK REPAIRS</span>
            <span style="font-size: 0.72rem; font-weight: 700; padding: 2px 7px; border-radius: 4px; ${port?.hasDrydock ? 'background: rgba(46, 213, 115, 0.15); color: #2ed573; border: 1px solid #2ed573;' : 'background: rgba(255, 71, 87, 0.15); color: #ff4757; border: 1px solid #ff4757;'}">
              ${port?.hasDrydock ? 'FACILITY OPERATIONAL' : 'FACILITY UNAVAILABLE'}
            </span>
          </div>
          <div style="font-size: 0.85rem; color: #90b0d0;">
            Shipyard Facility: <strong style="${port?.hasDrydock ? 'color: #2ed573;' : 'color: #ff4757;'}">${port?.hasDrydock ? 'Operational' : 'Unavailable in this port'}</strong>
            ${!port?.hasDrydock ? `<div style="font-size: 0.75rem; color: #ff7675; margin-top: 4px;">⚠️ Heavy drydock repairs require major shipyard hubs (Rotterdam, London, New York, Hamburg, Singapore).</div>` : ''}
          </div>
          <div style="display: flex; gap: 8px; margin-top: 10px;">
            <button id="btn-repair-hull" class="btn btn-primary btn-sm ${!port?.hasDrydock || currentShip.hullCondition >= 100 ? 'btn-disabled' : ''}">
              Overhaul Hull (+15%)
            </button>
            <button id="btn-repair-engine" class="btn btn-secondary btn-sm ${!port?.hasDrydock || currentShip.engineCondition >= 100 ? 'btn-disabled' : ''}">
              Service Engine (+15%)
            </button>
          </div>
        </div>

        <div style="margin-top: 1.25rem; display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
          <button id="btn-back-to-fleet" class="btn btn-primary btn-sm" style="display: inline-flex; align-items: center; gap: 6px;">
            <span>⬅ Return to Fleet Management</span>
          </button>
          ${
            player.ships.length > 1
              ? `
            <button id="btn-sell-ship" class="btn btn-secondary btn-sm" style="border-color: #ff4757; color: #ff4757;">
              Sell Vessel to Shipbreaker
            </button>
          `
              : ''
          }
        </div>
      `;

      const backBtn = document.getElementById('btn-back-to-fleet');
      if (backBtn) {
        backBtn.onclick = () => this.switchTab('tab-fleet');
      }

      const fillBtn = document.getElementById('btn-fill-fuel');
      if (fillBtn) {
        fillBtn.onclick = () => {
          if (!port) {
            sounds.playErrorBuzz();
            this.showToast('Vessel must be berthed in a port to bunker fuel.', 'warning');
            return;
          }
          if (fuelNeeded <= 0) {
            sounds.playErrorBuzz();
            this.showToast('Bunker fuel tanks are already at maximum capacity.', 'info');
            return;
          }
          this.network.bunkerFuel(currentShip.id, fuelNeeded);
        };
      }

      const repHullBtn = document.getElementById('btn-repair-hull');
      if (repHullBtn) {
        repHullBtn.onclick = () => {
          if (!port?.hasDrydock) {
            sounds.playErrorBuzz();
            this.showToast(`Drydock facility unavailable in ${port?.name || 'this port'}! Sail to Rotterdam, Hamburg, London, New York, or Singapore.`, 'warning');
            return;
          }
          if (currentShip.hullCondition >= 100) {
            sounds.playErrorBuzz();
            this.showToast('Hull is already in pristine condition (100%).', 'info');
            return;
          }
          this.network.repairShip(currentShip.id, 'hull', 15);
        };
      }

      const repEngBtn = document.getElementById('btn-repair-engine');
      if (repEngBtn) {
        repEngBtn.onclick = () => {
          if (!port?.hasDrydock) {
            sounds.playErrorBuzz();
            this.showToast(`Drydock facility unavailable in ${port?.name || 'this port'}! Sail to Rotterdam, Hamburg, London, New York, or Singapore.`, 'warning');
            return;
          }
          if (currentShip.engineCondition >= 100) {
            sounds.playErrorBuzz();
            this.showToast('Marine engine is already in top operating condition (100%).', 'info');
            return;
          }
          this.network.repairShip(currentShip.id, 'engine', 15);
        };
      }

      const sellBtn = document.getElementById('btn-sell-ship');
      if (sellBtn) {
        sellBtn.onclick = () => {
          if (confirm(`Are you sure you want to sell "${currentShip.name}"?`)) {
            this.network.sellShip(currentShip.id);
          }
        };
      }
    }

    // Ship Catalog with World Fleet Quotas
    const catalog = document.getElementById('shipyard-catalog');
    if (catalog) {
      catalog.innerHTML = '';
      SHIP_BLUEPRINTS.forEach((bp) => {
        const item = document.createElement('div');
        item.className = 'catalog-card';

        const stock = this.currentState ? getWorldShipStock(this.currentState, bp.id) : { totalCap: 4, inService: 1, availableStock: 3, blueprintId: bp.id, blueprintName: bp.name };
        const isOutOfStock = stock.availableStock <= 0;
        const canAfford = player.cash - bp.baseCost >= -player.creditLimit;
        const canBuy = canAfford && !isOutOfStock;

        const roleBadge = bp.type === 'passenger'
          ? '<span class="badge-role pax">🚢 PASSENGER ONLY (NO CARGO)</span>'
          : bp.type === 'tramp'
          ? '<span class="badge-role tramp">⚓ TRAMP (CARGO + SPECIAL EVENTS)</span>'
          : '<span class="badge-role cargo">📦 CARGO ONLY (NO PAX)</span>';

        const stockBadge = isOutOfStock
          ? `<span class="stock-badge out-of-stock" title="All global shipyard slots for this vessel type are currently commissioned">🚫 WORLD FLEET FULL: ${stock.inService}/${stock.totalCap}</span>`
          : `<span class="stock-badge in-stock" title="Available to order from international shipyards">🌐 World Quota: ${stock.inService}/${stock.totalCap} (${stock.availableStock} avail)</span>`;

        item.innerHTML = `
          <div class="catalog-illustration-wrap" style="width: 130px; height: 60px; margin-right: 12px; flex-shrink: 0;">
            ${getShipIllustrationSVG(bp.type, '#ffa502')}
          </div>
          <div class="catalog-specs" style="flex: 1; min-width: 0;">
            <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap;">
              <h4 style="margin: 0; font-size: 1rem;">${bp.name}</h4>
              ${roleBadge}
              ${stockBadge}
            </div>
            <p style="margin-top: 4px; font-size: 0.8rem;">${bp.description}</p>
            <p style="margin-top: 4px; color: #00d2ff; font-size: 0.78rem;">
              Capacity: ${bp.capacityTons.toLocaleString()}t | Speed: ${bp.maxSpeedKnots} kts | Fuel Burn: ${bp.fuelConsumptionTonsPerDay}t/day
            </p>
          </div>
          <div style="text-align: right; min-width: 120px; flex-shrink: 0; margin-left: 10px;">
            <div class="catalog-price">$${bp.baseCost.toLocaleString()}</div>
            <button class="btn ${canBuy ? 'btn-primary' : 'btn-secondary btn-disabled'} btn-sm btn-buy-ship">
              ${isOutOfStock ? 'Fleet Limit' : 'Order Hull'}
            </button>
          </div>
        `;

        const buyBtn = item.querySelector('.btn-buy-ship') as HTMLElement;
        if (buyBtn) {
          buyBtn.addEventListener('click', () => {
            if (isOutOfStock) {
              sounds.playErrorBuzz();
              this.showToast(`World fleet quota reached for ${bp.name} (${stock.inService}/${stock.totalCap} in service). As game days pass or owners sell, dockyard slips will open!`, 'warning');
              return;
            }
            if (!canAfford) {
              sounds.playErrorBuzz();
              this.showToast(`Insufficient capital & credit line to order ${bp.name}.`, 'error');
              return;
            }
            const shipName = prompt(`Enter vessel registry name for ${bp.name}:`, `${player.name.toUpperCase()} STAR`);
            if (shipName) {
              this.network.buyShip(bp.id, shipName);
            }
          });
        }

        catalog.appendChild(item);
      });
    }
  }

  private renderLeaderboard(state: GameState) {
    const tbody = document.getElementById('leaderboard-body');
    if (!tbody) return;

    // Calculate net worth and sort
    const playersList = Object.values(state.players).map((p) => {
      let fleetValue = 0;
      p.ships.forEach((s) => {
        const bp = SHIP_BLUEPRINTS.find((b) => b.id === s.blueprintId);
        if (bp) fleetValue += bp.baseCost * ((s.hullCondition + s.engineCondition) / 200);
      });
      const netWorth = Math.round(p.cash + fleetValue - p.loanBalance);
      return { ...p, netWorth };
    });

    playersList.sort((a, b) => b.netWorth - a.netWorth);

    tbody.innerHTML = '';
    playersList.forEach((p, idx) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td style="font-weight: 700; color: #ffa502;">#${idx + 1}</td>
        <td>
          <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: ${p.color}; margin-right: 6px;"></span>
          <strong>${p.name}</strong>
        </td>
        <td>${p.ships.length} vessels</td>
        <td style="font-family: var(--font-mono); font-weight: 700; color: #00d2ff;">$${p.netWorth.toLocaleString()}</td>
        <td style="font-family: var(--font-mono);">$${p.cash.toLocaleString()}</td>
        <td>${p.completedContracts}</td>
        <td><strong style="color: #2ed573;">${p.reputation}</strong></td>
      `;
      tbody.appendChild(row);
    });
  }
}
