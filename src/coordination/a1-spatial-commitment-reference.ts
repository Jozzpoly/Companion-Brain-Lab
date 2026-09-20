import type { Vec2 } from "../world/types";
import type { A1RelationshipOrientationEvidence } from "./a1-relationship-orientation";
const EPSILON = 1e-12;

export type A1SpatialCommitmentReferenceFrame =
  | "WORLD_FIXED"
  | "PLAYER_TRANSLATED"
  | "PLAYER_RIGID";

export type A1SpatialCommitmentReferenceResolutionStatus =
  | "RESOLVED"
  | "UNRESOLVED";

export type A1SpatialCommitmentReferenceBasisProvenance =
  | "NOT_REQUIRED"
  | "CANONICAL_SEMANTIC_ORIENTATION"
  | "RETAINED_LAST_SEMANTIC_FRAME"
  | "UNRESOLVED";

export type A1SpatialCommitmentReferenceUnresolvedReason =
  | "SOURCE_BASIS_MISSING"
  | "CURRENT_BASIS_MISSING"
  | null;

export interface A1RetainedSemanticReferenceBasis {
  provenance: "RETAINED_LAST_SEMANTIC_FRAME";
  direction: Vec2;
  sourceTick: number;
}

export interface A1SpatialCommitmentReferenceResolutionEvidence {
  kind: "A1_SPATIAL_COMMITMENT_REFERENCE_RESOLUTION";
  commitmentSourceTick: number;
  currentTick: number;
  referenceFrame: A1SpatialCommitmentReferenceFrame;
  status: A1SpatialCommitmentReferenceResolutionStatus;
  unresolvedReason: A1SpatialCommitmentReferenceUnresolvedReason;
  sourceAnchorWorldPosition: Vec2;
  sourcePlayerWorldPosition: Vec2;
  currentPlayerWorldPosition: Vec2;
  sourceBasisDirection: Vec2 | null;
  sourceBasisProvenance: A1SpatialCommitmentReferenceBasisProvenance;
  sourceBasisSourceTick: number | null;
  sourceBasisAgeTicksAtCommitment: number | null;
  currentBasisDirection: Vec2 | null;
  currentBasisProvenance: A1SpatialCommitmentReferenceBasisProvenance;
  currentBasisSourceTick: number | null;
  currentBasisAgeTicks: number | null;
  currentOrientationSource: A1RelationshipOrientationEvidence["source"];
  currentSamplingBasisSource: A1RelationshipOrientationEvidence["samplingBasisSource"];
  resolvedAnchorWorldPosition: Vec2 | null;
  reason: string;
}

function finiteVector(value: Vec2, label: string): Vec2 {
  if (!Number.isFinite(value.x) || !Number.isFinite(value.y)) {
    throw new Error(`${label} requires finite x/y components.`);
  }
  return { ...value };
}

function normalized(value: Vec2, label: string): Vec2 {
  const finite = finiteVector(value, label);
  const length = Math.hypot(finite.x, finite.y);
  if (length <= EPSILON) throw new Error(`${label} requires a nonzero direction.`);
  return { x: finite.x / length, y: finite.y / length };
}

function dot(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.y * b.y;
}

function left(direction: Vec2): Vec2 {
  return { x: -direction.y, y: direction.x };
}

function translatedAnchor(input: {
  sourceAnchor: Vec2;
  sourcePlayer: Vec2;
  currentPlayer: Vec2;
}): Vec2 {
  return {
    x: input.sourceAnchor.x + input.currentPlayer.x - input.sourcePlayer.x,
    y: input.sourceAnchor.y + input.currentPlayer.y - input.sourcePlayer.y
  };
}

function rigidAnchor(input: {
  sourceAnchor: Vec2;
  sourcePlayer: Vec2;
  currentPlayer: Vec2;
  sourceForward: Vec2;
  currentForward: Vec2;
}): Vec2 {
  const sourceOffset = {
    x: input.sourceAnchor.x - input.sourcePlayer.x,
    y: input.sourceAnchor.y - input.sourcePlayer.y
  };
  const sourceLeft = left(input.sourceForward);
  const currentLeft = left(input.currentForward);
  const forwardComponent = dot(sourceOffset, input.sourceForward);
  const leftComponent = dot(sourceOffset, sourceLeft);
  return {
    x: input.currentPlayer.x
      + input.currentForward.x * forwardComponent
      + currentLeft.x * leftComponent,
    y: input.currentPlayer.y
      + input.currentForward.y * forwardComponent
      + currentLeft.y * leftComponent
  };
}

