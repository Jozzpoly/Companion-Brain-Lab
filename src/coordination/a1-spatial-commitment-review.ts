import type { A1SpatialCommitmentFitEvidence } from "./a1-spatial-commitment-evidence";

const ZERO_EPSILON = 1e-9;

export type A1SpatialCommitmentReviewFact =
  | "SEMANTIC_ORIENTATION_REGIME_CHANGED"
  | "SEMANTIC_OBJECTIVE_CHANGED"
  | "REFERENCE_SOURCE_BASIS_MISSING"
  | "REFERENCE_CURRENT_BASIS_MISSING"
  | "NO_CONFIRMED_REACHABLE_SAMPLED_OPPORTUNITY"
  | "SAMPLED_ANCHOR_OFFSET_OBSERVED";

export type A1SpatialCommitmentReviewUncertainty =
  | "PARTIAL_ROUTE_COVERAGE";

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
  evidenceScope: "SAMPLED_MESH_ONLY_CONTINUOUS_OPPORTUNITY_NOT_ESTABLISHED";
  decisionClaim: "NONE_EVIDENCE_ONLY";
  scalarScoreClaim: "NONE";
  selectionClaim: "NONE";
  runtimeAuthorityClaim: "NONE";
  sourceFit: A1SpatialCommitmentFitEvidence;
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

/**
 * Observational composition only. This function deliberately does not decide
 * whether the companion should keep, release, replace or execute a commitment.
 * It preserves independent reasons and uncertainty instead of collapsing them
 * into a score, veto, winner or runtime command.
 */
export function buildA1SpatialCommitmentReviewEvidence(
  fit: A1SpatialCommitmentFitEvidence
): A1SpatialCommitmentReviewEvidence {
  validateFit(fit);

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
    evidenceScope: "SAMPLED_MESH_ONLY_CONTINUOUS_OPPORTUNITY_NOT_ESTABLISHED",
    decisionClaim: "NONE_EVIDENCE_ONLY",
    scalarScoreClaim: "NONE",
    selectionClaim: "NONE",
    runtimeAuthorityClaim: "NONE",
    sourceFit: structuredClone(fit)
  };
}
