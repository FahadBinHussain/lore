'use client';

import { useRef, useMemo, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

function Particles({ count = 600 }: { count?: number }) {
  const mesh = useRef<THREE.Points>(null);
  const { pointer } = useThree();

  const { positions, velocities, sizes, opacities } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const opacities = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 30;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 20;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 15;

      velocities[i * 3] = (Math.random() - 0.5) * 0.003;
      velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.003;
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.002;

      sizes[i] = Math.random() * 2.5 + 0.5;
      opacities[i] = Math.random() * 0.6 + 0.2;
    }

    return { positions, velocities, sizes, opacities };
  }, [count]);

  const vertexShader = `
    attribute float aSize;
    attribute float aOpacity;
    varying float vOpacity;
    uniform float uTime;
    uniform vec2 uPointer;

    void main() {
      vOpacity = aOpacity;
      vec3 pos = position;

      float dist = length(pos.xy - uPointer * 8.0);
      float influence = smoothstep(6.0, 0.0, dist);
      pos.xy += normalize(pos.xy - uPointer * 8.0) * influence * 0.8;
      pos.z += influence * 1.5;

      pos.x += sin(uTime * 0.3 + position.y * 0.5) * 0.15;
      pos.y += cos(uTime * 0.2 + position.x * 0.5) * 0.15;

      vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
      gl_PointSize = aSize * (200.0 / -mvPosition.z);
      gl_Position = projectionMatrix * mvPosition;
    }
  `;

  const fragmentShader = `
    varying float vOpacity;
    uniform float uTime;

    void main() {
      float dist = length(gl_PointCoord - vec2(0.5));
      if (dist > 0.5) discard;

      float alpha = smoothstep(0.5, 0.0, dist) * vOpacity;

      vec3 color = mix(
        vec3(0.545, 0.361, 0.965),
        vec3(0.396, 0.478, 0.976),
        sin(uTime * 0.5 + gl_PointCoord.x * 3.14) * 0.5 + 0.5
      );

      gl_FragColor = vec4(color, alpha * 0.7);
    }
  `;

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPointer: { value: new THREE.Vector2(0, 0) },
    }),
    []
  );

  useFrame((state) => {
    if (!mesh.current) return;

    const time = state.clock.getElapsedTime();
    uniforms.uTime.value = time;
    uniforms.uPointer.value.set(pointer.x, -pointer.y);

    const posArray = mesh.current.geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < count; i++) {
      posArray[i * 3] += velocities[i * 3];
      posArray[i * 3 + 1] += velocities[i * 3 + 1];
      posArray[i * 3 + 2] += velocities[i * 3 + 2];

      if (Math.abs(posArray[i * 3]) > 15) velocities[i * 3] *= -1;
      if (Math.abs(posArray[i * 3 + 1]) > 10) velocities[i * 3 + 1] *= -1;
      if (Math.abs(posArray[i * 3 + 2]) > 8) velocities[i * 3 + 2] *= -1;
    }
    mesh.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={mesh}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
        <bufferAttribute
          attach="attributes-aSize"
          args={[sizes, 1]}
        />
        <bufferAttribute
          attach="attributes-aOpacity"
          args={[opacities, 1]}
        />
      </bufferGeometry>
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

function ConnectionLines() {
  const linesRef = useRef<THREE.LineSegments>(null);
  const lineCount = 40;

  const { positions, colors } = useMemo(() => {
    const positions = new Float32Array(lineCount * 6);
    const colors = new Float32Array(lineCount * 6);

    for (let i = 0; i < lineCount; i++) {
      const x1 = (Math.random() - 0.5) * 25;
      const y1 = (Math.random() - 0.5) * 18;
      const z1 = (Math.random() - 0.5) * 10;

      const x2 = x1 + (Math.random() - 0.5) * 8;
      const y2 = y1 + (Math.random() - 0.5) * 8;
      const z2 = z1 + (Math.random() - 0.5) * 4;

      positions[i * 6] = x1;
      positions[i * 6 + 1] = y1;
      positions[i * 6 + 2] = z1;
      positions[i * 6 + 3] = x2;
      positions[i * 6 + 4] = y2;
      positions[i * 6 + 5] = z2;

      const r = 0.45 + Math.random() * 0.2;
      const g = 0.35 + Math.random() * 0.15;
      const b = 0.85 + Math.random() * 0.15;

      colors[i * 6] = r;
      colors[i * 6 + 1] = g;
      colors[i * 6 + 2] = b;
      colors[i * 6 + 3] = r * 0.5;
      colors[i * 6 + 4] = g * 0.5;
      colors[i * 6 + 5] = b * 0.5;
    }

    return { positions, colors };
  }, []);

  useFrame((state) => {
    if (!linesRef.current) return;
    const time = state.clock.getElapsedTime();
    linesRef.current.rotation.y = Math.sin(time * 0.05) * 0.1;
    linesRef.current.rotation.x = Math.cos(time * 0.03) * 0.05;
  });

  return (
    <lineSegments ref={linesRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <lineBasicMaterial vertexColors transparent opacity={0.12} />
    </lineSegments>
  );
}

function FloatingRing({
  position,
  scale,
  speed,
}: {
  position: [number, number, number];
  scale: number;
  speed: number;
}) {
  const ref = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!ref.current) return;
    const time = state.clock.getElapsedTime();
    ref.current.rotation.x = time * speed * 0.3;
    ref.current.rotation.y = time * speed * 0.5;
    ref.current.position.y = position[1] + Math.sin(time * speed) * 0.3;
  });

  return (
    <mesh ref={ref} position={position} scale={scale}>
      <torusGeometry args={[1, 0.02, 16, 64]} />
      <meshBasicMaterial color="#7c5cf5" transparent opacity={0.08} />
    </mesh>
  );
}

export function ThreeBackground() {
  return (
    <div className="fixed inset-0 z-0" style={{ pointerEvents: 'none' }}>
      <Canvas
        camera={{ position: [0, 0, 12], fov: 60 }}
        dpr={[1, 1.5]}
        style={{ background: 'transparent' }}
        gl={{ alpha: true, antialias: false }}
      >
        <Particles count={500} />
        <ConnectionLines />
        <FloatingRing position={[-6, 3, -5]} scale={1.5} speed={0.4} />
        <FloatingRing position={[7, -2, -6]} scale={1.2} speed={0.3} />
        <FloatingRing position={[0, -4, -4]} scale={0.8} speed={0.5} />
      </Canvas>
    </div>
  );
}
