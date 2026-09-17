import type { Vec2 } from "../world/types";
import type { A1AccessibilityEvidence } from "./a1-accessibility-fragments";
import type {
  A1RelationshipProjectionField,
  A1RelationshipProjectionSample
} from "./a1-relationship-projection";
import type {
  A1RelationshipSemanticField,
  A1RelationshipSemanticSample
} from "./a1-relationship-utility";
import type {
  A1SpatialCommitmentReferenceBasisProvenance,
  A1SpatialCommitmentReferenceFrame,
  A1SpatialCommitmentReferenceResolutionEvidence,
  A1SpatialCommitmentReferenceResolutionStatus,
  A1SpatialCommitmentReferenceUnresolvedReason
} from "./a1-spatial-commitment-reference";

export type { A1SpatialCommitmentReferenceFrame } from "./a1-spatial-commitment-reference";

const EPSILON = 1e-12;

export type A1SpatialCommitmentOrientationRegime =
  | "DIRECTIONAL"
  | "DIRECTIONLESS";

export interface A1SpatialCommitmentDeclaration {
  kind: "A1_SPATIAL_COMMITMENT_DECLARATION";
  sourceTick: number;
  objectiveSignature: string;
  orientationRegime: A1SpatialCommitmentOrientationRegime;
  referenceFrame: A1SpatialCommitmentReferenceFrame;
  anchorProvenance: string;
}

export type A1SpatialCommitmentSemanticStatus =
  | "COMPARABLE"
  | "ORIENTATION_REGIME_CHANGED"
  | "OBJECTIVE_CHANGED";

export type A1SampledCommitmentPressureStatus =
  | "EXACT_ON_SAMPLED_MESH"
  | "CONFIRMED_UPPER_BOUND"
  | "NO_CONFIRMED_REACHABLE"
  | "NON_COMPARABLE";

export interface A1SpatialCommitmentFitEvidence {
  kind: "A1_SPATIAL_COMMITMENT_FIT";
  sourceTick: number;
  commitmentSourceTick: number;
  referenceFrame: A1SpatialCommitmentReferenceFrame;
  anchorProvenance: string;
  referenceResolutionStatus: A1SpatialCommitmentReferenceResolutionStatus;
  referenceUnresolvedReason: A1SpatialCommitmentReferenceUnresolvedReason;
  referenceBasisProvenance: A1SpatialCommitmentReferenceBasisProvenance;
  resolvedAnchorWorldPosition: Vec2 | null;
  commitmentObjectiveSignature: string;
  currentObjectiveSignature: string;
  commitmentOrientationRegime: A1SpatialCommitmentOrientationRegime;
  currentOrientationRegime: A1SpatialCommitmentOrientationRegime;
  currentSamplingSignature: string;
  semanticStatus: A1SpatialCommitmentSemanticStatus;
  coverage: A1AccessibilityEvidence["coverage"];
  qualificationStrategy: A1AccessibilityEvidence["qualificationStrategy"];
  pressureStatus: A1SampledCommitmentPressureStatus;
  /**
   * Distance to the nearest confirmed reachable sample. Exact only over the
   * current sampled mesh when coverage is COMPLETE. Under PARTIAL coverage it
   * is an upper bound because an untested sample may be closer. Null means the
   * reference is unresolved, semantics are non-comparable, or no reachable
   * sample is known.
   */
  sampledPressureDistance: number | null;
  nearestConfirmedSampleId: string | null;
  nearestConfirmedWorldPosition: Vec2 | null;
  nearestConfirmedUtility: number | null;
  utilityGapFromCurrentBest: number | null;
  confirmedReachableCount: number;
  untestedCount: number;
  samplingTruth: "SAMPLED_MESH_ONLY";
  reason: string;
}

interface AlignedCommitmentObservation {
  field: A1RelationshipSemanticField;
  projection: A1RelationshipProjectionField;
  accessibility: A1AccessibilityEvidence;
}

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function finiteVector(value: Vec2, label: string): Vec2 {
  if (!Number.isFinite(value.x) || !Number.isFinite(value.y)) {
    throw new Error(`${label} requires finite x/y components.`);
  }
  return { ...value };
}

