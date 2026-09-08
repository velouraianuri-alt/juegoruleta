import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export function VirtualChipsBadge({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "pointer-events-none fixed bottom-3 left-1/2 z-30 -translate-x-1/2",
        className,
      )}
    >
      <div className="glass-panel pointer-events-auto flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium tracking-wide text-gold-200 sm:text-xs">
        <ShieldCheck className="size-3.5 shrink-0 text-gold-400" />
        <span className="whitespace-nowrap">
          Solo fichas virtuales · Sin dinero real
        </span>
      </div>
    </div>
  );
}
