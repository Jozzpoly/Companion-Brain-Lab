import type { A1SpatialCommitmentFitEvidence } from "./a1-spatial-commitment-evidence";
import type { A1SpatialCommitmentMaterialEvidence } from "./a1-spatial-commitment-material";
import type { A1SpatialCommitmentActorOccupancyEvidence } from "./a1-spatial-commitment-actor-occupancy";
import type { A1SpatialCommitmentPlayerFutureSetEvidence } from "./a1-spatial-commitment-player-future-set";
import type { A1SpatialCommitmentJointFutureSetEvidence } from "./a1-spatial-commitment-joint-future";

const ZERO_EPSILON = 1e-9;

export type A1SpatialCommitmentReviewFact =
  | "SEMANTIC_ORIENTATION_REGIME_CHANGED"
  | "SEMANTIC_OBJECTIVE_CHANGED"
  | "REFERENCE_SOURCE_BASIS_MISSING"
  | "REFERENCE_CURRENT_BASIS_MISSING"
  | "NO_CONFIRMED_REACHABLE_SAMPLED_OPPORTUNITY"
  | "SAMPLED_ANCHOR_OFFSET_OBSERVED"
  | "STATIC_ANCHOR_TARGET_BLOCKED"
  | "STATIC_ANCHOR_ROUTE_UNREACHABLE"
  | "CURRENT_PLAYER_BODY_OVERLAP";

export type A1SpatialCommitmentReviewUncertainty =
  | "PARTIAL_ROUTE_COVERAGE"
  | "STATIC_QUERY_DISAGREEMENT";

export type A1SpatialCommitmentReferenceMode =
  | "NOT_REQUIRED"
  | "CANONICAL"
  | "RETAINED"
  | "UNRESOLVED";

export interface A1SpatialCommitmentReviewEvidence {
  kind: "A1_SPATIAL_COMMITMENT_REVIEW_EVIDENCE";
  sourceTick: number;
  commitmentSourceTick: number;
  facts: readonly A1SpatialCommitmentReviewFact[];
  uncertainties: readonly A1SpatialCommitmentReviewUncertainty[];
  referenceMode: A1SpatialCommitmentReferenceMode;
  referenceBasisAgeTicks: number | null;
  sampledPressureStatus: A1SpatialCommitmentFitEvidence["pressureStatus"];
  sampledPressureDistance: number | null;
  materialStatus: A1SpatialCommitmentMaterialEvidence["status"] | "NOT_SUPPLIED";
  materialEvidenceScope: "NOT_SUPPLIED" | "STATIC_WORLD_ONLY_DYNAMIC_ACTORS_NOT_EVALUATED";
  actorOccupancyStatus: A1SpatialCommitmentActorOccupancyEvidence["status"] | "NOT_SUPPLIED";
  actorOccupancyEvidenceScope: "NOT_SUPPLIED" | "CURRENT_TICK_ONLY_NO_FUTURE_PREDICTION";
  playerFutureSetStatus: "NOT_SUPPLIED" | "PRESERVED_DISTINCT_COUNTERFACTUALS";
  playerFutureHorizonSeconds: number | null;
  playerFutureOverlapIds: readonly string[];
  playerFutureSampledClearIds: readonly string[];
  playerFutureReferenceUnresolvedIds: readonly string[];
  playerFutureCausalUnresolvedIds: readonly string[];
  playerFutureAggregationClaim: "NONE";
  playerFutureProbabilityClaim: "NONE";
  playerFutureBooleanCollapseClaim: "NONE";
  jointFutureSetStatus: A1SpatialCommitmentJointFutureSetEvidence["status"] | "NOT_SUPPLIED";
  jointHorizonSeconds: number | null;
  jointDirectRealizationStatus: A1SpatialCommitmentJointFutureSetEvidence["directRealization"]["status"] | "NOT_SUPPLIED";
  jointDirectCapabilityClipped: boolean | null;
  jointDirectTerminalAnchorError: number | null;
  jointContactFutureIds: readonly string[];
  jointNoContactRehearsedFutureIds: readonly string[];
  jointReferenceUnresolvedFutureIds: readonly string[];
  jointCausalUnresolvedFutureIds: readonly string[];
  jointContactEvidenceClaim: "NOT_SUPPLIED" | "SAME_PHYSICS_RECIPROCAL_CONTACT_FRAMES_ONLY";
  jointNoContactSafetyClaim: "NONE";
  jointAnchorOccupancyEquivalenceClaim: "NONE";
  jointCooperationPolicyClaim: "NONE";
  jointBooleanCollapseClaim: "NONE";
  evidenceScope: "SAMPLED_MESH_ONLY_CONTINUOUS_OPPORTUNITY_NOT_ESTABLISHED";
  decisionClaim: "NONE_EVIDENCE_ONLY";
  scalarScoreClaim: "NONE";
  selectionClaim: "NONE";
  runtimeAuthorityClaim: "NONE";
  sourceFit: A1SpatialCommitmentFitEvidence;
  sourceMaterial: A1SpatialCommitmentMaterialEvidence | null;
  sourceActorOccupancy: A1SpatialCommitmentActorOccupancyEvidence | null;
  sourcePlayerFutureSet: A1SpatialCommitmentPlayerFutureSetEvidence | null;
  sourceJointFutureSet: A1SpatialCommitmentJointFutureSetEvidence | null;
}