function validateAlignment(input: AlignedCommitmentObservation): void {
  if (
    input.field.sourceTick !== input.projection.sourceTick ||
    input.field.sourceTick !== input.accessibility.sourceTick ||
    input.projection.semanticSourceTick !== input.field.sourceTick ||
    input.accessibility.semanticSourceTick !== input.field.sourceTick
  ) {
    throw new Error("A1 commitment fit requires same-tick semantic, projection and accessibility evidence.");
  }
  if (input.projection.routeCoverageComplete !== (input.accessibility.coverage === "COMPLETE")) {
    throw new Error("A1 commitment fit found inconsistent route coverage provenance.");
  }
}

function validateReferenceResolution(
  declaration: A1SpatialCommitmentDeclaration,
  reference: A1SpatialCommitmentReferenceResolutionEvidence,
  currentTick: number
): void {
  if (reference.kind !== "A1_SPATIAL_COMMITMENT_REFERENCE_RESOLUTION") {
    throw new Error("A1 commitment fit requires reference-resolution evidence.");
  }
  if (
    reference.commitmentSourceTick !== declaration.sourceTick ||
    reference.referenceFrame !== declaration.referenceFrame
  ) {
    throw new Error("A1 commitment fit reference-resolution provenance does not match the declaration.");
  }
  if (reference.currentTick !== currentTick) {
    throw new Error("A1 commitment fit requires same-tick reference resolution and semantic evidence.");
  }
  if (reference.status === "RESOLVED") {
    if (!reference.resolvedAnchorWorldPosition || reference.unresolvedReason !== null) {
      throw new Error("A1 resolved commitment reference must carry an anchor and no unresolved reason.");
    }
  } else if (
    reference.resolvedAnchorWorldPosition !== null ||
    reference.unresolvedReason === null ||
    reference.currentBasisProvenance !== "UNRESOLVED"
  ) {
    throw new Error("A1 unresolved commitment reference must not carry a resolved anchor or resolved basis provenance.");
  }
}

function semanticById(field: A1RelationshipSemanticField): Map<string, A1RelationshipSemanticSample> {
  return new Map(field.samples.map((sample) => [sample.id, sample]));
}

function projectionById(field: A1RelationshipProjectionField): Map<string, A1RelationshipProjectionSample> {
  return new Map(field.samples.map((sample) => [sample.sampleId, sample]));
}

function orientationRegime(field: A1RelationshipSemanticField): A1SpatialCommitmentOrientationRegime {
  return field.samplingBasisSource === "SEMANTIC_ORIENTATION"
    ? "DIRECTIONAL"
    : "DIRECTIONLESS";
}

function semanticStatus(
  declaration: A1SpatialCommitmentDeclaration,
  field: A1RelationshipSemanticField
): A1SpatialCommitmentSemanticStatus {
  if (declaration.orientationRegime !== orientationRegime(field)) {
    return "ORIENTATION_REGIME_CHANGED";
  }
  if (declaration.objectiveSignature !== field.objectiveSignature) {
    return "OBJECTIVE_CHANGED";
  }
  return "COMPARABLE";
}

function emptyPressure(base: Omit<
  A1SpatialCommitmentFitEvidence,
  "pressureStatus" |
  "sampledPressureDistance" |
  "nearestConfirmedSampleId" |
  "nearestConfirmedWorldPosition" |
  "nearestConfirmedUtility" |
  "utilityGapFromCurrentBest" |
  "reason"
>, reason: string): A1SpatialCommitmentFitEvidence {
  return {
    ...base,
    pressureStatus: "NON_COMPARABLE",
    sampledPressureDistance: null,
    nearestConfirmedSampleId: null,
    nearestConfirmedWorldPosition: null,
    nearestConfirmedUtility: null,
    utilityGapFromCurrentBest: null,
    reason
  };
}

