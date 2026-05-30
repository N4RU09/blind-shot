/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { Player3DState } from '../types';

interface PlayerModelProps {
  playerState: Player3DState;
  isSelf: boolean;
}

export function PlayerModel({ playerState, isSelf }: PlayerModelProps) {
  const groupRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Mesh>(null);
  const rightArmRef = useRef<THREE.Mesh>(null);

  // Rotate player mesh based on raw yaw and pitch
  useFrame(() => {
    if (groupRef.current) {
      // Interpolate position slightly for lag compensation, or direct sync
      groupRef.current.position.set(playerState.x, playerState.y, playerState.z);
      // Yaw rotation
      groupRef.current.rotation.y = playerState.yaw;
    }
    if (headRef.current) {
      // Pitch rotation for the head / bow aiming representation
      headRef.current.rotation.x = -playerState.pitch;
    }

    // Dynamic floating hand animation if charging bow
    if (playerState.isCharging && rightArmRef.current && leftArmRef.current) {
      const charge = playerState.chargeRatio || 0.1;
      rightArmRef.current.position.set(-0.6, 0.4, -0.2 - charge * 0.5); // Pull back arm
      leftArmRef.current.position.set(0.6, 0.4, -0.6); // Aim forward arm
    } else if (rightArmRef.current && leftArmRef.current) {
      // Default stance
      rightArmRef.current.position.set(-0.6, 0.4, -0.4);
      leftArmRef.current.position.set(0.6, 0.4, -0.4);
    }
  });

  // If this is the active local playing participant in 1st person view,
  // we do not render their body to avoid blocking their camera perspective,
  // but we still float their HUD/names to spectators or render simple items if needed.
  if (isSelf) {
    return (
      <group ref={groupRef}>
        {/* Invisible anchor for camera attachment coordinates */}
        <object3D position={[0, 0.8, 0]} />
      </group>
    );
  }

  const pColor = playerState.role === 'player1' ? '#ff324a' : '#1e88e5';
  const capColor = playerState.role === 'player1' ? '#ffccd0' : '#d2e8ff';

  return (
    <group ref={groupRef}>
      {/* 2D Floating Overhead HUD for peer state visibility */}
      <Html position={[0, 2.2, 0]} center distanceFactor={15}>
        <div className="flex flex-col items-center bg-gray-900/90 border border-gray-700 rounded-lg px-2.5 py-1 text-white shadow-lg pointer-events-none min-w-[120px] select-none scale-90">
          <span className="text-xs font-semibold tracking-wide flex items-center gap-1.5 font-sans mb-1">
            <span
              className="w-2.5 h-2.5 rounded-full inline-block animate-pulse"
              style={{ backgroundColor: pColor }}
            />
            {playerState.nickname || `Player ${playerState.role === 'player1' ? '1' : '2'}`}
          </span>
          
          {/* Health Bar */}
          <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
            <div
              className="h-full transition-all duration-300 rounded-full"
              style={{
                width: `${(playerState.hp / 10) * 100}%`,
                backgroundColor: playerState.hp > 3 ? pColor : '#ff9800',
              }}
            />
          </div>
          <span className="text-[9px] text-gray-400 mt-0.5 font-mono">
            HP: {playerState.hp}/10 | 🏹 {playerState.arrowsLeft}
          </span>
        </div>
      </Html>

      {/* Main 3D Voxel Mesh Hierarchy */}
      <group position={[0, 0, 0]}>
        {/* 1. Rigid Body Torso */}
        <mesh position={[0, 0.8, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.9, 1.2, 0.5]} />
          <meshStandardMaterial color="#2d2d2d" metalness={0.7} roughness={0.3} />
        </mesh>

        <mesh position={[0, 0.8, 0.05]} castShadow receiveShadow>
          <boxGeometry args={[0.8, 1.0, 0.44]} />
          <meshStandardMaterial color={pColor} metalness={0.2} roughness={0.5} />
        </mesh>

        {/* 2. Coordinated Head & Eye Visor (Aims with pitch) */}
        <group ref={headRef} position={[0, 1.6, 0]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[0.65, 0.61, 0.61]} />
            <meshStandardMaterial color="#3a3a3a" metalness={0.8} roughness={0.2} />
          </mesh>
          {/* Glowing visor */}
          <mesh position={[0, 0.05, -0.31]} castShadow>
            <boxGeometry args={[0.5, 0.12, 0.05]} />
            <meshStandardMaterial 
              color={pColor} 
              emissive={pColor} 
              emissiveIntensity={2} 
            />
          </mesh>
          {/* Decorative Antenna */}
          <mesh position={[0, 0.35, 0.1]}>
            <cylinderGeometry args={[0.02, 0.02, 0.3]} />
            <meshStandardMaterial color="#111" />
          </mesh>
          <mesh position={[0, 0.5, 0.1]}>
            <sphereGeometry args={[0.06]} />
            <meshBasicMaterial color={pColor} />
          </mesh>
        </group>

        {/* 3. Fully Positioned Bow and Arms (Aim state feedback) */}
        {/* Left Arm holding Bow Forward */}
        <mesh ref={leftArmRef} position={[0.6, 0.8, -0.2]} castShadow>
          <boxGeometry args={[0.22, 0.22, 0.6]} />
          <meshStandardMaterial color="#2d2d2d" />
        </mesh>

        {/* Right Arm pulling back string */}
        <mesh ref={rightArmRef} position={[-0.6, 0.8, -0.2]} castShadow>
          <boxGeometry args={[0.22, 0.22, 0.6]} />
          <meshStandardMaterial color="#2d2d2d" />
        </mesh>

        {/* 4. Elegant Cyber Bow (renders attached to left hand forward) */}
        <group position={[0.6, 0.8, -0.5]} rotation={[0, 0, 0]}>
          <mesh castShadow>
            <torusGeometry args={[0.6, 0.04, 8, 24, Math.PI]} />
            <meshStandardMaterial color="#ffaa00" emissive="#cc8800" emissiveIntensity={0.5} />
          </mesh>
          {/* Bow string */}
          <mesh position={[-0.01, 0, 0]}>
            <cylinderGeometry args={[0.005, 0.005, 1.2]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.6} />
          </mesh>
          {/* Active charging fire aura indicator */}
          {playerState.isCharging && (
            <mesh position={[0, 0, -0.1]}>
              <sphereGeometry args={[0.15 + (playerState.chargeRatio || 0) * 0.2, 8, 8]} />
              <meshBasicMaterial 
                color="#ff4400" 
                wireframe 
                transparent 
                opacity={0.8} 
              />
            </mesh>
          )}
        </group>

        {/* 5. Left and Right Moving Legs (Static stylized representation) */}
        <mesh position={[-0.25, 0.1, 0]} castShadow>
          <boxGeometry args={[0.25, 0.35, 0.28]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
        <mesh position={[0.25, 0.1, 0]} castShadow>
          <boxGeometry args={[0.25, 0.35, 0.28]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>

        {/* Base Platform Shadow Indicator */}
        <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <ringGeometry args={[0.7, 0.8, 16]} />
          <meshBasicMaterial color={pColor} transparent opacity={0.4} />
        </mesh>
      </group>
    </group>
  );
}
