// Shared types and constants for Port of Call Multiplayer

export interface Port {
  id: string;
  name: string;
  country: string;
  lat: number;
  lng: number;
  // Normalized 2D map coords (0 to 1000 for x, 0 to 550 for y)
  x: number;
  y: number;
  fuelPricePerTon: number; // Base fuel price in $
  hasDrydock: boolean;
  portFeePerCall: number;
  description: string;
  hasPassengerTerminal?: boolean;
  category?: 'cargo' | 'passenger' | 'mixed';
  annualCargoTonnageMillions?: number;
  annualPassengersThousands?: number;
}

export interface ShipBlueprint {
  id: string;
  name: string;
  type: 'tramp' | 'freighter' | 'bulk' | 'container' | 'tanker' | 'passenger';
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

export type CommodityCategory = 'cargo' | 'passenger' | 'special_event';

export interface CargoPayload {
  contractId: string;
  commodity: string;
  category?: CommodityCategory;
  specialEventTitle?: string;
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
  category?: CommodityCategory;
  specialEventTitle?: string;
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
  homePortId?: string;
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

export interface PublicRoomInfo {
  roomCode: string;
  hostName: string;
  status: 'lobby' | 'playing' | 'gameover';
  playerCount: number;
  maxPlayers: number;
  playerNames: string[];
  currentDay: number;
  createdAt: number;
  startedAt?: number;
  allowLateJoin: boolean;
  isOpen: boolean;
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
  allowLateJoin: boolean;
  createdAt: number;
  startedAt?: number;
}

// Socket communication protocol
export interface ServerToClientEvents {
  'room:state': (state: GameState) => void;
  'game:day_tick': (data: { currentDay: number; stateUpdate: Partial<GameState> }) => void;
  'game:news': (news: GlobalNewsItem) => void;
  'player:action_result': (result: { success: boolean; message: string; action: string }) => void;
  'minigame:start': (data: { shipId: string; type: 'docking' | 'hazard'; portId?: string; hazardType?: string }) => void;
  'room:list_update': (rooms: PublicRoomInfo[]) => void;
  'error': (message: string) => void;
}

export interface ClientToServerEvents {
  'room:create': (data: { companyName: string; color: string; allowLateJoin?: boolean; homePortId?: string }, callback: (res: { success: boolean; roomCode?: string; playerId?: string; sessionToken?: string; error?: string }) => void) => void;
  'room:join': (data: { roomCode: string; companyName: string; color: string; homePortId?: string }, callback: (res: { success: boolean; playerId?: string; sessionToken?: string; error?: string }) => void) => void;
  'room:reconnect': (data: { roomCode: string; sessionToken: string }, callback: (res: { success: boolean; playerId?: string; error?: string }) => void) => void;
  'room:leave': () => void;
  'room:start_game': () => void;
  'room:list': (callback: (rooms: PublicRoomInfo[]) => void) => void;
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

// Preset Top 50 World Ports (Comprehensive Cargo & Passenger/Cruise Hubs)
export const WORLD_PORTS: Port[] = [
  // --- East Asia ---
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
    hasPassengerTerminal: true,
    category: 'mixed',
    annualCargoTonnageMillions: 514,
    annualPassengersThousands: 2850,
    description: 'World\'s #1 busiest container port on the Yangtze estuary, with a major international cruise homeport.'
  },
  {
    id: 'ningbo',
    name: 'Ningbo-Zhoushan',
    country: 'China',
    lat: 29.86,
    lng: 121.54,
    x: 824,
    y: 260,
    fuelPricePerTon: 465,
    hasDrydock: true,
    portFeePerCall: 12500,
    hasPassengerTerminal: false,
    category: 'cargo',
    annualCargoTonnageMillions: 1250,
    annualPassengersThousands: 0,
    description: 'World\'s #1 port by cargo tonnage; massive deepwater bulk terminal handling crude oil, ores, and containers.'
  },
  {
    id: 'shenzhen',
    name: 'Shenzhen',
    country: 'China',
    lat: 22.54,
    lng: 114.05,
    x: 793,
    y: 286,
    fuelPricePerTon: 475,
    hasDrydock: true,
    portFeePerCall: 13000,
    hasPassengerTerminal: true,
    category: 'mixed',
    annualCargoTonnageMillions: 280,
    annualPassengersThousands: 1950,
    description: 'Pearl River Delta container powerhouse (Yantian & Shekou) paired with modern Shekou Cruise Homeport.'
  },
  {
    id: 'guangzhou',
    name: 'Guangzhou',
    country: 'China',
    lat: 23.12,
    lng: 113.26,
    x: 790,
    y: 283,
    fuelPricePerTon: 480,
    hasDrydock: true,
    portFeePerCall: 12000,
    hasPassengerTerminal: true,
    category: 'mixed',
    annualCargoTonnageMillions: 650,
    annualPassengersThousands: 1200,
    description: 'Nansha deepwater complex; historic Maritime Silk Road terminus exporting manufactured vehicles and high-tech goods.'
  },
  {
    id: 'qingdao',
    name: 'Qingdao',
    country: 'China',
    lat: 36.06,
    lng: 120.38,
    x: 815,
    y: 238,
    fuelPricePerTon: 470,
    hasDrydock: true,
    portFeePerCall: 11500,
    hasPassengerTerminal: true,
    category: 'cargo',
    annualCargoTonnageMillions: 630,
    annualPassengersThousands: 800,
    description: 'Major Yellow Sea gateway specializing in iron ore, crude petroleum, grain, and transpacific containers.'
  },
  {
    id: 'tianjin',
    name: 'Tianjin',
    country: 'China',
    lat: 38.98,
    lng: 117.75,
    x: 808,
    y: 228,
    fuelPricePerTon: 485,
    hasDrydock: true,
    portFeePerCall: 12500,
    hasPassengerTerminal: true,
    category: 'mixed',
    annualCargoTonnageMillions: 550,
    annualPassengersThousands: 950,
    description: 'Northern maritime gateway to Beijing; colossal Ro-Ro vehicle handling, petrochemical berths, and cruise terminal.'
  },
  {
    id: 'xiamen',
    name: 'Xiamen',
    country: 'China',
    lat: 24.47,
    lng: 118.08,
    x: 805,
    y: 278,
    fuelPricePerTon: 475,
    hasDrydock: true,
    portFeePerCall: 11000,
    hasPassengerTerminal: true,
    category: 'mixed',
    annualCargoTonnageMillions: 220,
    annualPassengersThousands: 1750,
    description: 'Key Taiwan Strait deepwater port, advanced electronics export corridor, and bustling coastal passenger ferries.'
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
    hasPassengerTerminal: true,
    category: 'mixed',
    annualCargoTonnageMillions: 250,
    annualPassengersThousands: 3200,
    description: 'Victoria Harbour global finance center, Kai Tak Cruise Terminal, and historic Asian maritime shipping hub.'
  },
  {
    id: 'kaohsiung',
    name: 'Kaohsiung',
    country: 'Taiwan',
    lat: 22.62,
    lng: 120.30,
    x: 812,
    y: 285,
    fuelPricePerTon: 495,
    hasDrydock: true,
    portFeePerCall: 12500,
    hasPassengerTerminal: true,
    category: 'mixed',
    annualCargoTonnageMillions: 115,
    annualPassengersThousands: 1400,
    description: 'Taiwan\'s primary deepwater container transshipment port with a striking modern Port & Cruise Center.'
  },
  {
    id: 'busan',
    name: 'Busan',
    country: 'South Korea',
    lat: 35.17,
    lng: 129.07,
    x: 845,
    y: 242,
    fuelPricePerTon: 490,
    hasDrydock: true,
    portFeePerCall: 14000,
    hasPassengerTerminal: true,
    category: 'mixed',
    annualCargoTonnageMillions: 440,
    annualPassengersThousands: 2100,
    description: 'Northeast Asia\'s premier transshipment hub connecting Japan, China, and North America, plus international passenger ferries.'
  },
  {
    id: 'tokyo',
    name: 'Tokyo / Yokohama',
    country: 'Japan',
    lat: 35.44,
    lng: 139.64,
    x: 865,
    y: 240,
    fuelPricePerTon: 520,
    hasDrydock: true,
    portFeePerCall: 17000,
    hasPassengerTerminal: true,
    category: 'mixed',
    annualCargoTonnageMillions: 280,
    annualPassengersThousands: 2600,
    description: 'Keihin industrial mega-complex, Osanbashi passenger pier, high-tech automotive and precision machinery berths.'
  },

