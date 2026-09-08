"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Search, UserPlus, Check, X, Circle, DoorOpen, UserMinus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useOnlinePresence } from "@/hooks/use-online-presence";
import {
  searchUsersAction,
  sendFriendRequestAction,
  respondFriendRequestAction,
  removeFriendAction,
} from "@/app/(app)/friends/actions";
import type { Profile } from "@/lib/supabase/types";

interface FriendRequestRow {
  id: string;
  profile: Profile;
}

export function FriendsClient({
  userId,
  friends,
  incomingRequests,
  outgoingRequests,
}: {
  userId: string;
  friends: Profile[];
  incomingRequests: FriendRequestRow[];
  outgoingRequests: FriendRequestRow[];
}) {
  const online = useOnlinePresence(userId);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const [searching, startSearch] = useTransition();
  const [pendingUsernames, setPendingUsernames] = useState<Set<string>>(new Set());
  const [, startAction] = useTransition();

  const onQueryChange = (value: string) => {
    setQuery(value);
    startSearch(async () => {
      const data = await searchUsersAction(value);
      setResults(data);
    });
  };

  const onSendRequest = (username: string) => {
    setPendingUsernames((prev) => new Set(prev).add(username));
    startAction(async () => {
      const result = await sendFriendRequestAction(username);
      if (result.error) toast.error(result.error);
      else toast.success(`Solicitud enviada a ${username}`);
    });
  };

  const onRespond = (requestId: string, accept: boolean) => {
    startAction(async () => {
      const result = await respondFriendRequestAction(requestId, accept);
      if (result.error) toast.error(result.error);
      else toast.success(accept ? "Amigo añadido" : "Solicitud rechazada");
    });
  };

  const onRemove = (friendId: string) => {
    startAction(async () => {
      const result = await removeFriendAction(friendId);
      if (result.error) toast.error(result.error);
      else toast.success("Amigo eliminado");
    });
  };

  return (
    <Tabs defaultValue="friends">
      <TabsList className="glass-panel">
        <TabsTrigger value="friends">Amigos ({friends.length})</TabsTrigger>
        <TabsTrigger value="requests">
          Solicitudes {incomingRequests.length > 0 && `(${incomingRequests.length})`}
        </TabsTrigger>
        <TabsTrigger value="search">Buscar</TabsTrigger>
      </TabsList>

      <TabsContent value="friends" className="flex flex-col gap-2 pt-4">
        {friends.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Aún no tienes amigos. Búscalos en la pestaña &quot;Buscar&quot;.
          </p>
        )}
        {friends.map((friend) => (
          <div
            key={friend.id}
            className="glass-panel flex items-center justify-between rounded-xl p-3"
          >
            <div className="flex items-center gap-3">
              <div className="relative flex size-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-lg">
                {friend.avatar_url ?? "🎩"}
                <Circle
                  className={
                    online.has(friend.id)
                      ? "absolute -bottom-0.5 -right-0.5 size-2.5 fill-emerald-glow text-emerald-glow"
                      : "absolute -bottom-0.5 -right-0.5 size-2.5 fill-muted-foreground text-muted-foreground"
                  }
                />
              </div>
              <div>
                <p className="text-sm font-medium text-gold-100">{friend.username}</p>
                <p className="text-xs text-muted-foreground">
                  {online.has(friend.id) ? "Conectado" : "Desconectado"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button asChild variant="ghost" size="icon" title="Invitar a sala">
                <Link href="/rooms">
                  <DoorOpen className="size-4 text-gold-300" />
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                title="Eliminar amigo"
                onClick={() => onRemove(friend.id)}
              >
                <UserMinus className="size-4 text-crimson-400" />
              </Button>
            </div>
          </div>
        ))}
      </TabsContent>

      <TabsContent value="requests" className="flex flex-col gap-4 pt-4">
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Recibidas
          </p>
          {incomingRequests.length === 0 && (
            <p className="text-sm text-muted-foreground">No tienes solicitudes pendientes.</p>
          )}
          {incomingRequests.map((req) => (
            <div
              key={req.id}
              className="glass-panel flex items-center justify-between rounded-xl p-3"
            >
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-lg">
                  {req.profile.avatar_url ?? "🎩"}
                </div>
                <p className="text-sm font-medium text-gold-100">{req.profile.username}</p>
              </div>
              <div className="flex items-center gap-1">
                <Button size="icon" variant="ghost" onClick={() => onRespond(req.id, true)}>
                  <Check className="size-4 text-emerald-glow" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => onRespond(req.id, false)}>
                  <X className="size-4 text-crimson-400" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Enviadas
          </p>
          {outgoingRequests.length === 0 && (
            <p className="text-sm text-muted-foreground">No tienes solicitudes enviadas.</p>
          )}
          {outgoingRequests.map((req) => (
            <div
              key={req.id}
              className="glass-panel flex items-center justify-between rounded-xl p-3"
            >
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-lg">
                  {req.profile.avatar_url ?? "🎩"}
                </div>
                <p className="text-sm font-medium text-gold-100">{req.profile.username}</p>
              </div>
              <span className="text-xs text-muted-foreground">Pendiente</span>
            </div>
          ))}
        </div>
      </TabsContent>

      <TabsContent value="search" className="flex flex-col gap-3 pt-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Usuario o ID..."
            className="pl-9"
          />
        </div>
        <div className="flex flex-col gap-2">
          {searching && <p className="text-sm text-muted-foreground">Buscando...</p>}
          {!searching && query.trim().length >= 2 && results.length === 0 && (
            <p className="text-sm text-muted-foreground">Sin resultados.</p>
          )}
          {results.map((result) => (
            <div
              key={result.id}
              className="glass-panel flex items-center justify-between rounded-xl p-3"
            >
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-lg">
                  {result.avatar_url ?? "🎩"}
                </div>
                <div>
                  <p className="text-sm font-medium text-gold-100">{result.username}</p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {result.id.slice(0, 8)}
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                disabled={pendingUsernames.has(result.username)}
                onClick={() => onSendRequest(result.username)}
                className="bg-gold-400/15 text-gold-200 hover:bg-gold-400/25"
              >
                <UserPlus className="mr-1.5 size-3.5" />
                {pendingUsernames.has(result.username) ? "Enviada" : "Añadir"}
              </Button>
            </div>
          ))}
        </div>
      </TabsContent>
    </Tabs>
  );
}
