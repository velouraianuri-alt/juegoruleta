"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { callRpc } from "@/lib/supabase/rpc";
import { useOwnBalance } from "@/hooks/use-own-balance";
import { sound } from "@/lib/sound";
import { RouletteWheel2D } from "./wheel-2d/wheel-canvas";
import { SpinSpeedToggle } from "./wheel-3d/spin-speed-toggle";
import { SPIN_DURATION_NORMAL_MS, SPIN_DURATION_FAST_MS } from "./wheel-2d/spin-physics-2d";
import { BettingGrid, type BetTotals } from "./betting-grid";
import { ChipSelector } from "./chip-selector";
import type { ChipDenomination } from "./chip-denominations";
import { BetActions } from "./bet-actions";
import { ResultsHistory } from "./results-history";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { GameRound, RouletteBet, RouletteBetType, RouletteResult } from "@/lib/supabase/types";

export function RouletteTable({
  round,
  roomId,
  currentUserId,
}: {
  round: GameRound;
  roomId: string;
  currentUserId: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const balance = useOwnBalance(currentUserId);
  const [bets, setBets] = useState<RouletteBet[]>([]);
  const [chip, setChip] = useState<ChipDenomination>(100);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [spinToken, setSpinToken] = useState(0);
  // Stays false for the whole spin animation — flips to true only once the wheel
  // itself confirms the ball has visually landed, so the result/payout can never
  // spoil itself before the spin actually finishes playing.
  const [revealReady, setRevealReady] = useState(false);
  const revealedFor = useRef<string | null>(null);
  // Starts false on both server and client's first render (matching, so hydration
  // doesn't warn) — the real stored preference is applied a moment later, once
  // mounted, since localStorage doesn't exist during SSR.
  const [quickSpin, setQuickSpin] = useState(false);

  useEffect(() => {
    // Deferred a tick, matching use-webgl-support.ts, so this reads as subscribing
    // to an external read's result rather than a synchronous setState-in-effect.
    queueMicrotask(() => {
      try {
        setQuickSpin(window.localStorage.getItem("prive-quick-spin") === "true");
      } catch {
        // ignore (private browsing etc.)
      }
    });
  }, []);

  const onQuickSpinChange = (value: boolean) => {
    setQuickSpin(value);
    try {
      window.localStorage.setItem("prive-quick-spin", String(value));
    } catch {
      // ignore (private browsing etc.)
    }
  };

  const isSettled = round.phase === "settled";
  const result = isSettled ? (round.result as RouletteResult | null) : null;

  // Fetch + subscribe to this round's bets.
  useEffect(() => {
    let active = true;
    supabase
      .from("roulette_bets")
      .select("*")
      .eq("round_id", round.id)
      .then(({ data }) => {
        if (active && data) setBets(data);
      });

    const channel = supabase
      .channel(`roulette-bets:${round.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "roulette_bets", filter: `round_id=eq.${round.id}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setBets((prev) => [...prev, payload.new as RouletteBet]);
          } else if (payload.eventType === "UPDATE") {
            const row = payload.new as RouletteBet;
            setBets((prev) => prev.map((b) => (b.id === row.id ? row : b)));
          } else if (payload.eventType === "DELETE") {
            // fn_cancel_roulette_bet / fn_clear_roulette_bets delete rows outright —
            // without this the cancelled bet stays "on the table" in every client's
            // local state until the next full refetch.
            const row = payload.old as { id: string };
            setBets((prev) => prev.filter((b) => b.id !== row.id));
          }
        },
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [round.id, supabase]);

  // Betting countdown.
  useEffect(() => {
    if (round.phase !== "betting" || !round.phase_ends_at) return;
    const end = new Date(round.phase_ends_at).getTime();
    const tick = () => setSecondsLeft(Math.max(0, Math.ceil((end - Date.now()) / 1000)));
    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [round.phase, round.phase_ends_at]);

  // Once the window closes, any client can settle — server rejects duplicates.
  // Retries every few seconds until the round actually moves out of 'betting'
  // (detected via the realtime-driven `round` prop, which stops this effect)
  // rather than a single fire-and-forget attempt, so one dropped/failed request
  // can't leave the round stuck forever with no visible error.
  useEffect(() => {
    if (round.phase !== "betting" || !round.phase_ends_at) return;
    const end = new Date(round.phase_ends_at).getTime();
    const initialDelay = Math.max(0, end - Date.now()) + 300;

    let interval: ReturnType<typeof setInterval> | undefined;
    const attempt = async () => {
      const { error } = await callRpc(supabase, "fn_settle_roulette_round", {
        p_round_id: round.id,
      });
      if (error) console.error("fn_settle_roulette_round failed:", error.message);
    };

    const timer = setTimeout(() => {
      void attempt();
      interval = setInterval(() => void attempt(), 3000);
    }, initialDelay);

    return () => {
      clearTimeout(timer);
      if (interval) clearInterval(interval);
    };
  }, [round.id, round.phase, round.phase_ends_at, supabase]);

  // Trigger the wheel reveal animation exactly once per settled round.
  useEffect(() => {
    if (isSettled && result && revealedFor.current !== round.id) {
      revealedFor.current = round.id;
      setRevealReady(false);
      setSpinToken((t) => t + 1);
    }
  }, [isSettled, result, round.id]);

  // Safety net: onSettled fires from a requestAnimationFrame loop, which browsers
  // pause while the tab is backgrounded — if the player switches away mid-spin,
  // rAF (and the reveal) would otherwise stay stalled until they come back. Force
  // the reveal open a few seconds past the spin's own duration regardless, so
  // "Nueva ronda" can never be permanently unreachable.
  useEffect(() => {
    if (spinToken === 0) return;
    const durationMs = quickSpin ? SPIN_DURATION_FAST_MS : SPIN_DURATION_NORMAL_MS;
    const timer = setTimeout(() => setRevealReady(true), durationMs + 3000);
    return () => clearTimeout(timer);
  }, [spinToken, quickSpin]);

  const myBets = bets.filter((b) => b.user_id === currentUserId);
  const myStake = myBets.reduce((sum, b) => sum + b.amount, 0);
  const myPayout = isSettled ? myBets.reduce((sum, b) => sum + (b.payout ?? 0), 0) : 0;
  const myNet = myPayout - myStake;

  // Snapshot of this round's bets, kept fresh every render so the round-transition
  // effect below can read the *outgoing* round's bets from its cleanup (an effect's
  // cleanup closure would otherwise only see whatever `bets` looked like when the
  // effect last ran, which is stale by the time the round actually changes).
  const myBetsRef = useRef<RouletteBet[]>(myBets);
  useEffect(() => {
    myBetsRef.current = myBets;
  }, [myBets]);

  // "Repetir" replays the bets from the room's previous round for this user —
  // captured right as the round transitions, before this round's own bets replace
  // them in `bets`.
  const [previousRoundBets, setPreviousRoundBets] = useState<RouletteBet[]>([]);
  useEffect(() => {
    return () => {
      setPreviousRoundBets(myBetsRef.current);
    };
  }, [round.id]);

  const totals: BetTotals = { straight: {}, outside: {} };
  for (const b of myBets) {
    if (b.bet_type === "straight" && b.bet_value) {
      const n = Number(b.bet_value);
      totals.straight[n] = (totals.straight[n] ?? 0) + b.amount;
    } else {
      const key = `${b.bet_type}:${b.bet_value ?? ""}`;
      totals.outside[key] = (totals.outside[key] ?? 0) + b.amount;
    }
  }

  const onBet = async (type: RouletteBetType, value: string | null) => {
    if (balance !== null && balance < chip) {
      toast.error("Fichas insuficientes");
      return;
    }
    sound.chip();
    const { error } = await callRpc(supabase, "fn_place_roulette_bet", {
      p_round_id: round.id,
      p_bet_type: type,
      p_bet_value: value,
      p_amount: chip,
    });
    if (error) toast.error("No se pudo colocar la apuesta");
  };

  const onNewRound = async () => {
    const { error } = await callRpc(supabase, "fn_start_roulette_round", { p_room_id: roomId });
    if (error) toast.error(error.message);
  };

  const onUndo = async () => {
    if (myBets.length === 0) return;
    const last = [...myBets].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )[0];
    const { error } = await callRpc(supabase, "fn_cancel_roulette_bet", { p_bet_id: last.id });
    if (error) toast.error("No se pudo deshacer la apuesta");
  };

  const onClearBets = async () => {
    if (myBets.length === 0) return;
    const { error } = await callRpc(supabase, "fn_clear_roulette_bets", { p_round_id: round.id });
    if (error) toast.error("No se pudo limpiar la mesa");
  };

  const replayBets = async (source: RouletteBet[]) => {
    if (source.length === 0) return;
    for (const b of source) {
      const { error } = await callRpc(supabase, "fn_place_roulette_bet", {
        p_round_id: round.id,
        p_bet_type: b.bet_type,
        p_bet_value: b.bet_value,
        p_amount: b.amount,
      });
      if (error) {
        toast.error("No se pudieron repetir todas las apuestas");
        return;
      }
    }
    sound.chip();
  };

  // Fires the instant revealReady flips true — i.e. exactly when the result panel
  // itself appears, not on a fixed timer that used to assume a single wheel duration.
  useEffect(() => {
    if (revealReady && isSettled && result) {
      if (myNet > 0) sound.win();
      else if (myStake > 0) sound.lose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealReady]);

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex w-full items-center justify-between">
        <div>
          <p className="font-heading text-lg font-semibold text-gold-100">Ruleta europea</p>
          <p className="text-xs text-muted-foreground">
            {round.phase === "betting"
              ? `Apuestas abiertas · ${secondsLeft}s`
              : isSettled && revealReady
                ? "Ronda resuelta"
                : "Girando..."}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Tu saldo</p>
          <p className="font-mono text-base font-semibold text-gold-200">
            {(balance ?? 0).toLocaleString("es-ES")}
          </p>
        </div>
      </div>

      {/* Wheel on the left, betting controls on the right from lg up — stacked
          below that. Keeps everything reachable without scrolling the game panel
          on a normal desktop window, instead of one long vertical column. */}
      <div className="grid w-full items-start gap-4 lg:grid-cols-[300px_1fr]">
        <div className="flex flex-col items-center gap-2">
          <RouletteWheel2D
            spinToken={spinToken}
            winningNumber={result?.number ?? null}
            durationMs={quickSpin ? SPIN_DURATION_FAST_MS : SPIN_DURATION_NORMAL_MS}
            onSettled={() => setRevealReady(true)}
          />
          <SpinSpeedToggle quick={quickSpin} onChange={onQuickSpinChange} />

          <ResultsHistory roomId={roomId} />
        </div>

        <div className="flex flex-col gap-2">
          {isSettled && result && revealReady && (
            <div className="glass-panel flex w-full flex-col items-center gap-2 rounded-xl p-3 text-center">
              <p className="text-sm text-muted-foreground">
                Salió el <span className="font-semibold text-gold-200">{result.number}</span>{" "}
                ({result.color === "red" ? "rojo" : result.color === "black" ? "negro" : "verde"})
              </p>
              {myStake > 0 && (
                <p className={cn("font-mono text-lg font-bold", myNet >= 0 ? "text-emerald-glow" : "text-crimson-400")}>
                  {myNet >= 0 ? "+" : ""}
                  {myNet.toLocaleString("es-ES")} fichas
                </p>
              )}
              <Button onClick={onNewRound} className="bg-gold-400 text-noir-950 hover:bg-gold-300">
                Nueva ronda
              </Button>
            </div>
          )}

          {round.phase === "betting" && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <ChipSelector value={chip} onChange={setChip} />
                <BetActions
                  disabled={secondsLeft <= 0}
                  hasCurrentBets={myBets.length > 0}
                  hasPreviousBets={previousRoundBets.length > 0}
                  onUndo={onUndo}
                  onClear={onClearBets}
                  onRepeat={() => replayBets(previousRoundBets)}
                  onDuplicate={() => replayBets(myBets)}
                />
              </div>

              <BettingGrid disabled={secondsLeft <= 0} onBet={onBet} totals={totals} />

              <div className="flex items-center gap-4 text-sm">
                <span className="text-muted-foreground">
                  En juego: <span className="font-mono text-gold-200">{myStake.toLocaleString("es-ES")}</span>
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
