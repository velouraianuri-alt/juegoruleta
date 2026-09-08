"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { callRpc } from "@/lib/supabase/rpc";
import { RegisterSchema } from "@/lib/validation/auth";

export interface RegisterState {
  errors?: {
    username?: string[];
    email?: string[];
    password?: string[];
    avatar?: string[];
  };
  message?: string;
}

export async function registerAction(
  _prevState: RegisterState | undefined,
  formData: FormData,
): Promise<RegisterState> {
  const validated = RegisterSchema.safeParse({
    username: formData.get("username"),
    email: formData.get("email"),
    password: formData.get("password"),
    avatar: formData.get("avatar"),
  });

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const { username, email, password, avatar } = validated.data;
  const supabase = await createClient();

  const { data: available, error: availError } = await callRpc(
    supabase,
    "fn_username_available",
    { p_username: username },
  );
  if (availError) {
    return { message: "No se pudo comprobar el nombre de usuario. Inténtalo de nuevo." };
  }
  if (!available) {
    return { errors: { username: ["Ese nombre de usuario ya está en uso"] } };
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { username, avatar_url: avatar } },
  });

  if (error) {
    return { message: error.message };
  }

  if (!data.session) {
    return {
      message:
        "Cuenta creada. Revisa tu email para confirmar la cuenta antes de iniciar sesión.",
    };
  }

  redirect("/dashboard");
}
