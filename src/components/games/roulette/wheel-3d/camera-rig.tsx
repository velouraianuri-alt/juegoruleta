"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as THREE from "three";
import { CAMERA_PRESETS, type CameraPresetId } from "./camera-presets";

const TRANSITION_MS = 900;

function easeInOutCubic(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
}

interface Transition {
  from: { position: THREE.Vector3; target: THREE.Vector3; fov: number };
  to: { position: THREE.Vector3; target: THREE.Vector3; fov: number };
  startTime: number | null;
}

/** Drives the camera between fixed presets (smooth lerp, no snapping) and layers a
 * constrained OrbitControls on top of whichever preset is currently active — bounded
 * distance/polar/azimuth per preset, so the viewer can look around without ever
 * losing the wheel or spinning to a nonsense angle. `resetToken` re-plays the
 * transition into the current preset even when the preset itself didn't change,
 * for a "recenter" control. */
export function CameraRig({ preset, resetToken }: { preset: CameraPresetId; resetToken: number }) {
  // Read the camera via the store's stable `get()` accessor rather than destructuring
  // it from useThree() at render time — R3F's camera is a mutable three.js object we
  // update imperatively every frame, which the React Compiler's immutability check
  // (correctly, for normal React values) rejects if the binding comes straight from a
  // hook call in the component body.
  const get = useThree((state) => state.get);
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const transitionRef = useRef<Transition | null>(null);
  const lastPreset = useRef<CameraPresetId | null>(null);
  const lastResetToken = useRef(resetToken);

  useEffect(() => {
    const { camera } = get();
    const cfg = CAMERA_PRESETS[preset];
    const controls = controlsRef.current;
    if (!controls) return;

    const isFirstRun = lastPreset.current === null;
    const presetChanged = lastPreset.current !== preset;
    const resetRequested = lastResetToken.current !== resetToken;
    lastPreset.current = preset;
    lastResetToken.current = resetToken;

    const toPosition = new THREE.Vector3(...cfg.position);
    const toTarget = new THREE.Vector3(...cfg.target);

    // First mount: snap directly, nothing to animate from yet.
    if (isFirstRun) {
      camera.position.copy(toPosition);
      controls.target.copy(toTarget);
      if (camera instanceof THREE.PerspectiveCamera) {
        camera.fov = cfg.fov;
        camera.updateProjectionMatrix();
      }
      controls.update();
      return;
    }

    if (!presetChanged && !resetRequested) return;

    transitionRef.current = {
      from: {
        position: camera.position.clone(),
        target: controls.target.clone(),
        fov: camera instanceof THREE.PerspectiveCamera ? camera.fov : cfg.fov,
      },
      to: { position: toPosition, target: toTarget, fov: cfg.fov },
      startTime: null,
    };
    controls.enabled = false;
  }, [preset, resetToken, get]);

  useFrame((state) => {
    const tr = transitionRef.current;
    const controls = controlsRef.current;
    if (!tr || !controls) return;

    const { camera } = state;
    if (tr.startTime === null) tr.startTime = state.clock.elapsedTime;
    const elapsedMs = (state.clock.elapsedTime - tr.startTime) * 1000;
    const t = easeInOutCubic(elapsedMs / TRANSITION_MS);

    camera.position.lerpVectors(tr.from.position, tr.to.position, t);
    controls.target.lerpVectors(tr.from.target, tr.to.target, t);
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = THREE.MathUtils.lerp(tr.from.fov, tr.to.fov, t);
      camera.updateProjectionMatrix();
    }
    controls.update();

    if (elapsedMs >= TRANSITION_MS) {
      transitionRef.current = null;
      controls.enabled = true;
    }
  });

  const cfg = CAMERA_PRESETS[preset];

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enablePan={false}
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.6}
      zoomSpeed={0.6}
      minDistance={cfg.minDistance}
      maxDistance={cfg.maxDistance}
      minPolarAngle={cfg.minPolarAngle}
      maxPolarAngle={cfg.maxPolarAngle}
      minAzimuthAngle={cfg.minAzimuthAngle}
      maxAzimuthAngle={cfg.maxAzimuthAngle}
    />
  );
}