  // --- Southeast Asia & Oceania ---
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
    hasPassengerTerminal: true,
    category: 'mixed',
    annualCargoTonnageMillions: 590,
    annualPassengersThousands: 4200,
    description: 'The world\'s premier transshipment capital and bunkering station, with Marina Bay Cruise Centre.'
  },
  {
    id: 'portklang',
    name: 'Port Klang',
    country: 'Malaysia',
    lat: 3.00,
    lng: 101.40,
    x: 748,
    y: 358,
    fuelPricePerTon: 460,
    hasDrydock: true,
    portFeePerCall: 11000,
    hasPassengerTerminal: true,
    category: 'mixed',
    annualCargoTonnageMillions: 220,
    annualPassengersThousands: 1100,
    description: 'Major Malacca Strait transshipment port serving Kuala Lumpur and global maritime trade lanes.'
  },
  {
    id: 'tanjungpelepas',
    name: 'Tanjung Pelepas',
    country: 'Malaysia',
    lat: 1.36,
    lng: 103.55,
    x: 752,
    y: 368,
    fuelPricePerTon: 445,
    hasDrydock: false,
    portFeePerCall: 9500,
    hasPassengerTerminal: false,
    category: 'cargo',
    annualCargoTonnageMillions: 160,
    annualPassengersThousands: 0,
    description: 'Ultra-modern dedicated container transshipment terminal near the southern tip of the Malay Peninsula.'
  },
  {
    id: 'laemchabang',
    name: 'Laem Chabang',
    country: 'Thailand',
    lat: 13.08,
    lng: 100.88,
    x: 748,
    y: 322,
    fuelPricePerTon: 485,
    hasDrydock: false,
    portFeePerCall: 10500,
    hasPassengerTerminal: true,
    category: 'mixed',
    annualCargoTonnageMillions: 90,
    annualPassengersThousands: 850,
    description: 'Thailand\'s primary deepwater port handling heavy manufacturing, auto exports, and luxury Gulf of Thailand cruises.'
  },
  {
    id: 'jakarta',
    name: 'Jakarta (Tanjung Priok)',
    country: 'Indonesia',
    lat: -6.10,
    lng: 106.88,
    x: 765,
    y: 388,
    fuelPricePerTon: 495,
    hasDrydock: true,
    portFeePerCall: 11000,
    hasPassengerTerminal: true,
    category: 'mixed',
    annualCargoTonnageMillions: 140,
    annualPassengersThousands: 2300,
    description: 'Indonesia\'s busiest commercial seaport handling over half of national foreign sea trade and inter-island passenger lines.'
  },
  {
    id: 'manila',
    name: 'Manila',
    country: 'Philippines',
    lat: 14.59,
    lng: 120.98,
    x: 808,
    y: 316,
    fuelPricePerTon: 490,
    hasDrydock: true,
    portFeePerCall: 9500,
    hasPassengerTerminal: true,
    category: 'mixed',
    annualCargoTonnageMillions: 85,
    annualPassengersThousands: 3800,
    description: 'Manila Bay international container terminals and dense Philippine archipelago passenger ferry headquarters.'
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
    portFeePerCall: 13500,
    hasPassengerTerminal: true,
    category: 'passenger',
    annualCargoTonnageMillions: 35,
    annualPassengersThousands: 1650,
    description: 'Iconic South Pacific harbor, Overseas Passenger Terminal at Circular Quay & Port Botany container docks.'
  },
  {
    id: 'melbourne',
    name: 'Melbourne',
    country: 'Australia',
    lat: -37.81,
    lng: 144.96,
    x: 870,
    y: 480,
    fuelPricePerTon: 545,
    hasDrydock: false,
    portFeePerCall: 12000,
    hasPassengerTerminal: true,
    category: 'mixed',
    annualCargoTonnageMillions: 90,
    annualPassengersThousands: 650,
    description: 'Australia\'s busiest commercial container and general cargo port on Port Phillip Bay, with Station Pier cruise dock.'
  },

