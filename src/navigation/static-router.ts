import type {
  DirectTraversalBlocker,
  ObstacleSpec,
  StaticCircleTraversalResult,
  Vec2,
  WorldSnapshot
} from "../world/types";

export const S2C_ROUTE_CLEARANCE = 0.08;
const SCORE_EPSILON = 1e-9;

type RouteNodeKind = "start" | "target" | "corner";

export interface StaticRouteNode {
  id: string;
  kind: RouteNodeKind;
  position: Vec2;
  sourceObstacle: string | null;
}

export interface StaticRouteEdge {
  id: string;
  from: string;
  to: string;
  clear: boolean;
  distance: number;
  blocker: DirectTraversalBlocker | null;
}

export interface StaticRoutePlan {
  status: "direct" | "routed" | "unreachable" | "invalid-target";
  reason: string;
  radius: number;
  clearance: number;
  queryRadius: number;
  start: Vec2;
  target: Vec2;
  nodes: readonly StaticRouteNode[];
  edges: readonly StaticRouteEdge[];
  routeNodeIds: readonly string[];
  waypoints: readonly Vec2[];
  cost: number | null;
}

export type StaticTraversalQuery = (
  from: Vec2,
  to: Vec2,
  radius: number
) => StaticCircleTraversalResult;

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function edgeId(a: string, b: string): string {
  return a < b ? `${a}<->${b}` : `${b}<->${a}`;
}

function pointInsideExpandedObstacle(point: Vec2, obstacle: ObstacleSpec, margin: number): boolean {
  return (
    point.x > obstacle.x - margin &&
    point.x < obstacle.x + obstacle.width + margin &&
    point.y > obstacle.y - margin &&
    point.y < obstacle.y + obstacle.height + margin
  );
}

function pointFitsWorld(
  snapshot: WorldSnapshot,
  point: Vec2,
  radius: number,
  obstacles: readonly ObstacleSpec[]
): boolean {
  if (
    point.x - radius < 0 ||
    point.y - radius < 0 ||
    point.x + radius > snapshot.width ||
    point.y + radius > snapshot.height
  ) {
    return false;
  }

  return !obstacles.some((obstacle) => pointInsideExpandedObstacle(point, obstacle, radius));
}

function obstacleCornerNodes(
  snapshot: WorldSnapshot,
  obstacle: ObstacleSpec,
  queryRadius: number
): StaticRouteNode[] {
  const x0 = obstacle.x - queryRadius;
  const x1 = obstacle.x + obstacle.width + queryRadius;
  const y0 = obstacle.y - queryRadius;
  const y1 = obstacle.y + obstacle.height + queryRadius;
  const candidates: StaticRouteNode[] = [
    { id: `${obstacle.id}.nw`, kind: "corner", position: { x: x0, y: y0 }, sourceObstacle: obstacle.id },
    { id: `${obstacle.id}.ne`, kind: "corner", position: { x: x1, y: y0 }, sourceObstacle: obstacle.id },
    { id: `${obstacle.id}.se`, kind: "corner", position: { x: x1, y: y1 }, sourceObstacle: obstacle.id },
    { id: `${obstacle.id}.sw`, kind: "corner", position: { x: x0, y: y1 }, sourceObstacle: obstacle.id }
  ];

  return candidates.filter((candidate) => {
    if (!pointFitsWorld(snapshot, candidate.position, 0, [])) return false;
    return !snapshot.obstacles.some((other) => {
      if (other.id === obstacle.id) return false;
      return pointInsideExpandedObstacle(candidate.position, other, queryRadius);
    });
  });
}

function buildNodes(
  snapshot: WorldSnapshot,
  start: Vec2,
  target: Vec2,
  queryRadius: number
): StaticRouteNode[] {
  const nodes: StaticRouteNode[] = [
    { id: "start", kind: "start", position: { ...start }, sourceObstacle: null },
    { id: "target", kind: "target", position: { ...target }, sourceObstacle: null }
  ];

  const obstacles = [...snapshot.obstacles].sort((a, b) => a.id.localeCompare(b.id));
  for (const obstacle of obstacles) nodes.push(...obstacleCornerNodes(snapshot, obstacle, queryRadius));

  return nodes.sort((a, b) => {
    if (a.kind === "start") return -1;
    if (b.kind === "start") return 1;
    if (a.kind === "target") return b.kind === "start" ? 1 : -1;
    if (b.kind === "target") return -1;
    return a.id.localeCompare(b.id);
  });
}

function buildEdges(
  nodes: readonly StaticRouteNode[],
  queryRadius: number,
  query: StaticTraversalQuery
): StaticRouteEdge[] {
  const edges: StaticRouteEdge[] = [];
  for (let i = 0; i < nodes.length; i += 1) {
    const from = nodes[i];
    if (!from) continue;
    for (let j = i + 1; j < nodes.length; j += 1) {
      const to = nodes[j];
      if (!to) continue;
      const traversal = query(from.position, to.position, queryRadius);
      edges.push({
        id: edgeId(from.id, to.id),
        from: from.id,
        to: to.id,
        clear: traversal.clear,
        distance: traversal.distance,
        blocker: traversal.blocker
      });
    }
  }
  return edges.sort((a, b) => a.id.localeCompare(b.id));
}

interface SearchState {
  nodeId: string;
  cost: number;
  pathKey: string;
}

