import type { A1DirectCandidateRealization } from "./a1-companion-candidates";
import type { A1PlayerFutureHypothesis } from "./a1-player-future-hypotheses";
import type { A1Situation } from "./a1-situation";
import type { Vec2 } from "../world/types";

const EPSILON = 1e-8;
const EVIDENCE_EPSILON = 1e-6;

export type A1HardRadiusPhysicalState =
  | "CLEAR"
  | "TOUCH_ONLY"
  | "OVERLAP_PREDICTED";

export type A1HardRadiusPlayerPhase = "PLAYER_MOVING" | "PLAYER_STOPPED_AFTER_STATIC_CLIP";

export interface A1HardRadiusLinearActor {
  origin: Vec2;
  velocity: Vec2;
  radius: number;
}

export interface A1HardRadiusPiecewisePlayer extends A1HardRadiusLinearActor {
  /**
   * Player follows `velocity` until this absolute time within the horizon,
   * then remains at that reached point. For an unclipped future this equals
   * the full horizon; for an immediate stop it is zero.
   */
  movingUntilSeconds: number;
}

export interface A1HardRadiusSafetyInput {
  sourceTick: number;
  horizonSeconds: number;
  companion: A1HardRadiusLinearActor;
  player: A1HardRadiusPiecewisePlayer;
}

export interface A1HardRadiusSafetySegmentEvidence {
  phase: A1HardRadiusPlayerPhase;
  startTimeSeconds: number;
  endTimeSeconds: number;
  playerVelocity: Vec2;
  companionVelocity: Vec2;
  relativeVelocity: Vec2;
  closestApproachTimeSeconds: number;
  closestCenterDistance: number;
  hardClearance: number;
  playerAtClosestApproach: Vec2;
  companionAtClosestApproach: Vec2;
}

export interface A1HardRadiusSafetyEvidence {
  kind: "A1_HARD_RADIUS_PIECEWISE_SAFETY";
  sourceTick: number;
  horizonSeconds: number;
  hardRadiusThreshold: number;
  playerMovingUntilSeconds: number;
  segments: readonly A1HardRadiusSafetySegmentEvidence[];
  closestApproachTimeSeconds: number;
  closestCenterDistance: number;
  hardClearance: number;
  physicalState: A1HardRadiusPhysicalState;
  closestPhase: A1HardRadiusPlayerPhase;
  playerAtClosestApproach: Vec2;
  companionAtClosestApproach: Vec2;
  comfortEnvelopeClaim: "NONE_A1_2E_HARD_RADII_ONLY";
  staticLegalityClaim: "NONE_A1_2E_PRIMITIVE_ONLY";
  cooperationClaim: "NONE_A1_2E_PRIMITIVE_ONLY";
  gateAuthorityClaim: "NONE_A1_2E_PRIMITIVE_ONLY";
}

export interface A1DirectHardRadiusSafetyEvidence extends A1HardRadiusSafetyEvidence {
  candidateId: string;
  candidateFamily: A1DirectCandidateRealization["family"];
  playerFutureId: string;
  playerFutureFamily: A1PlayerFutureHypothesis["family"];
  playerStaticClipped: boolean;
  playerStaticClipFraction: number;
  inputProvenance: "QUALIFIED_A1_2B_DIRECT_PLUS_A1_2C_PLAYER_FUTURE";
}

function isFiniteVector(value: Vec2): boolean {
  return Number.isFinite(value.x) && Number.isFinite(value.y);
}

function finiteVector(value: Vec2, label: string): Vec2 {
  if (!isFiniteVector(value)) throw new Error(`${label} requires finite x/y components.`);
  return { ...value };
}

function magnitude(value: Vec2): number {
  return Math.hypot(value.x, value.y);
}

function dot(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.y * b.y;
}

function addScaled(origin: Vec2, velocity: Vec2, time: number): Vec2 {
  return {
    x: origin.x + velocity.x * time,
    y: origin.y + velocity.y * time
  };
}

