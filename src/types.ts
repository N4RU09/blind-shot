/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type RoomRole = 'player1' | 'player2' | 'spectator';

export interface Player3DState {
  id: string; // User Peer ID
  nickname: string;
  role: RoomRole;
  hp: number; // 10 Max
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  yaw: number; // Camera Left-Right rotation (yaw)
  pitch: number; // Camera Up-Down rotation (pitch)
  arrowsLeft: number; // 10 Max
  isCharging: boolean;
  chargeStart: number | null; // Charging start epoch timestamp MS
  chargeRatio: number; // 0.0 to 1.0 (how much Charged)
  reloadUntil: number | null; // Reload complete timestamp MS
  isDead: boolean;
  score: number;
  ping: number;
}

export interface Arrow3DState {
  id: string; // Arrow unique ID
  ownerId: string;
  ownerNickname: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  damage: number; // 1 to 4 damage
  knockback: number; // knockback multiplier
  active: boolean;
  trail: { x: number; y: number; z: number }[];
  lifeTime: number; // in seconds to automatically clean up
}

export interface GameKillLog {
  id: string;
  message: string;
  timestamp: number;
}

export interface GameRoomState {
  status: 'LOBBY' | 'PLAYING' | 'OVER';
  hostId: string;
  gameTimeLeft: number; // 180 seconds Max (3 minutes)
  players: Record<string, Player3DState>;
  arrows: Arrow3DState[];
  killLogs: GameKillLog[];
  winnerNickname: string | null;
  winReason: 'HP' | 'FALL' | 'TIME' | 'ARROWS_OUT' | 'DRAW' | null;
}

// Net pack formats
export type NetworkPacket =
  | { type: 'STATE_SYNC'; state: GameRoomState }
  | { type: 'CLIENT_INPUT'; x: number; y: number; z: number; vx: number; vy: number; vz: number; yaw: number; pitch: number; isCharging: boolean; chargeRatio: number; reloadUntil: number | null }
  | { type: 'SHOOT_ARROW'; arrowId: string; x: number; y: number; z: number; vx: number; vy: number; vz: number; damage: number; knockback: number }
  | { type: 'SET_NICKNAME'; nickname: string }
  | { type: 'REQUEST_ROLE'; role: RoomRole }
  | { type: 'START_GAME' }
  | { type: 'RESTART_GAME' }
  | { type: 'PING'; timestamp: number }
  | { type: 'PONG'; timestamp: number };
