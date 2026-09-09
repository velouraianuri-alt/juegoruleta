// Fixed camera framings for the 3D wheel, plus the orbit constraints allowed
// around each one. Values are hand-tuned spherical offsets from the wheel's
// center (0,0,0) — never a fully free camera, just a bounded look-around per
// preset so the wheel stays framed and the felt below it stays reachable.
export type CameraPresetId = "classic" | "close" | "premium";

export interface CameraPreset {
  id: CameraPresetId;
  label: string;
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
  minDistance: number;
  maxDistance: number;
  minPolarAngle: number;
  maxPolarAngle: number;
  minAzimuthAngle: number;
  maxAzimuthAngle: number;
}

export const CAMERA_PRESETS: Record<CameraPresetId, CameraPreset> = {
  classic: {
    id: "classic",
    label: "Clásica",
    position: [0, 4.4, 5.4],
    target: [0, 0, 0],
    fov: 36,
    minDistance: 5.6,
    maxDistance: 8.6,
    minPolarAngle: 0.7,
    maxPolarAngle: 1.15,
    minAzimuthAngle: -0.55,
    maxAzimuthAngle: 0.55,
  },
  close: {
    id: "close",
    label: "Cercana",
    position: [0, 3.0, 3.6],
    target: [0, 0, 0],
    fov: 42,
    minDistance: 3.6,
    maxDistance: 5.8,
    minPolarAngle: 0.68,
    maxPolarAngle: 1.2,
    minAzimuthAngle: -0.6,
    maxAzimuthAngle: 0.6,
  },
  premium: {
    id: "premium",
    label: "Premium 3D",
    position: [3.4, 3.7, 4.0],
    target: [0, 0, 0],
    fov: 34,
    minDistance: 5.0,
    maxDistance: 7.8,
    minPolarAngle: 0.75,
    maxPolarAngle: 1.25,
    minAzimuthAngle: 0.1,
    maxAzimuthAngle: 1.3,
  },
};

export const CAMERA_PRESET_ORDER: CameraPresetId[] = ["classic", "close", "premium"];