function referenceMode(
  fit: A1SpatialCommitmentFitEvidence
): A1SpatialCommitmentReferenceMode {
  if (fit.referenceResolutionStatus === "UNRESOLVED") return "UNRESOLVED";
  if (fit.referenceBasisProvenance === "NOT_REQUIRED") return "NOT_REQUIRED";
  if (fit.referenceBasisProvenance === "CANONICAL_SEMANTIC_ORIENTATION") {
    return "CANONICAL";
  }
  if (fit.referenceBasisProvenance === "RETAINED_LAST_SEMANTIC_FRAME") {
    return "RETAINED";
  }
  throw new Error(
    "A1 commitment review found a resolved reference with unresolved basis provenance."
  );
}

function validateFit(fit: A1SpatialCommitmentFitEvidence): void {
  if (fit.kind !== "A1_SPATIAL_COMMITMENT_FIT") {
    throw new Error("A1 commitment review requires qualified fit evidence.");
  }

  if (
    fit.referenceResolutionStatus === "UNRESOLVED" &&
    fit.pressureStatus !== "NON_COMPARABLE"
  ) {
    throw new Error(
      "A1 commitment review refuses unresolved reference with sampled pressure."
    );
  }

  if (
    fit.semanticStatus !== "COMPARABLE" &&
    fit.pressureStatus !== "NON_COMPARABLE"
  ) {
    throw new Error(
      "A1 commitment review refuses semantically non-comparable sampled pressure."
    );
  }

  if (
    fit.pressureStatus === "EXACT_ON_SAMPLED_MESH" &&
    (fit.coverage !== "COMPLETE" || fit.sampledPressureDistance === null)
  ) {
    throw new Error(
      "A1 commitment review requires complete coverage and a distance for exact sampled pressure."
    );
  }

  if (
    fit.pressureStatus === "CONFIRMED_UPPER_BOUND" &&
    (fit.coverage !== "PARTIAL" || fit.sampledPressureDistance === null)
  ) {
    throw new Error(
      "A1 commitment review requires partial coverage and a distance for confirmed upper-bound pressure."
    );
  }

  if (
    (fit.pressureStatus === "NON_COMPARABLE" ||
      fit.pressureStatus === "NO_CONFIRMED_REACHABLE") &&
    fit.sampledPressureDistance !== null
  ) {
    throw new Error(
      "A1 commitment review refuses a numeric distance when sampled pressure is unavailable."
    );
  }
}

function validateMaterial(
  fit: A1SpatialCommitmentFitEvidence,
  material: A1SpatialCommitmentMaterialEvidence
): void {
  if (material.kind !== "A1_SPATIAL_COMMITMENT_MATERIAL_EVIDENCE") {
    throw new Error("A1 commitment review requires qualified material evidence.");
  }
  if (
    material.sourceTick !== fit.sourceTick ||
    material.commitmentSourceTick !== fit.commitmentSourceTick
  ) {
    throw new Error("A1 commitment review material evidence is not tick/commitment aligned with fit evidence.");
  }

  if (fit.referenceResolutionStatus === "UNRESOLVED") {
    if (
      material.status !== "REFERENCE_UNRESOLVED" ||
      material.anchorWorldPosition !== null
    ) {
      throw new Error("A1 commitment review requires unresolved material evidence when the fit reference is unresolved.");
    }
    return;
  }

  if (material.status === "REFERENCE_UNRESOLVED" || material.anchorWorldPosition === null) {
    throw new Error("A1 commitment review refuses unresolved material evidence for a resolved fit reference.");
  }

  const anchor = fit.resolvedAnchorWorldPosition;
  if (!anchor) {
    throw new Error("A1 commitment review resolved fit unexpectedly lacks an anchor.");
  }
  if (
    Math.hypot(
      material.anchorWorldPosition.x - anchor.x,
      material.anchorWorldPosition.y - anchor.y
    ) > ZERO_EPSILON
  ) {
    throw new Error("A1 commitment review material anchor does not match the fit reference anchor.");
  }
}

