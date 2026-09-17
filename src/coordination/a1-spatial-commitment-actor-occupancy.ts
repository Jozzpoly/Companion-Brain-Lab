import type { Vec2, WorldSnapshot } from "../world/types";
import type { A1SpatialCommitmentFitEvidence } from "./a1-spatial-commitment-evidence";

const OVERLAP_EPSILON = 1e-9;

export type A1SpatialCommitmentActorOccupancyStatus =
  | "REFERENCE_UNRESOLVED"
  | "PLAYER_BODY_OVERLAP"
  | "CURRENT_ACTOR_SPACE_CLEAR";

export interface A1SpatialCommitmentActorOccupancyEvidence {
  kind: "A1_SPATIAL_COMMITMENT_ACTOR_OCCUPANCY_EVIDENCE";
  sourceTick: number;
  commitmentSourceTick: number;
  status: A1SpatialCommitmentActorOccupancyStatus;
  anchorWorldPosition: Vec2 | null;
  companionRadius: number;
  playerPosition: Vec2;
  playerRadius: number;
  centerDistanceToPlayer: number | null;
  requiredNonOverlapDistance: number;
  overlapDepth: number | null;
  bodyTruthClaim: "CURRENT_WORLD_SNAPSHOT_CIRCLE_BODIES";
  temporalClaim: "CURRENT_TICK_ONLY_NO_FUTURE_PREDICTION";
  staticWorldClaim: "NONE_SEPARATE_MATERIAL_EVIDENCE_REQUIRED";
  decisionClaim: "NONE_EVIDENCE_ONLY";
  runtimeAuthorityClaim: "NONE";
  reason: string;
}

function actor(snapshot: WorldSnapshot, id: "player" | "companion") {
  const value = snapshot.actors.find((candidate) => candidate.id === id);
  if (!value) throw new Error(`A1 actor-occupancy evidence requires ${id} body.`);
  return value;
}

export function buildA1SpatialCommitmentActorOccupancyEvidence(input: {
  fit: A1SpatialCommitmentFitEvidence;
  snapshot: WorldSnapshot;
}): A1SpatialCommitmentActorOccupancyEvidence {
  if (input.fit.sourceTick !== input.snapshot.tick) {
    throw new Error("A1 actor-occupancy evidence requires same-tick fit and World snapshot.");
  }
  const player = actor(input.snapshot, "player");
  const companion = actor(input.snapshot, "companion");
  const requiredNonOverlapDistance = player.radius + companion.radius;
  const base = {
    kind: "A1_SPATIAL_COMMITMENT_ACTOR_OCCUPANCY_EVIDENCE" as const,
    sourceTick: input.snapshot.tick,
    commitmentSourceTick: input.fit.commitmentSourceTick,
    companionRadius: companion.radius,
    playerPosition: { ...player.position },
    playerRadius: player.radius,
    requiredNonOverlapDistance,
    bodyTruthClaim: "CURRENT_WORLD_SNAPSHOT_CIRCLE_BODIES" as const,
    temporalClaim: "CURRENT_TICK_ONLY_NO_FUTURE_PREDICTION" as const,
    staticWorldClaim: "NONE_SEPARATE_MATERIAL_EVIDENCE_REQUIRED" as const,
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
      centerDistanceToPlayer: null,
      overlapDepth: null,
      reason: "Spatial reference is unresolved; current player-body occupancy is intentionally not inferred."
    };
  }

  const anchor = { ...input.fit.resolvedAnchorWorldPosition };
  const centerDistanceToPlayer = Math.hypot(
    anchor.x - player.position.x,
    anchor.y - player.position.y
  );
  const overlapDepth = Math.max(0, requiredNonOverlapDistance - centerDistanceToPlayer);
  const overlaps = centerDistanceToPlayer < requiredNonOverlapDistance - OVERLAP_EPSILON;

  return {
    ...base,
    status: overlaps ? "PLAYER_BODY_OVERLAP" : "CURRENT_ACTOR_SPACE_CLEAR",
    anchorWorldPosition: anchor,
    centerDistanceToPlayer,
    overlapDepth,
    reason: overlaps
      ? "The exact companion anchor overlaps the player's current hard body at this World tick."
      : "The exact companion anchor does not overlap the player's current hard body; future player motion is not evaluated."
  };
}
