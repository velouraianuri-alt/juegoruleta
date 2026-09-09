"use client";

import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
    <div className="felt-texture w-full min-w-0 overflow-x-auto rounded-2xl border-2 border-gold-500/50 p-2 shadow-[inset_0_2px_10px_rgba(0,0,0,0.4)] sm:p-3">
      {/* Fixed minimum width below `sm` so number cells stay a comfortable tap
          target instead of shrinking to illegible slivers — the felt scrolls
          horizontally on narrow phones instead, like a real table's rail. */}
      <div className="min-w-[460px] sm:min-w-0">
      <div className="flex min-w-0 gap-1">
        <motion.button
          type="button"
          disabled={disabled}
          onClick={() => onBet("straight", "0")}
          whileHover={disabled ? undefined : CELL_HOVER}
          whileTap={disabled ? undefined : CELL_TAP}
          transition={CELL_SPRING}
          style={{ clipPath: ZERO_CLIP_PATH }}
          className="relative flex w-9 shrink-0 items-center justify-center border border-gold-200/40 bg-felt-500 pl-1 text-sm font-bold text-white disabled:pointer-events-none disabled:opacity-50 sm:w-11 lg:w-14 lg:text-base"
        >
          0
          <AnimatePresence>
            {totals.straight[0] > 0 && <ChipStack key="chip" amount={totals.straight[0]} />}
          </AnimatePresence>
        </motion.button>

        <div className="relative grid min-w-0 flex-1 grid-cols-12 gap-px bg-gold-200/25 p-px">
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
                    "absolute inset-[8%] flex items-center justify-center rounded-full text-xs font-semibold text-white disabled:pointer-events-none disabled:opacity-50 sm:text-sm lg:text-base",
                    colorForNumber(n) === "red" ? "bg-crimson-500" : "bg-noir-800",
                  )}
                >
                  {n}
                  <AnimatePresence>
                    {totals.straight[n] > 0 && <ChipStack key="chip" amount={totals.straight[n]} />}
                  </AnimatePresence>
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
                  className={cn(
                    "pointer-events-auto absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-gold-200/70 bg-gold-100/30 transition-opacity duration-150 hover:opacity-100 disabled:pointer-events-none sm:size-3 lg:size-3.5",
                    amount ? "opacity-100" : "opacity-0",
                  )}
                  style={{ left: `${zone.xPct}%`, top: `${zone.yPct}%` }}
                >
                  <AnimatePresence>{amount ? <ChipStack key="chip" amount={amount} /> : null}</AnimatePresence>
                </motion.button>
              );
            })}
          </div>
        </div>

        <div className="flex w-9 shrink-0 flex-col gap-1 sm:w-11 lg:w-14">
          {[3, 2, 1].map((c) => (
            <motion.button
              key={c}
              type="button"
              disabled={disabled}
              onClick={() => onBet("column", String(c))}
              whileHover={disabled ? undefined : CELL_HOVER}
              whileTap={disabled ? undefined : CELL_TAP}
              transition={CELL_SPRING}
              className="relative flex h-8 flex-1 items-center justify-center rounded-md border border-gold-200/30 bg-felt-700/60 text-[9px] font-medium text-gold-200 disabled:pointer-events-none disabled:opacity-50 sm:h-9 sm:text-[10px] lg:h-10 lg:text-xs"
            >
              2:1
              <AnimatePresence>
                {totals.outside[cellKey("column", String(c))] ? (
                  <ChipStack key="chip" amount={totals.outside[cellKey("column", String(c))]!} />
                ) : null}
              </AnimatePresence>
            </motion.button>
          ))}
        </div>
      </div>

      <div className="mt-1 flex min-w-0 gap-1">
        <div className="grid min-w-0 flex-1 grid-cols-3 gap-1">
          {[1, 2, 3].map((d) => (
            <motion.button
              key={d}
              type="button"
              disabled={disabled}
              onClick={() => onBet("dozen", String(d))}
              whileHover={disabled ? undefined : CELL_HOVER}
              whileTap={disabled ? undefined : CELL_TAP}
              transition={CELL_SPRING}
              className="relative flex h-8 items-center justify-center rounded-md border border-gold-200/30 bg-felt-700/60 text-xs text-gold-200 disabled:pointer-events-none disabled:opacity-50 lg:h-10 lg:text-sm"
            >
              {d === 1 ? "1ª docena" : d === 2 ? "2ª docena" : "3ª docena"}
              <AnimatePresence>
                {totals.outside[cellKey("dozen", String(d))] ? (
                  <ChipStack key="chip" amount={totals.outside[cellKey("dozen", String(d))]!} />
                ) : null}
              </AnimatePresence>
            </motion.button>
          ))}
        </div>
        <div className="w-9 shrink-0 sm:w-11 lg:w-14" />
      </div>

      <div className="mt-1 flex min-w-0 gap-1">
        <div className="grid min-w-0 flex-1 grid-cols-6 gap-1">
          <motion.button
            type="button"
            disabled={disabled}
            onClick={() => onBet("low", null)}
            whileHover={disabled ? undefined : CELL_HOVER}
            whileTap={disabled ? undefined : CELL_TAP}
            transition={CELL_SPRING}
            className="relative flex h-8 items-center justify-center rounded-md border border-gold-200/30 bg-felt-700/60 text-[10px] font-medium text-gold-200 disabled:pointer-events-none disabled:opacity-50 sm:text-xs lg:h-10 lg:text-sm"
          >
            1–18
            <AnimatePresence>
              {totals.outside[cellKey("low", "")] ? (
                <ChipStack key="chip" amount={totals.outside[cellKey("low", "")]!} />
              ) : null}
            </AnimatePresence>
          </motion.button>
          <motion.button
            type="button"
            disabled={disabled}
            onClick={() => onBet("even", null)}
            whileHover={disabled ? undefined : CELL_HOVER}
            whileTap={disabled ? undefined : CELL_TAP}
            transition={CELL_SPRING}
            className="relative flex h-8 items-center justify-center rounded-md border border-gold-200/30 bg-felt-700/60 text-[10px] font-medium text-gold-200 disabled:pointer-events-none disabled:opacity-50 sm:text-xs lg:h-10 lg:text-sm"
          >
            PAR
            <AnimatePresence>
              {totals.outside[cellKey("even", "")] ? (
                <ChipStack key="chip" amount={totals.outside[cellKey("even", "")]!} />
              ) : null}
            </AnimatePresence>
          </motion.button>
          <motion.button
            type="button"
            disabled={disabled}
            onClick={() => onBet("red", null)}
            whileHover={disabled ? undefined : CELL_HOVER}
            whileTap={disabled ? undefined : CELL_TAP}
            transition={CELL_SPRING}
            aria-label="Rojo"
            className="relative flex h-8 items-center justify-center rounded-md border border-gold-200/30 bg-felt-700/60 disabled:pointer-events-none disabled:opacity-50 lg:h-10"
          >
            <span className="size-4 rotate-45 border-2 border-crimson-400 sm:size-5 lg:size-6" />
            <AnimatePresence>
              {totals.outside[cellKey("red", "")] ? (
                <ChipStack key="chip" amount={totals.outside[cellKey("red", "")]!} />
              ) : null}
            </AnimatePresence>
          </motion.button>
          <motion.button
            type="button"
            disabled={disabled}
            onClick={() => onBet("black", null)}
            whileHover={disabled ? undefined : CELL_HOVER}
            whileTap={disabled ? undefined : CELL_TAP}
            transition={CELL_SPRING}
            aria-label="Negro"
            className="relative flex h-8 items-center justify-center rounded-md border border-gold-200/30 bg-felt-700/60 disabled:pointer-events-none disabled:opacity-50 lg:h-10"
          >
            <span className="size-4 rotate-45 border-2 border-white bg-noir-950 sm:size-5 lg:size-6" />
            <AnimatePresence>
              {totals.outside[cellKey("black", "")] ? (
                <ChipStack key="chip" amount={totals.outside[cellKey("black", "")]!} />
              ) : null}
            </AnimatePresence>
          </motion.button>
          <motion.button
            type="button"
            disabled={disabled}
            onClick={() => onBet("odd", null)}
            whileHover={disabled ? undefined : CELL_HOVER}
            whileTap={disabled ? undefined : CELL_TAP}
            transition={CELL_SPRING}
            className="relative flex h-8 items-center justify-center rounded-md border border-gold-200/30 bg-felt-700/60 text-[10px] font-medium text-gold-200 disabled:pointer-events-none disabled:opacity-50 sm:text-xs lg:h-10 lg:text-sm"
          >
            IMPAR
            <AnimatePresence>
              {totals.outside[cellKey("odd", "")] ? (
                <ChipStack key="chip" amount={totals.outside[cellKey("odd", "")]!} />
              ) : null}
            </AnimatePresence>
          </motion.button>
          <motion.button
            type="button"
            disabled={disabled}
            onClick={() => onBet("high", null)}
            whileHover={disabled ? undefined : CELL_HOVER}
            whileTap={disabled ? undefined : CELL_TAP}
            transition={CELL_SPRING}
            className="relative flex h-8 items-center justify-center rounded-md border border-gold-200/30 bg-felt-700/60 text-[10px] font-medium text-gold-200 disabled:pointer-events-none disabled:opacity-50 sm:text-xs lg:h-10 lg:text-sm"
          >
            19–36
            <AnimatePresence>
              {totals.outside[cellKey("high", "")] ? (
                <ChipStack key="chip" amount={totals.outside[cellKey("high", "")]!} />
              ) : null}
            </AnimatePresence>
          </motion.button>
        </div>
        <div className="w-9 shrink-0 sm:w-11 lg:w-14" />
      </div>
      </div>
    </div>
  );
}
