"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const SUIT_SYMBOL: Record<string, string> = { S: "♠", H: "♥", D: "♦", C: "♣" };
const RED_SUITS = new Set(["H", "D"]);

export function PlayingCard({
  code,
  faceDown = false,
  index = 0,
}: {
  code: string | null;
  faceDown?: boolean;
  index?: number;
}) {
  if (faceDown || !code) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -12, rotate: -4 }}
        animate={{ opacity: 1, y: 0, rotate: 0 }}
        transition={{ duration: 0.25, delay: index * 0.08 }}
        className="flex h-16 w-11 shrink-0 items-center justify-center rounded-md border border-gold-400/30 bg-gradient-to-br from-felt-700 to-noir-900 shadow-md sm:h-20 sm:w-14"
      >
        <div className="size-6 rounded-full border border-gold-400/40 sm:size-8" />
      </motion.div>
    );
  }

  const rank = code.slice(0, -1);
  const suit = code.slice(-1);
  const isRed = RED_SUITS.has(suit);

  return (
    <motion.div
      initial={{ opacity: 0, y: -14, rotateY: 90 }}
      animate={{ opacity: 1, y: 0, rotateY: 0 }}
      transition={{ duration: 0.3, delay: index * 0.08 }}
      className={cn(
        "flex h-16 w-11 shrink-0 flex-col items-center justify-between rounded-md border border-black/10 bg-gold-100 p-1 shadow-md sm:h-20 sm:w-14",
        isRed ? "text-crimson-600" : "text-noir-950",
      )}
    >
      <span className="self-start text-[10px] font-bold leading-none sm:text-xs">{rank}</span>
      <span className="text-lg leading-none sm:text-2xl">{SUIT_SYMBOL[suit]}</span>
      <span className="self-end rotate-180 text-[10px] font-bold leading-none sm:text-xs">{rank}</span>
    </motion.div>
  );
}
