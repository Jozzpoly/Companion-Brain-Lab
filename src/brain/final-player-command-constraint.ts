import type { StaticTraversalQuery } from "../navigation/static-router";
import type { ActorSnapshot, Vec2, WorldSnapshot } from "../world/types";

const EPSILON = 1e-9;
const EGRESS_TOLERANCE = 1e-6;
const PLAYER_VELOCITY_OBSERVATION_THRESHOLD = 0.08;
const PROJECTION_ITERATIONS = 28;

/**
 * This is deliberately much smaller than S3_PLAYER_BUFFER. The final gate is
 * physical authority, not comfort/right-of-way policy.
 */
export const R1_FINAL_PLAYER_HARD_MARGIN = 0.002;

export type FinalPlayerCommandConstraintSource =
  | "unchanged"
  | "projected-preferred"
  | "projected-stop"
  | "preferred-fallback"
  | "stop-fallback"
  | "best-effort";

export interface FinalPlayerCommandConstraintResult {
  source: FinalPlayerCommandConstraintSource;
  constrained: boolean;
  originalMove: Vec2;
  finalMove: Vec2;
  currentPhysicalClearance: number;
  requiredPhysicalClearance: number;
  originalPredictedClearance: number;
  finalPredictedClearance: number;
  fallbackIndex: number | null;
  reason: string;
}

