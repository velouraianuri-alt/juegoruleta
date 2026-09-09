"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { sound } from "@/lib/sound";
import { colorForNumber } from "../wheel-data";
import {
  buildSpinPlan2D,
  wheelAngleDeg,
  ballPose2D,
  WHEEL_ORDER,
  SEGMENT_DEG,
  SPIN_DURATION_NORMAL_MS,
  type SpinPlan2D,
} from "./spin-physics-2d";

const SIZE = 400;
const CENTER = SIZE / 2;
const R_OUTER = 190;
const R_RIM_INNER = 180;
const R_POCKET_OUTER = 170;
const R_POCKET_INNER = 106;
const R_RING_OUTER = 98;
const R_RING_INNER = 78;
const R_HUB = 40;
const BALL_R = 6;
const SEPARATOR_HALF_DEG = 0.6;

const POCKET_FILL: Record<"red" | "black" | "green", [string, string]> = {
  red: ["#c8324a", "#7a0f21"],
  black: ["#2c2c2c", "#0a0a0a"],
  green: ["#1f8a54", "#0a3a24"],
};

const TRAIL_LENGTH = 7;

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}

/** deg=0 renders at the top (12 o'clock), matching the stationary pointer. */
function polar(cx: number, cy: number, radius: number, deg: number) {
  const rad = toRad(deg - 90);
  return { x: cx + Math.cos(rad) * radius, y: cy + Math.sin(rad) * radius };
}

function drawWedgePath(ctx: CanvasRenderingContext2D, startDeg: number, endDeg: number, rInner: number, rOuter: number) {
  const a0 = toRad(startDeg - 90);
  const a1 = toRad(endDeg - 90);
  ctx.beginPath();
  ctx.arc(0, 0, rOuter, a0, a1);
  ctx.arc(0, 0, rInner, a1, a0, true);
  ctx.closePath();
}

