import type { Metadata } from "next";
import Link from "next/link";
import { Coins, Trophy, Flame, Gamepad2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { EditProfileDialog } from "@/components/profile/edit-profile-dialog";
import type { Profile, WalletTransaction } from "@/lib/supabase/types";

export const metadata: Metadata = { title: "Perfil — Privé" };
export const dynamic = "force-dynamic";

const REASON_LABEL: Record<WalletTransaction["reason"], string> = {
  initial: "Bienvenida",
  bet: "Apuesta",
  payout: "Premio",
  free_chips: "Fichas gratis",
};

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, { data: transactions }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single<Profile>(),
    supabase
      .from("wallet_transactions")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  if (!profile) return null;

  const winRate =
    profile.games_played > 0
      ? Math.round((profile.games_won / profile.games_played) * 100)
      : 0;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <div className="glass-panel flex flex-col items-center gap-4 rounded-2xl p-6 text-center sm:flex-row sm:text-left">
        <div className="flex size-20 items-center justify-center rounded-full border border-gold-400/30 bg-gold-400/10 text-4xl">
          {profile.avatar_url ?? "🎩"}
        </div>
        <div className="flex-1">
          <h1 className="font-heading text-2xl font-bold text-gold-100">
            {profile.username}
          </h1>
          <p className="font-mono text-xs text-muted-foreground">ID {profile.id.slice(0, 8)}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Miembro desde {new Date(profile.created_at).toLocaleDateString("es-ES")}
          </p>
        </div>
        <EditProfileDialog profile={profile} />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile icon={Coins} label="Fichas" value={profile.virtual_balance.toLocaleString("es-ES")} />
        <StatTile icon={Gamepad2} label="Partidas" value={profile.games_played} />
        <StatTile icon={Trophy} label="Victorias" value={`${profile.games_won} (${winRate}%)`} />
        <StatTile icon={Flame} label="Mejor racha" value={profile.best_streak} />
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold text-gold-100">Actividad reciente</h2>
          <Link href="/history" className="text-sm text-gold-300 hover:text-gold-200">
            Ver historial completo
          </Link>
        </div>

        <div className="glass-panel divide-y divide-white/5 rounded-2xl">
          {!transactions?.length && (
            <p className="p-5 text-sm text-muted-foreground">Aún no hay actividad.</p>
          )}
          {transactions?.map((tx) => (
            <div key={tx.id} className="flex items-center justify-between px-5 py-3 text-sm">
              <div>
                <p className="text-gold-100">{REASON_LABEL[tx.reason]}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(tx.created_at).toLocaleString("es-ES")}
                </p>
              </div>
              <span
                className={
                  tx.amount >= 0
                    ? "font-mono font-medium text-emerald-glow"
                    : "font-mono font-medium text-crimson-400"
                }
              >
                {tx.amount >= 0 ? "+" : ""}
                {tx.amount.toLocaleString("es-ES")}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
}) {
  return (
    <div className="glass-panel flex flex-col items-center gap-1.5 rounded-2xl p-4 text-center">
      <Icon className="size-5 text-gold-400" />
      <p className="font-mono text-lg font-semibold text-gold-100">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
