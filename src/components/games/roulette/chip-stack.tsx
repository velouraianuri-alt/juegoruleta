"use client";

import { motion } from "framer-motion";
import { CHIP_COLORS, formatChipAmount, largestChipFor } from "./chip-denominations";

/** A small 2.5D stack of casino chips marking a bet on the table — layer count grows
 * with the amount, each layer drops in with a slight stagger, and the total value
 * sits on the top chip. Purely cosmetic (the real total is the authoritative amount
 * from the server); this never needs to sum to `amount` chip-by-chip. */
export function ChipStack({ amount }: { amount: number }) {
  if (!amount) return null;

  const denom = largestChipFor(amount);
  const colors = CHIP_COLORS[denom];
  const layers = amount >= 1000 ? 3 : amount >= 100 ? 2 : 1;

  return (
    <motion.div
      exit={{ opacity: 0, scale: 0.4, y: -14, rotate: 25, transition: { duration: 0.22, ease: "easeIn" } }}
      className="pointer-events-none absolute -top-2.5 -right-2 z-10"
      style={{ width: 24, height: 24 + (layers - 1) * 3 }}
    >
      {Array.from({ length: layers }).map((_, i) => {
        const isTop = i === layers - 1;
        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: -10, scale: 0.5, rotate: -8 }}
            animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 24, delay: i * 0.05 }}
            className="absolute left-0 flex items-center justify-center rounded-full border shadow-[0_2px_3px_rgba(0,0,0,0.55)]"
            style={{
              bottom: i * 3,
              width: 24,
              height: 24,
              background: `repeating-conic-gradient(${colors.edge} 0deg 15deg, ${colors.base} 15deg 30deg)`,
              borderColor: colors.edge,
            }}
          >
            <span
              className="flex size-4 items-center justify-center rounded-full text-[7px] font-bold leading-none"
              style={{ background: colors.base, color: colors.text }}
            >
              {isTop ? formatChipAmount(amount) : ""}
            </span>
          </motion.div>
        );
      })}
    </motion.div>
  );
}
