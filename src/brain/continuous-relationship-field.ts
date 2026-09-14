import {
  S2C_ROUTE_CLEARANCE,
  planStaticShadowRoute,
  type StaticRoutePlan,
  type StaticTraversalQuery
} from "../navigation/static-router";
import type { ActorSnapshot, ObstacleSpec, Vec2, WorldSnapshot } from "../world/types";

export const S5_FIELD_DIRECTIONS = 32;
export const S5_FIELD_RADII = [1.15, 1.45, 1.8] as const;
export const S5_ROUTE_SHORTLIST = 12;
export const S5_GOOD_REGION_SCORE_WINDOW = 0.5;
export const S5_RELATIONSHIP_INTERVAL_TICKS = 6;

const PREFERRED_RADIUS = 1.45;
const HARD_INVALID_SCORE = 1_000_000;
const EPSILON = 1e-9;

export type FieldRouteStatus = StaticRoutePlan["status"] | "not-evaluated";

export interface RelationshipFieldTerms {
  frontPenalty: number;
  radialPenalty: number;
  travelPenalty: number;
  clearancePenalty: number;
  continuityPenalty: number;
  routePenalty: number;
}

export interface RelationshipFieldSample {
  id: string;
  angleIndex: number;
  radiusIndex: number;
  radius: number;
  angle: number;
  direction: Vec2;
  position: Vec2;
  localValid: boolean;
  localClearance: number;
  routeStatus: FieldRouteStatus;
  routeCost: number | null;
  routeEvaluated: boolean;
  reachable: boolean;
  score: number;
  terms: RelationshipFieldTerms;
  inGoodRegion: boolean;
}

export interface ContinuousRelationshipFieldDecision {
  mode: "continuous-field-shadow";
  tick: number;
  playerPosition: Vec2;
  playerDirection: Vec2;
  companionPosition: Vec2;
  representativeTarget: Vec2;
  representativeSource: "weighted-region" | "best-sample-fallback" | "player-position-fallback";
  representativeRouteStatus: StaticRoutePlan["status"] | "not-evaluated";
  bestSampleId: string | null;
  goodRegionSampleIds: readonly string[];
  routeEvaluatedCount: number;
  samples: readonly RelationshipFieldSample[];
  reason: string;
}

export interface ContinuousRelationshipFieldInput {
  snapshot: WorldSnapshot;
  query: StaticTraversalQuery;
  previousTarget?: Vec2 | null;
  previousPlayerDirection?: Vec2 | null;
}

function actor(snapshot: WorldSnapshot, id: ActorSnapshot["id"]): ActorSnapshot {
  const result = snapshot.actors.find((entry) => entry.id === id);
  if (!result) throw new Error(`Missing ${id} actor for continuous relationship field.`);
  return result;
}

function magnitude(value: Vec2): number {
  return Math.hypot(value.x, value.y);
}

function normalized(value: Vec2): Vec2 {
  const length = magnitude(value);
  return length > EPSILON ? { x: value.x / length, y: value.y / length } : { x: 0, y: 0 };
}

function dot(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.y * b.y;
}

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function addScaled(origin: Vec2, direction: Vec2, scale: number): Vec2 {
  return { x: origin.x + direction.x * scale, y: origin.y + direction.y * scale };
}

function observedPlayerDirection(player: ActorSnapshot, previous: Vec2 | null | undefined): Vec2 {
  if (magnitude(player.requestedVelocity) > 0.15) return normalized(player.requestedVelocity);
  if (magnitude(player.actualVelocity) > 0.15) return normalized(player.actualVelocity);
  if (previous && magnitude(previous) > 0.5) return normalized(previous);
  return { x: 1, y: 0 };
}

function pointInsideExpandedObstacle(point: Vec2, obstacle: ObstacleSpec, margin: number): boolean {
  return (
    point.x > obstacle.x - margin &&
    point.x < obstacle.x + obstacle.width + margin &&
    point.y > obstacle.y - margin &&
    point.y < obstacle.y + obstacle.height + margin
  );
}

function pointFits(snapshot: WorldSnapshot, point: Vec2, bodyRadius: number): boolean {
  const margin = bodyRadius + S2C_ROUTE_CLEARANCE;
  if (
    point.x - margin < 0 ||
    point.y - margin < 0 ||
    point.x + margin > snapshot.width ||
    point.y + margin > snapshot.height
  ) return false;
  return !snapshot.obstacles.some((obstacle) => pointInsideExpandedObstacle(point, obstacle, margin));
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
  const boundary = Math.min(
    point.x,
    point.y,
    snapshot.width - point.x,
    snapshot.height - point.y
  ) - bodyRadius;
  let result = boundary;
  for (const obstacle of snapshot.obstacles) {
    result = Math.min(result, distanceToObstacle(point, obstacle) - bodyRadius);
  }
  return result;
}

