import type {
  A1SpatialCommitmentReviewEvidence,
  A1SpatialCommitmentReviewFact
} from "./a1-spatial-commitment-review";
import type { A1SpatialCommitmentRightOfWayEvidenceDossier } from "./a1-spatial-commitment-right-of-way-dossier";

export type A1SpatialCommitmentDeliberationOption =
  | "MAINTAIN_COMMITMENT"
  | "DEFER_EXECUTION"
  | "YIELD_TO_OWNER_FLOW"
  | "REFRAME_COMMITMENT";

export type A1SpatialCommitmentDeliberationReason =
  | "SEMANTIC_COMPARABILITY_PRESENT"
  | "REFERENCE_REMAINS_RESOLVED"
  | "STATIC_ROUTE_REACHABLE"
  | "CURRENT_PLAYER_BODY_OVERLAP"
  | "OWNER_REQUEST_JOINT_CONTACT"
  | "OTHER_FUTURE_JOINT_CONTACT"
  | "OWNER_REQUEST_ANCHOR_OVERLAP_WITHOUT_JOINT_CONTACT"
  | "SEMANTIC_ORIENTATION_REGIME_CHANGED"
  | "SEMANTIC_OBJECTIVE_CHANGED"
  | "REFERENCE_BASIS_MISSING"
  | "STATIC_ANCHOR_TARGET_BLOCKED"
  | "STATIC_ANCHOR_ROUTE_UNREACHABLE"
  | "DIRECT_REALIZATION_CAPABILITY_CLIPPED"
  | "PARTIAL_ROUTE_COVERAGE"
  | "PLAYER_FUTURE_CAUSAL_UNRESOLVED"
  | "PLAYER_FUTURE_REFERENCE_UNRESOLVED"
  | "JOINT_FUTURE_CAUSAL_UNRESOLVED"
  | "JOINT_FUTURE_REFERENCE_UNRESOLVED"
  | "JOINT_FUTURE_STATIC_BLOCKED";

export type A1SpatialCommitmentDeliberationOpenQuestion =
  | "DOES_COMMITMENT_MEANING_STILL_APPLY"
  | "IS_CURRENT_ANCHOR_STILL_THE_RIGHT_SPATIAL_EXPRESSION"
  | "SHOULD_EXECUTION_WAIT_WHILE_PLAYER_OCCUPIES_OR_CROSSES_THE_SPACE"
  | "SHOULD_OWNER_FLOW_HAVE_PRIORITY_OVER_COMMITMENT_EXECUTION"
  | "IS_A_DIFFERENT_COMMITMENT_REALIZATION_PREFERABLE"
  | "HOW_SHOULD_UNRESOLVED_PLAYER_FUTURES_AFFECT_CAUTION"
  | "DOES_LONGER_OR_DIFFERENT_HORIZON_CHANGE_INTERFERENCE";

export interface A1SpatialCommitmentDeliberationOptionEvidence {
  option: A1SpatialCommitmentDeliberationOption;
  reasonsForConsideration: readonly A1SpatialCommitmentDeliberationReason[];
  reasonsAgainstPrematureConclusion: readonly A1SpatialCommitmentDeliberationReason[];
  openQuestions: readonly A1SpatialCommitmentDeliberationOpenQuestion[];
}

export interface A1SpatialCommitmentDeliberationRightOfWayContext {
  status: "NOT_SUPPLIED" | "SUPPLIED_H1_OWNER_FLOW_EVIDENCE";
  ownerRequestFutureId: string | null;
  ownerRequestJointContactFrameCount: number | null;
  alternateJointContactFutureIds: readonly string[];
  alternateJointNoContactRehearsedFutureIds: readonly string[];
  alternateJointCausalUnresolvedFutureIds: readonly string[];
  alternateJointReferenceUnresolvedFutureIds: readonly string[];
  executionOnlyContactFrameCount: number | null;
  peakPlayerProgressDeficitVsHold: number | null;
  integratedPlayerProgressDeficitSeconds: number | null;
  peakPlayerLateralDeltaMagnitudeVsHold: number | null;
  integratedPlayerLateralDeviationSeconds: number | null;
  evidenceScopeClaim:
    | "NOT_SUPPLIED"
    | "H1_CAUSAL_OWNER_FLOW_PLUS_UNWEIGHTED_ALTERNATE_FUTURES";
  harmClaim: "NONE";
  rightOfWayPriorityClaim: "NONE";
  futureWeightingClaim: "NONE";
  runtimeAuthorityClaim: "NONE";
}

