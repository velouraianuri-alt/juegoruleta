"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { callRpc } from "@/lib/supabase/rpc";
import type { Profile } from "@/lib/supabase/types";

export async function searchUsersAction(query: string): Promise<Profile[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const isUuid = /^[0-9a-f-]{8,}$/i.test(trimmed);
  const query_ = supabase.from("profiles").select("*").neq("id", user.id).limit(8);

  const { data } = isUuid
    ? await query_.or(`id.eq.${trimmed},username.ilike.%${trimmed}%`)
    : await query_.ilike("username", `%${trimmed}%`);

  return data ?? [];
}

export interface FriendActionState {
  error?: string;
  success?: boolean;
}

export async function sendFriendRequestAction(username: string): Promise<FriendActionState> {
  const supabase = await createClient();
  const { error } = await callRpc(supabase, "fn_send_friend_request", {
    p_target_username: username,
  });
  if (error) {
    return { error: error.message.includes("not found") ? "Usuario no encontrado" : error.message };
  }
  revalidatePath("/friends");
  return { success: true };
}

export async function respondFriendRequestAction(
  requestId: string,
  accept: boolean,
): Promise<FriendActionState> {
  const supabase = await createClient();
  const { error } = await callRpc(supabase, "fn_respond_friend_request", {
    p_request_id: requestId,
    p_accept: accept,
  });
  if (error) return { error: "No se pudo procesar la solicitud" };
  revalidatePath("/friends");
  return { success: true };
}

export async function removeFriendAction(friendId: string): Promise<FriendActionState> {
  const supabase = await createClient();
  const { error } = await callRpc(supabase, "fn_remove_friend", { p_friend_id: friendId });
  if (error) return { error: "No se pudo eliminar la amistad" };
  revalidatePath("/friends");
  return { success: true };
}
