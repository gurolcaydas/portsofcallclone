// Shared types and constants for Port of Call Multiplayer

export interface Port {
  id: string;
  name: string;
  country: string;
  lat: number;
  lng: number;
  // Normalized 2D map coords (0 to 1000 for x, 0 to 600 for y)
  x: number;
  y: number;
  fuelPricePerTon: number; // Base fuel price in $
  hasDrydock: boolean;
  portFeePerCall: number;
  description: string;
}

export interface ShipBlueprint {
  id: string;
  name: string;
  type: 'tramp' | 'freighter' | 'bulk' | 'container' | 'tanker';
  capacityTons: number;
  maxSpeedKnots: number;
  fuelCapacityTons: number;
  fuelConsumptionTonsPerDay: number;
  baseCost: number;
  description: string;
  lengthMeters: number;
  beamMeters: number;
}

export interface PlayerShip {
  id: string;
  blueprintId: string;
  name: string;
  hullCondition: number; // 0 - 100%
  engineCondition: number; // 0 - 100%
  fuelTons: number;
  currentPortId: string | null;
  status: 'docked' | 'sailing' | 'docking_minigame' | 'hazard_minigame';
  currentVoyage: Voyage | null;
  cargo: CargoPayload | null;
  maintenanceDaysRemaining?: number;
  hazardWaitDays?: number;
  dockingWaitDays?: number;
}

export interface CargoPayload {
  contractId: string;
  commodity: string;
  tonnage: number;
  payment: number;
  destinationPortId: string;
  deadlineDay: number;
}

export interface CharterContract {
  id: string;
  originPortId: string;
  destinationPortId: string;
  commodity: string;
  tonnage: number;
  payment: number; // Total payout in $
  distanceNauticalMiles: number;
  deadlineDay: number;
  expiryDay: number;
}

export interface Voyage {
  originPortId: string;
  destinationPortId: string;
  departureDay: number;
  estimatedArrivalDay: number;
  totalDistanceNm: number;
  progressPercent: number; // 0 - 100
  hazardPending?: 'iceberg' | 'reef' | 'fog' | null;
}

export interface PlayerCompany {
  id: string;
  name: string;
  color: string;
  cash: number;
  loanBalance: number;
  creditLimit: number;
  reputation: number; // 0 - 100
  ships: PlayerShip[];
  totalEarnings: number;
  completedContracts: number;
  isReady: boolean;
  sessionToken?: string;
  isConnected?: boolean;
}

export interface GlobalNewsItem {
  id: string;
  day: number;
  headline: string;
  type: 'info' | 'warning' | 'alert' | 'market';
}

export interface GameState {
  roomCode: string;
  hostId: string;
  status: 'lobby' | 'playing' | 'gameover';
  currentDay: number;
  tickIntervalMs: number; // e.g. 8000ms = 1 day
  players: Record<string, PlayerCompany>;
  availableContracts: Record<string, CharterContract[]>; // portId -> contracts
  bunkerPrices: Record<string, number>; // portId -> current price/ton
  newsFeed: GlobalNewsItem[];
  winnerId?: string;
}

// Socket communication protocol
export interface ServerToClientEvents {
  'room:state': (state: GameState) => void;
  'game:day_tick': (data: { currentDay: number; stateUpdate: Partial<GameState> }) => void;
  'game:news': (news: GlobalNewsItem) => void;
  'player:action_result': (result: { success: boolean; message: string; action: string }) => void;
  'minigame:start': (data: { shipId: string; type: 'docking' | 'hazard'; portId?: string; hazardType?: string }) => void;
  'error': (message: string) => void;
}

