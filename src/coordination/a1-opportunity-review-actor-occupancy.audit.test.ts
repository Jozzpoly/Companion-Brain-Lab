import { describe, expect, it } from "vitest";
import type { A1SpatialCommitmentFitEvidence } from "./a1-spatial-commitment-evidence";
import type { A1SpatialCommitmentMaterialEvidence } from "./a1-spatial-commitment-material";
import type { A1SpatialCommitmentActorOccupancyEvidence } from "./a1-spatial-commitment-actor-occupancy";
import { buildA1SpatialCommitmentReviewEvidence } from "./a1-spatial-commitment-review";

function fit(
  overrides: Partial<A1SpatialCommitmentFitEvidence> = {}
): A1SpatialCommitmentFitEvidence {
  return {
    kind: "A1_SPATIAL_COMMITMENT_FIT",
    sourceTick: 10,
    commitmentSourceTick: 2,
    referenceFrame: "WORLD_FIXED",
    anchorProvenance: "ACTOR_REVIEW_AUDIT",
    referenceResolutionStatus: "RESOLVED",
    referenceUnresolvedReason: null,
    referenceSourceBasisProvenance: "NOT_REQUIRED",
    referenceSourceBasisSourceTick: null,
    referenceSourceBasisAgeTicksAtCommitment: null,
    referenceBasisProvenance: "NOT_REQUIRED",
    referenceBasisSourceTick: null,
    referenceBasisAgeTicks: null,
    resolvedAnchorWorldPosition: { x: 3, y: 4 },
    commitmentObjectiveSignature: "objective",
    currentObjectiveSignature: "objective",
    commitmentOrientationRegime: "DIRECTIONLESS",
    currentOrientationRegime: "DIRECTIONLESS",
    currentSamplingSignature: "sampling",
    semanticStatus: "COMPARABLE",
    coverage: "COMPLETE",
    qualificationStrategy: "STRATIFIED_COVERAGE",
    pressureStatus: "EXACT_ON_SAMPLED_MESH",
    sampledPressureDistance: 0,
    nearestConfirmedSampleId: "audit",
    nearestConfirmedWorldPosition: { x: 3, y: 4 },
    nearestConfirmedUtility: 1,
    utilityGapFromCurrentBest: 0,
    confirmedReachableCount: 1,
    untestedCount: 0,
    samplingTruth: "SAMPLED_MESH_ONLY",
    reason: "actor review fixture",
    ...overrides
  };
}

function material(): A1SpatialCommitmentMaterialEvidence {
  return {
    kind: "A1_SPATIAL_COMMITMENT_MATERIAL_EVIDENCE",
    sourceTick: 10,
    commitmentSourceTick: 2,
    status: "STATIC_ROUTE_REACHABLE",
    anchorWorldPosition: { x: 3, y: 4 },
    companionWorldPosition: { x: 8, y: 4 },
    companionRadius: 0.3,
    targetOccupancy: {
      center: { x: 3, y: 4 },
      radius: 0.3,
      clear: true,
      blockers: []
    },
    hardRouteTruth: null,
    occupancyTargetClear: true,
    routerTargetClear: true,
    hardRouteReachable: true,
    desiredRouteReachable: true,
    comfortErasesHardConnectivity: false,
    targetTruthClaim: "LIVE_STATIC_OCCUPANCY_QUERY",
    routeTruthClaim: "DETERMINISTIC_STATIC_ROUTER",
    dynamicActorInteractionClaim: "NOT_EVALUATED_STATIC_WORLD_ONLY",
    decisionClaim: "NONE_EVIDENCE_ONLY",
    runtimeAuthorityClaim: "NONE",
    reason: "actor review fixture"
  };
}

