"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { callRpc } from "@/lib/supabase/rpc";
import { useOwnBalance } from "@/hooks/use-own-balance";
import { sound } from "@/lib/sound";
import { PlayingCard } from "./playing-card";
import { handValue } from "./hand-value";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { BlackjackHand, GameRound, Profile, RoomPlayer } from "@/lib/supabase/types";

export function BlackjackTable({
  round,
  roomId,
  currentUserId,
  players,
  profiles,
}: {
  round: GameRound;
  roomId: string;
  currentUserId: string;
  players: RoomPlayer[];
  profiles: Map<string, Profile>;
}) {
  const supabase = useMemo(() => createClient(), []);
  const balance = useOwnBalance(currentUserId);
  const [hands, setHands] = useState<BlackjackHand[]>([]);
  const [betAmount, setBetAmount] = useState(100);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const dealAttempted = useRef<string | null>(null);
  const resolveAttempted = useRef<string | null>(null);

  const isSettled = round.phase === "settled";

  useEffect(() => {
    let active = true;
    supabase
      .from("blackjack_hands")
      .select("*")
      .eq("round_id", round.id)
      .then(({ data }) => {
        if (active && data) setHands(data);
      });

    const channel = supabase
      .channel(`bj-hands:${round.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "blackjack_hands", filter: `round_id=eq.${round.id}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setHands((prev) => [...prev, payload.new as BlackjackHand]);
          } else if (payload.eventType === "UPDATE") {
            const row = payload.new as BlackjackHand;
            setHands((prev) => prev.map((h) => (h.id === row.id ? row : h)));
          }
        },
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [round.id, supabase]);

  useEffect(() => {
    if (round.phase !== "betting" || !round.phase_ends_at) return;
    const end = new Date(round.phase_ends_at).getTime();
    const tick = () => setSecondsLeft(Math.max(0, Math.ceil((end - Date.now()) / 1000)));
    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [round.phase, round.phase_ends_at]);

  // Auto-deal once betting closes.
  useEffect(() => {
    if (round.phase !== "betting" || !round.phase_ends_at) return;
    if (dealAttempted.current === round.id) return;
    const end = new Date(round.phase_ends_at).getTime();
    const delay = Math.max(0, end - Date.now()) + 400;
    const timer = setTimeout(() => {
      dealAttempted.current = round.id;
      void callRpc(supabase, "fn_deal_blackjack", { p_round_id: round.id });
    }, delay);
    return () => clearTimeout(timer);
  }, [round.id, round.phase, round.phase_ends_at, supabase]);

  // Auto-resolve once it's the dealer's turn.
  useEffect(() => {
    if (round.phase !== "dealer_turn") return;
    if (resolveAttempted.current === round.id) return;
    resolveAttempted.current = round.id;
    const timer = setTimeout(() => {
      void callRpc(supabase, "fn_resolve_blackjack_round", { p_round_id: round.id });
    }, 900);
    return () => clearTimeout(timer);
  }, [round.id, round.phase, supabase]);

  useEffect(() => {
    if (isSettled) {
      const mine = hands.filter((h) => h.user_id === currentUserId);
      const net = mine.reduce((sum, h) => sum + (h.payout ?? 0) - h.bet_amount, 0);
      if (mine.length) {
        const timer = setTimeout(() => (net >= 0 ? sound.win() : sound.lose()), 200);
        return () => clearTimeout(timer);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSettled]);

  const myHands = hands.filter((h) => h.user_id === currentUserId);
  const hasBet = myHands.length > 0;
  const activeHand = hands.find((h) => h.id === round.current_turn_hand_id);
  const isMyTurn = round.phase === "player_turn" && activeHand?.user_id === currentUserId;

  const otherPlayers = players.filter((p) => p.user_id !== currentUserId);

  const onPlaceBet = async () => {
    if (balance !== null && balance < betAmount) {
      toast.error("Fichas insuficientes");
      return;
    }
    sound.chip();
    const { error } = await callRpc(supabase, "fn_place_blackjack_bet", {
      p_round_id: round.id,
      p_amount: betAmount,
    });
    if (error) toast.error("No se pudo apostar");
  };

  const act = async (action: "hit" | "stand" | "double" | "split") => {
    if (!activeHand) return;
    sound.cardFlip();
    const fn =
      action === "hit"
        ? "fn_blackjack_hit"
        : action === "stand"
          ? "fn_blackjack_stand"
          : action === "double"
            ? "fn_blackjack_double"
            : "fn_blackjack_split";
    const { error } = await callRpc(supabase, fn, { p_hand_id: activeHand.id });
    if (error) toast.error(error.message);
  };

  const onNewRound = async () => {
    const { error } = await callRpc(supabase, "fn_start_blackjack_round", { p_room_id: roomId });
    if (error) toast.error(error.message);
  };

  const canDouble = isMyTurn && activeHand && activeHand.cards.length === 2;
  const canSplit =
    isMyTurn &&
    activeHand &&
    activeHand.cards.length === 2 &&
    activeHand.cards[0].slice(0, -1) === activeHand.cards[1].slice(0, -1) &&
    hands.filter((h) => h.user_id === currentUserId).length < 3;

  const dealerValue = handValue(round.dealer_hand);

  return (
    <div className="flex w-full flex-col items-center gap-5">
      <div className="flex w-full items-center justify-between">
        <div>
          <p className="font-heading text-lg font-semibold text-gold-100">Blackjack</p>
          <p className="text-xs text-muted-foreground">
            {round.phase === "betting"
              ? `Apuestas abiertas · ${secondsLeft}s`
              : round.phase === "player_turn"
                ? isMyTurn
                  ? "Tu turno"
                  : `Turno de ${profiles.get(activeHand?.user_id ?? "")?.username ?? "..."}`
                : round.phase === "dealer_turn"
                  ? "Turno del dealer"
                  : "Ronda resuelta"}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Tu saldo</p>
          <p className="font-mono text-base font-semibold text-gold-200">
            {(balance ?? 0).toLocaleString("es-ES")}
          </p>
        </div>
      </div>

      <div className="flex flex-col items-center gap-1.5">
        <p className="text-xs text-muted-foreground">
          Dealer{" "}
          {round.dealer_hand.length > 0 && round.phase !== "betting" && (
            <span className="font-mono text-gold-300">
              {round.phase === "player_turn" ? round.dealer_hand.length : dealerValue}
            </span>
          )}
        </p>
        <div className="flex gap-1.5">
          {round.dealer_hand.map((c, i) => (
            <PlayingCard key={i} code={c} index={i} />
          ))}
          {round.phase === "player_turn" && <PlayingCard code={null} faceDown index={1} />}
        </div>
      </div>

      <div className="flex w-full flex-wrap items-start justify-center gap-4">
        {otherPlayers.map((p) => {
          const theirHands = hands.filter((h) => h.user_id === p.user_id && h.parent_hand_id === null);
          if (!theirHands.length) return null;
          return (
            <PlayerHands
              key={p.user_id}
              username={profiles.get(p.user_id)?.username ?? "..."}
              hands={hands.filter((h) => h.user_id === p.user_id)}
              currentTurnId={round.current_turn_hand_id}
            />
          );
        })}

        {hasBet && (
          <PlayerHands
            username="Tú"
            hands={hands.filter((h) => h.user_id === currentUserId)}
            currentTurnId={round.current_turn_hand_id}
            highlight
          />
        )}
      </div>

      {round.phase === "betting" && !hasBet && (
        <div className="glass-panel flex flex-col items-center gap-3 rounded-xl p-4">
          <p className="text-sm text-gold-200">Coloca tu apuesta</p>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={betAmount}
              onChange={(e) => setBetAmount(Number(e.target.value))}
              min={10}
              className="w-28 text-center font-mono"
            />
            <Button onClick={onPlaceBet} className="bg-gold-400 text-noir-950 hover:bg-gold-300">
              Apostar
            </Button>
          </div>
        </div>
      )}

      {round.phase === "betting" && hasBet && (
        <p className="text-sm text-muted-foreground">Esperando al resto de jugadores...</p>
      )}

      {isMyTurn && (
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={() => act("hit")} className="bg-gold-400/15 text-gold-200 hover:bg-gold-400/25">
            Pedir
          </Button>
          <Button onClick={() => act("stand")} className="bg-gold-400/15 text-gold-200 hover:bg-gold-400/25">
            Plantarse
          </Button>
          <Button
            onClick={() => act("double")}
            disabled={!canDouble}
            className="bg-gold-400/15 text-gold-200 hover:bg-gold-400/25 disabled:opacity-40"
          >
            Doblar
          </Button>
          <Button
            onClick={() => act("split")}
            disabled={!canSplit}
            className="bg-gold-400/15 text-gold-200 hover:bg-gold-400/25 disabled:opacity-40"
          >
            Dividir
          </Button>
        </div>
      )}

      {isSettled && (
        <Button onClick={onNewRound} className="bg-gold-400 text-noir-950 hover:bg-gold-300">
          Nueva ronda
        </Button>
      )}
    </div>
  );
}

function PlayerHands({
  username,
  hands,
  currentTurnId,
  highlight,
}: {
  username: string;
  hands: BlackjackHand[];
  currentTurnId: string | null;
  highlight?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <p className={cn("text-xs", highlight ? "text-gold-200" : "text-muted-foreground")}>{username}</p>
      <div className="flex gap-3">
        {hands.map((hand) => (
          <div
            key={hand.id}
            className={cn(
              "flex flex-col items-center gap-1 rounded-lg p-1.5",
              hand.id === currentTurnId && "bg-gold-400/10 ring-1 ring-gold-400/50",
            )}
          >
            <div className="flex gap-1">
              {hand.cards.map((c, i) => (
                <PlayingCard key={i} code={c} index={i} />
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground">
              {handValue(hand.cards)}
              {hand.status === "bust" && " · Bust"}
              {hand.status === "blackjack" && " · Blackjack!"}
              {hand.payout != null && ` · ${hand.payout >= hand.bet_amount ? "+" : ""}${hand.payout - hand.bet_amount}`}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
