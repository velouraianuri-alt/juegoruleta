import { z } from "zod";

export const AVATAR_PRESETS = ["🎩", "🃏", "💎", "🥂", "🎲", "♠️", "♣️", "👑"] as const;

export const RegisterSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Mínimo 3 caracteres")
    .max(20, "Máximo 20 caracteres")
    .regex(/^[a-zA-Z0-9_]+$/, "Solo letras, números y guion bajo"),
  email: z.string().trim().email("Email no válido"),
  password: z.string().min(8, "Mínimo 8 caracteres"),
  avatar: z.enum(AVATAR_PRESETS),
});

export const LoginSchema = z.object({
  identifier: z.string().trim().min(1, "Introduce tu email o usuario"),
  password: z.string().min(1, "Introduce tu contraseña"),
});