function drawRotor(ctx: CanvasRenderingContext2D, rotationDeg: number) {
  ctx.save();
  ctx.rotate(toRad(rotationDeg));

  // Base disc under the pockets.
  ctx.beginPath();
  ctx.arc(0, 0, R_POCKET_OUTER + 4, 0, Math.PI * 2);
  ctx.fillStyle = "#050b07";
  ctx.fill();

  for (let i = 0; i < WHEEL_ORDER.length; i++) {
    const n = WHEEL_ORDER[i];
    const start = i * SEGMENT_DEG + SEPARATOR_HALF_DEG;
    const end = (i + 1) * SEGMENT_DEG - SEPARATOR_HALF_DEG;
    const mid = (start + end) / 2;
    const color = colorForNumber(n);
    const [light, dark] = POCKET_FILL[color];

    drawWedgePath(ctx, start, end, R_POCKET_INNER, R_POCKET_OUTER);
    const grad = ctx.createRadialGradient(0, 0, R_POCKET_INNER, 0, 0, R_POCKET_OUTER);
    grad.addColorStop(0, dark);
    grad.addColorStop(0.65, light);
    grad.addColorStop(1, dark);
    ctx.fillStyle = grad;
    ctx.fill();

    // Recessed inner-edge shadow for pocket depth.
    drawWedgePath(ctx, start, end, R_POCKET_INNER, R_POCKET_INNER + 8);
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fill();

    // Number, upright along the radial direction.
    const textPos = polar(0, 0, (R_POCKET_INNER + R_POCKET_OUTER) / 2, mid);
    ctx.save();
    ctx.translate(textPos.x, textPos.y);
    ctx.rotate(toRad(mid));
    ctx.fillStyle = color === "black" ? "#f0d98a" : "#faf3e2";
    ctx.font = "700 13px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur = 2;
    ctx.fillText(String(n), 0, 0);
    ctx.restore();
  }

  // Separators — thin metallic gold wedges at each pocket boundary.
  for (let i = 0; i < WHEEL_ORDER.length; i++) {
    const boundary = i * SEGMENT_DEG;
    drawWedgePath(ctx, boundary - SEPARATOR_HALF_DEG - 0.15, boundary + SEPARATOR_HALF_DEG + 0.15, R_POCKET_INNER - 2, R_POCKET_OUTER + 3);
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fill();
    drawWedgePath(ctx, boundary - SEPARATOR_HALF_DEG, boundary + SEPARATOR_HALF_DEG, R_POCKET_INNER, R_POCKET_OUTER + 2);
    const sepGrad = ctx.createLinearGradient(0, -R_POCKET_OUTER, 0, R_POCKET_OUTER);
    sepGrad.addColorStop(0, "#f3e0a0");
    sepGrad.addColorStop(0.5, "#c9a44c");
    sepGrad.addColorStop(1, "#8a6a24");
    ctx.fillStyle = sepGrad;
    ctx.fill();
  }

  // Inner decorative ring.
  ctx.beginPath();
  ctx.arc(0, 0, R_RING_OUTER, 0, Math.PI * 2);
  ctx.arc(0, 0, R_RING_INNER, 0, Math.PI * 2, true);
  const ringGrad = ctx.createRadialGradient(0, 0, R_RING_INNER, 0, 0, R_RING_OUTER);
  ringGrad.addColorStop(0, "#8a6a24");
  ringGrad.addColorStop(0.5, "#e9d192");
  ringGrad.addColorStop(1, "#8a6a24");
  ctx.fillStyle = ringGrad;
  ctx.fill();

  // Hub.
  ctx.beginPath();
  ctx.arc(0, 0, R_HUB, 0, Math.PI * 2);
  const hubGrad = ctx.createRadialGradient(-R_HUB * 0.3, -R_HUB * 0.3, 2, 0, 0, R_HUB);
  hubGrad.addColorStop(0, "#fbf0cf");
  hubGrad.addColorStop(0.6, "#d4af37");
  hubGrad.addColorStop(1, "#7a5c1e");
  ctx.fillStyle = hubGrad;
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 2;
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  ctx.beginPath();
  ctx.arc(-R_HUB * 0.25, -R_HUB * 0.25, R_HUB * 0.22, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.fill();

  ctx.restore();
}

function drawBowl(ctx: CanvasRenderingContext2D) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, R_OUTER, 0, Math.PI * 2);
  ctx.arc(0, 0, R_RIM_INNER, 0, Math.PI * 2, true);
  const grad = ctx.createLinearGradient(-R_OUTER, -R_OUTER, R_OUTER, R_OUTER);
  grad.addColorStop(0, "#f3e0a0");
  grad.addColorStop(0.3, "#8a6a24");
  grad.addColorStop(0.55, "#e9d192");
  grad.addColorStop(0.8, "#8a6a24");
  grad.addColorStop(1, "#f3e0a0");
  ctx.fillStyle = grad;
  ctx.shadowColor = "rgba(0,0,0,0.55)";
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 4;
  ctx.fill();
  ctx.restore();

  // Fixed top pointer.
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, -R_OUTER - 14);
  ctx.lineTo(-6, -R_OUTER - 2);
  ctx.lineTo(6, -R_OUTER - 2);
  ctx.closePath();
  ctx.fillStyle = "#e9d192";
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 3;
  ctx.fill();
  ctx.restore();
}