function subtract(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function vectorDistance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function validatedRadius(value: number, label: string): number {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${label} must be positive and finite.`);
  return value;
}

function playerPositionAt(player: A1HardRadiusPiecewisePlayer, time: number): Vec2 {
  const movingTime = Math.min(time, player.movingUntilSeconds);
  return addScaled(player.origin, player.velocity, movingTime);
}

function companionPositionAt(companion: A1HardRadiusLinearActor, time: number): Vec2 {
  return addScaled(companion.origin, companion.velocity, time);
}

function segmentEvidence(input: {
  companion: A1HardRadiusLinearActor;
  player: A1HardRadiusPiecewisePlayer;
  threshold: number;
  phase: A1HardRadiusPlayerPhase;
  start: number;
  end: number;
  playerVelocity: Vec2;
}): A1HardRadiusSafetySegmentEvidence {
  const duration = input.end - input.start;
  const playerStart = playerPositionAt(input.player, input.start);
  const companionStart = companionPositionAt(input.companion, input.start);
  const relativePosition = subtract(companionStart, playerStart);
  const relativeVelocity = subtract(input.companion.velocity, input.playerVelocity);
  const relativeSpeedSquared = dot(relativeVelocity, relativeVelocity);
  const localClosest = relativeSpeedSquared > EPSILON
    ? clamp(-dot(relativePosition, relativeVelocity) / relativeSpeedSquared, 0, duration)
    : 0;
  const closestTime = input.start + localClosest;
  const playerAtClosest = addScaled(playerStart, input.playerVelocity, localClosest);
  const companionAtClosest = addScaled(companionStart, input.companion.velocity, localClosest);
  const distance = vectorDistance(playerAtClosest, companionAtClosest);

  return {
    phase: input.phase,
    startTimeSeconds: input.start,
    endTimeSeconds: input.end,
    playerVelocity: { ...input.playerVelocity },
    companionVelocity: { ...input.companion.velocity },
    relativeVelocity,
    closestApproachTimeSeconds: closestTime,
    closestCenterDistance: distance,
    hardClearance: distance - input.threshold,
    playerAtClosestApproach: playerAtClosest,
    companionAtClosestApproach: companionAtClosest
  };
}

/**
 * Pure G3 research primitive. It computes closest hard-body approach for a
 * constant-velocity DIRECT companion and a player that may move linearly until
 * one static-contact time and then stop. It deliberately knows nothing about
 * comfort envelopes, candidate selection, cooperation or World authority.
 */
export function evaluateA1HardRadiusPiecewiseSafety(
  input: A1HardRadiusSafetyInput
): A1HardRadiusSafetyEvidence {
  if (!Number.isInteger(input.sourceTick) || input.sourceTick < 0) {
    throw new Error("A1.2e safety sourceTick must be a non-negative integer.");
  }
  if (!Number.isFinite(input.horizonSeconds) || input.horizonSeconds <= 0) {
    throw new Error("A1.2e safety horizonSeconds must be positive and finite.");
  }

  const companion: A1HardRadiusLinearActor = {
    origin: finiteVector(input.companion.origin, "A1.2e companion origin"),
    velocity: finiteVector(input.companion.velocity, "A1.2e companion velocity"),
    radius: validatedRadius(input.companion.radius, "A1.2e companion radius")
  };
  const player: A1HardRadiusPiecewisePlayer = {
    origin: finiteVector(input.player.origin, "A1.2e player origin"),
    velocity: finiteVector(input.player.velocity, "A1.2e player velocity"),
    radius: validatedRadius(input.player.radius, "A1.2e player radius"),
    movingUntilSeconds: input.player.movingUntilSeconds
  };
  if (
    !Number.isFinite(player.movingUntilSeconds) ||
    player.movingUntilSeconds < 0 ||
    player.movingUntilSeconds > input.horizonSeconds
  ) {
    throw new Error("A1.2e player movingUntilSeconds must lie within the safety horizon.");
  }

  const threshold = companion.radius + player.radius;
  const segments: A1HardRadiusSafetySegmentEvidence[] = [];
  if (player.movingUntilSeconds > EPSILON) {
    segments.push(segmentEvidence({
      companion,
      player,
      threshold,
      phase: "PLAYER_MOVING",
      start: 0,
      end: player.movingUntilSeconds,
      playerVelocity: player.velocity
    }));
  }
  if (player.movingUntilSeconds < input.horizonSeconds - EPSILON) {
    segments.push(segmentEvidence({
      companion,
      player,
      threshold,
      phase: "PLAYER_STOPPED_AFTER_STATIC_CLIP",
      start: player.movingUntilSeconds,
      end: input.horizonSeconds,
      playerVelocity: { x: 0, y: 0 }
    }));
  }
  if (segments.length === 0) {
    // This only occurs for a numerically zero/full boundary after epsilon
    // classification. Preserve one deterministic whole-horizon segment.
    const stopped = player.movingUntilSeconds <= EPSILON;
    segments.push(segmentEvidence({
      companion,
      player,
      threshold,
      phase: stopped ? "PLAYER_STOPPED_AFTER_STATIC_CLIP" : "PLAYER_MOVING",
      start: 0,
      end: input.horizonSeconds,
      playerVelocity: stopped ? { x: 0, y: 0 } : player.velocity
    }));
  }

  let closest = segments[0]!;
  for (const candidate of segments.slice(1)) {
    if (candidate.closestCenterDistance < closest.closestCenterDistance - EPSILON) {
      closest = candidate;
    }
  }

  const physicalState: A1HardRadiusPhysicalState = closest.hardClearance < -EPSILON
    ? "OVERLAP_PREDICTED"
    : Math.abs(closest.hardClearance) <= EPSILON
      ? "TOUCH_ONLY"
      : "CLEAR";

  return {
    kind: "A1_HARD_RADIUS_PIECEWISE_SAFETY",
    sourceTick: input.sourceTick,
    horizonSeconds: input.horizonSeconds,
    hardRadiusThreshold: threshold,
    playerMovingUntilSeconds: player.movingUntilSeconds,
    segments,
    closestApproachTimeSeconds: closest.closestApproachTimeSeconds,
    closestCenterDistance: closest.closestCenterDistance,
    hardClearance: closest.hardClearance,
    physicalState,
    closestPhase: closest.phase,
    playerAtClosestApproach: { ...closest.playerAtClosestApproach },
    companionAtClosestApproach: { ...closest.companionAtClosestApproach },
    comfortEnvelopeClaim: "NONE_A1_2E_HARD_RADII_ONLY",
    staticLegalityClaim: "NONE_A1_2E_PRIMITIVE_ONLY",
    cooperationClaim: "NONE_A1_2E_PRIMITIVE_ONLY",
    gateAuthorityClaim: "NONE_A1_2E_PRIMITIVE_ONLY"
  };
}

/**
 * Thin evidence adapter from qualified A1.2b DIRECT + A1.2c player future into
 * the pure A1.2e hard-radius primitive. This adapter still makes no G2/G3 gate
 * promotion claim; final ladder composition is intentionally deferred.
 */
export function evaluateA1DirectPlayerHardRadiusSafety(input: {
  situation: A1Situation;
  realization: A1DirectCandidateRealization;
  playerFuture: A1PlayerFutureHypothesis;
}): A1DirectHardRadiusSafetyEvidence {
  const tick = input.situation.tick;
  const horizon = input.realization.horizonSeconds;
  if (input.realization.kind !== "A1_DIRECT_CANDIDATE_REALIZATION") {
    throw new Error("A1.2e evidence adapter accepts DIRECT realization only.");
  }
  if (input.realization.sourceTick !== tick || input.playerFuture.sourceTick !== tick) {
    throw new Error("A1.2e DIRECT/player-future evidence ticks must align with the A1 situation.");
  }
  if (!Number.isFinite(horizon) || horizon <= 0 || Math.abs(input.playerFuture.horizonSeconds - horizon) > EVIDENCE_EPSILON) {
    throw new Error("A1.2e DIRECT/player-future horizons must align.");
  }

  const playerOrigin = input.situation.situated.playerBody.position;
  const companionOrigin = input.situation.situated.companionBody.position;
  if (vectorDistance(input.playerFuture.origin, playerOrigin) > EVIDENCE_EPSILON) {
    throw new Error("A1.2e player future origin must match current player body position.");
  }
  if (input.playerFuture.commandAuthorityClaim !== "NONE_A1_2C_PREDICTION_ONLY") {
    throw new Error("A1.2e player future unexpectedly carries command authority.");
  }
  if (input.realization.reachabilityClaim !== "DIRECT_COMMAND_ADMISSIBLE_ONLY") {
    throw new Error("A1.2e DIRECT realization lacks qualified command-admissibility provenance.");
  }

  const clipFraction = input.playerFuture.staticFeasibility.clipped
    ? input.playerFuture.staticFeasibility.feasibleFraction
    : 1;
  if (!Number.isFinite(clipFraction) || clipFraction < 0 || clipFraction > 1) {
    throw new Error("A1.2e player static clip fraction must be within [0, 1].");
  }
  const movingUntilSeconds = horizon * clipFraction;
  const expectedFeasibleEndpoint = addScaled(
    playerOrigin,
    input.playerFuture.nominalVelocity,
    movingUntilSeconds
  );
  if (
    vectorDistance(
      expectedFeasibleEndpoint,
      input.playerFuture.staticFeasibility.feasibleEndpoint
    ) > EVIDENCE_EPSILON
  ) {
    throw new Error("A1.2e player future clip timing is inconsistent with its feasible endpoint.");
  }

  const primitive = evaluateA1HardRadiusPiecewiseSafety({
    sourceTick: tick,
    horizonSeconds: horizon,
    companion: {
      origin: companionOrigin,
      velocity: input.realization.commandVelocity,
      radius: input.situation.situated.companionCapability.radius
    },
    player: {
      origin: playerOrigin,
      velocity: input.playerFuture.nominalVelocity,
      radius: input.situation.situated.playerCapability.radius,
      movingUntilSeconds
    }
  });

  return {
    ...primitive,
    candidateId: input.realization.candidateId,
    candidateFamily: input.realization.family,
    playerFutureId: input.playerFuture.id,
    playerFutureFamily: input.playerFuture.family,
    playerStaticClipped: input.playerFuture.staticFeasibility.clipped,
    playerStaticClipFraction: clipFraction,
    inputProvenance: "QUALIFIED_A1_2B_DIRECT_PLUS_A1_2C_PLAYER_FUTURE"
  };
}
