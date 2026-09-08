"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { claimFreeChipsAction } from "@/app/(app)/actions";

const COOLDOWN_MS = 4 * 60 * 60 * 1000;

function formatRemaining(ms: number) {
  const totalMinutes = Math.max(0, Math.ceil(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function FreeChipsButton({ lastClaimAt }: { lastClaimAt: string | null }) {
  const [pending, startTransition] = useTransition();
  const [remaining, setRemaining] = useState<number>(() => {
    if (!lastClaimAt) return 0;
    return new Date(lastClaimAt).getTime() + COOLDOWN_MS - Date.now();
  });

  useEffect(() => {
    if (remaining <= 0) return;
    const interval = setInterval(() => {
      setRemaining((r) => Math.max(0, r - 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [remaining]);

  const onClaim = () => {
    startTransition(async () => {
      const result = await claimFreeChipsAction();
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("¡Has recibido 5.000 fichas gratis!");
        setRemaining(COOLDOWN_MS);
      }
    });
  };

  const onCooldown = remaining > 0;

  return (
    <Button
      onClick={onClaim}
      disabled={pending || onCooldown}
      size="sm"
      className="justify-start bg-gold-400/15 text-gold-200 hover:bg-gold-400/25"
    >
      <Sparkles className="mr-1.5 size-4" />
      {onCooldown ? `Disponible en ${formatRemaining(remaining)}` : "Recibir 5.000 fichas"}
    </Button>
  );
}
