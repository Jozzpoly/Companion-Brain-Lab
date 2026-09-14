import { circleFitsStaticWorld } from "../navigation/static-body-geometry";
import {
  S2C_ROUTE_CLEARANCE,
  planStaticShadowRoute,
  type StaticRoutePlan,
  type StaticTraversalQuery
} from "../navigation/static-router";
import type { ActorSnapshot, ObstacleSpec, Vec2, WorldSnapshot } from "../world/types";

export const CCC0_REGION_DIRECTIONS = 32;
export const CCC0_REGION_RADII = [1.15, 1.45, 1.8] as const;
export const CCC0_REGION_ROUTE_SHORTLIST = 12;
export const CCC0_REGION_SCORE_WINDOW = 0.5;

const PREFERRED_RADIUS = 1.45;
const COMFORT_CLEARANCE = 0.65;
const INVALID_SCORE = 1_000_000;
const EPSILON = 1e-9;

export type ShadowRegionState = "REGION" | "NO_REACHABLE_REGION";
export type ShadowNoRegionReason = "NO_HARD_VALID_SAMPLE" | "ROUTE_SHORTLIST_EXHAUSTED";
export type ShadowPlayerHeadingSource = "actual" | "requested" | "previous" | "none";
export type ShadowRegionRouteStatus = StaticRoutePlan["status"] | "not-evaluated";

export interface ShadowRegionScoreTerms {
  frontPenalty: number;
  radialPenalty: number;
  travelPenalty: number;
  comfortPenalty: number;
  continuityPenalty: number;
  routePenalty: number;
  routeClearancePenalty: number;
}

export interface ShadowRegionSample {
  id: string;
  angleIndex: number;
  radiusIndex: number;
  radius: number;
  angle: number;
  direction: Vec2;
  position: Vec2;
  hardValid: boolean;
  localClearance: number;
  routeEvaluated: boolean;
  routeStatus: ShadowRegionRouteStatus;
  routeCost: number | null;
  routeClearanceConstrained: boolean;
  reachable: boolean;
  score: number;
  terms: ShadowRegionScoreTerms;
  inCoherentRegion: boolean;
}

export interface ShadowRelationshipRegion {
  state: ShadowRegionState;
  noRegionReason: ShadowNoRegionReason | null;
  tick: number;
  playerPosition: Vec2;
  playerDirection: Vec2;
  playerHeadingSource: ShadowPlayerHeadingSource;
  companionPosition: Vec2;
  samples: readonly ShadowRegionSample[];
  routeEvaluatedCount: number;
  bestSampleId: string | null;
  coherentSampleIds: readonly string[];
  topologyKey: string | null;
  representativeAnchor: Vec2 | null;
  representativeSource: "weighted-region" | "best-sample" | "none";
  representativeRouteStatus: ShadowRegionRouteStatus;
  reason: string;
}

export interface ShadowRelationshipRegionInput {
  snapshot: WorldSnapshot;
  query: StaticTraversalQuery;
  previousRepresentative?: Vec2 | null;
  previousPlayerDirection?: Vec2 | null;
}

function actor(snapshot: WorldSnapshot, id: ActorSnapshot["id"]): ActorSnapshot {
  const result = snapshot.actors.find((candidate) => candidate.id === id);
  if (!result) throw new Error(`Missing ${id} actor for shadow relationship region.`);
  return result;
}

function magnitude(value: Vec2): number {
  return Math.hypot(value.x, value.y);
}