  // --- South Asia & Middle East ---
  {
    id: 'colombo',
    name: 'Colombo',
    country: 'Sri Lanka',
    lat: 6.92,
    lng: 79.86,
    x: 700,
    y: 345,
    fuelPricePerTon: 510,
    hasDrydock: true,
    portFeePerCall: 10000,
    hasPassengerTerminal: true,
    category: 'mixed',
    annualCargoTonnageMillions: 110,
    annualPassengersThousands: 450,
    description: 'Strategic Indian Ocean transshipment crossroad connecting Asia, Europe, and Africa along major sea lanes.'
  },
  {
    id: 'mumbai',
    name: 'Mumbai (JNPT)',
    country: 'India',
    lat: 18.95,
    lng: 72.82,
    x: 678,
    y: 300,
    fuelPricePerTon: 500,
    hasDrydock: true,
    portFeePerCall: 11000,
    hasPassengerTerminal: true,
    category: 'mixed',
    annualCargoTonnageMillions: 145,
    annualPassengersThousands: 1100,
    description: 'Nhava Sheva (JNPT) & Mumbai Port: India\'s leading container gateway and Arabian Sea maritime trade portal.'
  },
  {
    id: 'chennai',
    name: 'Chennai',
    country: 'India',
    lat: 13.08,
    lng: 80.27,
    x: 702,
    y: 318,
    fuelPricePerTon: 505,
    hasDrydock: true,
    portFeePerCall: 10500,
    hasPassengerTerminal: true,
    category: 'cargo',
    annualCargoTonnageMillions: 55,
    annualPassengersThousands: 300,
    description: 'Gateway to South India, major automobile and heavy machinery port on the Coromandel Coast.'
  },
  {
    id: 'dubai',
    name: 'Dubai (Jebel Ali)',
    country: 'United Arab Emirates',
    lat: 25.20,
    lng: 55.27,
    x: 635,
    y: 275,
    fuelPricePerTon: 450,
    hasDrydock: true,
    portFeePerCall: 14000,
    hasPassengerTerminal: true,
    category: 'mixed',
    annualCargoTonnageMillions: 160,
    annualPassengersThousands: 1800,
    description: 'World\'s largest man-made harbor (Jebel Ali), colossal drydocks, and Mina Rashid luxury cruise terminals.'
  },
  {
    id: 'jeddah',
    name: 'Jeddah',
    country: 'Saudi Arabia',
    lat: 21.48,
    lng: 39.18,
    x: 580,
    y: 285,
    fuelPricePerTon: 435,
    hasDrydock: true,
    portFeePerCall: 12000,
    hasPassengerTerminal: true,
    category: 'mixed',
    annualCargoTonnageMillions: 130,
    annualPassengersThousands: 1500,
    description: 'Premier Red Sea commercial container port and historical pilgrim passenger maritime gateway.'
  },
  {
    id: 'portsaid',
    name: 'Port Said (Suez)',
    country: 'Egypt',
    lat: 31.26,
    lng: 32.30,
    x: 558,
    y: 252,
    fuelPricePerTon: 485,
    hasDrydock: false,
    portFeePerCall: 15000,
    hasPassengerTerminal: true,
    category: 'cargo',
    annualCargoTonnageMillions: 95,
    annualPassengersThousands: 500,
    description: 'Northern gate of the Suez Canal; critical transshipment nexus between Mediterranean and Asian sea traffic.'
  },

