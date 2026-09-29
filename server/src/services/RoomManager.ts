import { Server, Socket } from 'socket.io';
import { GameRoom } from './GameRoom.js';
import { PublicRoomInfo } from '@portofcall/shared';

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

  constructor(io: Server) {
    this.io = io;
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

    this.broadcastRoomList();
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

    this.broadcastRoomList();
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
              console.log(`[Room Expired] Grace period elapsed for room ${code}. Stopping room.`);
              room.stop();
              this.rooms.delete(code);
              this.cleanupTimers.delete(code);
              this.broadcastRoomList();
            }, 10 * 60 * 1000);
            this.cleanupTimers.set(code, cleanup);
          }
        }
      }
      this.socketToRoom.delete(socketId);
      this.broadcastRoomList();
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
          room.stop();
          this.rooms.delete(code);
        }
      }
      this.socketToRoom.delete(socketId);
      this.broadcastRoomList();
    }
  }
}
