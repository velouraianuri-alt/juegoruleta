// Parametric motion for the 2D wheel + ball. Nothing here decides the outcome —
// the winning number is already fixed server-side before this ever runs — but
// unlike a plain CSS `transition: transform`, this models real phases (launch,
// cruise, decel, bounces, settle) as an angle/radius state machine so the ball
// visually behaves like it has inertia, friction and energy loss, not just a
// rotate() tween.
//
// Exact-landing technique: the ball's *baseline* trajectory (ignoring bounce
// jitter) is written directly in terms of the final target angle — it starts
// many turns away and converges to exactly that angle by the end of the bounce
// window (BOUNCE_END), the same way a single easeOutQuint converges to 1. Bounce
// perturbations are added on top and are themselves designed to decay away
// before BOUNCE_END, so whatever tiny residual is left gets closed by a short,
// natural-looking final glide instead of a large corrective jump.
import { WHEEL_ORDER, SEGMENT_DEG, angleForNumber } from "../wheel-data";

export const SPIN_DURATION_NORMAL_MS = 9000;
export const SPIN_DURATION_FAST_MS = 4200;

// Radii as fractions of the wheel's outer radius — the canvas renderer maps
// these to pixels. RAIL is the outer track the ball orbits at high speed;
// POCKET is where it finally rests, inside the number ring.
export const BALL_RAIL_RADIUS = 0.93;
export const BALL_POCKET_RADIUS = 0.62;

// Normalized-time boundaries of each phase.
const ENTRY_START = 0.58; // ball starts leaving the rail, bounces begin
const BOUNCE_END = 0.89; // baseline trajectory has fully converged by here
// Fraction of [0, BOUNCE_END] spent at ~constant top speed before decelerating.
const CRUISE_FRACTION = 0.32;

function clamp01(t: number): number {
  return Math.min(1, Math.max(0, t));
}

function smoothstep(t: number, edge0: number, edge1: number): number {
  const x = clamp01((t - edge0) / (edge1 - edge0));
  return x * x * (3 - 2 * x);
}

function easeInOutCubic(t: number): number {
  const c = clamp01(t);
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
}

/** Trapezoidal velocity profile: constant top speed for the first CRUISE_FRACTION
 * of u, then a smooth (C1-continuous, no kink) quadratic decay to a full stop
 * exactly at u=1. Far gentler / more physical than a single easeOutQuint, which
 * dumps most of the rotation in the first ~15% of the window. */
