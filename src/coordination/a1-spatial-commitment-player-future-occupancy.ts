import type { A1PlayerFuturePhysicalRehearsal } from "./a1-player-future-rehearsal";
import type { A1SpatialCommitmentFitEvidence } from "./a1-spatial-commitment-evidence";
import type { ActorSnapshot, Vec2, WorldSnapshot } from "../world/types";

const OVERLAP_EPSILON = 1e-9;

export type A1SpatialCommitmentPlayerFutureOccupancyStatus =
  | "REFERENCE_UNRESOLVED"
  | "SAMPLED_PLAYER_FUTURE_OVERLAP"
  | "NO_SAMPLED_PLAYER_FUTURE_OVERLAP";

export interface A1SpatialCommitmentPlayerFutureOccupancyEvidence {
  kind: "A1_SPATIAL_COMMITMENT_PLAYER_FUTURE_OCCUPANCY_EVIDENCE";
  sourceTick: number;
  commitmentSourceTick: number;
  futureId: string;
  futureFamily: A1PlayerFuturePhysicalRehearsal["futureFamily"];
  causalMeaning: A1PlayerFuturePhysicalRehearsal["causalMeaning"];
  status: A1SpatialCommitmentPlayerFutureOccupancyStatus;
  anchorWorldPosition: Vec2 | null;
  playerRadius: number;
  companionRadius: number;
  requiredNonOverlapDistance: number;
  sampleCount: number;
  minSampledCenterDistance: number | null;
  minSampledClearance: number | null;
  firstOverlapSampleIndex: number | null;
  overlapSampleCount: number;
  declaredHorizonSeconds: number;
  worldStepCount: number;
  playerFutureTruthClaim: "SAME_PHYSICS_SINGLE_COUNTERFACTUAL_A1_2I";
  samplingClaim: "SOURCE_STATE_PLUS_WORLD_STEP_ENDPOINTS_ONLY";
  continuousInterstepSafetyClaim: "NONE_NO_INTERSTEP_SWEEP";
  futureProbabilityClaim: "NONE_COUNTERFACTUAL_NOT_PROBABILITY";
  aggregationClaim: "NONE_SINGLE_FUTURE_ONLY";
  companionMotionClaim: "HOLD_BASELINE_ONLY_NOT_COMMITMENT_EXECUTION";
  decisionClaim: "NONE_EVIDENCE_ONLY";
  runtimeAuthorityClaim: "NONE";
  reason: string;
}

function actor(
  actors: readonly ActorSnapshot[],
  id: "player" | "companion",
  label: string
): ActorSnapshot {
  const value = actors.find((candidate) => candidate.id === id);
  if (!value) throw new Error(`A1 player-future occupancy ${label} is missing ${id}.`);
  return value;
}

function validateAlignment(input: {
  fit: A1SpatialCommitmentFitEvidence;
  snapshot: WorldSnapshot;
  rehearsal: A1PlayerFuturePhysicalRehearsal;
}): void {
  if (input.fit.kind !== "A1_SPATIAL_COMMITMENT_FIT") {
    throw new Error("A1 player-future occupancy requires qualified commitment fit evidence.");
  }
  if (
    input.fit.sourceTick !== input.snapshot.tick ||
    input.fit.sourceTick !== input.rehearsal.sourceTick
  ) {
    throw new Error(
      "A1 player-future occupancy requires same-tick fit, World snapshot and player-future rehearsal."
    );
  }
  if (input.rehearsal.physical.physicsProvenance !== "LIVE_RAPIER_WORLD_SNAPSHOT_RESTORE") {
    throw new Error("A1 player-future occupancy requires the same-physics rehearsal substrate.");
  }
  if (input.rehearsal.aggregationClaim !== "NONE_SINGLE_INTERVENTION_A1_2I") {
    throw new Error("A1 player-future occupancy refuses aggregated player futures.");
  }
  if (input.rehearsal.companionBaseline !== "LIVE_HOLD_CONTROL_ZERO_VELOCITY_EACH_WORLD_STEP") {
    throw new Error("A1 player-future occupancy requires the explicit companion HOLD baseline.");
  }
  if (input.rehearsal.runtimeAuthorityClaim !== "NONE_A1_2I") {
    throw new Error("A1 player-future occupancy refuses rehearsal evidence carrying runtime authority.");
  }
}

