import {
  GameState,
  PlayerCompany,
  PlayerShip,
  WORLD_PORTS,
  SHIP_BLUEPRINTS,
  INITIAL_PLAYER_SETUP,
  GlobalNewsItem,
  calculatePortDistance,
  getRandomCompanyName,
  canShipAcceptContract,
  getWorldShipStock,
  calculateHomePortCost
} from '@portofcall/shared';
import { MarketManager } from './MarketManager.js';
import { Server } from 'socket.io';

export class GameRoom {
  public state: GameState;
  private io: Server;
  private tickTimer: NodeJS.Timeout | null = null;

  constructor(roomCode: string, hostId: string, io: Server, allowLateJoin: boolean = true) {
    this.io = io;
    const initialBunkerPrices: Record<string, number> = {};
    for (const port of WORLD_PORTS) {
      initialBunkerPrices[port.id] = port.fuelPricePerTon;
    }

    this.state = {
      roomCode,
      hostId,
      status: 'lobby',
      currentDay: 1,
      tickIntervalMs: 7000, // 7 seconds per game day
      players: {},
      availableContracts: MarketManager.generateInitialMarket(1),
      bunkerPrices: initialBunkerPrices,
      allowLateJoin: allowLateJoin !== false,
      createdAt: Date.now(),
      newsFeed: [
        {
          id: 'news_init',
          day: 1,
          headline: 'Global shipping markets open. Fleet operators worldwide commence operations.',
          type: 'info'
        }
      ]
    };
  }

  public addPlayer(
    id: string,
    name: string,
    color: string,
    sessionToken?: string,
    homePortId?: string
  ): PlayerCompany {
    let companyName = name?.trim();
    const existingPlayerNames = Object.values(this.state.players).map((p) => p.name);
    if (!companyName) {
      companyName = getRandomCompanyName(existingPlayerNames);
    } else {
      // Avoid duplicate company names in the same room
      const lowerNames = new Set(existingPlayerNames.map((n) => n.toLowerCase()));
      if (lowerNames.has(companyName.toLowerCase())) {
        let suffix = 2;
        while (lowerNames.has(`${companyName} ${suffix}`.toLowerCase())) {
          suffix++;
        }
        companyName = `${companyName} ${suffix}`;
      }
    }

    // Determine chosen home port & licensing cost
    const homePort = WORLD_PORTS.find((p) => p.id === homePortId) || WORLD_PORTS.find((p) => p.id === 'rotterdam') || WORLD_PORTS[0];
    const licenseCost = calculateHomePortCost(homePort);
    const startingCash = Math.max(50000, INITIAL_PLAYER_SETUP.cash - licenseCost);

    // Starting vessel: Coastal Tramp Steamer docked at chosen home port
    const starterBlueprint = SHIP_BLUEPRINTS[0];
    const starterShip: PlayerShip = {
      id: `ship_${id}_1`,
      blueprintId: starterBlueprint.id,
      name: `${companyName.toUpperCase()} PIONEER`,
      hullCondition: 92,
      engineCondition: 90,
      fuelTons: starterBlueprint.fuelCapacityTons * 0.8, // 80% full tank
      currentPortId: homePort.id,
      status: 'docked',
      currentVoyage: null,
      cargo: null
    };

    const company: PlayerCompany = {
      id,
      name: companyName,
      color: color || INITIAL_PLAYER_SETUP.defaultColor,
      homePortId: homePort.id,
      cash: startingCash,
      loanBalance: INITIAL_PLAYER_SETUP.loanBalance,
      creditLimit: INITIAL_PLAYER_SETUP.creditLimit,
      reputation: INITIAL_PLAYER_SETUP.reputation,
      ships: [starterShip],
      totalEarnings: 0,
      completedContracts: 0,
      isReady: id === this.state.hostId,
      sessionToken: sessionToken || `token_${id}_${Date.now()}`,
      isConnected: true
    };

    this.state.players[id] = company;

    // Log headquarters establishment news bulletin
    const news: GlobalNewsItem = {
      id: `news_hq_${id}_${Date.now()}`,
      day: this.state.currentDay,
      headline: `Maritime Registry: ${companyName} established corporate headquarters in ${homePort.name} (${homePort.country}) with flagship ${starterShip.name} (License fee: $${licenseCost.toLocaleString()}).`,
      type: 'info'
    };
    this.state.newsFeed.unshift(news);

    return company;
  }

