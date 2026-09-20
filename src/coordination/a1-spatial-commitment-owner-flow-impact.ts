import type { A1DirectCandidateRealization } from "./a1-companion-candidates";
import { rehearseA1DirectJointPhysicalFuture } from "./a1-direct-joint-physical-rehearsal";
import { buildA1PlayerFutureHypotheses } from "./a1-player-future-hypotheses";
import {
  buildA1PlayerFutureInterventionPlan,
  type A1RehearsablePlayerFutureIntervention
} from "./a1-player-future-interventions";
import { rehearseA1PlayerFutureIntervention } from "./a1-player-future-rehearsal";
import type { A1Situation } from "./a1-situation";
import type { A1SpatialCommitmentFitEvidence } from "./a1-spatial-commitment-evidence";
import { buildA1SpatialCommitmentDirectRealization } from "./a1-spatial-commitment-direct-realization";
import type { ActorSnapshot, Vec2 } from "../world/types";
import type { LabWorld } from "../world/world";

const EPSILON = 1e-9;

export type A1SpatialCommitmentOwnerFlowContactRelation =
  | "NEITHER"
  | "BOTH"
  | "EXECUTION_ONLY"
  | "HOLD_ONLY";

export interface A1SpatialCommitmentOwnerFlowImpactFrame {
  sampleOrdinal: number;
  stepIndex: number;
  timeSeconds: number;
  holdPlayerPosition: Vec2;
  commitmentExecutionPlayerPosition: Vec2;
  playerPositionDeltaVsHold: Vec2;
  playerProgressDeltaVsHold: number | null;
  playerProgressDeficitVsHold: number | null;
  playerLateralDeltaMagnitudeVsHold: number | null;
  holdReciprocalContact: boolean;
  commitmentExecutionReciprocalContact: boolean;
  contactRelation: A1SpatialCommitmentOwnerFlowContactRelation;
}

