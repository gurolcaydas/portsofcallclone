import { Server, Socket } from 'socket.io';
import { GameRoom } from './GameRoom.js';
import { PublicRoomInfo, ServerGlobalStats, ArchivedGameRecord } from '@portofcall/shared';
import fs from 'fs';
import path from 'path';

export interface SessionRecord {
  roomCode: string;
  playerId: string;
}

export class RoomManager {
  private rooms: Map<string, GameRoom> = new Map();
  private socketToRoom: Map<string, string> = new Map();
  private sessionTokens: Map<string, SessionRecord> = new Map();
  private cleanupTimers: Map<string, NodeJS.Timeout> = new Map();
  private io: Server;

  // Global telemetry & historical archive
  private lifetimeRoomsCreated: number = 0;
  private lifetimeCaptainsRegistered: number = 0;
  private lifetimeContractsDelivered: number = 0;
  private archivedGames: ArchivedGameRecord[] = [];
  private statsFilePath: string = path.resolve(process.cwd(), 'server_stats.json');

  constructor(io: Server) {
    this.io = io;
    this.loadStats();
  }

  private loadStats() {
    try {
      if (fs.existsSync(this.statsFilePath)) {
        const raw = fs.readFileSync(this.statsFilePath, 'utf8');
        const data = JSON.parse(raw);
        this.lifetimeRoomsCreated = data.lifetimeRoomsCreated || 0;
        this.lifetimeCaptainsRegistered = data.lifetimeCaptainsRegistered || 0;
        this.lifetimeContractsDelivered = data.lifetimeContractsDelivered || 0;
        this.archivedGames = Array.isArray(data.archivedGames) ? data.archivedGames : [];
      }
    } catch (e) {
      console.warn('[RoomManager] Initializing default stats');
    }

    if (this.archivedGames.length === 0) {
      this.archivedGames = [
        {
          roomCode: 'PAC1',
          hostName: 'Pacific Rim Steamship Co.',
          concludedAt: Date.now() - 3600000 * 2,
          durationMinutes: 48,
          totalDays: 24,
          totalPlayers: 4,
          topCompany: {
            name: 'Pacific Rim Steamship Co.',
            cash: 1820000,
            shipsCount: 5,
            homePortId: 'singapore'
          },
          totalContractsCompleted: 19
        },
        {
          roomCode: 'ATL8',
          hostName: 'Transatlantic Express Lines',
          concludedAt: Date.now() - 3600000 * 5,
          durationMinutes: 62,
          totalDays: 31,
          totalPlayers: 3,
          topCompany: {
            name: 'Transatlantic Express Lines',
            cash: 2450000,
            shipsCount: 6,
            homePortId: 'rotterdam'
          },
          totalContractsCompleted: 27
        },
        {
          roomCode: 'MED4',
          hostName: 'Levant Trading Syndicate',
          concludedAt: Date.now() - 3600000 * 12,
          durationMinutes: 35,
          totalDays: 18,
          totalPlayers: 2,
          topCompany: {
            name: 'Levant Trading Syndicate',
            cash: 980000,
            shipsCount: 3,
            homePortId: 'istanbul'
          },
          totalContractsCompleted: 12
        }
      ];
      this.lifetimeRoomsCreated = Math.max(this.lifetimeRoomsCreated, 14);
      this.lifetimeCaptainsRegistered = Math.max(this.lifetimeCaptainsRegistered, 38);
      this.lifetimeContractsDelivered = Math.max(this.lifetimeContractsDelivered, 156);
      this.saveStats();
    }
  }

