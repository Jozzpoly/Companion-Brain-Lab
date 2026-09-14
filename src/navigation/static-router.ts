import type {
  DirectTraversalBlocker,
  ObstacleSpec,
  StaticCircleTraversalResult,
  StaticTraversalOptions,
  Vec2,
  WorldSnapshot
} from "../world/types";

export const S2C_ROUTE_CLEARANCE = 0.08;
export const S2C_CORNER_EPSILON = 0.02;
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
  /** Hard-body feasibility. This is the graph-connectivity authority. */
  clear: boolean;
  distance: number;
  blocker: DirectTraversalBlocker | null;
  /** Preferred/comfort-clearance evidence. This does not remove hard-valid connectivity. */
  comfortClear: boolean;
  comfortBlocker: DirectTraversalBlocker | null;
}

export interface StaticRoutePlan {
  status: "direct" | "routed" | "unreachable" | "invalid-target";
  reason: string;
  radius: number;
  clearance: number;
  /** Radius used to decide physical graph connectivity. */
  queryRadius: number;
  /** Radius used only to expose preferred/comfort-clearance quality. */
  desiredQueryRadius: number;
  clearanceConstrained: boolean;
  constrainedEdgeIds: readonly string[];
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
  radius: number,
  options?: StaticTraversalOptions
) => StaticCircleTraversalResult;

function edgeId(a: string, b: string): string {
  return a < b ? `${a}<->${b}` : `${b}<->${a}`;
}

function nodeKindRank(kind: RouteNodeKind): number {
  if (kind === "start") return 0;
  if (kind === "target") return 1;
  return 2;
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
  desiredQueryRadius: number
): StaticRouteNode[] {
  // Keep route corners at the preferred clearance even though connectivity is
  // now decided by hard-body feasibility. This preserves nominal route quality
  // without turning the preference into an unrecoverable physical law.
  const cornerMargin = desiredQueryRadius + S2C_CORNER_EPSILON;
  const x0 = obstacle.x - cornerMargin;
  const x1 = obstacle.x + obstacle.width + cornerMargin;
  const y0 = obstacle.y - cornerMargin;
  const y1 = obstacle.y + obstacle.height + cornerMargin;
  const candidates: StaticRouteNode[] = [
    { id: `${obstacle.id}.nw`, kind: "corner", position: { x: x0, y: y0 }, sourceObstacle: obstacle.id },
    { id: `${obstacle.id}.ne`, kind: "corner", position: { x: x1, y: y0 }, sourceObstacle: obstacle.id },
    { id: `${obstacle.id}.se`, kind: "corner", position: { x: x1, y: y1 }, sourceObstacle: obstacle.id },
    { id: `${obstacle.id}.sw`, kind: "corner", position: { x: x0, y: y1 }, sourceObstacle: obstacle.id }
  ];

  return candidates.filter((candidate) => {
    if (!pointFitsWorld(snapshot, candidate.position, desiredQueryRadius, [])) return false;
    return !snapshot.obstacles.some((other) => {
      if (other.id === obstacle.id) return false;
      return pointInsideExpandedObstacle(candidate.position, other, desiredQueryRadius);
    });
  });
}

function buildNodes(
  snapshot: WorldSnapshot,
  start: Vec2,
  target: Vec2,
  desiredQueryRadius: number
): StaticRouteNode[] {
  const nodes: StaticRouteNode[] = [
    { id: "start", kind: "start", position: { ...start }, sourceObstacle: null },
    { id: "target", kind: "target", position: { ...target }, sourceObstacle: null }
  ];

  const obstacles = [...snapshot.obstacles].sort((a, b) => a.id.localeCompare(b.id));
  for (const obstacle of obstacles) nodes.push(...obstacleCornerNodes(snapshot, obstacle, desiredQueryRadius));

  return nodes.sort((a, b) => {
    const rankOrder = nodeKindRank(a.kind) - nodeKindRank(b.kind);
    return rankOrder !== 0 ? rankOrder : a.id.localeCompare(b.id);
  });
}

