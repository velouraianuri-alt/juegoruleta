"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LoginSchema } from "@/lib/validation/auth";

export interface LoginState {
  message?: string;
}

export async function loginAction(
  _prevState: LoginState | undefined,
  formData: FormData,
): Promise<LoginState> {
  const validated = LoginSchema.safeParse({
    identifier: formData.get("identifier"),
    password: formData.get("password"),
  });

  if (!validated.success) {
    return { message: "Introduce tu email/usuario y contraseña" };
  }

  const { identifier, password } = validated.data;
  const supabase = await createClient();

  let email = identifier;
  if (!identifier.includes("@")) {
    const { data: resolvedEmail } = await supabase.rpc("fn_get_email_for_username", {
      p_username: identifier,
    });
    if (!resolvedEmail) {
      return { message: "Usuario o contraseña incorrectos" };
    }
    email = resolvedEmail;
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { message: "Usuario o contraseña incorrectos" };
  }

  redirect("/dashboard");
}