export interface A1SpatialCommitmentDeliberationFrame {
  kind: "A1_SPATIAL_COMMITMENT_DELIBERATION_FRAME";
  sourceTick: number;
  commitmentSourceTick: number;
  ownerRequestFutureId: string | null;
  rightOfWayContext: A1SpatialCommitmentDeliberationRightOfWayContext;
  options: readonly A1SpatialCommitmentDeliberationOptionEvidence[];
  optionSetClaim: "FIXED_HYPOTHESES_FOR_RESEARCH_NOT_EXHAUSTIVE_POLICY";
  optionOrderingClaim: "NONE_ARRAY_ORDER_NOT_PREFERENCE";
  evidenceInterpretationClaim: "REASONS_FOR_CONSIDERATION_NOT_ACTION_JUSTIFICATION";
  futureProbabilityClaim: "NONE";
  rightOfWayPriorityClaim: "NONE_NOT_ESTABLISHED";
  decisionClaim: "NONE_DELIBERATION_ONLY";
  selectionClaim: "NONE";
  scalarScoreClaim: "NONE";
  runtimeAuthorityClaim: "NONE";
  sourceReview: A1SpatialCommitmentReviewEvidence;
}

const SEMANTIC_BREAK_FACTS = new Set<A1SpatialCommitmentReviewFact>([
  "SEMANTIC_ORIENTATION_REGIME_CHANGED",
  "SEMANTIC_OBJECTIVE_CHANGED",
  "REFERENCE_SOURCE_BASIS_MISSING",
  "REFERENCE_CURRENT_BASIS_MISSING"
]);

function hasFact(
  review: A1SpatialCommitmentReviewEvidence,
  fact: A1SpatialCommitmentReviewFact
): boolean {
  return review.facts.includes(fact);
}

function ownerRequestFutureId(
  review: A1SpatialCommitmentReviewEvidence
): string | null {
  const matches = review.sourcePlayerFutureSet?.futures.filter(
    (future) => future.futureFamily === "OWNER_REQUEST_CONTINUATION"
  ) ?? [];
  if (matches.length > 1) {
    throw new Error("A1 commitment deliberation found duplicate Owner-request futures.");
  }
  return matches[0]?.futureId ?? null;
}

function validateReview(review: A1SpatialCommitmentReviewEvidence): void {
  if (review.kind !== "A1_SPATIAL_COMMITMENT_REVIEW_EVIDENCE") {
    throw new Error("A1 commitment deliberation requires commitment review evidence.");
  }
  if (
    review.decisionClaim !== "NONE_EVIDENCE_ONLY" ||
    review.scalarScoreClaim !== "NONE" ||
    review.selectionClaim !== "NONE" ||
    review.runtimeAuthorityClaim !== "NONE" ||
    review.playerFutureAggregationClaim !== "NONE" ||
    review.playerFutureProbabilityClaim !== "NONE" ||
    review.playerFutureBooleanCollapseClaim !== "NONE" ||
    review.jointNoContactSafetyClaim !== "NONE" ||
    review.jointAnchorOccupancyEquivalenceClaim !== "NONE" ||
    review.jointCooperationPolicyClaim !== "NONE" ||
    review.jointBooleanCollapseClaim !== "NONE"
  ) {
    throw new Error("A1 commitment deliberation refuses review evidence that already contains decision, aggregation, probability, safety, priority or authority claims.");
  }
}