export interface A1SpatialCommitmentOwnerFlowImpactEvidence {
  kind: "A1_SPATIAL_COMMITMENT_OWNER_FLOW_IMPACT_EVIDENCE";
  sourceTick: number;
  commitmentSourceTick: number;
  horizonSeconds: number;
  ownerRequestFutureId: string;
  ownerRequestVelocity: Vec2;
  commitmentAnchorWorldPosition: Vec2;
  companionCommitmentCommandVelocity: Vec2;
  companionCommitmentCapabilityClipped: boolean;
  companionCommitmentTerminalAnchorError: number;
  worldStepSeconds: number;
  frames: readonly A1SpatialCommitmentOwnerFlowImpactFrame[];
  holdBaselineContactFrameCount: number;
  commitmentExecutionContactFrameCount: number;
  addedContactFrameCountVsHold: number;
  netContactFrameCountDeltaVsHold: number;
  executionOnlyContactFrameCount: number;
  holdOnlyContactFrameCount: number;
  bothContactFrameCount: number;
  firstExecutionOnlyContactStepIndex: number | null;
  lastExecutionOnlyContactStepIndex: number | null;
  holdBaselineFinalPlayerPosition: Vec2;
  commitmentExecutionFinalPlayerPosition: Vec2;
  playerTerminalPositionDeltaVsHold: Vec2;
  playerProgressDeltaVsHold: number | null;
  playerLateralDeltaMagnitudeVsHold: number | null;
  peakPlayerProgressDeficitVsHold: number | null;
  terminalPlayerProgressDeficitVsHold: number | null;
  integratedPlayerProgressDeficitSeconds: number | null;
  peakPlayerLateralDeltaMagnitudeVsHold: number | null;
  terminalPlayerLateralDeltaMagnitudeVsHold: number | null;
  integratedPlayerLateralDeviationSeconds: number | null;
  holdBaselineMeaning: "COMPANION_ZERO_VELOCITY_EACH_WORLD_STEP_NOT_YIELD_POLICY";
  comparisonClaim: "SAME_PLAYER_FUTURE_HOLD_VS_COMMITMENT_EXECUTION";
  progressMeaning: "SIGNED_ALONG_OWNER_REQUEST_FUTURE_DIRECTION_NULL_IF_STATIONARY";
  contactMeaning: "RECIPROCAL_CONTACT_FRAME_COUNT_DIFFERENCE_NOT_SEVERITY";
  legacyAddedContactFieldClaim: "ADDED_CONTACT_FRAME_COUNT_VS_HOLD_IS_NET_COUNT_DELTA_ONLY";
  framewiseContactClaim: "EXECUTION_ONLY_HOLD_ONLY_AND_BOTH_CONTACT_FRAMES_PRESERVED";
  traceClaim: "SAME_STEP_HOLD_AND_EXECUTION_PLAYER_TRAJECTORIES_PRESERVED";
  transientImpactClaim: "PEAK_AND_INTEGRATED_DEVIATIONS_ARE_MEASURED_DIFFERENCES_NOT_HARM";
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

function reciprocalContact(frame: { actors: readonly ActorSnapshot[] }): boolean {
  const player = actor(frame.actors, "player");
  const companion = actor(frame.actors, "companion");
  return (
    player.contacts.some((contact) => contact.with === "companion") &&
    companion.contacts.some((contact) => contact.with === "player")
  );
}

function contactFrameCount(
  frames: readonly { actors: readonly ActorSnapshot[] }[]
): number {
  return frames.filter(reciprocalContact).length;
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

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
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

function contactRelation(
  holdContact: boolean,
  executionContact: boolean
): A1SpatialCommitmentOwnerFlowContactRelation {
  if (holdContact && executionContact) return "BOTH";
  if (executionContact) return "EXECUTION_ONLY";
  if (holdContact) return "HOLD_ONLY";
  return "NEITHER";
}

function maximum(values: readonly (number | null)[]): number | null {
  const finite = values.filter((value): value is number => value !== null && Number.isFinite(value));
  return finite.length > 0 ? Math.max(...finite) : null;
}

function integrated(values: readonly (number | null)[], stepSeconds: number): number | null {
  const finite = values.filter((value): value is number => value !== null && Number.isFinite(value));
  return finite.length > 0
    ? finite.reduce((sum, value) => sum + value, 0) * stepSeconds
    : null;
}

/**
 * Common HOLD-vs-execution measurement over one already-qualified Owner future
 * and one already-materialized DIRECT companion command.
 *
 * The HOLD branch is only a counterfactual comparator. This function publishes
 * measured trajectory/contact differences and carries no harm, preference,
 * right-of-way, yield, selection or runtime authority.
 */
export function buildA1SpatialCommitmentOwnerFlowImpactFromRealization(input: {
  world: LabWorld;
  fit: A1SpatialCommitmentFitEvidence;
  situation: A1Situation;
  ownerRequestIntervention: A1RehearsablePlayerFutureIntervention;
  companionRealization: A1DirectCandidateRealization;
}): A1SpatialCommitmentOwnerFlowImpactEvidence {
  const ownerRequestIntervention = input.ownerRequestIntervention;
  const anchor = input.fit.resolvedAnchorWorldPosition;
  if (!anchor) {
    throw new Error("A1 owner-flow impact realization requires a resolved commitment anchor.");
  }
  if (
    input.fit.sourceTick !== input.situation.tick ||
    input.fit.commitmentSourceTick > input.fit.sourceTick ||
    ownerRequestIntervention.sourceTick !== input.situation.tick ||
    input.companionRealization.sourceTick !== input.situation.tick
  ) {
    throw new Error(
      "A1 owner-flow impact realization requires same-tick fit, situation, Owner future and companion realization."
    );
  }
  if (ownerRequestIntervention.futureFamily !== "OWNER_REQUEST_CONTINUATION") {
    throw new Error(
      "A1 owner-flow impact realization requires the Owner-request continuation future."
    );
  }
  if (
    Math.abs(
      ownerRequestIntervention.horizonSeconds -
        input.companionRealization.horizonSeconds
    ) > EPSILON
  ) {
    throw new Error(
      "A1 owner-flow impact realization requires exactly aligned Owner/companion horizons."
    );
  }

  const hold = rehearseA1PlayerFutureIntervention({
    world: input.world,
    intervention: ownerRequestIntervention
  });
  const execution = rehearseA1DirectJointPhysicalFuture({
    world: input.world,
    situation: input.situation,
    playerIntervention: ownerRequestIntervention,
    companionRealization: input.companionRealization
  });

  const holdPlayer = finalPlayer(hold.physical.frames, "HOLD baseline");
  const executionPlayer = finalPlayer(execution.physical.frames, "commitment execution");
  const delta = {
    x: executionPlayer.position.x - holdPlayer.position.x,
    y: executionPlayer.position.y - holdPlayer.position.y
  };
  const effects = directionalEffects(delta, ownerRequestIntervention.repeatedVelocity);
  const holdContacts = contactFrameCount(hold.physical.frames);
  const executionContacts = contactFrameCount(execution.physical.frames);

  if (
    hold.worldStepCount !== execution.worldStepCount ||
    hold.physical.frames.length !== execution.physical.frames.length ||
    Math.abs(hold.worldStepSeconds - execution.worldStepSeconds) > EPSILON
  ) {
    throw new Error("A1 owner-flow impact HOLD and commitment execution traces are not timebase-aligned.");
  }

  const frames = hold.physical.frames.map(
    (holdFrame, index): A1SpatialCommitmentOwnerFlowImpactFrame => {
      const executionFrame = execution.physical.frames[index];
      if (!executionFrame || executionFrame.stepIndex !== holdFrame.stepIndex) {
        throw new Error("A1 owner-flow impact HOLD and execution frame indices are misaligned.");
      }
      const holdPlayerAtStep = actor(holdFrame.actors, "player");
      const executionPlayerAtStep = actor(executionFrame.actors, "player");
      const stepDelta = {
        x: executionPlayerAtStep.position.x - holdPlayerAtStep.position.x,
        y: executionPlayerAtStep.position.y - holdPlayerAtStep.position.y
      };
      const stepEffects = directionalEffects(stepDelta, ownerRequestIntervention.repeatedVelocity);
      const holdContact = reciprocalContact(holdFrame);
      const executionContact = reciprocalContact(executionFrame);
      return {
        sampleOrdinal: index + 1,
        stepIndex: holdFrame.stepIndex,
        timeSeconds: (index + 1) * execution.worldStepSeconds,
        holdPlayerPosition: { ...holdPlayerAtStep.position },
        commitmentExecutionPlayerPosition: { ...executionPlayerAtStep.position },
        playerPositionDeltaVsHold: stepDelta,
        playerProgressDeltaVsHold: stepEffects.progress,
        playerProgressDeficitVsHold:
          stepEffects.progress === null ? null : Math.max(0, -stepEffects.progress),
        playerLateralDeltaMagnitudeVsHold: stepEffects.lateralMagnitude,
        holdReciprocalContact: holdContact,
        commitmentExecutionReciprocalContact: executionContact,
        contactRelation: contactRelation(holdContact, executionContact)
      };
    }
  );

  const executionOnlyContactFrames = frames.filter(
    (frame) => frame.contactRelation === "EXECUTION_ONLY"
  );
  const holdOnlyContactFrames = frames.filter(
    (frame) => frame.contactRelation === "HOLD_ONLY"
  );
  const bothContactFrames = frames.filter(
    (frame) => frame.contactRelation === "BOTH"
  );
  const terminalFrame = frames.at(-1);
  const progressDeficits = frames.map((frame) => frame.playerProgressDeficitVsHold);
  const lateralDeltas = frames.map((frame) => frame.playerLateralDeltaMagnitudeVsHold);

  return {
    kind: "A1_SPATIAL_COMMITMENT_OWNER_FLOW_IMPACT_EVIDENCE",
    sourceTick: input.situation.tick,
    commitmentSourceTick: input.fit.commitmentSourceTick,
    horizonSeconds: input.companionRealization.horizonSeconds,
    ownerRequestFutureId: ownerRequestIntervention.futureId,
    ownerRequestVelocity: { ...ownerRequestIntervention.repeatedVelocity },
    commitmentAnchorWorldPosition: { ...anchor },
    companionCommitmentCommandVelocity: { ...input.companionRealization.commandVelocity },
    companionCommitmentCapabilityClipped: input.companionRealization.capabilityClipped,
    companionCommitmentTerminalAnchorError: distance(
      input.companionRealization.predictedDisplacement,
      {
        x: anchor.x - input.situation.situated.companionBody.position.x,
        y: anchor.y - input.situation.situated.companionBody.position.y
      }
    ),
    worldStepSeconds: execution.worldStepSeconds,
    frames,
    holdBaselineContactFrameCount: holdContacts,
    commitmentExecutionContactFrameCount: executionContacts,
    addedContactFrameCountVsHold: executionContacts - holdContacts,
    netContactFrameCountDeltaVsHold: executionContacts - holdContacts,
    executionOnlyContactFrameCount: executionOnlyContactFrames.length,
    holdOnlyContactFrameCount: holdOnlyContactFrames.length,
    bothContactFrameCount: bothContactFrames.length,
    firstExecutionOnlyContactStepIndex:
      executionOnlyContactFrames[0]?.stepIndex ?? null,
    lastExecutionOnlyContactStepIndex:
      executionOnlyContactFrames.at(-1)?.stepIndex ?? null,
    holdBaselineFinalPlayerPosition: { ...holdPlayer.position },
    commitmentExecutionFinalPlayerPosition: { ...executionPlayer.position },
    playerTerminalPositionDeltaVsHold: delta,
    playerProgressDeltaVsHold: effects.progress,
    playerLateralDeltaMagnitudeVsHold: effects.lateralMagnitude,
    peakPlayerProgressDeficitVsHold: maximum(progressDeficits),
    terminalPlayerProgressDeficitVsHold:
      terminalFrame?.playerProgressDeficitVsHold ?? null,
    integratedPlayerProgressDeficitSeconds:
      integrated(progressDeficits, execution.worldStepSeconds),
    peakPlayerLateralDeltaMagnitudeVsHold: maximum(lateralDeltas),
    terminalPlayerLateralDeltaMagnitudeVsHold:
      terminalFrame?.playerLateralDeltaMagnitudeVsHold ?? null,
    integratedPlayerLateralDeviationSeconds:
      integrated(lateralDeltas, execution.worldStepSeconds),
    holdBaselineMeaning: "COMPANION_ZERO_VELOCITY_EACH_WORLD_STEP_NOT_YIELD_POLICY",
    comparisonClaim: "SAME_PLAYER_FUTURE_HOLD_VS_COMMITMENT_EXECUTION",
    progressMeaning: "SIGNED_ALONG_OWNER_REQUEST_FUTURE_DIRECTION_NULL_IF_STATIONARY",
    contactMeaning: "RECIPROCAL_CONTACT_FRAME_COUNT_DIFFERENCE_NOT_SEVERITY",
    legacyAddedContactFieldClaim: "ADDED_CONTACT_FRAME_COUNT_VS_HOLD_IS_NET_COUNT_DELTA_ONLY",
    framewiseContactClaim: "EXECUTION_ONLY_HOLD_ONLY_AND_BOTH_CONTACT_FRAMES_PRESERVED",
    traceClaim: "SAME_STEP_HOLD_AND_EXECUTION_PLAYER_TRAJECTORIES_PRESERVED",
    transientImpactClaim: "PEAK_AND_INTEGRATED_DEVIATIONS_ARE_MEASURED_DIFFERENCES_NOT_HARM",
    causalScopeClaim: "COUNTERFACTUAL_DIFFERENCE_UNDER_EXPLICIT_H1_AND_COMMITMENT_COMMAND",
    harmClaim: "NONE_MEASURED_DIFFERENCE_ONLY",
    rightOfWayPriorityClaim: "NONE",
    yieldPolicyClaim: "NONE",
    selectionClaim: "NONE",
    runtimeAuthorityClaim: "NONE"
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

  const direct = buildA1SpatialCommitmentDirectRealization({
    fit: input.fit,
    situation: input.situation,
    horizonSeconds: input.horizonSeconds
  });
  if (direct.status !== "REALIZED" || !direct.realization) {
    throw new Error("A1 owner-flow impact requires a resolved commitment direct realization.");
  }
  return buildA1SpatialCommitmentOwnerFlowImpactFromRealization({
    world: input.world,
    fit: input.fit,
    situation: input.situation,
    ownerRequestIntervention: h1,
    companionRealization: direct.realization
  });
}