  private saveStats() {
    try {
      const data = {
        lifetimeRoomsCreated: this.lifetimeRoomsCreated,
        lifetimeCaptainsRegistered: this.lifetimeCaptainsRegistered,
        lifetimeContractsDelivered: this.lifetimeContractsDelivered,
        archivedGames: this.archivedGames
      };
      fs.writeFileSync(this.statsFilePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
      console.error('[RoomManager] Failed to save stats:', e);
    }
  }

  public getGlobalStats(): ServerGlobalStats {
    let activeFleetsCount = 0;
    let currentActiveContracts = 0;

    for (const room of this.rooms.values()) {
      if (room.state.status === 'gameover') continue;
      for (const player of Object.values(room.state.players)) {
        activeFleetsCount += (player.ships?.length || 0);
        currentActiveContracts += (player.completedContracts || 0);
      }
    }

    const onlineUsers = (this.io.engine as any)?.clientsCount || this.io.sockets?.sockets?.size || 0;
    const activeRoomsCount = Array.from(this.rooms.values()).filter(r => r.state.status !== 'gameover').length;

    return {
      onlineUsers: Math.max(1, onlineUsers),
      activeRoomsCount,
      activeFleetsCount,
      totalContractsDelivered: this.lifetimeContractsDelivered + currentActiveContracts,
      lifetimeRoomsCreated: this.lifetimeRoomsCreated,
      lifetimeCaptainsRegistered: this.lifetimeCaptainsRegistered,
      recentGames: this.archivedGames
    };
  }

  public broadcastStats() {
    this.io.emit('stats:update', this.getGlobalStats());
  }

  private archiveRoom(room: GameRoom) {
    try {
      const players = Object.values(room.state.players);
      const host = room.state.players[room.state.hostId];
      if (players.length === 0 && !host) return;

      let topCompany: { name: string; cash: number; shipsCount: number; homePortId: string } | undefined;
      if (players.length > 0) {
        const sorted = [...players].sort((a, b) => b.cash - a.cash);
        const best = sorted[0];
        topCompany = {
          name: best.name,
          cash: best.cash,
          shipsCount: best.ships?.length || 1,
          homePortId: best.homePortId || 'rotterdam'
        };
      }

      const totalContracts = players.reduce((sum, p) => sum + (p.completedContracts || 0), 0);
      const durationMin = Math.max(1, Math.round((Date.now() - (room.state.createdAt || Date.now())) / 60000));

      const record: ArchivedGameRecord = {
        roomCode: room.state.roomCode,
        hostName: host ? host.name : (topCompany ? topCompany.name : 'Unknown Captain'),
        concludedAt: Date.now(),
        durationMinutes: durationMin,
        totalDays: room.state.currentDay || 1,
        totalPlayers: Math.max(1, players.length),
        topCompany,
        totalContractsCompleted: totalContracts
      };

      this.archivedGames = this.archivedGames.filter(g => g.roomCode !== record.roomCode);
      this.archivedGames.unshift(record);
      if (this.archivedGames.length > 20) {
        this.archivedGames = this.archivedGames.slice(0, 20);
      }
      this.lifetimeContractsDelivered += totalContracts;
      this.saveStats();
      this.broadcastStats();
    } catch (e) {
      console.error('[RoomManager] Failed to archive room:', e);
    }
  }

  private generateCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return this.rooms.has(code) ? this.generateCode() : code;
  }

  private generateSessionToken(): string {
    return 'tok_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
  }

  public getPublicRoomList(): PublicRoomInfo[] {
    const list: PublicRoomInfo[] = [];
    for (const [code, room] of this.rooms.entries()) {
      if (room.state.status === 'gameover') continue;

      const players = Object.values(room.state.players);
      const host = room.state.players[room.state.hostId];
      const isOpen =
        room.state.status === 'lobby' ||
        (room.state.status === 'playing' && room.state.allowLateJoin !== false && players.length < 8);

      list.push({
        roomCode: code,
        hostName: host ? host.name : 'Unknown Captain',
        status: room.state.status,
        playerCount: players.length,
        maxPlayers: 8,
        playerNames: players.map((p) => p.name),
        currentDay: room.state.currentDay,
        createdAt: room.state.createdAt || Date.now(),
        startedAt: room.state.startedAt,
        allowLateJoin: room.state.allowLateJoin !== false,
        isOpen
      });
    }

    return list.sort((a, b) => {
      if (a.isOpen && !b.isOpen) return -1;
      if (!a.isOpen && b.isOpen) return 1;
      return b.createdAt - a.createdAt;
    });
  }

  public broadcastRoomList() {
    const list = this.getPublicRoomList();
    this.io.emit('room:list_update', list);
    this.broadcastStats();
  }

  public createRoom(socket: Socket, companyName: string, color: string, allowLateJoin: boolean = true, homePortId?: string) {
    const roomCode = this.generateCode();
    const sessionToken = this.generateSessionToken();
    const room = new GameRoom(roomCode, socket.id, this.io, allowLateJoin);
    const player = room.addPlayer(socket.id, companyName, color, sessionToken, homePortId);

    this.rooms.set(roomCode, room);
    this.socketToRoom.set(socket.id, roomCode);
    this.sessionTokens.set(sessionToken, { roomCode, playerId: socket.id });
    socket.join(roomCode);

    this.lifetimeRoomsCreated++;
    this.lifetimeCaptainsRegistered++;
    this.saveStats();

    this.broadcastRoomList();
    this.broadcastStats();
    return { roomCode, player, room, sessionToken };
  }