export interface ClientToServerEvents {
  'room:create': (data: { companyName: string; color: string }, callback: (res: { success: boolean; roomCode?: string; playerId?: string; sessionToken?: string; error?: string }) => void) => void;
  'room:join': (data: { roomCode: string; companyName: string; color: string }, callback: (res: { success: boolean; playerId?: string; sessionToken?: string; error?: string }) => void) => void;
  'room:reconnect': (data: { roomCode: string; sessionToken: string }, callback: (res: { success: boolean; playerId?: string; error?: string }) => void) => void;
  'room:leave': () => void;
  'room:start_game': () => void;
  'action:accept_charter': (data: { shipId: string; contractId: string }) => void;
  'action:bunker_fuel': (data: { shipId: string; tons: number }) => void;
  'action:buy_ship': (data: { blueprintId: string; shipName: string }) => void;
  'action:sell_ship': (data: { shipId: string }) => void;
  'action:repair_ship': (data: { shipId: string; type: 'hull' | 'engine'; amount: number }) => void;
  'action:bank_transaction': (data: { type: 'borrow' | 'repay'; amount: number }) => void;
  'action:start_voyage': (data: { shipId: string }) => void;
  'action:auto_dock': (data: { shipId: string }) => void; // Pay tug fee to bypass minigame
  'action:bypass_hazard': (data: { shipId: string }) => void; // Steer around hazard cautiously
  'minigame:complete': (data: { shipId: string; score: number; damagePercent: number; success: boolean }) => void;
}

