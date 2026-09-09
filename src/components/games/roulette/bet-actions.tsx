"use client";

import { Undo2, Trash2, Repeat, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

function ActionButton({
  icon: Icon,
  label,
  disabled,
  onClick,
}: {
  icon: typeof Undo2;
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-full border border-gold-400/20 bg-noir-800/60 px-3 py-1.5 text-[11px] font-medium text-gold-200/80 transition-colors hover:text-gold-200 disabled:pointer-events-none disabled:opacity-40",
      )}
    >
      <Icon className="size-3.5" />
      {label}
    </button>
  );
}

export function BetActions({
  disabled,
  hasCurrentBets,
  hasPreviousBets,
  onUndo,
  onClear,
  onRepeat,
  onDuplicate,
}: {
  disabled: boolean;
  hasCurrentBets: boolean;
  hasPreviousBets: boolean;
  onUndo: () => void;
  onClear: () => void;
  onRepeat: () => void;
  onDuplicate: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <ActionButton icon={Undo2} label="Deshacer" disabled={disabled || !hasCurrentBets} onClick={onUndo} />
      <ActionButton icon={Trash2} label="Limpiar" disabled={disabled || !hasCurrentBets} onClick={onClear} />
      <ActionButton icon={Repeat} label="Repetir" disabled={disabled || !hasPreviousBets} onClick={onRepeat} />
      <ActionButton icon={Copy} label="Duplicar" disabled={disabled || !hasCurrentBets} onClick={onDuplicate} />
    </div>
  );
}