export function buildA1SpatialCommitmentFitEvidence(input: {
  declaration: A1SpatialCommitmentDeclaration;
  referenceResolution: A1SpatialCommitmentReferenceResolutionEvidence;
  field: A1RelationshipSemanticField;
  projection: A1RelationshipProjectionField;
  accessibility: A1AccessibilityEvidence;
}): A1SpatialCommitmentFitEvidence {
  validateAlignment(input);
  validateReferenceResolution(input.declaration, input.referenceResolution, input.field.sourceTick);

  const currentSemanticStatus = semanticStatus(input.declaration, input.field);
  const anchor = input.referenceResolution.resolvedAnchorWorldPosition
    ? finiteVector(input.referenceResolution.resolvedAnchorWorldPosition, "A1 commitment resolved anchor")
    : null;
  const base = {
    kind: "A1_SPATIAL_COMMITMENT_FIT" as const,
    sourceTick: input.field.sourceTick,
    commitmentSourceTick: input.declaration.sourceTick,
    referenceFrame: input.declaration.referenceFrame,
    anchorProvenance: input.declaration.anchorProvenance,
    referenceResolutionStatus: input.referenceResolution.status,
    referenceUnresolvedReason: input.referenceResolution.unresolvedReason,
    referenceBasisProvenance: input.referenceResolution.currentBasisProvenance,
    resolvedAnchorWorldPosition: anchor,
    commitmentObjectiveSignature: input.declaration.objectiveSignature,
    currentObjectiveSignature: input.field.objectiveSignature,
    commitmentOrientationRegime: input.declaration.orientationRegime,
    currentOrientationRegime: orientationRegime(input.field),
    currentSamplingSignature: input.field.samplingSignature,
    semanticStatus: currentSemanticStatus,
    coverage: input.accessibility.coverage,
    qualificationStrategy: input.accessibility.qualificationStrategy,
    confirmedReachableCount: input.accessibility.confirmedReachableSampleIds.length,
    untestedCount: input.accessibility.untestedSampleIds.length,
    samplingTruth: "SAMPLED_MESH_ONLY" as const
  };

  if (input.referenceResolution.status === "UNRESOLVED") {
    return emptyPressure(
      base,
      `Commitment reference is unresolved (${input.referenceResolution.unresolvedReason}); sampled pressure is unavailable. Semantic status: ${currentSemanticStatus}.`
    );
  }

  if (!anchor) {
    throw new Error("A1 resolved commitment reference unexpectedly lost its anchor.");
  }

  if (currentSemanticStatus === "ORIENTATION_REGIME_CHANGED") {
    return emptyPressure(
      base,
      "Commitment semantic orientation regime changed; spatial fit must not be interpreted across directional and directionless regimes."
    );
  }

  if (currentSemanticStatus === "OBJECTIVE_CHANGED") {
    return emptyPressure(
      base,
      "Commitment meaning changed; spatial fit must not be interpreted across objective signatures."
    );
  }

  const semantic = semanticById(input.field);
  const projected = projectionById(input.projection);
  const candidates = input.accessibility.confirmedReachableSampleIds.map((sampleId) => {
    const semanticSample = semantic.get(sampleId);
    const projectedSample = projected.get(sampleId);
    if (!semanticSample || !projectedSample) {
      throw new Error(`A1 commitment fit lost sample provenance for ${sampleId}.`);
    }
    return {
      sampleId,
      worldPosition: projectedSample.worldPosition,
      utility: semanticSample.utility.totalUtility,
      distance: distance(projectedSample.worldPosition, anchor)
    };
  }).sort((a, b) => {
    const distanceDelta = a.distance - b.distance;
    if (Math.abs(distanceDelta) > EPSILON) return distanceDelta;
    const utilityDelta = b.utility - a.utility;
    if (Math.abs(utilityDelta) > EPSILON) return utilityDelta;
    return a.sampleId.localeCompare(b.sampleId);
  });

  const nearest = candidates[0];
  if (!nearest) {
    return {
      ...base,
      pressureStatus: "NO_CONFIRMED_REACHABLE",
      sampledPressureDistance: null,
      nearestConfirmedSampleId: null,
      nearestConfirmedWorldPosition: null,
      nearestConfirmedUtility: null,
      utilityGapFromCurrentBest: null,
      reason: input.accessibility.coverage === "PARTIAL"
        ? "No reachable sample is confirmed under partial route coverage; commitment pressure is unresolved."
        : "No sampled relational opportunity is confirmed reachable."
    };
  }

  const pressureStatus: A1SampledCommitmentPressureStatus =
    input.accessibility.coverage === "COMPLETE"
      ? "EXACT_ON_SAMPLED_MESH"
      : "CONFIRMED_UPPER_BOUND";

  return {
    ...base,
    pressureStatus,
    sampledPressureDistance: nearest.distance,
    nearestConfirmedSampleId: nearest.sampleId,
    nearestConfirmedWorldPosition: { ...nearest.worldPosition },
    nearestConfirmedUtility: nearest.utility,
    utilityGapFromCurrentBest: Math.max(0, input.field.bestUtility - nearest.utility),
    reason: pressureStatus === "EXACT_ON_SAMPLED_MESH"
      ? "Nearest confirmed reachable sample is exact over the current sampled mesh; continuous unsampled opportunities may still be closer."
      : "Nearest confirmed reachable sample is only an upper bound because untested samples may be closer."
  };
}
