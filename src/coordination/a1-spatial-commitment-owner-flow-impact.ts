import { rehearseA1DirectJointPhysicalFuture } from "./a1-direct-joint-physical-rehearsal";
import { buildA1PlayerFutureHypotheses } from "./a1-player-future-hypotheses";
import { buildA1PlayerFutureInterventionPlan } from "./a1-player-future-interventions";
import { rehearseA1PlayerFutureIntervention } from "./a1-player-future-rehearsal";
import type { A1Situation } from "./a1-situation";
import type { A1SpatialCommitmentFitEvidence } from "./a1-spatial-commitment-evidence";
import { buildA1SpatialCommitmentDirectRealization } from "./a1-spatial-commitment-direct-realization";
import type { ActorSnapshot, Vec2 } from "../world/types";
import type { LabWorld } from "../world/world";

const EPSILON = 1e-9;

export interface A1SpatialCommitmentOwnerFlowImpactEvidence {
  kind: "A1_SPATIAL_COMMITMENT_OWNER_FLOW_IMPACT_EVIDENCE";
  sourceTick: number;
  commitmentSourceTick: number;
  horizonSeconds: number;
  ownerRequestFutureId: string;
  ownerRequestVelocity: Vec2;
  companionCommitmentCommandVelocity: Vec2;
  companionCommitmentCapabilityClipped: boolean;
  holdBaselineContactFrameCount: number;
  commitmentExecutionContactFrameCount: number;
  addedContactFrameCountVsHold: number;
  holdBaselineFinalPlayerPosition: Vec2;
  commitmentExecutionFinalPlayerPosition: Vec2;
  playerTerminalPositionDeltaVsHold: Vec2;
  playerProgressDeltaVsHold: number | null;
  playerLateralDeltaMagnitudeVsHold: number | null;
  holdBaselineMeaning: "COMPANION_ZERO_VELOCITY_EACH_WORLD_STEP_NOT_YIELD_POLICY";
  comparisonClaim: "SAME_PLAYER_FUTURE_HOLD_VS_COMMITMENT_EXECUTION";
  progressMeaning: "SIGNED_ALONG_OWNER_REQUEST_FUTURE_DIRECTION_NULL_IF_STATIONARY";
  contactMeaning: "RECIPROCAL_CONTACT_FRAME_COUNT_DIFFERENCE_NOT_SEVERITY";
  causalScopeClaim: "COUNTERFACTUAL_DIFFERENCE_UNDER_EXPLICIT_H1_AND_COMMITMENT_COMMAND";
  harmClaim: "NONE_MEASURED_DIFFERENCE_ONLY";
  rightOfWayPriorityClaim: "NONE";
  yieldPolicyClaim: "NONE";
  selectionClaim: "NONE";
  runtimeAuthorityClaim: "NONE";
}

function actor(
  actors: readonly ActorSnapshot[],
  id: "player" | "companion"
): ActorSnapshot {
  const value = actors.find((candidate) => candidate.id === id);
  if (!value) throw new Error(`A1 owner-flow impact is missing ${id} body evidence.`);
  return value;
}

function contactFrameCount(
  frames: readonly { actors: readonly ActorSnapshot[] }[]
): number {
  let count = 0;
  for (const frame of frames) {
    const player = actor(frame.actors, "player");
    const companion = actor(frame.actors, "companion");
    const reciprocal =
      player.contacts.some((contact) => contact.with === "companion") &&
      companion.contacts.some((contact) => contact.with === "player");
    if (reciprocal) count += 1;
  }
  return count;
}

function ownerRequest(plan: ReturnType<typeof buildA1PlayerFutureInterventionPlan>) {
  const matches = plan.interventions.filter(
    (value) => value.futureFamily === "OWNER_REQUEST_CONTINUATION"
  );
  if (matches.length !== 1) {
    throw new Error("A1 owner-flow impact requires exactly one Owner-request future.");
  }
  const value = matches[0]!;
  if (value.status !== "REHEARSABLE") {
    throw new Error(`A1 owner-flow impact Owner future is unresolved: ${value.unresolvedReason}.`);
  }
  return value;
}

function finalPlayer(frames: readonly { actors: readonly ActorSnapshot[] }[], label: string): ActorSnapshot {
  const final = frames.at(-1);
  if (!final) throw new Error(`A1 owner-flow impact ${label} returned no physical frames.`);
  return actor(final.actors, "player");
}

function directionalEffects(delta: Vec2, velocity: Vec2): {
  progress: number | null;
  lateralMagnitude: number | null;
} {
  const speed = Math.hypot(velocity.x, velocity.y);
  if (speed <= EPSILON) {
    return { progress: null, lateralMagnitude: null };
  }
  const direction = { x: velocity.x / speed, y: velocity.y / speed };
  const tangent = { x: -direction.y, y: direction.x };
  return {
    progress: delta.x * direction.x + delta.y * direction.y,
    lateralMagnitude: Math.abs(delta.x * tangent.x + delta.y * tangent.y)
  };
}

