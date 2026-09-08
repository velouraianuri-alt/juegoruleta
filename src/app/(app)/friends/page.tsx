import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { FriendsClient } from "@/components/friends/friends-client";
import type { Profile } from "@/lib/supabase/types";

export const metadata: Metadata = { title: "Amigos — Privé" };
export const dynamic = "force-dynamic";

export default async function FriendsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: relations } = await supabase
    .from("friend_requests")
    .select("*")
    .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`);

  const accepted = (relations ?? []).filter((r) => r.status === "accepted");
  const incoming = (relations ?? []).filter(
    (r) => r.status === "pending" && r.receiver_id === user.id,
  );
  const outgoing = (relations ?? []).filter(
    (r) => r.status === "pending" && r.sender_id === user.id,
  );

  const otherIds = Array.from(
    new Set(
      [...accepted, ...incoming, ...outgoing].map((r) =>
        r.sender_id === user.id ? r.receiver_id : r.sender_id,
      ),
    ),
  );

  const { data: profiles } = otherIds.length
    ? await supabase.from("profiles").select("*").in("id", otherIds)
    : { data: [] as Profile[] };

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  const friends = accepted
    .map((r) => profileById.get(r.sender_id === user.id ? r.receiver_id : r.sender_id))
    .filter((p): p is Profile => Boolean(p));

  const incomingRequests = incoming
    .map((r) => {
      const profile = profileById.get(r.sender_id);
      return profile ? { id: r.id, profile } : null;
    })
    .filter((r): r is { id: string; profile: Profile } => Boolean(r));

  const outgoingRequests = outgoing
    .map((r) => {
      const profile = profileById.get(r.receiver_id);
      return profile ? { id: r.id, profile } : null;
    })
    .filter((r): r is { id: string; profile: Profile } => Boolean(r));

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-gold-100">Amigos</h1>
        <p className="text-sm text-muted-foreground">
          Busca por nombre de usuario, envía solicitudes e invita a jugar.
        </p>
      </div>

      <FriendsClient
        userId={user.id}
        friends={friends}
        incomingRequests={incomingRequests}
        outgoingRequests={outgoingRequests}
      />
    </div>
  );
}