function normalized(value: Vec2): Vec2 {
  const length = magnitude(value);
  return length > EPSILON ? { x: value.x / length, y: value.y / length } : { x: 0, y: 0 };
}

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function dot(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.y * b.y;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function addScaled(origin: Vec2, direction: Vec2, scale: number): Vec2 {
  return { x: origin.x + direction.x * scale, y: origin.y + direction.y * scale };
}

function observedPlayerDirection(
  player: ActorSnapshot,
  previous: Vec2 | null | undefined
): { direction: Vec2; source: ShadowPlayerHeadingSource } {
  if (magnitude(player.actualVelocity) > 0.15) {
    return { direction: normalized(player.actualVelocity), source: "actual" };
  }
  if (magnitude(player.requestedVelocity) > 0.15) {
    return { direction: normalized(player.requestedVelocity), source: "requested" };
  }
  if (previous && magnitude(previous) > 0.5) {
    return { direction: normalized(previous), source: "previous" };
  }
  return { direction: { x: 0, y: 0 }, source: "none" };
}

function distanceToObstacle(point: Vec2, obstacle: ObstacleSpec): number {
  const right = obstacle.x + obstacle.width;
  const bottom = obstacle.y + obstacle.height;
  const dx = Math.max(obstacle.x - point.x, 0, point.x - right);
  const dy = Math.max(obstacle.y - point.y, 0, point.y - bottom);
  if (dx > 0 || dy > 0) return Math.hypot(dx, dy);

  const insideX = Math.min(point.x - obstacle.x, right - point.x);
  const insideY = Math.min(point.y - obstacle.y, bottom - point.y);
  return -Math.min(insideX, insideY);
}

function localClearance(snapshot: WorldSnapshot, point: Vec2, bodyRadius: number): number {
  let result = Math.min(point.x, point.y, snapshot.width - point.x, snapshot.height - point.y) - bodyRadius;
  for (const obstacle of snapshot.obstacles) {
    result = Math.min(result, distanceToObstacle(point, obstacle) - bodyRadius);
  }
  return result;
}

function emptyTerms(): ShadowRegionScoreTerms {
  return {
    frontPenalty: 0,
    radialPenalty: 0,
    travelPenalty: 0,
    comfortPenalty: 0,
    continuityPenalty: 0,
    routePenalty: 0,
    routeClearancePenalty: 0
  };
}

function localSampleScore(options: {
  snapshot: WorldSnapshot;
  companion: ActorSnapshot;
  playerDirection: Vec2;
  position: Vec2;
  direction: Vec2;
  radius: number;
  previousRepresentative?: Vec2 | null;
}): { hardValid: boolean; clearance: number; score: number; terms: ShadowRegionScoreTerms } {
  const hardValid = circleFitsStaticWorld(options.snapshot, options.position, options.companion.radius);
  const clearance = localClearance(options.snapshot, options.position, options.companion.radius);
  if (!hardValid) return { hardValid, clearance, score: INVALID_SCORE, terms: emptyTerms() };

  const frontness = magnitude(options.playerDirection) > 0.5
    ? Math.max(0, dot(options.direction, options.playerDirection))
    : 0;
  const comfortPressure = clamp((COMFORT_CLEARANCE - clearance) / COMFORT_CLEARANCE, 0, 1);
  const terms: ShadowRegionScoreTerms = {
    frontPenalty: frontness * frontness * 4.8,
    radialPenalty: Math.abs(options.radius - PREFERRED_RADIUS) * 1.4,
    travelPenalty: distance(options.companion.position, options.position) * 0.18,
    comfortPenalty: comfortPressure * comfortPressure * 1.8,
    continuityPenalty: options.previousRepresentative
      ? distance(options.previousRepresentative, options.position) * 0.3
      : 0,
    routePenalty: 0,
    routeClearancePenalty: 0
  };

  return {
    hardValid,
    clearance,
    score:
      terms.frontPenalty +
      terms.radialPenalty +
      terms.travelPenalty +
      terms.comfortPenalty +
      terms.continuityPenalty,
    terms
  };
}

function routeQualifies(status: StaticRoutePlan["status"]): boolean {
  return status === "direct" || status === "routed";
}

function buildSamples(input: ShadowRelationshipRegionInput): {
  companion: ActorSnapshot;
  player: ActorSnapshot;
  playerDirection: Vec2;
  playerHeadingSource: ShadowPlayerHeadingSource;
  samples: ShadowRegionSample[];
} {
  const companion = actor(input.snapshot, "companion");
  const player = actor(input.snapshot, "player");
  const heading = observedPlayerDirection(player, input.previousPlayerDirection);
  const samples: ShadowRegionSample[] = [];

  for (let radiusIndex = 0; radiusIndex < CCC0_REGION_RADII.length; radiusIndex += 1) {
    const radius = CCC0_REGION_RADII[radiusIndex];
    if (radius === undefined) continue;

    for (let angleIndex = 0; angleIndex < CCC0_REGION_DIRECTIONS; angleIndex += 1) {
      const angle = (angleIndex / CCC0_REGION_DIRECTIONS) * Math.PI * 2;
      const direction = { x: Math.cos(angle), y: Math.sin(angle) };
      const position = addScaled(player.position, direction, radius);
      const local = localSampleScore({
        snapshot: input.snapshot,
        companion,
        playerDirection: heading.direction,
        position,
        direction,
        radius,
        previousRepresentative: input.previousRepresentative
      });

      samples.push({
        id: `r${radiusIndex}.d${angleIndex}`,
        angleIndex,
        radiusIndex,
        radius,
        angle,
        direction,
        position,
        hardValid: local.hardValid,
        localClearance: local.clearance,
        routeEvaluated: false,
        routeStatus: "not-evaluated",
        routeCost: null,
        routeClearanceConstrained: false,
        reachable: false,
        score: local.score,
        terms: local.terms,
        inCoherentRegion: false
      });
    }
  }

  return {
    companion,
    player,
    playerDirection: heading.direction,
    playerHeadingSource: heading.source,
    samples
  };
}

function evaluateRouteShortlist(
  input: ShadowRelationshipRegionInput,
  companion: ActorSnapshot,
  samples: ShadowRegionSample[]
): void {
  const shortlist = samples
    .filter((sample) => sample.hardValid)
    .sort((a, b) => a.score - b.score || a.id.localeCompare(b.id))
    .slice(0, CCC0_REGION_ROUTE_SHORTLIST);

  for (const sample of shortlist) {
    const plan = planStaticShadowRoute({
      snapshot: input.snapshot,
      start: companion.position,
      target: sample.position,
      radius: companion.radius,
      clearance: S2C_ROUTE_CLEARANCE,
      query: input.query
    });

    sample.routeEvaluated = true;
    sample.routeStatus = plan.status;
    sample.routeCost = plan.cost;
    sample.routeClearanceConstrained = plan.clearanceConstrained;
    sample.reachable = routeQualifies(plan.status);

    if (!sample.reachable || plan.cost === null) {
      sample.score = INVALID_SCORE;
      continue;
    }

    sample.terms.routePenalty = plan.cost * 0.12;
    sample.terms.routeClearancePenalty = plan.clearanceConstrained ? 0.18 : 0;
    sample.score += sample.terms.routePenalty + sample.terms.routeClearancePenalty;
  }
}

function circularAngleDistance(a: number, b: number): number {
  const raw = Math.abs(a - b);
  return Math.min(raw, CCC0_REGION_DIRECTIONS - raw);
}

export function shadowRegionSamplesAdjacent(a: ShadowRegionSample, b: ShadowRegionSample): boolean {
  const angleDistance = circularAngleDistance(a.angleIndex, b.angleIndex);
  const radiusDistance = Math.abs(a.radiusIndex - b.radiusIndex);
  if (angleDistance === 0 && radiusDistance === 1) return true;
  return angleDistance <= 2 && radiusDistance <= 1;
}

export function coherentShadowRegion(
  reachable: readonly ShadowRegionSample[],
  best: ShadowRegionSample,
  scoreWindow = CCC0_REGION_SCORE_WINDOW
): ShadowRegionSample[] {
  const eligible = reachable.filter((sample) => sample.score <= best.score + scoreWindow);
  const eligibleIds = new Set(eligible.map((sample) => sample.id));
  const visited = new Set<string>();
  const queue: ShadowRegionSample[] = [best];
  const region: ShadowRegionSample[] = [];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current.id) || !eligibleIds.has(current.id)) continue;
    visited.add(current.id);
    region.push(current);

    for (const candidate of eligible) {
      if (!visited.has(candidate.id) && shadowRegionSamplesAdjacent(current, candidate)) queue.push(candidate);
    }
  }

  return region.sort((a, b) => a.score - b.score || a.id.localeCompare(b.id));
}