// Preset Ports
export const WORLD_PORTS: Port[] = [
  {
    id: 'rotterdam',
    name: 'Rotterdam',
    country: 'Netherlands',
    lat: 51.92,
    lng: 4.48,
    x: 485,
    y: 180,
    fuelPricePerTon: 480,
    hasDrydock: true,
    portFeePerCall: 12000,
    description: 'Europe\'s largest seaport with high freight density and state-of-the-art drydocks.'
  },
  {
    id: 'hamburg',
    name: 'Hamburg',
    country: 'Germany',
    lat: 53.55,
    lng: 9.99,
    x: 505,
    y: 170,
    fuelPricePerTon: 510,
    hasDrydock: true,
    portFeePerCall: 11000,
    description: 'Historic Hanseatic port on the Elbe river, central gateway to Northern Europe.'
  },
  {
    id: 'london',
    name: 'London',
    country: 'United Kingdom',
    lat: 51.50,
    lng: -0.12,
    x: 468,
    y: 182,
    fuelPricePerTon: 530,
    hasDrydock: true,
    portFeePerCall: 13000,
    description: 'The global maritime finance and insurance capital on the Thames.'
  },
  {
    id: 'newyork',
    name: 'New York',
    country: 'United States',
    lat: 40.71,
    lng: -74.00,
    x: 270,
    y: 220,
    fuelPricePerTon: 490,
    hasDrydock: true,
    portFeePerCall: 16000,
    description: 'Bustling Atlantic hub with premium container and dry bulk demand.'
  },
  {
    id: 'neworleans',
    name: 'New Orleans',
    country: 'United States',
    lat: 29.95,
    lng: -90.07,
    x: 225,
    y: 260,
    fuelPricePerTon: 460,
    hasDrydock: false,
    portFeePerCall: 9500,
    description: 'Gulf Coast river gateway handling massive agricultural grain & petro exports.'
  },
  {
    id: 'panama',
    name: 'Panama City (Canal)',
    country: 'Panama',
    lat: 8.98,
    lng: -79.52,
    x: 250,
    y: 340,
    fuelPricePerTon: 550,
    hasDrydock: false,
    portFeePerCall: 25000,
    description: 'Critical canal crossing connecting Atlantic and Pacific shipping lanes.'
  },
  {
    id: 'santos',
    name: 'Santos',
    country: 'Brazil',
    lat: -23.96,
    lng: -46.33,
    x: 355,
    y: 440,
    fuelPricePerTon: 520,
    hasDrydock: false,
    portFeePerCall: 10500,
    description: 'South America\'s prime export hub for coffee, soybeans, and sugar.'
  },
  {
    id: 'buenosaires',
    name: 'Buenos Aires',
    country: 'Argentina',
    lat: -34.60,
    lng: -58.38,
    x: 325,
    y: 480,
    fuelPricePerTon: 540,
    hasDrydock: true,
    portFeePerCall: 11500,
    description: 'Rio de la Plata grain and beef export metropolis.'
  },
  {
    id: 'gibraltar',
    name: 'Gibraltar',
    country: 'United Kingdom',
    lat: 36.14,
    lng: -5.35,
    x: 460,
    y: 235,
    fuelPricePerTon: 470,
    hasDrydock: true,
    portFeePerCall: 8000,
    description: 'Strategic Mediterranean chokepoint and high-volume bunkering station.'
  },
  {
    id: 'alexandria',
    name: 'Alexandria',
    country: 'Egypt',
    lat: 31.20,
    lng: 29.91,
    x: 550,
    y: 250,
    fuelPricePerTon: 500,
    hasDrydock: false,
    portFeePerCall: 9000,
    description: 'Ancient trade center and northern approach to the Suez Canal.'
  },
  {
    id: 'capetown',
    name: 'Cape Town',
    country: 'South Africa',
    lat: -33.92,
    lng: 18.42,
    x: 525,
    y: 475,
    fuelPricePerTon: 560,
    hasDrydock: true,
    portFeePerCall: 10000,
    description: 'The Cape of Good Hope sentinel route connecting Atlantic and Indian Oceans.'
  },
  {
    id: 'dubai',
    name: 'Dubai',
    country: 'United Arab Emirates',
    lat: 25.20,
    lng: 55.27,
    x: 635,
    y: 275,
    fuelPricePerTon: 450,
    hasDrydock: true,
    portFeePerCall: 14000,
    description: 'Persian Gulf powerhouse with colossal drydocks and oil terminals.'
  },
  {
    id: 'singapore',
    name: 'Singapore',
    country: 'Singapore',
    lat: 1.35,
    lng: 103.82,
    x: 755,
    y: 365,
    fuelPricePerTon: 440,
    hasDrydock: true,
    portFeePerCall: 15000,
    description: 'The busiest transshipment hub on Earth, offering the cheapest fuel bunkering.'
  },
  {
    id: 'hongkong',
    name: 'Hong Kong',
    country: 'Hong Kong',
    lat: 22.31,
    lng: 114.16,
    x: 795,
    y: 290,
    fuelPricePerTon: 480,
    hasDrydock: true,
    portFeePerCall: 14500,
    description: 'Vibrant Far East container gateway and maritime legal center.'
  },
  {
    id: 'shanghai',
    name: 'Shanghai',
    country: 'China',
    lat: 31.23,
    lng: 121.47,
    x: 820,
    y: 255,
    fuelPricePerTon: 470,
    hasDrydock: true,
    portFeePerCall: 13500,
    description: 'Mega-port at the mouth of the Yangtze River, leader in manufactured goods.'
  },
  {
    id: 'tokyo',
    name: 'Yokohama / Tokyo',
    country: 'Japan',
    lat: 35.44,
    lng: 139.64,
    x: 865,
    y: 240,
    fuelPricePerTon: 520,
    hasDrydock: true,
    portFeePerCall: 17000,
    description: 'High-tech industrial hub with premium freight contracts and reliable berths.'
  },
  {
    id: 'sydney',
    name: 'Sydney',
    country: 'Australia',
    lat: -33.86,
    lng: 151.20,
    x: 885,
    y: 470,
    fuelPricePerTon: 540,
    hasDrydock: true,
    portFeePerCall: 12500,
    description: 'Iconic South Pacific harbor connecting Australasia with world commerce.'
  }
];

