"use client";

import { colorForNumber } from "./wheel-data";
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
        <button
          type="button"
          disabled={disabled}
          onClick={() => onBet("straight", "0")}
          className="relative flex w-10 shrink-0 items-center justify-center rounded-md bg-felt-500 text-sm font-bold text-white transition-transform hover:scale-105 disabled:pointer-events-none disabled:opacity-50 sm:w-12"
        >
          0
          {totals.straight[0] > 0 && <ChipBadge amount={totals.straight[0]} />}
        </button>

        <div className="grid flex-1 grid-rows-3 gap-1">
          {NUMBER_ROWS.map((row, i) => (
            <div key={i} className="grid grid-cols-12 gap-1">
              {row.map((n) => (
                <button
                  key={n}
                  type="button"
                  disabled={disabled}
                  onClick={() => onBet("straight", String(n))}
                  className={cn(
                    "relative flex h-8 items-center justify-center rounded-md text-xs font-semibold text-white transition-transform hover:scale-105 disabled:pointer-events-none disabled:opacity-50 sm:h-9 sm:text-sm",
                    colorForNumber(n) === "red" ? "bg-crimson-500" : "bg-noir-700",
                  )}
                >
                  {n}
                  {totals.straight[n] > 0 && <ChipBadge amount={totals.straight[n]} />}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        {[1, 2, 3].map((d) => (
          <button
            key={d}
            type="button"
            disabled={disabled}
            onClick={() => onBet("dozen", String(d))}
            className="relative flex h-8 items-center justify-center rounded-md bg-white/5 text-xs text-gold-200 hover:bg-white/10 disabled:pointer-events-none disabled:opacity-50"
          >
            {d === 1 ? "1ª docena" : d === 2 ? "2ª docena" : "3ª docena"}
            {totals.outside[cellKey("dozen", String(d))] ? (
              <ChipBadge amount={totals.outside[cellKey("dozen", String(d))]!} />
            ) : null}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-6 gap-1.5">
        {outsideBets.map((b) => (
          <button
            key={b.label}
            type="button"
            disabled={disabled}
            onClick={() => onBet(b.type, b.value)}
            className={cn(
              "relative flex h-8 items-center justify-center rounded-md text-[10px] font-medium hover:brightness-110 disabled:pointer-events-none disabled:opacity-50 sm:text-xs",
              b.className || "bg-white/5 text-gold-200 hover:bg-white/10",
            )}
          >
            {b.label}
            {totals.outside[cellKey(b.type, b.value ?? "")] ? (
              <ChipBadge amount={totals.outside[cellKey(b.type, b.value ?? "")]!} />
            ) : null}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        {[1, 2, 3].map((c) => (
          <button
            key={c}
            type="button"
            disabled={disabled}
            onClick={() => onBet("column", String(c))}
            className="relative flex h-7 items-center justify-center rounded-md bg-white/5 text-[10px] text-gold-200 hover:bg-white/10 disabled:pointer-events-none disabled:opacity-50"
          >
            Columna {c} (2:1)
            {totals.outside[cellKey("column", String(c))] ? (
              <ChipBadge amount={totals.outside[cellKey("column", String(c))]!} />
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}

function ChipBadge({ amount }: { amount: number }) {
  return (
    <span className="absolute -top-1.5 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full border border-noir-950 bg-gold-400 px-1 text-[9px] font-bold text-noir-950 shadow">
      {amount >= 1000 ? `${Math.round(amount / 100) / 10}k` : amount}
    </span>
  );
}
