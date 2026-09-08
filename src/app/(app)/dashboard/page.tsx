import Link from "next/link";
import type { Metadata } from "next";
import { Dices, DoorOpen, UsersRound, Sparkles, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { FreeChipsButton } from "@/components/app/free-chips-button";
import type { Profile, Room } from "@/lib/supabase/types";

export const metadata: Metadata = { title: "Dashboard — Privé" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, { count: friendCount }, { data: myRooms }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single<Profile>(),
    supabase
      .from("friend_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "accepted")
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`),
    supabase
      .from("room_players")
      .select("room:rooms(*)")
      .eq("user_id", user.id)
      .eq("status", "joined")
      .neq("room.status", "closed")
      .limit(5),
  ]);

  const activeRooms = ((myRooms ?? []) as unknown as { room: Room | null }[])
    .map((r) => r.room)
    .filter((r): r is Room => r !== null && r.status !== "closed");

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-3xl font-bold text-gold-gradient">
          Bienvenido, {profile?.username}
        </h1>
        <p className="text-muted-foreground">
          Tienes{" "}
          <span className="font-mono font-semibold text-gold-300">
            {profile?.virtual_balance.toLocaleString("es-ES")}
          </span>{" "}
          fichas virtuales.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link
          href="/rooms?game=roulette"
          className="glass-panel group flex items-center gap-4 rounded-2xl p-5 transition-transform hover:-translate-y-0.5"
        >
          <div className="flex size-14 items-center justify-center rounded-xl bg-crimson-500/15 text-3xl">
            🎰
          </div>
          <div className="flex-1">
            <p className="font-heading text-lg font-semibold text-gold-100">Ruleta</p>
            <p className="text-sm text-muted-foreground">Ruleta europea, mesa en vivo</p>
          </div>
          <ArrowRight className="size-5 text-gold-400 opacity-0 transition-opacity group-hover:opacity-100" />
        </Link>

        <Link
          href="/rooms?game=blackjack"
          className="glass-panel group flex items-center gap-4 rounded-2xl p-5 transition-transform hover:-translate-y-0.5"
        >
          <div className="flex size-14 items-center justify-center rounded-xl bg-felt-500/25 text-3xl">
            🃏
          </div>
          <div className="flex-1">
            <p className="font-heading text-lg font-semibold text-gold-100">Blackjack</p>
            <p className="text-sm text-muted-foreground">Mesa de blackjack, hit or stand</p>
          </div>
          <ArrowRight className="size-5 text-gold-400 opacity-0 transition-opacity group-hover:opacity-100" />
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="glass-panel flex flex-col gap-3 rounded-2xl p-5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <UsersRound className="size-4 text-gold-400" /> Amigos
          </div>
          <p className="font-heading text-2xl font-semibold text-gold-100">{friendCount ?? 0}</p>
          <Button asChild variant="ghost" size="sm" className="justify-start px-0 text-gold-300">
            <Link href="/friends">Ver amigos</Link>
          </Button>
        </div>

        <div className="glass-panel flex flex-col gap-3 rounded-2xl p-5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <DoorOpen className="size-4 text-gold-400" /> Salas activas
          </div>
          <p className="font-heading text-2xl font-semibold text-gold-100">{activeRooms.length}</p>
          <Button asChild variant="ghost" size="sm" className="justify-start px-0 text-gold-300">
            <Link href="/rooms">Ver salas</Link>
          </Button>
        </div>

        <div className="glass-panel flex flex-col gap-3 rounded-2xl p-5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="size-4 text-gold-400" /> Fichas gratis
          </div>
          <p className="text-sm text-muted-foreground">
            Recibe 5.000 fichas gratis cada 4 horas si te quedas corto.
          </p>
          <FreeChipsButton lastClaimAt={profile?.last_free_chips_at ?? null} />
        </div>
      </div>

      {activeRooms.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="font-heading text-lg font-semibold text-gold-100">Tus salas</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {activeRooms.map((room) => (
              <Link
                key={room.id}
                href={`/rooms/${room.code}`}
                className="glass-panel flex items-center justify-between rounded-xl p-4 hover:bg-white/5"
              >
                <div>
                  <p className="font-medium text-gold-100">{room.name}</p>
                  <p className="text-xs text-muted-foreground">Código {room.code}</p>
                </div>
                <span className="rounded-full bg-gold-400/15 px-2.5 py-1 text-xs text-gold-300">
                  {room.status === "playing" ? "En juego" : "Esperando"}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="glass-panel flex flex-col items-center gap-4 rounded-2xl p-6 text-center sm:flex-row sm:justify-between sm:text-left">
        <div>
          <p className="font-heading text-lg font-semibold text-gold-100">
            ¿Listo para jugar con amigos?
          </p>
          <p className="text-sm text-muted-foreground">
            Crea una sala privada o únete con un código.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" className="hairline-gold border text-gold-200">
            <Link href="/rooms">Unirse a sala</Link>
          </Button>
          <Button asChild className="bg-gold-400 text-noir-950 hover:bg-gold-300">
            <Link href="/rooms?create=1">
              <Dices className="mr-1 size-4" /> Crear sala
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
