"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { callRpc } from "@/lib/supabase/rpc";
import { useOwnBalance } from "@/hooks/use-own-balance";
import { sound } from "@/lib/sound";
import { RouletteWheel } from "./roulette-wheel";
import { RouletteWheel3D } from "./wheel-3d/scene";
import { useWebglSupport } from "./wheel-3d/use-webgl-support";
import { CameraControls } from "./wheel-3d/camera-controls";
import type { CameraPresetId } from "./wheel-3d/camera-presets";
import { BettingGrid, type BetTotals } from "./betting-grid";
import { ChipSelector } from "./chip-selector";
import type { ChipDenomination } from "./chip-denominations";
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
  const revealedFor = useRef<string | null>(null);
  const webglSupported = useWebglSupport();
  const [cameraPreset, setCameraPreset] = useState<CameraPresetId>("classic");
  const [cameraResetToken, setCameraResetToken] = useState(0);

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
      setSpinToken((t) => t + 1);
    }
  }, [isSettled, result, round.id]);

  const myBets = bets.filter((b) => b.user_id === currentUserId);
  const myStake = myBets.reduce((sum, b) => sum + b.amount, 0);
  const myPayout = isSettled ? myBets.reduce((sum, b) => sum + (b.payout ?? 0), 0) : 0;
  const myNet = myPayout - myStake;

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

  useEffect(() => {
    if (isSettled && result) {
      const timer = setTimeout(() => {
        if (myNet > 0) sound.win();
        else if (myStake > 0) sound.lose();
      }, 4300);
      return () => clearTimeout(timer);
    }
  }, [isSettled, result, myNet, myStake]);

  return (
    <div className="flex w-full flex-col items-center gap-5">
      <div className="flex w-full items-center justify-between">
        <div>
          <p className="font-heading text-lg font-semibold text-gold-100">Ruleta europea</p>
          <p className="text-xs text-muted-foreground">
            {round.phase === "betting"
              ? `Apuestas abiertas · ${secondsLeft}s`
              : isSettled
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

      {webglSupported === false ? (
        <RouletteWheel spinToken={spinToken} winningNumber={result?.number ?? null} />
      ) : (
        <>
          <RouletteWheel3D
            spinToken={spinToken}
            winningNumber={result?.number ?? null}
            cameraPreset={cameraPreset}
            cameraResetToken={cameraResetToken}
          />
          <CameraControls
            preset={cameraPreset}
            onPresetChange={setCameraPreset}
            onReset={() => setCameraResetToken((t) => t + 1)}
          />
        </>
      )}

      {isSettled && result && (
        <div className="glass-panel flex w-full flex-col items-center gap-2 rounded-xl p-4 text-center">
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
          <ChipSelector value={chip} onChange={setChip} />

          <BettingGrid disabled={secondsLeft <= 0} onBet={onBet} totals={totals} />

          <div className="flex items-center gap-4 text-sm">
            <span className="text-muted-foreground">
              En juego: <span className="font-mono text-gold-200">{myStake.toLocaleString("es-ES")}</span>
            </span>
          </div>
        </>
      )}
    </div>
  );
}
