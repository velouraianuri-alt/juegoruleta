"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Copy,
  LogOut,
  Circle,
  Check,
  Play,
  Square,
  Send,
  Crown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { createClient } from "@/lib/supabase/client";
import { callRpc } from "@/lib/supabase/rpc";
import { useOnlinePresence } from "@/hooks/use-online-presence";
import { RouletteTable } from "@/components/games/roulette/roulette-table";
import { BlackjackTable } from "@/components/games/blackjack/blackjack-table";
import type {
  GameRound,
  GameType,
  Profile,
  Room,
  RoomMessage,
  RoomPlayer,
} from "@/lib/supabase/types";

export function RoomClient({
  room: initialRoom,
  initialPlayers,
  initialProfiles,
  initialMessages,
  initialRound,
  currentUserId,
}: {
  room: Room;
  initialPlayers: RoomPlayer[];
  initialProfiles: Profile[];
  initialMessages: RoomMessage[];
  initialRound: GameRound | null;
  currentUserId: string;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const online = useOnlinePresence(currentUserId);

  const [room, setRoom] = useState(initialRoom);
  const [players, setPlayers] = useState(initialPlayers);
  const [profiles, setProfiles] = useState(new Map(initialProfiles.map((p) => [p.id, p])));
  const [messages, setMessages] = useState(initialMessages);
  const [round, setRound] = useState<GameRound | null>(initialRound);
  const [chatInput, setChatInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  const isOwner = room.owner_id === currentUserId;
  const activePlayers = players.filter((p) => p.status === "joined");

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const channel = supabase
      .channel(`room:${room.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rooms", filter: `id=eq.${room.id}` },
        (payload) => {
          if (payload.eventType === "UPDATE") setRoom(payload.new as Room);
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_players", filter: `room_id=eq.${room.id}` },
        async (payload) => {
          if (payload.eventType === "DELETE") {
            const old = payload.old as Partial<RoomPlayer>;
            setPlayers((prev) => prev.filter((p) => p.user_id !== old.user_id));
            return;
          }
          const row = payload.new as RoomPlayer;
          setPlayers((prev) => {
            const rest = prev.filter((p) => p.user_id !== row.user_id);
            return [...rest, row];
          });
          setProfiles((prev) => {
            if (prev.has(row.user_id)) return prev;
            void supabase
              .from("profiles")
              .select("*")
              .eq("id", row.user_id)
              .single<Profile>()
              .then(({ data }) => {
                if (data) setProfiles((p) => new Map(p).set(data.id, data));
              });
            return prev;
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "room_messages", filter: `room_id=eq.${room.id}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as RoomMessage]);
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game_rounds", filter: `room_id=eq.${room.id}` },
        (payload) => {
          if (payload.eventType === "DELETE") {
            setRound(null);
            return;
          }
          const row = payload.new as GameRound;
          setRound(row.phase === "settled" || row.phase === "cancelled" ? row : row);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.id]);

  const onLeave = async () => {
    await callRpc(supabase, "fn_leave_room", { p_room_id: room.id });
    router.push("/rooms");
  };

  const onToggleReady = async (ready: boolean) => {
    await callRpc(supabase, "fn_toggle_ready", { p_room_id: room.id, p_ready: ready });
    setPlayers((prev) =>
      prev.map((p) => (p.user_id === currentUserId ? { ...p, seat_ready: ready } : p)),
    );
  };

  const onStartSession = async () => {
    const { error } = await callRpc(supabase, "fn_start_game_session", { p_room_id: room.id });
    if (error) toast.error("No se pudo iniciar la partida");
  };

  const onEndSession = async () => {
    const { error } = await callRpc(supabase, "fn_end_game_session", { p_room_id: room.id });
    if (error) toast.error("No se pudo cerrar la partida");
  };

  const onStartRound = async (game: GameType) => {
    const { error } =
      game === "roulette"
        ? await callRpc(supabase, "fn_start_roulette_round", { p_room_id: room.id })
        : await callRpc(supabase, "fn_start_blackjack_round", { p_room_id: room.id });
    if (error) toast.error(error.message);
  };

  const onSendMessage = async () => {
    const trimmed = chatInput.trim();
    if (!trimmed) return;
    setChatInput("");
    const { error } = await supabase
      .from("room_messages")
      .insert({ room_id: room.id, user_id: currentUserId, message: trimmed });
    if (error) toast.error("No se pudo enviar el mensaje");
  };

  const copyCode = () => {
    navigator.clipboard.writeText(room.code);
    toast.success("Código copiado");
  };

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6 sm:px-6">
      <div className="glass-panel flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4">
        <div>
          <h1 className="font-heading text-xl font-bold text-gold-100">{room.name}</h1>
          <button
            onClick={copyCode}
            className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground hover:text-gold-300"
          >
            Código {room.code} <Copy className="size-3" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-gold-400/15 px-3 py-1 text-xs text-gold-300">
            {room.status === "playing" ? "En juego" : room.status === "closed" ? "Cerrada" : "Esperando"}
          </span>
          {isOwner && room.status !== "closed" && (
            <Button
              size="sm"
              variant="outline"
              className="hairline-gold border text-gold-200"
              onClick={room.status === "playing" ? onEndSession : onStartSession}
            >
              {room.status === "playing" ? (
                <>
                  <Square className="mr-1.5 size-3.5" /> Cerrar partida
                </>
              ) : (
                <>
                  <Play className="mr-1.5 size-3.5" /> Iniciar partida
                </>
              )}
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={onLeave}>
            <LogOut className="mr-1.5 size-3.5 text-crimson-400" /> Salir
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[220px_1fr_260px]">
        <div className="glass-panel flex flex-col gap-2 rounded-2xl p-4 lg:order-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Jugadores ({activePlayers.length}/{room.max_players})
          </p>
          {activePlayers.map((p) => {
            const profile = profiles.get(p.user_id);
            return (
              <div key={p.user_id} className="flex items-center gap-2 rounded-lg p-1.5">
                <div className="relative flex size-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-sm">
                  {profile?.avatar_url ?? "🎩"}
                  <Circle
                    className={
                      online.has(p.user_id)
                        ? "absolute -bottom-0.5 -right-0.5 size-2 fill-emerald-glow text-emerald-glow"
                        : "absolute -bottom-0.5 -right-0.5 size-2 fill-muted-foreground text-muted-foreground"
                    }
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-gold-100">{profile?.username ?? "..."}</p>
                  <p className="truncate font-mono text-[10px] text-muted-foreground">
                    {profile?.virtual_balance.toLocaleString("es-ES") ?? ""} fichas
                  </p>
                </div>
                {room.owner_id === p.user_id && <Crown className="size-3.5 shrink-0 text-gold-400" />}
                {p.seat_ready && room.status === "waiting" && (
                  <Check className="size-3.5 shrink-0 text-emerald-glow" />
                )}
              </div>
            );
          })}
          {room.status === "waiting" && (
            <Button
              size="sm"
              variant="outline"
              className="hairline-gold mt-2 border text-gold-200"
              onClick={() =>
                onToggleReady(
                  !players.find((p) => p.user_id === currentUserId)?.seat_ready,
                )
              }
            >
              {players.find((p) => p.user_id === currentUserId)?.seat_ready
                ? "Listo ✓"
                : "Marcarme listo"}
            </Button>
          )}
        </div>

        <div className="glass-panel flex min-h-[420px] flex-col items-center justify-center gap-4 rounded-2xl p-6 lg:order-2">
          {room.status !== "playing" && (
            <div className="flex flex-col items-center gap-2 text-center">
              <p className="text-sm text-muted-foreground">
                {room.status === "closed"
                  ? "Esta sala está cerrada."
                  : "Esperando a que el anfitrión inicie la partida."}
              </p>
            </div>
          )}

          {room.status === "playing" && !round && (
            <div className="flex flex-col items-center gap-3 text-center">
              <p className="text-sm text-muted-foreground">Elige una mesa para empezar</p>
              <div className="flex gap-2">
                {room.allowed_games.includes("roulette") && (
                  <Button
                    onClick={() => onStartRound("roulette")}
                    className="bg-crimson-500/20 text-gold-100 hover:bg-crimson-500/30"
                  >
                    🎰 Ruleta
                  </Button>
                )}
                {room.allowed_games.includes("blackjack") && (
                  <Button
                    onClick={() => onStartRound("blackjack")}
                    className="bg-felt-500/30 text-gold-100 hover:bg-felt-500/40"
                  >
                    🃏 Blackjack
                  </Button>
                )}
              </div>
            </div>
          )}

          {round && round.game_type === "roulette" && (
            <RouletteTable round={round} roomId={room.id} currentUserId={currentUserId} />
          )}

          {round && round.game_type === "blackjack" && (
            <BlackjackTable
              round={round}
              roomId={room.id}
              currentUserId={currentUserId}
              players={activePlayers}
              profiles={profiles}
            />
          )}
        </div>

        <div className="glass-panel flex h-[420px] flex-col rounded-2xl p-4 lg:order-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Chat
          </p>
          <ScrollArea className="flex-1 pr-2">
            <div className="flex flex-col gap-2">
              {messages.map((m) => {
                const profile = profiles.get(m.user_id);
                return (
                  <div key={m.id} className="text-sm">
                    <span className="font-medium text-gold-300">{profile?.username ?? "?"}: </span>
                    <span className="text-muted-foreground">{m.message}</span>
                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>
          </ScrollArea>
          <div className="mt-2 flex gap-2">
            <Input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onSendMessage();
                }
              }}
              placeholder="Escribe un mensaje..."
              className="text-sm"
            />
            <Button size="icon" onClick={onSendMessage}>
              <Send className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