function shortestPath(
  nodes: readonly StaticRouteNode[],
  edges: readonly StaticRouteEdge[]
): { nodeIds: string[]; cost: number } | null {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const adjacency = new Map<string, Array<{ to: string; cost: number }>>();
  for (const node of nodes) adjacency.set(node.id, []);
  for (const edge of edges) {
    if (!edge.clear) continue;
    adjacency.get(edge.from)?.push({ to: edge.to, cost: edge.distance });
    adjacency.get(edge.to)?.push({ to: edge.from, cost: edge.distance });
  }
  for (const neighbors of adjacency.values()) neighbors.sort((a, b) => a.to.localeCompare(b.to));

  const bestCost = new Map<string, number>([["start", 0]]);
  const bestKey = new Map<string, string>([["start", "start"]]);
  const previous = new Map<string, string>();
  const open: SearchState[] = [{ nodeId: "start", cost: 0, pathKey: "start" }];

  while (open.length > 0) {
    open.sort((a, b) => {
      if (Math.abs(a.cost - b.cost) > SCORE_EPSILON) return a.cost - b.cost;
      const keyOrder = a.pathKey.localeCompare(b.pathKey);
      return keyOrder !== 0 ? keyOrder : a.nodeId.localeCompare(b.nodeId);
    });
    const current = open.shift();
    if (!current) break;
    const recordedCost = bestCost.get(current.nodeId);
    const recordedKey = bestKey.get(current.nodeId);
    if (recordedCost === undefined || recordedKey === undefined) continue;
    if (current.cost > recordedCost + SCORE_EPSILON || current.pathKey !== recordedKey) continue;
    if (current.nodeId === "target") break;

    for (const neighbor of adjacency.get(current.nodeId) ?? []) {
      if (!byId.has(neighbor.to)) continue;
      const nextCost = current.cost + neighbor.cost;
      const nextKey = `${current.pathKey}>${neighbor.to}`;
      const oldCost = bestCost.get(neighbor.to);
      const oldKey = bestKey.get(neighbor.to);
      const betterCost = oldCost === undefined || nextCost < oldCost - SCORE_EPSILON;
      const tieButStable =
        oldCost !== undefined &&
        Math.abs(nextCost - oldCost) <= SCORE_EPSILON &&
        (oldKey === undefined || nextKey < oldKey);
      if (!betterCost && !tieButStable) continue;
      bestCost.set(neighbor.to, nextCost);
      bestKey.set(neighbor.to, nextKey);
      previous.set(neighbor.to, current.nodeId);
      open.push({ nodeId: neighbor.to, cost: nextCost, pathKey: nextKey });
    }
  }

  const total = bestCost.get("target");
  if (total === undefined) return null;
  const route = ["target"];
  let cursor = "target";
  while (cursor !== "start") {
    const parent = previous.get(cursor);
    if (!parent) return null;
    route.push(parent);
    cursor = parent;
  }
  route.reverse();
  return { nodeIds: route, cost: total };
}

export function planStaticShadowRoute(options: {
  snapshot: WorldSnapshot;
  start: Vec2;
  target: Vec2;
  radius: number;
  query: StaticTraversalQuery;
  clearance?: number;
}): StaticRoutePlan {
  const clearance = options.clearance ?? S2C_ROUTE_CLEARANCE;
  if (!Number.isFinite(clearance) || clearance < 0) throw new Error("Route clearance must be finite and non-negative.");
  if (!Number.isFinite(options.radius) || options.radius <= 0) throw new Error("Route radius must be finite and positive.");

  const queryRadius = options.radius + clearance;
  const base = {
    radius: options.radius,
    clearance,
    queryRadius,
    start: { ...options.start },
    target: { ...options.target }
  };

  if (!pointFitsWorld(options.snapshot, options.target, options.radius, options.snapshot.obstacles)) {
    return {
      ...base,
      status: "invalid-target",
      reason: "target cannot contain the actor body inside static world geometry",
      nodes: [],
      edges: [],
      routeNodeIds: [],
      waypoints: [],
      cost: null
    };
  }

  const nodes = buildNodes(options.snapshot, options.start, options.target, queryRadius);
  const edges = buildEdges(nodes, queryRadius, options.query);
  const direct = edges.find((edge) => edge.id === edgeId("start", "target"));
  if (direct?.clear) {
    return {
      ...base,
      status: "direct",
      reason: "whole-body direct traversal is clear",
      nodes,
      edges,
      routeNodeIds: ["start", "target"],
      waypoints: [{ ...options.target }],
      cost: direct.distance
    };
  }

  const path = shortestPath(nodes, edges);
  if (!path) {
    return {
      ...base,
      status: "unreachable",
      reason: direct?.blocker
        ? `direct route blocked by ${direct.blocker.label}; graph contains no clear alternate path`
        : "graph contains no clear route to target",
      nodes,
      edges,
      routeNodeIds: [],
      waypoints: [],
      cost: null
    };
  }

  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const waypoints = path.nodeIds.slice(1).map((id) => {
    const node = nodeById.get(id);
    if (!node) throw new Error(`Route references missing node: ${id}`);
    return { ...node.position };
  });

  return {
    ...base,
    status: "routed",
    reason: direct?.blocker
      ? `direct route blocked by ${direct.blocker.label}; deterministic graph route found`
      : "deterministic graph route found",
    nodes,
    edges,
    routeNodeIds: path.nodeIds,
    waypoints,
    cost: path.cost
  };
}