function actorOccupancy(
  status: A1SpatialCommitmentActorOccupancyEvidence["status"]
): A1SpatialCommitmentActorOccupancyEvidence {
  const unresolved = status === "REFERENCE_UNRESOLVED";
  const overlap = status === "PLAYER_BODY_OVERLAP";
  return {
    kind: "A1_SPATIAL_COMMITMENT_ACTOR_OCCUPANCY_EVIDENCE",
    sourceTick: 10,
    commitmentSourceTick: 2,
    status,
    anchorWorldPosition: unresolved ? null : { x: 3, y: 4 },
    companionRadius: 0.3,
    playerPosition: { x: 3, y: 4 },
    playerRadius: 0.3,
    centerDistanceToPlayer: unresolved ? null : overlap ? 0 : 1,
    requiredNonOverlapDistance: 0.6,
    overlapDepth: unresolved ? null : overlap ? 0.6 : 0,
    bodyTruthClaim: "CURRENT_WORLD_SNAPSHOT_CIRCLE_BODIES",
    temporalClaim: "CURRENT_TICK_ONLY_NO_FUTURE_PREDICTION",
    staticWorldClaim: "NONE_SEPARATE_MATERIAL_EVIDENCE_REQUIRED",
    decisionClaim: "NONE_EVIDENCE_ONLY",
    runtimeAuthorityClaim: "NONE",
    reason: "actor review fixture"
  };
}

describe("A1 commitment review current actor occupancy composition", () => {
  it("adds current player-body overlap independently of static reachability", () => {
    const review = buildA1SpatialCommitmentReviewEvidence(
      fit(),
      material(),
      actorOccupancy("PLAYER_BODY_OVERLAP")
    );

    expect(review.facts).toEqual(["CURRENT_PLAYER_BODY_OVERLAP"]);
    expect(review.materialStatus).toBe("STATIC_ROUTE_REACHABLE");
    expect(review.actorOccupancyStatus).toBe("PLAYER_BODY_OVERLAP");
    expect(review.actorOccupancyEvidenceScope).toBe(
      "CURRENT_TICK_ONLY_NO_FUTURE_PREDICTION"
    );
    expect(review.decisionClaim).toBe("NONE_EVIDENCE_ONLY");
  });

  it("does not turn current actor clearance into a future-safety claim", () => {
    const review = buildA1SpatialCommitmentReviewEvidence(
      fit(),
      material(),
      actorOccupancy("CURRENT_ACTOR_SPACE_CLEAR")
    );

    expect(review.facts).toEqual([]);
    expect(review.actorOccupancyStatus).toBe("CURRENT_ACTOR_SPACE_CLEAR");
    expect(review.actorOccupancyEvidenceScope).toBe(
      "CURRENT_TICK_ONLY_NO_FUTURE_PREDICTION"
    );
  });

  it("requires unresolved actor occupancy when the fit reference is unresolved", () => {
    const unresolvedFit = fit({
      referenceResolutionStatus: "UNRESOLVED",
      referenceUnresolvedReason: "CURRENT_BASIS_MISSING",
      referenceBasisProvenance: "UNRESOLVED",
      resolvedAnchorWorldPosition: null,
      pressureStatus: "NON_COMPARABLE",
      sampledPressureDistance: null,
      nearestConfirmedSampleId: null,
      nearestConfirmedWorldPosition: null,
      nearestConfirmedUtility: null,
      utilityGapFromCurrentBest: null
    });
    const review = buildA1SpatialCommitmentReviewEvidence(
      unresolvedFit,
      null,
      actorOccupancy("REFERENCE_UNRESOLVED")
    );

    expect(review.facts).toEqual(["REFERENCE_CURRENT_BASIS_MISSING"]);
    expect(review.actorOccupancyStatus).toBe("REFERENCE_UNRESOLVED");
  });

  it("emits an orthogonal static-clear/player-occupied specimen without policy", () => {
    const review = buildA1SpatialCommitmentReviewEvidence(
      fit(),
      material(),
      actorOccupancy("PLAYER_BODY_OVERLAP")
    );

    console.info(`[A1_SPATIAL_COMMITMENT_REVIEW_ACTOR_OCCUPANCY] ${JSON.stringify({
      review,
      interpretation: "The same exact anchor can be statically reachable while currently occupied by the player's body. Review preserves that actor-body fact independently and makes no prediction about future player motion or any KEEP/DROP decision."
    })}`);
  });
});
