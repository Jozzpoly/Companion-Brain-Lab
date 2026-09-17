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

const EPSILON = 1e-12;

/**
 * Provenance only. This module does not decide which frame is correct and does
 * not transport anchors between ticks. The caller must resolve the declared
 * commitment into World space before asking for fit evidence.
 */
export type A1SpatialCommitmentReferenceFrame =
  | "WORLD_FIXED"
  | "PLAYER_TRANSLATED"
  | "PLAYER_RIGID";

export interface A1SpatialCommitmentDeclaration {
  kind: "A1_SPATIAL_COMMITMENT_DECLARATION";
  sourceTick: number;
  objectiveSignature: string;
  referenceFrame: A1SpatialCommitmentReferenceFrame;
  anchorProvenance: string;
}

export type A1SpatialCommitmentSemanticStatus =
  | "COMPARABLE"
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
  resolvedAnchorWorldPosition: Vec2;
  commitmentObjectiveSignature: string;
  currentObjectiveSignature: string;
  currentSamplingSignature: string;
  semanticStatus: A1SpatialCommitmentSemanticStatus;
  coverage: A1AccessibilityEvidence["coverage"];
  qualificationStrategy: A1AccessibilityEvidence["qualificationStrategy"];
  pressureStatus: A1SampledCommitmentPressureStatus;
  /**
   * Distance to the nearest confirmed reachable sample. Exact only over the
   * current sampled mesh when coverage is COMPLETE. Under PARTIAL coverage it
   * is an upper bound because an untested sample may be closer. Null means the
   * commitment is semantically non-comparable or no reachable sample is known.
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

function semanticById(field: A1RelationshipSemanticField): Map<string, A1RelationshipSemanticSample> {
  return new Map(field.samples.map((sample) => [sample.id, sample]));
}

function projectionById(field: A1RelationshipProjectionField): Map<string, A1RelationshipProjectionSample> {
  return new Map(field.samples.map((sample) => [sample.sampleId, sample]));
}

export function buildA1SpatialCommitmentFitEvidence(input: {
  declaration: A1SpatialCommitmentDeclaration;
  resolvedAnchorWorldPosition: Vec2;
  field: A1RelationshipSemanticField;
  projection: A1RelationshipProjectionField;
  accessibility: A1AccessibilityEvidence;
}): A1SpatialCommitmentFitEvidence {
  validateAlignment(input);
  const anchor = finiteVector(input.resolvedAnchorWorldPosition, "A1 commitment resolved anchor");
  const base = {
    kind: "A1_SPATIAL_COMMITMENT_FIT" as const,
    sourceTick: input.field.sourceTick,
    commitmentSourceTick: input.declaration.sourceTick,
    referenceFrame: input.declaration.referenceFrame,
    anchorProvenance: input.declaration.anchorProvenance,
    resolvedAnchorWorldPosition: anchor,
    commitmentObjectiveSignature: input.declaration.objectiveSignature,
    currentObjectiveSignature: input.field.objectiveSignature,
    currentSamplingSignature: input.field.samplingSignature,
    coverage: input.accessibility.coverage,
    qualificationStrategy: input.accessibility.qualificationStrategy,
    confirmedReachableCount: input.accessibility.confirmedReachableSampleIds.length,
    untestedCount: input.accessibility.untestedSampleIds.length,
    samplingTruth: "SAMPLED_MESH_ONLY" as const
  };

  if (input.declaration.objectiveSignature !== input.field.objectiveSignature) {
    return {
      ...base,
      semanticStatus: "OBJECTIVE_CHANGED",
      pressureStatus: "NON_COMPARABLE",
      sampledPressureDistance: null,
      nearestConfirmedSampleId: null,
      nearestConfirmedWorldPosition: null,
      nearestConfirmedUtility: null,
      utilityGapFromCurrentBest: null,
      reason: "Commitment meaning changed; spatial fit must not be interpreted across objective signatures."
    };
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
      semanticStatus: "COMPARABLE",
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
    semanticStatus: "COMPARABLE",
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
