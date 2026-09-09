"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment } from "@react-three/drei";
import * as THREE from "three";
import { WheelRotor, WheelBowl } from "./wheel-mesh";
import { Ball } from "./ball";
import { buildSpinPlan, wheelRotationDeg, SPIN_DURATION_NORMAL_MS, type SpinPlan } from "./spin-curve";
import { CameraRig } from "./camera-rig";
import { CAMERA_PRESETS, type CameraPresetId } from "./camera-presets";
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
    sound.wheelHum(durationMs);
    tickTimers.current.forEach(clearTimeout);
    tickTimers.current = [];
    const bounceStart = durationMs * 0.5;
    const bounceEnd = durationMs * 0.86;
    const tickCount = 10;
    for (let i = 0; i < tickCount; i++) {
      const t = bounceStart + ((bounceEnd - bounceStart) * i) / tickCount;
      tickTimers.current.push(setTimeout(() => sound.ballTick(), t));
    }
    // Heavier bounce thuds during the hop envelope's active window (see
    // ballPose in spin-curve.ts) — sparser and lower than the ballTick skips above.
    [0.6, 0.68, 0.76].forEach((frac) => {
      tickTimers.current.push(setTimeout(() => sound.ballBounce(), durationMs * frac));
    });
    tickTimers.current.push(setTimeout(() => sound.settle(), durationMs));
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
  cameraPreset = "classic",
  cameraResetToken = 0,
  onSettled,
  className,
}: {
  spinToken: number;
  winningNumber: number | null;
  durationMs?: number;
  cameraPreset?: CameraPresetId;
  cameraResetToken?: number;
  /** Fires once, exactly when the ball visually reaches its final resting pose
   * (progress t>=1) — the signal callers should wait for before revealing the
   * result/payout, rather than the instant the round settles server-side. */
  onSettled?: () => void;
  className?: string;
}) {
  const dpr = useMemo<[number, number]>(() => [1, 1.75], []);
  const initialCamera = CAMERA_PRESETS.classic;

  return (
    <div
      className={className}
      style={{
        width: "100%",
        aspectRatio: "1 / 1",
        maxWidth: 320,
        borderRadius: "9999px",
        background:
          "radial-gradient(circle at 50% 42%, #123322 0%, #0a2015 45%, #05100b 78%, #030a06 100%)",
      }}
    >
      <Canvas
        shadows
        dpr={dpr}
        camera={{ position: initialCamera.position, fov: initialCamera.fov }}
        gl={{ antialias: true, alpha: true }}
      >
        <CameraRig preset={cameraPreset} resetToken={cameraResetToken} />
        <fog attach="fog" args={["#0a2015", 7.5, 15]} />
        <Environment preset="studio" environmentIntensity={0.5} />
        <ambientLight intensity={0.5} />
        <directionalLight
          position={[3, 6, 3]}
          intensity={1.5}
          castShadow
          shadow-mapSize={[1024, 1024]}
          shadow-camera-near={1}
          shadow-camera-far={12}
          shadow-camera-left={-4}
          shadow-camera-right={4}
          shadow-camera-top={4}
          shadow-camera-bottom={-4}
        />
        {/* Warm rim light from behind-above to separate the wheel's silhouette
            from the background instead of it reading as a flat dark disc. */}
        <directionalLight position={[-2, 3, -4]} intensity={0.6} color="#f3d98a" />
        <pointLight position={[-3, 2, -3]} intensity={0.45} color="#d4af37" />
        <pointLight position={[0, 1, 4]} intensity={0.3} color="#17703f" />

        <Suspense fallback={null}>
          <SpinRig
            spinToken={spinToken}
            winningNumber={winningNumber}
            durationMs={durationMs}
            onSettled={onSettled ?? (() => {})}
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
