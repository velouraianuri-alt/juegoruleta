"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Coins,
  LayoutDashboard,
  DoorOpen,
  UsersRound,
  Trophy,
  History,
  User as UserIcon,
  LogOut,
} from "lucide-react";
import { signOutAction } from "@/app/(app)/actions";
import { LogoMark } from "@/components/landing/logo-mark";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Profile } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/dashboard", label: "Inicio", icon: LayoutDashboard },
  { href: "/rooms", label: "Salas", icon: DoorOpen },
  { href: "/friends", label: "Amigos", icon: UsersRound },
  { href: "/leaderboard", label: "Ranking", icon: Trophy },
  { href: "/history", label: "Historial", icon: History },
];

export function AppHeader({ profile }: { profile: Profile }) {
  const pathname = usePathname();

  return (
    <header className="glass-panel sticky top-0 z-40 flex items-center justify-between gap-3 rounded-none border-x-0 border-t-0 px-4 py-3 sm:px-6">
      <div className="flex items-center gap-6">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="size-7">
            <LogoMark />
          </div>
          <span className="hidden font-heading text-base tracking-[0.2em] text-gold-gradient sm:inline">
            PRIVÉ
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => {
            const active = pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors",
                  active
                    ? "bg-gold-400/15 text-gold-200"
                    : "text-muted-foreground hover:bg-white/5 hover:text-gold-100",
                )}
              >
                <link.icon className="size-4" />
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <div className="flex items-center gap-1.5 rounded-full border border-gold-400/25 bg-gold-400/10 px-3 py-1.5 text-sm font-semibold text-gold-200">
          <Coins className="size-4 text-gold-400" />
          <span className="font-mono tabular-nums">
            {profile.virtual_balance.toLocaleString("es-ES")}
          </span>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger className="flex size-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-lg hover:bg-white/10">
            {profile.avatar_url ?? <UserIcon className="size-4" />}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <div className="px-2 py-1.5 text-sm font-medium text-gold-100">
              {profile.username}
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/profile" className="flex items-center gap-2">
                <UserIcon className="size-4" /> Perfil
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="md:hidden">
              <Link href="/rooms" className="flex items-center gap-2">
                <DoorOpen className="size-4" /> Salas
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="md:hidden">
              <Link href="/friends" className="flex items-center gap-2">
                <UsersRound className="size-4" /> Amigos
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="md:hidden">
              <Link href="/leaderboard" className="flex items-center gap-2">
                <Trophy className="size-4" /> Ranking
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="md:hidden">
              <Link href="/history" className="flex items-center gap-2">
                <History className="size-4" /> Historial
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild variant="destructive">
              <form action={signOutAction} className="w-full">
                <button type="submit" className="flex w-full items-center gap-2">
                  <LogOut className="size-4" /> Cerrar sesión
                </button>
              </form>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