  // --- Europe & Mediterranean ---
  {
    id: 'rotterdam',
    name: 'Rotterdam',
    country: 'Netherlands',
    lat: 51.92,
    lng: 4.48,
    x: 485,
    y: 178,
    fuelPricePerTon: 480,
    hasDrydock: true,
    portFeePerCall: 12000,
    hasPassengerTerminal: true,
    category: 'mixed',
    annualCargoTonnageMillions: 468,
    annualPassengersThousands: 650,
    description: 'Europe\'s largest seaport with high freight density, automated container terminals, and mammoth drydocks.'
  },
  {
    id: 'antwerp',
    name: 'Antwerp-Bruges',
    country: 'Belgium',
    lat: 51.22,
    lng: 4.40,
    x: 482,
    y: 185,
    fuelPricePerTon: 490,
    hasDrydock: true,
    portFeePerCall: 11500,
    hasPassengerTerminal: false,
    category: 'cargo',
    annualCargoTonnageMillions: 290,
    annualPassengersThousands: 0,
    description: 'Europe\'s second largest port and largest integrated chemical cluster on the river Scheldt.'
  },
  {
    id: 'hamburg',
    name: 'Hamburg',
    country: 'Germany',
    lat: 53.55,
    lng: 9.99,
    x: 502,
    y: 168,
    fuelPricePerTon: 510,
    hasDrydock: true,
    portFeePerCall: 11000,
    hasPassengerTerminal: true,
    category: 'mixed',
    annualCargoTonnageMillions: 125,
    annualPassengersThousands: 1200,
    description: 'Historic Hanseatic port on the Elbe; Germany\'s "Gateway to the World" with prominent cruise terminals.'
  },
  {
    id: 'bremerhaven',
    name: 'Bremen / Bremerhaven',
    country: 'Germany',
    lat: 53.54,
    lng: 8.58,
    x: 496,
    y: 171,
    fuelPricePerTon: 505,
    hasDrydock: true,
    portFeePerCall: 10500,
    hasPassengerTerminal: true,
    category: 'cargo',
    annualCargoTonnageMillions: 70,
    annualPassengersThousands: 400,
    description: 'World-leading automotive export terminal, long-distance container berths, and Columbus Cruise Center.'
  },
  {
    id: 'london',
    name: 'London / Southampton',
    country: 'United Kingdom',
    lat: 51.50,
    lng: -0.12,
    x: 468,
    y: 182,
    fuelPricePerTon: 530,
    hasDrydock: true,
    portFeePerCall: 13000,
    hasPassengerTerminal: true,
    category: 'mixed',
    annualCargoTonnageMillions: 65,
    annualPassengersThousands: 2400,
    description: 'The global maritime finance and insurance capital, paired with the UK\'s premier luxury cruise homeport.'
  },
  {
    id: 'valencia',
    name: 'Valencia',
    country: 'Spain',
    lat: 39.46,
    lng: -0.37,
    x: 472,
    y: 228,
    fuelPricePerTon: 480,
    hasDrydock: true,
    portFeePerCall: 10500,
    hasPassengerTerminal: true,
    category: 'mixed',
    annualCargoTonnageMillions: 85,
    annualPassengersThousands: 1050,
    description: 'Spain\'s leading container hub and western Mediterranean gateway with fast passenger ferries to the Balearics.'
  },
  {
    id: 'algeciras',
    name: 'Algeciras',
    country: 'Spain',
    lat: 36.13,
    lng: -5.45,
    x: 458,
    y: 236,
    fuelPricePerTon: 465,
    hasDrydock: true,
    portFeePerCall: 8500,
    hasPassengerTerminal: true,
    category: 'mixed',
    annualCargoTonnageMillions: 105,
    annualPassengersThousands: 4800,
    description: 'Strait of Gibraltar strategic transshipment powerhouse and dense passenger ferry bridge to North Africa.'
  },
  {
    id: 'barcelona',
    name: 'Barcelona',
    country: 'Spain',
    lat: 41.38,
    lng: 2.17,
    x: 480,
    y: 222,
    fuelPricePerTon: 490,
    hasDrydock: true,
    portFeePerCall: 12500,
    hasPassengerTerminal: true,
    category: 'passenger',
    annualCargoTonnageMillions: 70,
    annualPassengersThousands: 4600,
    description: 'Europe\'s #1 Mediterranean cruise port, high-capacity passenger ferry docks, and automated container berths.'
  },
  {
    id: 'marseille',
    name: 'Marseille-Fos',
    country: 'France',
    lat: 43.30,
    lng: 5.37,
    x: 488,
    y: 215,
    fuelPricePerTon: 495,
    hasDrydock: true,
    portFeePerCall: 11500,
    hasPassengerTerminal: true,
    category: 'mixed',
    annualCargoTonnageMillions: 75,
    annualPassengersThousands: 3100,
    description: 'France\'s largest commercial port, major petrochemical complex, and top Western Mediterranean passenger ferry portal.'
  },
  {
    id: 'genoa',
    name: 'Genoa',
    country: 'Italy',
    lat: 44.40,
    lng: 8.93,
    x: 498,
    y: 212,
    fuelPricePerTon: 500,
    hasDrydock: true,
    portFeePerCall: 12000,
    hasPassengerTerminal: true,
    category: 'mixed',
    annualCargoTonnageMillions: 60,
    annualPassengersThousands: 3400,
    description: 'Historic maritime republic, Northern Italy\'s leading freight terminal, and luxury Mediterranean cruise base.'
  },
  {
    id: 'piraeus',
    name: 'Piraeus',
    country: 'Greece',
    lat: 37.94,
    lng: 23.64,
    x: 538,
    y: 234,
    fuelPricePerTon: 485,
    hasDrydock: true,
    portFeePerCall: 11500,
    hasPassengerTerminal: true,
    category: 'passenger',
    annualCargoTonnageMillions: 80,
    annualPassengersThousands: 18500,
    description: 'Europe\'s largest passenger port with massive Greek Island ferry networks and a major Silk Road container terminal.'
  },
  {
    id: 'istanbul',
    name: 'Istanbul / Ambarli',
    country: 'Turkey',
    lat: 41.00,
    lng: 28.97,
    x: 552,
    y: 222,
    fuelPricePerTon: 480,
    hasDrydock: true,
    portFeePerCall: 11000,
    hasPassengerTerminal: true,
    category: 'mixed',
    annualCargoTonnageMillions: 90,
    annualPassengersThousands: 2200,
    description: 'Bosphorus crossroads connecting Black Sea and Mediterranean; Galataport cruise terminal & Ambarli container hub.'
  },