// Ship Blueprints
export const SHIP_BLUEPRINTS: ShipBlueprint[] = [
  {
    id: 'tramp_steamer',
    name: 'Coastal Tramp',
    type: 'tramp',
    capacityTons: 3500,
    maxSpeedKnots: 11,
    fuelCapacityTons: 150,
    fuelConsumptionTonsPerDay: 7,
    baseCost: 280000,
    lengthMeters: 85,
    beamMeters: 13,
    description: 'Rugged vintage single-screw steamer. Low purchase cost, ideal for budding shipowners.'
  },
  {
    id: 'general_freighter',
    name: 'Cargo Liner Mk-II',
    type: 'freighter',
    capacityTons: 8500,
    maxSpeedKnots: 14,
    fuelCapacityTons: 320,
    fuelConsumptionTonsPerDay: 14,
    baseCost: 750000,
    lengthMeters: 130,
    beamMeters: 19,
    description: 'Dependable general cargo vessel equipped with onboard cranes for flexible port access.'
  },
  {
    id: 'bulk_carrier',
    name: 'Panamax Bulk Carrier',
    type: 'bulk',
    capacityTons: 22000,
    maxSpeedKnots: 13,
    fuelCapacityTons: 650,
    fuelConsumptionTonsPerDay: 22,
    baseCost: 1850000,
    lengthMeters: 190,
    beamMeters: 30,
    description: 'High-capacity bulk vessel designed for ores, coal, and grain across oceans.'
  },
  {
    id: 'container_ship',
    name: 'Atlantic Express',
    type: 'container',
    capacityTons: 16000,
    maxSpeedKnots: 19,
    fuelCapacityTons: 800,
    fuelConsumptionTonsPerDay: 32,
    baseCost: 3200000,
    lengthMeters: 215,
    beamMeters: 32,
    description: 'Fast container ship with rapid port turnaround and high-value cargo yields.'
  },
  {
    id: 'super_tanker',
    name: 'Pacific Titan',
    type: 'tanker',
    capacityTons: 45000,
    maxSpeedKnots: 12,
    fuelCapacityTons: 1400,
    fuelConsumptionTonsPerDay: 42,
    baseCost: 6500000,
    lengthMeters: 275,
    beamMeters: 45,
    description: 'Gargantuan crude carrier capable of colossal freight hauls with sluggish maneuverability.'
  }
];

// Commodities
export const COMMODITIES = [
  { name: 'Crude Oil', valueMultiplier: 1.4, minTonnage: 8000, type: ['tanker'] },
  { name: 'Grain & Wheat', valueMultiplier: 0.9, minTonnage: 2000, type: ['tramp', 'freighter', 'bulk'] },
  { name: 'Iron Ore', valueMultiplier: 0.8, minTonnage: 5000, type: ['bulk', 'freighter'] },
  { name: 'Electronics & Machinery', valueMultiplier: 2.1, minTonnage: 1000, type: ['container', 'freighter'] },
  { name: 'Automobiles', valueMultiplier: 1.8, minTonnage: 2500, type: ['container', 'freighter'] },
  { name: 'Textiles & Garments', valueMultiplier: 1.3, minTonnage: 1500, type: ['container', 'tramp'] },
  { name: 'Coffee & Spices', valueMultiplier: 1.6, minTonnage: 1200, type: ['freighter', 'container', 'tramp'] },
  { name: 'Chemicals & Plastics', valueMultiplier: 1.7, minTonnage: 3000, type: ['tanker', 'container'] }
];

// Initial Starting Player Budget & Setup
export const INITIAL_PLAYER_SETUP = {
  cash: 400000,
  loanBalance: 150000,
  creditLimit: 500000,
  reputation: 60,
  defaultColor: '#00d2ff'
};

// Calculate approximate nautical miles between two ports
export function calculatePortDistance(p1: Port, p2: Port): number {
  const R = 3440.065; // Earth radius in nautical miles
  const dLat = ((p2.lat - p1.lat) * Math.PI) / 180;
  const dLon = ((p2.lng - p1.lng) * Math.PI) / 180;
  const lat1 = (p1.lat * Math.PI) / 180;
  const lat2 = (p2.lat * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const rawDist = R * c;

  // Add a maritime sea route curvature multiplier (land masses detour factor ~ 1.3)
  return Math.round(Math.max(300, rawDist * 1.32));
}
