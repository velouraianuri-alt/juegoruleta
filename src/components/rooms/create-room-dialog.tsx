"use client";

import { useActionState, useState } from "react";
import { Dices } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createRoomAction, type RoomActionState } from "@/app/(app)/rooms/actions";
import { cn } from "@/lib/utils";

const initialState: RoomActionState = {};

export function CreateRoomDialog({ defaultOpen, defaultGame }: { defaultOpen?: boolean; defaultGame?: string }) {
  const [open, setOpen] = useState(Boolean(defaultOpen));
  const [state, action, pending] = useActionState(createRoomAction, initialState);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-gold-400 text-noir-950 hover:bg-gold-300">
          <Dices className="mr-1.5 size-4" /> Crear sala
        </Button>
      </DialogTrigger>
      <DialogContent className="glass-panel border-none sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-heading text-gold-100">Crear sala privada</DialogTitle>
        </DialogHeader>
        <form action={action} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name" className="text-xs text-gold-200">
              Nombre de la sala
            </Label>
            <Input id="name" name="name" placeholder="Noche de amigos" />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="max_players" className="text-xs text-gold-200">
              Máximo de jugadores
            </Label>
            <Input
              id="max_players"
              name="max_players"
              type="number"
              min={2}
              max={10}
              defaultValue={6}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label className="text-xs text-gold-200">Juegos permitidos</Label>
            <div className="flex gap-2">
              {[
                { value: "roulette", label: "🎰 Ruleta" },
                { value: "blackjack", label: "🃏 Blackjack" },
              ].map((g) => (
                <label key={g.value} className="cursor-pointer">
                  <input
                    type="checkbox"
                    name="games"
                    value={g.value}
                    defaultChecked={defaultGame ? g.value === defaultGame : true}
                    className="peer sr-only"
                  />
                  <span
                    className={cn(
                      "flex items-center rounded-full border px-3 py-1.5 text-sm transition-colors",
                      "border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10",
                      "peer-checked:border-gold-400 peer-checked:bg-gold-400/15 peer-checked:text-gold-200",
                    )}
                  >
                    {g.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {state.error && <p className="text-xs text-crimson-400">{state.error}</p>}

          <Button
            type="submit"
            disabled={pending}
            className="bg-gold-400 text-noir-950 hover:bg-gold-300"
          >
            {pending ? "Creando..." : "Crear sala"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