/**
 * Compares the same Owner-request future under two query-only same-physics
 * counterfactuals: companion HOLD and direct execution of the exact commitment.
 *
 * HOLD is a comparator only. Neither lower progress nor added contacts are
 * promoted here into harm, right-of-way or yield policy.
 */
export function buildA1SpatialCommitmentOwnerFlowImpactEvidence(input: {
  world: LabWorld;
  fit: A1SpatialCommitmentFitEvidence;
  situation: A1Situation;
  horizonSeconds: number;
}): A1SpatialCommitmentOwnerFlowImpactEvidence {
  if (
    input.fit.sourceTick !== input.situation.tick ||
    input.fit.commitmentSourceTick > input.fit.sourceTick
  ) {
    throw new Error("A1 owner-flow impact requires aligned fit and situation evidence.");
  }

  const hypotheses = buildA1PlayerFutureHypotheses({
    situation: input.situation,
    horizonSeconds: input.horizonSeconds,
    staticTraversal: (from, to, radius, options) =>
      input.world.staticCircleTraversal(from, to, radius, options)
  });
  const plan = buildA1PlayerFutureInterventionPlan(hypotheses);
  const h1 = ownerRequest(plan);

  const hold = rehearseA1PlayerFutureIntervention({
    world: input.world,
    intervention: h1
  });
  const direct = buildA1SpatialCommitmentDirectRealization({
    fit: input.fit,
    situation: input.situation,
    horizonSeconds: input.horizonSeconds
  });
  if (direct.status !== "REALIZED" || !direct.realization) {
    throw new Error("A1 owner-flow impact requires a resolved commitment direct realization.");
  }
  const execution = rehearseA1DirectJointPhysicalFuture({
    world: input.world,
    situation: input.situation,
    playerIntervention: h1,
    companionRealization: direct.realization
  });

  const holdPlayer = finalPlayer(hold.physical.frames, "HOLD baseline");
  const executionPlayer = finalPlayer(execution.physical.frames, "commitment execution");
  const delta = {
    x: executionPlayer.position.x - holdPlayer.position.x,
    y: executionPlayer.position.y - holdPlayer.position.y
  };
  const effects = directionalEffects(delta, h1.repeatedVelocity);
  const holdContacts = contactFrameCount(hold.physical.frames);
  const executionContacts = contactFrameCount(execution.physical.frames);

  return {
    kind: "A1_SPATIAL_COMMITMENT_OWNER_FLOW_IMPACT_EVIDENCE",
    sourceTick: input.situation.tick,
    commitmentSourceTick: input.fit.commitmentSourceTick,
    horizonSeconds: input.horizonSeconds,
    ownerRequestFutureId: h1.futureId,
    ownerRequestVelocity: { ...h1.repeatedVelocity },
    companionCommitmentCommandVelocity: { ...direct.realization.commandVelocity },
    companionCommitmentCapabilityClipped: direct.realization.capabilityClipped,
    holdBaselineContactFrameCount: holdContacts,
    commitmentExecutionContactFrameCount: executionContacts,
    addedContactFrameCountVsHold: executionContacts - holdContacts,
    holdBaselineFinalPlayerPosition: { ...holdPlayer.position },
    commitmentExecutionFinalPlayerPosition: { ...executionPlayer.position },
    playerTerminalPositionDeltaVsHold: delta,
    playerProgressDeltaVsHold: effects.progress,
    playerLateralDeltaMagnitudeVsHold: effects.lateralMagnitude,
    holdBaselineMeaning: "COMPANION_ZERO_VELOCITY_EACH_WORLD_STEP_NOT_YIELD_POLICY",
    comparisonClaim: "SAME_PLAYER_FUTURE_HOLD_VS_COMMITMENT_EXECUTION",
    progressMeaning: "SIGNED_ALONG_OWNER_REQUEST_FUTURE_DIRECTION_NULL_IF_STATIONARY",
    contactMeaning: "RECIPROCAL_CONTACT_FRAME_COUNT_DIFFERENCE_NOT_SEVERITY",
    causalScopeClaim: "COUNTERFACTUAL_DIFFERENCE_UNDER_EXPLICIT_H1_AND_COMMITMENT_COMMAND",
    harmClaim: "NONE_MEASURED_DIFFERENCE_ONLY",
    rightOfWayPriorityClaim: "NONE",
    yieldPolicyClaim: "NONE",
    selectionClaim: "NONE",
    runtimeAuthorityClaim: "NONE"
  };
}
