import type { Metadata } from "next";
import Link from "next/link";
import { Trophy, Flame, Coins } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import type { Profile } from "@/lib/supabase/types";

export const metadata: Metadata = { title: "Ranking — Privé" };
export const dynamic = "force-dynamic";

const SORTS = [
  { key: "balance", label: "Fichas", icon: Coins, column: "virtual_balance" as const },
  { key: "wins", label: "Victorias", icon: Trophy, column: "games_won" as const },
  { key: "streak", label: "Mejor racha", icon: Flame, column: "best_streak" as const },
];

export default async function LeaderboardPage(props: PageProps<"/leaderboard">) {
  const searchParams = await props.searchParams;
  const scope = searchParams.scope === "friends" ? "friends" : "all";
  const sortKey = typeof searchParams.sort === "string" ? searchParams.sort : "balance";
  const sort = SORTS.find((s) => s.key === sortKey) ?? SORTS[0];

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  let profiles: Profile[] = [];

  if (scope === "friends") {
    const { data: relations } = await supabase
      .from("friend_requests")
      .select("*")
      .eq("status", "accepted")
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`);
    const friendIds = (relations ?? []).map((r) =>
      r.sender_id === user.id ? r.receiver_id : r.sender_id,
    );
    const ids = [...friendIds, user.id];
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .in("id", ids)
      .order(sort.column, { ascending: false });
    profiles = data ?? [];
  } else {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .order(sort.column, { ascending: false })
      .limit(50);
    profiles = data ?? [];
  }

  const medal = (i: number) => (i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : null);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-gold-100">Ranking</h1>
        <p className="text-sm text-muted-foreground">Compite con tus amigos, todo en fichas virtuales.</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="glass-panel flex gap-1 rounded-full p-1">
          {(["all", "friends"] as const).map((s) => (
            <Link
              key={s}
              href={`/leaderboard?scope=${s}&sort=${sort.key}`}
              className={cn(
                "rounded-full px-3 py-1.5 text-sm transition-colors",
                scope === s ? "bg-gold-400/20 text-gold-200" : "text-muted-foreground hover:text-gold-200",
              )}
            >
              {s === "all" ? "Todos" : "Mis amigos"}
            </Link>
          ))}
        </div>
        <div className="glass-panel flex gap-1 rounded-full p-1">
          {SORTS.map((s) => (
            <Link
              key={s.key}
              href={`/leaderboard?scope=${scope}&sort=${s.key}`}
              className={cn(
                "flex items-center gap-1 rounded-full px-3 py-1.5 text-xs transition-colors",
                sort.key === s.key ? "bg-gold-400/20 text-gold-200" : "text-muted-foreground hover:text-gold-200",
              )}
            >
              <s.icon className="size-3.5" /> {s.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="glass-panel divide-y divide-white/5 rounded-2xl">
        {profiles.length === 0 && (
          <p className="p-6 text-center text-sm text-muted-foreground">
            {scope === "friends" ? "Añade amigos para ver el ranking." : "Aún no hay jugadores."}
          </p>
        )}
        {profiles.map((p, i) => (
          <div
            key={p.id}
            className={cn(
              "flex items-center gap-3 px-4 py-3",
              p.id === user.id && "bg-gold-400/5",
            )}
          >
            <span className="w-6 text-center text-sm font-semibold text-muted-foreground">
              {medal(i) ?? i + 1}
            </span>
            <div className="flex size-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-lg">
              {p.avatar_url ?? "🎩"}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gold-100">
                {p.username} {p.id === user.id && <span className="text-xs text-muted-foreground">(tú)</span>}
              </p>
              <p className="text-xs text-muted-foreground">
                {p.games_won} victorias · {p.games_played} partidas
              </p>
            </div>
            <p className="font-mono text-sm font-semibold text-gold-200">
              {sort.key === "balance"
                ? p.virtual_balance.toLocaleString("es-ES")
                : sort.key === "wins"
                  ? p.games_won
                  : p.best_streak}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
