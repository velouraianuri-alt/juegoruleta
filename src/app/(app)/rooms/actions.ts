"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { callRpc } from "@/lib/supabase/rpc";
import type { GameType } from "@/lib/supabase/types";

export interface RoomActionState {
  error?: string;
}

export async function createRoomAction(
  _prevState: RoomActionState | undefined,
  formData: FormData,
): Promise<RoomActionState> {
  const name = String(formData.get("name") ?? "").trim();
  const maxPlayers = Number(formData.get("max_players") ?? 6);
  const games = formData.getAll("games") as GameType[];

  if (!name) return { error: "Ponle un nombre a la sala" };
  if (games.length === 0) return { error: "Elige al menos un juego" };

  const supabase = await createClient();
  const { data, error } = await callRpc(supabase, "fn_create_room", {
    p_name: name,
    p_max_players: maxPlayers,
    p_allowed_games: games,
  });

  if (error || !data) {
    return { error: "No se pudo crear la sala" };
  }

  redirect(`/rooms/${data.code}`);
}

export async function joinRoomAction(
  _prevState: RoomActionState | undefined,
  formData: FormData,
): Promise<RoomActionState> {
  const code = String(formData.get("code") ?? "").trim();
  if (!code) return { error: "Introduce un código de sala" };

  const supabase = await createClient();
  const { data, error } = await callRpc(supabase, "fn_join_room", { p_code: code });

  if (error || !data) {
    return { error: "Sala no encontrada, llena o cerrada" };
  }

  redirect(`/rooms/${data.code}`);
}
