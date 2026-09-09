"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { parityLabel, rangeLabel, dozenLabel, columnLabel } from "./roulette-history-derive";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { RouletteResult } from "@/lib/supabase/types";

const STRIP_LIMIT = 15;
const DIALOG_LIMIT = 50;

interface HistoryEntry {
  id: string;
  number: number;
  color: "red" | "black" | "green";
  settledAt: string;
}

const DOT_COLOR: Record<"red" | "black" | "green", string> = {
  red: "bg-crimson-500",
  black: "bg-noir-700",
  green: "bg-felt-500",
};

export function ResultsHistory({ roomId }: { roomId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let active = true;

    supabase
      .from("game_rounds")
      .select("id, result, settled_at")
      .eq("room_id", roomId)
      .eq("game_type", "roulette")
      .eq("phase", "settled")
      .order("settled_at", { ascending: false })
      .limit(DIALOG_LIMIT)
      .then(({ data }) => {
        if (!active || !data) return;
        setHistory(
          data
            .filter((r) => r.result && r.settled_at)
            .map((r) => {
              const result = r.result as RouletteResult;
              return { id: r.id, number: result.number, color: result.color, settledAt: r.settled_at! };
            }),
        );
      });

    const channel = supabase
      .channel(`roulette-history:${roomId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "game_rounds", filter: `room_id=eq.${roomId}` },
        (payload) => {
          const row = payload.new as {
            id: string;
            game_type: string;
            phase: string;
            result: RouletteResult | null;
            settled_at: string | null;
          };
          if (row.game_type !== "roulette" || row.phase !== "settled" || !row.result || !row.settled_at) return;
          setHistory((prev) => {
            if (prev.some((h) => h.id === row.id)) return prev;
            return [
              { id: row.id, number: row.result!.number, color: row.result!.color, settledAt: row.settled_at! },
              ...prev,
            ].slice(0, DIALOG_LIMIT);
          });
        },
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [roomId, supabase]);

  if (history.length === 0) return null;

  const strip = history.slice(0, STRIP_LIMIT);

  return (
    <div className="flex w-full flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">Últimos resultados</span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-[11px] font-medium text-gold-300 hover:text-gold-200"
        >
          Ver historial
        </button>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        <AnimatePresence initial={false}>
          {strip.map((h) => (
            <motion.div
              key={h.id}
              layout
              initial={{ opacity: 0, scale: 0.4, y: -6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
              className={cnDot(h.color)}
              title={`${h.number} · ${new Date(h.settledAt).toLocaleTimeString("es-ES")}`}
            >
              {h.number}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Historial de la ruleta</DialogTitle>
            <DialogDescription>Últimas {history.length} rondas resueltas en esta sala.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto rounded-lg border border-white/5">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-noir-900 text-muted-foreground">
                <tr>
                  <th className="px-2 py-1.5 font-medium">Número</th>
                  <th className="px-2 py-1.5 font-medium">Color</th>
                  <th className="px-2 py-1.5 font-medium">Paridad</th>
                  <th className="px-2 py-1.5 font-medium">Rango</th>
                  <th className="px-2 py-1.5 font-medium">Docena</th>
                  <th className="px-2 py-1.5 font-medium">Columna</th>
                  <th className="px-2 py-1.5 font-medium">Hora</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id} className="border-t border-white/5">
                    <td className="px-2 py-1.5 font-mono font-semibold text-gold-200">{h.number}</td>
                    <td className="px-2 py-1.5">
                      {h.color === "red" ? "Rojo" : h.color === "black" ? "Negro" : "Verde"}
                    </td>
                    <td className="px-2 py-1.5">{parityLabel(h.number)}</td>
                    <td className="px-2 py-1.5">{rangeLabel(h.number)}</td>
                    <td className="px-2 py-1.5">{dozenLabel(h.number)}</td>
                    <td className="px-2 py-1.5">{columnLabel(h.number)}</td>
                    <td className="px-2 py-1.5 text-muted-foreground">
                      {new Date(h.settledAt).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function cnDot(color: "red" | "black" | "green") {
  return `flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white shadow-sm ${DOT_COLOR[color]}`;
}