  // --- North America ---
  {
    id: 'losangeles',
    name: 'Los Angeles',
    country: 'United States',
    lat: 33.74,
    lng: -118.27,
    x: 180,
    y: 250,
    fuelPricePerTon: 520,
    hasDrydock: true,
    portFeePerCall: 17500,
    hasPassengerTerminal: true,
    category: 'mixed',
    annualCargoTonnageMillions: 210,
    annualPassengersThousands: 1600,
    description: 'North America\'s busiest container gateway at San Pedro Bay, equipped with the World Cruise Center.'
  },
  {
    id: 'longbeach',
    name: 'Long Beach',
    country: 'United States',
    lat: 33.75,
    lng: -118.19,
    x: 186,
    y: 254,
    fuelPricePerTon: 520,
    hasDrydock: false,
    portFeePerCall: 16500,
    hasPassengerTerminal: true,
    category: 'cargo',
    annualCargoTonnageMillions: 190,
    annualPassengersThousands: 1200,
    description: 'Premier California green port handling massive transpacific container trade, petroleum, and Queen Mary terminal.'
  },
  {
    id: 'newyork',
    name: 'New York / New Jersey',
    country: 'United States',
    lat: 40.71,
    lng: -74.00,
    x: 280,
    y: 220,
    fuelPricePerTon: 490,
    hasDrydock: true,
    portFeePerCall: 16000,
    hasPassengerTerminal: true,
    category: 'mixed',
    annualCargoTonnageMillions: 140,
    annualPassengersThousands: 1800,
    description: 'US East Coast premier mega-port handling transatlantic container commerce, dry bulk, and Manhattan cruise liners.'
  },
  {
    id: 'houston',
    name: 'Houston',
    country: 'United States',
    lat: 29.76,
    lng: -95.36,
    x: 235,
    y: 268,
    fuelPricePerTon: 455,
    hasDrydock: true,
    portFeePerCall: 13000,
    hasPassengerTerminal: false,
    category: 'cargo',
    annualCargoTonnageMillions: 285,
    annualPassengersThousands: 0,
    description: 'World-leading energy, crude, and petrochemical export port along the 52-mile Houston Ship Channel.'
  },
  {
    id: 'savannah',
    name: 'Savannah',
    country: 'United States',
    lat: 32.08,
    lng: -81.09,
    x: 272,
    y: 255,
    fuelPricePerTon: 495,
    hasDrydock: false,
    portFeePerCall: 11000,
    hasPassengerTerminal: false,
    category: 'cargo',
    annualCargoTonnageMillions: 60,
    annualPassengersThousands: 0,
    description: 'Home to the Garden City Terminal, the largest single-operator container facility in North America.'
  },
  {
    id: 'seattle',
    name: 'Seattle / Tacoma',
    country: 'United States',
    lat: 47.60,
    lng: -122.33,
    x: 170,
    y: 205,
    fuelPricePerTon: 515,
    hasDrydock: true,
    portFeePerCall: 14500,
    hasPassengerTerminal: true,
    category: 'mixed',
    annualCargoTonnageMillions: 45,
    annualPassengersThousands: 1300,
    description: 'Northwest Seaport Alliance deepwater hub and primary jumping-off cruise port for Alaskan voyages.'
  },
  {
    id: 'vancouver',
    name: 'Vancouver',
    country: 'Canada',
    lat: 49.28,
    lng: -123.12,
    x: 175,
    y: 195,
    fuelPricePerTon: 510,
    hasDrydock: true,
    portFeePerCall: 13500,
    hasPassengerTerminal: true,
    category: 'mixed',
    annualCargoTonnageMillions: 150,
    annualPassengersThousands: 1250,
    description: 'Canada\'s largest port: massive grain, potash, coal exports, transpacific containers, and Canada Place cruise pier.'
  },
  {
    id: 'miami',
    name: 'Miami',
    country: 'United States',
    lat: 25.76,
    lng: -80.19,
    x: 275,
    y: 285,
    fuelPricePerTon: 505,
    hasDrydock: false,
    portFeePerCall: 16500,
    hasPassengerTerminal: true,
    category: 'passenger',
    annualCargoTonnageMillions: 12,
    annualPassengersThousands: 7300,
    description: 'The "Cruise Capital of the World" serving over 7 million passengers annually alongside vibrant Latin America cargo trade.'
  },

  // --- Latin America, Africa & Atlantic ---
  {
    id: 'panama',
    name: 'Panama City / Canal',
    country: 'Panama',
    lat: 8.98,
    lng: -79.52,
    x: 255,
    y: 340,
    fuelPricePerTon: 540,
    hasDrydock: false,
    portFeePerCall: 25000,
    hasPassengerTerminal: true,
    category: 'cargo',
    annualCargoTonnageMillions: 90,
    annualPassengersThousands: 600,
    description: 'Crucial interoceanic canal gateway with high bunkering demand and round-the-world passenger transit.'
  },
  {
    id: 'santos',
    name: 'Santos',
    country: 'Brazil',
    lat: -23.96,
    lng: -46.33,
    x: 365,
    y: 440,
    fuelPricePerTon: 520,
    hasDrydock: false,
    portFeePerCall: 10500,
    hasPassengerTerminal: true,
    category: 'mixed',
    annualCargoTonnageMillions: 160,
    annualPassengersThousands: 1100,
    description: 'South America\'s prime export gateway for coffee, soybeans, sugar, iron ore, and international cruise voyages.'
  },
  {
    id: 'buenosaires',
    name: 'Buenos Aires',
    country: 'Argentina',
    lat: -34.60,
    lng: -58.38,
    x: 335,
    y: 480,
    fuelPricePerTon: 540,
    hasDrydock: true,
    portFeePerCall: 11500,
    hasPassengerTerminal: true,
    category: 'mixed',
    annualCargoTonnageMillions: 45,
    annualPassengersThousands: 750,
    description: 'Rio de la Plata grain, chilled beef, and container metropolis, and the premier gateway for Antarctic cruise liners.'
  },
  {
    id: 'durban',
    name: 'Durban',
    country: 'South Africa',
    lat: -29.85,
    lng: 31.02,
    x: 558,
    y: 462,
    fuelPricePerTon: 535,
    hasDrydock: true,
    portFeePerCall: 11000,
    hasPassengerTerminal: true,
    category: 'mixed',
    annualCargoTonnageMillions: 80,
    annualPassengersThousands: 450,
    description: 'Southern Africa\'s busiest commercial container and automobile terminal connecting Indian Ocean trade.'
  },
  {
    id: 'capetown',
    name: 'Cape Town',
    country: 'South Africa',
    lat: -33.92,
    lng: 18.42,
    x: 525,
    y: 475,
    fuelPricePerTon: 550,
    hasDrydock: true,
    portFeePerCall: 10000,
    hasPassengerTerminal: true,
    category: 'mixed',
    annualCargoTonnageMillions: 25,
    annualPassengersThousands: 950,
    description: 'The Cape of Good Hope sentinel route connecting Atlantic and Indian Oceans, with a premier V&A cruise terminal.'
  }
];

// Ship Blueprints (Including Luxury Ocean Liner)
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
    description: 'Rugged vintage single-screw steamer. Low purchase cost, ideal for budding shipowners handling general cargo and regional passenger charters.'
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
    description: 'Dependable general cargo vessel equipped with onboard cranes for flexible port access and mixed freight contracts.'
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
    description: 'Fast container ship with rapid port turnaround and high-value manufactured cargo yields.'
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
  },
  {
    id: 'ocean_liner',
    name: 'Transatlantic Luxury Liner',
    type: 'passenger',
    capacityTons: 12000,
    maxSpeedKnots: 22,
    fuelCapacityTons: 950,
    fuelConsumptionTonsPerDay: 35,
    baseCost: 4500000,
    lengthMeters: 245,
    beamMeters: 32,
    description: 'Magnificent multi-deck ocean liner built for high-speed luxury passenger cruises, international tour groups, and high-yield express freight.'
  }
];

