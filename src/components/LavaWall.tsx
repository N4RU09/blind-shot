/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function LavaWall() {
  const wallMesh = useRef<THREE.Mesh>(null);
  const glowMesh = useRef<THREE.Mesh>(null);
  const particlesRef = useRef<THREE.Points>(null);

  // Animate magma pulsations and particles
  useFrame((state) => {
    const elapsed = state.clock.getElapsedTime();
    
    // Pulse intensity
    if (wallMesh.current) {
      const mat = wallMesh.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 1.2 + Math.sin(elapsed * 2) * 0.3;
    }

    if (glowMesh.current) {
      glowMesh.current.scale.set(
        1 + Math.sin(elapsed * 4) * 0.01,
        1 + Math.cos(elapsed * 4) * 0.005,
        1
      );
    }

    // Rise magma particles upward
    if (particlesRef.current) {
      const positions = particlesRef.current.geometry.attributes.position.array as Float32Array;
      for (let i = 1; i < positions.length; i += 3) {
        positions[i] += 0.08; // Rise Y
        if (positions[i] > 18) {
          positions[i] = -18; // Reset at bottom
        }
      }
      particlesRef.current.geometry.attributes.position.needsUpdate = true;
    }
  });

  // Hot particle system inside the lava barrier block
  const particleCount = 220;
  const particlePositions = useMemo(() => {
    const arr = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 1.5; // X cluster (thin)
      arr[i * 3 + 1] = (Math.random() - 0.5) * 36; // Y height
      arr[i * 3 + 2] = (Math.random() - 0.5) * 45; // Z depth
    }
    return arr;
  }, []);

  return (
    <group position={[0, 5, 0]}>
      {/* Central Solid Occlusion Barrier */}
      <mesh ref={wallMesh}>
        <boxGeometry args={[1.5, 36, 46]} />
        <meshStandardMaterial
          color="#d31800"
          emissive="#ff2d00"
          emissiveIntensity={1.5}
          roughness={0.9}
          metalness={0.1}
          transparent
          opacity={0.97}
        />
      </mesh>

      {/* Fiery Corona Aura */}
      <mesh ref={glowMesh}>
        <boxGeometry args={[1.7, 36.2, 46.2]} />
        <meshBasicMaterial
          color="#ff6a00"
          transparent
          opacity={0.25}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Blazing Sparks Climbing the Wall */}
      <points ref={particlesRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[particlePositions, 3]}
          />
        </bufferGeometry>
        <pointsMaterial
          color="#ffaa00"
          size={0.25}
          transparent
          opacity={0.9}
          blending={THREE.AdditiveBlending}
        />
      </points>

      {/* Ambient Magma glow-light focused at center */}
      <pointLight position={[0, 5, 0]} color="#ff4500" intensity={15} distance={30} decay={2} />
    </group>
  );
}
