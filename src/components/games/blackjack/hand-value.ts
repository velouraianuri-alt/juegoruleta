// Mirrors public.fn_bj_hand_value — display only, the real value is always
// computed server-side for payouts.
export function handValue(cards: string[]): number {
  let total = 0;
  let aces = 0;
  for (const card of cards) {
    const rank = card.slice(0, -1);
    if (rank === "A") {
      aces += 1;
      total += 11;
    } else if (["T", "J", "Q", "K"].includes(rank)) {
      total += 10;
    } else {
      total += Number(rank);
    }
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }
  return total;
}
