"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { callRpc } from "@/lib/supabase/rpc";
import { z } from "zod";

const UpdateProfileSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Mínimo 3 caracteres")
    .max(20, "Máximo 20 caracteres")
    .regex(/^[a-zA-Z0-9_]+$/, "Solo letras, números y guion bajo"),
  avatar: z.string().min(1),
});

export interface UpdateProfileState {
  error?: string;
  success?: boolean;
}

export async function updateProfileAction(
  _prevState: UpdateProfileState | undefined,
  formData: FormData,
): Promise<UpdateProfileState> {
  const validated = UpdateProfileSchema.safeParse({
    username: formData.get("username"),
    avatar: formData.get("avatar"),
  });
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message ?? "Datos no válidos" };
  }

  const supabase = await createClient();
  const { error } = await callRpc(supabase, "fn_update_profile", {
    p_username: validated.data.username,
    p_avatar_url: validated.data.avatar,
  });

  if (error) {
    if (error.message.includes("duplicate key")) {
      return { error: "Ese nombre de usuario ya está en uso" };
    }
    return { error: "No se pudo actualizar el perfil" };
  }

  revalidatePath("/profile");
  revalidatePath("/dashboard");
  return { success: true };
}
