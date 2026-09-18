import type {
  A1SpatialCommitmentDeliberationFrame,
  A1SpatialCommitmentDeliberationReason
} from "./a1-spatial-commitment-deliberation";

const CAUSAL_OWNER_FLOW_REASONS = new Set<A1SpatialCommitmentDeliberationReason>([
  "OWNER_FLOW_ADDED_CONTACT_VS_HOLD",
  "OWNER_FLOW_PROGRESS_DEFICIT_VS_HOLD",
  "OWNER_FLOW_LATERAL_DEVIATION_VS_HOLD"
]);

export type A1SpatialCommitmentRightOfWayShadowDispositionStatus =
  | "INSUFFICIENT_RIGHT_OF_WAY_CONTEXT"
  | "CONSIDER_YIELD_TO_OWNER_FLOW"
  | "WITHHOLD_YIELD_INFERENCE_ALTERNATE_FUTURE_CONTEXT"
  | "NO_CAUSAL_H1_YIELD_SIGNAL";

export interface A1SpatialCommitmentRightOfWayShadowDisposition {
  kind: "A1_SPATIAL_COMMITMENT_RIGHT_OF_WAY_SHADOW_DISPOSITION";
  sourceTick: number;
  commitmentSourceTick: number;
  ownerRequestFutureId: string | null;
  status: A1SpatialCommitmentRightOfWayShadowDispositionStatus;
  causalOwnerFlowReasons: readonly A1SpatialCommitmentDeliberationReason[];
  alternateJointContactFutureIds: readonly string[];
  alternateJointCausalUnresolvedFutureIds: readonly string[];
  alternateJointReferenceUnresolvedFutureIds: readonly string[];
  hypothesisClaim: "OWNER_FLOW_PRIORITY_SHADOW_HYPOTHESIS_V0";
  causalScopeClaim: "EXACT_H1_OWNER_FLOW_INTERFERENCE_ONLY";
  alternateFutureClaim: "PRESERVED_DIAGNOSTIC_CONTEXT_NO_VOTE_NO_VETO";
  harmThresholdClaim: "NONE";
  scalarScoreClaim: "NONE";
  finalPolicyClaim: "NONE";
  finalRightOfWayPriorityClaim: "NONE";
  selectionClaim: "NONE_SHADOW_DISPOSITION_ONLY";
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
      "A1 right-of-way shadow disposition refuses deliberation that already contains probability, harm, priority, weighting, decision, selection, score or runtime authority."
    );
  }
}

function causalOwnerFlowReasons(
  deliberation: A1SpatialCommitmentDeliberationFrame
): A1SpatialCommitmentDeliberationReason[] {
  const yieldOption = deliberation.options.find(
    (option) => option.option === "YIELD_TO_OWNER_FLOW"
  );
  if (!yieldOption) {
    throw new Error(
      "A1 right-of-way shadow disposition requires the fixed YIELD_TO_OWNER_FLOW deliberation hypothesis."
    );
  }
  return yieldOption.reasonsForConsideration.filter((reason) =>
    CAUSAL_OWNER_FLOW_REASONS.has(reason)
  );
}

/**
 * First policy-shaped shadow hypothesis over the qualified right-of-way
 * evidence chain.
 *
 * This does not choose a movement command. It only says whether the exact
 * Owner-request counterfactual supplies causal evidence worth considering as
 * a yield hypothesis. Alternate futures remain diagnostic context rather than
 * votes or vetoes.
 */
export function buildA1SpatialCommitmentRightOfWayShadowDisposition(
  deliberation: A1SpatialCommitmentDeliberationFrame
): A1SpatialCommitmentRightOfWayShadowDisposition {
  validateDeliberation(deliberation);

  const context = deliberation.rightOfWayContext;
  const reasons = causalOwnerFlowReasons(deliberation);
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
  } else if (reasons.length > 0) {
    status = "CONSIDER_YIELD_TO_OWNER_FLOW";
  } else if (
    alternateJointContactFutureIds.length > 0 ||
    alternateJointCausalUnresolvedFutureIds.length > 0 ||
    alternateJointReferenceUnresolvedFutureIds.length > 0
  ) {
    status = "WITHHOLD_YIELD_INFERENCE_ALTERNATE_FUTURE_CONTEXT";
  } else {
    status = "NO_CAUSAL_H1_YIELD_SIGNAL";
  }

  return {
    kind: "A1_SPATIAL_COMMITMENT_RIGHT_OF_WAY_SHADOW_DISPOSITION",
    sourceTick: deliberation.sourceTick,
    commitmentSourceTick: deliberation.commitmentSourceTick,
    ownerRequestFutureId: deliberation.ownerRequestFutureId,
    status,
    causalOwnerFlowReasons: reasons,
    alternateJointContactFutureIds,
    alternateJointCausalUnresolvedFutureIds,
    alternateJointReferenceUnresolvedFutureIds,
    hypothesisClaim: "OWNER_FLOW_PRIORITY_SHADOW_HYPOTHESIS_V0",
    causalScopeClaim: "EXACT_H1_OWNER_FLOW_INTERFERENCE_ONLY",
    alternateFutureClaim: "PRESERVED_DIAGNOSTIC_CONTEXT_NO_VOTE_NO_VETO",
    harmThresholdClaim: "NONE",
    scalarScoreClaim: "NONE",
    finalPolicyClaim: "NONE",
    finalRightOfWayPriorityClaim: "NONE",
    selectionClaim: "NONE_SHADOW_DISPOSITION_ONLY",
    runtimeAuthorityClaim: "NONE"
  };
}
