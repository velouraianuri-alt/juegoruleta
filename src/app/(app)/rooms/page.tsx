import type { Metadata } from "next";
import Link from "next/link";
import { DoorOpen } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { CreateRoomDialog } from "@/components/rooms/create-room-dialog";
import { JoinRoomDialog } from "@/components/rooms/join-room-dialog";
import type { Room } from "@/lib/supabase/types";

export const metadata: Metadata = { title: "Salas — Privé" };
export const dynamic = "force-dynamic";

export default async function RoomsPage(props: PageProps<"/rooms">) {
  const searchParams = await props.searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: myRoomPlayers } = await supabase
    .from("room_players")
    .select("room:rooms(*)")
    .eq("user_id", user.id)
    .eq("status", "joined");

  const rooms = ((myRoomPlayers ?? []) as unknown as { room: Room | null }[])
    .map((r) => r.room)
    .filter((r): r is Room => r !== null && r.status !== "closed")
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

  const defaultOpen = searchParams.create === "1";
  const defaultGame = typeof searchParams.game === "string" ? searchParams.game : undefined;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-heading text-2xl font-bold text-gold-100">Salas</h1>
          <p className="text-sm text-muted-foreground">
            Crea una sala privada o únete con el código de un amigo.
          </p>
        </div>
        <div className="flex gap-2">
          <JoinRoomDialog />
          <CreateRoomDialog defaultOpen={defaultOpen} defaultGame={defaultGame} />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {rooms.length === 0 && (
          <div className="glass-panel flex flex-col items-center gap-2 rounded-2xl p-10 text-center">
            <DoorOpen className="size-8 text-gold-400" />
            <p className="text-sm text-muted-foreground">
              No estás en ninguna sala todavía. Crea una o únete con un código.
            </p>
          </div>
        )}
        {rooms.map((room) => (
          <Link
            key={room.id}
            href={`/rooms/${room.code}`}
            className="glass-panel flex items-center justify-between rounded-xl p-4 hover:bg-white/5"
          >
            <div>
              <p className="font-medium text-gold-100">{room.name}</p>
              <p className="font-mono text-xs text-muted-foreground">
                Código {room.code} · máx {room.max_players} jugadores
              </p>
            </div>
            <span className="rounded-full bg-gold-400/15 px-2.5 py-1 text-xs text-gold-300">
              {room.status === "playing" ? "En juego" : "Esperando"}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
