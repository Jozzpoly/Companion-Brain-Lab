import {
  planStaticShadowRoute,
  S2C_ROUTE_CLEARANCE,
  type StaticRoutePlan,
  type StaticTraversalQuery
} from "./static-router";
import type { Vec2, WorldSnapshot } from "../world/types";

export interface HardRouteTruthEvidence {
  sourceTick: number;
  hardStatus: StaticRoutePlan["status"];
  hardReason: string;
  hardRouteNodeIds: readonly string[];
  hardCost: number | null;
  desiredStatus: StaticRoutePlan["status"];
  desiredReason: string;
  desiredRouteNodeIds: readonly string[];
  desiredCost: number | null;
  desiredClearance: number;
  hardReachable: boolean;
  desiredReachable: boolean;
  comfortErasesHardConnectivity: boolean;
}

function reachable(status: StaticRoutePlan["status"]): boolean {
  return status === "direct" || status === "routed";
}

export function evaluateHardRouteTruth(input: {
  snapshot: WorldSnapshot;
  start: Vec2;
  target: Vec2;
  radius: number;
  query: StaticTraversalQuery;
  desiredClearance?: number;
}): HardRouteTruthEvidence {
  const desiredClearance = input.desiredClearance ?? S2C_ROUTE_CLEARANCE;
  const hardPlan = planStaticShadowRoute({
    snapshot: input.snapshot,
    start: input.start,
    target: input.target,
    radius: input.radius,
    clearance: 0,
    query: input.query
  });
  const desiredPlan = planStaticShadowRoute({
    snapshot: input.snapshot,
    start: input.start,
    target: input.target,
    radius: input.radius,
    clearance: desiredClearance,
    query: input.query
  });
  const hardReachable = reachable(hardPlan.status);
  const desiredReachable = reachable(desiredPlan.status);

  return {
    sourceTick: input.snapshot.tick,
    hardStatus: hardPlan.status,
    hardReason: hardPlan.reason,
    hardRouteNodeIds: [...hardPlan.routeNodeIds],
    hardCost: hardPlan.cost,
    desiredStatus: desiredPlan.status,
    desiredReason: desiredPlan.reason,
    desiredRouteNodeIds: [...desiredPlan.routeNodeIds],
    desiredCost: desiredPlan.cost,
    desiredClearance,
    hardReachable,
    desiredReachable,
    comfortErasesHardConnectivity: hardReachable && !desiredReachable
  };
}
