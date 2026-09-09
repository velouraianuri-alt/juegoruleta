import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { handValue } from "@/components/games/blackjack/hand-value";
import { cn } from "@/lib/utils";
import type { GameRound, Profile, RouletteBetType } from "@/lib/supabase/types";

export const metadata: Metadata = { title: "Historial — Privé" };
export const dynamic = "force-dynamic";

const BET_LABEL: Record<RouletteBetType, (value: string | null) => string> = {
  straight: (v) => `Pleno ${v}`,
  split: (v) => `División ${v?.replace(",", "-")}`,
  corner: (v) => `Esquina ${v?.replace(/,/g, "-")}`,
  red: () => "Rojo",
  black: () => "Negro",
  odd: () => "Impar",
  even: () => "Par",
  low: () => "1–18",
  high: () => "19–36",
  dozen: (v) => `${v}ª docena`,
  column: (v) => `Columna ${v}`,
};

interface HistoryRow {
  id: string;
  createdAt: string;
  game: "roulette" | "blackjack";
  description: string;
  resultLabel: string;
  stake: number;
  payout: number;
}

export default async function HistoryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, { data: rBets }, { data: bHands }, { data: transactions }] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single<Profile>(),
      supabase
        .from("roulette_bets")
        .select("*")
        .eq("user_id", user.id)
        .not("payout", "is", null)
        .order("created_at", { ascending: false })
        .limit(25),
      supabase
        .from("blackjack_hands")
        .select("*")
        .eq("user_id", user.id)
        .not("payout", "is", null)
        .order("created_at", { ascending: false })
        .limit(25),
      supabase
        .from("wallet_transactions")
        .select("*")
        .eq("user_id", user.id)
        .in("reason", ["bet", "payout"])
        .limit(500),
    ]);

  const roundIds = Array.from(
    new Set([...(rBets ?? []).map((b) => b.round_id), ...(bHands ?? []).map((h) => h.round_id)]),
  );
  const { data: rounds } = roundIds.length
    ? await supabase.from("game_rounds").select("*").in("id", roundIds)
    : { data: [] as GameRound[] };
  const roundById = new Map((rounds ?? []).map((r) => [r.id, r]));

  const rows: HistoryRow[] = [];

  for (const bet of rBets ?? []) {
    const round = roundById.get(bet.round_id);
    const result = round?.result as { number: number; color: string } | null | undefined;
    rows.push({
      id: bet.id,
      createdAt: bet.created_at,
      game: "roulette",
      description: BET_LABEL[bet.bet_type](bet.bet_value),
      resultLabel: result ? `${result.number} (${result.color === "red" ? "rojo" : result.color === "black" ? "negro" : "verde"})` : "—",
      stake: bet.amount,
      payout: bet.payout ?? 0,
    });
  }

  for (const hand of bHands ?? []) {
    const round = roundById.get(hand.round_id);
    const dealerValue = round ? handValue(round.dealer_hand) : null;
    rows.push({
      id: hand.id,
      createdAt: hand.created_at,
      game: "blackjack",
      description: `Apuesta ${hand.bet_amount.toLocaleString("es-ES")}`,
      resultLabel:
        hand.status === "bust"
          ? "Bust"
          : hand.status === "blackjack"
            ? "¡Blackjack!"
            : dealerValue !== null
              ? `Tu ${handValue(hand.cards)} vs dealer ${dealerValue}`
              : "—",
      stake: hand.bet_amount,
      payout: hand.payout ?? 0,
    });
  }

  rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  const totalStaked = (transactions ?? [])
    .filter((t) => t.reason === "bet")
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const totalWon = (transactions ?? [])
    .filter((t) => t.reason === "payout")
    .reduce((sum, t) => sum + t.amount, 0);
  const netResult = totalWon - totalStaked;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-gold-100">Historial</h1>
        <p className="text-sm text-muted-foreground">Todas tus partidas de ruleta y blackjack.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Partidas" value={profile?.games_played ?? 0} />
        <Stat label="Victorias" value={profile?.games_won ?? 0} />
        <Stat label="Mejor racha" value={profile?.best_streak ?? 0} />
        <Stat
          label="Balance neto"
          value={`${netResult >= 0 ? "+" : ""}${netResult.toLocaleString("es-ES")}`}
          tone={netResult >= 0 ? "positive" : "negative"}
        />
      </div>

      <div className="glass-panel divide-y divide-white/5 rounded-2xl">
        {rows.length === 0 && (
          <p className="p-6 text-center text-sm text-muted-foreground">
            Todavía no has jugado ninguna partida.
          </p>
        )}
        {rows.map((row) => {
          const net = row.payout - row.stake;
          return (
            <div key={row.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="text-lg">{row.game === "roulette" ? "🎰" : "🃏"}</span>
                <div>
                  <p className="text-sm text-gold-100">{row.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {row.resultLabel} · {new Date(row.createdAt).toLocaleString("es-ES")}
                  </p>
                </div>
              </div>
              <span
                className={cn(
                  "font-mono text-sm font-semibold",
                  net >= 0 ? "text-emerald-glow" : "text-crimson-400",
                )}
              >
                {net >= 0 ? "+" : ""}
                {net.toLocaleString("es-ES")}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone?: "positive" | "negative";
}) {
  return (
    <div className="glass-panel flex flex-col items-center gap-1 rounded-2xl p-4 text-center">
      <p
        className={cn(
          "font-mono text-lg font-semibold",
          tone === "positive" && "text-emerald-glow",
          tone === "negative" && "text-crimson-400",
          !tone && "text-gold-100",
        )}
      >
        {value}
      </p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