function validateRightOfWayDossier(
  review: A1SpatialCommitmentReviewEvidence,
  dossier: A1SpatialCommitmentRightOfWayEvidenceDossier | null
): void {
  if (!dossier) return;
  if (
    dossier.kind !== "A1_SPATIAL_COMMITMENT_RIGHT_OF_WAY_EVIDENCE_DOSSIER" ||
    dossier.sourceTick !== review.sourceTick ||
    dossier.commitmentSourceTick !== review.commitmentSourceTick
  ) {
    throw new Error(
      "A1 commitment deliberation requires right-of-way dossier evidence aligned to the same review source."
    );
  }
  const h1 = ownerRequestFutureId(review);
  if (dossier.ownerRequestFutureId !== h1) {
    throw new Error(
      "A1 commitment deliberation refuses a right-of-way dossier from a different Owner-request future."
    );
  }
  if (
    dossier.contactToHarmClaim !== "NONE_CONTACT_IS_NOT_A_HARM_SCALAR" ||
    dossier.noContactSafetyClaim !== "NONE_NO_OBSERVED_CONTACT_OR_DISTURBANCE_DOES_NOT_ESTABLISH_GENERAL_SAFETY" ||
    dossier.impactToPriorityClaim !== "NONE_MEASURED_OWNER_FLOW_DIFFERENCE_IS_NOT_RIGHT_OF_WAY_PRIORITY" ||
    dossier.futureWeightingClaim !== "NONE" ||
    dossier.harmThresholdClaim !== "NONE" ||
    dossier.scalarScoreClaim !== "NONE" ||
    dossier.rightOfWayPriorityClaim !== "NONE" ||
    dossier.yieldPolicyClaim !== "NONE" ||
    dossier.decisionClaim !== "NONE_EVIDENCE_DOSSIER_ONLY" ||
    dossier.selectionClaim !== "NONE" ||
    dossier.runtimeAuthorityClaim !== "NONE"
  ) {
    throw new Error(
      "A1 commitment deliberation refuses dossier input that already contains harm, priority, weighting, policy, decision, selection or runtime-authority claims."
    );
  }
}

function rightOfWayContext(
  dossier: A1SpatialCommitmentRightOfWayEvidenceDossier | null
): A1SpatialCommitmentDeliberationRightOfWayContext {
  if (!dossier) {
    return {
      status: "NOT_SUPPLIED",
      ownerRequestFutureId: null,
      ownerRequestJointContactFrameCount: null,
      alternateJointContactFutureIds: [],
      alternateJointNoContactRehearsedFutureIds: [],
      alternateJointCausalUnresolvedFutureIds: [],
      alternateJointReferenceUnresolvedFutureIds: [],
      executionOnlyContactFrameCount: null,
      peakPlayerProgressDeficitVsHold: null,
      integratedPlayerProgressDeficitSeconds: null,
      peakPlayerLateralDeltaMagnitudeVsHold: null,
      integratedPlayerLateralDeviationSeconds: null,
      evidenceScopeClaim: "NOT_SUPPLIED",
      harmClaim: "NONE",
      rightOfWayPriorityClaim: "NONE",
      futureWeightingClaim: "NONE",
      runtimeAuthorityClaim: "NONE"
    };
  }
  return {
    status: "SUPPLIED_H1_OWNER_FLOW_EVIDENCE",
    ownerRequestFutureId: dossier.ownerRequestFutureId,
    ownerRequestJointContactFrameCount: dossier.ownerRequestJointContactFrameCount,
    alternateJointContactFutureIds: [...dossier.alternateJointContactFutureIds],
    alternateJointNoContactRehearsedFutureIds: [
      ...dossier.alternateJointNoContactRehearsedFutureIds
    ],
    alternateJointCausalUnresolvedFutureIds: [
      ...dossier.alternateJointCausalUnresolvedFutureIds
    ],
    alternateJointReferenceUnresolvedFutureIds: [
      ...dossier.alternateJointReferenceUnresolvedFutureIds
    ],
    executionOnlyContactFrameCount: dossier.executionOnlyContactFrameCount,
    peakPlayerProgressDeficitVsHold: dossier.peakPlayerProgressDeficitVsHold,
    integratedPlayerProgressDeficitSeconds: dossier.integratedPlayerProgressDeficitSeconds,
    peakPlayerLateralDeltaMagnitudeVsHold:
      dossier.peakPlayerLateralDeltaMagnitudeVsHold,
    integratedPlayerLateralDeviationSeconds:
      dossier.integratedPlayerLateralDeviationSeconds,
    evidenceScopeClaim:
      "H1_CAUSAL_OWNER_FLOW_PLUS_UNWEIGHTED_ALTERNATE_FUTURES",
    harmClaim: "NONE",
    rightOfWayPriorityClaim: "NONE",
    futureWeightingClaim: "NONE",
    runtimeAuthorityClaim: "NONE"
  };
}

