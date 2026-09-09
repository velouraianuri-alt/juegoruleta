"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { colorForNumber } from "./wheel-data";
import { NUMBER_ROWS, buildHitZones } from "./roulette-grid-geometry";
import { ChipStack } from "./chip-stack";
import { cn } from "@/lib/utils";
import type { RouletteBetType } from "@/lib/supabase/types";

export interface BetTotals {
  straight: Record<number, number>;
  outside: Partial<Record<string, number>>;
}

const CELL_HOVER = { y: -2, scale: 1.06, boxShadow: "0 8px 16px -4px rgba(212,175,55,0.5), 0 0 0 1px rgba(212,175,55,0.45)" };
const CELL_TAP = { scale: 0.96, y: 0 };
const CELL_SPRING = { type: "spring" as const, stiffness: 500, damping: 26 };
const ZONE_HOVER = { scale: 2.2, boxShadow: "0 0 8px 2px rgba(212,175,55,0.7)" };
const ZONE_TAP = { scale: 1.6 };

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
  const hitZones = useMemo(() => buildHitZones(), []);

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

        <div className="relative grid flex-1 grid-cols-12 gap-px bg-gold-200/25 p-px">
          {NUMBER_ROWS.map((row, r) =>
            row.map((n, c) => (
              <div
                key={n}
                className="relative aspect-square bg-felt-700/50"
                style={{ gridColumn: c + 1, gridRow: r + 1 }}
              >
                <motion.button
                  type="button"
                  disabled={disabled}
                  onClick={() => onBet("straight", String(n))}
                  whileHover={disabled ? undefined : CELL_HOVER}
                  whileTap={disabled ? undefined : CELL_TAP}
                  transition={CELL_SPRING}
                  className={cn(
                    "absolute inset-[8%] flex items-center justify-center rounded-full text-[10px] font-semibold text-white disabled:pointer-events-none disabled:opacity-50 sm:text-xs",
                    colorForNumber(n) === "red" ? "bg-crimson-500" : "bg-noir-800",
                  )}
                >
                  {n}
                  {totals.straight[n] > 0 && <ChipStack amount={totals.straight[n]} />}
                </motion.button>
              </div>
            )),
          )}

          {/* Split/corner hit-zones — betting on the shared border between two
              numbers, or the corner where four meet, like a real table. */}
          <div className="pointer-events-none absolute inset-0 z-10">
            {hitZones.map((zone) => {
              const value = zone.numbers.join(",");
              const amount = totals.outside[cellKey(zone.type, value)];
              return (
                <motion.button
                  key={zone.key}
                  type="button"
                  disabled={disabled}
                  onClick={() => onBet(zone.type, value)}
                  whileHover={disabled ? undefined : ZONE_HOVER}
                  whileTap={disabled ? undefined : ZONE_TAP}
                  transition={CELL_SPRING}
                  title={`${zone.type === "split" ? "División" : "Esquina"}: ${zone.numbers.join(", ")}`}
                  className="pointer-events-auto absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-gold-200/70 bg-gold-100/30 disabled:pointer-events-none disabled:opacity-30 sm:size-3"
                  style={{ left: `${zone.xPct}%`, top: `${zone.yPct}%` }}
                >
                  {amount ? <ChipStack amount={amount} /> : null}
                </motion.button>
              );
            })}
          </div>
        </div>

        <div className="flex w-9 shrink-0 flex-col gap-1 sm:w-11">
          {[3, 2, 1].map((c) => (
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
