"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { LogoMark } from "@/components/landing/logo-mark";

export function LogoIntro({
  onComplete,
  holdMs = 1400,
}: {
  onComplete?: () => void;
  holdMs?: number;
}) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      onComplete?.();
    }, holdMs);
    return () => clearTimeout(timer);
  }, [holdMs, onComplete]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-noir-950"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
        >
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 60% 50% at 50% 45%, color-mix(in oklab, var(--color-gold-500) 16%, transparent), transparent)",
            }}
          />
          <motion.div
            className="relative size-28 sm:size-36"
            initial={{ opacity: 0, scale: 0.7, rotate: -8 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          >
            <motion.div
              className="absolute inset-0"
              animate={{ rotate: 360 }}
              transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
            >
              <LogoMark />
            </motion.div>
          </motion.div>
          <motion.p
            className="absolute bottom-[38%] font-heading text-2xl tracking-[0.3em] text-gold-gradient sm:text-3xl"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.7 }}
          >
            PRIVÉ
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
