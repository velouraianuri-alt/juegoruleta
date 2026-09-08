"use client";

import { useActionState } from "react";
import Link from "next/link";
import { loginAction, type LoginState } from "@/app/(auth)/login/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const initialState: LoginState = {};

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, initialState);

  return (
    <form action={action} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold text-gold-100">
          Iniciar sesión
        </h1>
        <p className="text-sm text-muted-foreground">
          Vuelve a la mesa con tus amigos.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="identifier" className="text-xs text-gold-200">
          Email o usuario
        </Label>
        <Input
          id="identifier"
          name="identifier"
          placeholder="tu@email.com o croupier_ian"
          autoComplete="username"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password" className="text-xs text-gold-200">
          Contraseña
        </Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
        />
      </div>

      {state.message && <p className="text-sm text-crimson-400">{state.message}</p>}

      <Button
        type="submit"
        disabled={pending}
        className="mt-1 bg-gold-400 text-noir-950 hover:bg-gold-300"
      >
        {pending ? "Entrando..." : "Iniciar sesión"}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        ¿No tienes cuenta?{" "}
        <Link href="/register" className="text-gold-300 hover:text-gold-200">
          Crea una gratis
        </Link>
      </p>
    </form>
  );
}