// Commodities, Passenger Charters & Special Maritime Events
export interface CommodityDefinition {
  name: string;
  category: CommodityCategory;
  valueMultiplier: number;
  minTonnage: number;
  type: Array<'tramp' | 'freighter' | 'bulk' | 'container' | 'tanker' | 'passenger'>;
  specialEventTitle?: string;
  description?: string;
}

export const COMMODITIES: CommodityDefinition[] = [
  // 1. Bulk & Industrial Cargo (Dedicated cargo vessels: Tramp, Freighter, Bulker, Container, Tanker)
  {
    name: 'Crude Oil',
    category: 'cargo',
    valueMultiplier: 1.4,
    minTonnage: 8000,
    type: ['tanker'],
    description: 'Bulk petroleum crude requiring specialized oil tanker holds.'
  },
  {
    name: 'Grain & Wheat',
    category: 'cargo',
    valueMultiplier: 0.9,
    minTonnage: 2000,
    type: ['tramp', 'freighter', 'bulk'],
    description: 'Dry agricultural bulk freight suited for tramp steamers, general liners, or bulk carriers.'
  },
  {
    name: 'Iron Ore',
    category: 'cargo',
    valueMultiplier: 0.8,
    minTonnage: 5000,
    type: ['bulk', 'freighter'],
    description: 'Heavy mineral ores requiring reinforced holds and high deadweight capacity.'
  },
  {
    name: 'Electronics & Machinery',
    category: 'cargo',
    valueMultiplier: 2.1,
    minTonnage: 1000,
    type: ['container', 'freighter'],
    description: 'High-value precision manufacturing cargo requiring secure container cells.'
  },
  {
    name: 'Automobiles',
    category: 'cargo',
    valueMultiplier: 1.8,
    minTonnage: 2500,
    type: ['container', 'freighter'],
    description: 'Finished consumer vehicles and high-spec export automotive goods.'
  },
  {
    name: 'Textiles & Garments',
    category: 'cargo',
    valueMultiplier: 1.3,
    minTonnage: 1500,
    type: ['container', 'freighter', 'tramp'],
    description: 'Packaged manufactured textiles and clothing ready for global retailers.'
  },
  {
    name: 'Coffee & Spices',
    category: 'cargo',
    valueMultiplier: 1.6,
    minTonnage: 1200,
    type: ['freighter', 'container', 'tramp'],
    description: 'Valuable agricultural imports requiring ventilated dry holds.'
  },
  {
    name: 'Chemicals & Plastics',
    category: 'cargo',
    valueMultiplier: 1.7,
    minTonnage: 3000,
    type: ['tanker', 'container'],
    description: 'Refined petrochemical derivatives and industrial plastics.'
  },

  // 2. Commercial Passenger Lines (ONLY dedicated Passenger Liner: ocean_liner)
  {
    name: 'Luxury Cruise Passengers',
    category: 'passenger',
    valueMultiplier: 2.7,
    minTonnage: 1500,
    type: ['passenger'],
    description: 'High-paying vacationers booked for luxury state rooms, promenade decks, and gala dining.'
  },
  {
    name: 'Ocean Ferry Passengers & Vehicles',
    category: 'passenger',
    valueMultiplier: 1.9,
    minTonnage: 1000,
    type: ['passenger'],
    description: 'Scheduled coastal commuters and touring vehicles connecting major world hubs.'
  },
  {
    name: 'International Tourism Tour Group',
    category: 'passenger',
    valueMultiplier: 2.3,
    minTonnage: 800,
    type: ['passenger'],
    description: 'Organized international holiday delegations exploring foreign maritime cultures.'
  },

  // 3. Special Event Passenger Charters (Authorized for Passenger Liners AND vintage/small Tramp Steamers!)
  {
    name: 'Private Island Wedding Party Charter',
    category: 'special_event',
    specialEventTitle: '💍 WEDDING CRUISE',
    valueMultiplier: 3.2,
    minTonnage: 500,
    type: ['passenger', 'tramp'],
    description: 'Exclusive multi-day private wedding gala chartered across picturesque coastal destinations.'
  },
  {
    name: 'Hostage Return & Diplomatic Repatriation',
    category: 'special_event',
    specialEventTitle: '🕊️ HOSTAGE RETURN',
    valueMultiplier: 3.8,
    minTonnage: 350,
    type: ['passenger', 'tramp'],
    description: 'Urgent humanitarian mission securing evacuated diplomats and released citizens under neutral ensign.'
  },
  {
    name: 'Oceanographic Scientific Expedition',
    category: 'special_event',
    specialEventTitle: '🔬 SCIENTIFIC EXPEDITION',
    valueMultiplier: 2.9,
    minTonnage: 600,
    type: ['passenger', 'tramp'],
    description: 'Deep-sea research charter conveying oceanographers, surveyors, and specialized equipment.'
  }
];

