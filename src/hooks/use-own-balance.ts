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

// Module-scoped so every useOwnBalance(userId) instance — the persistent app
// header's included — shares one hold state per user, not just whichever
// component happens to call setBalanceHold. A settle credits the payout to
// virtual_balance immediately, server-side, well before a game's own reveal
// animation finishes; without this, the balance ticking up anywhere the user
// can see it (not just the game's own result panel) gives the outcome away
// early. `pending` buffers whatever real value arrived while held, applied to
// every reader the moment the hold releases.
const held = new Map<string, boolean>();
const pending = new Map<string, number>();
const listeners = new Map<string, Set<() => void>>();

function notify(userId: string) {
  listeners.get(userId)?.forEach((fn) => fn());
}

/** Freeze (or release) every useOwnBalance(userId) reader's displayed value.
 * While held, new realtime/fetch values are buffered, not shown; releasing
 * immediately reveals the latest buffered value everywhere at once. */
export function setBalanceHold(userId: string, isHeld: boolean) {
  held.set(userId, isHeld);
  notify(userId);
}

export function useOwnBalance(userId: string, initial?: number) {
  const [balance, setBalance] = useState<number | null>(initial ?? null);
  const instanceId = useId();

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    const applyOrBuffer = (value: number) => {
      if (held.get(userId)) {
        pending.set(userId, value);
      } else {
        setBalance(value);
      }
    };

    supabase
      .from("profiles")
      .select("virtual_balance")
      .eq("id", userId)
      .single()
      .then(({ data }) => {
        if (active && data) applyOrBuffer(data.virtual_balance);
      });

    const channel = supabase
      .channel(`balance:${userId}:${instanceId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${userId}` },
        (payload) => {
          applyOrBuffer((payload.new as { virtual_balance: number }).virtual_balance);
        },
      )
      .subscribe();

    const onHoldChange = () => {
      if (held.get(userId)) return;
      // Deliberately not cleared here: every reader for this user (this
      // table's own display, the app header's, any other) gets its own
      // onHoldChange call from the same release, and each needs to read the
      // same buffered value independently — an earlier design deleted it
      // after the first reader consumed it, silently leaving every other
      // reader stuck on its pre-hold value. It's simply overwritten the next
      // time a real update arrives via applyOrBuffer, held or not.
      const value = pending.get(userId);
      if (value !== undefined) setBalance(value);
    };
    if (!listeners.has(userId)) listeners.set(userId, new Set());
    listeners.get(userId)!.add(onHoldChange);

    return () => {
      active = false;
      supabase.removeChannel(channel);
      listeners.get(userId)?.delete(onHoldChange);
    };
  }, [userId, instanceId]);

  return balance;
}
