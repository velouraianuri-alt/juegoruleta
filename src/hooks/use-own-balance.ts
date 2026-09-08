"use client";

import { useEffect, useId, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Live virtual_balance for the current user, kept in sync via Realtime.
 * Several components (header, active game table) can use this for the same
 * user at once — the browser Supabase client is a singleton, so each call
 * needs its own uniquely-named channel or the second `.subscribe()` errors
 * with "cannot add postgres_changes callbacks ... after subscribe()".
 */
export function useOwnBalance(userId: string, initial?: number) {
  const [balance, setBalance] = useState<number | null>(initial ?? null);
  const instanceId = useId();

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
      .channel(`balance:${userId}:${instanceId}`)
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
  }, [userId, instanceId]);

  return balance;
}
