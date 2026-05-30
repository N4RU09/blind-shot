/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useRef } from 'react';
import Peer, { DataConnection } from 'peerjs';
import { GameRoomState, Player3DState, Arrow3DState, NetworkPacket, RoomRole } from './types';
import { Lobby } from './components/Lobby';
import { GameCanvas } from './components/GameCanvas';
import { GameHUD } from './components/GameHUD';

export default function App() {
  // --- UI & Local Role State ---
  const [nickname, setNickname] = useState<string>(() => {
    return localStorage.getItem('blind_shot_nick') || `User_${Math.floor(100 + Math.random() * 900)}`;
  });
  const [roomCodeInput, setRoomCodeInput] = useState<string>('');
  const [isHost, setIsHost] = useState<boolean>(false);
  const [myId, setMyId] = useState<string>('');
  const [myRole, setMyRole] = useState<RoomRole>('spectator');
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // --- Real-time Room State ---
  const [roomState, setRoomState] = useState<GameRoomState | null>(null);
  
  // --- Spectator angle switcher ---
  const [spectatorViewMode, setSpectatorViewMode] = useState<'player1' | 'player2' | 'free'>('free');

  // --- Peer.js Network Refs ---
  const peerRef = useRef<Peer | null>(null);
  const connectionsRef = useRef<DataConnection[]>([]);
  const connToHostRef = useRef<DataConnection | null>(null);

  // --- Prevents redundant event fires ---
  const roomStateRef = useRef<GameRoomState | null>(null);
  useEffect(() => {
    roomStateRef.current = roomState;
  }, [roomState]);

  // Persist local nickname
  useEffect(() => {
    localStorage.setItem('blind_shot_nick', nickname);
  }, [nickname]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnectSession();
    };
  }, []);

  // Safe disconnection clean up
  const disconnectSession = () => {
    if (connToHostRef.current) {
      connToHostRef.current.close();
      connToHostRef.current = null;
    }
    connectionsRef.current.forEach((conn) => conn.close());
    connectionsRef.current = [];
    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }
    setRoomState(null);
    setIsHost(false);
    setMyRole('spectator');
    setSpectatorViewMode('free');
  };

  // ========================================================
  // NETWORKING: HOST (방장) INIT
  // ========================================================
  const initHostSession = () => {
    disconnectSession();
    setConnectionError(null);

    // Random 4 digit code
    const generatedCode = Math.floor(1000 + Math.random() * 9000).toString();
    const hostPeerId = `blind-shot-room-${generatedCode}`;

    // Connect to PeerJS Cloud Signaling
    const peer = new Peer(hostPeerId, {
      debug: 1,
    });

    peerRef.current = peer;

    peer.on('open', (id) => {
      setMyId(id);
      setIsHost(true);
      setMyRole('player1'); // Host is Player 1 by default
      
      const initialStore: GameRoomState = {
        status: 'LOBBY',
        hostId: id,
        gameTimeLeft: 180, // 3 minutes
        players: {
          [id]: {
            id,
            nickname: nickname.trim() || 'Host',
            role: 'player1',
            hp: 10,
            x: -20,
            y: 0.5,
            z: 0,
            vx: 0,
            vy: 0,
            vz: 0,
            yaw: -Math.PI / 2,
            pitch: 0,
            arrowsLeft: 10,
            isCharging: false,
            chargeStart: null,
            chargeRatio: 0,
            reloadUntil: null,
            isDead: false,
            score: 0,
            ping: 0,
          },
        },
        arrows: [],
        killLogs: [],
        winnerNickname: null,
        winReason: null,
      };

      setRoomState(initialStore);
    });

    peer.on('connection', (conn) => {
      // Handle incoming peer connections as Host (6 players max limit)
      if (connectionsRef.current.length >= 5) {
        conn.on('open', () => {
          conn.close();
        });
        return;
      }

      setupHostConnectionHandlers(conn);
    });

    peer.on('error', (err) => {
      console.error('Peer host registration error:', err);
      setConnectionError('방 코드 시그널 생성 실패. 다른 방에 참가하거나 잠시 뒤 재생성해주세요.');
      disconnectSession();
    });
  };

  const setupHostConnectionHandlers = (conn: DataConnection) => {
    conn.on('open', () => {
      // Register new peer connection
      connectionsRef.current.push(conn);

      // Create new player container state as Spectator by default
      const peerId = conn.peer;
      const displayNick = `Guest_${peerId.substring(0, 4).toUpperCase()}`;

      setRoomState((prev) => {
        if (!prev) return null;
        
        // Auto assign to Player 2 if not occupied
        const hasP2 = Object.values(prev.players).some((p) => p.role === 'player2');
        const assignedRole: RoomRole = hasP2 ? 'spectator' : 'player2';

        const updatedRoom = {
          ...prev,
          players: {
            ...prev.players,
            [peerId]: {
              id: peerId,
              nickname: displayNick,
              role: assignedRole,
              hp: 10,
              x: assignedRole === 'player2' ? 20 : 0,
              y: 0.5,
              z: 0,
              vx: 0,
              vy: 0,
              vz: 0,
              yaw: assignedRole === 'player2' ? Math.PI / 2 : 0,
              pitch: 0,
              arrowsLeft: 10,
              isCharging: false,
              chargeStart: null,
              chargeRatio: 0,
              reloadUntil: null,
              isDead: false,
              score: 0,
              ping: 0,
            },
          },
          killLogs: [
            {
              id: Math.random().toString(),
              message: `🚪 ${displayNick}님이 전장 관전실에 입장했습니다.`,
              timestamp: Date.now(),
            },
            ...prev.killLogs,
          ].slice(0, 5),
        };

        // Network sync broadcast immediately
        conn.send({ type: 'STATE_SYNC', state: updatedRoom });
        broadcastState(updatedRoom);

        return updatedRoom;
      });
    });

    conn.on('data', (data: any) => {
      const packet = data as NetworkPacket;
      const peerId = conn.peer;

      if (packet.type === 'SET_NICKNAME') {
        setRoomState((prev) => {
          if (!prev || !prev.players[peerId]) return prev;
          const oldNick = prev.players[peerId].nickname;
          const updated = {
            ...prev,
            players: {
              ...prev.players,
              [peerId]: {
                ...prev.players[peerId],
                nickname: packet.nickname.trim() || oldNick,
              },
            },
            killLogs: [
              {
                id: Math.random().toString(),
                message: `👤 ${oldNick}님의 닉네임이 ${packet.nickname}으로 변경되었습니다.`,
                timestamp: Date.now(),
              },
              ...prev.killLogs,
            ].slice(0, 5),
          };
          broadcastState(updated);
          return updated;
        });
      }

      if (packet.type === 'REQUEST_ROLE') {
        setRoomState((prev) => {
          if (!prev || !prev.players[peerId]) return prev;

          // Check slot occupancy
          if (packet.role !== 'spectator') {
            const occupied = Object.values(prev.players).some((p) => p.role === packet.role);
            if (occupied) {
              // Reject, send raw sync
              conn.send({ type: 'STATE_SYNC', state: prev });
              return prev;
            }
          }

          const targetRole = packet.role;
          const targetX = targetRole === 'player1' ? -20 : targetRole === 'player2' ? 20 : 0;
          const targetYaw = targetRole === 'player1' ? -Math.PI / 2 : targetRole === 'player2' ? Math.PI / 2 : 0;

          const updated = {
            ...prev,
            players: {
              ...prev.players,
              [peerId]: {
                ...prev.players[peerId],
                role: targetRole,
                x: targetX,
                yaw: targetYaw,
                hp: 10,
                arrowsLeft: 10,
              },
            },
          };
          broadcastState(updated);
          return updated;
        });
      }

      if (packet.type === 'CLIENT_INPUT') {
        setRoomState((prev) => {
          if (!prev || !prev.players[peerId]) return prev;
          const pl = prev.players[peerId];
          const updated = {
            ...prev,
            players: {
              ...prev.players,
              [peerId]: {
                ...pl,
                x: packet.x,
                y: packet.y,
                z: packet.z,
                // Keep local momentum addition if not overridden by inputs
                vx: packet.vx !== 0 ? packet.vx : pl.vx,
                vy: packet.vy,
                vz: packet.vz !== 0 ? packet.vz : pl.vz,
                yaw: packet.yaw,
                pitch: packet.pitch,
                isCharging: packet.isCharging,
                chargeRatio: packet.chargeRatio,
                reloadUntil: packet.reloadUntil,
              },
            },
          };
          // We broadcast in a dedicated tick loop, but can instantly keep cache up to date
          return updated;
        });
      }

      if (packet.type === 'SHOOT_ARROW') {
        setRoomState((prev) => {
          if (!prev || !prev.players[peerId]) return prev;
          const pl = prev.players[peerId];
          
          // Deduct arrow and spawn
          const updatedPlayers = { ...prev.players };
          updatedPlayers[peerId] = {
            ...pl,
            arrowsLeft: Math.max(0, pl.arrowsLeft - 1),
            isCharging: false,
            chargeStart: null,
            chargeRatio: 0,
            reloadUntil: Date.now() + 1600, // 1.6s reloading lock
          };

          const newArrow: Arrow3DState = {
            id: packet.arrowId,
            ownerId: peerId,
            ownerNickname: pl.nickname,
            x: packet.x,
            y: packet.y,
            z: packet.z,
            vx: packet.vx,
            vy: packet.vy,
            vz: packet.vz,
            damage: packet.damage,
            knockback: packet.knockback,
            active: true,
            trail: [],
            lifeTime: 8, // 8s autoremove flight
          };

          const updated = {
            ...prev,
            players: updatedPlayers,
            arrows: [...prev.arrows, newArrow],
          };
          broadcastState(updated);
          return updated;
        });
      }

      if (packet.type === 'PING') {
        conn.send({ type: 'PONG', timestamp: packet.timestamp });
      }
    });

    conn.on('close', () => {
      // Discard matching connection
      connectionsRef.current = connectionsRef.current.filter((c) => c.peer !== conn.peer);
      
      setRoomState((prev) => {
        if (!prev) return null;
        const exitingNick = prev.players[conn.peer]?.nickname || '참가자';
        const updatedPlayers = { ...prev.players };
        delete updatedPlayers[conn.peer];

        const updated = {
          ...prev,
          players: updatedPlayers,
          killLogs: [
            {
              id: Math.random().toString(),
              message: `🚪 ${exitingNick}님이 연결이 소강되어 퇴장했습니다.`,
              timestamp: Date.now(),
            },
            ...prev.killLogs,
          ].slice(0, 5),
        };
        broadcastState(updated);
        return updated;
      });
    });
  };

  // Broadcast function from Host to connection lists
  const broadcastState = (state: GameRoomState) => {
    connectionsRef.current.forEach((conn) => {
      if (conn.open) {
        conn.send({ type: 'STATE_SYNC', state });
      }
    });
  };


  // ========================================================
  // NETWORKING: CLIENT (참가자) INIT
  // ========================================================
  const initClientSession = () => {
    disconnectSession();
    setConnectionError(null);

    if (roomCodeInput.length !== 4) {
      setConnectionError('올바른 4자리 숫자를 기해 주세요.');
      return;
    }

    const clientRandomId = `blind-shot-peer-${Math.random().toString(36).substring(2, 11)}`;
    const hostPeerId = `blind-shot-room-${roomCodeInput}`;

    const peer = new Peer(clientRandomId, {
      debug: 1,
    });

    peerRef.current = peer;

    peer.on('open', (id) => {
      setMyId(id);
      setIsHost(false);

      // Attempt to link to Room Host Code
      const conn = peer.connect(hostPeerId, {
        serialization: 'json',
      });

      connToHostRef.current = conn;

      conn.on('open', () => {
        // Connected!
        // Swap identity nicknames
        conn.send({ type: 'SET_NICKNAME', nickname });
      });

      conn.on('data', (data: any) => {
        const packet = data as NetworkPacket;
        if (packet.type === 'STATE_SYNC') {
          setRoomState(packet.state);
          
          // Re-sync local my role status
          const meInRoom = packet.state.players[id];
          if (meInRoom) {
            setMyRole(meInRoom.role);
          }
        }
      });

      conn.on('close', () => {
        setConnectionError('경기 방 연결이 종료되었습니다.');
        disconnectSession();
      });

      conn.on('error', (err) => {
        console.error('Client link error:', err);
        setConnectionError('방장에 연결할 수 없거나 상대방 방이 부재합니다.');
        disconnectSession();
      });
    });

    peer.on('error', (err) => {
      console.error('Client registering peer error:', err);
      setConnectionError('P2P 중계 서비스 연결에 차질이 발생했습니다.');
      disconnectSession();
    });
  };


  // ========================================================
  // INTERACTION FLOWS
  // ========================================================
  
  // Set nickname dynamically to host or client connection
  const updateLocalNicknameInGame = (newName: string) => {
    setNickname(newName);
    if (!roomState) return;

    if (isHost) {
      setRoomState((prev) => {
        if (!prev) return null;
        const updated = {
          ...prev,
          players: {
            ...prev.players,
            [myId]: {
              ...prev.players[myId],
              nickname: newName,
            },
          },
        };
        broadcastState(updated);
        return updated;
      });
    } else if (connToHostRef.current && connToHostRef.current.open) {
      connToHostRef.current.send({ type: 'SET_NICKNAME', nickname: newName });
    }
  };

  // Change Local Slot Roles (P1, P2, Spectator)
  const handleRoleChangeRequest = (role: RoomRole) => {
    if (!roomState) return;
    
    if (isHost) {
      setRoomState((prev) => {
        if (!prev) return null;

        // Ensure single occupant boundaries for roles
        if (role !== 'spectator') {
          const occupied = Object.values(prev.players).some((p) => p.role === role);
          if (occupied) return prev;
        }

        const targetX = role === 'player1' ? -20 : role === 'player2' ? 20 : 0;
        const targetYaw = role === 'player1' ? -Math.PI / 2 : role === 'player2' ? Math.PI / 2 : 0;

        const updated = {
          ...prev,
          players: {
            ...prev.players,
            [myId]: {
              ...prev.players[myId],
              role,
              x: targetX,
              yaw: targetYaw,
              hp: 10,
              arrowsLeft: 10,
            },
          },
        };
        setMyRole(role);
        broadcastState(updated);
        return updated;
      });
    } else if (connToHostRef.current && connToHostRef.current.open) {
      connToHostRef.current.send({ type: 'REQUEST_ROLE', role });
    }
  };

  // Local Client sends Player Inputs to Host
  const handleLocalInputUpdate = (input: {
    x: number;
    y: number;
    z: number;
    vx: number;
    vy: number;
    vz: number;
    yaw: number;
    pitch: number;
    isCharging: boolean;
    chargeRatio: number;
  }) => {
    if (!roomState) return;

    if (isHost) {
      // Direct local state assignment to Host Player
      setRoomState((prev) => {
        if (!prev || !prev.players[myId]) return prev;
        const pl = prev.players[myId];
        return {
          ...prev,
          players: {
            ...prev.players,
            [myId]: {
              ...pl,
              x: input.x,
              y: input.y,
              z: input.z,
              // Combine local inputs or knockback forces
              vx: input.vx !== 0 ? input.vx : pl.vx,
              vy: input.vy,
              vz: input.vz !== 0 ? input.vz : pl.vz,
              yaw: input.yaw,
              pitch: input.pitch,
              isCharging: input.isCharging,
              chargeRatio: input.chargeRatio,
            },
          },
        };
      });
    } else if (connToHostRef.current && connToHostRef.current.open) {
      connToHostRef.current.send({
        type: 'CLIENT_INPUT',
        x: input.x,
        y: input.y,
        z: input.z,
        vx: input.vx,
        vy: input.vy,
        vz: input.vz,
        yaw: input.yaw,
        pitch: input.pitch,
        isCharging: input.isCharging,
        chargeRatio: input.chargeRatio,
        reloadUntil: roomState.players[myId]?.reloadUntil || null,
      });
    }
  };

  // Launch bow shot events
  const handleShootArrow = (arrowSpec: {
    arrowId: string;
    x: number;
    y: number;
    z: number;
    vx: number;
    vy: number;
    vz: number;
    damage: number;
    knockback: number;
  }) => {
    if (!roomState) return;

    if (isHost) {
      setRoomState((prev) => {
        if (!prev || !prev.players[myId]) return prev;
        const pl = prev.players[myId];

        const updatedPlayers = { ...prev.players };
        updatedPlayers[myId] = {
          ...pl,
          arrowsLeft: Math.max(0, pl.arrowsLeft - 1),
          isCharging: false,
          chargeStart: null,
          chargeRatio: 0,
          reloadUntil: Date.now() + 1600, // 1.6s reload delay
        };

        const newArrow: Arrow3DState = {
          id: arrowSpec.arrowId,
          ownerId: myId,
          ownerNickname: pl.nickname,
          x: arrowSpec.x,
          y: arrowSpec.y,
          z: arrowSpec.z,
          vx: arrowSpec.vx,
          vy: arrowSpec.vy,
          vz: arrowSpec.vz,
          damage: arrowSpec.damage,
          knockback: arrowSpec.knockback,
          active: true,
          trail: [],
          lifeTime: 8,
        };

        const updated = {
          ...prev,
          players: updatedPlayers,
          arrows: [...prev.arrows, newArrow],
        };
        broadcastState(updated);
        return updated;
      });
    } else if (connToHostRef.current && connToHostRef.current.open) {
      connToHostRef.current.send({
        type: 'SHOOT_ARROW',
        arrowId: arrowSpec.arrowId,
        x: arrowSpec.x,
        y: arrowSpec.y,
        z: arrowSpec.z,
        vx: arrowSpec.vx,
        vy: arrowSpec.vy,
        vz: arrowSpec.vz,
        damage: arrowSpec.damage,
        knockback: arrowSpec.knockback,
      });

      // Update local client inventory prediction
      setRoomState((prev) => {
        if (!prev || !prev.players[myId]) return prev;
        const pl = prev.players[myId];
        return {
          ...prev,
          players: {
            ...prev.players,
            [myId]: {
              ...pl,
              arrowsLeft: Math.max(0, pl.arrowsLeft - 1),
              reloadUntil: Date.now() + 1600,
            },
          },
        };
      });
    }
  };

  // Host triggers Start Game
  const handleStartGameRequest = () => {
    if (!isHost || !roomState) return;

    // Reset layout for Match Arena
    const playersReset = { ...roomState.players };
    Object.keys(playersReset).forEach((id) => {
      const pl = playersReset[id];
      playersReset[id] = {
        ...pl,
        hp: 10,
        arrowsLeft: 10,
        isDead: false,
        x: pl.role === 'player1' ? -20 : pl.role === 'player2' ? 20 : 0,
        y: 0.5,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        isCharging: false,
        chargeStart: null,
        chargeRatio: 0,
        reloadUntil: null,
      };
    });

    const nextState: GameRoomState = {
      ...roomState,
      status: 'PLAYING',
      gameTimeLeft: 180,
      players: playersReset,
      arrows: [],
      killLogs: [
        {
          id: Math.random().toString(),
          message: '⚔️ 경기가 시작되었습니다! 승리자는 누가 될 것인가?!',
          timestamp: Date.now(),
        },
      ],
      winnerNickname: null,
      winReason: null,
    };

    setRoomState(nextState);
    broadcastState(nextState);
  };

  // Host triggers Restart back to Lobby
  const handleRestartGameRequest = () => {
    if (!isHost || !roomState) return;

    const nextState: GameRoomState = {
      ...roomState,
      status: 'LOBBY',
      gameTimeLeft: 180,
      arrows: [],
      winnerNickname: null,
      winReason: null,
    };

    setRoomState(nextState);
    broadcastState(nextState);
  };


  // ========================================================
  // ACTIVE PHYSICAL GAME LOOPS (HOST ONLY AUTHORITATIVE STATE)
  // ========================================================

  // 1. Tick match clock timing every 1 second
  useEffect(() => {
    if (!isHost || !roomState || roomState.status !== 'PLAYING') return;

    const interval = setInterval(() => {
      setRoomState((prev) => {
        if (!prev || prev.status !== 'PLAYING') return prev;

        const nextTime = Math.max(0, prev.gameTimeLeft - 1);
        let updated = { ...prev, gameTimeLeft: nextTime };

        // Time's Up trigger
        if (nextTime <= 0) {
          updated = evaluateMatchWinner(updated, 'TIME');
        }

        // Host Periodic Sync Broadcast (1Hz Clock Sync + sub-interpolation)
        broadcastState(updated);
        return updated;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isHost, roomState?.status]);

  // 2. Continuous 60fps Arrow fly calculation + Physical checks (Host-only)
  useEffect(() => {
    if (!isHost || !roomState || roomState.status !== 'PLAYING') return;

    const dt = 0.01633; // ~16.3ms
    const timer = setInterval(() => {
      setRoomState((prev) => {
        if (!prev || prev.status !== 'PLAYING') return prev;

        // A. Arrow positions update (Physics)
        let arrowsModified = prev.arrows.map((arrow) => {
          if (!arrow.active) return arrow;

          // Apply Gravity force drop downwards on Arrow speeds
          const nextVy = arrow.vy - 5.5 * dt; 
          const nextX = arrow.x + arrow.vx * dt;
          const nextY = arrow.y + arrow.vy * dt;
          const nextZ = arrow.z + arrow.vz * dt;

          // Accumublate Trail breadcrumbs (Max capacity 12 points)
          const nextTrail = [...arrow.trail, { x: arrow.x, y: arrow.y, z: arrow.z }].slice(-12);
          const nextLife = arrow.lifeTime - dt;
          const stillActive = nextLife > 0 && nextY > -24.5;

          return {
            ...arrow,
            x: nextX,
            y: nextY,
            z: nextZ,
            vy: nextVy,
            trail: nextTrail,
            lifeTime: nextLife,
            active: stillActive,
          };
        });

        // B. Collision matching
        let playersAfterHit = { ...prev.players };
        const killLogsAfterHit = [...prev.killLogs];

        arrowsModified = arrowsModified.map((arrow) => {
          if (!arrow.active) return arrow;

          let hasHit = false;
          Object.values(playersAfterHit).forEach((targetPlayer) => {
            if (targetPlayer.isDead || hasHit || targetPlayer.id === arrow.ownerId) return;
            if (targetPlayer.role === 'spectator') return;

            // Measure accurate target capsule range centered on player height (Y+0.8 elevation offset)
            const dx = arrow.x - targetPlayer.x;
            const dy = arrow.y - (targetPlayer.y + 0.82);
            const dz = arrow.z - targetPlayer.z;
            const distSq = dx * dx + dy * dy + dz * dz;

            // Bounding collision sphere radius target ~0.82m
            if (distSq < 0.68) {
              hasHit = true;
              
              const calculatedHp = Math.max(0, targetPlayer.hp - arrow.damage);
              const isKilled = calculatedHp <= 0;

              // Compute Horizontal launch knockback push direction
              // Take Arrow velocity vx, vz horizontal elements to create direction
              const speedSq = arrow.vx * arrow.vx + arrow.vz * arrow.vz;
              let kDirX = 0;
              let kDirZ = 0;
              if (speedSq > 0.001) {
                const normScale = Math.sqrt(speedSq);
                kDirX = arrow.vx / normScale;
                kDirZ = arrow.vz / normScale;
              }

              // Apply push velocity momentum scaling
              const force = arrow.knockback * 16.5; // Strong visual knockback acceleration
              const pushX = kDirX * force;
              const pushZ = kDirZ * force;

              // Log death details
              if (isKilled) {
                killLogsAfterHit.unshift({
                  id: Math.random().toString(),
                  message: `🎯 ${arrow.ownerNickname}님이 활로 ${targetPlayer.nickname}님을 처치했습니다!`,
                  timestamp: Date.now(),
                });
              } else {
                killLogsAfterHit.unshift({
                  id: Math.random().toString(),
                  message: `💥 ${targetPlayer.nickname}님이 ${arrow.ownerNickname}님의 화살에 피격당했습니다! (-${arrow.damage} HP)`,
                  timestamp: Date.now(),
                });
              }

              playersAfterHit[targetPlayer.id] = {
                ...targetPlayer,
                hp: calculatedHp,
                isDead: isKilled,
                // Directly set the local recoil velocity. 
                // The client app loop merges this instantly into displacement vectors.
                vx: targetPlayer.vx + pushX,
                vz: targetPlayer.vz + pushZ,
              };
            }
          });

          if (hasHit) {
            return { ...arrow, active: false };
          }
          return arrow;
        });

        // C. Bounding Tile Fall Check
        // Left center [-20, 0, 0] bounds 14x14 grid => [-27, -13], [-7, 7]
        // Right center [20, 0, 0] bounds 14x14 grid => [13, 27], [-7, 7]
        Object.keys(playersAfterHit).forEach((pId) => {
          const pl = playersAfterHit[pId];
          if (pl.isDead || pl.role === 'spectator') return;

          // If fell down below platform elevations Y < -4.5 => Fall death trigger
          if (pl.y < -4.5) {
            killLogsAfterHit.unshift({
              id: Math.random().toString(),
              message: `🌋 ${pl.nickname}님이 넉백 충격으로 마그마 연옥으로 낙사하였습니다!`,
              timestamp: Date.now(),
            });

            playersAfterHit[pId] = {
              ...pl,
              hp: 0,
              isDead: true,
            };
          }
        });

        // D. Friction damping decays knockback over time for smoothness
        Object.keys(playersAfterHit).forEach((pId) => {
          const pl = playersAfterHit[pId];
          playersAfterHit[pId] = {
            ...pl,
            vx: pl.vx * 0.82, // Reduce residual knockback momentum per frame
            vz: pl.vz * 0.82,
          };
        });

        let nextState: GameRoomState = {
          ...prev,
          arrows: arrowsModified,
          players: playersAfterHit,
          killLogs: killLogsAfterHit.slice(0, 8),
        };

        // E. Game Over checks
        nextState = evaluateMatchRulesOnTick(nextState);

        return nextState;
      });
    }, 16);

    return () => clearInterval(timer);
  }, [isHost, roomState?.status]);


  // 3. Game Over logic conditions processor
  const evaluateMatchRulesOnTick = (state: GameRoomState): GameRoomState => {
    if (state.status !== 'PLAYING') return state;

    const p1 = Object.values(state.players).find((p) => p.role === 'player1');
    const p2 = Object.values(state.players).find((p) => p.role === 'player2');

    // Return if participants are not fully ready
    if (!p1 || !p2) return state;

    // Condition 1: Player HP Death OR Platform Fall death
    if (p1.isDead && p2.isDead) {
      return {
        ...state,
        status: 'OVER',
        winReason: 'DRAW',
        winnerNickname: null,
      };
    }
    if (p1.isDead) {
      const reason = p1.y < -4.5 ? 'FALL' : 'HP';
      return {
        ...state,
        status: 'OVER',
        winReason: reason,
        winnerNickname: p2.nickname,
      };
    }
    if (p2.isDead) {
      const reason = p2.y < -4.5 ? 'FALL' : 'HP';
      return {
        ...state,
        status: 'OVER',
        winReason: reason,
        winnerNickname: p1.nickname,
      };
    }

    // Condition 2: Arrows exhaustion (Each player has 10 shots max)
    const activeAirborneArrows = state.arrows.some((a) => a.active);
    if (p1.arrowsLeft <= 0 && p2.arrowsLeft <= 0 && !activeAirborneArrows) {
      return evaluateMatchWinner(state, 'ARROWS_OUT');
    }

    return state;
  };

  const evaluateMatchWinner = (state: GameRoomState, reason: 'TIME' | 'ARROWS_OUT'): GameRoomState => {
    const p1 = Object.values(state.players).find((p) => p.role === 'player1');
    const p2 = Object.values(state.players).find((p) => p.role === 'player2');

    if (!p1 || !p2) return state;

    if (p1.hp > p2.hp) {
      return {
        ...state,
        status: 'OVER',
        winReason: reason,
        winnerNickname: p1.nickname,
      };
    } else if (p2.hp > p1.hp) {
      return {
        ...state,
        status: 'OVER',
        winReason: reason,
        winnerNickname: p2.nickname,
      };
    } else {
      // Perfect equalizer tie match
      return {
        ...state,
        status: 'OVER',
        winReason: 'DRAW',
        winnerNickname: null,
      };
    }
  };


  // ========================================================
  // BOW SHOT ACTIONS TRIGGERED ON CLIENT DRAG RELEASES
  // ========================================================
  useEffect(() => {
    if (!roomState || myRole === 'spectator') return;

    let localIsCharging = false;
    let localChargeStart: number | null = null;

    const handleMouseDown = (e: MouseEvent) => {
      // Ignore click actions targeting menu controls, inputs, logs, or results
      if ((e.target as HTMLElement).closest('button, input, select, .no-drag')) {
        return;
      }

      // Check current reload state
      const meState = roomStateRef.current?.players[myId];
      if (!meState || meState.isDead) return;
      if (meState.reloadUntil && Date.now() < meState.reloadUntil) {
        return; // Locked in reloading delay
      }
      if (meState.arrowsLeft <= 0) return; // Out of ammo

      localIsCharging = true;
      localChargeStart = Date.now();

      // Broadcast charging status
      setRoomState((prev) => {
        if (!prev || !prev.players[myId]) return prev;
        const pl = prev.players[myId];
        const updated = {
          ...prev,
          players: {
            ...prev.players,
            [myId]: {
              ...pl,
              isCharging: true,
              chargeStart: localChargeStart,
              chargeRatio: 0,
            },
          },
        };
        return updated;
      });
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (!localIsCharging || !localChargeStart) return;

      const deltaDuration = Date.now() - localChargeStart;
      const chargeRatio = Math.min(deltaDuration / 1500, 1.0); // 1.5s max pull strength

      localIsCharging = false;
      localChargeStart = null;

      const nowMe = roomStateRef.current?.players[myId];
      if (!nowMe || nowMe.isDead) return;

      // Projectile initial speed calculations based on camera look vectors
      // Setup muzzle velocity direction
      const yaw = nowMe.yaw;
      const pitch = nowMe.pitch;

      const forwardX = -Math.sin(yaw) * Math.cos(pitch);
      const forwardY = Math.sin(pitch);
      const forwardZ = -Math.cos(yaw) * Math.cos(pitch);

      // Bow force calculation
      // Charge ratio maps velocity from: Min 14.5m/s to Max 38.0m/s
      const launchForce = 12.0 + chargeRatio * 24.0;
      
      const vx = forwardX * launchForce;
      const vy = forwardY * launchForce;
      const vz = forwardZ * launchForce;

      // Damage scale: 1 ~ 4 points
      const damage = Math.floor(1 + chargeRatio * 3);
      const knockback = 0.4 + chargeRatio * 1.5;

      // Position offset (Spawns arrow slightly in front of the camera viewpoint)
      const arrowX = nowMe.x + forwardX * 1.2;
      const arrowY = nowMe.y + 1.25 + forwardY * 1.2; // Cam elevation offset
      const arrowZ = nowMe.z + forwardZ * 1.2;

      const shotEventSpec = {
        arrowId: `arr-${myId}-${Date.now()}`,
        x: arrowX,
        y: arrowY,
        z: arrowZ,
        vx,
        vy,
        vz,
        damage,
        knockback,
      };

      handleShootArrow(shotEventSpec);
    };

    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [roomState?.status, myRole, myId]);


  // ========================================================
  // MASTER TICK FOR SYNC BROADCAST FROM HOST PEER TO PEERS
  // ========================================================
  useEffect(() => {
    if (!isHost || !roomState || roomState.status !== 'PLAYING') return;

    // Send high-rate binary/JSON sync packets 25 times per second (40ms ticks)
    // Minimizes lag in P2P browser environments
    const interval = setInterval(() => {
      if (roomStateRef.current) {
        broadcastState(roomStateRef.current);
      }
    }, 40);

    return () => clearInterval(interval);
  }, [isHost, roomState?.status]);


  // ========================================================
  // RENDER SEPARATION
  // ========================================================
  const activeMeState = roomState?.players[myId];

  return (
    <div className="w-full h-screen relative bg-slate-950 font-sans overflow-hidden">
      {!roomState ? (
        <Lobby
          roomState={roomState}
          nickname={nickname}
          setNickname={updateLocalNicknameInGame}
          roomCodeInput={roomCodeInput}
          setRoomCodeInput={setRoomCodeInput}
          onHostCreate={initHostSession}
          onJoinConnect={initClientSession}
          onRoleRequest={handleRoleChangeRequest}
          onStartGame={handleStartGameRequest}
          myId={myId}
          isHost={isHost}
          connectionError={connectionError}
        />
      ) : roomState.status === 'LOBBY' ? (
        <Lobby
          roomState={roomState}
          nickname={nickname}
          setNickname={updateLocalNicknameInGame}
          roomCodeInput={roomCodeInput}
          setRoomCodeInput={setRoomCodeInput}
          onHostCreate={initHostSession}
          onJoinConnect={initClientSession}
          onRoleRequest={handleRoleChangeRequest}
          onStartGame={handleStartGameRequest}
          onLeave={disconnectSession}
          myId={myId}
          isHost={isHost}
          connectionError={connectionError}
        />
      ) : (
        <div className="w-full h-full relative">
          {/* Main 3D Canvas World */}
          <GameCanvas
            roomState={roomState}
            myId={myId}
            myRole={myRole}
            spectatorViewMode={spectatorViewMode}
            setSpectatorViewMode={setSpectatorViewMode}
            onLocalInputUpdate={handleLocalInputUpdate}
            localHP={activeMeState?.hp || 0}
            isGameOver={roomState.status === 'OVER'}
          />

          {/* Interactive HUD Layer */}
          <GameHUD
            roomState={roomState}
            myId={myId}
            myRole={myRole}
            spectatorViewMode={spectatorViewMode}
            setSpectatorViewMode={setSpectatorViewMode}
            isHost={isHost}
            onRestart={handleStartGameRequest}
            onLeave={() => disconnectSession()}
          />
        </div>
      )}
    </div>
  );
}