/**
 * Validates whether a specific ship blueprint is permitted to accept a charter contract
 * Rule 1: Passenger ship carries ONLY passengers / special events (no cargo).
 * Rule 2: Bigger cargo ships carry ONLY cargo (no passengers).
 * Rule 3: Small & old cargo ship (tramp) can carry cargo AND passenger special events (wedding, hostage return, expedition).
 */
export function canShipAcceptContract(
  blueprint: ShipBlueprint,
  commodityName: string
): { allowed: boolean; reason?: string } {
  const comm = COMMODITIES.find((c) => c.name === commodityName);
  if (!comm) return { allowed: true };

  // Rule 1: Passenger ships carry ONLY passengers (no industrial cargo)
  if (blueprint.type === 'passenger') {
    if (comm.category === 'cargo') {
      return {
        allowed: false,
        reason: `${blueprint.name} is a dedicated passenger liner and cannot carry cargo.`
      };
    }
    return { allowed: true };
  }

  // Rule 2: Bigger cargo ships carry ONLY cargo (no passengers / events)
  if (['freighter', 'bulk', 'container', 'tanker'].includes(blueprint.type)) {
    if (comm.category === 'passenger' || comm.category === 'special_event') {
      return {
        allowed: false,
        reason: `${blueprint.name} is a commercial cargo vessel and cannot carry passengers.`
      };
    }
    if (!comm.type.includes(blueprint.type)) {
      return {
        allowed: false,
        reason: `${blueprint.name} holds cannot transport ${comm.name}.`
      };
    }
    return { allowed: true };
  }

  // Rule 3: Small and old cargo ship (tramp) carries cargo + special passenger events
  if (blueprint.type === 'tramp') {
    if (comm.category === 'passenger') {
      return {
        allowed: false,
        reason: `${blueprint.name} lacks passenger liner decks. It only takes passengers for special events (Wedding, Hostage Return).`
      };
    }
    if (comm.category === 'special_event') {
      return { allowed: true };
    }
    if (!comm.type.includes('tramp')) {
      return {
        allowed: false,
        reason: `${blueprint.name} holds cannot transport ${comm.name}.`
      };
    }
    return { allowed: true };
  }

  return { allowed: true };
}

/**
 * World Fleet Quota & Scarcity System
 * Limits the number of ships in the world based on:
 * 1. Ship Size (smaller ships are more plentiful than mega vessels)
 * 2. Player Count (more players expand global production quotas)
 * 3. Duration of the Game (longer play yields newly commissioned dockyard hulls)
 */
export interface WorldShipQuotaInfo {
  blueprintId: string;
  blueprintName: string;
  totalCap: number;
  inService: number;
  availableStock: number;
}

export function calculateMaxWorldShips(blueprintId: string, playerCount: number, currentDay: number): number {
  const p = Math.max(1, playerCount);
  const d = Math.max(1, currentDay);

  switch (blueprintId) {
    case 'tramp_steamer':
      // Smallest: abundant vintage hulls in every global port
      // Base: 3 per player + 1 every 10 days per player
      return Math.floor(p * 3 + (d / 10) * p);

    case 'general_freighter':
      // Medium: standard commercial freighter
      // Base: 2 per player + 1 every 18 days per player
      return Math.floor(p * 2 + (d / 18) * p);

    case 'bulk_carrier':
      // Large bulk carrier: heavy shipyard requirement
      // Base: 1 per player + 1 every 30 days per player
      return Math.max(1, Math.floor(p * 1 + (d / 30) * p));

    case 'container_ship':
      // Large fast container ship: high-tech shipyard slipways
      // Base: 1 per player + 1 every 35 days per player
      return Math.max(1, Math.floor(p * 1 + (d / 35) * p));

    case 'ocean_liner':
      // Luxury passenger liner: prestigious flagship commission
      // Base: 1 per 2 players (min 1) + 1 every 50 game days
      return Math.max(1, Math.floor(Math.ceil(p * 0.5) + d / 50));

    case 'super_tanker':
      // Colossal crude supertanker: largest hulls on the oceans, very scarce
      // Base: 1 per 2 players (min 1) + 1 every 60 game days
      return Math.max(1, Math.floor(Math.ceil(p * 0.5) + d / 60));

    default:
      return Math.max(1, p * 2);
  }
}

export function countActiveShipsByBlueprint(state: GameState, blueprintId: string): number {
  let count = 0;
  if (!state || !state.players) return 0;
  for (const player of Object.values(state.players)) {
    if (!player.ships) continue;
    for (const ship of player.ships) {
      if (ship.blueprintId === blueprintId) {
        count++;
      }
    }
  }
  return count;
}

export function getWorldShipStock(state: GameState, blueprintId: string): WorldShipQuotaInfo {
  const playerCount = Object.keys(state.players || {}).length || 1;
  const currentDay = state.currentDay || 1;
  const bp = SHIP_BLUEPRINTS.find((b) => b.id === blueprintId) || SHIP_BLUEPRINTS[0];
  const totalCap = calculateMaxWorldShips(blueprintId, playerCount, currentDay);
  const inService = countActiveShipsByBlueprint(state, blueprintId);
  const availableStock = Math.max(0, totalCap - inService);

  return {
    blueprintId,
    blueprintName: bp.name,
    totalCap,
    inService,
    availableStock
  };
}

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

