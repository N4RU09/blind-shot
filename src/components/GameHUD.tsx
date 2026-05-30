/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { GameRoomState, RoomRole, Player3DState } from '../types';
import { Heart, Shield, Award, Clock, Flame, Zap, Compass, RefreshCw, Layers } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface GameHUDProps {
  roomState: GameRoomState;
  myId: string;
  myRole: RoomRole;
  spectatorViewMode: 'player1' | 'player2' | 'free';
  setSpectatorViewMode: (mode: 'player1' | 'player2' | 'free') => void;
  isHost: boolean;
  onRestart: () => void;
  onLeave: () => void;
}

export function GameHUD({
  roomState,
  myId,
  myRole,
  spectatorViewMode,
  setSpectatorViewMode,
  isHost,
  onRestart,
  onLeave,
}: GameHUDProps) {
  const [reloadProgress, setReloadProgress] = useState<number>(0);
  const me = roomState.players[myId];

  // Dynamic Reloading and Charge tracker tick
  useEffect(() => {
    if (!me) return;
    const interval = setInterval(() => {
      const now = Date.now();
      
      // Calculate active reloading ratio
      if (me.reloadUntil && now < me.reloadUntil) {
        const totalDuration = 1600; // 1.6s reload time
        const remaining = me.reloadUntil - now;
        const progress = Math.max(0, Math.min(100, ((totalDuration - remaining) / totalDuration) * 100));
        setReloadProgress(progress);
      } else {
        setReloadProgress(100);
      }
    }, 30);
    return () => clearInterval(interval);
  }, [me]);

  // Format game time (e.g. 02:45)
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Helper variables
  const isSpectator = myRole === 'spectator';
  const player1 = Object.values(roomState.players).find(p => p.role === 'player1');
  const player2 = Object.values(roomState.players).find(p => p.role === 'player2');

  // Charging details
  const currentCharge = me?.chargeRatio || 0;
  const isCharging = me?.isCharging || false;
  const isReloading = me?.reloadUntil ? Date.now() < me.reloadUntil : false;

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-6 z-10 select-none">
      
      {/* ========================================================
          TOP ROW HEADER: HP & Clock / Arrow counters
          ======================================================== */}
      <div className="flex justify-between items-start w-full">
        
        {/* Left Side: HP Progress Bar (For active players) or Spectator Header */}
        <div className="pointer-events-auto">
          {!isSpectator && me ? (
            <div className="bg-slate-900/85 backdrop-blur-md border border-slate-700/60 p-4 rounded-xl shadow-xl flex items-center gap-4 min-w-[220px]">
              {/* Profile Avatar circle */}
              <div 
                className="w-11 h-11 rounded-full flex items-center justify-center font-bold text-white shadow-inner"
                style={{ backgroundColor: me.role === 'player1' ? '#ff324a' : '#1e88e5' }}
              >
                {me.nickname ? me.nickname.substring(0, 2).toUpperCase() : 'ME'}
              </div>
              
              <div className="flex-1">
                <div className="flex justify-between items-center mb-1 text-slate-300">
                  <span className="text-xs font-bold tracking-wider">{me.nickname}</span>
                  <span className="text-xs font-mono font-bold flex items-center text-red-400 gap-0.5">
                    <Heart className="w-3.5 h-3.5 fill-red-500 text-red-500" />
                    {me.hp} / 10
                  </span>
                </div>
                
                {/* Health tube */}
                <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden border border-slate-700/50">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: me.role === 'player1' ? '#ff324a' : '#1e88e5' }}
                    initial={{ width: '100%' }}
                    animate={{ width: `${(me.hp / 10) * 100}%` }}
                    transition={{ type: 'spring', stiffness: 80 }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900/85 backdrop-blur-md border border-slate-700/60 px-4 py-3 rounded-xl shadow-xl flex flex-col gap-1.5 min-w-[200px]">
              <span className="text-xs font-bold text-cyan-400 tracking-widest flex items-center gap-1.5 uppercase font-sans">
                <Compass className="w-4 h-4 animate-spin-slow" />
                Spectator View Panel
              </span>
              <div className="text-[11px] text-gray-400">
                실시간 1인칭 및 자유캠을 전환하며 관전하세요.
              </div>
            </div>
          )}
        </div>

        {/* Center Top: Real-Time Kill Feed & Alerts */}
        <div className="flex flex-col items-center max-w-[40%] gap-1.5">
          <AnimatePresence>
            {roomState.killLogs.map((log) => (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, y: -20, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="bg-red-950/80 border border-red-700/40 backdrop-blur-md text-red-200 text-xs px-4 py-1.5 rounded-lg font-mono tracking-wide shadow-md flex items-center gap-2"
              >
                <Flame className="w-4 h-4 text-red-400" />
                {log.message}
              </motion.div>
            ))}
          </AnimatePresence>
          {roomState.killLogs.length === 0 && (
            <div className="text-[11px] text-slate-500 uppercase font-sans tracking-widest py-1 select-none">
              — Match Log Empty —
            </div>
          )}
        </div>

        {/* Right Side: Round Clock and Arrow Inventory count */}
        <div className="pointer-events-auto flex flex-col items-end gap-2 text-right">
          <div className="bg-slate-900/85 backdrop-blur-md border border-slate-700/60 p-4 rounded-xl shadow-xl flex items-center gap-5 min-w-[200px]">
            <div className="flex-1">
              <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Time Left</span>
              <div className="text-xl font-bold font-mono text-white flex items-center gap-1.5">
                <Clock className="w-5 h-5 text-yellow-400 animate-pulse" />
                {formatTime(roomState.gameTimeLeft)}
              </div>
            </div>

            {!isSpectator && me && (
              <div className="border-l border-slate-800 pl-4">
                <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Arrow Count</span>
                <div className="text-xl font-bold font-mono text-cyan-400 flex items-center justify-end gap-1">
                  🏹 <span className={me.arrowsLeft <= 2 ? 'text-red-500 animate-bounce' : ''}>{me.arrowsLeft}</span>
                  <span className="text-xs text-slate-500">/10</span>
                </div>
              </div>
            )}
          </div>

          {/* Quick lobby leave button */}
          <button
            onClick={onLeave}
            className="flex items-center gap-1.5 bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-white px-3 py-1.5 rounded-lg border border-slate-800 hover:border-slate-700 font-sans transition-all text-xs"
          >
            대기실 퇴장
          </button>
        </div>

      </div>

      {/* ========================================================
          CENTER: Crosshair and Charging Bar (For players only)
          ======================================================== */}
      {!isSpectator && me && !me.isDead && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-0 pointer-events-none">
          {/* Classic Fixed crosshair "+" in center gray-black style */}
          <div className="relative w-8 h-8 flex items-center justify-center">
            <div className="absolute w-4 h-[1.5px] bg-slate-800 bg-opacity-70 left-0" />
            <div className="absolute w-4 h-[1.5px] bg-slate-800 bg-opacity-70 right-0" />
            <div className="absolute h-4 w-[1.5px] bg-slate-800 bg-opacity-70 top-0" />
            <div className="absolute h-4 w-[1.5px] bg-slate-800 bg-opacity-70 bottom-0" />
            {/* Center target dot */}
            <div className="w-[3px] h-[3px] bg-amber-500 rounded-full" />
          </div>

          {/* Charge / Reload Gauge below Crosshair */}
          <div className="mt-8 flex flex-col items-center w-[160px]">
            {isReloading ? (
              <div className="w-full flex flex-col items-center gap-1">
                <span className="text-[9px] text-yellow-400 tracking-widest uppercase font-mono animate-pulse flex items-center gap-1">
                  <RefreshCw className="w-3 h-3 animate-spin" /> Reloading...
                </span>
                <div className="w-full h-1.5 bg-slate-900/90 rounded-full overflow-hidden border border-slate-700/50">
                  <div
                    className="h-full bg-yellow-400 transition-all duration-75"
                    style={{ width: `${reloadProgress}%` }}
                  />
                </div>
              </div>
            ) : isCharging ? (
              <div className="w-full flex flex-col items-center gap-1">
                <div className="w-full h-2 bg-slate-900/90 rounded-full overflow-hidden border border-slate-700/50 p-[1px]">
                  <div
                    className={`h-full rounded-full transition-all duration-75 ${
                      currentCharge >= 1.0 ? 'bg-orange-500 animate-pulse shadow-orange' : 'bg-orange-400'
                    }`}
                    style={{ width: `${currentCharge * 100}%` }}
                  />
                </div>
                {currentCharge >= 1.0 ? (
                  <span className="text-[9px] text-orange-500 tracking-widest uppercase font-mono font-bold animate-bounce flex items-center gap-0.5">
                    🔥 Max Charge!
                  </span>
                ) : (
                  <span className="text-[9px] text-orange-300 tracking-widest uppercase font-mono">
                    Charging {(currentCharge * 100).toFixed(0)}%
                  </span>
                )}
              </div>
            ) : (
              <span className="text-[9px] text-slate-400 tracking-widest uppercase font-sans py-1">
                Ready to Shot (🏹)
              </span>
            )}
          </div>
        </div>
      )}

      {/* ========================================================
          BOTTOM SPECTATOR SELECTION PANEL (Spectator view controls)
          ======================================================== */}
      {isSpectator && (
        <div className="pointer-events-auto self-center bg-slate-900/90 backdrop-blur-md border border-slate-700/60 p-5 rounded-2xl shadow-2xl flex flex-col gap-3 min-w-[420px] max-w-[90%] select-none mb-4">
          <div className="flex justify-between items-center border-b border-slate-800 pb-2">
            <span className="text-xs font-bold text-white flex items-center gap-1">
              <Layers className="w-4 h-4 text-cyan-400" />
              관전자 시점 제어
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-500 bg-slate-800 px-2 py-0.5 rounded-full">
                Spectators: {Object.values(roomState.players).filter((p) => p.role === 'spectator').length}명
              </span>
            </div>
          </div>

          {/* Quick tab controllers */}
          <div className="grid grid-cols-3 gap-2.5">
            <button
              onClick={() => setSpectatorViewMode('player1')}
              className={`px-4 py-2 text-xs rounded-xl border flex flex-col items-center gap-1 transition-all ${
                spectatorViewMode === 'player1'
                  ? 'bg-red-500/20 border-red-500 text-red-200 font-bold'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-white'
              }`}
            >
              <span className="text-[10px]">Player 1 (진영)</span>
              <span className="truncate max-w-[110px]">{player1?.nickname || '대기 중'}</span>
            </button>

            <button
              onClick={() => setSpectatorViewMode('player2')}
              className={`px-4 py-2 text-xs rounded-xl border flex flex-col items-center gap-1 transition-all ${
                spectatorViewMode === 'player2'
                  ? 'bg-blue-500/20 border-blue-500 text-blue-200 font-bold'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-white'
              }`}
            >
              <span className="text-[10px]">Player 2 (우측)</span>
              <span className="truncate max-w-[110px]">{player2?.nickname || '대기 중'}</span>
            </button>

            <button
              onClick={() => setSpectatorViewMode('free')}
              className={`px-4 py-2 text-xs rounded-xl border flex flex-col items-center gap-1 transition-all ${
                spectatorViewMode === 'free'
                  ? 'bg-yellow-500/20 border-yellow-500 text-yellow-200 font-bold'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-white'
              }`}
            >
              <span className="text-[10px]">3D Freecam</span>
              <span>자유 카메라</span>
            </button>
          </div>

          {/* Arena Stats Overview inside Spec Control */}
          <div className="grid grid-cols-2 gap-4 bg-slate-950/80 p-2.5 rounded-lg border border-slate-800 text-[11px] font-sans">
            <div className="flex items-center justify-between border-r border-slate-800 pr-4">
              <span className="text-slate-400">Player 1 HP:</span>
              <span className="font-bold text-red-400 font-mono">{player1 ? `${player1.hp}/10` : 'Empty'}</span>
            </div>
            <div className="flex items-center justify-between pl-2">
              <span className="text-slate-400">Player 2 HP:</span>
              <span className="font-bold text-blue-400 font-mono">{player2 ? `${player2.hp}/10` : 'Empty'}</span>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          BOTTOM STATUS FOOTER (Active user indicators)
          ======================================================== */}
      {!isSpectator && me && (
        <div className="w-full flex justify-between items-center select-none pt-2 mt-auto">
          <div className="bg-slate-900/60 backdrop-blur px-3 py-1.5 rounded-lg border border-slate-800 text-[10px] text-slate-400 font-mono">
            ROLE: <span className={me.role === 'player1' ? 'text-red-400' : 'text-blue-400'}>{me.role.toUpperCase()}</span> | NICKNAME: {me.nickname}
          </div>
          
          <div className="bg-slate-900/60 backdrop-blur px-3 py-1.5 rounded-lg border border-slate-800 text-[10px] text-slate-400 font-mono">
            {me.isDead ? '🎯 사망 상태' : '🦾 플레이 가능'}
          </div>
        </div>
      )}

      {/* ========================================================
          GAME OVER FULL SCREEN SCREEN SCREEN (Interactive result screen)
          ======================================================== */}
      {roomState.status === 'OVER' && (
        <div className="pointer-events-auto absolute inset-0 bg-slate-950/90 backdrop-blur-md flex flex-col justify-center items-center gap-6 z-50 animate-fade-in text-white no-drag select-none text-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex flex-col items-center max-w-lg bg-slate-900 border border-slate-700/60 p-8 rounded-3xl shadow-2xl relative overflow-hidden"
          >
            {/* Visual shine ring */}
            <div className="absolute -top-10 -left-10 w-24 h-24 bg-cyan-500/10 rounded-full blur-2xl" />
            <div className="absolute -bottom-10 -right-10 w-24 h-24 bg-red-500/10 rounded-full blur-2xl" />

            <Award className="w-16 h-16 text-yellow-400 mb-4 animate-bounce" />
            
            <h1 className="text-3xl font-extrabold tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-yellow-400 via-orange-400 to-amber-500 mb-2">
              GAME OVER
            </h1>

            {/* Winner highlight */}
            {roomState.winReason === 'DRAW' ? (
              <p className="text-xl font-bold font-sans text-gray-300 px-6 py-2 bg-slate-800/80 rounded-full border border-slate-700 mb-4">
                무승부!! (Draw Match)
              </p>
            ) : (
              <div className="flex flex-col items-center mb-4">
                <span className="text-xs uppercase tracking-widest text-slate-400 mb-1">Winner Victorious</span>
                <p className="text-2xl font-black text-cyan-400 font-sans px-8 py-2 bg-slate-800/80 rounded-full border border-cyan-800/50 shadow-[0_0_15px_rgba(34,211,238,0.2)]">
                  🎉 {roomState.winnerNickname || '알 수 없음'}
                </p>
              </div>
            )}

            {/* Victory condition description */}
            <p className="text-xs text-gray-400 max-w-sm font-sans mb-6">
              {roomState.winReason === 'HP' && '상대방의 체력을 모두 소진시켜 격파하였습니다.'}
              {roomState.winReason === 'FALL' && '넉백 충격으로 상대방을 플랫폼 너머 마그마 바다로 떨어뜨렸습니다.'}
              {roomState.winReason === 'TIME' && '3분 경기 시간이 종료되어 남은 체력이 더 높은 유저가 승리했습니다.'}
              {roomState.winReason === 'ARROWS_OUT' && '양측 모두 10발의 화살을 모두 소모하여, 최종 잔여 체력 비교로 결정되었습니다.'}
              {roomState.winReason === 'DRAW' && '제한 시간이 만료되었거나 화살이 소강되어 양측 체력이 완벽히 동률인 상태로 끝났습니다.'}
            </p>

            {/* Interactivity Buttons */}
            <div className="flex items-center gap-4 w-full">
              {isHost ? (
                <button
                  onClick={onRestart}
                  className="flex-1 py-3 px-6 rounded-xl font-bold text-sm bg-cyan-600 hover:bg-cyan-500 text-white transition-all transform hover:scale-[1.02] active:scale-[0.98] border border-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.4)] flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className="w-4 h-4" />
                  게임 재시작
                </button>
              ) : (
                <div className="flex-1 py-3 px-6 rounded-xl bg-slate-800/90 border border-slate-700 text-xs text-slate-400 font-sans flex items-center justify-center gap-1.5 italic animate-pulse">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  방장이 재시작하길 대기 중...
                </div>
              )}
            </div>
            
            <button
              onClick={onLeave}
              className="mt-4 text-xs text-gray-500 hover:text-slate-300 font-sans underline underline-offset-4"
            >
              대기실로 돌아가기
            </button>
          </motion.div>
        </div>
      )}
    </div>
  );
}
