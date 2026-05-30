/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PerspectiveCamera, Stars } from '@react-three/drei';
import * as THREE from 'three';
import { GameRoomState, Player3DState, RoomRole } from '../types';
import { ArenaPlatform, LavaFloor } from './ArenaPlatform';
import { LavaWall } from './LavaWall';
import { PlayerModel } from './PlayerModel';
import { ArrowModelList } from './ArrowModel';

interface GameCanvasProps {
  roomState: GameRoomState;
  myId: string;
  myRole: RoomRole;
  spectatorViewMode: 'player1' | 'player2' | 'free';
  setSpectatorViewMode: (mode: 'player1' | 'player2' | 'free') => void;
  onLocalInputUpdate: (input: {
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
  }) => void;
  localHP: number;
  isGameOver: boolean;
}

// Sub-component residing INSIDE the Fiber Canvas to access useThree, useFrame, etc.
function WorldSceneController({
  roomState,
  myId,
  myRole,
  spectatorViewMode,
  onLocalInputUpdate,
  isGameOver,
}: {
  roomState: GameRoomState;
  myId: string;
  myRole: RoomRole;
  spectatorViewMode: 'player1' | 'player2' | 'free';
  onLocalInputUpdate: (input: {
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
  }) => void;
  isGameOver: boolean;
}) {
  const { camera } = useThree();

  // Control State References
  const keysRef = useRef<{ [key: string]: boolean }>({});
  const mouseRef = useRef<{ yaw: number; pitch: number }>({ yaw: 0, pitch: 0 });
  
  // Local Player Physics
  const localPos = useRef<THREE.Vector3>(new THREE.Vector3(0, 0.5, 0));
  const localVel = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));
  const freeCamPos = useRef<THREE.Vector3>(new THREE.Vector3(0, 8, 25));

  // Charge bow parameters
  const chargeStateRef = useRef<{ isCharging: boolean; chargeStart: number | null }>({
    isCharging: false,
    chargeStart: null,
  });

  // Init local position based on role
  const initializedPosition = useRef<boolean>(false);
  useEffect(() => {
    if (!initializedPosition.current) {
      if (myRole === 'player1') {
        localPos.current.set(-20, 0.5, 0);
        mouseRef.current.yaw = -Math.PI / 2; // Facing right (towards LavaWall)
        initializedPosition.current = true;
      } else if (myRole === 'player2') {
        localPos.current.set(20, 0.5, 0);
        mouseRef.current.yaw = Math.PI / 2; // Facing left (towards LavaWall)
        initializedPosition.current = true;
      }
    }
  }, [myRole]);

  // Trap keyboard states globally
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', ' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        keysRef.current[key] = true;
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', ' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        keysRef.current[key] = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Frame simulation and input integration
  useFrame((state, delta) => {
    // Avoid large frames issues or extreme lag jumps
    const dt = Math.min(delta, 0.1); 

    // Retrieve references to Player 1 & Player 2 for spectator views
    const p1Instance = Object.values(roomState.players).find((p) => p.role === 'player1');
    const p2Instance = Object.values(roomState.players).find((p) => p.role === 'player2');

    // ----------------------------------------------------
    // Scenario A: Active local user is a Client Player
    // ----------------------------------------------------
    if ((myRole === 'player1' || myRole === 'player2') && !isGameOver) {
      const isPlayer1 = myRole === 'player1';
      const plState = roomState.players[myId];

      if (plState && !plState.isDead) {
        // Integrate knockback speeds from host state (if any applied recently)
        // We compare our local velocity with the synced velocity and apply correction
        if (Math.abs(plState.vx) > 0.1 || Math.abs(plState.vz) > 0.1) {
          // If we received a major external push, we add it to our local velocity vectors
          if (localVel.current.lengthSq() < 1) {
            localVel.current.set(plState.vx, plState.vy, plState.vz);
          }
        }

        // Keyboard Movement direction calculation
        const moveVector = new THREE.Vector3(0, 0, 0);
        if (keysRef.current['w'] || keysRef.current['arrowup']) moveVector.z -= 1;
        if (keysRef.current['s'] || keysRef.current['arrowdown']) moveVector.z += 1;
        if (keysRef.current['a'] || keysRef.current['arrowleft']) moveVector.x -= 1;
        if (keysRef.current['d'] || keysRef.current['arrowright']) moveVector.x += 1;

        moveVector.normalize();

        const speedMultiplier = 6.2; // Move speed
        const yaw = mouseRef.current.yaw;
        const rotatedMove = moveVector.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
        
        // Retain current Y velocity (gravity drops)
        const currentVy = localVel.current.y;
        localVel.current.copy(rotatedMove).multiplyScalar(speedMultiplier);
        localVel.current.y = currentVy;

        // Perform gravity and bounding check
        // Platform X-borders:
        // Left Platform (P1): [-27, -13], Z: [-7, 7] (Size matches 14x14 grid)
        // Right Platform (P2): [13, 27], Z: [-7, 7]
        const xCenter = isPlayer1 ? -20 : 20;
        const xDist = Math.abs(localPos.current.x - xCenter);
        const zDist = Math.abs(localPos.current.z);

        const isOnPlatform = xDist <= 7.05 && zDist <= 7.05;

        if (isOnPlatform && localPos.current.y >= 0.5) {
          // Snap player safely on top of the tile platform
          localPos.current.y = 0.5;
          localVel.current.y = 0;
        } else {
          // Fall through space (Gravity acceleration)
          localVel.current.y -= 15 * dt; // Gravity
        }

        // Apply velocities to coordinates
        localPos.current.addScaledVector(localVel.current, dt);

        // Limit maximum boundaries far out to avoid rendering bugs
        if (localPos.current.x < -60) localPos.current.x = -60;
        if (localPos.current.x > 60) localPos.current.x = 60;
        if (localPos.current.z < -45) localPos.current.z = -45;
        if (localPos.current.z > 45) localPos.current.z = 45;

        // Camera positioning at player 1st person eyeball heights (y + 1.25)
        camera.position.set(localPos.current.x, localPos.current.y + 1.25, localPos.current.z);

        // Render rotation quaternion from mouse values
        const targetLook = new THREE.Vector3(0, 0, -1)
          .applyAxisAngle(new THREE.Vector3(1, 0, 0), mouseRef.current.pitch)
          .applyAxisAngle(new THREE.Vector3(0, 1, 0), mouseRef.current.yaw);
        
        const lookTargetPos = new THREE.Vector3().copy(camera.position).add(targetLook);
        camera.lookAt(lookTargetPos);

        // Fetch active charging ratio
        let ratio = 0;
        if (plState.isCharging && plState.chargeStart) {
          const dur = Date.now() - plState.chargeStart;
          ratio = Math.min(dur / 1500, 1.0); // 1.5s for max charging strength
        }

        // Alert App parent on local position changes to issue WebRTC sync
        onLocalInputUpdate({
          x: localPos.current.x,
          y: localPos.current.y,
          z: localPos.current.z,
          vx: localVel.current.x,
          vy: localVel.current.y,
          vz: localVel.current.z,
          yaw: mouseRef.current.yaw,
          pitch: mouseRef.current.pitch,
          isCharging: plState.isCharging,
          chargeRatio: ratio,
        });
      }
    }

    // ----------------------------------------------------
    // Scenario B: Active user is spectator OR free flying
    // ----------------------------------------------------
    else {
      if (spectatorViewMode === 'player1' && p1Instance) {
        // Eye target P1
        camera.position.set(p1Instance.x, p1Instance.y + 1.25, p1Instance.z);
        const lookTarget = new THREE.Vector3(0, 0, -1)
          .applyAxisAngle(new THREE.Vector3(1, 0, 0), p1Instance.pitch)
          .applyAxisAngle(new THREE.Vector3(0, 1, 0), p1Instance.yaw);
        camera.lookAt(new THREE.Vector3().copy(camera.position).add(lookTarget));
      } else if (spectatorViewMode === 'player2' && p2Instance) {
        // Eye target P2
        camera.position.set(p2Instance.x, p2Instance.y + 1.25, p2Instance.z);
        const lookTarget = new THREE.Vector3(0, 0, -1)
          .applyAxisAngle(new THREE.Vector3(1, 0, 0), p2Instance.pitch)
          .applyAxisAngle(new THREE.Vector3(0, 1, 0), p2Instance.yaw);
        camera.lookAt(new THREE.Vector3().copy(camera.position).add(lookTarget));
      } else {
        // Free moving fly camera: Standard floating Spectator mechanics
        const flyDir = new THREE.Vector3(0, 0, 0);
        if (keysRef.current['w'] || keysRef.current['arrowup']) flyDir.z -= 1;
        if (keysRef.current['s'] || keysRef.current['arrowdown']) flyDir.z += 1;
        if (keysRef.current['a'] || keysRef.current['arrowleft']) flyDir.x -= 1;
        if (keysRef.current['d'] || keysRef.current['arrowright']) flyDir.x += 1;

        if (flyDir.lengthSq() > 0) {
          flyDir.normalize();
          // Align flying direction according to spectator yaw lookat
          const rotFly = flyDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), mouseRef.current.yaw);
          freeCamPos.current.addScaledVector(rotFly, 15 * dt);
        }

        camera.position.copy(freeCamPos.current);

        const lookTargetFree = new THREE.Vector3(0, 0, -1)
          .applyAxisAngle(new THREE.Vector3(1, 0, 0), mouseRef.current.pitch)
          .applyAxisAngle(new THREE.Vector3(0, 1, 0), mouseRef.current.yaw);

        camera.lookAt(new THREE.Vector3().copy(camera.position).add(lookTargetFree));
      }
    }
  });

  // Attach mouse drag capture to the HTML document body
  // Highly secure implementation that bypasses pointer-lock permissions!
  useEffect(() => {
    let isDragging = false;
    let clickStartX = 0;
    let clickStartY = 0;
    let baseYaw = 0;
    let basePitch = 0;

    const handleMouseDown = (e: MouseEvent) => {
      // Avoid interference with floating Lobby buttons
      if ((e.target as HTMLElement).closest('button, input, select, .no-drag')) {
        return;
      }
      isDragging = true;
      clickStartX = e.clientX;
      clickStartY = e.clientY;
      baseYaw = mouseRef.current.yaw;
      basePitch = mouseRef.current.pitch;
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaX = e.clientX - clickStartX;
      const deltaY = e.clientY - clickStartY;

      // Sensitivity factor
      const lookSensitivity = 0.0035;
      
      mouseRef.current.yaw = baseYaw - deltaX * lookSensitivity;
      
      // Clamp pitch to avoid turning completely upside down or somersaulting
      let tempPt = basePitch - deltaY * lookSensitivity;
      const limit = Math.PI / 2.05; // ~85 degrees cap
      if (tempPt > limit) tempPt = limit;
      if (tempPt < -limit) tempPt = -limit;
      mouseRef.current.pitch = tempPt;
    };

    const handleMouseUp = () => {
      isDragging = false;
    };

    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // Sync back local physics to camera ref
  return (
    <group>
      {/* 1. Left Platform Grid (Player 1 Base) */}
      <ArenaPlatform
        position={[-20, 0, 0]}
        color="#2c1e21"
        glowColor="#ff324a"
        name="L-Arena (P1)"
      />

      {/* 2. Right Platform Grid (Player 2 Base) */}
      <ArenaPlatform
        position={[20, 0, 0]}
        color="#151e2d"
        glowColor="#1e88e5"
        name="R-Arena (P2)"
      />

      {/* 3. Infinite Boiling Magma Sea underneath */}
      <LavaFloor />

      {/* 4. Giant Molten Magma Wall dividing them in the center */}
      <LavaWall />

      {/* 5. Render Player 3D Models */}
      {Object.values(roomState.players).map((pState) => {
        const isSelf = pState.id === myId;
        return (
          <PlayerModel
            key={pState.id}
            playerState={pState}
            isSelf={isSelf}
          />
        );
      })}

      {/* 6. Render Active Airborne Fire Projectiles */}
      <ArrowModelList arrows={roomState.arrows} />
    </group>
  );
}

export function GameCanvas({
  roomState,
  myId,
  myRole,
  spectatorViewMode,
  setSpectatorViewMode,
  onLocalInputUpdate,
  localHP,
  isGameOver,
}: GameCanvasProps) {
  return (
    <div className="relative w-full h-full bg-slate-950 overflow-hidden select-none">
      {/* Drag looking instruction for absolute clarity */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 pointer-events-none text-center bg-black/70 border border-gray-700/50 backdrop-blur px-4 py-1.5 rounded-full select-none text-[11px] text-gray-300 font-sans shadow-md">
        {myRole !== 'spectator' ? (
          <span>
            🖱️ <strong>드래그:</strong> 시선 돌리기 | ⌨️ <strong>W, A, S, D:</strong> 이동 | 🎯 <strong>우클릭/좌클릭 유지:</strong> 활 시위 당기기
          </span>
        ) : (
          <span>
            👁️ <strong>관전자 모드:</strong> 마우스 드래그로 시점 회전 | ⌨️ <strong>자유 시점은 W, A, S, D로 비행 이동</strong>
          </span>
        )}
      </div>

      {/* 3D WebGL Scene */}
      <Canvas shadows gl={{ antialias: true }} dpr={[1, 2]}>
        <color attach="background" args={['#050811']} />
        
        {/* Lights */}
        <ambientLight intensity={0.45} />
        <directionalLight
          position={[10, 25, 10]}
          intensity={0.9}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />
        <pointLight position={[-15, 6, -10]} intensity={1.5} color="#ff324a" distance={30} />
        <pointLight position={[15, 6, 10]} intensity={1.5} color="#1e88e5" distance={30} />

        {/* Ambient Cosmic Starry Background */}
        <Stars radius={100} depth={50} count={1200} factor={4} saturation={0.5} fade speed={1.5} />

        <PerspectiveCamera makeDefault fov={70} near={0.1} far={1000} />

        <WorldSceneController
          roomState={roomState}
          myId={myId}
          myRole={myRole}
          spectatorViewMode={spectatorViewMode}
          onLocalInputUpdate={onLocalInputUpdate}
          isGameOver={isGameOver}
        />
      </Canvas>
    </div>
  );
}