function weightedRepresentative(samples: readonly ShadowRegionSample[]): Vec2 | null {
  const best = samples[0];
  if (!best) return null;

  let totalWeight = 0;
  let x = 0;
  let y = 0;
  for (const sample of samples) {
    const weight = Math.exp(-(sample.score - best.score) / 0.28);
    totalWeight += weight;
    x += sample.position.x * weight;
    y += sample.position.y * weight;
  }

  if (totalWeight <= EPSILON) return { ...best.position };
  return { x: x / totalWeight, y: y / totalWeight };
}

export function evaluateShadowRelationshipRegion(
  input: ShadowRelationshipRegionInput
): ShadowRelationshipRegion {
  const raw = buildSamples(input);
  evaluateRouteShortlist(input, raw.companion, raw.samples);

  const reachable = raw.samples
    .filter((sample) => sample.routeEvaluated && sample.reachable)
    .sort((a, b) => a.score - b.score || a.id.localeCompare(b.id));
  const best = reachable[0] ?? null;
  const routeEvaluatedCount = raw.samples.filter((sample) => sample.routeEvaluated).length;

  if (!best) {
    const hardValidCount = raw.samples.filter((sample) => sample.hardValid).length;
    const noRegionReason: ShadowNoRegionReason = hardValidCount === 0
      ? "NO_HARD_VALID_SAMPLE"
      : "ROUTE_SHORTLIST_EXHAUSTED";
    return {
      state: "NO_REACHABLE_REGION",
      noRegionReason,
      tick: input.snapshot.tick,
      playerPosition: { ...raw.player.position },
      playerDirection: { ...raw.playerDirection },
      playerHeadingSource: raw.playerHeadingSource,
      companionPosition: { ...raw.companion.position },
      samples: raw.samples,
      routeEvaluatedCount,
      bestSampleId: null,
      coherentSampleIds: [],
      topologyKey: null,
      representativeAnchor: null,
      representativeSource: "none",
      representativeRouteStatus: "not-evaluated",
      reason: noRegionReason === "NO_HARD_VALID_SAMPLE"
        ? "no hard-valid player-relative sample exists in the bounded field"
        : "bounded route shortlist contained no reachable candidate; untested samples are not claimed unreachable"
    };
  }

  const coherent = coherentShadowRegion(reachable, best);
  for (const sample of coherent) sample.inCoherentRegion = true;

  const topologyKey = coherent
    .map((sample) => sample.id)
    .sort((a, b) => a.localeCompare(b))
    .join("|");
  const weighted = weightedRepresentative(coherent);

  let representativeAnchor = { ...best.position };
  let representativeSource: ShadowRelationshipRegion["representativeSource"] = "best-sample";
  let representativeRouteStatus: ShadowRegionRouteStatus = best.routeStatus;
  let reason = `best route-qualified sample ${best.id}; weighted coherent representative unavailable`;

  if (weighted && circleFitsStaticWorld(input.snapshot, weighted, raw.companion.radius)) {
    const plan = planStaticShadowRoute({
      snapshot: input.snapshot,
      start: raw.companion.position,
      target: weighted,
      radius: raw.companion.radius,
      clearance: S2C_ROUTE_CLEARANCE,
      query: input.query
    });
    representativeRouteStatus = plan.status;
    if (routeQualifies(plan.status)) {
      representativeAnchor = weighted;
      representativeSource = "weighted-region";
      reason = `weighted representative of coherent ${coherent.length}-sample route-qualified region`;
    } else {
      reason = `weighted coherent representative was ${plan.status}; fallback to ${best.id}`;
    }
  }

  return {
    state: "REGION",
    noRegionReason: null,
    tick: input.snapshot.tick,
    playerPosition: { ...raw.player.position },
    playerDirection: { ...raw.playerDirection },
    playerHeadingSource: raw.playerHeadingSource,
    companionPosition: { ...raw.companion.position },
    samples: raw.samples,
    routeEvaluatedCount,
    bestSampleId: best.id,
    coherentSampleIds: coherent.map((sample) => sample.id),
    topologyKey,
    representativeAnchor,
    representativeSource,
    representativeRouteStatus,
    reason
  };
}