function buildEdges(
  nodes: readonly StaticRouteNode[],
  hardQueryRadius: number,
  desiredQueryRadius: number,
  query: StaticTraversalQuery
): StaticRouteEdge[] {
  const edges: StaticRouteEdge[] = [];
  for (let i = 0; i < nodes.length; i += 1) {
    const from = nodes[i];
    if (!from) continue;
    for (let j = i + 1; j < nodes.length; j += 1) {
      const to = nodes[j];
      if (!to) continue;
      const hard = query(from.position, to.position, hardQueryRadius);
      const comfort = query(
        from.position,
        to.position,
        desiredQueryRadius,
        { initialOverlap: "allow-egress" }
      );
      edges.push({
        id: edgeId(from.id, to.id),
        from: from.id,
        to: to.id,
        clear: hard.clear,
        distance: hard.distance,
        blocker: hard.blocker,
        comfortClear: comfort.clear,
        comfortBlocker: comfort.blocker
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

function constrainedEdgesForPath(
  nodeIds: readonly string[],
  edges: readonly StaticRouteEdge[]
): string[] {
  const constrained: string[] = [];
  for (let index = 0; index < nodeIds.length - 1; index += 1) {
    const a = nodeIds[index];
    const b = nodeIds[index + 1];
    if (!a || !b) continue;
    const id = edgeId(a, b);
    const edge = edges.find((candidate) => candidate.id === id);
    if (edge && !edge.comfortClear) constrained.push(id);
  }
  return constrained;
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

  const queryRadius = options.radius;
  const desiredQueryRadius = options.radius + clearance;
  const base = {
    radius: options.radius,
    clearance,
    queryRadius,
    desiredQueryRadius,
    start: { ...options.start },
    target: { ...options.target }
  };

  if (!pointFitsWorld(options.snapshot, options.target, options.radius, options.snapshot.obstacles)) {
    return {
      ...base,
      status: "invalid-target",
      reason: "target cannot contain the actor body inside static world geometry",
      clearanceConstrained: false,
      constrainedEdgeIds: [],
      nodes: [],
      edges: [],
      routeNodeIds: [],
      waypoints: [],
      cost: null
    };
  }

  const nodes = buildNodes(options.snapshot, options.start, options.target, desiredQueryRadius);
  const edges = buildEdges(nodes, queryRadius, desiredQueryRadius, options.query);
  const direct = edges.find((edge) => edge.id === edgeId("start", "target"));
  if (direct?.clear) {
    const constrainedEdgeIds = direct.comfortClear ? [] : [direct.id];
    return {
      ...base,
      status: "direct",
      reason: direct.comfortClear
        ? "hard-body direct traversal is clear with desired clearance"
        : "hard-body direct traversal is clear but desired clearance is constrained",
      clearanceConstrained: constrainedEdgeIds.length > 0,
      constrainedEdgeIds,
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
        ? `hard-body direct route blocked by ${direct.blocker.label}; graph contains no hard-feasible alternate path`
        : "graph contains no hard-feasible route to target",
      clearanceConstrained: false,
      constrainedEdgeIds: [],
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
  const constrainedEdgeIds = constrainedEdgesForPath(path.nodeIds, edges);

  return {
    ...base,
    status: "routed",
    reason: constrainedEdgeIds.length > 0
      ? "deterministic hard-feasible graph route found with constrained desired clearance"
      : direct?.blocker
        ? `hard-body direct route blocked by ${direct.blocker.label}; deterministic graph route found with desired clearance`
        : "deterministic graph route found with desired clearance",
    clearanceConstrained: constrainedEdgeIds.length > 0,
    constrainedEdgeIds,
    nodes,
    edges,
    routeNodeIds: path.nodeIds,
    waypoints,
    cost: path.cost
  };
}
