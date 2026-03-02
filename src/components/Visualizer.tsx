import { useEffect, useRef, useState } from 'react';
import { engine } from '../lib/audio';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import * as THREE from 'three';

function TerrainVisualizer() {
  const meshRef = useRef<THREE.Mesh>(null);
  const dataArray = new Uint8Array(64);

  useFrame((state) => {
    if (!meshRef.current) return;
    engine.getAnalyzerData(dataArray);
    
    const geometry = meshRef.current.geometry as THREE.PlaneGeometry;
    const positionAttribute = geometry.attributes.position;
    
    // Deform the plane based on frequency data
    for (let i = 0; i < positionAttribute.count; i++) {
      const x = positionAttribute.getX(i);
      const y = positionAttribute.getY(i);
      
      // Map vertex position to frequency bin
      const dist = Math.sqrt(x*x + y*y);
      const binIndex = Math.floor((dist / 15) * dataArray.length) % dataArray.length;
      
      const freqValue = dataArray[binIndex] / 255.0;
      const z = freqValue * 4.0; // Height of the terrain
      
      // Smoothly interpolate to new height
      const currentZ = positionAttribute.getZ(i);
      positionAttribute.setZ(i, THREE.MathUtils.lerp(currentZ, z, 0.1));
    }
    
    positionAttribute.needsUpdate = true;
    geometry.computeVertexNormals();
    
    // Slowly rotate the terrain
    meshRef.current.rotation.z = state.clock.elapsedTime * 0.1;
  });

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2.5, 0, 0]} position={[0, -2, -5]}>
      <planeGeometry args={[30, 30, 64, 64]} />
      <meshStandardMaterial 
        color="#6366f1" 
        wireframe={true} 
        emissive="#4f46e5"
        emissiveIntensity={0.5}
      />
    </mesh>
  );
}

function BarsVisualizer() {
  const groupRef = useRef<THREE.Group>(null);
  const dataArray = new Uint8Array(32);
  const barsCount = 32;

  useFrame(() => {
    if (!groupRef.current) return;
    engine.getAnalyzerData(dataArray);
    
    groupRef.current.children.forEach((mesh, i) => {
      const val = dataArray[i] / 255.0;
      const targetScale = Math.max(0.1, val * 5);
      mesh.scale.y = THREE.MathUtils.lerp(mesh.scale.y, targetScale, 0.2);
      // Adjust position so it scales from the bottom
      mesh.position.y = mesh.scale.y / 2 - 2;
      
      // Change color based on height
      const mat = (mesh as THREE.Mesh).material as THREE.MeshStandardMaterial;
      mat.color.setHSL(0.6 + val * 0.4, 0.8, 0.5);
    });
  });

  return (
    <group ref={groupRef}>
      {Array.from({ length: barsCount }).map((_, i) => (
        <mesh key={i} position={[(i - barsCount/2) * 0.4, -2, -5]}>
          <boxGeometry args={[0.3, 1, 0.3]} />
          <meshStandardMaterial color="#6366f1" />
        </mesh>
      ))}
    </group>
  );
}

export type VisualizerStyle = '3d-terrain' | '3d-bars' | 'off';

export default function Visualizer({ style }: { style: VisualizerStyle }) {
  if (style === 'off') return null;

  return (
    <div className="w-full h-48 rounded-2xl bg-[#1a1b1e] border border-white/5 shadow-inner overflow-hidden relative">
      <Canvas camera={{ position: [0, 0, 5], fov: 50 }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1} color="#818cf8" />
        <pointLight position={[-10, -10, -10]} intensity={0.5} color="#c084fc" />
        
        {style === '3d-terrain' && <TerrainVisualizer />}
        {style === '3d-bars' && <BarsVisualizer />}
        
        <OrbitControls enableZoom={false} enablePan={false} maxPolarAngle={Math.PI / 2} />
      </Canvas>
      <div className="absolute bottom-2 right-3 text-[10px] text-slate-500 uppercase tracking-widest pointer-events-none">
        Interactive 3D
      </div>
    </div>
  );
}
