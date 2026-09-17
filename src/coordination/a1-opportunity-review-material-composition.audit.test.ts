import { describe, expect, it } from "vitest";
import type { A1SpatialCommitmentFitEvidence } from "./a1-spatial-commitment-evidence";
import type { A1SpatialCommitmentMaterialEvidence } from "./a1-spatial-commitment-material";
import { buildA1SpatialCommitmentReviewEvidence } from "./a1-spatial-commitment-review";

function fit(
  overrides: Partial<A1SpatialCommitmentFitEvidence> = {}
): A1SpatialCommitmentFitEvidence {
  return {
    kind: "A1_SPATIAL_COMMITMENT_FIT",
    sourceTick: 10,
    commitmentSourceTick: 2,
    referenceFrame: "PLAYER_RIGID",
    anchorProvenance: "MATERIAL_COMPOSITION_AUDIT",
    referenceResolutionStatus: "RESOLVED",
    referenceUnresolvedReason: null,
    referenceSourceBasisProvenance: "CANONICAL_SEMANTIC_ORIENTATION",
    referenceSourceBasisSourceTick: 2,
    referenceSourceBasisAgeTicksAtCommitment: 0,
    referenceBasisProvenance: "CANONICAL_SEMANTIC_ORIENTATION",
    referenceBasisSourceTick: 10,
    referenceBasisAgeTicks: 0,
    resolvedAnchorWorldPosition: { x: 4, y: 5 },
    commitmentObjectiveSignature: "objective-a",
    currentObjectiveSignature: "objective-a",
    commitmentOrientationRegime: "DIRECTIONAL",
    currentOrientationRegime: "DIRECTIONAL",
    currentSamplingSignature: "sampling-a",
    semanticStatus: "COMPARABLE",
    coverage: "COMPLETE",
    qualificationStrategy: "STRATIFIED_COVERAGE",
    pressureStatus: "EXACT_ON_SAMPLED_MESH",
    sampledPressureDistance: 0,
    nearestConfirmedSampleId: "r1.b10",
    nearestConfirmedWorldPosition: { x: 4, y: 5 },
    nearestConfirmedUtility: 1,
    utilityGapFromCurrentBest: 0,
    confirmedReachableCount: 63,
    untestedCount: 0,
    samplingTruth: "SAMPLED_MESH_ONLY",
    reason: "material composition fixture",
    ...overrides
  };
}

function material(
  status: A1SpatialCommitmentMaterialEvidence["status"]
): A1SpatialCommitmentMaterialEvidence {
  const blocked = status === "STATIC_TARGET_BLOCKED";
  const routeUnreachable = status === "STATIC_ROUTE_UNREACHABLE";
  const disagreement = status === "STATIC_QUERY_DISAGREEMENT";
  const unresolved = status === "REFERENCE_UNRESOLVED";
  return {
    kind: "A1_SPATIAL_COMMITMENT_MATERIAL_EVIDENCE",
    sourceTick: 10,
    commitmentSourceTick: 2,
    status,
    anchorWorldPosition: unresolved ? null : { x: 4, y: 5 },
    companionWorldPosition: { x: 8, y: 5 },
    companionRadius: 0.3,
    targetOccupancy: unresolved ? null : {
      center: { x: 4, y: 5 },
      radius: 0.3,
      clear: !blocked,
      blockers: blocked ? ["wall"] : []
    },
    hardRouteTruth: null,
    occupancyTargetClear: unresolved ? null : !blocked,
    routerTargetClear: unresolved ? null : disagreement ? false : !blocked,
    hardRouteReachable: unresolved ? null : !(blocked || routeUnreachable),
    desiredRouteReachable: unresolved ? null : !(blocked || routeUnreachable),
    comfortErasesHardConnectivity: unresolved ? null : false,
    targetTruthClaim: "LIVE_STATIC_OCCUPANCY_QUERY",
    routeTruthClaim: "DETERMINISTIC_STATIC_ROUTER",
    dynamicActorInteractionClaim: "NOT_EVALUATED_STATIC_WORLD_ONLY",
    decisionClaim: "NONE_EVIDENCE_ONLY",
    runtimeAuthorityClaim: "NONE",
    reason: "material composition fixture"
  };
}

