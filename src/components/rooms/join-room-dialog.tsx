"use client";

import { useActionState, useState } from "react";
import { LogIn } from "lucide-react";
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
import { joinRoomAction, type RoomActionState } from "@/app/(app)/rooms/actions";

const initialState: RoomActionState = {};

export function JoinRoomDialog() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(joinRoomAction, initialState);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="hairline-gold border text-gold-200">
          <LogIn className="mr-1.5 size-4" /> Unirse con código
        </Button>
      </DialogTrigger>
      <DialogContent className="glass-panel border-none sm:max-w-xs">
        <DialogHeader>
          <DialogTitle className="font-heading text-gold-100">Unirse a una sala</DialogTitle>
        </DialogHeader>
        <form action={action} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="code" className="text-xs text-gold-200">
              Código de la sala
            </Label>
            <Input
              id="code"
              name="code"
              placeholder="A1B2C3"
              className="text-center font-mono text-lg uppercase tracking-[0.3em]"
              maxLength={6}
            />
          </div>

          {state.error && <p className="text-xs text-crimson-400">{state.error}</p>}

          <Button
            type="submit"
            disabled={pending}
            className="bg-gold-400 text-noir-950 hover:bg-gold-300"
          >
            {pending ? "Uniéndote..." : "Unirse"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
