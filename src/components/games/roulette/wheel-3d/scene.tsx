"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { WheelRotor, WheelBowl } from "./wheel-mesh";
import { Ball } from "./ball";
import { buildSpinPlan, wheelRotationDeg, SPIN_DURATION_NORMAL_MS, type SpinPlan } from "./spin-curve";
import { sound } from "@/lib/sound";

function SpinRig({
  spinToken,
  winningNumber,
  durationMs,
  onSettled,
}: {
  spinToken: number;
  winningNumber: number | null;
  durationMs: number;
  onSettled: () => void;
}) {
  const rotorRef = useRef<THREE.Group>(null);
  const [plan, setPlan] = useState<SpinPlan | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const startRef = useRef<number | null>(null);
  const lastToken = useRef(0);
  const settledRef = useRef(false);
  const tickTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (spinToken === lastToken.current || winningNumber === null) return;
    lastToken.current = spinToken;
    settledRef.current = false;
    const newPlan = buildSpinPlan(winningNumber);
    setPlan(newPlan);
    startRef.current = null;
    setProgress(0);

    sound.spinStart();
    tickTimers.current.forEach(clearTimeout);
    tickTimers.current = [];
    const bounceStart = durationMs * 0.5;
    const bounceEnd = durationMs * 0.86;
    const tickCount = 10;
    for (let i = 0; i < tickCount; i++) {
      const t = bounceStart + ((bounceEnd - bounceStart) * i) / tickCount;
      tickTimers.current.push(setTimeout(() => sound.ballTick(), t));
    }
    tickTimers.current.push(setTimeout(() => sound.win(), durationMs + 150));

    return () => {
      tickTimers.current.forEach(clearTimeout);
    };
     
  }, [spinToken, winningNumber, durationMs]);

  useFrame((state) => {
    if (progress === null || !plan) return;
    if (startRef.current === null) startRef.current = state.clock.elapsedTime;
    const elapsedMs = (state.clock.elapsedTime - startRef.current) * 1000;
    const t = Math.min(1, elapsedMs / durationMs);
    setProgress(t);

    if (rotorRef.current) {
      rotorRef.current.rotation.y = -(wheelRotationDeg(plan, t) * Math.PI) / 180;
    }

    if (t >= 1 && !settledRef.current) {
      settledRef.current = true;
      onSettled();
    }
  });

  return (
    <>
      <group ref={rotorRef}>
        <WheelRotor />
      </group>
      <WheelBowl />
      <Ball plan={plan} progress={progress} />
    </>
  );
}

export function RouletteWheel3D({
  spinToken,
  winningNumber,
  durationMs = SPIN_DURATION_NORMAL_MS,
  className,
}: {
  spinToken: number;
  winningNumber: number | null;
  durationMs?: number;
  className?: string;
}) {
  const dpr = useMemo<[number, number]>(() => [1, 1.75], []);

  return (
    <div className={className} style={{ width: "100%", aspectRatio: "1 / 1", maxWidth: 420 }}>
      <Canvas
        shadows
        dpr={dpr}
        camera={{ position: [0, 4.4, 5.4], fov: 38 }}
        gl={{ antialias: true, alpha: true }}
      >
        <color attach="background" args={["#05100b"]} />
        <fog attach="fog" args={["#05100b", 8, 16]} />
        <ambientLight intensity={0.35} />
        <directionalLight
          position={[3, 6, 3]}
          intensity={1.4}
          castShadow
          shadow-mapSize={[1024, 1024]}
          shadow-camera-near={1}
          shadow-camera-far={12}
          shadow-camera-left={-4}
          shadow-camera-right={4}
          shadow-camera-top={4}
          shadow-camera-bottom={-4}
        />
        <pointLight position={[-3, 2, -3]} intensity={0.4} color="#d4af37" />
        <pointLight position={[0, 1, 4]} intensity={0.25} color="#17703f" />

        <Suspense fallback={null}>
          <SpinRig
            spinToken={spinToken}
            winningNumber={winningNumber}
            durationMs={durationMs}
            onSettled={() => {}}
          />
        </Suspense>

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]} receiveShadow>
          <planeGeometry args={[20, 20]} />
          <shadowMaterial opacity={0.35} />
        </mesh>
      </Canvas>
    </div>
  );
}
