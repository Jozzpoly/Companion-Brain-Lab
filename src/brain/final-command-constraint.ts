import type { StaticTraversalQuery } from "../navigation/static-router";
import type { Vec2 } from "../world/types";

const EPSILON = 1e-9;

export type FinalCommandConstraintSource = "continuity" | "preferred-fallback" | "stop-fallback";

export interface FinalCommandConstraintResult {
  source: FinalCommandConstraintSource;
  constrained: boolean;
  originalMove: Vec2;
  finalMove: Vec2;
  blockedBy: string | null;
  attemptedDistance: number;
  reason: string;
}

function magnitude(value: Vec2): number {
  return Math.hypot(value.x, value.y);
}

function clampMove(value: Vec2): Vec2 {
  const length = magnitude(value);
  if (length <= 1 || length <= EPSILON) return { ...value };
  return { x: value.x / length, y: value.y / length };
}

function endpoint(origin: Vec2, move: Vec2, maxSpeed: number, deltaSeconds: number): Vec2 {
  return {
    x: origin.x + move.x * maxSpeed * deltaSeconds,
    y: origin.y + move.y * maxSpeed * deltaSeconds
  };
}

export function constrainFinalCommand(options: {
  position: Vec2;
  radius: number;
  commandedMove: Vec2;
  preferredMoves: readonly Vec2[];
  maxSpeed: number;
  deltaSeconds: number;
  query: StaticTraversalQuery;
}): FinalCommandConstraintResult {
  if (!Number.isFinite(options.radius) || options.radius <= 0) {
    throw new Error("Final-command constraint requires a positive finite radius.");
  }
  if (!Number.isFinite(options.maxSpeed) || options.maxSpeed <= 0) {
    throw new Error("Final-command constraint requires a positive finite maxSpeed.");
  }
  if (!Number.isFinite(options.deltaSeconds) || options.deltaSeconds <= 0) {
    throw new Error("Final-command constraint requires a positive finite deltaSeconds.");
  }

  const originalMove = clampMove(options.commandedMove);
  const originalEnd = endpoint(options.position, originalMove, options.maxSpeed, options.deltaSeconds);
  const original = options.query(options.position, originalEnd, options.radius);
  if (original.clear) {
    return {
      source: "continuity",
      constrained: false,
      originalMove,
      finalMove: { ...originalMove },
      blockedBy: null,
      attemptedDistance: original.distance,
      reason: "final continuity command is hard-body safe"
    };
  }

  for (const candidateValue of options.preferredMoves) {
    const candidate = clampMove(candidateValue);
    if (magnitude(candidate) <= EPSILON) continue;
    const candidateEnd = endpoint(options.position, candidate, options.maxSpeed, options.deltaSeconds);
    const traversal = options.query(options.position, candidateEnd, options.radius);
    if (!traversal.clear) continue;
    return {
      source: "preferred-fallback",
      constrained: true,
      originalMove,
      finalMove: candidate,
      blockedBy: original.blocker?.label ?? "unknown",
      attemptedDistance: original.distance,
      reason: `continuity command hard-blocked by ${original.blocker?.label ?? "unknown"}; using hard-safe upstream preferred move`
    };
  }

  return {
    source: "stop-fallback",
    constrained: true,
    originalMove,
    finalMove: { x: 0, y: 0 },
    blockedBy: original.blocker?.label ?? "unknown",
    attemptedDistance: original.distance,
    reason: `continuity command hard-blocked by ${original.blocker?.label ?? "unknown"}; no hard-safe preferred fallback for this step`
  };
}
