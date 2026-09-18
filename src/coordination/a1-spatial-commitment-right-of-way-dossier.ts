import type { Vec2 } from "../world/types";
import type { A1SpatialCommitmentReviewEvidence } from "./a1-spatial-commitment-review";
import type { A1SpatialCommitmentOwnerFlowImpactEvidence } from "./a1-spatial-commitment-owner-flow-impact";

const EPSILON = 1e-8;

export interface A1SpatialCommitmentRightOfWayEvidenceDossier {
  kind: "A1_SPATIAL_COMMITMENT_RIGHT_OF_WAY_EVIDENCE_DOSSIER";
  sourceTick: number;
  commitmentSourceTick: number;
  horizonSeconds: number;
  ownerRequestFutureId: string;
  semanticStatus: A1SpatialCommitmentReviewEvidence["sourceFit"]["semanticStatus"];
  referenceMode: A1SpatialCommitmentReviewEvidence["referenceMode"];
  materialStatus: A1SpatialCommitmentReviewEvidence["materialStatus"];
  actorOccupancyStatus: A1SpatialCommitmentReviewEvidence["actorOccupancyStatus"];
  commitmentAnchorWorldPosition: Vec2;
  companionCommitmentCommandVelocity: Vec2;
  companionCommitmentCapabilityClipped: boolean;
  companionCommitmentTerminalAnchorError: number;
  ownerRequestAnchorOccupancyStatus:
    | "SAMPLED_PLAYER_FUTURE_OVERLAP"
    | "NO_SAMPLED_PLAYER_FUTURE_OVERLAP";
  ownerRequestJointContactFrameCount: number;
  ownerRequestFirstJointContactStepIndex: number | null;
  holdBaselineContactFrameCount: number;
  commitmentExecutionContactFrameCount: number;
  executionOnlyContactFrameCount: number;
  holdOnlyContactFrameCount: number;
  bothContactFrameCount: number;
  peakPlayerProgressDeficitVsHold: number | null;
  terminalPlayerProgressDeficitVsHold: number | null;
  integratedPlayerProgressDeficitSeconds: number | null;
  peakPlayerLateralDeltaMagnitudeVsHold: number | null;
  terminalPlayerLateralDeltaMagnitudeVsHold: number | null;
  integratedPlayerLateralDeviationSeconds: number | null;
  sourceAlignmentClaim: "EXACT_SAME_COMMITMENT_H1_HORIZON_DIRECT_COMMAND_AND_JOINT_CONTACT_TRACE";
  evidenceAxisClaim: "SEMANTICS_CONTACT_AND_OWNER_FLOW_DIFFERENCE_REMAIN_SEPARATE";
  holdComparatorClaim: "COUNTERFACTUAL_ONLY_NOT_PREFERRED_BEHAVIOR";
  contactToHarmClaim: "NONE_CONTACT_IS_NOT_A_HARM_SCALAR";
  noContactSafetyClaim: "NONE_NO_OBSERVED_CONTACT_OR_DISTURBANCE_DOES_NOT_ESTABLISH_GENERAL_SAFETY";
  impactToPriorityClaim: "NONE_MEASURED_OWNER_FLOW_DIFFERENCE_IS_NOT_RIGHT_OF_WAY_PRIORITY";
  futureWeightingClaim: "NONE";
  harmThresholdClaim: "NONE";
  scalarScoreClaim: "NONE";
  rightOfWayPriorityClaim: "NONE";
  yieldPolicyClaim: "NONE";
  decisionClaim: "NONE_EVIDENCE_DOSSIER_ONLY";
  selectionClaim: "NONE";
  runtimeAuthorityClaim: "NONE";
  sourceReview: A1SpatialCommitmentReviewEvidence;
  sourceImpact: A1SpatialCommitmentOwnerFlowImpactEvidence;
}

function near(a: number, b: number): boolean {
  return Math.abs(a - b) <= EPSILON;
}

function sameVec(a: Vec2, b: Vec2): boolean {
  return near(a.x, b.x) && near(a.y, b.y);
}

