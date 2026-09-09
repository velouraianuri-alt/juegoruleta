"use client";

import { RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { CAMERA_PRESET_ORDER, CAMERA_PRESETS, type CameraPresetId } from "./camera-presets";

export function CameraControls({
  preset,
  onPresetChange,
  onReset,
}: {
  preset: CameraPresetId;
  onPresetChange: (preset: CameraPresetId) => void;
  onReset: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1 rounded-full border border-gold-400/20 bg-noir-800/60 p-1">
        {CAMERA_PRESET_ORDER.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => onPresetChange(id)}
            className={cn(
              "rounded-full px-3 py-1 text-[11px] font-medium transition-colors",
              preset === id
                ? "bg-gold-400 text-noir-950"
                : "text-gold-200/70 hover:text-gold-200",
            )}
          >
            {CAMERA_PRESETS[id].label}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={onReset}
        aria-label="Reiniciar cámara"
        title="Reiniciar cámara"
        className="flex size-7 items-center justify-center rounded-full border border-gold-400/20 bg-noir-800/60 text-gold-200/70 transition-colors hover:text-gold-200"
      >
        <RotateCcw className="size-3.5" />
      </button>
    </div>
  );
}