function validateActorOccupancy(
  fit: A1SpatialCommitmentFitEvidence,
  actorOccupancy: A1SpatialCommitmentActorOccupancyEvidence
): void {
  if (actorOccupancy.kind !== "A1_SPATIAL_COMMITMENT_ACTOR_OCCUPANCY_EVIDENCE") {
    throw new Error("A1 commitment review requires qualified actor-occupancy evidence.");
  }
  if (
    actorOccupancy.sourceTick !== fit.sourceTick ||
    actorOccupancy.commitmentSourceTick !== fit.commitmentSourceTick
  ) {
    throw new Error("A1 commitment review actor occupancy is not tick/commitment aligned with fit evidence.");
  }

  if (fit.referenceResolutionStatus === "UNRESOLVED") {
    if (
      actorOccupancy.status !== "REFERENCE_UNRESOLVED" ||
      actorOccupancy.anchorWorldPosition !== null
    ) {
      throw new Error("A1 commitment review requires unresolved actor occupancy when the fit reference is unresolved.");
    }
    return;
  }

  if (
    actorOccupancy.status === "REFERENCE_UNRESOLVED" ||
    actorOccupancy.anchorWorldPosition === null
  ) {
    throw new Error("A1 commitment review refuses unresolved actor occupancy for a resolved fit reference.");
  }

  const anchor = fit.resolvedAnchorWorldPosition;
  if (!anchor) {
    throw new Error("A1 commitment review resolved fit unexpectedly lacks an anchor.");
  }
  if (
    Math.hypot(
      actorOccupancy.anchorWorldPosition.x - anchor.x,
      actorOccupancy.anchorWorldPosition.y - anchor.y
    ) > ZERO_EPSILON
  ) {
    throw new Error("A1 commitment review actor-occupancy anchor does not match the fit reference anchor.");
  }
}

function validatePlayerFutureSet(
  fit: A1SpatialCommitmentFitEvidence,
  set: A1SpatialCommitmentPlayerFutureSetEvidence
): void {
  if (set.kind !== "A1_SPATIAL_COMMITMENT_PLAYER_FUTURE_SET_EVIDENCE") {
    throw new Error("A1 commitment review requires qualified player-future set evidence.");
  }
  if (
    set.sourceTick !== fit.sourceTick ||
    set.commitmentSourceTick !== fit.commitmentSourceTick
  ) {
    throw new Error("A1 commitment review player-future set is not tick/commitment aligned with fit evidence.");
  }
  if (
    set.aggregationClaim !== "NONE_PRESERVE_DISTINCT_PLAYER_FUTURES" ||
    set.probabilityClaim !== "NONE_COUNTERFACTUAL_SET_NOT_FORECAST_DISTRIBUTION" ||
    set.selectionClaim !== "NONE" ||
    set.fallbackSubstitutionClaim !== "NONE_UNRESOLVED_FUTURES_REMAIN_EXPLICIT" ||
    set.liveWorldMutationClaim !== "NONE_QUERY_ONLY_REHEARSALS" ||
    set.runtimeAuthorityClaim !== "NONE"
  ) {
    throw new Error("A1 commitment review refuses player-future evidence with aggregation, probability, substitution, mutation or authority claims.");
  }
  if (
    set.futures.length !== set.futureCount ||
    set.rehearsedCount + set.causalUnresolvedCount !== set.futureCount
  ) {
    throw new Error("A1 commitment review player-future counts are inconsistent.");
  }

  const ids = new Set<string>();
  for (const future of set.futures) {
    if (ids.has(future.futureId)) {
      throw new Error(`A1 commitment review refuses duplicate player-future id: ${future.futureId}.`);
    }
    ids.add(future.futureId);

    if (future.interventionStatus === "UNRESOLVED") {
      if (future.occupancy !== null || future.unresolvedReason === null) {
        throw new Error("A1 commitment review causal-unresolved future must preserve null occupancy and explicit reason.");
      }
      continue;
    }

    if (future.unresolvedReason !== null || future.occupancy === null) {
      throw new Error("A1 commitment review rehearsed future must preserve occupancy and no causal unresolved reason.");
    }
    const occupancy = future.occupancy;
    if (
      occupancy.sourceTick !== fit.sourceTick ||
      occupancy.commitmentSourceTick !== fit.commitmentSourceTick ||
      occupancy.futureId !== future.futureId
    ) {
      throw new Error("A1 commitment review rehearsed occupancy is not aligned with its fit/future identity.");
    }

    if (fit.referenceResolutionStatus === "UNRESOLVED") {
      if (
        occupancy.status !== "REFERENCE_UNRESOLVED" ||
        occupancy.anchorWorldPosition !== null
      ) {
        throw new Error("A1 commitment review requires reference-unresolved rehearsed futures when fit reference is unresolved.");
      }
      continue;
    }

    if (
      occupancy.status === "REFERENCE_UNRESOLVED" ||
      occupancy.anchorWorldPosition === null
    ) {
      throw new Error("A1 commitment review refuses reference-unresolved rehearsed future for resolved fit reference.");
    }
    const anchor = fit.resolvedAnchorWorldPosition;
    if (!anchor) {
      throw new Error("A1 commitment review resolved fit unexpectedly lacks an anchor.");
    }
    if (
      Math.hypot(
        occupancy.anchorWorldPosition.x - anchor.x,
        occupancy.anchorWorldPosition.y - anchor.y
      ) > ZERO_EPSILON
    ) {
      throw new Error("A1 commitment review player-future occupancy anchor does not match fit reference anchor.");
    }
  }
}

