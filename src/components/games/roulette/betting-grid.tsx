"use client";

import { motion } from "framer-motion";
import { colorForNumber } from "./wheel-data";
import { ChipStack } from "./chip-stack";
import { cn } from "@/lib/utils";
import type { RouletteBetType } from "@/lib/supabase/types";

const NUMBER_ROWS = [
  [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36],
  [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35],
  [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34],
];

export interface BetTotals {
  straight: Record<number, number>;
  outside: Partial<Record<string, number>>;
}

const CELL_HOVER = { y: -3, scale: 1.05, boxShadow: "0 8px 16px -4px rgba(212,175,55,0.5), 0 0 0 1px rgba(212,175,55,0.45)" };
const CELL_TAP = { scale: 0.96, y: 0 };
const CELL_SPRING = { type: "spring" as const, stiffness: 500, damping: 26 };

export function BettingGrid({
  disabled,
  onBet,
  totals,
}: {
  disabled: boolean;
  onBet: (type: RouletteBetType, value: string | null) => void;
  totals: BetTotals;
}) {
  const cellKey = (type: string, value: string) => `${type}:${value}`;

  const outsideBets: { type: RouletteBetType; value: string | null; label: string; className: string }[] = [
    { type: "low", value: null, label: "1–18", className: "" },
    { type: "even", value: null, label: "PAR", className: "" },
    { type: "red", value: null, label: "ROJO", className: "bg-crimson-500/25 text-crimson-300" },
    { type: "black", value: null, label: "NEGRO", className: "bg-noir-700 text-white" },
    { type: "odd", value: null, label: "IMPAR", className: "" },
    { type: "high", value: null, label: "19–36", className: "" },
  ];

  return (
    <div className="flex w-full flex-col gap-1.5">
      <div className="flex gap-1.5">
        <motion.button
          type="button"
          disabled={disabled}
          onClick={() => onBet("straight", "0")}
          whileHover={disabled ? undefined : CELL_HOVER}
          whileTap={disabled ? undefined : CELL_TAP}
          transition={CELL_SPRING}
          className="relative flex w-10 shrink-0 items-center justify-center rounded-md bg-felt-500 text-sm font-bold text-white disabled:pointer-events-none disabled:opacity-50 sm:w-12"
        >
          0
          {totals.straight[0] > 0 && <ChipStack amount={totals.straight[0]} />}
        </motion.button>

        <div className="grid flex-1 grid-rows-3 gap-1">
          {NUMBER_ROWS.map((row, i) => (
            <div key={i} className="grid grid-cols-12 gap-1">
              {row.map((n) => (
                <motion.button
                  key={n}
                  type="button"
                  disabled={disabled}
                  onClick={() => onBet("straight", String(n))}
                  whileHover={disabled ? undefined : CELL_HOVER}
                  whileTap={disabled ? undefined : CELL_TAP}
                  transition={CELL_SPRING}
                  className={cn(
                    "relative flex h-8 items-center justify-center rounded-md text-xs font-semibold text-white disabled:pointer-events-none disabled:opacity-50 sm:h-9 sm:text-sm",
                    colorForNumber(n) === "red" ? "bg-crimson-500" : "bg-noir-700",
                  )}
                >
                  {n}
                  {totals.straight[n] > 0 && <ChipStack amount={totals.straight[n]} />}
                </motion.button>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        {[1, 2, 3].map((d) => (
          <motion.button
            key={d}
            type="button"
            disabled={disabled}
            onClick={() => onBet("dozen", String(d))}
            whileHover={disabled ? undefined : CELL_HOVER}
            whileTap={disabled ? undefined : CELL_TAP}
            transition={CELL_SPRING}
            className="relative flex h-8 items-center justify-center rounded-md bg-white/5 text-xs text-gold-200 disabled:pointer-events-none disabled:opacity-50"
          >
            {d === 1 ? "1ª docena" : d === 2 ? "2ª docena" : "3ª docena"}
            {totals.outside[cellKey("dozen", String(d))] ? (
              <ChipStack amount={totals.outside[cellKey("dozen", String(d))]!} />
            ) : null}
          </motion.button>
        ))}
      </div>

      <div className="grid grid-cols-6 gap-1.5">
        {outsideBets.map((b) => (
          <motion.button
            key={b.label}
            type="button"
            disabled={disabled}
            onClick={() => onBet(b.type, b.value)}
            whileHover={disabled ? undefined : CELL_HOVER}
            whileTap={disabled ? undefined : CELL_TAP}
            transition={CELL_SPRING}
            className={cn(
              "relative flex h-8 items-center justify-center rounded-md text-[10px] font-medium disabled:pointer-events-none disabled:opacity-50 sm:text-xs",
              b.className || "bg-white/5 text-gold-200",
            )}
          >
            {b.label}
            {totals.outside[cellKey(b.type, b.value ?? "")] ? (
              <ChipStack amount={totals.outside[cellKey(b.type, b.value ?? "")]!} />
            ) : null}
          </motion.button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        {[1, 2, 3].map((c) => (
          <motion.button
            key={c}
            type="button"
            disabled={disabled}
            onClick={() => onBet("column", String(c))}
            whileHover={disabled ? undefined : CELL_HOVER}
            whileTap={disabled ? undefined : CELL_TAP}
            transition={CELL_SPRING}
            className="relative flex h-7 items-center justify-center rounded-md bg-white/5 text-[10px] text-gold-200 disabled:pointer-events-none disabled:opacity-50"
          >
            Columna {c} (2:1)
            {totals.outside[cellKey("column", String(c))] ? (
              <ChipStack amount={totals.outside[cellKey("column", String(c))]!} />
            ) : null}
          </motion.button>
        ))}
      </div>
    </div>
  );
}
