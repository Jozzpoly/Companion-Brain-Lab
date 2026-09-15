import type { Vec2 } from "../world/types";
import type { A1RelationshipOrientationEvidence } from "./a1-relationship-orientation";
import {
  A1_DEFAULT_RELATIONSHIP_OBJECTIVE,
  a1RelationshipObjectiveSignature,
  evaluateA1RelationshipUtility,
  type A1RelationshipObjectiveProfile,
  type A1RelationshipUtilityEvidence
} from "./a1-relationship-utility";

/**
 * A1.2a accepts explicit velocity hypotheses only to test moving-frame semantic
 * composition. Supplying a velocity here makes no capability, reachability,
 * collision or actuator-realizability claim; those contracts begin in A1.2b+.
 */
export interface A1MovingFrameVelocityEvidence {
  id: string;
  sourceTick: number;
  velocity: Vec2;
}

export interface A1MovingFrameRolloutInput {
  tick: number;
  horizonSeconds: number;
  currentRelativeOffset: Vec2;
  playerFuture: A1MovingFrameVelocityEvidence;
  companionCandidate: A1MovingFrameVelocityEvidence;
  orientation: A1RelationshipOrientationEvidence;
  objective?: A1RelationshipObjectiveProfile;
}

export interface A1MovingFrameRolloutResult {
  kind: "A1_MOVING_FRAME_ROLLOUT";
  tick: number;
  horizonSeconds: number;
  /** Explicit stage boundary: A1.2a evaluates semantics only. */
  reachabilityClaim: "NONE_A1_2A_PURE_SEMANTICS";
  worldLegalityClaim: "NONE_A1_2A_PURE_SEMANTICS";
  /** Initial A1.2a approximation; future orientation evolution is not predicted yet. */
  orientationHeldConstantOverHorizon: true;
  orientationSource: A1RelationshipOrientationEvidence["source"];
  orientationSourceTick: number | null;
  orientationAgeTicks: number | null;
  orientationStrength: number;
  objectiveSignature: string;
  playerFutureId: string;
  companionCandidateId: string;
  playerVelocity: Vec2;
  companionVelocity: Vec2;
  relativeVelocity: Vec2;
  playerDisplacement: Vec2;
  companionDisplacement: Vec2;
  currentRelativeOffset: Vec2;
  futureRelativeOffset: Vec2;
  currentUtility: A1RelationshipUtilityEvidence;
  futureUtility: A1RelationshipUtilityEvidence;
  utilityDelta: number;
}

function finiteVector(value: Vec2, label: string): Vec2 {
  if (!Number.isFinite(value.x) || !Number.isFinite(value.y)) {
    throw new Error(`${label} requires finite x/y components.`);
  }
  return { ...value };
}

function alignedVelocityEvidence(
  value: A1MovingFrameVelocityEvidence,
  tick: number,
  label: string
): A1MovingFrameVelocityEvidence {
  if (value.id.length === 0) throw new Error(`${label} requires a non-empty id.`);
  if (!Number.isInteger(value.sourceTick) || value.sourceTick < 0) {
    throw new Error(`${label} requires a non-negative integer sourceTick.`);
  }
  if (value.sourceTick !== tick) {
    throw new Error(`${label} source tick ${value.sourceTick} does not match rollout tick ${tick}.`);
  }
  return {
    id: value.id,
    sourceTick: value.sourceTick,
    velocity: finiteVector(value.velocity, `${label} velocity`)
  };
}

export function evaluateA1MovingFrameRollout(input: A1MovingFrameRolloutInput): A1MovingFrameRolloutResult {
  if (!Number.isInteger(input.tick) || input.tick < 0) {
    throw new Error("A1 moving-frame rollout requires a non-negative integer tick.");
  }
  if (!Number.isFinite(input.horizonSeconds) || input.horizonSeconds <= 0) {
    throw new Error("A1 moving-frame rollout requires a positive finite horizonSeconds.");
  }
  if (input.orientation.tick !== input.tick) {
    throw new Error(
      `A1 moving-frame orientation tick ${input.orientation.tick} does not match rollout tick ${input.tick}.`
    );
  }

  const currentRelativeOffset = finiteVector(
    input.currentRelativeOffset,
    "A1 moving-frame current relative offset"
  );
  const playerFuture = alignedVelocityEvidence(input.playerFuture, input.tick, "A1 player future");
  const companionCandidate = alignedVelocityEvidence(
    input.companionCandidate,
    input.tick,
    "A1 companion candidate"
  );
  const relativeVelocity = {
    x: companionCandidate.velocity.x - playerFuture.velocity.x,
    y: companionCandidate.velocity.y - playerFuture.velocity.y
  };
  const playerDisplacement = {
    x: playerFuture.velocity.x * input.horizonSeconds,
    y: playerFuture.velocity.y * input.horizonSeconds
  };
  const companionDisplacement = {
    x: companionCandidate.velocity.x * input.horizonSeconds,
    y: companionCandidate.velocity.y * input.horizonSeconds
  };
  const futureRelativeOffset = {
    x: currentRelativeOffset.x + relativeVelocity.x * input.horizonSeconds,
    y: currentRelativeOffset.y + relativeVelocity.y * input.horizonSeconds
  };
  const objective = input.objective ?? A1_DEFAULT_RELATIONSHIP_OBJECTIVE;

  const currentUtility = evaluateA1RelationshipUtility({
    state: { relativeOffset: currentRelativeOffset },
    orientation: input.orientation,
    objective
  });
  const futureUtility = evaluateA1RelationshipUtility({
    state: { relativeOffset: futureRelativeOffset },
    orientation: input.orientation,
    objective
  });

  return {
    kind: "A1_MOVING_FRAME_ROLLOUT",
    tick: input.tick,
    horizonSeconds: input.horizonSeconds,
    reachabilityClaim: "NONE_A1_2A_PURE_SEMANTICS",
    worldLegalityClaim: "NONE_A1_2A_PURE_SEMANTICS",
    orientationHeldConstantOverHorizon: true,
    orientationSource: input.orientation.source,
    orientationSourceTick: input.orientation.sourceTick,
    orientationAgeTicks: input.orientation.ageTicks,
    orientationStrength: input.orientation.strength,
    objectiveSignature: a1RelationshipObjectiveSignature(objective),
    playerFutureId: playerFuture.id,
    companionCandidateId: companionCandidate.id,
    playerVelocity: { ...playerFuture.velocity },
    companionVelocity: { ...companionCandidate.velocity },
    relativeVelocity,
    playerDisplacement,
    companionDisplacement,
    currentRelativeOffset,
    futureRelativeOffset,
    currentUtility,
    futureUtility,
    utilityDelta: futureUtility.totalUtility - currentUtility.totalUtility
  };
}