function validateJointFutureSet(
  fit: A1SpatialCommitmentFitEvidence,
  playerFutureSet: A1SpatialCommitmentPlayerFutureSetEvidence | null,
  joint: A1SpatialCommitmentJointFutureSetEvidence
): void {
  if (joint.kind !== "A1_SPATIAL_COMMITMENT_JOINT_FUTURE_SET_EVIDENCE") {
    throw new Error("A1 commitment review requires qualified joint-future evidence.");
  }
  if (
    joint.sourceTick !== fit.sourceTick ||
    joint.commitmentSourceTick !== fit.commitmentSourceTick
  ) {
    throw new Error("A1 commitment review joint-future set is not tick/commitment aligned with fit evidence.");
  }
  if (
    joint.contactEvidenceClaim !== "SAME_PHYSICS_RECIPROCAL_CONTACT_FRAMES_ONLY" ||
    joint.noContactSafetyClaim !== "NONE_NO_CONTACT_DOES_NOT_ESTABLISH_GENERAL_SAFETY" ||
    joint.anchorOccupancyEquivalenceClaim !== "NONE_ANCHOR_OVERLAP_IS_NOT_JOINT_CONTACT" ||
    joint.cooperationPolicyClaim !== "NONE_EVIDENCE_ONLY" ||
    joint.selectionClaim !== "NONE" ||
    joint.runtimeAuthorityClaim !== "NONE"
  ) {
    throw new Error("A1 commitment review refuses joint evidence with stronger contact, safety, equivalence, policy, selection or authority claims.");
  }
  if (!playerFutureSet) {
    throw new Error("A1 commitment review requires the source player-future set whenever joint-future evidence is supplied.");
  }
  if (
    Math.abs(joint.horizonSeconds - playerFutureSet.horizonSeconds) > ZERO_EPSILON ||
    joint.sourceTick !== playerFutureSet.sourceTick ||
    joint.commitmentSourceTick !== playerFutureSet.commitmentSourceTick
  ) {
    throw new Error("A1 commitment review joint-future evidence does not align with its player-future set.");
  }

  const sourceIds = playerFutureSet.futures.map((value) => value.futureId);
  const jointIds = joint.futures.map((value) => value.futureId);
  for (const id of jointIds) {
    if (!sourceIds.includes(id)) {
      throw new Error(`A1 commitment review joint future ${id} is not present in the source player-future set.`);
    }
  }
  for (const id of joint.contactFutureIds) {
    const entry = joint.futures.find((value) => value.futureId === id);
    if (!entry || entry.status !== "REHEARSED" || entry.contactFrameCount <= 0) {
      throw new Error(`A1 commitment review joint contact id ${id} lacks positive rehearsed contact evidence.`);
    }
  }
  for (const id of joint.noContactRehearsedFutureIds) {
    const entry = joint.futures.find((value) => value.futureId === id);
    if (!entry || entry.status !== "REHEARSED" || entry.contactFrameCount !== 0) {
      throw new Error(`A1 commitment review joint no-contact id ${id} lacks zero-contact rehearsed evidence.`);
    }
  }

  if (
    joint.status === "REFERENCE_UNRESOLVED" &&
    fit.referenceResolutionStatus !== "UNRESOLVED"
  ) {
    throw new Error("A1 commitment review refuses reference-unresolved joint evidence for a resolved commitment reference.");
  }
  if (
    joint.status !== "REFERENCE_UNRESOLVED" &&
    fit.referenceResolutionStatus === "UNRESOLVED"
  ) {
    throw new Error("A1 commitment review requires reference-unresolved joint evidence when commitment reference is unresolved.");
  }
}

