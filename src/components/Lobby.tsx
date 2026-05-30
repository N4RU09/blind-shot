/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { GameRoomState, RoomRole } from '../types';
import { Users, Shield, Play, Copy, Check, LogIn, Plus, Flame, Sparkles, Tv, UserCheck, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface LobbyProps {
  roomState: GameRoomState | null;
  nickname: string;
  setNickname: (name: string) => void;
  roomCodeInput: string;
  setRoomCodeInput: (code: string) => void;
  onHostCreate: () => void;
  onJoinConnect: () => void;
  onRoleRequest: (role: RoomRole) => void;
  onStartGame: () => void;
  onLeave?: () => void;
  myId: string;
  isHost: boolean;
  connectionError: string | null;
}

export function Lobby({
  roomState,
  nickname,
  setNickname,
  roomCodeInput,
  setRoomCodeInput,
  onHostCreate,
  onJoinConnect,
  onRoleRequest,
  onStartGame,
  onLeave,
  myId,
  isHost,
  connectionError,
}: LobbyProps) {
  const [copied, setCopied] = useState(false);

  // Helper to extract 4 digit code from Peer ID "blind-shot-room-XXXX"
  const getDisplayRoomCode = () => {
    if (!roomState || !roomState.hostId) return '';
    const parts = roomState.hostId.split('-');
    return parts[parts.length - 1] || '';
  };

  const currentDisplayCode = getDisplayRoomCode();

  const handleCopyCode = () => {
    if (!currentDisplayCode) return;
    navigator.clipboard.writeText(currentDisplayCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Safe checks
  const playersInRoom = roomState ? Object.values(roomState.players) : [];
  const player1 = playersInRoom.find((p) => p.role === 'player1');
  const player2 = playersInRoom.find((p) => p.role === 'player2');
  const spectators = playersInRoom.filter((p) => p.role === 'spectator');

  return (
    <div className="min-h-screen w-full bg-[#050811] text-white flex flex-col justify-between p-6 relative overflow-hidden select-none font-sans bg-radial-[at_top_right,_var(--tw-gradient-stops)] from-slate-900 via-slate-950 to-slate-950">
      
      {/* Decorative vector background lines and hot flares */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-red-600/10 rounded-full blur-3xl animate-pulse" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl animate-pulse" />

      {/* HEADER */}
      <header className="w-full flex items-center justify-between border-b border-gray-800 pb-4 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-red-600 to-orange-500 flex items-center justify-center font-bold text-lg text-white shadow-lg shadow-orange-700/20">
            🏹
          </div>
          <div>
            <h1 className="text-xl font-bold font-sans tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-red-500 via-orange-400 to-yellow-300">
              BLIND SHOT
            </h1>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-mono">3D Psych-FPS PvP Bow Duel</p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-slate-900 border border-gray-800 px-3 py-1.5 rounded-lg text-xs">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-gray-400">P2P PeerJS Connected</span>
        </div>
      </header>

      {/* CENTER WORKSPACE ELEMENT */}
      <main className="flex-1 w-full max-w-4xl mx-auto flex flex-col justify-center items-center py-8 z-10">
        <AnimatePresence mode="wait">
          
          {/* ========================================================
              STEP 1: Landing Join Menu (Setup Nickname and Action)
              ======================================================== */}
          {!roomState ? (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="w-full max-w-md bg-slate-900/90 border border-gray-800 p-8 rounded-2xl shadow-2xl backdrop-blur-xl flex flex-col gap-6 relative"
            >
              {/* Hot visual flare */}
              <div className="absolute -top-1 left-1/4 right-1/4 h-[2px] bg-gradient-to-r from-transparent via-orange-500 to-transparent" />

              <div className="text-center">
                <span className="text-[10px] text-orange-500 bg-orange-950/50 border border-orange-900/40 px-3 py-1 rounded-full font-mono uppercase tracking-widest inline-block mb-3">
                  Match Lobby
                </span>
                <h2 className="text-2xl font-black font-sans tracking-tight">전장 입장 정보 입력</h2>
                <p className="text-xs text-gray-400 mt-1">이름을 입력하고 방을 생성하거나, 방 코드를 입력하세요.</p>
              </div>

              {connectionError && (
                <div className="bg-red-950/40 border border-red-800/40 text-red-200 text-xs px-4 py-2.5 rounded-lg font-sans">
                  ⚠️ {connectionError}
                </div>
              )}

              {/* Character setup */}
              <div className="flex flex-col gap-2">
                <label className="text-xs text-gray-400 font-bold uppercase tracking-wider">플레이어 닉네임</label>
                <input
                  type="text"
                  maxLength={12}
                  placeholder="닉네임 입력 (최대 12자)..."
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  className="bg-slate-950 border border-gray-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all font-sans font-medium"
                />
              </div>

              {/* Action columns split */}
              <div className="grid grid-cols-2 gap-4 mt-2">
                {/* HOST GAME */}
                <button
                  onClick={onHostCreate}
                  disabled={!nickname.trim()}
                  className="flex flex-col items-center justify-center p-4 bg-gradient-to-br from-red-600 to-orange-500 hover:from-red-500 hover:to-orange-400 disabled:opacity-40 disabled:pointer-events-none rounded-xl font-bold transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-orange-900/20 group"
                >
                  <Plus className="w-6 h-6 mb-2 group-hover:rotate-90 transition-all duration-300" />
                  <span className="text-sm">방 만들기</span>
                  <span className="text-[9px] text-red-100 font-normal mt-1 opacity-80">Host로 세션 대기</span>
                </button>

                {/* JOIN CODE */}
                <div className="flex flex-col bg-slate-950 border border-gray-800 rounded-xl p-3.5 gap-2 justify-between">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-gray-400 font-bold uppercase">4자리 방 코드</span>
                    <input
                      type="text"
                      maxLength={4}
                      placeholder="방 코드(4자리)..."
                      value={roomCodeInput}
                      onChange={(e) => setRoomCodeInput(e.target.value.replace(/\D/g, ''))}
                      className="bg-slate-900 border border-gray-800 rounded-lg px-2.5 py-1.5 text-center font-bold tracking-widest text-lg focus:outline-none focus:ring-1 focus:ring-cyan-500 text-cyan-400 font-mono"
                    />
                  </div>

                  <button
                    onClick={onJoinConnect}
                    disabled={!nickname.trim() || roomCodeInput.length !== 4}
                    className="w-full py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:pointer-events-none text-xs rounded-lg font-bold flex items-center justify-center gap-1 border border-slate-700 transition-all"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    방 입장
                  </button>
                </div>
              </div>
            </motion.div>
          ) : (
            
            // ========================================================
            // STEP 2: Waiting room (Lobby details, player role assignment)
            // ========================================================
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full grid grid-cols-1 md:grid-cols-3 gap-6"
            >
              
              {/* LEFT CARD COLUMN: Room Code Display and Copy utilities */}
              <div className="bg-slate-900/90 border border-gray-800 p-6 rounded-2xl shadow-xl flex flex-col gap-6 backdrop-blur-md">
                <div className="text-center md:text-left">
                  <span className="text-[9px] text-cyan-400 bg-cyan-950/60 border border-cyan-900/40 px-3 py-1 rounded-full font-mono uppercase tracking-widest inline-block mb-2">
                    Lobby Code Card
                  </span>
                  <h3 className="text-lg font-bold">초대 코드</h3>
                  <p className="text-xs text-gray-400 mt-1">상대방에게 4자리 방 코드를 알려주어 같은 방에 초대하세요.</p>
                </div>

                {/* Big numeric room code card */}
                <div className="bg-slate-950 border border-gray-800 p-6 rounded-xl flex flex-col items-center justify-center gap-3 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-16 h-16 bg-cyan-500/5 rounded-full blur-xl" />
                  
                  <span className="text-gray-500 font-bold text-[10px] tracking-widest uppercase">Room-Specific Code</span>
                  <p className="text-4xl font-extrabold font-mono tracking-widest text-cyan-400 bg-slate-900/90 border border-slate-800 px-6 py-2.5 rounded-lg select-all">
                    {currentDisplayCode || '....'}
                  </p>

                  <button
                    onClick={handleCopyCode}
                    className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-xs px-3.5 py-2 rounded-lg border border-slate-800 hover:border-slate-700 transition-all text-gray-300 font-sans"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400 font-semibold">복사 완료!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>방 코드 복사</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Game launch buttons for Host-Only / Waiting state for Client */}
                <div className="mt-auto flex flex-col gap-2 pt-4 border-t border-gray-800">
                  {isHost ? (
                    <button
                      onClick={onStartGame}
                      disabled={!player1 || !player2}
                      className="w-full py-4 bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-500 hover:to-orange-400 disabled:opacity-40 disabled:pointer-events-none rounded-xl font-bold flex items-center justify-center gap-2 transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-md shadow-orange-950/20"
                    >
                      <Play className="w-5 h-5 fill-current" />
                      게임 시작 (Start Match)
                    </button>
                  ) : (
                    <div className="bg-slate-950 border border-gray-800 p-4 rounded-xl text-center text-xs text-slate-400 flex flex-col items-center gap-2">
                      <div className="flex items-center gap-1.5 font-sans font-bold">
                        <span className="w-2 h-2 rounded-full bg-cyan-500 animate-ping" />
                        방장의 시작 대기 중...
                      </div>
                      <span className="text-[10px] text-gray-500">방장이 게임을 시작하면 자동으로 매치 화면으로 이동합니니다.</span>
                    </div>
                  )}

                  {!player1 || !player2 ? (
                    <p className="text-[10px] text-amber-500 text-center font-sans tracking-wide">
                      ⚡ 게임을 시작하려면 Player 1과 Player 2의 자리가 모두 채워져야 합니다. ({playersInRoom.length} / 6 대기 중)
                    </p>
                  ) : (
                    <p className="text-[10px] text-emerald-400 text-center font-sans">
                      ✅ 두 선수가 배치되었습니다. 호스트가 시작할 준비가 완료되었습니다!
                    </p>
                  )}

                  {onLeave && (
                    <button
                      onClick={onLeave}
                      className="w-full mt-2 py-2.5 bg-slate-950/80 hover:bg-red-950/30 border border-slate-800 hover:border-red-800/40 text-red-400 text-xs rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm"
                    >
                      <LogOut className="w-3.5 h-3.5 text-red-500" />
                      대기실 나가기 (Leave Room)
                    </button>
                  )}
                </div>
              </div>

              {/* MIDDLE & RIGHT COLUMNS: Player Slots and Spectators details */}
              <div className="md:col-span-2 bg-slate-900/90 border border-gray-800 p-6 rounded-2xl shadow-xl backdrop-blur-md flex flex-col gap-5">
                <div className="flex justify-between items-center border-b border-gray-800 pb-3">
                  <div>
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      <Users className="w-5 h-5 text-orange-400" />
                      대기자 명단 및 역할 배정
                    </h3>
                    <p className="text-xs text-gray-400 mt-0.5">상대 플랫폼 대결을 펼칠 플레이어 2명과 관전자를 구성합니다.</p>
                  </div>
                  <span className="text-xs font-mono font-bold bg-slate-800 border border-slate-700 px-3 py-1 rounded-full text-slate-300">
                    {playersInRoom.length} / 6명
                  </span>
                </div>

                {/* ROLE COLUMN 1: PLAYER 1 (Left Area) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-slate-950 border border-gray-800 p-4 rounded-xl flex flex-col gap-3 relative">
                    <div className="absolute top-3 right-3 w-4 h-4 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center text-[9px] font-bold">L</div>
                    <span className="text-xs font-bold text-red-400 flex items-center gap-1.5">
                      <Flame className="w-4 h-4" />
                      PLAYER 1 (좌측 진영)
                    </span>
                    
                    {player1 ? (
                      <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 flex justify-between items-center">
                        <span className="text-sm font-semibold truncate max-w-[120px]">
                          {player1.nickname} {player1.id === myId && <span className="text-[9px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded ml-1 font-sans">나</span>}
                        </span>
                        {player1.id === myId ? (
                          <span className="text-[9px] bg-red-500/10 text-red-400 px-2 py-0.5 rounded border border-red-500/20 font-bold">배치됨</span>
                        ) : (
                          isHost && (
                            <button
                              onClick={() => {}} 
                              className="text-[9px] text-gray-500 italic pointer-events-none"
                            >
                              점유 중
                            </button>
                          )
                        )}
                      </div>
                    ) : (
                      <div className="border border-dashed border-red-900/60 bg-red-950/5 rounded-lg p-3 text-center py-5 flex items-center justify-center">
                        <button
                          onClick={() => onRoleRequest('player1')}
                          className="pointer-events-auto text-xs px-4 py-1.5 bg-red-500/20 border border-red-500/30 text-red-200 hover:bg-red-500/40 rounded-lg transition-all font-bold flex items-center gap-1"
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          Player 1 슬롯 참가
                        </button>
                      </div>
                    )}
                  </div>

                  {/* ROLE COLUMN 2: PLAYER 2 (Right Area) */}
                  <div className="bg-slate-950 border border-gray-800 p-4 rounded-xl flex flex-col gap-3 relative">
                    <div className="absolute top-3 right-3 w-4 h-4 bg-blue-500/20 text-blue-500 rounded-full flex items-center justify-center text-[9px] font-bold">R</div>
                    <span className="text-xs font-bold text-blue-400 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      PLAYER 2 (우측 진영)
                    </span>

                    {player2 ? (
                      <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 flex justify-between items-center">
                        <span className="text-sm font-semibold truncate max-w-[120px]">
                          {player2.nickname} {player2.id === myId && <span className="text-[9px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded ml-1 font-sans">나</span>}
                        </span>
                        {player2.id === myId ? (
                          <span className="text-[9px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded border border-blue-500/20 font-bold">배치됨</span>
                        ) : (
                          isHost && (
                            <button
                              onClick={() => {}} 
                              className="text-[9px] text-gray-500 italic pointer-events-none"
                            >
                              점유 중
                            </button>
                          )
                        )}
                      </div>
                    ) : (
                      <div className="border border-dashed border-blue-900/60 bg-blue-950/5 rounded-lg p-3 text-center py-5 flex items-center justify-center">
                        <button
                          onClick={() => onRoleRequest('player2')}
                          className="pointer-events-auto text-xs px-4 py-1.5 bg-blue-500/20 border border-blue-500/30 text-blue-200 hover:bg-blue-500/40 rounded-lg transition-all font-bold flex items-center gap-1"
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          Player 2 슬롯 참가
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* ROLE COLUMN 3: SPECTATORS */}
                <div className="bg-slate-950 border border-gray-800 p-4 rounded-xl flex flex-col gap-3">
                  <div className="flex justify-between items-center border-b border-gray-800 pb-1.5">
                    <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
                      <Tv className="w-4 h-4" />
                      SPECTATORS (경기 관전자 | 최대 4명)
                    </span>
                    {/* spectator join */}
                    {roomState.players[myId]?.role !== 'spectator' && (
                      <button
                        onClick={() => onRoleRequest('spectator')}
                        className="pointer-events-auto text-[10px] px-2.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-white rounded border border-slate-700 transition-all font-bold"
                      >
                        관전자로 전환
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 max-h-[140px] overflow-y-auto">
                    {spectators.map((spec) => (
                      <div key={spec.id} className="bg-slate-900/80 border border-slate-800 px-3 py-2 rounded-lg text-xs font-bold flex justify-between items-center">
                        <span className="truncate max-w-[125px]">👁️ {spec.nickname}</span>
                        {spec.id === myId && <span className="text-[9px] text-gray-500 font-normal">나</span>}
                      </div>
                    ))}
                    {spectators.length === 0 && (
                      <div className="col-span-2 py-4 text-center text-xs text-gray-500 italic">
                        현재 이 방에 배정된 관전자가 없습니다.
                      </div>
                    )}
                  </div>
                </div>

                {/* Game instruction guidelines below */}
                <div className="bg-slate-950/40 border border-gray-800 p-3.5 rounded-xl text-slate-400 text-[11px] font-sans">
                  💡 <strong>게임 규칙 요약:</strong> 맵 가운데에 거대 용암 장벽이 있어 상대를 보지 못합니다. 상대의 화살 궤적 먼지가 하늘에 그릴 경로를 참고하여 위치를 유추한 뒤 오래 차징 공격을 가하세요. 화살은 단 10발 지급되며 남하한 체력 또는 플랫폼 외각 낙사 시 사망 및 패배로 판정됩니다!
                </div>
              </div>

            </motion.div>
          )}

        </AnimatePresence>
      </main>

      {/* FOOTER METRICS */}
      <footer className="w-full text-center text-gray-500 text-[10px] font-mono border-t border-gray-800 pt-4 mt-8 relative z-10 select-none">
        BLIND SHOT GAME ENGINE V1.0.0 | POWERED BY REACT + WORKSPACE WEB-RTC P2P | CREATED IN 2026
      </footer>

    </div>
  );
}