export function resolveA1SpatialCommitmentReference(input: {
  commitmentSourceTick: number;
  referenceFrame: A1SpatialCommitmentReferenceFrame;
  sourceAnchorWorldPosition: Vec2;
  sourcePlayerWorldPosition: Vec2;
  currentPlayerWorldPosition: Vec2;
  sourceOrientation?: A1RelationshipOrientationEvidence | null;
  currentOrientation: A1RelationshipOrientationEvidence;
  retainedCurrentSemanticBasis?: A1RetainedSemanticReferenceBasis | null;
}): A1SpatialCommitmentReferenceResolutionEvidence {
  if (
    !Number.isInteger(input.commitmentSourceTick) ||
    input.commitmentSourceTick < 0 ||
    input.commitmentSourceTick > input.currentOrientation.tick
  ) {
    throw new Error("A1 commitment reference resolution requires a valid source tick not later than current orientation.");
  }

  const sourceAnchor = finiteVector(input.sourceAnchorWorldPosition, "A1 commitment source anchor");
  const sourcePlayer = finiteVector(input.sourcePlayerWorldPosition, "A1 commitment source player");
  const currentPlayer = finiteVector(input.currentPlayerWorldPosition, "A1 commitment current player");
  const base = {
    kind: "A1_SPATIAL_COMMITMENT_REFERENCE_RESOLUTION" as const,
    commitmentSourceTick: input.commitmentSourceTick,
    currentTick: input.currentOrientation.tick,
    referenceFrame: input.referenceFrame,
    sourceAnchorWorldPosition: sourceAnchor,
    sourcePlayerWorldPosition: sourcePlayer,
    currentPlayerWorldPosition: currentPlayer,
    currentOrientationSource: input.currentOrientation.source,
    currentSamplingBasisSource: input.currentOrientation.samplingBasisSource
  };

  if (input.referenceFrame === "WORLD_FIXED") {
    return {
      ...base,
      status: "RESOLVED",
      unresolvedReason: null,
      sourceBasisDirection: null,
      sourceBasisProvenance: "NOT_REQUIRED",
      sourceBasisSourceTick: null,
      sourceBasisAgeTicksAtCommitment: null,
      currentBasisDirection: null,
      currentBasisProvenance: "NOT_REQUIRED",
      currentBasisSourceTick: null,
      currentBasisAgeTicks: null,
      resolvedAnchorWorldPosition: { ...sourceAnchor },
      reason: "World-fixed commitment does not require a player-orientation reference basis."
    };
  }

  if (input.referenceFrame === "PLAYER_TRANSLATED") {
    return {
      ...base,
      status: "RESOLVED",
      unresolvedReason: null,
      sourceBasisDirection: null,
      sourceBasisProvenance: "NOT_REQUIRED",
      sourceBasisSourceTick: null,
      sourceBasisAgeTicksAtCommitment: null,
      currentBasisDirection: null,
      currentBasisProvenance: "NOT_REQUIRED",
      currentBasisSourceTick: null,
      currentBasisAgeTicks: null,
      resolvedAnchorWorldPosition: translatedAnchor({ sourceAnchor, sourcePlayer, currentPlayer }),
      reason: "Player-translated commitment follows player translation and does not require an orientation basis."
    };
  }

  if (input.sourceOrientation && input.sourceOrientation.tick !== input.commitmentSourceTick) {
    throw new Error("A1 rigid commitment source orientation must be captured at the commitment source tick.");
  }
  const sourceBasis = (
    input.sourceOrientation?.samplingBasisSource === "SEMANTIC_ORIENTATION" &&
    input.sourceOrientation.direction
  )
    ? normalized(input.sourceOrientation.direction, "A1 rigid commitment source semantic basis")
    : null;
  const sourceBasisSourceTick = sourceBasis ? input.sourceOrientation?.sourceTick ?? null : null;
  const sourceBasisAgeTicksAtCommitment = sourceBasis ? input.sourceOrientation?.ageTicks ?? null : null;
  if (!sourceBasis) {
    return {
      ...base,
      status: "UNRESOLVED",
      unresolvedReason: "SOURCE_BASIS_MISSING",
      sourceBasisDirection: null,
      sourceBasisProvenance: "UNRESOLVED",
      sourceBasisSourceTick: null,
      sourceBasisAgeTicksAtCommitment: null,
      currentBasisDirection: null,
      currentBasisProvenance: "UNRESOLVED",
      currentBasisSourceTick: null,
      currentBasisAgeTicks: null,
      resolvedAnchorWorldPosition: null,
      reason: "Player-rigid commitment cannot be reconstructed without its source semantic orientation basis."
    };
  }

  let currentBasis: Vec2 | null = null;
  let currentBasisProvenance: A1SpatialCommitmentReferenceBasisProvenance = "UNRESOLVED";
  let currentBasisSourceTick: number | null = null;
  let currentBasisAgeTicks: number | null = null;
  if (
    input.currentOrientation.samplingBasisSource === "SEMANTIC_ORIENTATION" &&
    input.currentOrientation.direction
  ) {
    currentBasis = normalized(
      input.currentOrientation.direction,
      "A1 rigid commitment canonical current semantic basis"
    );
    currentBasisProvenance = "CANONICAL_SEMANTIC_ORIENTATION";
    currentBasisSourceTick = input.currentOrientation.sourceTick;
    currentBasisAgeTicks = input.currentOrientation.ageTicks;
  } else if (input.retainedCurrentSemanticBasis) {
    if (
      !Number.isInteger(input.retainedCurrentSemanticBasis.sourceTick) ||
      input.retainedCurrentSemanticBasis.sourceTick < 0 ||
      input.retainedCurrentSemanticBasis.sourceTick > input.currentOrientation.tick
    ) {
      throw new Error("A1 retained semantic reference basis carries an invalid source tick.");
    }
    currentBasis = normalized(
      input.retainedCurrentSemanticBasis.direction,
      "A1 rigid commitment retained current semantic basis"
    );
    currentBasisProvenance = "RETAINED_LAST_SEMANTIC_FRAME";
    currentBasisSourceTick = input.retainedCurrentSemanticBasis.sourceTick;
    currentBasisAgeTicks = input.currentOrientation.tick - input.retainedCurrentSemanticBasis.sourceTick;
  }

  if (!currentBasis) {
    return {
      ...base,
      status: "UNRESOLVED",
      unresolvedReason: "CURRENT_BASIS_MISSING",
      sourceBasisDirection: sourceBasis,
      sourceBasisProvenance: "CANONICAL_SEMANTIC_ORIENTATION",
      sourceBasisSourceTick,
      sourceBasisAgeTicksAtCommitment,
      currentBasisDirection: null,
      currentBasisProvenance: "UNRESOLVED",
      currentBasisSourceTick: null,
      currentBasisAgeTicks: null,
      resolvedAnchorWorldPosition: null,
      reason: "Player-rigid commitment has no canonical or explicitly retained semantic current basis; technical sampling basis is not a semantic fallback."
    };
  }

  return {
    ...base,
    status: "RESOLVED",
    unresolvedReason: null,
    sourceBasisDirection: sourceBasis,
    sourceBasisProvenance: "CANONICAL_SEMANTIC_ORIENTATION",
    sourceBasisSourceTick,
    sourceBasisAgeTicksAtCommitment,
    currentBasisDirection: currentBasis,
    currentBasisProvenance,
    currentBasisSourceTick,
    currentBasisAgeTicks,
    resolvedAnchorWorldPosition: rigidAnchor({
      sourceAnchor,
      sourcePlayer,
      currentPlayer,
      sourceForward: sourceBasis,
      currentForward: currentBasis
    }),
    reason: currentBasisProvenance === "CANONICAL_SEMANTIC_ORIENTATION"
      ? "Player-rigid commitment resolved from canonical semantic orientation."
      : "Player-rigid commitment resolved from an explicitly retained semantic frame; retention remains visible in provenance."
  };
}
