"use client";

import { useEffect, useRef, useState } from "react";
import { WHEEL_ORDER, SEGMENT_DEG, colorForNumber, angleForNumber } from "./wheel-data";
import { sound } from "@/lib/sound";

const POCKET_COLOR: Record<"red" | "black" | "green", string> = {
  red: "#c62839",
  black: "#12140f",
  green: "#0f4c2c",
};

function buildConicGradient() {
  const stops = WHEEL_ORDER.map((n, i) => {
    const color = POCKET_COLOR[colorForNumber(n)];
    const from = (i * SEGMENT_DEG).toFixed(3);
    const to = ((i + 1) * SEGMENT_DEG).toFixed(3);
    return `${color} ${from}deg ${to}deg`;
  });
  return `conic-gradient(from 0deg, ${stops.join(", ")})`;
}

const CONIC_GRADIENT = buildConicGradient();
const EASE = "cubic-bezier(0.11, 0.7, 0.24, 1)";

export function RouletteWheel({
  spinToken,
  winningNumber,
  size = 260,
}: {
  /** Increment this to trigger a new spin-and-reveal animation. */
  spinToken: number;
  winningNumber: number | null;
  size?: number;
}) {
  const [rotation, setRotation] = useState(0);
  const [ballRotation, setBallRotation] = useState(0);
  const lastToken = useRef(0);
  const tickTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (spinToken === lastToken.current || winningNumber === null) return;
    lastToken.current = spinToken;

    sound.spinStart();

    setRotation((prev) => {
      const currentMod = ((prev % 360) + 360) % 360;
      const targetMod = (360 - angleForNumber(winningNumber)) % 360;
      let delta = targetMod - currentMod;
      if (delta < 0) delta += 360;
      return prev + 5 * 360 + delta;
    });

    setBallRotation((prev) => {
      const remainder = ((prev % 360) + 360) % 360;
      return prev - 8 * 360 - remainder;
    });

    tickTimers.current.forEach(clearTimeout);
    tickTimers.current = [];
    for (let i = 0; i < 14; i++) {
      tickTimers.current.push(
        setTimeout(() => sound.ballTick(), 200 + i * i * 12),
      );
    }
    tickTimers.current.push(setTimeout(() => sound.win(), 4200));

    return () => {
      tickTimers.current.forEach(clearTimeout);
    };
     
  }, [spinToken, winningNumber]);

  const numberRadius = size * 0.4;

  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <div className="absolute left-1/2 top-[-6px] z-20 -translate-x-1/2">
        <div className="size-0 border-x-[7px] border-t-[12px] border-x-transparent border-t-gold-400 drop-shadow" />
      </div>

      <div
        className="glow-gold absolute inset-0 rounded-full border-[6px] border-gold-500"
        style={{
          transform: `rotate(${rotation}deg)`,
          transition: `transform 4200ms ${EASE}`,
        }}
      >
        <div className="absolute inset-0 rounded-full" style={{ background: CONIC_GRADIENT }} />
        {WHEEL_ORDER.map((n, i) => {
          const angle = i * SEGMENT_DEG + SEGMENT_DEG / 2;
          return (
            <div
              key={n}
              className="absolute left-1/2 top-1/2 text-[9px] font-semibold text-gold-100"
              style={{
                transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(-${numberRadius}px)`,
              }}
            >
              {n}
            </div>
          );
        })}
        <div className="absolute inset-[30%] rounded-full border-2 border-gold-500 bg-noir-900 shadow-inner" />
      </div>

      <div
        className="pointer-events-none absolute inset-0"
        style={{
          transform: `rotate(${ballRotation}deg)`,
          transition: `transform 4200ms ${EASE}`,
        }}
      >
        <div className="absolute left-1/2 top-[8%] size-2.5 -translate-x-1/2 rounded-full bg-gold-100 shadow-[0_0_6px_rgba(255,255,255,0.8)]" />
      </div>

      {winningNumber !== null && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className={
              "flex size-11 items-center justify-center rounded-full border-2 text-lg font-bold shadow-lg " +
              (colorForNumber(winningNumber) === "red"
                ? "border-crimson-400 bg-crimson-500 text-white"
                : colorForNumber(winningNumber) === "black"
                  ? "border-white/30 bg-noir-900 text-white"
                  : "border-emerald-glow bg-felt-500 text-white")
            }
          >
            {winningNumber}
          </div>
        </div>
      )}
    </div>
  );
}
