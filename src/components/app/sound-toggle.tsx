"use client";

import { Volume2, VolumeX } from "lucide-react";
import { useSoundToggle } from "@/hooks/use-sound-enabled";

export function SoundToggle() {
  const { enabled, toggle } = useSoundToggle();

  return (
    <button
      type="button"
      onClick={toggle}
      title={enabled ? "Silenciar sonido" : "Activar sonido"}
      className="flex size-9 items-center justify-center rounded-full border border-white/10 bg-white/5 hover:bg-white/10"
    >
      {enabled ? (
        <Volume2 className="size-4 text-gold-300" />
      ) : (
        <VolumeX className="size-4 text-muted-foreground" />
      )}
    </button>
  );
}
