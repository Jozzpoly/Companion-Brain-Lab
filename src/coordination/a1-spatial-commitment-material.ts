import { evaluateHardRouteTruth, type HardRouteTruthEvidence } from "../navigation/hard-route-truth";
import type { StaticTraversalQuery } from "../navigation/static-router";
import type {
  StaticCircleOccupancyResult,
  Vec2,
  WorldSnapshot
} from "../world/types";
import type { A1SpatialCommitmentFitEvidence } from "./a1-spatial-commitment-evidence";

export type A1SpatialCommitmentMaterialStatus =
  | "REFERENCE_UNRESOLVED"
  | "STATIC_TARGET_BLOCKED"
  | "STATIC_ROUTE_UNREACHABLE"
  | "STATIC_ROUTE_REACHABLE"
  | "STATIC_QUERY_DISAGREEMENT";

export interface A1SpatialCommitmentMaterialEvidence {
  kind: "A1_SPATIAL_COMMITMENT_MATERIAL_EVIDENCE";
  sourceTick: number;
  commitmentSourceTick: number;
  status: A1SpatialCommitmentMaterialStatus;
  anchorWorldPosition: Vec2 | null;
  companionWorldPosition: Vec2;
  companionRadius: number;
  targetOccupancy: StaticCircleOccupancyResult | null;
  hardRouteTruth: HardRouteTruthEvidence | null;
  occupancyTargetClear: boolean | null;
  routerTargetClear: boolean | null;
  hardRouteReachable: boolean | null;
  desiredRouteReachable: boolean | null;
  comfortErasesHardConnectivity: boolean | null;
  targetTruthClaim: "LIVE_STATIC_OCCUPANCY_QUERY";
  routeTruthClaim: "DETERMINISTIC_STATIC_ROUTER";
  dynamicActorInteractionClaim: "NOT_EVALUATED_STATIC_WORLD_ONLY";
  decisionClaim: "NONE_EVIDENCE_ONLY";
  runtimeAuthorityClaim: "NONE";
  reason: string;
}

function companion(snapshot: WorldSnapshot) {
  const actor = snapshot.actors.find((candidate) => candidate.id === "companion");
  if (!actor) throw new Error("A1 material commitment evidence requires companion body evidence.");
  return actor;
}

function validateFit(
  fit: A1SpatialCommitmentFitEvidence,
  snapshot: WorldSnapshot
): void {
  if (fit.kind !== "A1_SPATIAL_COMMITMENT_FIT") {
    throw new Error("A1 material commitment evidence requires qualified fit evidence.");
  }
  if (fit.sourceTick !== snapshot.tick) {
    throw new Error("A1 material commitment evidence requires same-tick fit and World snapshot.");
  }
  if (
    fit.referenceResolutionStatus === "RESOLVED" &&
    fit.resolvedAnchorWorldPosition === null
  ) {
    throw new Error("A1 resolved commitment fit is missing its anchor.");
  }
  if (
    fit.referenceResolutionStatus === "UNRESOLVED" &&
    fit.resolvedAnchorWorldPosition !== null
  ) {
    throw new Error("A1 unresolved commitment fit must not carry a resolved anchor.");
  }
}

export function buildA1SpatialCommitmentMaterialEvidence(input: {
  fit: A1SpatialCommitmentFitEvidence;
  snapshot: WorldSnapshot;
  occupancy: (center: Vec2, radius: number) => StaticCircleOccupancyResult;
  query: StaticTraversalQuery;
}): A1SpatialCommitmentMaterialEvidence {
  validateFit(input.fit, input.snapshot);
  const body = companion(input.snapshot);
  const base = {
    kind: "A1_SPATIAL_COMMITMENT_MATERIAL_EVIDENCE" as const,
    sourceTick: input.snapshot.tick,
    commitmentSourceTick: input.fit.commitmentSourceTick,
    companionWorldPosition: { ...body.position },
    companionRadius: body.radius,
    targetTruthClaim: "LIVE_STATIC_OCCUPANCY_QUERY" as const,
    routeTruthClaim: "DETERMINISTIC_STATIC_ROUTER" as const,
    dynamicActorInteractionClaim: "NOT_EVALUATED_STATIC_WORLD_ONLY" as const,
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
      targetOccupancy: null,
      hardRouteTruth: null,
      occupancyTargetClear: null,
      routerTargetClear: null,
      hardRouteReachable: null,
      desiredRouteReachable: null,
      comfortErasesHardConnectivity: null,
      reason: "Spatial reference is unresolved; material qualification is intentionally not attempted."
    };
  }

  const anchor = { ...input.fit.resolvedAnchorWorldPosition };
  const occupancy = input.occupancy(anchor, body.radius);
  if (
    Math.hypot(occupancy.center.x - anchor.x, occupancy.center.y - anchor.y) > 1e-9 ||
    Math.abs(occupancy.radius - body.radius) > 1e-9
  ) {
    throw new Error("A1 material commitment occupancy evidence does not match the resolved anchor/body radius.");
  }

  const route = evaluateHardRouteTruth({
    snapshot: input.snapshot,
    start: body.position,
    target: anchor,
    radius: body.radius,
    query: input.query
  });
  const routerTargetClear = route.hardStatus !== "invalid-target";

  if (occupancy.clear !== routerTargetClear) {
    return {
      ...base,
      status: "STATIC_QUERY_DISAGREEMENT",
      anchorWorldPosition: anchor,
      targetOccupancy: occupancy,
      hardRouteTruth: route,
      occupancyTargetClear: occupancy.clear,
      routerTargetClear,
      hardRouteReachable: route.hardReachable,
      desiredRouteReachable: route.desiredReachable,
      comfortErasesHardConnectivity: route.comfortErasesHardConnectivity,
      reason: "Live static occupancy and deterministic router disagree on whether the exact anchor can contain the companion body."
    };
  }

  if (!occupancy.clear) {
    return {
      ...base,
      status: "STATIC_TARGET_BLOCKED",
      anchorWorldPosition: anchor,
      targetOccupancy: occupancy,
      hardRouteTruth: route,
      occupancyTargetClear: false,
      routerTargetClear: false,
      hardRouteReachable: route.hardReachable,
      desiredRouteReachable: route.desiredReachable,
      comfortErasesHardConnectivity: route.comfortErasesHardConnectivity,
      reason: "The exact resolved anchor cannot contain the companion body in static world geometry."
    };
  }

  if (!route.hardReachable) {
    return {
      ...base,
      status: "STATIC_ROUTE_UNREACHABLE",
      anchorWorldPosition: anchor,
      targetOccupancy: occupancy,
      hardRouteTruth: route,
      occupancyTargetClear: true,
      routerTargetClear: true,
      hardRouteReachable: false,
      desiredRouteReachable: route.desiredReachable,
      comfortErasesHardConnectivity: route.comfortErasesHardConnectivity,
      reason: "The exact anchor is statically occupiable, but the deterministic hard-body router found no route from the current companion body."
    };
  }

  return {
    ...base,
    status: "STATIC_ROUTE_REACHABLE",
    anchorWorldPosition: anchor,
    targetOccupancy: occupancy,
    hardRouteTruth: route,
    occupancyTargetClear: true,
    routerTargetClear: true,
    hardRouteReachable: true,
    desiredRouteReachable: route.desiredReachable,
    comfortErasesHardConnectivity: route.comfortErasesHardConnectivity,
    reason: route.desiredReachable
      ? "The exact anchor is statically occupiable and reachable with desired clearance under the deterministic static router."
      : "The exact anchor is hard-body reachable, but desired clearance is constrained."
  };
}