  public reconnectPlayer(oldPlayerId: string, newSocketId: string): boolean {
    const player = this.state.players[oldPlayerId];
    if (!player) return false;

    if (oldPlayerId !== newSocketId) {
      delete this.state.players[oldPlayerId];
      player.id = newSocketId;
      this.state.players[newSocketId] = player;
      if (this.state.hostId === oldPlayerId) {
        this.state.hostId = newSocketId;
      }
    }
    player.isConnected = true;
    this.broadcastState();
    return true;
  }

  public markPlayerDisconnected(id: string): void {
    const player = this.state.players[id];
    if (player) {
      player.isConnected = false;
      this.broadcastState();
    }
  }

  public removePlayer(id: string): void {
    delete this.state.players[id];
    if (Object.keys(this.state.players).length === 0) {
      this.stop();
    }
  }

  public startGame(): boolean {
    if (this.state.status === 'playing') return false;
    this.state.status = 'playing';
    this.state.startedAt = Date.now();

    // Broadcast starting state
    this.broadcastState();

    // Start simulation loop
    this.tickTimer = setInterval(() => {
      this.advanceDay();
    }, this.state.tickIntervalMs);

    return true;
  }

  public stop(): void {
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
  }

  /**
   * Main game day tick loop
   */
  private advanceDay(): void {
    this.state.currentDay += 1;
    const currentDay = this.state.currentDay;

    // Daily interest on bank loans (0.02% per day = ~7.3% annual)
    for (const pId in this.state.players) {
      const p = this.state.players[pId];
      if (p.loanBalance > 0) {
        const interest = Math.round(p.loanBalance * 0.00025);
        p.cash -= interest;
      }
    }

    // Process all player ships
    for (const pId in this.state.players) {
      const p = this.state.players[pId];
      for (const ship of p.ships) {
        const bp = SHIP_BLUEPRINTS.find(b => b.id === ship.blueprintId) || SHIP_BLUEPRINTS[0];

        // If sailing:
        if (ship.status === 'sailing' && ship.currentVoyage) {
          // Fuel burn
          const dailyFuel = bp.fuelConsumptionTonsPerDay;
          if (ship.fuelTons >= dailyFuel) {
            ship.fuelTons = Math.max(0, Math.round((ship.fuelTons - dailyFuel) * 10) / 10);
          } else {
            // Out of fuel - drifting at crawl speed
            ship.fuelTons = 0;
            p.reputation = Math.max(0, p.reputation - 1);
          }

          // Advance nautical miles
          // Knots * 24 hours = miles per day
          const efficiency = ship.engineCondition / 100;
          const actualKnots = (ship.fuelTons > 0 ? bp.maxSpeedKnots : 2) * (0.6 + 0.4 * efficiency);
          const milesCoveredToday = actualKnots * 24;

          const progressDelta = (milesCoveredToday / ship.currentVoyage.totalDistanceNm) * 100;
          ship.currentVoyage.progressPercent = Math.min(100, Math.round((ship.currentVoyage.progressPercent + progressDelta) * 10) / 10);

          // Hull and engine wear
          if (Math.random() < 0.3) {
            ship.hullCondition = Math.max(10, Math.round((ship.hullCondition - 0.2) * 10) / 10);
            ship.engineCondition = Math.max(10, Math.round((ship.engineCondition - 0.3) * 10) / 10);
          }

          // Random hazard trigger if mid-voyage and not already encountered
          if (
            ship.currentVoyage.progressPercent > 30 &&
            ship.currentVoyage.progressPercent < 75 &&
            !ship.currentVoyage.hazardPending &&
            Math.random() < 0.08
          ) {
            ship.currentVoyage.hazardPending = Math.random() < 0.5 ? 'iceberg' : 'reef';
            ship.status = 'hazard_minigame';
            ship.hazardWaitDays = 0;
            this.io.to(pId).emit('minigame:start', {
              shipId: ship.id,
              type: 'hazard',
              hazardType: ship.currentVoyage.hazardPending
            });
            continue;
          }

          // Arrival check
          if (ship.currentVoyage.progressPercent >= 100) {
            ship.status = 'docking_minigame';
            ship.dockingWaitDays = 0;
            const destPortId = ship.currentVoyage.destinationPortId;
            this.io.to(pId).emit('minigame:start', {
              shipId: ship.id,
              type: 'docking',
              portId: destPortId
            });
          }
        } else if (ship.status === 'hazard_minigame') {
          // If player has not resolved the hazard after 3 game days, watch officers steer clear
          ship.hazardWaitDays = (ship.hazardWaitDays || 0) + 1;
          if (ship.hazardWaitDays >= 3) {
            ship.status = 'sailing';
            ship.hazardWaitDays = 0;
            if (ship.currentVoyage) {
              ship.currentVoyage.hazardPending = null;
            }
            ship.hullCondition = Math.max(10, Math.round((ship.hullCondition - 4) * 10) / 10);
            this.state.newsFeed.unshift({
              id: `news_hazard_${Date.now()}`,
              day: currentDay,
              headline: `${ship.name} navigated around sea hazard under cautious steerage (-4% hull wear).`,
              type: 'info'
            });
          }
        } else if (ship.status === 'docking_minigame') {
          // If vessel has waited off harbor for 3 game days, harbor authority tugs bring her in
          ship.dockingWaitDays = (ship.dockingWaitDays || 0) + 1;
          if (ship.dockingWaitDays >= 3) {
            ship.dockingWaitDays = 0;
            this.autoDock(pId, ship.id);
          }
        }
      }
    }

    // Refresh expired contracts and add new ones
    for (const port of WORLD_PORTS) {
      const existing = (this.state.availableContracts[port.id] || []).filter(c => c.expiryDay > currentDay);
      if (existing.length < 3) {
        const fresh = MarketManager.generateContractsForPort(port, currentDay);
        this.state.availableContracts[port.id] = [...existing, ...fresh].slice(0, 7);
      } else {
        this.state.availableContracts[port.id] = existing;
      }
    }

    // Fluctuate bunker prices every 3 days
    if (currentDay % 3 === 0) {
      this.state.bunkerPrices = MarketManager.updateBunkerPrices(this.state.bunkerPrices);
    }

    // Random news event
    const maybeNews = MarketManager.maybeGenerateEvent(currentDay);
    if (maybeNews) {
      this.state.newsFeed.unshift(maybeNews);
      if (this.state.newsFeed.length > 20) this.state.newsFeed.pop();
      this.io.to(this.state.roomCode).emit('game:news', maybeNews);
    }

    // Broadcast day tick
    this.broadcastState();
  }

