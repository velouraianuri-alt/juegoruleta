// Shared chip palette + helpers for the chip stack (on-table bet markers) and the
// chip selector (bet-size picker) — kept in one place so both always agree on
// denominations and colors. Loosely follows real casino chip-color convention
// (white/green/blue/black/purple/orange/pink climbing in value) so the stacks
// read at a glance.
export const CHIP_DENOMINATIONS = [10, 25, 50, 100, 500, 1000, 5000] as const;
export type ChipDenomination = (typeof CHIP_DENOMINATIONS)[number];

export const CHIP_COLORS: Record<ChipDenomination, { base: string; edge: string; text: string }> = {
  10: { base: "#f2ede1", edge: "#b9b098", text: "#1c1a16" },
  25: { base: "#1f7a4d", edge: "#0f4c2c", text: "#f2ede1" },
  50: { base: "#2b6cb0", edge: "#173f6b", text: "#f2ede1" },
  100: { base: "#161616", edge: "#3a3a3a", text: "#d4af37" },
  500: { base: "#7c3aed", edge: "#4c1d95", text: "#f2ede1" },
  1000: { base: "#c2622a", edge: "#7a3814", text: "#f2ede1" },
  5000: { base: "#be123c", edge: "#7f0e2b", text: "#f2ede1" },
};

/** Largest denomination at or under `amount`, used to color a bet's chip stack. */
export function largestChipFor(amount: number): ChipDenomination {
  for (let i = CHIP_DENOMINATIONS.length - 1; i >= 0; i--) {
    if (amount >= CHIP_DENOMINATIONS[i]) return CHIP_DENOMINATIONS[i];
  }
  return CHIP_DENOMINATIONS[0];
}

export function formatChipAmount(amount: number): string {
  return amount >= 1000 ? `${Math.round(amount / 100) / 10}k` : String(amount);
}
