/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef } from 'react';
import * as THREE from 'three';

interface PlatformProps {
  position: [number, number, number];
  color: string;
  glowColor: string;
  name: string;
}

export function ArenaPlatform({ position, color, glowColor, name }: PlatformProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  return (
    <group position={position}>
      {/* Real 3D Platform Grid Base */}
      <mesh ref={meshRef} receiveShadow>
        <boxGeometry args={[14, 1, 14]} />
        <meshStandardMaterial 
          color={color} 
          roughness={0.4} 
          metalness={0.8} 
        />
      </mesh>

      {/* Cyber Glow Border */}
      <mesh position={[0, 0.51, 0]}>
        <boxGeometry args={[14.1, 0.1, 14.1]} />
        <meshStandardMaterial 
          color={glowColor}
          emissive={glowColor}
          emissiveIntensity={2.0}
          transparent
          opacity={0.8}
          wireframe
        />
      </mesh>

      {/* Decorative Corner Pillars */}
      <mesh position={[-6.5, 1, -6.5]}>
        <cylinderGeometry args={[0.3, 0.4, 2, 8]} />
        <meshStandardMaterial color="#444" metalness={0.9} roughness={0.1} />
      </mesh>
      <mesh position={[6.5, 1, -6.5]}>
        <cylinderGeometry args={[0.3, 0.4, 2, 8]} />
        <meshStandardMaterial color="#444" metalness={0.9} roughness={0.1} />
      </mesh>
      <mesh position={[-6.5, 1, 6.5]}>
        <cylinderGeometry args={[0.3, 0.4, 2, 8]} />
        <meshStandardMaterial color="#444" metalness={0.9} roughness={0.1} />
      </mesh>
      <mesh position={[6.5, 1, 6.5]}>
        <cylinderGeometry args={[0.3, 0.4, 2, 8]} />
        <meshStandardMaterial color="#444" metalness={0.9} roughness={0.1} />
      </mesh>

      {/* Grid Pattern on Platform */}
      <gridHelper args={[14, 14, glowColor, '#222222']} position={[0, 0.51, 0]} />
    </group>
  );
}

export function LavaFloor() {
  const floorRef = useRef<THREE.Mesh>(null);

  return (
    <group position={[0, -25, 0]}>
      {/* Magma sea far below the platforms */}
      <mesh ref={floorRef} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[150, 150]} />
        <meshStandardMaterial
          color="#ff3300"
          emissive="#aa2200"
          emissiveIntensity={1.5}
          roughness={0.9}
        />
      </mesh>
      <ambientLight intensity={0.2} color="#ff5500" />
    </group>
  );
}