  public acceptCharter(playerId: string, shipId: string, contractId: string): { success: boolean; message: string } {
    const player = this.state.players[playerId];
    if (!player) return { success: false, message: 'Player not found' };

    const ship = player.ships.find(s => s.id === shipId);
    if (!ship) return { success: false, message: 'Ship not found' };
    if (ship.status !== 'docked') return { success: false, message: 'Ship must be docked in port to take cargo' };
    if (ship.cargo) return { success: false, message: 'Ship already has cargo loaded' };

    const portId = ship.currentPortId;
    if (!portId) return { success: false, message: 'Ship is not in any port' };

    const contracts = this.state.availableContracts[portId] || [];
    const contractIndex = contracts.findIndex(c => c.id === contractId);
    if (contractIndex === -1) return { success: false, message: 'Contract no longer available' };

    const contract = contracts[contractIndex];
    const bp = SHIP_BLUEPRINTS.find(b => b.id === ship.blueprintId) || SHIP_BLUEPRINTS[0];

    // Check ship type & contract compatibility
    const check = canShipAcceptContract(bp, contract.commodity);
    if (!check.allowed) {
      return { success: false, message: check.reason || 'This vessel cannot accept this contract' };
    }

    if (contract.tonnage > bp.capacityTons) {
      const isPax = contract.category === 'passenger' || contract.category === 'special_event';
      return { success: false, message: `Vessel capacity (${bp.capacityTons}t) is smaller than ${isPax ? 'passenger manifest' : 'cargo'} (${contract.tonnage}${isPax ? ' pax' : 't'})` };
    }

    // Remove from market (claimed by this player)
    contracts.splice(contractIndex, 1);
    this.state.availableContracts[portId] = contracts;

    // Load cargo / passengers
    ship.cargo = {
      contractId: contract.id,
      commodity: contract.commodity,
      category: contract.category,
      specialEventTitle: contract.specialEventTitle,
      tonnage: contract.tonnage,
      payment: contract.payment,
      destinationPortId: contract.destinationPortId,
      deadlineDay: contract.deadlineDay
    };

    this.broadcastState();
    const isPax = contract.category === 'passenger' || contract.category === 'special_event';
    const destPortName = WORLD_PORTS.find(p => p.id === contract.destinationPortId)?.name || contract.destinationPortId;
    return {
      success: true,
      message: isPax
        ? `Embarked ${contract.tonnage} passengers for ${destPortName} (${contract.specialEventTitle || contract.commodity})`
        : `Loaded ${contract.tonnage}t of ${contract.commodity} for ${destPortName}`
    };
  }