// Curated list of iconic historical and realistic maritime shipping company names
export const MARITIME_COMPANY_NAMES: string[] = [
  'Blue Star Line',
  'Nordic Merchant Marine',
  'Hanseatic Steamship Co.',
  'Seven Seas Freight',
  'Poseidon Commercial Lines',
  'North Sea Logistics',
  'Royal Atlantic Steamship',
  'Baltic Navigation Corp',
  'Cape Horn Transport',
  'Pacific Crest Maritime',
  'Mediterranean Cargo Lines',
  'Silver Wave Shipping',
  'Golden Horn Oceanics',
  'Red Anchor Line',
  'Equator Marine Transport',
  'Tradewinds Navigation',
  'Meridian Steamship Ltd',
  'Black Sea Consortium',
  'Orient Maritime Express',
  'Zephyr Ocean Freight',
  'Phoenix Sea Lines',
  'Trident Bulk Carriers',
  'Vanguard Cargo Lines',
  'Atlas Marine Fleet',
  'Endeavour Shipping Co.',
  'Solent Maritime Express',
  'Gibraltar Ocean Lines',
  'Boreas Arctic Shipping',
  'Celtic Sea Logistics',
  'Pioneer Freight Lines',
  'Sovereign Maritime Corp',
  'Iron Anchor Steamship',
  'Straits Maritime Ltd',
  'Corsair Commercial Fleet',
  'Helgoland Cargo Transport',
  'Monsoon Sea Traders',
  'Argonaut Marine Lines',
  'Bosphorus Navigation',
  'Neptune Global Freight',
  'Aegean Steamship Co.',
  'Clipper Ocean Express',
  'Adriatic Bulk Logistics',
  'Polar Star Shipping',
  'Australis Maritime',
  'Liberty Freight Lines',
  'Enterprise Sea Transport',
  'Mermaid Commercial Line',
  'Horizon Wave Marine',
  'Antilles Shipping Co.',
  'Levant Cargo Lines',
  'Caledonian Steamship',
  'Magellan Ocean Transport',
  'Scandia Cargo Fleet',
  'Biscay Commercial Line',
  'Viking Freight Logistics'
];

export const MARITIME_PREFIXES = [
  'Atlantic', 'Pacific', 'Nordic', 'Baltic', 'Hanseatic', 'Oceanic',
  'Blue Star', 'Red Anchor', 'Silver Wave', 'Golden Horn', 'Seven Seas',
  'Royal', 'North Sea', 'Cape Horn', 'Equator', 'Tradewinds', 'Poseidon',
  'Neptune', 'Trident', 'Atlas', 'Vanguard', 'Phoenix', 'Aegean', 'Adriatic',
  'Bosphorus', 'Solent', 'Gibraltar', 'Celtic', 'Polar', 'Meridian'
];

export const MARITIME_SUFFIXES = [
  'Shipping Line', 'Maritime Corp', 'Steamship Co.', 'Cargo Lines',
  'Freight Express', 'Ocean Transport', 'Navigation Co.', 'Merchant Fleet',
  'Bulk Carriers', 'Logistics Ltd', 'Commercial Marine', 'Sea Traders'
];

export function getRandomCompanyName(excludeNames: string[] = []): string {
  const normalizedExclude = new Set(excludeNames.map((n) => n.trim().toLowerCase()));

  // 1. Try picking from curated iconic list first
  const availableCurated = MARITIME_COMPANY_NAMES.filter(
    (n) => !normalizedExclude.has(n.toLowerCase())
  );
  if (availableCurated.length > 0) {
    const idx = Math.floor(Math.random() * availableCurated.length);
    return availableCurated[idx];
  }

  // 2. Procedural generation fallback (combines prefix + suffix)
  for (let attempt = 0; attempt < 50; attempt++) {
    const pre = MARITIME_PREFIXES[Math.floor(Math.random() * MARITIME_PREFIXES.length)];
    const suf = MARITIME_SUFFIXES[Math.floor(Math.random() * MARITIME_SUFFIXES.length)];
    const candidate = `${pre} ${suf}`;
    if (!normalizedExclude.has(candidate.toLowerCase())) {
      return candidate;
    }
  }

  // 3. Numbered fallback
  const base = MARITIME_COMPANY_NAMES[Math.floor(Math.random() * MARITIME_COMPANY_NAMES.length)];
  return `${base} ${Math.floor(Math.random() * 900 + 100)}`;
}

/**
 * Calculates the establishment and licensing cost to base a company's headquarters in a given port.
 * Better ports (higher cargo tonnage, cruise passengers, drydocks, dual mixed infrastructure)
 * command higher establishment fees, reflecting their premier commercial value and strategic reach.
 */
export function calculateHomePortCost(port: Port): number {
  let cost = 20000; // Base maritime charter & registration fee

  if (port.category === 'mixed') {
    cost += 25000; // Premium dual terminal rights (cargo + passenger)
  } else if (port.category === 'passenger') {
    cost += 20000; // Premier cruise waterfront access
  } else {
    cost += 15000; // Heavy industrial berthing rights
  }

  const cargoM = port.annualCargoTonnageMillions || 15;
  const paxK = port.annualPassengersThousands || 0;

  // Scale by annual cargo & passenger volumes
  cost += Math.min(35000, Math.round(cargoM * 40));
  cost += Math.min(25000, Math.round((paxK / 1000) * 3500));

  // Shipyard drydock facility on site
  if (port.hasDrydock) {
    cost += 15000;
  }

  // Base port tariff influence
  cost += Math.round((port.portFeePerCall || 10000) * 0.8);

  return Math.round(cost / 1000) * 1000;
}

