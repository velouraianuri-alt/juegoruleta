import type { Metadata } from "next";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = { title: "Crear cuenta — Privé" };

export default function RegisterPage() {
  return <RegisterForm />;
}