  public bunkerFuel(playerId: string, shipId: string, tons: number): { success: boolean; message: string } {
    const player = this.state.players[playerId];
    if (!player) return { success: false, message: 'Player not found' };

    const ship = player.ships.find(s => s.id === shipId);
    if (!ship) return { success: false, message: 'Ship not found' };
    if (ship.status !== 'docked' || !ship.currentPortId) return { success: false, message: 'Ship must be docked' };

    const bp = SHIP_BLUEPRINTS.find(b => b.id === ship.blueprintId) || SHIP_BLUEPRINTS[0];
    const maxCanAdd = bp.fuelCapacityTons - ship.fuelTons;
    const actualTons = Math.min(tons, maxCanAdd);
    if (actualTons <= 0) return { success: false, message: 'Fuel tanks are already full' };

    const pricePerTon = this.state.bunkerPrices[ship.currentPortId] || 500;
    const totalCost = Math.round(actualTons * pricePerTon);

    if (player.cash - totalCost < -player.creditLimit) {
      return { success: false, message: 'Insufficient funds / credit limit exceeded' };
    }

    player.cash -= totalCost;
    ship.fuelTons = Math.round((ship.fuelTons + actualTons) * 10) / 10;

    this.broadcastState();
    return { success: true, message: `Bunkered ${actualTons} tons of fuel for $${totalCost.toLocaleString()}` };
  }

  public startVoyage(playerId: string, shipId: string): { success: boolean; message: string } {
    const player = this.state.players[playerId];
    if (!player) return { success: false, message: 'Player not found' };

    const ship = player.ships.find(s => s.id === shipId);
    if (!ship) return { success: false, message: 'Ship not found' };
    if (ship.status !== 'docked' || !ship.currentPortId) return { success: false, message: 'Ship is not ready to depart' };
    if (!ship.cargo) return { success: false, message: 'Ship has no charter contract or destination' };

    const origin = WORLD_PORTS.find(p => p.id === ship.currentPortId);
    const destination = WORLD_PORTS.find(p => p.id === ship.cargo?.destinationPortId);
    if (!origin || !destination) return { success: false, message: 'Invalid route' };

    const bp = SHIP_BLUEPRINTS.find(b => b.id === ship.blueprintId) || SHIP_BLUEPRINTS[0];
    const distance = calculatePortDistance(origin, destination);
    const estimatedDays = Math.max(1, Math.ceil(distance / (bp.maxSpeedKnots * 24)));

    // Check fuel requirement
    const neededFuel = estimatedDays * bp.fuelConsumptionTonsPerDay;
    if (ship.fuelTons < neededFuel * 0.4) {
      return {
        success: false,
        message: `Critically low fuel! Need at least ~${Math.round(neededFuel)} tons for this voyage.`
      };
    }

    ship.currentPortId = null;
    ship.status = 'sailing';
    ship.currentVoyage = {
      originPortId: origin.id,
      destinationPortId: destination.id,
      departureDay: this.state.currentDay,
      estimatedArrivalDay: this.state.currentDay + estimatedDays,
      totalDistanceNm: distance,
      progressPercent: 0
    };

    this.broadcastState();
    return { success: true, message: `Ship departed ${origin.name} bound for ${destination.name}` };
  }

