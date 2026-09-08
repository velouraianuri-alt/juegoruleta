"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/** Live virtual_balance for the current user, kept in sync via Realtime. */
export function useOwnBalance(userId: string, initial?: number) {
  const [balance, setBalance] = useState<number | null>(initial ?? null);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    supabase
      .from("profiles")
      .select("virtual_balance")
      .eq("id", userId)
      .single()
      .then(({ data }) => {
        if (active && data) setBalance(data.virtual_balance);
      });

    const channel = supabase
      .channel(`balance:${userId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${userId}` },
        (payload) => {
          setBalance((payload.new as { virtual_balance: number }).virtual_balance);
        },
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return balance;
}
