import { describe, expect, it } from "vitest";
import type { A1SpatialCommitmentFitEvidence } from "./a1-spatial-commitment-evidence";
import { buildA1SpatialCommitmentReviewEvidence } from "./a1-spatial-commitment-review";

function fit(
  overrides: Partial<A1SpatialCommitmentFitEvidence> = {}
): A1SpatialCommitmentFitEvidence {
  return {
    kind: "A1_SPATIAL_COMMITMENT_FIT",
    sourceTick: 10,
    commitmentSourceTick: 2,
    referenceFrame: "PLAYER_RIGID",
    anchorProvenance: "AUDIT_CONTROL",
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
    reason: "audit fixture",
    ...overrides
  };
}

describe("A1 spatial commitment review evidence", () => {
  it("keeps a healthy live commitment evidence-only without inventing a keep decision", () => {
    const review = buildA1SpatialCommitmentReviewEvidence(fit());

    expect(review.facts).toEqual([]);
    expect(review.uncertainties).toEqual([]);
    expect(review.referenceMode).toBe("CANONICAL");
    expect(review.sampledPressureDistance).toBe(0);
    expect(review.decisionClaim).toBe("NONE_EVIDENCE_ONLY");
    expect(review.scalarScoreClaim).toBe("NONE");
    expect(review.selectionClaim).toBe("NONE");
    expect(review.runtimeAuthorityClaim).toBe("NONE");
  });

  it("separates retained reference from directional semantic validity", () => {
    const review = buildA1SpatialCommitmentReviewEvidence(fit({
      sourceTick: 34,
      referenceBasisProvenance: "RETAINED_LAST_SEMANTIC_FRAME",
      referenceBasisSourceTick: 1,
      referenceBasisAgeTicks: 33,
      currentOrientationRegime: "DIRECTIONLESS",
      semanticStatus: "ORIENTATION_REGIME_CHANGED",
      pressureStatus: "NON_COMPARABLE",
      sampledPressureDistance: null,
      nearestConfirmedSampleId: null,
      nearestConfirmedWorldPosition: null,
      nearestConfirmedUtility: null,
      utilityGapFromCurrentBest: null
    }));

    expect(review.referenceMode).toBe("RETAINED");
    expect(review.referenceBasisAgeTicks).toBe(33);
    expect(review.facts).toEqual(["SEMANTIC_ORIENTATION_REGIME_CHANGED"]);
    expect(review.sampledPressureDistance).toBeNull();
  });

  it("preserves independent semantic and reference failures instead of collapsing them", () => {
    const review = buildA1SpatialCommitmentReviewEvidence(fit({
      sourceTick: 35,
      referenceResolutionStatus: "UNRESOLVED",
      referenceUnresolvedReason: "CURRENT_BASIS_MISSING",
      referenceBasisProvenance: "UNRESOLVED",
      referenceBasisSourceTick: null,
      referenceBasisAgeTicks: null,
      resolvedAnchorWorldPosition: null,
      currentOrientationRegime: "DIRECTIONLESS",
      semanticStatus: "ORIENTATION_REGIME_CHANGED",
      pressureStatus: "NON_COMPARABLE",
      sampledPressureDistance: null,
      nearestConfirmedSampleId: null,
      nearestConfirmedWorldPosition: null,
      nearestConfirmedUtility: null,
      utilityGapFromCurrentBest: null
    }));

    expect(review.referenceMode).toBe("UNRESOLVED");
    expect(review.facts).toEqual([
      "SEMANTIC_ORIENTATION_REGIME_CHANGED",
      "REFERENCE_CURRENT_BASIS_MISSING"
    ]);
  });

  it("exposes objective change as meaning evidence rather than geometry evidence", () => {
    const review = buildA1SpatialCommitmentReviewEvidence(fit({
      currentObjectiveSignature: "objective-b",
      semanticStatus: "OBJECTIVE_CHANGED",
      pressureStatus: "NON_COMPARABLE",
      sampledPressureDistance: null,
      nearestConfirmedSampleId: null,
      nearestConfirmedWorldPosition: null,
      nearestConfirmedUtility: null,
      utilityGapFromCurrentBest: null
    }));

    expect(review.facts).toEqual(["SEMANTIC_OBJECTIVE_CHANGED"]);
    expect(review.uncertainties).toEqual([]);
  });

  it("calls positive complete-mesh pressure only a sampled anchor offset, not a material conflict", () => {
    const review = buildA1SpatialCommitmentReviewEvidence(fit({
      referenceFrame: "PLAYER_TRANSLATED",
      referenceSourceBasisProvenance: "NOT_REQUIRED",
      referenceSourceBasisSourceTick: null,
      referenceSourceBasisAgeTicksAtCommitment: null,
      referenceBasisProvenance: "NOT_REQUIRED",
      referenceBasisSourceTick: null,
      referenceBasisAgeTicks: null,
      sampledPressureDistance: 1.2538633389965699,
      nearestConfirmedSampleId: "r0.b27",
      nearestConfirmedWorldPosition: { x: 4.2, y: 2.9 },
      nearestConfirmedUtility: 0.8,
      utilityGapFromCurrentBest: 0.2
    }));

    expect(review.referenceMode).toBe("NOT_REQUIRED");
    expect(review.facts).toEqual(["SAMPLED_ANCHOR_OFFSET_OBSERVED"]);
    expect(review.evidenceScope).toBe(
      "SAMPLED_MESH_ONLY_CONTINUOUS_OPPORTUNITY_NOT_ESTABLISHED"
    );
  });

  it("keeps a partial-coverage distance as uncertainty, never as observed anchor offset", () => {
    const review = buildA1SpatialCommitmentReviewEvidence(fit({
      coverage: "PARTIAL",
      pressureStatus: "CONFIRMED_UPPER_BOUND",
      sampledPressureDistance: 1.1097819538587599,
      nearestConfirmedSampleId: "r0.b0",
      nearestConfirmedWorldPosition: { x: 5.45, y: 4 },
      confirmedReachableCount: 4,
      untestedCount: 12
    }));

    expect(review.facts).toEqual([]);
    expect(review.uncertainties).toEqual(["PARTIAL_ROUTE_COVERAGE"]);
    expect(review.sampledPressureStatus).toBe("CONFIRMED_UPPER_BOUND");
    expect(review.sampledPressureDistance).toBeCloseTo(1.1097819538587599, 12);
  });

  it("only calls sampled opportunity absence factual when route coverage is complete", () => {
    const review = buildA1SpatialCommitmentReviewEvidence(fit({
      pressureStatus: "NO_CONFIRMED_REACHABLE",
      sampledPressureDistance: null,
      nearestConfirmedSampleId: null,
      nearestConfirmedWorldPosition: null,
      nearestConfirmedUtility: null,
      utilityGapFromCurrentBest: null,
      confirmedReachableCount: 0
    }));

    expect(review.facts).toEqual([
      "NO_CONFIRMED_REACHABLE_SAMPLED_OPPORTUNITY"
    ]);
    expect(review.uncertainties).toEqual([]);
  });

  it("emits a machine-readable contrast without policy, scalarization or authority", () => {
    const specimens = {
      healthy: buildA1SpatialCommitmentReviewEvidence(fit()),
      retainedSemanticMismatch: buildA1SpatialCommitmentReviewEvidence(fit({
        sourceTick: 34,
        referenceBasisProvenance: "RETAINED_LAST_SEMANTIC_FRAME",
        referenceBasisSourceTick: 1,
        referenceBasisAgeTicks: 33,
        currentOrientationRegime: "DIRECTIONLESS",
        semanticStatus: "ORIENTATION_REGIME_CHANGED",
        pressureStatus: "NON_COMPARABLE",
        sampledPressureDistance: null,
        nearestConfirmedSampleId: null,
        nearestConfirmedWorldPosition: null,
        nearestConfirmedUtility: null,
        utilityGapFromCurrentBest: null
      })),
      unresolved: buildA1SpatialCommitmentReviewEvidence(fit({
        sourceTick: 35,
        referenceResolutionStatus: "UNRESOLVED",
        referenceUnresolvedReason: "CURRENT_BASIS_MISSING",
        referenceBasisProvenance: "UNRESOLVED",
        referenceBasisSourceTick: null,
        referenceBasisAgeTicks: null,
        resolvedAnchorWorldPosition: null,
        currentOrientationRegime: "DIRECTIONLESS",
        semanticStatus: "ORIENTATION_REGIME_CHANGED",
        pressureStatus: "NON_COMPARABLE",
        sampledPressureDistance: null,
        nearestConfirmedSampleId: null,
        nearestConfirmedWorldPosition: null,
        nearestConfirmedUtility: null,
        utilityGapFromCurrentBest: null
      })),
      sampledOffset: buildA1SpatialCommitmentReviewEvidence(fit({
        sampledPressureDistance: 1.25
      })),
      partialUpperBound: buildA1SpatialCommitmentReviewEvidence(fit({
        coverage: "PARTIAL",
        pressureStatus: "CONFIRMED_UPPER_BOUND",
        sampledPressureDistance: 1.1,
        confirmedReachableCount: 4,
        untestedCount: 12
      }))
    };

    console.info(
      `[A1_SPATIAL_COMMITMENT_REVIEW_EVIDENCE] ${JSON.stringify({
        specimens,
        interpretation: "Review evidence preserves independent semantic, reference, sampled-fit and coverage facts without KEEP/DROP policy. Positive exact sampled offset is not promoted to a material-conflict claim because continuous unsampled opportunities remain outside this evidence."
      })}`
    );
  });
});