export function buildA1SpatialCommitmentPlayerFutureOccupancyEvidence(input: {
  fit: A1SpatialCommitmentFitEvidence;
  snapshot: WorldSnapshot;
  rehearsal: A1PlayerFuturePhysicalRehearsal;
}): A1SpatialCommitmentPlayerFutureOccupancyEvidence {
  validateAlignment(input);

  const sourcePlayer = actor(input.snapshot.actors, "player", "source snapshot");
  const sourceCompanion = actor(input.snapshot.actors, "companion", "source snapshot");
  const requiredNonOverlapDistance = sourcePlayer.radius + sourceCompanion.radius;
  const base = {
    kind: "A1_SPATIAL_COMMITMENT_PLAYER_FUTURE_OCCUPANCY_EVIDENCE" as const,
    sourceTick: input.fit.sourceTick,
    commitmentSourceTick: input.fit.commitmentSourceTick,
    futureId: input.rehearsal.futureId,
    futureFamily: input.rehearsal.futureFamily,
    causalMeaning: input.rehearsal.causalMeaning,
    playerRadius: sourcePlayer.radius,
    companionRadius: sourceCompanion.radius,
    requiredNonOverlapDistance,
    declaredHorizonSeconds: input.rehearsal.declaredHorizonSeconds,
    worldStepCount: input.rehearsal.worldStepCount,
    playerFutureTruthClaim: "SAME_PHYSICS_SINGLE_COUNTERFACTUAL_A1_2I" as const,
    samplingClaim: "SOURCE_STATE_PLUS_WORLD_STEP_ENDPOINTS_ONLY" as const,
    continuousInterstepSafetyClaim: "NONE_NO_INTERSTEP_SWEEP" as const,
    futureProbabilityClaim: "NONE_COUNTERFACTUAL_NOT_PROBABILITY" as const,
    aggregationClaim: "NONE_SINGLE_FUTURE_ONLY" as const,
    companionMotionClaim: "HOLD_BASELINE_ONLY_NOT_COMMITMENT_EXECUTION" as const,
    decisionClaim: "NONE_EVIDENCE_ONLY" as const,
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
      sampleCount: 0,
      minSampledCenterDistance: null,
      minSampledClearance: null,
      firstOverlapSampleIndex: null,
      overlapSampleCount: 0,
      reason: "Commitment reference is unresolved; player-future occupancy is intentionally not inferred."
    };
  }

  const anchor = { ...input.fit.resolvedAnchorWorldPosition };
  const samples: Vec2[] = [{ ...sourcePlayer.position }];
  for (const frame of input.rehearsal.physical.frames) {
    const framePlayer = actor(frame.actors, "player", `rehearsal frame ${frame.stepIndex}`);
    if (Math.abs(framePlayer.radius - sourcePlayer.radius) > OVERLAP_EPSILON) {
      throw new Error("A1 player-future occupancy player radius changed across rehearsal evidence.");
    }
    samples.push({ ...framePlayer.position });
  }

  let minSampledCenterDistance = Number.POSITIVE_INFINITY;
  let firstOverlapSampleIndex: number | null = null;
  let overlapSampleCount = 0;

  samples.forEach((position, index) => {
    const distance = Math.hypot(position.x - anchor.x, position.y - anchor.y);
    minSampledCenterDistance = Math.min(minSampledCenterDistance, distance);
    if (distance < requiredNonOverlapDistance - OVERLAP_EPSILON) {
      overlapSampleCount += 1;
      firstOverlapSampleIndex ??= index;
    }
  });

  const overlaps = overlapSampleCount > 0;
  return {
    ...base,
    status: overlaps
      ? "SAMPLED_PLAYER_FUTURE_OVERLAP"
      : "NO_SAMPLED_PLAYER_FUTURE_OVERLAP",
    anchorWorldPosition: anchor,
    sampleCount: samples.length,
    minSampledCenterDistance,
    minSampledClearance: minSampledCenterDistance - requiredNonOverlapDistance,
    firstOverlapSampleIndex,
    overlapSampleCount,
    reason: overlaps
      ? "At least one source/world-step sample of this single same-physics player counterfactual overlaps the exact companion commitment anchor."
      : "No source/world-step sample of this single same-physics player counterfactual overlaps the exact anchor; no continuous interstep safety claim is made."
  };
}