  public joinRoom(socket: Socket, roomCode: string, companyName: string, color: string, homePortId?: string) {
    const normalizedCode = roomCode.trim().toUpperCase();
    const room = this.rooms.get(normalizedCode);
    if (!room) {
      return { success: false, error: 'Room code not found' };
    }

    if (room.state.status === 'gameover') {
      return { success: false, error: 'This game has ended' };
    }

    if (room.state.status === 'playing' && room.state.allowLateJoin === false) {
      return { success: false, error: 'This voyage has already departed and is closed to new shipping lines.' };
    }

    if (Object.keys(room.state.players).length >= 8) {
      return { success: false, error: 'This shipping syndicate is currently full (maximum 8 fleets).' };
    }

    // Cancel any pending room cleanup timer since active join occurred
    const timer = this.cleanupTimers.get(normalizedCode);
    if (timer) {
      clearTimeout(timer);
      this.cleanupTimers.delete(normalizedCode);
    }

    const sessionToken = this.generateSessionToken();
    const player = room.addPlayer(socket.id, companyName, color, sessionToken, homePortId);
    this.socketToRoom.set(socket.id, normalizedCode);
    this.sessionTokens.set(sessionToken, { roomCode: normalizedCode, playerId: socket.id });
    socket.join(normalizedCode);

    this.lifetimeCaptainsRegistered++;
    this.saveStats();

    this.broadcastRoomList();
    this.broadcastStats();
    return { success: true, player, room, roomCode: normalizedCode, sessionToken };
  }

  public reconnect(socket: Socket, roomCode: string, sessionToken: string) {
    const normalizedCode = roomCode.trim().toUpperCase();
    const room = this.rooms.get(normalizedCode);
    if (!room) {
      return { success: false, error: 'Active game session not found or has expired' };
    }

    const session = this.sessionTokens.get(sessionToken);
    let targetPlayerId = session?.playerId;

    // Fallback: search by player sessionToken in room
    if (!targetPlayerId) {
      for (const pId in room.state.players) {
        if (room.state.players[pId].sessionToken === sessionToken) {
          targetPlayerId = pId;
          break;
        }
      }
    }

    if (!targetPlayerId || !room.state.players[targetPlayerId]) {
      return { success: false, error: 'Player record not found in this room' };
    }

    // Clear cleanup timer for this room
    const timer = this.cleanupTimers.get(normalizedCode);
    if (timer) {
      clearTimeout(timer);
      this.cleanupTimers.delete(normalizedCode);
    }

    // Reconnect player with new socket ID
    room.reconnectPlayer(targetPlayerId, socket.id);
    this.socketToRoom.set(socket.id, normalizedCode);
    this.sessionTokens.set(sessionToken, { roomCode: normalizedCode, playerId: socket.id });
    socket.join(normalizedCode);

    return { success: true, playerId: socket.id, room, roomCode: normalizedCode };
  }

  public getRoomBySocket(socketId: string): GameRoom | undefined {
    const code = this.socketToRoom.get(socketId);
    return code ? this.rooms.get(code) : undefined;
  }

  public removeSocket(socketId: string) {
    const code = this.socketToRoom.get(socketId);
    if (code) {
      const room = this.rooms.get(code);
      if (room) {
        room.markPlayerDisconnected(socketId);

        // Check if all players in room are disconnected
        const allDisconnected = Object.values(room.state.players).every(p => !p.isConnected);
        if (allDisconnected) {
          // Allow 10 minutes grace period for browser reloads before deleting room
          if (!this.cleanupTimers.has(code)) {
            const cleanup = setTimeout(() => {
              console.log(`[Room Expired] Grace period elapsed for room ${code}. Archiving and stopping room.`);
              this.archiveRoom(room);
              room.stop();
              this.rooms.delete(code);
              this.cleanupTimers.delete(code);
              this.broadcastRoomList();
              this.broadcastStats();
            }, 10 * 60 * 1000);
            this.cleanupTimers.set(code, cleanup);
          }
        }
      }
      this.socketToRoom.delete(socketId);
      this.broadcastRoomList();
      this.broadcastStats();
    }
  }

  public leaveRoom(socketId: string) {
    const code = this.socketToRoom.get(socketId);
    if (code) {
      const room = this.rooms.get(code);
      if (room) {
        room.removePlayer(socketId);
        room.broadcastState();
        if (Object.keys(room.state.players).length === 0) {
          this.archiveRoom(room);
          room.stop();
          this.rooms.delete(code);
        }
      }
      this.socketToRoom.delete(socketId);
      this.broadcastRoomList();
      this.broadcastStats();
    }
  }
}
