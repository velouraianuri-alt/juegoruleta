import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { RoomClient } from "@/components/rooms/room-client";
import type { Profile, Room, RoomPlayer } from "@/lib/supabase/types";

export async function generateMetadata(props: PageProps<"/rooms/[code]">): Promise<Metadata> {
  const { code } = await props.params;
  return { title: `Sala ${code.toUpperCase()} — Privé` };
}

export const dynamic = "force-dynamic";

export default async function RoomPage(props: PageProps<"/rooms/[code]">) {
  const { code } = await props.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: room } = await supabase
    .from("rooms")
    .select("*")
    .eq("code", code.toUpperCase())
    .single<Room>();

  if (!room) notFound();

  const { data: players } = await supabase
    .from("room_players")
    .select("*")
    .eq("room_id", room.id);

  const isMember = (players ?? []).some((p) => p.user_id === user.id && p.status === "joined");
  if (!isMember) redirect("/rooms");

  const playerIds = (players ?? []).map((p) => p.user_id);
  const { data: profiles } = playerIds.length
    ? await supabase.from("profiles").select("*").in("id", playerIds)
    : { data: [] as Profile[] };

  const { data: messages } = await supabase
    .from("room_messages")
    .select("*")
    .eq("room_id", room.id)
    .order("created_at", { ascending: true })
    .limit(50);

  const { data: activeRound } = await supabase
    .from("game_rounds")
    .select("*")
    .eq("room_id", room.id)
    .not("phase", "in", "(settled,cancelled)")
    .limit(1)
    .maybeSingle();

  return (
    <RoomClient
      room={room}
      initialPlayers={(players ?? []) as RoomPlayer[]}
      initialProfiles={(profiles ?? []) as Profile[]}
      initialMessages={messages ?? []}
      initialRound={activeRound}
      currentUserId={user.id}
    />
  );
}
