"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { ballPose, type SpinPlan } from "./spin-curve";

export function Ball({
  plan,
  progress,
}: {
  plan: SpinPlan | null;
  /** 0..1 normalized elapsed time, or null when idle (ball hidden/parked). */
  progress: number | null;
}) {
  const ref = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (!ref.current) return;
    if (!plan || progress === null) {
      ref.current.visible = false;
      return;
    }
    ref.current.visible = true;
    const pose = ballPose(plan, progress);
    const rad = (pose.angleDeg * Math.PI) / 180;
    ref.current.position.set(
      Math.cos(rad) * pose.radius,
      0.12 + pose.hop,
      Math.sin(rad) * pose.radius,
    );
  });

  return (
    <mesh ref={ref} castShadow>
      <sphereGeometry args={[0.11, 24, 24]} />
      <meshStandardMaterial color="#faf6ec" roughness={0.12} metalness={0.6} />
    </mesh>
  );
}