function uncertaintyReasons(
  review: A1SpatialCommitmentReviewEvidence
): A1SpatialCommitmentDeliberationReason[] {
  const reasons: A1SpatialCommitmentDeliberationReason[] = [];
  if (review.uncertainties.includes("PARTIAL_ROUTE_COVERAGE")) {
    reasons.push("PARTIAL_ROUTE_COVERAGE");
  }
  if (review.playerFutureCausalUnresolvedIds.length > 0) {
    reasons.push("PLAYER_FUTURE_CAUSAL_UNRESOLVED");
  }
  if (review.playerFutureReferenceUnresolvedIds.length > 0) {
    reasons.push("PLAYER_FUTURE_REFERENCE_UNRESOLVED");
  }
  if (review.jointCausalUnresolvedFutureIds.length > 0) {
    reasons.push("JOINT_FUTURE_CAUSAL_UNRESOLVED");
  }
  if (review.jointReferenceUnresolvedFutureIds.length > 0) {
    reasons.push("JOINT_FUTURE_REFERENCE_UNRESOLVED");
  }
  if (review.jointStaticBlockedFutureIds.length > 0) {
    reasons.push("JOINT_FUTURE_STATIC_BLOCKED");
  }
  return reasons;
}

function fixedOption(
  option: A1SpatialCommitmentDeliberationOption,
  reasonsForConsideration: A1SpatialCommitmentDeliberationReason[],
  reasonsAgainstPrematureConclusion: A1SpatialCommitmentDeliberationReason[],
  openQuestions: A1SpatialCommitmentDeliberationOpenQuestion[]
): A1SpatialCommitmentDeliberationOptionEvidence {
  return {
    option,
    reasonsForConsideration,
    reasonsAgainstPrematureConclusion,
    openQuestions
  };
}

/**
 * First cognition-facing interpretation layer over commitment review evidence.
 *
 * This deliberately produces a fixed set of deliberation hypotheses rather
 * than a selected action. A reason means "this evidence makes the question
 * worth considering", not "this option is justified" and not "do this".
 */
