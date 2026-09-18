import type { A1SpatialCommitmentDeliberationFrame } from "./a1-spatial-commitment-deliberation";

export type A1SpatialCommitmentRightOfWayShadowDispositionStatus =
  | "INSUFFICIENT_RIGHT_OF_WAY_CONTEXT"
  | "H1_OWNER_FLOW_DIFFERENCE_OBSERVED_POLICY_UNRESOLVED"
  | "ALTERNATE_FUTURE_CONTEXT_PRESENT_POLICY_UNRESOLVED"
  | "NO_H1_OWNER_FLOW_DIFFERENCE_OBSERVED_POLICY_UNRESOLVED";

export interface A1SpatialCommitmentRightOfWayShadowDisposition {
  kind: "A1_SPATIAL_COMMITMENT_RIGHT_OF_WAY_SHADOW_DISPOSITION";
  sourceTick: number;
  commitmentSourceTick: number;
  ownerRequestFutureId: string | null;
  status: A1SpatialCommitmentRightOfWayShadowDispositionStatus;
  h1OwnerFlowDifferenceObserved: boolean | null;
  alternateJointContactFutureIds: readonly string[];
  alternateJointCausalUnresolvedFutureIds: readonly string[];
  alternateJointReferenceUnresolvedFutureIds: readonly string[];
  hypothesisClaim: "RIGHT_OF_WAY_POLICY_BOUNDARY_SHADOW_V0";
  causalScopeClaim: "EXACT_H1_OWNER_FLOW_MEASUREMENT_ONLY";
  alternateFutureClaim: "PRESERVED_DIAGNOSTIC_CONTEXT_NO_VOTE_NO_VETO";
  mappingToActionRelevanceClaim: "NONE_MATERIALITY_AND_PRIORITY_UNRESOLVED";
  noDifferenceSafetyClaim: "NONE_NO_OBSERVED_DIFFERENCE_NOT_GENERAL_SAFETY";
  harmThresholdClaim: "NONE";
  scalarScoreClaim: "NONE";
  finalPolicyClaim: "NONE";
  finalRightOfWayPriorityClaim: "NONE";
  selectionClaim: "NONE_OBSERVATIONAL_SHADOW_ONLY";
  runtimeAuthorityClaim: "NONE";
}

function validateDeliberation(
  deliberation: A1SpatialCommitmentDeliberationFrame
): void {
  if (deliberation.kind !== "A1_SPATIAL_COMMITMENT_DELIBERATION_FRAME") {
    throw new Error(
      "A1 right-of-way shadow disposition requires commitment deliberation evidence."
    );
  }
  if (
    deliberation.futureProbabilityClaim !== "NONE" ||
    deliberation.rightOfWayPriorityClaim !== "NONE_NOT_ESTABLISHED" ||
    deliberation.decisionClaim !== "NONE_DELIBERATION_ONLY" ||
    deliberation.selectionClaim !== "NONE" ||
    deliberation.scalarScoreClaim !== "NONE" ||
    deliberation.runtimeAuthorityClaim !== "NONE" ||
    deliberation.rightOfWayContext.harmClaim !== "NONE" ||
    deliberation.rightOfWayContext.rightOfWayPriorityClaim !== "NONE" ||
    deliberation.rightOfWayContext.futureWeightingClaim !== "NONE" ||
    deliberation.rightOfWayContext.runtimeAuthorityClaim !== "NONE"
  ) {
    throw new Error(
      "A1 right-of-way policy-boundary shadow refuses deliberation that already contains probability, harm, priority, weighting, decision, selection, score or runtime authority."
    );
  }
}

function observedH1Difference(
  deliberation: A1SpatialCommitmentDeliberationFrame
): boolean | null {
  const context = deliberation.rightOfWayContext;
  if (context.status !== "SUPPLIED_H1_OWNER_FLOW_EVIDENCE") return null;
  return (
    (context.executionOnlyContactFrameCount ?? 0) > 0 ||
    (context.peakPlayerProgressDeficitVsHold ?? 0) > 0 ||
    (context.peakPlayerLateralDeltaMagnitudeVsHold ?? 0) > 0
  );
}

/**
 * Observational policy-boundary witness over the qualified right-of-way
 * evidence chain.
 *
 * It classifies whether bounded H1 Owner-flow difference or alternate-future
 * ambiguity is present. It deliberately does not map those measurements to
 * maintain/defer/yield relevance. Materiality, harm and right-of-way priority
 * remain unresolved future policy questions.
 */
export function buildA1SpatialCommitmentRightOfWayShadowDisposition(
  deliberation: A1SpatialCommitmentDeliberationFrame
): A1SpatialCommitmentRightOfWayShadowDisposition {
  validateDeliberation(deliberation);

  const context = deliberation.rightOfWayContext;
  const h1OwnerFlowDifferenceObserved = observedH1Difference(deliberation);
  const alternateJointContactFutureIds = [
    ...context.alternateJointContactFutureIds
  ];
  const alternateJointCausalUnresolvedFutureIds = [
    ...context.alternateJointCausalUnresolvedFutureIds
  ];
  const alternateJointReferenceUnresolvedFutureIds = [
    ...context.alternateJointReferenceUnresolvedFutureIds
  ];

  let status: A1SpatialCommitmentRightOfWayShadowDispositionStatus;
  if (context.status !== "SUPPLIED_H1_OWNER_FLOW_EVIDENCE") {
    status = "INSUFFICIENT_RIGHT_OF_WAY_CONTEXT";
  } else if (h1OwnerFlowDifferenceObserved) {
    status = "H1_OWNER_FLOW_DIFFERENCE_OBSERVED_POLICY_UNRESOLVED";
  } else if (
    alternateJointContactFutureIds.length > 0 ||
    alternateJointCausalUnresolvedFutureIds.length > 0 ||
    alternateJointReferenceUnresolvedFutureIds.length > 0
  ) {
    status = "ALTERNATE_FUTURE_CONTEXT_PRESENT_POLICY_UNRESOLVED";
  } else {
    status = "NO_H1_OWNER_FLOW_DIFFERENCE_OBSERVED_POLICY_UNRESOLVED";
  }

  return {
    kind: "A1_SPATIAL_COMMITMENT_RIGHT_OF_WAY_SHADOW_DISPOSITION",
    sourceTick: deliberation.sourceTick,
    commitmentSourceTick: deliberation.commitmentSourceTick,
    ownerRequestFutureId: deliberation.ownerRequestFutureId,
    status,
    h1OwnerFlowDifferenceObserved,
    alternateJointContactFutureIds,
    alternateJointCausalUnresolvedFutureIds,
    alternateJointReferenceUnresolvedFutureIds,
    hypothesisClaim: "RIGHT_OF_WAY_POLICY_BOUNDARY_SHADOW_V0",
    causalScopeClaim: "EXACT_H1_OWNER_FLOW_MEASUREMENT_ONLY",
    alternateFutureClaim: "PRESERVED_DIAGNOSTIC_CONTEXT_NO_VOTE_NO_VETO",
    mappingToActionRelevanceClaim: "NONE_MATERIALITY_AND_PRIORITY_UNRESOLVED",
    noDifferenceSafetyClaim: "NONE_NO_OBSERVED_DIFFERENCE_NOT_GENERAL_SAFETY",
    harmThresholdClaim: "NONE",
    scalarScoreClaim: "NONE",
    finalPolicyClaim: "NONE",
    finalRightOfWayPriorityClaim: "NONE",
    selectionClaim: "NONE_OBSERVATIONAL_SHADOW_ONLY",
    runtimeAuthorityClaim: "NONE"
  };
}