  public completeMinigame(
    playerId: string,
    shipId: string,
    score: number,
    damagePercent: number,
    success: boolean
  ): { success: boolean; message: string } {
    const player = this.state.players[playerId];
    if (!player) return { success: false, message: 'Player not found' };

    const ship = player.ships.find(s => s.id === shipId);
    if (!ship) return { success: false, message: 'Ship not found' };

    // Apply damage if collision occurred
    if (damagePercent > 0) {
      ship.hullCondition = Math.max(0, Math.round((ship.hullCondition - damagePercent) * 10) / 10);
    }

    // Hazard minigame completion: resume voyage
    if (ship.status === 'hazard_minigame') {
      ship.status = 'sailing';
      if (ship.currentVoyage) {
        ship.currentVoyage.hazardPending = null;
      }
      this.broadcastState();
      return { success: true, message: `Navigated hazard safely! Damage: ${damagePercent}%` };
    }

    // Harbor docking completion: dock into destination port
    const destPortId = ship.currentVoyage?.destinationPortId || 'rotterdam';
    const port = WORLD_PORTS.find(p => p.id === destPortId) || WORLD_PORTS[0];

    ship.currentPortId = port.id;
    ship.status = 'docked';
    ship.currentVoyage = null;

    let payoutMessage = '';

    // Cargo delivery payout & port fee deduction
    if (ship.cargo) {
      const cargo = ship.cargo;
      let payout = cargo.payment;

      // On-time check
      const isOnTime = this.state.currentDay <= cargo.deadlineDay;
      if (!isOnTime) {
        const daysLate = this.state.currentDay - cargo.deadlineDay;
        const penalty = Math.min(payout * 0.5, daysLate * (payout * 0.05));
        payout -= Math.round(penalty);
        player.reputation = Math.max(10, player.reputation - daysLate * 2);
      } else {
        player.reputation = Math.min(100, player.reputation + 2);
      }

      // Deduct port fees
      const net = payout - port.portFeePerCall;
      player.cash += net;
      player.totalEarnings += payout;
      player.completedContracts += 1;

      payoutMessage = `Discharged ${cargo.commodity}: +$${payout.toLocaleString()} gross, -$${port.portFeePerCall.toLocaleString()} port fees.`;
      ship.cargo = null;
    } else {
      player.cash -= port.portFeePerCall;
      payoutMessage = `Docked in ${port.name}. Port fee: -$${port.portFeePerCall.toLocaleString()}`;
    }

    this.broadcastState();
    return { success: true, message: `Vessel safely berthed at ${port.name}. ${payoutMessage}` };
  }

  public autoDock(playerId: string, shipId: string): { success: boolean; message: string } {
    const player = this.state.players[playerId];
    if (!player) return { success: false, message: 'Player not found' };

    const ship = player.ships.find(s => s.id === shipId);
    if (!ship) return { success: false, message: 'Ship not found' };

    const tugFee = 12000;
    if (player.cash - tugFee < -player.creditLimit) {
      return { success: false, message: 'Cannot afford automated harbor tugs ($12,000)' };
    }

    player.cash -= tugFee;
    return this.completeMinigame(playerId, shipId, 100, 0, true);
  }

  public bypassHazard(playerId: string, shipId: string): { success: boolean; message: string } {
    const player = this.state.players[playerId];
    if (!player) return { success: false, message: 'Player not found' };

    const ship = player.ships.find(s => s.id === shipId);
    if (!ship) return { success: false, message: 'Ship not found' };
    if (ship.status !== 'hazard_minigame') return { success: false, message: 'Ship is not facing an obstacle' };

    ship.status = 'sailing';
    ship.hazardWaitDays = 0;
    if (ship.currentVoyage) {
      ship.currentVoyage.hazardPending = null;
    }
    ship.hullCondition = Math.max(10, Math.round((ship.hullCondition - 3) * 10) / 10);

    this.broadcastState();
    return { success: true, message: `${ship.name} bypassed obstacle with cautious steerage (-3% hull wear)` };
  }

  public buyShip(playerId: string, blueprintId: string, shipName: string): { success: boolean; message: string } {
    const player = this.state.players[playerId];
    if (!player) return { success: false, message: 'Player not found' };

    const bp = SHIP_BLUEPRINTS.find(b => b.id === blueprintId);
    if (!bp) return { success: false, message: 'Ship blueprint not found' };

    // Check World Ship Quota
    const stock = getWorldShipStock(this.state, blueprintId);
    if (stock.availableStock <= 0) {
      return {
        success: false,
        message: `World fleet quota reached for ${bp.name}! Currently ${stock.inService}/${stock.totalCap} in service worldwide. Shipyard slots will expand as game days pass, or when an owner sells.`
      };
    }

    if (player.cash - bp.baseCost < -player.creditLimit) {
      return { success: false, message: `Insufficient funds/credit for ${bp.name} ($${bp.baseCost.toLocaleString()})` };
    }

    player.cash -= bp.baseCost;
    const newShip: PlayerShip = {
      id: `ship_${playerId}_${Date.now()}`,
      blueprintId: bp.id,
      name: shipName.trim() || `${player.name.toUpperCase()} ${bp.name}`,
      hullCondition: 100,
      engineCondition: 100,
      fuelTons: bp.fuelCapacityTons,
      currentPortId: player.homePortId || 'rotterdam', // Delivered to company's home port
      status: 'docked',
      currentVoyage: null,
      cargo: null
    };

    player.ships.push(newShip);
    this.broadcastState();
    return { success: true, message: `Acquired ${bp.name} "${newShip.name}" for $${bp.baseCost.toLocaleString()}` };
  }

