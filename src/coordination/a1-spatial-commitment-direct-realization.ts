import {
  realizeA1DirectCandidate,
  type A1DirectCandidateRealization
} from "./a1-companion-candidates";
import type { A1Situation } from "./a1-situation";
import type { A1SpatialCommitmentFitEvidence } from "./a1-spatial-commitment-evidence";
import type { Vec2 } from "../world/types";

export type A1SpatialCommitmentDirectRealizationStatus =
  | "REFERENCE_UNRESOLVED"
  | "REALIZED";

export interface A1SpatialCommitmentDirectRealizationEvidence {
  kind: "A1_SPATIAL_COMMITMENT_DIRECT_REALIZATION_EVIDENCE";
  sourceTick: number;
  commitmentSourceTick: number;
  status: A1SpatialCommitmentDirectRealizationStatus;
  horizonSeconds: number;
  anchorWorldPosition: Vec2 | null;
  companionOrigin: Vec2;
  desiredVelocity: Vec2 | null;
  realization: A1DirectCandidateRealization | null;
  predictedEndpoint: Vec2 | null;
  terminalAnchorError: number | null;
  commandSemantics: "DIRECT_CONSTANT_VELOCITY_TOWARD_EXACT_COMMITMENT_ANCHOR";
  familyProvenance: "COMMITMENT_ANCHOR_DIRECT";
  policyClaim: "NONE_COUNTERFACTUAL_REALIZATION_ONLY";
  selectionClaim: "NONE";
  runtimeAuthorityClaim: "NONE";
  reason: string;
}

function finitePositiveHorizon(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("A1 commitment direct realization requires positive finite horizonSeconds.");
  }
  return value;
}

export function buildA1SpatialCommitmentDirectRealization(input: {
  fit: A1SpatialCommitmentFitEvidence;
  situation: A1Situation;
  horizonSeconds: number;
}): A1SpatialCommitmentDirectRealizationEvidence {
  const horizonSeconds = finitePositiveHorizon(input.horizonSeconds);
  if (
    input.fit.sourceTick !== input.situation.tick ||
    input.situation.situated.tick !== input.situation.tick ||
    input.situation.situated.companionBody.sourceTick !== input.situation.tick
  ) {
    throw new Error("A1 commitment direct realization requires same-tick fit and situated companion body evidence.");
  }

  const origin = { ...input.situation.situated.companionBody.position };
  const base = {
    kind: "A1_SPATIAL_COMMITMENT_DIRECT_REALIZATION_EVIDENCE" as const,
    sourceTick: input.situation.tick,
    commitmentSourceTick: input.fit.commitmentSourceTick,
    horizonSeconds,
    companionOrigin: origin,
    commandSemantics: "DIRECT_CONSTANT_VELOCITY_TOWARD_EXACT_COMMITMENT_ANCHOR" as const,
    familyProvenance: "COMMITMENT_ANCHOR_DIRECT" as const,
    policyClaim: "NONE_COUNTERFACTUAL_REALIZATION_ONLY" as const,
    selectionClaim: "NONE" as const,
    runtimeAuthorityClaim: "NONE" as const
  };

  if (
    input.fit.referenceResolutionStatus === "UNRESOLVED" ||
    !input.fit.resolvedAnchorWorldPosition
  ) {
    return {
      ...base,
      status: "REFERENCE_UNRESOLVED",
      anchorWorldPosition: null,
      desiredVelocity: null,
      realization: null,
      predictedEndpoint: null,
      terminalAnchorError: null,
      reason: "Commitment reference is unresolved; no direct-to-anchor companion counterfactual is fabricated."
    };
  }

  const anchor = { ...input.fit.resolvedAnchorWorldPosition };
  const desiredVelocity = {
    x: (anchor.x - origin.x) / horizonSeconds,
    y: (anchor.y - origin.y) / horizonSeconds
  };
  const realization = realizeA1DirectCandidate({
    candidate: {
      id: `commitment-anchor-direct@t${input.situation.tick}`,
      family: "COMMITMENT_ANCHOR_DIRECT",
      sourceTick: input.situation.tick,
      desiredVelocity,
      localBasisSource: "NONE"
    },
    capability: input.situation.situated.companionCapability,
    horizonSeconds
  });
  const predictedEndpoint = {
    x: origin.x + realization.predictedDisplacement.x,
    y: origin.y + realization.predictedDisplacement.y
  };
  const terminalAnchorError = Math.hypot(
    predictedEndpoint.x - anchor.x,
    predictedEndpoint.y - anchor.y
  );

  return {
    ...base,
    status: "REALIZED",
    anchorWorldPosition: anchor,
    desiredVelocity,
    realization,
    predictedEndpoint,
    terminalAnchorError,
    reason: realization.capabilityClipped
      ? "Direct-to-anchor counterfactual is capability-clipped and cannot reach the exact anchor within the declared horizon."
      : "Direct-to-anchor counterfactual reaches the exact anchor at the declared horizon before dynamic interaction is considered."
  };
}
