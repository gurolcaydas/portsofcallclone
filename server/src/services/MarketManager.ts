import {
  Port,
  CharterContract,
  WORLD_PORTS,
  COMMODITIES,
  calculatePortDistance,
  GlobalNewsItem
} from '@portofcall/shared';

export class MarketManager {
  /**
   * Generate fresh contracts for a given port
   */
  public static generateContractsForPort(originPort: Port, currentDay: number): CharterContract[] {
    const contracts: CharterContract[] = [];
    const destinationCandidates = WORLD_PORTS.filter(p => p.id !== originPort.id);

    // Number of contracts available at this port (3 to 6)
    const count = 3 + Math.floor(Math.random() * 4);

    for (let i = 0; i < count; i++) {
      const dest = destinationCandidates[Math.floor(Math.random() * destinationCandidates.length)];
      const commodity = COMMODITIES[Math.floor(Math.random() * COMMODITIES.length)];
      const distance = calculatePortDistance(originPort, dest);

      // Tonnage between minTonnage and minTonnage * 3
      const tonnage = commodity.minTonnage + Math.floor(Math.random() * (commodity.minTonnage * 2));
      
      // Payment formula based on distance, commodity value multiplier, and tonnage
      // Base rate: ~$0.08 - $0.14 per ton-mile
      const ratePerTonMile = 0.09 + Math.random() * 0.05;
      const basePay = Math.round(distance * tonnage * ratePerTonMile * commodity.valueMultiplier);
      const payment = Math.round(basePay / 1000) * 1000; // Round to nearest thousand

      // Estimate voyage days at ~14 knots (14 knots * 24h = ~336 nautical miles/day)
      const estimatedDays = Math.ceil(distance / 330);
      // Deadline provides a generous buffer (e.g. 1.8x estimated voyage days)
      const deadlineDay = currentDay + Math.ceil(estimatedDays * 1.8) + 3;
      const expiryDay = currentDay + 5 + Math.floor(Math.random() * 5);

      contracts.push({
        id: `c_${originPort.id}_${dest.id}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        originPortId: originPort.id,
        destinationPortId: dest.id,
        commodity: commodity.name,
        tonnage,
        payment,
        distanceNauticalMiles: distance,
        deadlineDay,
        expiryDay
      });
    }

    return contracts;
  }

  /**
   * Generate initial contracts for all world ports
   */
  public static generateInitialMarket(currentDay: number): Record<string, CharterContract[]> {
    const market: Record<string, CharterContract[]> = {};
    for (const port of WORLD_PORTS) {
      market[port.id] = this.generateContractsForPort(port, currentDay);
    }
    return market;
  }

  /**
   * Fluctuate bunker fuel prices slightly every few days
   */
  public static updateBunkerPrices(currentPrices: Record<string, number>): Record<string, number> {
    const updated: Record<string, number> = { ...currentPrices };
    for (const port of WORLD_PORTS) {
      const current = updated[port.id] || port.fuelPricePerTon;
      // Fluctuate by -4% to +4%
      const delta = (Math.random() - 0.5) * 0.08;
      const newPrice = Math.round(current * (1 + delta));
      // Keep within realistic bounds of base price +/- 30%
      const min = Math.round(port.fuelPricePerTon * 0.7);
      const max = Math.round(port.fuelPricePerTon * 1.3);
      updated[port.id] = Math.max(min, Math.min(max, newPrice));
    }
    return updated;
  }

  /**
   * Random news and events generator
   */
  public static maybeGenerateEvent(currentDay: number): GlobalNewsItem | null {
    // 25% chance of an event per game day
    if (Math.random() > 0.25) return null;

    const events: Array<{ headline: string; type: GlobalNewsItem['type'] }> = [
      { headline: 'Suez Canal Authority announces routine maintenance; minor traffic queues reported.', type: 'info' },
      { headline: 'Oil output quotas adjusted: Bunker fuel prices fluctuating globally.', type: 'market' },
      { headline: 'Severe North Atlantic storm warning: High swell and gales between New York and London.', type: 'alert' },
      { headline: 'Dockworkers union in Rotterdam strikes for 48 hours; port fees and handling impacted.', type: 'warning' },
      { headline: 'Surge in grain harvests in South America drives bulk freight demand in Santos.', type: 'market' },
      { headline: 'Singapore opens automated deepwater container terminal expansion.', type: 'info' },
      { headline: 'Iceberg alert issued off Newfoundland; watch officers advised high alert.', type: 'alert' },
      { headline: 'Panama Canal water levels stabilize; full draft transits resumed.', type: 'info' }
    ];

    const chosen = events[Math.floor(Math.random() * events.length)];
    return {
      id: `news_${currentDay}_${Date.now()}`,
      day: currentDay,
      headline: chosen.headline,
      type: chosen.type
    };
  }
}