  public sellShip(playerId: string, shipId: string): { success: boolean; message: string } {
    const player = this.state.players[playerId];
    if (!player) return { success: false, message: 'Player not found' };
    if (player.ships.length <= 1) return { success: false, message: 'Cannot sell your last vessel!' };

    const index = player.ships.findIndex(s => s.id === shipId);
    if (index === -1) return { success: false, message: 'Ship not found' };

    const ship = player.ships[index];
    if (ship.status !== 'docked') return { success: false, message: 'Ship must be docked to sell' };

    const bp = SHIP_BLUEPRINTS.find(b => b.id === ship.blueprintId) || SHIP_BLUEPRINTS[0];
    const conditionFactor = (ship.hullCondition + ship.engineCondition) / 200;
    const sellPrice = Math.round(bp.baseCost * 0.65 * conditionFactor);

    player.ships.splice(index, 1);
    player.cash += sellPrice;

    this.broadcastState();
    return { success: true, message: `Sold "${ship.name}" for $${sellPrice.toLocaleString()}` };
  }

  public repairShip(playerId: string, shipId: string, type: 'hull' | 'engine', amount: number): { success: boolean; message: string } {
    const player = this.state.players[playerId];
    if (!player) return { success: false, message: 'Player not found' };

    const ship = player.ships.find(s => s.id === shipId);
    if (!ship) return { success: false, message: 'Ship not found' };
    if (ship.status !== 'docked' || !ship.currentPortId) return { success: false, message: 'Ship must be docked to repair' };

    const port = WORLD_PORTS.find(p => p.id === ship.currentPortId);
    if (!port?.hasDrydock) return { success: false, message: 'Current port has no shipyard drydock facility' };

    const bp = SHIP_BLUEPRINTS.find(b => b.id === ship.blueprintId) || SHIP_BLUEPRINTS[0];
    const currentCondition = type === 'hull' ? ship.hullCondition : ship.engineCondition;
    const maxRep = 100 - currentCondition;
    const repAmount = Math.min(amount, maxRep);
    if (repAmount <= 0) return { success: false, message: 'System is already at 100% condition' };

    // Repair cost formula: ~$1,200 - $3,500 per condition point depending on vessel class
    const costPerPoint = Math.round(bp.baseCost * 0.0035);
    const totalCost = repAmount * costPerPoint;

    if (player.cash - totalCost < -player.creditLimit) {
      return { success: false, message: 'Insufficient funds for repairs' };
    }

    player.cash -= totalCost;
    if (type === 'hull') {
      ship.hullCondition = Math.min(100, Math.round(ship.hullCondition + repAmount));
    } else {
      ship.engineCondition = Math.min(100, Math.round(ship.engineCondition + repAmount));
    }

    this.broadcastState();
    return { success: true, message: `Repaired ${type} (+${repAmount}%) for $${totalCost.toLocaleString()}` };
  }

  public bankTransaction(playerId: string, type: 'borrow' | 'repay', amount: number): { success: boolean; message: string } {
    const player = this.state.players[playerId];
    if (!player) return { success: false, message: 'Player not found' };

    if (amount <= 0) return { success: false, message: 'Invalid transaction amount' };

    if (type === 'borrow') {
      const maxBorrow = player.creditLimit - player.loanBalance;
      if (amount > maxBorrow) return { success: false, message: `Max available loan credit is $${maxBorrow.toLocaleString()}` };
      player.loanBalance += amount;
      player.cash += amount;
      this.broadcastState();
      return { success: true, message: `Borrowed $${amount.toLocaleString()} from maritime bank` };
    } else {
      if (amount > player.loanBalance) return { success: false, message: 'Repayment exceeds current loan balance' };
      if (amount > player.cash) return { success: false, message: 'Insufficient cash to repay loan' };
      player.loanBalance -= amount;
      player.cash -= amount;
      this.broadcastState();
      return { success: true, message: `Repaid $${amount.toLocaleString()} of loan principal` };
    }
  }

  public broadcastState(): void {
    this.io.to(this.state.roomCode).emit('room:state', this.state);
  }
}
