// Parametric (not physics-engine) motion for the wheel + ball. The winning number
// is already decided server-side before any of this runs (fn_settle_roulette_round)
// — the animation's only job is to *represent* that result convincingly, so the
// curve is built to guarantee an exact landing rather than simulate rigid-body
// collisions and hope they converge on the right pocket. This is the same
// technique real online-casino roulette products use for exactly that reason.
import { WHEEL_ORDER, SEGMENT_DEG, angleForNumber } from "../wheel-data";

export const SPIN_DURATION_NORMAL_MS = 9500;
export const SPIN_DURATION_FAST_MS = 4200;

export const WHEEL_OUTER_RADIUS = 3.1;
export const WHEEL_TRACK_RADIUS = 2.55; // ball's outer-orbit radius
export const WHEEL_POCKET_RADIUS = 1.95; // ball's resting radius, inside the pocket ring

function easeOutQuint(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return 1 - Math.pow(1 - c, 5);
}

function clamp01(t: number): number {
  return Math.min(1, Math.max(0, t));
}

function smoothstep(t: number, edge0: number, edge1: number): number {
  const x = clamp01((t - edge0) / (edge1 - edge0));
  return x * x * (3 - 2 * x);
}

/** Simple deterministic PRNG from a numeric seed — cosmetic variation only. */
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

export interface SpinPlan {
  /** Total wheel rotation in degrees over the whole spin (positive = one direction). */
  wheelTotalDeg: number;
  /** Ball's final resting angle in world degrees (matches the wheel's final position). */
  ballFinalAngleDeg: number;
  /** Total degrees the ball travels backward from its landing spot (visual spin count). */
  ballTotalDeg: number;
  bounceFreq: number;
  bouncePhase: number;
  radialBounceFreq: number;
  hopFreq: number;
}

/** Builds one spin's plan. Call once per spin (on the client that starts watching it). */
export function buildSpinPlan(winningNumber: number, seed = Math.random()): SpinPlan {
  const rand = mulberry32(Math.floor(seed * 2 ** 31));
  const wheelSpins = 4 + Math.floor(rand() * 2); // 4-5 full turns
  const wheelTotalDeg = wheelSpins * 360 + ((-angleForNumber(winningNumber) % 360) + 360) % 360;

  const ballSpins = 7 + Math.floor(rand() * 3); // 7-9 full turns, opposite direction
  // Ball settles at the pocket's world position once the wheel stops.
  const ballFinalAngleDeg = (wheelTotalDeg % 360) + angleForNumber(winningNumber);
  const ballTotalDeg = ballSpins * 360 + rand() * SEGMENT_DEG;

  return {
    wheelTotalDeg,
    ballFinalAngleDeg,
    ballTotalDeg,
    bounceFreq: 18 + rand() * 6,
    bouncePhase: rand() * Math.PI * 2,
    radialBounceFreq: 14 + rand() * 5,
    hopFreq: 22 + rand() * 8,
  };
}

/** Wheel's rotation (degrees) at normalized time t in [0,1]. */
export function wheelRotationDeg(plan: SpinPlan, t: number): number {
  return plan.wheelTotalDeg * easeOutQuint(t);
}

export interface BallPose {
  /** World-space angle in degrees (0 = the fixed top pointer). */
  angleDeg: number;
  radius: number;
  hop: number;
}

/** Ball's world-space pose at normalized time t in [0,1]. */
export function ballPose(plan: SpinPlan, t: number): BallPose {
  const c = clamp01(t);
  // Fades out well before t=1 so the final landing position is always exact.
  const bounceEnvelope = smoothstep(c, 0.5, 0.8) * (1 - smoothstep(c, 0.86, 0.97));
  const angleJitter = bounceEnvelope * SEGMENT_DEG * 0.6 * Math.sin(plan.bounceFreq * c + plan.bouncePhase);

  const angleDeg =
    plan.ballFinalAngleDeg - plan.ballTotalDeg * (1 - easeOutQuint(c)) + angleJitter;

  const spiralIn = smoothstep(c, 0.55, 0.88);
  const radialJitter = bounceEnvelope * 0.12 * Math.sin(plan.radialBounceFreq * c);
  const radius =
    WHEEL_TRACK_RADIUS - (WHEEL_TRACK_RADIUS - WHEEL_POCKET_RADIUS) * spiralIn + radialJitter;

  const hopEnvelope = smoothstep(c, 0.55, 0.78) * (1 - smoothstep(c, 0.82, 0.95));
  const hop = hopEnvelope * 0.22 * Math.abs(Math.sin(plan.hopFreq * c));

  return { angleDeg, radius, hop };
}

export function pocketIndexForNumber(n: number): number {
  return WHEEL_ORDER.indexOf(n);
}
