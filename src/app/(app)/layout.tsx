import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/app/app-header";
import type { Profile } from "@/lib/supabase/types";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>();

  if (!profile) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-svh flex-col">
      <AppHeader profile={profile} />
      <main className="flex-1">{children}</main>
    </div>
  );
}