function magnitude(value: Vec2): number {
  return Math.hypot(value.x, value.y);
}

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function dot(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.y * b.y;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function finiteMove(value: Vec2, label: string): Vec2 {
  if (!Number.isFinite(value.x) || !Number.isFinite(value.y)) {
    throw new Error(`${label} requires finite x/y components.`);
  }
  const length = magnitude(value);
  if (length <= 1 || length <= EPSILON) return { ...value };
  return { x: value.x / length, y: value.y / length };
}

function actor(snapshot: WorldSnapshot, id: ActorSnapshot["id"]): ActorSnapshot {
  const value = snapshot.actors.find((entry) => entry.id === id);
  if (!value) throw new Error(`Final player-command constraint requires ${id} snapshot.`);
  return value;
}

function observedPlayerVelocity(player: ActorSnapshot): Vec2 {
  return magnitude(player.actualVelocity) > PLAYER_VELOCITY_OBSERVATION_THRESHOLD
    ? { ...player.actualVelocity }
    : { ...player.requestedVelocity };
}

function lerp(a: Vec2, b: Vec2, alpha: number): Vec2 {
  return {
    x: a.x + (b.x - a.x) * alpha,
    y: a.y + (b.y - a.y) * alpha
  };
}

function endpoint(origin: Vec2, move: Vec2, maxSpeed: number, deltaSeconds: number): Vec2 {
  return {
    x: origin.x + move.x * maxSpeed * deltaSeconds,
    y: origin.y + move.y * maxSpeed * deltaSeconds
  };
}

export function finalPlayerPredictedPhysicalClearance(options: {
  snapshot: WorldSnapshot;
  move: Vec2;
  maxSpeed: number;
  deltaSeconds: number;
}): number {
  if (!Number.isFinite(options.maxSpeed) || options.maxSpeed <= 0) {
    throw new Error("Final player-command clearance requires a positive finite maxSpeed.");
  }
  if (!Number.isFinite(options.deltaSeconds) || options.deltaSeconds <= 0) {
    throw new Error("Final player-command clearance requires a positive finite deltaSeconds.");
  }

  const companion = actor(options.snapshot, "companion");
  const player = actor(options.snapshot, "player");
  const move = finiteMove(options.move, "Final player-command move");
  const companionVelocity = {
    x: move.x * options.maxSpeed,
    y: move.y * options.maxSpeed
  };
  const playerVelocity = observedPlayerVelocity(player);
  const relativePosition = {
    x: player.position.x - companion.position.x,
    y: player.position.y - companion.position.y
  };
  const relativeVelocity = {
    x: playerVelocity.x - companionVelocity.x,
    y: playerVelocity.y - companionVelocity.y
  };
  const relativeSpeedSquared = dot(relativeVelocity, relativeVelocity);
  const closestTime = relativeSpeedSquared > EPSILON
    ? clamp(-dot(relativePosition, relativeVelocity) / relativeSpeedSquared, 0, options.deltaSeconds)
    : 0;
  const closest = {
    x: relativePosition.x + relativeVelocity.x * closestTime,
    y: relativePosition.y + relativeVelocity.y * closestTime
  };

  return magnitude(closest) - (companion.radius + player.radius);
}

export function finalPlayerCurrentPhysicalClearance(snapshot: WorldSnapshot): number {
  const companion = actor(snapshot, "companion");
  const player = actor(snapshot, "player");
  return distance(companion.position, player.position) - (companion.radius + player.radius);
}

export function finalPlayerRequiredPhysicalClearance(snapshot: WorldSnapshot): number {
  const current = finalPlayerCurrentPhysicalClearance(snapshot);

  // When already touching/overlapping, swept minimum distance necessarily
  // includes t=0. Require the command not to make the state materially worse,
  // so egress remains admissible instead of creating a clearance prison.
  if (current <= 0) return current - EGRESS_TOLERANCE;

  return Math.max(0, Math.min(R1_FINAL_PLAYER_HARD_MARGIN, current - EGRESS_TOLERANCE));
}

function staticSafe(options: {
  position: Vec2;
  radius: number;
  move: Vec2;
  maxSpeed: number;
  deltaSeconds: number;
  query: StaticTraversalQuery;
}): boolean {
  const end = endpoint(options.position, options.move, options.maxSpeed, options.deltaSeconds);
  return options.query(options.position, end, options.radius).clear;
}

function dynamicClearance(options: {
  snapshot: WorldSnapshot;
  move: Vec2;
  maxSpeed: number;
  deltaSeconds: number;
}): number {
  return finalPlayerPredictedPhysicalClearance(options);
}

function projectTowardDynamicSafeEndpoint(options: {
  snapshot: WorldSnapshot;
  unsafe: Vec2;
  safe: Vec2;
  required: number;
  maxSpeed: number;
  deltaSeconds: number;
}): Vec2 {
  let low = 0;
  let high = 1;
  for (let index = 0; index < PROJECTION_ITERATIONS; index += 1) {
    const alpha = (low + high) / 2;
    const candidate = lerp(options.unsafe, options.safe, alpha);
    const clearance = dynamicClearance({
      snapshot: options.snapshot,
      move: candidate,
      maxSpeed: options.maxSpeed,
      deltaSeconds: options.deltaSeconds
    });
    if (clearance >= options.required) high = alpha;
    else low = alpha;
  }
  return lerp(options.unsafe, options.safe, high);
}

export function constrainFinalPlayerCommand(options: {
  snapshot: WorldSnapshot;
  commandedMove: Vec2;
  preferredMoves: readonly Vec2[];
  maxSpeed: number;
  deltaSeconds: number;
  query: StaticTraversalQuery;
}): FinalPlayerCommandConstraintResult {
  if (!Number.isFinite(options.maxSpeed) || options.maxSpeed <= 0) {
    throw new Error("Final player-command constraint requires a positive finite maxSpeed.");
  }
  if (!Number.isFinite(options.deltaSeconds) || options.deltaSeconds <= 0) {
    throw new Error("Final player-command constraint requires a positive finite deltaSeconds.");
  }

  const companion = actor(options.snapshot, "companion");
  const originalMove = finiteMove(options.commandedMove, "Final player commanded move");
  const currentPhysicalClearance = finalPlayerCurrentPhysicalClearance(options.snapshot);
  const requiredPhysicalClearance = finalPlayerRequiredPhysicalClearance(options.snapshot);
  const originalPredictedClearance = dynamicClearance({
    snapshot: options.snapshot,
    move: originalMove,
    maxSpeed: options.maxSpeed,
    deltaSeconds: options.deltaSeconds
  });
  const originalStaticSafe = staticSafe({
    position: companion.position,
    radius: companion.radius,
    move: originalMove,
    maxSpeed: options.maxSpeed,
    deltaSeconds: options.deltaSeconds,
    query: options.query
  });

  if (originalStaticSafe && originalPredictedClearance >= requiredPhysicalClearance) {
    return {
      source: "unchanged",
      constrained: false,
      originalMove,
      finalMove: { ...originalMove },
      currentPhysicalClearance,
      requiredPhysicalClearance,
      originalPredictedClearance,
      finalPredictedClearance: originalPredictedClearance,
      fallbackIndex: null,
      reason: "final command preserves static safety and player physical authority"
    };
  }

  const fallbackMoves = [
    ...options.preferredMoves.map((move) => finiteMove(move, "Final player preferred move")),
    { x: 0, y: 0 }
  ];

  for (let index = 0; index < fallbackMoves.length; index += 1) {
    const fallback = fallbackMoves[index];
    if (!fallback) continue;
    const fallbackStaticSafe = staticSafe({
      position: companion.position,
      radius: companion.radius,
      move: fallback,
      maxSpeed: options.maxSpeed,
      deltaSeconds: options.deltaSeconds,
      query: options.query
    });
    if (!fallbackStaticSafe) continue;

    const fallbackClearance = dynamicClearance({
      snapshot: options.snapshot,
      move: fallback,
      maxSpeed: options.maxSpeed,
      deltaSeconds: options.deltaSeconds
    });
    if (fallbackClearance < requiredPhysicalClearance) continue;

    const projected = projectTowardDynamicSafeEndpoint({
      snapshot: options.snapshot,
      unsafe: originalMove,
      safe: fallback,
      required: requiredPhysicalClearance,
      maxSpeed: options.maxSpeed,
      deltaSeconds: options.deltaSeconds
    });
    const projectedClearance = dynamicClearance({
      snapshot: options.snapshot,
      move: projected,
      maxSpeed: options.maxSpeed,
      deltaSeconds: options.deltaSeconds
    });
    const projectedStaticSafe = staticSafe({
      position: companion.position,
      radius: companion.radius,
      move: projected,
      maxSpeed: options.maxSpeed,
      deltaSeconds: options.deltaSeconds,
      query: options.query
    });

    if (projectedStaticSafe && projectedClearance >= requiredPhysicalClearance - EGRESS_TOLERANCE) {
      const isStop = index === fallbackMoves.length - 1;
      return {
        source: isStop ? "projected-stop" : "projected-preferred",
        constrained: true,
        originalMove,
        finalMove: projected,
        currentPhysicalClearance,
        requiredPhysicalClearance,
        originalPredictedClearance,
        finalPredictedClearance: projectedClearance,
        fallbackIndex: isStop ? null : index,
        reason: isStop
          ? "final command threatened player physical authority; projected toward a hard-safe stop"
          : `final command threatened player physical authority; projected toward hard-safe preferred move ${index}`
      };
    }

    const isStop = index === fallbackMoves.length - 1;
    return {
      source: isStop ? "stop-fallback" : "preferred-fallback",
      constrained: true,
      originalMove,
      finalMove: { ...fallback },
      currentPhysicalClearance,
      requiredPhysicalClearance,
      originalPredictedClearance,
      finalPredictedClearance: fallbackClearance,
      fallbackIndex: isStop ? null : index,
      reason: isStop
        ? "dynamic projection could not preserve static safety; using hard-safe stop"
        : `dynamic projection could not preserve static safety; using hard-safe preferred move ${index}`
    };
  }

  // If the player's own motion makes the required separation impossible this
  // frame, the companion cannot guarantee the target clearance. Pick the
  // statically-safe command that maximizes physical separation instead of
  // throwing or pretending the authority contract was satisfied.
  const bestEffortCandidates = [originalMove, ...fallbackMoves];
  let bestMove = originalMove;
  let bestClearance = Number.NEGATIVE_INFINITY;
  for (const candidate of bestEffortCandidates) {
    if (!staticSafe({
      position: companion.position,
      radius: companion.radius,
      move: candidate,
      maxSpeed: options.maxSpeed,
      deltaSeconds: options.deltaSeconds,
      query: options.query
    })) continue;
    const clearance = dynamicClearance({
      snapshot: options.snapshot,
      move: candidate,
      maxSpeed: options.maxSpeed,
      deltaSeconds: options.deltaSeconds
    });
    if (clearance > bestClearance) {
      bestClearance = clearance;
      bestMove = candidate;
    }
  }

  return {
    source: "best-effort",
    constrained: true,
    originalMove,
    finalMove: { ...bestMove },
    currentPhysicalClearance,
    requiredPhysicalClearance,
    originalPredictedClearance,
    finalPredictedClearance: bestClearance,
    fallbackIndex: null,
    reason: "no command can satisfy the player hard-clearance target this frame; using statically-safe maximum-separation best effort"
  };
}
