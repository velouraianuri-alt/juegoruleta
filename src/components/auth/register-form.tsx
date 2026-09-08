"use client";

import { useActionState } from "react";
import Link from "next/link";
import { registerAction, type RegisterState } from "@/app/(auth)/register/actions";
import { AVATAR_PRESETS } from "@/lib/validation/auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const initialState: RegisterState = {};

export function RegisterForm() {
  const [state, action, pending] = useActionState(registerAction, initialState);

  return (
    <form action={action} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold text-gold-100">
          Crear cuenta
        </h1>
        <p className="text-sm text-muted-foreground">
          Empieza con 10.000 fichas virtuales gratis.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label className="text-xs text-gold-200">Avatar</Label>
        <div className="grid grid-cols-8 gap-2" role="radiogroup" aria-label="Avatar">
          {AVATAR_PRESETS.map((emoji, i) => (
            <label key={emoji} className="cursor-pointer">
              <input
                type="radio"
                name="avatar"
                value={emoji}
                defaultChecked={i === 0}
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
        <Input id="username" name="username" placeholder="croupier_ian" autoComplete="username" />
        {state.errors?.username && (
          <p className="text-xs text-crimson-400">{state.errors.username[0]}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email" className="text-xs text-gold-200">
          Email
        </Label>
        <Input id="email" name="email" type="email" placeholder="tu@email.com" autoComplete="email" />
        {state.errors?.email && (
          <p className="text-xs text-crimson-400">{state.errors.email[0]}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password" className="text-xs text-gold-200">
          Contraseña
        </Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
        />
        {state.errors?.password && (
          <p className="text-xs text-crimson-400">{state.errors.password[0]}</p>
        )}
      </div>

      {state.message && <p className="text-sm text-gold-200">{state.message}</p>}

      <Button
        type="submit"
        disabled={pending}
        className="mt-1 bg-gold-400 text-noir-950 hover:bg-gold-300"
      >
        {pending ? "Creando cuenta..." : "Crear cuenta"}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="text-gold-300 hover:text-gold-200">
          Inicia sesión
        </Link>
      </p>
    </form>
  );
}
