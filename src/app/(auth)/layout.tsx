import Link from "next/link";
import { LogoMark } from "@/components/landing/logo-mark";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden px-4 py-10">
      <div
        className="pointer-events-none absolute -top-40 left-1/2 h-[560px] w-[900px] -translate-x-1/2 opacity-60"
        style={{
          background:
            "radial-gradient(ellipse closest-side, color-mix(in oklab, var(--color-felt-500) 45%, transparent), transparent)",
        }}
      />
      <Link href="/" className="relative z-10 mb-8 flex items-center gap-2.5">
        <div className="size-8">
          <LogoMark />
        </div>
        <span className="font-heading text-lg tracking-[0.25em] text-gold-gradient">
          PRIVÉ
        </span>
      </Link>
      <div className="glass-panel relative z-10 w-full max-w-sm rounded-2xl p-7 sm:p-8">
        {children}
      </div>
    </div>
  );
}
