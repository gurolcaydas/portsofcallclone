import { io } from 'socket.io-client';

async function runTest() {
  console.log('Testing Port of Call Multiplayer Game Engine...');

  const hostSocket = io('http://localhost:3001');
  const player2Socket = io('http://localhost:3001');

  await new Promise<void>((resolve) => {
    let connected = 0;
    const check = () => {
      connected++;
      if (connected === 2) resolve();
    };
    hostSocket.on('connect', check);
    player2Socket.on('connect', check);
  });

  console.log('✓ Both player sockets connected successfully.');

  // 1. Host creates room
  let roomCode = '';
  let hostPlayerId = '';
  await new Promise<void>((resolve, reject) => {
    hostSocket.emit('room:create', { companyName: 'Hanseatic Express', color: '#00d2ff' }, (res: any) => {
      if (res.success && res.roomCode && res.playerId) {
        roomCode = res.roomCode;
        hostPlayerId = res.playerId;
        console.log(`✓ Room created with code: ${roomCode}`);
        resolve();
      } else {
        reject(new Error(res.error || 'Failed to create room'));
      }
    });
  });

  // 2. Player 2 joins room
  await new Promise<void>((resolve, reject) => {
    player2Socket.emit('room:join', { roomCode, companyName: 'Pacific Line', color: '#ffa502' }, (res: any) => {
      if (res.success) {
        console.log(`✓ Player 2 joined room ${roomCode}`);
        resolve();
      } else {
        reject(new Error(res.error || 'Failed to join room'));
      }
    });
  });

  // 3. Host starts game
  await new Promise<void>((resolve) => {
    hostSocket.on('room:state', (state) => {
      if (state.status === 'playing') {
        console.log(`✓ Game started! Current Day: ${state.currentDay}, Players: ${Object.keys(state.players).length}`);
        resolve();
      }
    });
    hostSocket.emit('room:start_game');
  });

  // 4. Test Charter Booking
  let starterShipId = '';
  let availableContractId = '';
  await new Promise<void>((resolve) => {
    const handler = (state: any) => {
      const p1 = state.players[hostPlayerId];
      if (p1 && p1.ships.length > 0) {
        starterShipId = p1.ships[0].id;
        const portId = p1.ships[0].currentPortId;
        const contracts = state.availableContracts[portId];
        if (contracts && contracts.length > 0) {
          availableContractId = contracts[0].id;
          hostSocket.off('room:state', handler);
          resolve();
        }
      }
    };
    hostSocket.on('room:state', handler);
  });

  console.log(`Booking charter for ship ${starterShipId}...`);
  await new Promise<void>((resolve, reject) => {
    hostSocket.once('player:action_result', (res) => {
      if (res.success) {
        console.log(`✓ Charter booked: ${res.message}`);
        resolve();
      } else {
        reject(new Error(res.message));
      }
    });
    hostSocket.emit('action:accept_charter', { shipId: starterShipId, contractId: availableContractId });
  });

  // 5. Test Start Voyage
  console.log(`Departing port on voyage...`);
  await new Promise<void>((resolve, reject) => {
    hostSocket.once('player:action_result', (res) => {
      if (res.success) {
        console.log(`✓ Vessel cast off: ${res.message}`);
        resolve();
      } else {
        reject(new Error(res.message));
      }
    });
    hostSocket.emit('action:start_voyage', { shipId: starterShipId });
  });

  // 6. Test Auto Docking payout
  console.log(`Testing docking completion...`);
  await new Promise<void>((resolve, reject) => {
    hostSocket.once('player:action_result', (res) => {
      if (res.success) {
        console.log(`✓ Docking complete & cargo discharged: ${res.message}`);
        resolve();
      } else {
        reject(new Error(res.message));
      }
    });
    hostSocket.emit('minigame:complete', {
      shipId: starterShipId,
      score: 95,
      damagePercent: 0,
      success: true
    });
  });

  console.log('🎉 ALL MULTIPLAYER SIMULATION TESTS PASSED!');
  hostSocket.disconnect();
  player2Socket.disconnect();
  process.exit(0);
}

runTest().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