function cruiseDecel(u: number): number {
  const c = clamp01(u);
  const v0 = 2 / (1 + CRUISE_FRACTION);
  if (c <= CRUISE_FRACTION) return v0 * c;
  const w = (c - CRUISE_FRACTION) / (1 - CRUISE_FRACTION);
  return v0 * CRUISE_FRACTION + v0 * (1 - CRUISE_FRACTION) * (w - (w * w) / 2);
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface BounceEvent {
  /** Local time within the bounce window [0,1] this impact occurs. */
  tLocal: number;
  angleKickDeg: number;
  freq: number;
  decayTau: number;
  radiusDip: number;
  radiusFreq: number;
  radiusDecayTau: number;
}

export interface SpinPlan2D {
  wheelDirection: 1 | -1;
  wheelTotalDeg: number;
  ballDirection: 1 | -1;
  ballExtraSweepDeg: number;
  ballFinalAngleDeg: number;
  bounces: BounceEvent[];
}

/** Builds one spin's plan. Call once per spin, when the server's result becomes known. */
export function buildSpinPlan2D(winningNumber: number, seed = Math.random()): SpinPlan2D {
  const rand = mulberry32(Math.floor(seed * 2 ** 31));

  const wheelDirection: 1 | -1 = 1;
  const ballDirection: 1 | -1 = -1;

  const wheelTurns = 3 + rand() * 1.5;
  const wheelTotalDeg = wheelTurns * 360;

  const ballExtraTurns = 9 + rand() * 4;
  const ballExtraSweepDeg = ballExtraTurns * 360;

  const wheelFinalWorldDeg = wheelDirection * wheelTotalDeg;
  const ballFinalAngleDeg = wheelFinalWorldDeg + angleForNumber(winningNumber);

  const bounceCount = 5 + Math.floor(rand() * 4);
  const bounces: BounceEvent[] = [];
  let cumTime = 0;
  const rawTimes: number[] = [];
  for (let i = 0; i < bounceCount; i++) {
    const gap = (1 - i / bounceCount) * (0.14 + rand() * 0.16);
    cumTime += gap;
    rawTimes.push(cumTime);
  }
  const maxRaw = rawTimes[rawTimes.length - 1] || 1;
  for (let i = 0; i < bounceCount; i++) {
    const tLocal = (rawTimes[i] / maxRaw) * 0.78;
    const energyDecay = Math.pow(0.62, i);
    bounces.push({
      tLocal,
      angleKickDeg: (rand() * 2 - 1) * (9 + rand() * 6) * energyDecay,
      freq: 3 + rand() * 3,
      decayTau: 0.045 + rand() * 0.035,
      radiusDip: (0.05 + rand() * 0.05) * energyDecay,
      radiusFreq: 4 + rand() * 3,
      radiusDecayTau: 0.03 + rand() * 0.025,
    });
  }

  return { wheelDirection, wheelTotalDeg, ballDirection, ballExtraSweepDeg, ballFinalAngleDeg, bounces };
}

export function wheelAngleDeg(plan: SpinPlan2D, t: number): number {
  return plan.wheelDirection * plan.wheelTotalDeg * cruiseDecel(t);
}

export interface BallPose2D {
  angleDeg: number;
  radiusFrac: number;
  /** 0 (still) .. 1 (fast) — drives the canvas motion-blur trail. */
  blur: number;
}

function bounceAngleOffset(plan: SpinPlan2D, tLocal: number): number {
  let sum = 0;
  for (const b of plan.bounces) {
    if (tLocal < b.tLocal) continue;
    const dt = tLocal - b.tLocal;
    sum += b.angleKickDeg * Math.exp(-dt / b.decayTau) * Math.sin(dt * b.freq * 20);
  }
  return sum;
}

function bounceRadiusOffset(plan: SpinPlan2D, tLocal: number): number {
  let sum = 0;
  for (const b of plan.bounces) {
    if (tLocal < b.tLocal) continue;
    const dt = tLocal - b.tLocal;
    // Positive-only (bounces kick the ball back outward off a separator, never inward past the rail).
    sum += b.radiusDip * Math.exp(-dt / b.radiusDecayTau) * Math.abs(Math.sin(dt * b.radiusFreq * 20));
  }
  return sum;
}

/** The ball's non-bounce trajectory: starts ballExtraSweepDeg away from the
 * target and converges to it exactly by BOUNCE_END, via the same trapezoidal
 * cruise-then-decelerate curve as the wheel. */
function baselineBallAngle(plan: SpinPlan2D, t: number): number {
  const u = clamp01(t / BOUNCE_END);
  const remaining = plan.ballExtraSweepDeg * (1 - cruiseDecel(u));
  return plan.ballFinalAngleDeg - plan.ballDirection * remaining;
}

function baselineRadius(t: number): number {
  const base = 1 - smoothstep(t, ENTRY_START, BOUNCE_END);
  return BALL_POCKET_RADIUS + (BALL_RAIL_RADIUS - BALL_POCKET_RADIUS) * base;
}

/** Ball's pose at normalized time t in [0,1]. Always continuous — the entry/bounce
 * phase can wander (bounce perturbations decay to ~0 by BOUNCE_END on their own),
 * and the short final glide (t > BOUNCE_END) closes whatever tiny gap remains, so
 * t=1 always lands precisely with no visible snap. */
export function ballPose2D(plan: SpinPlan2D, t: number): BallPose2D {
  const c = clamp01(t);

  if (c <= BOUNCE_END) {
    const tLocal = c < ENTRY_START ? 0 : (c - ENTRY_START) / (BOUNCE_END - ENTRY_START);
    const angleDeg = baselineBallAngle(plan, c) + bounceAngleOffset(plan, tLocal);
    const radiusFrac = clamp01(baselineRadius(c) + bounceRadiusOffset(plan, tLocal));
    // Blur stays high through the cruise, fades out across the deceleration
    // into the entry phase, and is fully gone once bounces begin.
    const blur = 1 - smoothstep(c, ENTRY_START * CRUISE_FRACTION, ENTRY_START);
    return { angleDeg, radiusFrac, blur };
  }

  const angleAtBounceEnd = baselineBallAngle(plan, BOUNCE_END) + bounceAngleOffset(plan, 1);
  const radiusAtBounceEnd = clamp01(baselineRadius(BOUNCE_END) + bounceRadiusOffset(plan, 1));

  const glide = easeInOutCubic((c - BOUNCE_END) / (1 - BOUNCE_END));
  const angleDeg = angleAtBounceEnd + (plan.ballFinalAngleDeg - angleAtBounceEnd) * glide;
  const radiusFrac = radiusAtBounceEnd + (BALL_POCKET_RADIUS - radiusAtBounceEnd) * glide;

  return { angleDeg, radiusFrac, blur: 0 };
}

export function pocketIndexForNumber(n: number): number {
  return WHEEL_ORDER.indexOf(n);
}

export { WHEEL_ORDER, SEGMENT_DEG, angleForNumber };
