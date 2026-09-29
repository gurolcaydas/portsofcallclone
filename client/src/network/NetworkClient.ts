import { io, Socket } from 'socket.io-client';
import {
  GameState,
  GlobalNewsItem,
  ClientToServerEvents,
  ServerToClientEvents
} from '@portofcall/shared';

export class NetworkClient {
  private socket: Socket<ServerToClientEvents, ClientToServerEvents>;
  public playerId: string | null = null;
  public roomCode: string | null = null;
  public sessionToken: string | null = null;

  // Listeners
  public onStateUpdate: ((state: GameState) => void) | null = null;
  public onNews: ((news: GlobalNewsItem) => void) | null = null;
  public onActionResult: ((res: { success: boolean; message: string; action: string }) => void) | null = null;
  public onMinigameStart: ((data: { shipId: string; type: 'docking' | 'hazard'; portId?: string; hazardType?: string }) => void) | null = null;
  public onError: ((msg: string) => void) | null = null;

  constructor() {
    this.socket = io(window.location.origin, {
      autoConnect: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000
    });

    this.setupListeners();
  }

  private setupListeners() {
    this.socket.on('connect', () => {
      console.log('Connected to maritime game server, socket ID:', this.socket.id);
    });

    this.socket.on('room:state', (state: GameState) => {
      if (this.onStateUpdate) this.onStateUpdate(state);
    });

    this.socket.on('game:news', (news: GlobalNewsItem) => {
      if (this.onNews) this.onNews(news);
    });

    this.socket.on('player:action_result', (res) => {
      if (this.onActionResult) this.onActionResult(res);
    });

    this.socket.on('minigame:start', (data) => {
      if (this.onMinigameStart) this.onMinigameStart(data);
    });

    this.socket.on('error', (msg: string) => {
      if (this.onError) this.onError(msg);
    });
  }

  public createRoom(companyName: string, color: string): Promise<{ success: boolean; roomCode?: string; sessionToken?: string; error?: string }> {
    return new Promise((resolve) => {
      this.socket.emit('room:create', { companyName, color }, (res) => {
        if (res.success && res.roomCode && res.playerId) {
          this.roomCode = res.roomCode;
          this.playerId = res.playerId;
          this.sessionToken = res.sessionToken || null;
        }
        resolve(res);
      });
    });
  }

  public joinRoom(roomCode: string, companyName: string, color: string): Promise<{ success: boolean; sessionToken?: string; error?: string }> {
    return new Promise((resolve) => {
      this.socket.emit('room:join', { roomCode, companyName, color }, (res) => {
        if (res.success && res.playerId) {
          this.roomCode = roomCode;
          this.playerId = res.playerId;
          this.sessionToken = res.sessionToken || null;
        }
        resolve(res);
      });
    });
  }

  public reconnect(roomCode: string, sessionToken: string): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      this.socket.emit('room:reconnect', { roomCode, sessionToken }, (res) => {
        if (res.success && res.playerId) {
          this.roomCode = roomCode;
          this.playerId = res.playerId;
          this.sessionToken = sessionToken;
        }
        resolve(res);
      });
    });
  }

  public leaveRoom() {
    this.socket.emit('room:leave');
    this.roomCode = null;
    this.playerId = null;
    this.sessionToken = null;
  }

  public startGame() {
    this.socket.emit('room:start_game');
  }

  public acceptCharter(shipId: string, contractId: string) {
    this.socket.emit('action:accept_charter', { shipId, contractId });
  }

  public bunkerFuel(shipId: string, tons: number) {
    this.socket.emit('action:bunker_fuel', { shipId, tons });
  }

  public startVoyage(shipId: string) {
    this.socket.emit('action:start_voyage', { shipId });
  }

  public autoDock(shipId: string) {
    this.socket.emit('action:auto_dock', { shipId });
  }

  public bypassHazard(shipId: string) {
    this.socket.emit('action:bypass_hazard', { shipId });
  }

  public completeMinigame(shipId: string, score: number, damagePercent: number, success: boolean) {
    this.socket.emit('minigame:complete', { shipId, score, damagePercent, success });
  }

  public buyShip(blueprintId: string, shipName: string) {
    this.socket.emit('action:buy_ship', { blueprintId, shipName });
  }

  public sellShip(shipId: string) {
    this.socket.emit('action:sell_ship', { shipId });
  }

  public repairShip(shipId: string, type: 'hull' | 'engine', amount: number) {
    this.socket.emit('action:repair_ship', { shipId, type, amount });
  }

  public bankTransaction(type: 'borrow' | 'repay', amount: number) {
    this.socket.emit('action:bank_transaction', { type, amount });
  }
}
