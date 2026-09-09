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

// Each row's numbers all share one column bet — top row is column 3
// (n % 3 === 0), middle is column 2, bottom is column 1 — matching a real
// table's right-edge "2 to 1" strip, one cell per row instead of a separate
// row of its own underneath.
const ROW_COLUMN = [3, 2, 1];

export interface BetTotals {
  straight: Record<number, number>;
  outside: Partial<Record<string, number>>;
}

const CELL_HOVER = { y: -3, scale: 1.05, boxShadow: "0 8px 16px -4px rgba(212,175,55,0.5), 0 0 0 1px rgba(212,175,55,0.45)" };
const CELL_TAP = { scale: 0.96, y: 0 };
const CELL_SPRING = { type: "spring" as const, stiffness: 500, damping: 26 };

const ZERO_CLIP_PATH = "polygon(0% 50%, 32% 0%, 100% 0%, 100% 100%, 32% 100%)";

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

  return (
    <div className="felt-texture w-full rounded-2xl border-2 border-gold-500/50 p-2 shadow-[inset_0_2px_10px_rgba(0,0,0,0.4)] sm:p-3">
      <div className="flex gap-1">
        <motion.button
          type="button"
          disabled={disabled}
          onClick={() => onBet("straight", "0")}
          whileHover={disabled ? undefined : CELL_HOVER}
          whileTap={disabled ? undefined : CELL_TAP}
          transition={CELL_SPRING}
          style={{ clipPath: ZERO_CLIP_PATH }}
          className="relative flex w-9 shrink-0 items-center justify-center border border-gold-200/40 bg-felt-500 pl-1 text-sm font-bold text-white disabled:pointer-events-none disabled:opacity-50 sm:w-11"
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
                    "relative flex h-8 items-center justify-center rounded-full border border-gold-200/30 text-xs font-semibold text-white disabled:pointer-events-none disabled:opacity-50 sm:h-9 sm:text-sm",
                    colorForNumber(n) === "red" ? "bg-crimson-500" : "bg-noir-800",
                  )}
                >
                  {n}
                  {totals.straight[n] > 0 && <ChipStack amount={totals.straight[n]} />}
                </motion.button>
              ))}
            </div>
          ))}
        </div>

        <div className="flex w-9 shrink-0 flex-col gap-1 sm:w-11">
          {ROW_COLUMN.map((c) => (
            <motion.button
              key={c}
              type="button"
              disabled={disabled}
              onClick={() => onBet("column", String(c))}
              whileHover={disabled ? undefined : CELL_HOVER}
              whileTap={disabled ? undefined : CELL_TAP}
              transition={CELL_SPRING}
              className="relative flex h-8 flex-1 items-center justify-center rounded-md border border-gold-200/30 bg-felt-700/60 text-[9px] font-medium text-gold-200 disabled:pointer-events-none disabled:opacity-50 sm:h-9 sm:text-[10px]"
            >
              2:1
              {totals.outside[cellKey("column", String(c))] ? (
                <ChipStack amount={totals.outside[cellKey("column", String(c))]!} />
              ) : null}
            </motion.button>
          ))}
        </div>
      </div>

      <div className="mt-1 flex gap-1">
        <div className="grid flex-1 grid-cols-3 gap-1">
          {[1, 2, 3].map((d) => (
            <motion.button
              key={d}
              type="button"
              disabled={disabled}
              onClick={() => onBet("dozen", String(d))}
              whileHover={disabled ? undefined : CELL_HOVER}
              whileTap={disabled ? undefined : CELL_TAP}
              transition={CELL_SPRING}
              className="relative flex h-8 items-center justify-center rounded-md border border-gold-200/30 bg-felt-700/60 text-xs text-gold-200 disabled:pointer-events-none disabled:opacity-50"
            >
              {d === 1 ? "1ª docena" : d === 2 ? "2ª docena" : "3ª docena"}
              {totals.outside[cellKey("dozen", String(d))] ? (
                <ChipStack amount={totals.outside[cellKey("dozen", String(d))]!} />
              ) : null}
            </motion.button>
          ))}
        </div>
        <div className="w-9 shrink-0 sm:w-11" />
      </div>

      <div className="mt-1 flex gap-1">
        <div className="grid flex-1 grid-cols-6 gap-1">
          <motion.button
            type="button"
            disabled={disabled}
            onClick={() => onBet("low", null)}
            whileHover={disabled ? undefined : CELL_HOVER}
            whileTap={disabled ? undefined : CELL_TAP}
            transition={CELL_SPRING}
            className="relative flex h-8 items-center justify-center rounded-md border border-gold-200/30 bg-felt-700/60 text-[10px] font-medium text-gold-200 disabled:pointer-events-none disabled:opacity-50 sm:text-xs"
          >
            1–18
            {totals.outside[cellKey("low", "")] ? <ChipStack amount={totals.outside[cellKey("low", "")]!} /> : null}
          </motion.button>
          <motion.button
            type="button"
            disabled={disabled}
            onClick={() => onBet("even", null)}
            whileHover={disabled ? undefined : CELL_HOVER}
            whileTap={disabled ? undefined : CELL_TAP}
            transition={CELL_SPRING}
            className="relative flex h-8 items-center justify-center rounded-md border border-gold-200/30 bg-felt-700/60 text-[10px] font-medium text-gold-200 disabled:pointer-events-none disabled:opacity-50 sm:text-xs"
          >
            PAR
            {totals.outside[cellKey("even", "")] ? <ChipStack amount={totals.outside[cellKey("even", "")]!} /> : null}
          </motion.button>
          <motion.button
            type="button"
            disabled={disabled}
            onClick={() => onBet("red", null)}
            whileHover={disabled ? undefined : CELL_HOVER}
            whileTap={disabled ? undefined : CELL_TAP}
            transition={CELL_SPRING}
            aria-label="Rojo"
            className="relative flex h-8 items-center justify-center rounded-md border border-gold-200/30 bg-felt-700/60 disabled:pointer-events-none disabled:opacity-50"
          >
            <span className="size-4 rotate-45 border-2 border-crimson-400 sm:size-5" />
            {totals.outside[cellKey("red", "")] ? <ChipStack amount={totals.outside[cellKey("red", "")]!} /> : null}
          </motion.button>
          <motion.button
            type="button"
            disabled={disabled}
            onClick={() => onBet("black", null)}
            whileHover={disabled ? undefined : CELL_HOVER}
            whileTap={disabled ? undefined : CELL_TAP}
            transition={CELL_SPRING}
            aria-label="Negro"
            className="relative flex h-8 items-center justify-center rounded-md border border-gold-200/30 bg-felt-700/60 disabled:pointer-events-none disabled:opacity-50"
          >
            <span className="size-4 rotate-45 border-2 border-white bg-noir-950 sm:size-5" />
            {totals.outside[cellKey("black", "")] ? <ChipStack amount={totals.outside[cellKey("black", "")]!} /> : null}
          </motion.button>
          <motion.button
            type="button"
            disabled={disabled}
            onClick={() => onBet("odd", null)}
            whileHover={disabled ? undefined : CELL_HOVER}
            whileTap={disabled ? undefined : CELL_TAP}
            transition={CELL_SPRING}
            className="relative flex h-8 items-center justify-center rounded-md border border-gold-200/30 bg-felt-700/60 text-[10px] font-medium text-gold-200 disabled:pointer-events-none disabled:opacity-50 sm:text-xs"
          >
            IMPAR
            {totals.outside[cellKey("odd", "")] ? <ChipStack amount={totals.outside[cellKey("odd", "")]!} /> : null}
          </motion.button>
          <motion.button
            type="button"
            disabled={disabled}
            onClick={() => onBet("high", null)}
            whileHover={disabled ? undefined : CELL_HOVER}
            whileTap={disabled ? undefined : CELL_TAP}
            transition={CELL_SPRING}
            className="relative flex h-8 items-center justify-center rounded-md border border-gold-200/30 bg-felt-700/60 text-[10px] font-medium text-gold-200 disabled:pointer-events-none disabled:opacity-50 sm:text-xs"
          >
            19–36
            {totals.outside[cellKey("high", "")] ? <ChipStack amount={totals.outside[cellKey("high", "")]!} /> : null}
          </motion.button>
        </div>
        <div className="w-9 shrink-0 sm:w-11" />
      </div>
    </div>
  );
}