function emptyTerms(): RelationshipFieldTerms {
  return {
    frontPenalty: 0,
    radialPenalty: 0,
    travelPenalty: 0,
    clearancePenalty: 0,
    continuityPenalty: 0,
    routePenalty: 0
  };
}

function localScore(options: {
  snapshot: WorldSnapshot;
  companion: ActorSnapshot;
  player: ActorSnapshot;
  playerDirection: Vec2;
  position: Vec2;
  direction: Vec2;
  radius: number;
  previousTarget?: Vec2 | null;
}): { valid: boolean; clearance: number; score: number; terms: RelationshipFieldTerms } {
  const valid = pointFits(options.snapshot, options.position, options.companion.radius);
  const clearance = localClearance(options.snapshot, options.position, options.companion.radius);
  if (!valid) return { valid, clearance, score: HARD_INVALID_SCORE, terms: emptyTerms() };

  const frontness = Math.max(0, dot(options.direction, options.playerDirection));
  const clearancePressure = clamp((0.65 - clearance) / 0.65, 0, 1);
  const terms: RelationshipFieldTerms = {
    frontPenalty: frontness * frontness * 4.8,
    radialPenalty: Math.abs(options.radius - PREFERRED_RADIUS) * 1.4,
    travelPenalty: distance(options.companion.position, options.position) * 0.18,
    clearancePenalty: clearancePressure * clearancePressure * 1.8,
    continuityPenalty: options.previousTarget ? distance(options.previousTarget, options.position) * 0.3 : 0,
    routePenalty: 0
  };
  return {
    valid,
    clearance,
    score: terms.frontPenalty + terms.radialPenalty + terms.travelPenalty + terms.clearancePenalty + terms.continuityPenalty,
    terms
  };
}

function routeQualifies(status: StaticRoutePlan["status"]): boolean {
  return status === "direct" || status === "routed";
}

function buildRawSamples(input: ContinuousRelationshipFieldInput): {
  companion: ActorSnapshot;
  player: ActorSnapshot;
  playerDirection: Vec2;
  samples: RelationshipFieldSample[];
} {
  const companion = actor(input.snapshot, "companion");
  const player = actor(input.snapshot, "player");
  const playerDirection = observedPlayerDirection(player, input.previousPlayerDirection);
  const samples: RelationshipFieldSample[] = [];

  for (let radiusIndex = 0; radiusIndex < S5_FIELD_RADII.length; radiusIndex += 1) {
    const radius = S5_FIELD_RADII[radiusIndex];
    if (radius === undefined) continue;
    for (let angleIndex = 0; angleIndex < S5_FIELD_DIRECTIONS; angleIndex += 1) {
      const angle = (angleIndex / S5_FIELD_DIRECTIONS) * Math.PI * 2;
      const direction = { x: Math.cos(angle), y: Math.sin(angle) };
      const position = addScaled(player.position, direction, radius);
      const local = localScore({
        snapshot: input.snapshot,
        companion,
        player,
        playerDirection,
        position,
        direction,
        radius,
        previousTarget: input.previousTarget
      });
      samples.push({
        id: `r${radiusIndex}.d${angleIndex}`,
        angleIndex,
        radiusIndex,
        radius,
        angle,
        direction,
        position,
        localValid: local.valid,
        localClearance: local.clearance,
        routeStatus: "not-evaluated",
        routeCost: null,
        routeEvaluated: false,
        reachable: false,
        score: local.score,
        terms: local.terms,
        inGoodRegion: false
      });
    }
  }

  return { companion, player, playerDirection, samples };
}

function evaluateRouteShortlist(
  input: ContinuousRelationshipFieldInput,
  companion: ActorSnapshot,
  samples: RelationshipFieldSample[]
): void {
  const shortlist = samples
    .filter((sample) => sample.localValid)
    .sort((a, b) => a.score - b.score || a.id.localeCompare(b.id))
    .slice(0, S5_ROUTE_SHORTLIST);

  for (const sample of shortlist) {
    const plan = planStaticShadowRoute({
      snapshot: input.snapshot,
      start: companion.position,
      target: sample.position,
      radius: companion.radius,
      query: input.query
    });
    sample.routeEvaluated = true;
    sample.routeStatus = plan.status;
    sample.routeCost = plan.cost;
    sample.reachable = routeQualifies(plan.status);
    if (sample.reachable && plan.cost !== null) {
      sample.terms.routePenalty = plan.cost * 0.12;
      sample.score += sample.terms.routePenalty;
    } else {
      sample.score = HARD_INVALID_SCORE;
    }
  }
}