export function buildA1SpatialCommitmentDeliberationFrame(
  review: A1SpatialCommitmentReviewEvidence,
  dossier: A1SpatialCommitmentRightOfWayEvidenceDossier | null = null
): A1SpatialCommitmentDeliberationFrame {
  validateReview(review);
  validateRightOfWayDossier(review, dossier);

  const h1 = ownerRequestFutureId(review);
  const uncertainty = uncertaintyReasons(review);
  const semanticBreak = review.facts.some((fact) => SEMANTIC_BREAK_FACTS.has(fact));
  const h1AnchorOverlap = h1 !== null && review.playerFutureOverlapIds.includes(h1);
  const h1JointContact = h1 !== null && review.jointContactFutureIds.includes(h1);
  const h1JointNoContact = h1 !== null && review.jointNoContactRehearsedFutureIds.includes(h1);
  const otherJointContact = review.jointContactFutureIds.some((id) => id !== h1);

  const maintainReasons: A1SpatialCommitmentDeliberationReason[] = [];
  if (!semanticBreak && review.sourceFit.semanticStatus === "COMPARABLE") {
    maintainReasons.push("SEMANTIC_COMPARABILITY_PRESENT");
  }
  if (review.referenceMode !== "UNRESOLVED") {
    maintainReasons.push("REFERENCE_REMAINS_RESOLVED");
  }
  if (review.materialStatus === "STATIC_ROUTE_REACHABLE") {
    maintainReasons.push("STATIC_ROUTE_REACHABLE");
  }
  const maintainCautions = [...uncertainty];
  if (hasFact(review, "CURRENT_PLAYER_BODY_OVERLAP")) {
    maintainCautions.push("CURRENT_PLAYER_BODY_OVERLAP");
  }
  if (h1JointContact) maintainCautions.push("OWNER_REQUEST_JOINT_CONTACT");
  if (otherJointContact) maintainCautions.push("OTHER_FUTURE_JOINT_CONTACT");

  const deferReasons: A1SpatialCommitmentDeliberationReason[] = [];
  if (hasFact(review, "CURRENT_PLAYER_BODY_OVERLAP")) {
    deferReasons.push("CURRENT_PLAYER_BODY_OVERLAP");
  }
  if (h1JointContact) deferReasons.push("OWNER_REQUEST_JOINT_CONTACT");
  if (otherJointContact) deferReasons.push("OTHER_FUTURE_JOINT_CONTACT");
  const deferCautions = [...uncertainty];
  if (review.jointDirectCapabilityClipped === true) {
    deferCautions.push("DIRECT_REALIZATION_CAPABILITY_CLIPPED");
  }

  const yieldReasons: A1SpatialCommitmentDeliberationReason[] = [];
  const yieldCautions = [...uncertainty];
  if (h1JointContact) {
    yieldReasons.push("OWNER_REQUEST_JOINT_CONTACT");
  }
  if (!h1JointContact && h1AnchorOverlap && h1JointNoContact) {
    yieldCautions.push("OWNER_REQUEST_ANCHOR_OVERLAP_WITHOUT_JOINT_CONTACT");
  }

  const reframeReasons: A1SpatialCommitmentDeliberationReason[] = [];
  if (hasFact(review, "SEMANTIC_ORIENTATION_REGIME_CHANGED")) {
    reframeReasons.push("SEMANTIC_ORIENTATION_REGIME_CHANGED");
  }
  if (hasFact(review, "SEMANTIC_OBJECTIVE_CHANGED")) {
    reframeReasons.push("SEMANTIC_OBJECTIVE_CHANGED");
  }
  if (
    hasFact(review, "REFERENCE_SOURCE_BASIS_MISSING") ||
    hasFact(review, "REFERENCE_CURRENT_BASIS_MISSING")
  ) {
    reframeReasons.push("REFERENCE_BASIS_MISSING");
  }
  if (hasFact(review, "STATIC_ANCHOR_TARGET_BLOCKED")) {
    reframeReasons.push("STATIC_ANCHOR_TARGET_BLOCKED");
  }
  if (hasFact(review, "STATIC_ANCHOR_ROUTE_UNREACHABLE")) {
    reframeReasons.push("STATIC_ANCHOR_ROUTE_UNREACHABLE");
  }
  const reframeCautions = [...uncertainty];

  const options: A1SpatialCommitmentDeliberationOptionEvidence[] = [
    fixedOption(
      "MAINTAIN_COMMITMENT",
      maintainReasons,
      maintainCautions,
      [
        "DOES_COMMITMENT_MEANING_STILL_APPLY",
        "IS_CURRENT_ANCHOR_STILL_THE_RIGHT_SPATIAL_EXPRESSION",
        "IS_A_DIFFERENT_COMMITMENT_REALIZATION_PREFERABLE"
      ]
    ),
    fixedOption(
      "DEFER_EXECUTION",
      deferReasons,
      deferCautions,
      [
        "SHOULD_EXECUTION_WAIT_WHILE_PLAYER_OCCUPIES_OR_CROSSES_THE_SPACE",
        "DOES_LONGER_OR_DIFFERENT_HORIZON_CHANGE_INTERFERENCE"
      ]
    ),
    fixedOption(
      "YIELD_TO_OWNER_FLOW",
      yieldReasons,
      yieldCautions,
      [
        "SHOULD_OWNER_FLOW_HAVE_PRIORITY_OVER_COMMITMENT_EXECUTION",
        "HOW_SHOULD_UNRESOLVED_PLAYER_FUTURES_AFFECT_CAUTION",
        "DOES_LONGER_OR_DIFFERENT_HORIZON_CHANGE_INTERFERENCE"
      ]
    ),
    fixedOption(
      "REFRAME_COMMITMENT",
      reframeReasons,
      reframeCautions,
      [
        "DOES_COMMITMENT_MEANING_STILL_APPLY",
        "IS_CURRENT_ANCHOR_STILL_THE_RIGHT_SPATIAL_EXPRESSION"
      ]
    )
  ];

  return {
    kind: "A1_SPATIAL_COMMITMENT_DELIBERATION_FRAME",
    sourceTick: review.sourceTick,
    commitmentSourceTick: review.commitmentSourceTick,
    ownerRequestFutureId: h1,
    rightOfWayContext: rightOfWayContext(dossier),
    options,
    optionSetClaim: "FIXED_HYPOTHESES_FOR_RESEARCH_NOT_EXHAUSTIVE_POLICY",
    optionOrderingClaim: "NONE_ARRAY_ORDER_NOT_PREFERENCE",
    evidenceInterpretationClaim: "REASONS_FOR_CONSIDERATION_NOT_ACTION_JUSTIFICATION",
    futureProbabilityClaim: "NONE",
    rightOfWayPriorityClaim: "NONE_NOT_ESTABLISHED",
    decisionClaim: "NONE_DELIBERATION_ONLY",
    selectionClaim: "NONE",
    scalarScoreClaim: "NONE",
    runtimeAuthorityClaim: "NONE",
    sourceReview: structuredClone(review)
  };
}