function validateReview(review: A1SpatialCommitmentReviewEvidence): void {
  if (
    review.kind !== "A1_SPATIAL_COMMITMENT_REVIEW_EVIDENCE" ||
    review.decisionClaim !== "NONE_EVIDENCE_ONLY" ||
    review.scalarScoreClaim !== "NONE" ||
    review.selectionClaim !== "NONE" ||
    review.runtimeAuthorityClaim !== "NONE" ||
    review.jointCooperationPolicyClaim !== "NONE" ||
    review.jointBooleanCollapseClaim !== "NONE"
  ) {
    throw new Error(
      "A1 right-of-way dossier refuses review evidence that already contains policy, scalarization, decision, selection or runtime authority."
    );
  }
  if (
    review.jointFutureSetStatus !== "REHEARSED" ||
    !review.sourceJointFutureSet ||
    !review.sourcePlayerFutureSet ||
    review.jointHorizonSeconds === null
  ) {
    throw new Error(
      "A1 right-of-way dossier requires a rehearsed joint future set and its complete player-future provenance."
    );
  }
}

function validateImpact(impact: A1SpatialCommitmentOwnerFlowImpactEvidence): void {
  if (
    impact.kind !== "A1_SPATIAL_COMMITMENT_OWNER_FLOW_IMPACT_EVIDENCE" ||
    impact.harmClaim !== "NONE_MEASURED_DIFFERENCE_ONLY" ||
    impact.rightOfWayPriorityClaim !== "NONE" ||
    impact.yieldPolicyClaim !== "NONE" ||
    impact.selectionClaim !== "NONE" ||
    impact.runtimeAuthorityClaim !== "NONE"
  ) {
    throw new Error(
      "A1 right-of-way dossier refuses Owner-flow impact evidence that already contains harm, priority, yield, selection or runtime authority."
    );
  }
}