function weightedRegionTarget(samples: readonly RelationshipFieldSample[]): Vec2 | null {
  if (samples.length === 0) return null;
  const best = samples[0];
  if (!best) return null;
  let total = 0;
  let x = 0;
  let y = 0;
  for (const sample of samples) {
    const weight = Math.exp(-(sample.score - best.score) / 0.28);
    total += weight;
    x += sample.position.x * weight;
    y += sample.position.y * weight;
  }
  return total > EPSILON ? { x: x / total, y: y / total } : { ...best.position };
}

export function evaluateContinuousRelationshipField(
  input: ContinuousRelationshipFieldInput
): ContinuousRelationshipFieldDecision {
  const raw = buildRawSamples(input);
  evaluateRouteShortlist(input, raw.companion, raw.samples);

  const reachable = raw.samples
    .filter((sample) => sample.routeEvaluated && sample.reachable)
    .sort((a, b) => a.score - b.score || a.id.localeCompare(b.id));
  const best = reachable[0] ?? null;

  if (!best) {
    return {
      mode: "continuous-field-shadow",
      tick: input.snapshot.tick,
      playerPosition: { ...raw.player.position },
      playerDirection: raw.playerDirection,
      companionPosition: { ...raw.companion.position },
      representativeTarget: { ...raw.player.position },
      representativeSource: "player-position-fallback",
      representativeRouteStatus: "not-evaluated",
      bestSampleId: null,
      goodRegionSampleIds: [],
      routeEvaluatedCount: raw.samples.filter((sample) => sample.routeEvaluated).length,
      samples: raw.samples,
      reason: "no reachable sample survived the route-aware shortlist"
    };
  }

  const goodRegion = reachable.filter((sample) => sample.score <= best.score + S5_GOOD_REGION_SCORE_WINDOW);
  for (const sample of goodRegion) sample.inGoodRegion = true;
  const interpolated = weightedRegionTarget(goodRegion) ?? { ...best.position };

  let representativeTarget = { ...best.position };
  let representativeSource: ContinuousRelationshipFieldDecision["representativeSource"] = "best-sample-fallback";
  let representativeRouteStatus: ContinuousRelationshipFieldDecision["representativeRouteStatus"] = best.routeStatus;
  let reason = `best reachable field sample ${best.id}; weighted region interpolation unavailable`;

  if (pointFits(input.snapshot, interpolated, raw.companion.radius)) {
    const interpolatedPlan = planStaticShadowRoute({
      snapshot: input.snapshot,
      start: raw.companion.position,
      target: interpolated,
      radius: raw.companion.radius,
      query: input.query
    });
    representativeRouteStatus = interpolatedPlan.status;
    if (routeQualifies(interpolatedPlan.status)) {
      representativeTarget = interpolated;
      representativeSource = "weighted-region";
      reason = `weighted representative of ${goodRegion.length} near-best reachable field samples`;
    } else {
      reason = `weighted representative was ${interpolatedPlan.status}; fell back to ${best.id}`;
    }
  } else {
    reason = `weighted representative failed local geometry; fell back to ${best.id}`;
  }

  return {
    mode: "continuous-field-shadow",
    tick: input.snapshot.tick,
    playerPosition: { ...raw.player.position },
    playerDirection: raw.playerDirection,
    companionPosition: { ...raw.companion.position },
    representativeTarget,
    representativeSource,
    representativeRouteStatus,
    bestSampleId: best.id,
    goodRegionSampleIds: goodRegion.map((sample) => sample.id),
    routeEvaluatedCount: raw.samples.filter((sample) => sample.routeEvaluated).length,
    samples: raw.samples,
    reason
  };
}

export class ContinuousRelationshipFieldBrain {
  private previousTarget: Vec2 | null = null;
  private previousPlayerDirection: Vec2 | null = null;
  private decisionValue: ContinuousRelationshipFieldDecision | null = null;
  private nextDecisionTick = 0;

  reset(): void {
    this.previousTarget = null;
    this.previousPlayerDirection = null;
    this.decisionValue = null;
    this.nextDecisionTick = 0;
  }

  decision(input: Omit<ContinuousRelationshipFieldInput, "previousTarget" | "previousPlayerDirection">): ContinuousRelationshipFieldDecision {
    if (this.decisionValue === null || input.snapshot.tick >= this.nextDecisionTick) {
      this.decisionValue = evaluateContinuousRelationshipField({
        ...input,
        previousTarget: this.previousTarget,
        previousPlayerDirection: this.previousPlayerDirection
      });
      this.previousTarget = { ...this.decisionValue.representativeTarget };
      this.previousPlayerDirection = { ...this.decisionValue.playerDirection };
      this.nextDecisionTick = input.snapshot.tick + S5_RELATIONSHIP_INTERVAL_TICKS;
    }
    return this.decisionValue;
  }

  debugState(): ContinuousRelationshipFieldDecision | null {
    return this.decisionValue;
  }
}