describe("A1 commitment review material composition", () => {
  it("keeps sampled offset and material reachability as separate axes", () => {
    const currentFit = fit({ sampledPressureDistance: 0.14229625554951292 });
    const review = buildA1SpatialCommitmentReviewEvidence(
      currentFit,
      material("STATIC_ROUTE_REACHABLE")
    );

    expect(review.facts).toEqual(["SAMPLED_ANCHOR_OFFSET_OBSERVED"]);
    expect(review.uncertainties).toEqual([]);
    expect(review.materialStatus).toBe("STATIC_ROUTE_REACHABLE");
    expect(review.materialEvidenceScope).toBe(
      "STATIC_WORLD_ONLY_DYNAMIC_ACTORS_NOT_EVALUATED"
    );
  });

  it("adds exact static target blockage as an independent fact without creating a decision", () => {
    const review = buildA1SpatialCommitmentReviewEvidence(
      fit({ sampledPressureDistance: 0.8 }),
      material("STATIC_TARGET_BLOCKED")
    );

    expect(review.facts).toEqual([
      "SAMPLED_ANCHOR_OFFSET_OBSERVED",
      "STATIC_ANCHOR_TARGET_BLOCKED"
    ]);
    expect(review.decisionClaim).toBe("NONE_EVIDENCE_ONLY");
    expect(review.selectionClaim).toBe("NONE");
    expect(review.runtimeAuthorityClaim).toBe("NONE");
  });

  it("keeps static router unreachability distinct from exact target blockage", () => {
    const review = buildA1SpatialCommitmentReviewEvidence(
      fit(),
      material("STATIC_ROUTE_UNREACHABLE")
    );

    expect(review.facts).toEqual(["STATIC_ANCHOR_ROUTE_UNREACHABLE"]);
    expect(review.materialStatus).toBe("STATIC_ROUTE_UNREACHABLE");
  });

  it("turns static-query disagreement into uncertainty rather than choosing a source", () => {
    const review = buildA1SpatialCommitmentReviewEvidence(
      fit(),
      material("STATIC_QUERY_DISAGREEMENT")
    );

    expect(review.facts).toEqual([]);
    expect(review.uncertainties).toEqual(["STATIC_QUERY_DISAGREEMENT"]);
  });

  it("accepts unresolved material evidence only when the spatial reference is also unresolved", () => {
    const unresolvedFit = fit({
      referenceResolutionStatus: "UNRESOLVED",
      referenceUnresolvedReason: "CURRENT_BASIS_MISSING",
      referenceBasisProvenance: "UNRESOLVED",
      referenceBasisSourceTick: null,
      referenceBasisAgeTicks: null,
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
      material("REFERENCE_UNRESOLVED")
    );

    expect(review.facts).toEqual(["REFERENCE_CURRENT_BASIS_MISSING"]);
    expect(review.materialStatus).toBe("REFERENCE_UNRESOLVED");
  });

  it("emits machine-readable orthogonal review evidence without KEEP/DROP policy", () => {
    const specimens = {
      meshOnly: buildA1SpatialCommitmentReviewEvidence(
        fit({ sampledPressureDistance: 0.14229625554951292 }),
        material("STATIC_ROUTE_REACHABLE")
      ),
      blocked: buildA1SpatialCommitmentReviewEvidence(
        fit({ sampledPressureDistance: 0.8 }),
        material("STATIC_TARGET_BLOCKED")
      ),
      routeUnavailable: buildA1SpatialCommitmentReviewEvidence(
        fit(),
        material("STATIC_ROUTE_UNREACHABLE")
      ),
      disagreement: buildA1SpatialCommitmentReviewEvidence(
        fit(),
        material("STATIC_QUERY_DISAGREEMENT")
      )
    };

    console.info(`[A1_SPATIAL_COMMITMENT_REVIEW_MATERIAL_COMPOSITION] ${JSON.stringify({
      specimens,
      interpretation: "Review composition preserves sampled representation error, exact static target blockage, static-router reachability and query disagreement as orthogonal evidence. It still publishes no KEEP/DROP decision, score, selection or runtime authority."
    })}`);
  });
});
