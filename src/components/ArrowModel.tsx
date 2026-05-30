/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Arrow3DState } from '../types';

interface ArrowSingleProps {
  arrow: Arrow3DState;
}

function SingleArrow({ arrow }: ArrowSingleProps) {
  const meshRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.position.set(arrow.x, arrow.y, arrow.z);

      // Align arrow orientation to its speed vector
      const speedSq = arrow.vx * arrow.vx + arrow.vy * arrow.vy + arrow.vz * arrow.vz;
      if (speedSq > 0.001) {
        const vel = new THREE.Vector3(arrow.vx, arrow.vy, arrow.vz).normalize();
        
        // Quaternions can easily pivot from target direction
        const up = new THREE.Vector3(0, 1, 0);
        const quaternion = new THREE.Quaternion().setFromUnitVectors(up, vel);
        meshRef.current.quaternion.copy(quaternion);
      }
    }
  });

  return (
    <group ref={meshRef}>
      {/* 3D Arrow Cylinder Shaft */}
      <mesh castShadow>
        <cylinderGeometry args={[0.03, 0.03, 1.1, 6]} />
        <meshStandardMaterial
          color="#ffc107"
          metalness={0.9}
          roughness={0.1}
          emissive="#ff9800"
          emissiveIntensity={0.6}
        />
      </mesh>

      {/* Pointy Bow Cone Tip (Pointing along +Y locally) */}
      <mesh position={[0, 0.6, 0]} castShadow>
        <coneGeometry args={[0.08, 0.22, 6]} />
        <meshStandardMaterial
          color="#ff3d00"
          emissive="#ff1100"
          emissiveIntensity={1.5}
          metalness={0.9}
          roughness={0.1}
        />
      </mesh>

      {/* Rear Feathers (Fletching) */}
      <group position={[0, -0.45, 0]}>
        <mesh position={[0.07, 0, 0]} rotation={[0, 0, Math.PI / 6]}>
          <boxGeometry args={[0.01, 0.2, 0.1]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.8} />
        </mesh>
        <mesh position={[-0.07, 0, 0]} rotation={[0, 0, -Math.PI / 6]}>
          <boxGeometry args={[0.01, 0.2, 0.1]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.8} />
        </mesh>
        <mesh position={[0, 0, 0.07]} rotation={[Math.PI / 6, 0, 0]}>
          <boxGeometry args={[0.1, 0.2, 0.01]} />
          <meshBasicMaterial color="#ff5555" transparent opacity={0.8} />
        </mesh>
        <mesh position={[0, 0, -0.07]} rotation={[-Math.PI / 6, 0, 0]}>
          <boxGeometry args={[0.1, 0.2, 0.01]} />
          <meshBasicMaterial color="#ff5555" transparent opacity={0.8} />
        </mesh>
      </group>

      {/* Built-in Point Light on flying plasma arrows */}
      <pointLight color="#ffa500" intensity={4} distance={8} decay={2} />
    </group>
  );
}

interface ArrowsListProps {
  arrows: Arrow3DState[];
}

export function ArrowModelList({ arrows }: ArrowsListProps) {
  const activeArrows = arrows.filter((a) => a.active);

  return (
    <group>
      {/* 1. All Active Projectiles */}
      {activeArrows.map((arrow) => (
        <SingleArrow key={arrow.id} arrow={arrow} />
      ))}

      {/* 2. Visual Trail Particles for trace-back coordination */}
      {activeArrows.map((arrow) => (
        <group key={`trail-grp-${arrow.id}`}>
          {arrow.trail.map((point, idx) => {
            // Decay size and opacity for older trail nodes
            const fraction = (idx + 1) / (arrow.trail.length || 1);
            const scale = 0.06 + fraction * 0.12;
            const op = fraction * 0.85;

            return (
              <mesh key={`trail-${arrow.id}-${idx}`} position={[point.x, point.y, point.z]}>
                <sphereGeometry args={[scale, 4, 4]} />
                <meshBasicMaterial
                  color="#ff5d00"
                  transparent
                  opacity={op}
                  blending={THREE.AdditiveBlending}
                  depthWrite={false}
                />
              </mesh>
            );
          })}
        </group>
      ))}
    </group>
  );
}