/**
 * Observational composition only. This function deliberately does not decide
 * whether the companion should keep, release, replace or execute a commitment.
 * It preserves independent reasons and uncertainty instead of collapsing them
 * into a score, veto, winner or runtime command.
 */
export function buildA1SpatialCommitmentReviewEvidence(
  fit: A1SpatialCommitmentFitEvidence,
  material: A1SpatialCommitmentMaterialEvidence | null = null,
  actorOccupancy: A1SpatialCommitmentActorOccupancyEvidence | null = null,
  playerFutureSet: A1SpatialCommitmentPlayerFutureSetEvidence | null = null,
  jointFutureSet: A1SpatialCommitmentJointFutureSetEvidence | null = null
): A1SpatialCommitmentReviewEvidence {
  validateFit(fit);
  if (material) validateMaterial(fit, material);
  if (actorOccupancy) validateActorOccupancy(fit, actorOccupancy);
  if (playerFutureSet) validatePlayerFutureSet(fit, playerFutureSet);
  if (jointFutureSet) validateJointFutureSet(fit, playerFutureSet, jointFutureSet);

  const facts: A1SpatialCommitmentReviewFact[] = [];
  const uncertainties: A1SpatialCommitmentReviewUncertainty[] = [];

  if (fit.semanticStatus === "ORIENTATION_REGIME_CHANGED") {
    facts.push("SEMANTIC_ORIENTATION_REGIME_CHANGED");
  } else if (fit.semanticStatus === "OBJECTIVE_CHANGED") {
    facts.push("SEMANTIC_OBJECTIVE_CHANGED");
  }

  if (fit.referenceResolutionStatus === "UNRESOLVED") {
    if (fit.referenceUnresolvedReason === "SOURCE_BASIS_MISSING") {
      facts.push("REFERENCE_SOURCE_BASIS_MISSING");
    } else if (fit.referenceUnresolvedReason === "CURRENT_BASIS_MISSING") {
      facts.push("REFERENCE_CURRENT_BASIS_MISSING");
    } else {
      throw new Error(
        "A1 commitment review found unresolved reference without an unresolved reason."
      );
    }
  }

  if (fit.coverage === "PARTIAL") {
    uncertainties.push("PARTIAL_ROUTE_COVERAGE");
  }

  if (
    fit.pressureStatus === "NO_CONFIRMED_REACHABLE" &&
    fit.coverage === "COMPLETE"
  ) {
    facts.push("NO_CONFIRMED_REACHABLE_SAMPLED_OPPORTUNITY");
  }

  if (
    fit.pressureStatus === "EXACT_ON_SAMPLED_MESH" &&
    fit.sampledPressureDistance !== null &&
    fit.sampledPressureDistance > ZERO_EPSILON
  ) {
    facts.push("SAMPLED_ANCHOR_OFFSET_OBSERVED");
  }

  if (material?.status === "STATIC_TARGET_BLOCKED") {
    facts.push("STATIC_ANCHOR_TARGET_BLOCKED");
  } else if (material?.status === "STATIC_ROUTE_UNREACHABLE") {
    facts.push("STATIC_ANCHOR_ROUTE_UNREACHABLE");
  } else if (material?.status === "STATIC_QUERY_DISAGREEMENT") {
    uncertainties.push("STATIC_QUERY_DISAGREEMENT");
  }

  if (actorOccupancy?.status === "PLAYER_BODY_OVERLAP") {
    facts.push("CURRENT_PLAYER_BODY_OVERLAP");
  }

  const playerFutureOverlapIds: string[] = [];
  const playerFutureSampledClearIds: string[] = [];
  const playerFutureReferenceUnresolvedIds: string[] = [];
  const playerFutureCausalUnresolvedIds: string[] = [];
  if (playerFutureSet) {
    for (const future of playerFutureSet.futures) {
      if (future.interventionStatus === "UNRESOLVED") {
        playerFutureCausalUnresolvedIds.push(future.futureId);
        continue;
      }
      if (future.occupancy.status === "SAMPLED_PLAYER_FUTURE_OVERLAP") {
        playerFutureOverlapIds.push(future.futureId);
      } else if (future.occupancy.status === "NO_SAMPLED_PLAYER_FUTURE_OVERLAP") {
        playerFutureSampledClearIds.push(future.futureId);
      } else {
        playerFutureReferenceUnresolvedIds.push(future.futureId);
      }
    }
  }

  return {
    kind: "A1_SPATIAL_COMMITMENT_REVIEW_EVIDENCE",
    sourceTick: fit.sourceTick,
    commitmentSourceTick: fit.commitmentSourceTick,
    facts,
    uncertainties,
    referenceMode: referenceMode(fit),
    referenceBasisAgeTicks: fit.referenceBasisAgeTicks,
    sampledPressureStatus: fit.pressureStatus,
    sampledPressureDistance: fit.sampledPressureDistance,
    materialStatus: material?.status ?? "NOT_SUPPLIED",
    materialEvidenceScope: material
      ? "STATIC_WORLD_ONLY_DYNAMIC_ACTORS_NOT_EVALUATED"
      : "NOT_SUPPLIED",
    actorOccupancyStatus: actorOccupancy?.status ?? "NOT_SUPPLIED",
    actorOccupancyEvidenceScope: actorOccupancy
      ? "CURRENT_TICK_ONLY_NO_FUTURE_PREDICTION"
      : "NOT_SUPPLIED",
    playerFutureSetStatus: playerFutureSet
      ? "PRESERVED_DISTINCT_COUNTERFACTUALS"
      : "NOT_SUPPLIED",
    playerFutureHorizonSeconds: playerFutureSet?.horizonSeconds ?? null,
    playerFutureOverlapIds,
    playerFutureSampledClearIds,
    playerFutureReferenceUnresolvedIds,
    playerFutureCausalUnresolvedIds,
    playerFutureAggregationClaim: "NONE",
    playerFutureProbabilityClaim: "NONE",
    playerFutureBooleanCollapseClaim: "NONE",
    jointFutureSetStatus: jointFutureSet?.status ?? "NOT_SUPPLIED",
    jointHorizonSeconds: jointFutureSet?.horizonSeconds ?? null,
    jointDirectRealizationStatus: jointFutureSet?.directRealization.status ?? "NOT_SUPPLIED",
    jointDirectCapabilityClipped:
      jointFutureSet?.directRealization.realization?.capabilityClipped ?? null,
    jointDirectTerminalAnchorError:
      jointFutureSet?.directRealization.terminalAnchorError ?? null,
    jointContactFutureIds: jointFutureSet ? [...jointFutureSet.contactFutureIds] : [],
    jointNoContactRehearsedFutureIds: jointFutureSet
      ? [...jointFutureSet.noContactRehearsedFutureIds]
      : [],
    jointReferenceUnresolvedFutureIds: jointFutureSet
      ? [...jointFutureSet.referenceUnresolvedFutureIds]
      : [],
    jointCausalUnresolvedFutureIds: jointFutureSet
      ? [...jointFutureSet.causalUnresolvedFutureIds]
      : [],
    jointContactEvidenceClaim: jointFutureSet
      ? "SAME_PHYSICS_RECIPROCAL_CONTACT_FRAMES_ONLY"
      : "NOT_SUPPLIED",
    jointNoContactSafetyClaim: "NONE",
    jointAnchorOccupancyEquivalenceClaim: "NONE",
    jointCooperationPolicyClaim: "NONE",
    jointBooleanCollapseClaim: "NONE",
    evidenceScope: "SAMPLED_MESH_ONLY_CONTINUOUS_OPPORTUNITY_NOT_ESTABLISHED",
    decisionClaim: "NONE_EVIDENCE_ONLY",
    scalarScoreClaim: "NONE",
    selectionClaim: "NONE",
    runtimeAuthorityClaim: "NONE",
    sourceFit: structuredClone(fit),
    sourceMaterial: material ? structuredClone(material) : null,
    sourceActorOccupancy: actorOccupancy ? structuredClone(actorOccupancy) : null,
    sourcePlayerFutureSet: playerFutureSet ? structuredClone(playerFutureSet) : null,
    sourceJointFutureSet: jointFutureSet ? structuredClone(jointFutureSet) : null
  };
}
