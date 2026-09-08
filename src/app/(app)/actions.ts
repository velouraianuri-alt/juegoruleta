"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { callRpc } from "@/lib/supabase/rpc";

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export interface ClaimFreeChipsState {
  error?: string;
}

export async function claimFreeChipsAction(): Promise<ClaimFreeChipsState> {
  const supabase = await createClient();
  const { error } = await callRpc(supabase, "fn_claim_free_chips");

  if (error) {
    if (error.message.startsWith("free_chips_on_cooldown:")) {
      return { error: error.message.split(":").slice(1).join(":") };
    }
    return { error: "No se pudieron reclamar las fichas gratis." };
  }

  revalidatePath("/dashboard");
  return {};
}
