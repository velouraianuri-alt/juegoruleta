"use client";

import { useState, useTransition } from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
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
import { AVATAR_PRESETS } from "@/lib/validation/auth";
import { updateProfileAction } from "@/app/(app)/profile/actions";
import type { Profile } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

export function EditProfileDialog({ profile }: { profile: Profile }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const onSubmit = (formData: FormData) => {
    startTransition(async () => {
      const result = await updateProfileAction(undefined, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setError(undefined);
      toast.success("Perfil actualizado");
      setOpen(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="hairline-gold border text-gold-200">
          <Pencil className="mr-1.5 size-3.5" /> Editar
        </Button>
      </DialogTrigger>
      <DialogContent className="glass-panel border-none sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-heading text-gold-100">Editar perfil</DialogTitle>
        </DialogHeader>
        <form action={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label className="text-xs text-gold-200">Avatar</Label>
            <div className="grid grid-cols-8 gap-2">
              {AVATAR_PRESETS.map((emoji) => (
                <label key={emoji} className="cursor-pointer">
                  <input
                    type="radio"
                    name="avatar"
                    value={emoji}
                    defaultChecked={profile.avatar_url === emoji}
                    className="peer sr-only"
                  />
                  <span
                    className={cn(
                      "flex size-9 items-center justify-center rounded-lg border text-lg transition-colors",
                      "border-white/10 bg-white/5 hover:bg-white/10",
                      "peer-checked:border-gold-400 peer-checked:bg-gold-400/15",
                    )}
                  >
                    {emoji}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="username" className="text-xs text-gold-200">
              Usuario
            </Label>
            <Input id="username" name="username" defaultValue={profile.username} />
          </div>

          {error && <p className="text-xs text-crimson-400">{error}</p>}

          <Button
            type="submit"
            disabled={pending}
            className="bg-gold-400 text-noir-950 hover:bg-gold-300"
          >
            {pending ? "Guardando..." : "Guardar cambios"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
