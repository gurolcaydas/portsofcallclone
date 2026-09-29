import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { Server } from 'socket.io';
import cors from 'cors';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  getRandomCompanyName
} from '@portofcall/shared';
import { RoomManager } from './services/RoomManager.js';

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const roomManager = new RoomManager(io as any);

const clientDistCandidates = [
  path.resolve(process.cwd(), 'client/dist'),
  path.resolve(process.cwd(), '../client/dist')
];
const clientDistPath = clientDistCandidates.find(p => fs.existsSync(p));

if (clientDistPath) {
  console.log(`📦 Serving static client from ${clientDistPath}`);
  app.use(express.static(clientDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
      return next();
    }
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Port of Call — Multiplayer Backend Engine</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          background: #061122;
          color: #e2e8f0;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          margin: 0;
          text-align: center;
        }
        .card {
          background: rgba(13, 27, 42, 0.9);
          border: 1px solid rgba(0, 210, 255, 0.35);
          border-radius: 14px;
          padding: 2.5rem;
          max-width: 520px;
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.6);
        }
        h1 { color: #00d2ff; margin-bottom: 0.3rem; font-size: 1.9rem; letter-spacing: 1px; }
        p { color: #94a3b8; font-size: 0.95rem; line-height: 1.6; }
        .badge { display: inline-block; background: rgba(46, 213, 115, 0.15); color: #2ed573; border: 1px solid #2ed573; border-radius: 6px; padding: 4px 12px; font-weight: 700; font-size: 0.8rem; margin: 8px 0 16px 0; }
        .btn {
          display: inline-block;
          background: linear-gradient(135deg, #00b4db 0%, #0083b0 100%);
          color: #ffffff;
          padding: 12px 28px;
          font-weight: 700;
          border-radius: 8px;
          text-decoration: none;
          margin-top: 1.25rem;
          box-shadow: 0 4px 18px rgba(0, 180, 219, 0.4);
          transition: transform 0.15s, filter 0.15s;
        }
        .btn:hover { filter: brightness(1.15); transform: translateY(-1px); }
        .info-box {
          background: rgba(5, 11, 20, 0.6);
          border-radius: 8px;
          padding: 12px;
          font-size: 0.85rem;
          color: #7dd3fc;
          margin-top: 1rem;
          text-align: left;
        }
      </style>
    </head>
    <body>
      <div class="card">
        <div style="font-size: 2.8rem; margin-bottom: 0.4rem;">⚓</div>
        <h1>Port of Call</h1>
        <div class="badge">● MULTIPLAYER ENGINE ONLINE (PORT 3001)</div>
        <p>
          This is the <strong>Backend Simulation & WebSocket Server</strong>.
          It runs the continuous calendar day-ticker, manages simultaneous multiplayer rooms, generates freight market contracts, and tracks ship voyages across global shipping lanes.
        </p>
        <div class="info-box">
          <div>🔌 <strong>WebSocket:</strong> Socket.io listening on port 3001</div>
          <div>🌐 <strong>Active Service:</strong> GameRoom, MarketEngine, RoomManager</div>
        </div>
        <p style="margin-top: 1.25rem;">To play the game and manage your fleet, open the web client:</p>
        <a class="btn" href="http://localhost:5173" target="_self">🎮 Open Web Game (http://localhost:5173)</a>
      </div>
    </body>
    </html>
  `);
  });
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

io.on('connection', (socket) => {
  console.log(`[Socket Connected] ID: ${socket.id}`);

  // Send initial room list on connection
  socket.emit('room:list_update', roomManager.getPublicRoomList());

  // Room list query
  socket.on('room:list', (callback) => {
    if (typeof callback === 'function') {
      callback(roomManager.getPublicRoomList());
    }
  });

  // Create room
  socket.on('room:create', (data, callback) => {
    try {
      const { roomCode, player, room, sessionToken } = roomManager.createRoom(
        socket,
        data.companyName?.trim() || getRandomCompanyName(),
        data.color || '#00d2ff',
        data.allowLateJoin !== false,
        data.homePortId
      );
      callback({ success: true, roomCode, playerId: socket.id, sessionToken });
      room.broadcastState();
      console.log(`[Room Created] ${roomCode} by ${data.companyName} at ${player.homePortId} (LateJoin: ${data.allowLateJoin !== false})`);
    } catch (err: any) {
      callback({ success: false, error: err.message });
    }
  });

  // Join room
  socket.on('room:join', (data, callback) => {
    try {
      const result = roomManager.joinRoom(
        socket,
        data.roomCode,
        data.companyName?.trim() || getRandomCompanyName(),
        data.color || '#f7b731',
        data.homePortId
      );
      if (!result.success || !result.room) {
        return callback({ success: false, error: result.error });
      }
      callback({ success: true, playerId: socket.id, sessionToken: result.sessionToken });
      result.room.broadcastState();
      console.log(`[Player Joined] ${data.companyName} joined ${result.roomCode}`);
    } catch (err: any) {
      callback({ success: false, error: err.message });
    }
  });

  // Reconnect player after browser reload or network interruption
  socket.on('room:reconnect', (data, callback) => {
    try {
      const result = roomManager.reconnect(socket, data.roomCode, data.sessionToken);
      if (!result.success || !result.room) {
        return callback({ success: false, error: result.error });
      }
      callback({ success: true, playerId: socket.id });
      result.room.broadcastState();
      console.log(`[Player Reconnected] ${socket.id} reconnected to ${result.roomCode}`);
    } catch (err: any) {
      callback({ success: false, error: err.message });
    }
  });

  // Leave room intentionally
  socket.on('room:leave', () => {
    roomManager.leaveRoom(socket.id);
  });

  // Start game
  socket.on('room:start_game', () => {
    const room = roomManager.getRoomBySocket(socket.id);
    if (!room) return socket.emit('error', 'Room not found');
    if (room.state.hostId !== socket.id) {
      return socket.emit('error', 'Only the host can start the voyage');
    }
    const started = room.startGame();
    if (!started) {
      socket.emit('error', 'Game is already running');
    } else {
      roomManager.broadcastRoomList();
    }
  });

  // Action: Accept Charter Contract
  socket.on('action:accept_charter', (data) => {
    const room = roomManager.getRoomBySocket(socket.id);
    if (!room) return socket.emit('error', 'Room not found');
    const result = room.acceptCharter(socket.id, data.shipId, data.contractId);
    socket.emit('player:action_result', {
      success: result.success,
      message: result.message,
      action: 'accept_charter'
    });
  });

  // Action: Bunker Fuel
  socket.on('action:bunker_fuel', (data) => {
    const room = roomManager.getRoomBySocket(socket.id);
    if (!room) return socket.emit('error', 'Room not found');
    const result = room.bunkerFuel(socket.id, data.shipId, data.tons);
    socket.emit('player:action_result', {
      success: result.success,
      message: result.message,
      action: 'bunker_fuel'
    });
  });

  // Action: Start Voyage
  socket.on('action:start_voyage', (data) => {
    const room = roomManager.getRoomBySocket(socket.id);
    if (!room) return socket.emit('error', 'Room not found');
    const result = room.startVoyage(socket.id, data.shipId);
    socket.emit('player:action_result', {
      success: result.success,
      message: result.message,
      action: 'start_voyage'
    });
  });

  // Action: Auto-dock (pay tugboat fee)
  socket.on('action:auto_dock', (data) => {
    const room = roomManager.getRoomBySocket(socket.id);
    if (!room) return socket.emit('error', 'Room not found');
    const result = room.autoDock(socket.id, data.shipId);
    socket.emit('player:action_result', {
      success: result.success,
      message: result.message,
      action: 'auto_dock'
    });
  });

  // Action: Bypass Hazard cautiously
  socket.on('action:bypass_hazard', (data) => {
    const room = roomManager.getRoomBySocket(socket.id);
    if (!room) return socket.emit('error', 'Room not found');
    const result = room.bypassHazard(socket.id, data.shipId);
    socket.emit('player:action_result', {
      success: result.success,
      message: result.message,
      action: 'bypass_hazard'
    });
  });

  // Action: Complete Minigame (from 3D Three.js simulation)
  socket.on('minigame:complete', (data) => {
    const room = roomManager.getRoomBySocket(socket.id);
    if (!room) return socket.emit('error', 'Room not found');
    const result = room.completeMinigame(
      socket.id,
      data.shipId,
      data.score,
      data.damagePercent,
      data.success
    );
    socket.emit('player:action_result', {
      success: result.success,
      message: result.message,
      action: 'minigame_complete'
    });
  });

  // Action: Buy Ship
  socket.on('action:buy_ship', (data) => {
    const room = roomManager.getRoomBySocket(socket.id);
    if (!room) return socket.emit('error', 'Room not found');
    const result = room.buyShip(socket.id, data.blueprintId, data.shipName);
    socket.emit('player:action_result', {
      success: result.success,
      message: result.message,
      action: 'buy_ship'
    });
  });

  // Action: Sell Ship
  socket.on('action:sell_ship', (data) => {
    const room = roomManager.getRoomBySocket(socket.id);
    if (!room) return socket.emit('error', 'Room not found');
    const result = room.sellShip(socket.id, data.shipId);
    socket.emit('player:action_result', {
      success: result.success,
      message: result.message,
      action: 'sell_ship'
    });
  });

  // Action: Repair Ship
  socket.on('action:repair_ship', (data) => {
    const room = roomManager.getRoomBySocket(socket.id);
    if (!room) return socket.emit('error', 'Room not found');
    const result = room.repairShip(socket.id, data.shipId, data.type, data.amount);
    socket.emit('player:action_result', {
      success: result.success,
      message: result.message,
      action: 'repair_ship'
    });
  });

  // Action: Bank Transaction
  socket.on('action:bank_transaction', (data) => {
    const room = roomManager.getRoomBySocket(socket.id);
    if (!room) return socket.emit('error', 'Room not found');
    const result = room.bankTransaction(socket.id, data.type, data.amount);
    socket.emit('player:action_result', {
      success: result.success,
      message: result.message,
      action: 'bank_transaction'
    });
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log(`[Socket Disconnected] ID: ${socket.id}`);
    roomManager.removeSocket(socket.id);
  });
});

const PORT = Number(process.env.PORT) || 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚢 Port of Call Game Server active on http://0.0.0.0:${PORT}`);
});
