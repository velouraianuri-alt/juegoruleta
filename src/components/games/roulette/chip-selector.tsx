"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { CHIP_COLORS, CHIP_DENOMINATIONS, formatChipAmount, type ChipDenomination } from "./chip-denominations";

export function ChipSelector({
  value,
  onChange,
}: {
  value: ChipDenomination;
  onChange: (value: ChipDenomination) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="flex items-center gap-2">
        {CHIP_DENOMINATIONS.map((v) => {
          const colors = CHIP_COLORS[v];
          const active = value === v;
          return (
            <motion.button
              key={v}
              type="button"
              onClick={() => onChange(v)}
              aria-label={`Ficha de ${v}`}
              aria-pressed={active}
              whileHover={{ y: -3, scale: 1.08 }}
              whileTap={{ scale: 0.94 }}
              animate={active ? { y: -4, scale: 1.12 } : { y: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 500, damping: 26 }}
              className={cn(
                "relative flex size-9 items-center justify-center rounded-full border-2 shadow-[0_2px_4px_rgba(0,0,0,0.5)]",
                active && "ring-2 ring-gold-300 ring-offset-2 ring-offset-noir-950",
              )}
              style={{
                background: `repeating-conic-gradient(${colors.edge} 0deg 15deg, ${colors.base} 15deg 30deg)`,
                borderColor: colors.edge,
              }}
            >
              <span
                className="flex size-6 items-center justify-center rounded-full text-[10px] font-bold leading-none"
                style={{ background: colors.base, color: colors.text }}
              >
                {formatChipAmount(v)}
              </span>
            </motion.button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        Ficha seleccionada: <span className="font-mono text-gold-200">{value.toLocaleString("es-ES")}</span>
      </p>
    </div>
  );
}
