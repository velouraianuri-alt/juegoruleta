"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Dices, Spade, Sparkles, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LogoIntro } from "@/components/logo-intro";
import { LogoMark } from "@/components/landing/logo-mark";

const features = [
  {
    icon: Dices,
    title: "Ruleta europea",
    desc: "Mesa realista con pagos oficiales: pleno 35:1, rojo/negro, docenas y columnas.",
  },
  {
    icon: Spade,
    title: "Blackjack de mesa",
    desc: "Hit, stand, double y split contra un dealer que juega con reglas estándar.",
  },
  {
    icon: Users,
    title: "Salas privadas",
    desc: "Crea una sala con código, invita a tus amigos y jugad juntos en tiempo real.",
  },
];

export function LandingHero() {
  const [introDone, setIntroDone] = useState(false);

  return (
    <>
      <LogoIntro onComplete={() => setIntroDone(true)} />
      <div className="relative flex min-h-svh flex-col overflow-hidden">
        <div
          className="pointer-events-none absolute -top-40 left-1/2 h-[560px] w-[900px] -translate-x-1/2 opacity-60"
          style={{
            background:
              "radial-gradient(ellipse closest-side, color-mix(in oklab, var(--color-felt-500) 45%, transparent), transparent)",
          }}
        />

        <header className="relative z-10 flex items-center justify-between px-6 py-6 sm:px-10">
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={introDone ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }}
            className="flex items-center gap-2.5"
          >
            <div className="size-8">
              <LogoMark />
            </div>
            <span className="font-heading text-lg tracking-[0.25em] text-gold-gradient">
              PRIVÉ
            </span>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={introDone ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="flex items-center gap-2"
          >
            <Button asChild variant="ghost" className="text-gold-200 hover:text-gold-100">
              <Link href="/login">Iniciar sesión</Link>
            </Button>
            <Button
              asChild
              className="bg-gold-400 text-noir-950 hover:bg-gold-300"
            >
              <Link href="/register">Crear cuenta</Link>
            </Button>
          </motion.div>
        </header>

        <main className="relative z-10 flex flex-1 flex-col items-center justify-center gap-10 px-6 pb-20 text-center sm:px-10">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={introDone ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, delay: 0.15 }}
            className="glass-panel flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium text-gold-200"
          >
            <Sparkles className="size-3.5 text-gold-400" />
            Solo fichas virtuales · Sin dinero real · Entre amigos
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={introDone ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.25 }}
            className="max-w-3xl text-balance text-5xl font-bold leading-[1.05] text-gold-gradient sm:text-6xl md:text-7xl"
          >
            Tu casino privado, entre amigos
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={introDone ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.35 }}
            className="max-w-xl text-balance text-base text-muted-foreground sm:text-lg"
          >
            Crea una sala, reparte fichas virtuales y sentaos a la mesa de
            ruleta o blackjack. Sin depósitos, sin retiradas, sin dinero real
            — pura diversión de casino con quien tú elijas.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={introDone ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.45 }}
            className="flex flex-col gap-3 sm:flex-row"
          >
            <Button
              asChild
              size="lg"
              className="bg-gold-400 text-noir-950 hover:bg-gold-300 glow-gold h-12 px-8 text-base"
            >
              <Link href="/register">Empezar con 10.000 fichas</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="hairline-gold h-12 border px-8 text-base text-gold-200 hover:bg-white/5"
            >
              <Link href="/login">Ya tengo cuenta</Link>
            </Button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={introDone ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.55 }}
            className="mt-6 grid w-full max-w-4xl grid-cols-1 gap-4 sm:grid-cols-3"
          >
            {features.map((f) => (
              <div key={f.title} className="glass-panel rounded-2xl p-5 text-left">
                <f.icon className="size-5 text-gold-400" />
                <p className="mt-3 font-heading text-base font-semibold text-gold-100">
                  {f.title}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </motion.div>
        </main>
      </div>
    </>
  );
}
