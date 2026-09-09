"use client";

import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";

export function SpinSpeedToggle({
  quick,
  onChange,
}: {
  quick: boolean;
  onChange: (quick: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!quick)}
      aria-pressed={quick}
      title={quick ? "Giro rápido activado" : "Giro rápido desactivado"}
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors",
        quick
          ? "border-gold-400/50 bg-gold-400/15 text-gold-200"
          : "border-gold-400/20 bg-noir-800/60 text-gold-200/70 hover:text-gold-200",
      )}
    >
      <Zap className="size-3.5" />
      Spin rápido
    </button>
  );
}