export function buildA1SpatialCommitmentRightOfWayEvidenceDossier(input: {
  review: A1SpatialCommitmentReviewEvidence;
  impact: A1SpatialCommitmentOwnerFlowImpactEvidence;
}): A1SpatialCommitmentRightOfWayEvidenceDossier {
  const { review, impact } = input;
  validateReview(review);
  validateImpact(impact);

  const joint = review.sourceJointFutureSet!;
  const direct = joint.directRealization;
  if (
    direct.status !== "REALIZED" ||
    !direct.realization ||
    !direct.anchorWorldPosition ||
    direct.terminalAnchorError === null
  ) {
    throw new Error(
      "A1 right-of-way dossier requires the exact resolved direct commitment realization."
    );
  }

  const ownerPlayerFuture = review.sourcePlayerFutureSet!.futures.filter(
    (future) => future.futureFamily === "OWNER_REQUEST_CONTINUATION"
  );
  const ownerJointFuture = joint.futures.filter(
    (future) => future.futureFamily === "OWNER_REQUEST_CONTINUATION"
  );
  if (ownerPlayerFuture.length !== 1 || ownerJointFuture.length !== 1) {
    throw new Error(
      "A1 right-of-way dossier requires exactly one Owner-request player future and one aligned joint future."
    );
  }
  const playerFuture = ownerPlayerFuture[0]!;
  const jointFuture = ownerJointFuture[0]!;
  if (
    playerFuture.interventionStatus !== "REHEARSABLE" ||
    jointFuture.status !== "REHEARSED"
  ) {
    throw new Error(
      "A1 right-of-way dossier requires a rehearsed Owner-request counterfactual."
    );
  }

  if (
    review.sourceTick !== impact.sourceTick ||
    review.commitmentSourceTick !== impact.commitmentSourceTick ||
    !near(joint.horizonSeconds, impact.horizonSeconds) ||
    playerFuture.futureId !== impact.ownerRequestFutureId ||
    jointFuture.futureId !== impact.ownerRequestFutureId
  ) {
    throw new Error(
      "A1 right-of-way dossier source tick, commitment, horizon or Owner-request future identity does not align."
    );
  }

  if (
    !sameVec(direct.anchorWorldPosition, impact.commitmentAnchorWorldPosition) ||
    !sameVec(direct.realization.commandVelocity, impact.companionCommitmentCommandVelocity) ||
    direct.realization.capabilityClipped !== impact.companionCommitmentCapabilityClipped ||
    !near(direct.terminalAnchorError, impact.companionCommitmentTerminalAnchorError)
  ) {
    throw new Error(
      "A1 right-of-way dossier direct commitment execution does not exactly align with Owner-flow impact evidence."
    );
  }

  const jointHasContact = jointFuture.contactFrameCount > 0;
  const impactHasContact = impact.commitmentExecutionContactFrameCount > 0;
  const impactFirstContactStepIndex =
    impact.frames.find(
      (frame) => frame.commitmentExecutionReciprocalContact
    )?.stepIndex ?? null;
  if (
    jointHasContact !== impactHasContact ||
    jointFuture.contactFrameCount !== impact.commitmentExecutionContactFrameCount ||
    jointFuture.firstContactStepIndex !== impactFirstContactStepIndex
  ) {
    throw new Error(
      "A1 right-of-way dossier joint-contact trace disagrees with Owner-flow impact execution trace."
    );
  }

  if (
    review.jointContactFutureIds.includes(jointFuture.futureId) !== jointHasContact ||
    review.jointNoContactRehearsedFutureIds.includes(jointFuture.futureId) === jointHasContact
  ) {
    throw new Error(
      "A1 right-of-way dossier review contact classification is inconsistent with the exact Owner joint future."
    );
  }

  return {
    kind: "A1_SPATIAL_COMMITMENT_RIGHT_OF_WAY_EVIDENCE_DOSSIER",
    sourceTick: review.sourceTick,
    commitmentSourceTick: review.commitmentSourceTick,
    horizonSeconds: impact.horizonSeconds,
    ownerRequestFutureId: impact.ownerRequestFutureId,
    semanticStatus: review.sourceFit.semanticStatus,
    referenceMode: review.referenceMode,
    materialStatus: review.materialStatus,
    actorOccupancyStatus: review.actorOccupancyStatus,
    commitmentAnchorWorldPosition: { ...impact.commitmentAnchorWorldPosition },
    companionCommitmentCommandVelocity: { ...impact.companionCommitmentCommandVelocity },
    companionCommitmentCapabilityClipped: impact.companionCommitmentCapabilityClipped,
    companionCommitmentTerminalAnchorError: impact.companionCommitmentTerminalAnchorError,
    ownerRequestAnchorOccupancyStatus: jointFuture.anchorOccupancyStatus,
    ownerRequestJointContactFrameCount: jointFuture.contactFrameCount,
    ownerRequestFirstJointContactStepIndex: jointFuture.firstContactStepIndex,
    holdBaselineContactFrameCount: impact.holdBaselineContactFrameCount,
    commitmentExecutionContactFrameCount: impact.commitmentExecutionContactFrameCount,
    executionOnlyContactFrameCount: impact.executionOnlyContactFrameCount,
    holdOnlyContactFrameCount: impact.holdOnlyContactFrameCount,
    bothContactFrameCount: impact.bothContactFrameCount,
    peakPlayerProgressDeficitVsHold: impact.peakPlayerProgressDeficitVsHold,
    terminalPlayerProgressDeficitVsHold: impact.terminalPlayerProgressDeficitVsHold,
    integratedPlayerProgressDeficitSeconds: impact.integratedPlayerProgressDeficitSeconds,
    peakPlayerLateralDeltaMagnitudeVsHold: impact.peakPlayerLateralDeltaMagnitudeVsHold,
    terminalPlayerLateralDeltaMagnitudeVsHold: impact.terminalPlayerLateralDeltaMagnitudeVsHold,
    integratedPlayerLateralDeviationSeconds: impact.integratedPlayerLateralDeviationSeconds,
    sourceAlignmentClaim: "EXACT_SAME_COMMITMENT_H1_HORIZON_DIRECT_COMMAND_AND_JOINT_CONTACT_TRACE",
    evidenceAxisClaim: "SEMANTICS_CONTACT_AND_OWNER_FLOW_DIFFERENCE_REMAIN_SEPARATE",
    holdComparatorClaim: "COUNTERFACTUAL_ONLY_NOT_PREFERRED_BEHAVIOR",
    contactToHarmClaim: "NONE_CONTACT_IS_NOT_A_HARM_SCALAR",
    noContactSafetyClaim: "NONE_NO_OBSERVED_CONTACT_OR_DISTURBANCE_DOES_NOT_ESTABLISH_GENERAL_SAFETY",
    impactToPriorityClaim: "NONE_MEASURED_OWNER_FLOW_DIFFERENCE_IS_NOT_RIGHT_OF_WAY_PRIORITY",
    futureWeightingClaim: "NONE",
    harmThresholdClaim: "NONE",
    scalarScoreClaim: "NONE",
    rightOfWayPriorityClaim: "NONE",
    yieldPolicyClaim: "NONE",
    decisionClaim: "NONE_EVIDENCE_DOSSIER_ONLY",
    selectionClaim: "NONE",
    runtimeAuthorityClaim: "NONE",
    sourceReview: structuredClone(review),
    sourceImpact: structuredClone(impact)
  };
}