function drawBall(
  ctx: CanvasRenderingContext2D,
  pos: { x: number; y: number },
  trail: { x: number; y: number }[],
  blur: number,
) {
  if (blur > 0.08) {
    for (let i = 0; i < trail.length; i++) {
      const p = trail[i];
      const age = (i + 1) / trail.length;
      ctx.beginPath();
      ctx.arc(p.x, p.y, BALL_R * (0.55 + 0.35 * age), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(250,246,236,${0.05 + blur * 0.18 * age})`;
      ctx.fill();
    }
  }

  ctx.beginPath();
  ctx.ellipse(pos.x, pos.y + BALL_R * 0.85, BALL_R * 0.9, BALL_R * 0.35, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.fill();

  ctx.beginPath();
  ctx.arc(pos.x, pos.y, BALL_R, 0, Math.PI * 2);
  const grad = ctx.createRadialGradient(
    pos.x - BALL_R * 0.35,
    pos.y - BALL_R * 0.4,
    0.5,
    pos.x,
    pos.y,
    BALL_R * 1.1,
  );
  grad.addColorStop(0, "#ffffff");
  grad.addColorStop(0.5, "#f2ede0");
  grad.addColorStop(1, "#a89f8c");
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.lineWidth = 0.5;
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(pos.x - BALL_R * 0.32, pos.y - BALL_R * 0.35, BALL_R * 0.32, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fill();
}

export function RouletteWheel2D({
  spinToken,
  winningNumber,
  durationMs = SPIN_DURATION_NORMAL_MS,
  onSettled,
  className,
  maxWidth = 320,
}: {
  spinToken: number;
  winningNumber: number | null;
  durationMs?: number;
  onSettled?: () => void;
  className?: string;
  /** CSS px cap on the wheel's displayed size — animates smoothly when it
   * changes (e.g. growing once betting closes and it becomes the sole focus). */
  maxWidth?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const planRef = useRef<SpinPlan2D | null>(null);
  const lastTokenRef = useRef(0);
  const startRef = useRef<number | null>(null);
  const progressRef = useRef<number | null>(null);
  const wheelRotRef = useRef(0);
  const trailRef = useRef<{ x: number; y: number }[]>([]);
  const rafRef = useRef<number | null>(null);
  const settledRef = useRef(false);
  const tickTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const dprRef = useRef(1);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = dprRef.current;
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, SIZE, SIZE);

    const bgGrad = ctx.createRadialGradient(CENTER, CENTER * 0.85, 20, CENTER, CENTER, R_OUTER + 40);
    bgGrad.addColorStop(0, "#123322");
    bgGrad.addColorStop(0.55, "#0a2015");
    bgGrad.addColorStop(1, "#05100b");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, SIZE, SIZE);

    ctx.translate(CENTER, CENTER);
    drawBowl(ctx);
    drawRotor(ctx, wheelRotRef.current);

    const plan = planRef.current;
    const progress = progressRef.current;
    if (plan && progress !== null) {
      const pose = ballPose2D(plan, progress);
      const p = polar(0, 0, pose.radiusFrac * R_OUTER, pose.angleDeg);
      trailRef.current.push(p);
      if (trailRef.current.length > TRAIL_LENGTH) trailRef.current.shift();
      drawBall(ctx, p, trailRef.current.slice(0, -1), pose.blur);
    }

    ctx.restore();
  };

  // Sizes the canvas for the device's pixel ratio and draws the resting wheel —
  // runs once on mount, before any spin has started.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    dprRef.current = dpr;
    canvas.width = SIZE * dpr;
    canvas.height = SIZE * dpr;
    draw();
     
  }, []);

  useEffect(() => {
    if (spinToken === lastTokenRef.current || winningNumber === null) return;
    lastTokenRef.current = spinToken;
    settledRef.current = false;

    const plan = buildSpinPlan2D(winningNumber);
    planRef.current = plan;
    progressRef.current = 0;
    startRef.current = null;
    trailRef.current = [];

    sound.spinStart();
    sound.wheelHum(durationMs);
    tickTimers.current.forEach(clearTimeout);
    tickTimers.current = [];
    for (const b of plan.bounces) {
      const ms = b.tLocal * (0.89 - 0.58) * durationMs + 0.58 * durationMs;
      tickTimers.current.push(setTimeout(() => sound.ballBounce(), ms));
    }
    tickTimers.current.push(setTimeout(() => sound.settle(), durationMs));
    tickTimers.current.push(setTimeout(() => sound.win(), durationMs + 150));

    const loop = (now: number) => {
      if (startRef.current === null) startRef.current = now;
      const elapsed = now - startRef.current;
      const t = Math.min(1, elapsed / durationMs);
      progressRef.current = t;
      if (planRef.current) wheelRotRef.current = wheelAngleDeg(planRef.current, t);
      draw();

      if (t < 1) {
        rafRef.current = requestAnimationFrame(loop);
      } else if (!settledRef.current) {
        settledRef.current = true;
        onSettled?.();
      }
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      tickTimers.current.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinToken, winningNumber, durationMs]);

  return (
    <motion.div
      className={className}
      animate={{ maxWidth }}
      transition={{ type: "spring", stiffness: 180, damping: 24 }}
      style={{
        width: "100%",
        aspectRatio: "1 / 1",
        borderRadius: "9999px",
        overflow: "hidden",
      }}
    >
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
    </motion.div>
  );
}
