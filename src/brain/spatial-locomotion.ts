import type { StaticRoutePlan, StaticTraversalQuery } from "../navigation/static-router";
import type { ActorSnapshot, MotionIntent, Vec2, WorldSnapshot } from "../world/types";

export const S3_SPATIAL_INTERVAL_TICKS = 3;
export const S3_SENSOR_DIRECTIONS = 24;
export const S3_SENSOR_RANGE = 2.4;
export const S3_CANDIDATE_DIRECTIONS = 24;
export const S3_SPEED_LEVELS = [0.35, 0.7, 1] as const;
export const S3_PREDICTION_HORIZON_SECONDS = 0.55;
export const S3_EXPERIMENT_MAX_SPEED = 3;
export const S3_STATIC_CLEARANCE = 0.05;
export const S3_PLAYER_BUFFER = 0.18;
const HARD_REJECT_SCORE = 1_000_000;
const EPSILON = 1e-9;

export type SpatialMotionState = "HOLD" | "ADVANCE" | "SIDESTEP" | "BACKOFF";

export interface SpatialRaySample {
  index: number;
  angle: number;
  direction: Vec2;
  range: number;
  freeDistance: number;
  blockedBy: string | null;
  hitPoint: Vec2 | null;
}

export interface SpatialObservation {
  tick: number;
  companionPosition: Vec2;
  companionRadius: number;
  companionRequestedVelocity: Vec2;
  companionActualVelocity: Vec2;
  playerPosition: Vec2;
  playerVelocity: Vec2;
  playerRadius: number;
  predictedPlayerPosition: Vec2;
  relationshipTarget: Vec2;
  routeStatus: StaticRoutePlan["status"];
  routeNodeIds: readonly string[];
  routeLookahead: Vec2;
  rays: readonly SpatialRaySample[];
}

export interface SpatialScoreTerms {
  routeDistance: number;
  relationshipDistance: number;
  clearancePenalty: number;
  playerRiskPenalty: number;
  continuityPenalty: number;
  unnecessaryMotionPenalty: number;
}

export interface SpatialVelocityCandidate {
  id: string;
  directionIndex: number | null;
  speedFraction: number;
  move: Vec2;
  worldVelocity: Vec2;
  predictedPosition: Vec2;
  hardRejected: boolean;
  rejectionReason: string | null;
  minimumPlayerClearance: number;
  staticFreeDistance: number;
  score: number;
  terms: SpatialScoreTerms;
}

export interface SpatialLocomotionDecision {
  mode: "spatial";
  tick: number;
  state: SpatialMotionState;
  selectedCandidateId: string;
  selectedMove: Vec2;
  selectedVelocity: Vec2;
  reason: string;
  observation: SpatialObservation;
  candidates: readonly SpatialVelocityCandidate[];
  acceptedCount: number;
  rejectedCount: number;
}

export interface SpatialLocomotionInput {
  snapshot: WorldSnapshot;
  relationshipTarget: Vec2;
  routePlan: StaticRoutePlan;
  query: StaticTraversalQuery;
  previousMove?: Vec2;
}

function actor(snapshot: WorldSnapshot, id: ActorSnapshot["id"]): ActorSnapshot {
  const result = snapshot.actors.find((entry) => entry.id === id);
  if (!result) throw new Error(`Missing actor in spatial locomotion snapshot: ${id}`);
  return result;
}

function magnitude(v: Vec2): number {
  return Math.hypot(v.x, v.y);
}

function normalized(v: Vec2): Vec2 {
  const length = magnitude(v);
  return length > EPSILON ? { x: v.x / length, y: v.y / length } : { x: 0, y: 0 };
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

function addScaled(origin: Vec2, vector: Vec2, scale: number): Vec2 {
  return { x: origin.x + vector.x * scale, y: origin.y + vector.y * scale };
}

function observedVelocity(actorValue: ActorSnapshot): Vec2 {
  if (magnitude(actorValue.actualVelocity) > 0.08) return { ...actorValue.actualVelocity };
  return { ...actorValue.requestedVelocity };
}

function nearestRay(rays: readonly SpatialRaySample[], direction: Vec2): SpatialRaySample | null {
  const unit = normalized(direction);
  if (magnitude(unit) < 0.5) return null;
  let best: SpatialRaySample | null = null;
  let bestDot = -Infinity;
  for (const ray of rays) {
    const alignment = dot(unit, ray.direction);
    if (alignment > bestDot) {
      bestDot = alignment;
      best = ray;
    }
  }
  return best;
}

function routeLookahead(plan: StaticRoutePlan, fallback: Vec2): Vec2 {
  if ((plan.status === "direct" || plan.status === "routed") && plan.waypoints.length > 0) {
    const first = plan.waypoints[0];
    if (first) return { ...first };
  }
  return { ...fallback };
}

export function observeSpatialEnvironment(input: SpatialLocomotionInput): SpatialObservation {
  const companion = actor(input.snapshot, "companion");
  const player = actor(input.snapshot, "player");
  const playerVelocity = observedVelocity(player);
  const queryRadius = companion.radius + S3_STATIC_CLEARANCE;
  const rays: SpatialRaySample[] = [];

  for (let index = 0; index < S3_SENSOR_DIRECTIONS; index += 1) {
    const angle = (index / S3_SENSOR_DIRECTIONS) * Math.PI * 2;
    const direction = { x: Math.cos(angle), y: Math.sin(angle) };
    const endpoint = addScaled(companion.position, direction, S3_SENSOR_RANGE);
    const traversal = input.query(companion.position, endpoint, queryRadius);
    rays.push({
      index,
      angle,
      direction,
      range: S3_SENSOR_RANGE,
      freeDistance: traversal.blocker?.distance ?? S3_SENSOR_RANGE,
      blockedBy: traversal.blocker?.label ?? null,
      hitPoint: traversal.blocker ? { ...traversal.blocker.hitCenter } : null
    });
  }

  return {
    tick: input.snapshot.tick,
    companionPosition: { ...companion.position },
    companionRadius: companion.radius,
    companionRequestedVelocity: { ...companion.requestedVelocity },
    companionActualVelocity: { ...companion.actualVelocity },
    playerPosition: { ...player.position },
    playerVelocity,
    playerRadius: player.radius,
    predictedPlayerPosition: addScaled(player.position, playerVelocity, S3_PREDICTION_HORIZON_SECONDS),
    relationshipTarget: { ...input.relationshipTarget },
    routeStatus: input.routePlan.status,
    routeNodeIds: [...input.routePlan.routeNodeIds],
    routeLookahead: routeLookahead(input.routePlan, companion.position),
    rays
  };
}

function minimumDynamicClearance(
  observation: SpatialObservation,
  candidateVelocity: Vec2
): number {
  const relativePosition = {
    x: observation.playerPosition.x - observation.companionPosition.x,
    y: observation.playerPosition.y - observation.companionPosition.y
  };
  const relativeVelocity = {
    x: observation.playerVelocity.x - candidateVelocity.x,
    y: observation.playerVelocity.y - candidateVelocity.y
  };
  const relativeSpeedSquared = dot(relativeVelocity, relativeVelocity);
  const closestTime = relativeSpeedSquared > EPSILON
    ? clamp(-dot(relativePosition, relativeVelocity) / relativeSpeedSquared, 0, S3_PREDICTION_HORIZON_SECONDS)
    : 0;
  const closest = addScaled(relativePosition, relativeVelocity, closestTime);
  const centerDistance = magnitude(closest);
  return centerDistance - (observation.companionRadius + observation.playerRadius + S3_PLAYER_BUFFER);
}

function scoreCandidate(options: {
  observation: SpatialObservation;
  query: StaticTraversalQuery;
  move: Vec2;
  speedFraction: number;
  id: string;
  directionIndex: number | null;
  previousMove: Vec2;
}): SpatialVelocityCandidate {
  const worldVelocity = {
    x: options.move.x * S3_EXPERIMENT_MAX_SPEED,
    y: options.move.y * S3_EXPERIMENT_MAX_SPEED
  };
  const predictedPosition = addScaled(
    options.observation.companionPosition,
    worldVelocity,
    S3_PREDICTION_HORIZON_SECONDS
  );
  const travelDistance = distance(options.observation.companionPosition, predictedPosition);
  const queryRadius = options.observation.companionRadius + S3_STATIC_CLEARANCE;
  const traversal = options.query(options.observation.companionPosition, predictedPosition, queryRadius);
  const ray = nearestRay(options.observation.rays, options.move);
  const staticFreeDistance = ray?.freeDistance ?? S3_SENSOR_RANGE;
  const currentPlayerCenterDistance = distance(
    options.observation.companionPosition,
    options.observation.playerPosition
  );
  const safePlayerDistance = options.observation.companionRadius + options.observation.playerRadius + S3_PLAYER_BUFFER;
  const minimumPlayerClearance = minimumDynamicClearance(options.observation, worldVelocity);

  let rejectionReason: string | null = null;
  if (travelDistance > EPSILON && !traversal.clear) {
    rejectionReason = `static:${traversal.blocker?.label ?? "unknown"}`;
  } else if (currentPlayerCenterDistance > safePlayerDistance && minimumPlayerClearance < 0) {
    rejectionReason = "player-predicted-collision";
  }

  const guideDistance = distance(predictedPosition, options.observation.routeLookahead);
  const relationshipDistance = distance(predictedPosition, options.observation.relationshipTarget);
  const clearanceRatio = clamp(staticFreeDistance / S3_SENSOR_RANGE, 0, 1);
  const softPlayerRange = 0.75;
  const playerRisk = clamp((softPlayerRange - minimumPlayerClearance) / softPlayerRange, 0, 1);
  const continuity = distance(options.move, options.previousMove);
  const relationshipNow = distance(options.observation.companionPosition, options.observation.relationshipTarget);
  const nearRelationship = clamp((0.8 - relationshipNow) / 0.8, 0, 1);

  const terms: SpatialScoreTerms = {
    routeDistance: guideDistance * 1.45,
    relationshipDistance: relationshipDistance * 0.35,
    clearancePenalty: (1 - clearanceRatio) * 1.2,
    playerRiskPenalty: playerRisk * playerRisk * 4.5,
    continuityPenalty: continuity * 0.38,
    unnecessaryMotionPenalty: options.speedFraction * nearRelationship * 1.35
  };
  const score = rejectionReason
    ? HARD_REJECT_SCORE
    : terms.routeDistance +
      terms.relationshipDistance +
      terms.clearancePenalty +
      terms.playerRiskPenalty +
      terms.continuityPenalty +
      terms.unnecessaryMotionPenalty;

  return {
    id: options.id,
    directionIndex: options.directionIndex,
    speedFraction: options.speedFraction,
    move: { ...options.move },
    worldVelocity,
    predictedPosition,
    hardRejected: rejectionReason !== null,
    rejectionReason,
    minimumPlayerClearance,
    staticFreeDistance,
    score,
    terms
  };
}

export function buildSpatialVelocityCandidates(options: {
  observation: SpatialObservation;
  query: StaticTraversalQuery;
  previousMove?: Vec2;
}): SpatialVelocityCandidate[] {
  const previousMove = options.previousMove ?? { x: 0, y: 0 };
  const candidates: SpatialVelocityCandidate[] = [];

  candidates.push(scoreCandidate({
    observation: options.observation,
    query: options.query,
    move: { x: 0, y: 0 },
    speedFraction: 0,
    id: "stop",
    directionIndex: null,
    previousMove
  }));

  for (let directionIndex = 0; directionIndex < S3_CANDIDATE_DIRECTIONS; directionIndex += 1) {
    const angle = (directionIndex / S3_CANDIDATE_DIRECTIONS) * Math.PI * 2;
    const direction = { x: Math.cos(angle), y: Math.sin(angle) };
    for (const speedFraction of S3_SPEED_LEVELS) {
      candidates.push(scoreCandidate({
        observation: options.observation,
        query: options.query,
        move: { x: direction.x * speedFraction, y: direction.y * speedFraction },
        speedFraction,
        id: `d${directionIndex}.s${speedFraction.toFixed(2)}`,
        directionIndex,
        previousMove
      }));
    }
  }

  return candidates;
}

function semanticState(observation: SpatialObservation, candidate: SpatialVelocityCandidate): SpatialMotionState {
  if (candidate.speedFraction < 0.05) return "HOLD";
  const guideDirection = normalized({
    x: observation.routeLookahead.x - observation.companionPosition.x,
    y: observation.routeLookahead.y - observation.companionPosition.y
  });
  const moveDirection = normalized(candidate.move);
  const alignment = dot(guideDirection, moveDirection);
  if (alignment > 0.6) return "ADVANCE";
  if (alignment < -0.35) return "BACKOFF";
  return "SIDESTEP";
}

export function chooseSpatialVelocity(options: {
  observation: SpatialObservation;
  candidates: readonly SpatialVelocityCandidate[];
}): SpatialLocomotionDecision {
  const accepted = options.candidates.filter((candidate) => !candidate.hardRejected);
  if (accepted.length === 0) throw new Error("Spatial locomotion produced no admissible candidates.");

  const sorted = [...accepted].sort((a, b) => {
    if (Math.abs(a.score - b.score) > 1e-9) return a.score - b.score;
    if (Math.abs(a.speedFraction - b.speedFraction) > 1e-9) return a.speedFraction - b.speedFraction;
    return a.id.localeCompare(b.id);
  });
  const selected = sorted[0];
  if (!selected) throw new Error("Spatial locomotion failed to select an admissible candidate.");
  const state = semanticState(options.observation, selected);

  return {
    mode: "spatial",
    tick: options.observation.tick,
    state,
    selectedCandidateId: selected.id,
    selectedMove: { ...selected.move },
    selectedVelocity: { ...selected.worldVelocity },
    reason: `${state} via ${selected.id}; score ${selected.score.toFixed(3)}; route ${options.observation.routeStatus}`,
    observation: options.observation,
    candidates: [...options.candidates],
    acceptedCount: accepted.length,
    rejectedCount: options.candidates.length - accepted.length
  };
}

export function evaluateSpatialLocomotion(input: SpatialLocomotionInput): SpatialLocomotionDecision {
  const observation = observeSpatialEnvironment(input);
  const candidates = buildSpatialVelocityCandidates({
    observation,
    query: input.query,
    previousMove: input.previousMove
  });
  return chooseSpatialVelocity({ observation, candidates });
}

export class SpatialLocomotionBrain {
  private previousMove: Vec2 = { x: 0, y: 0 };
  private decisionValue: SpatialLocomotionDecision | null = null;
  private nextDecisionTick = 0;

  reset(): void {
    this.previousMove = { x: 0, y: 0 };
    this.decisionValue = null;
    this.nextDecisionTick = 0;
  }

  intent(input: Omit<SpatialLocomotionInput, "previousMove">): MotionIntent {
    if (this.decisionValue === null || input.snapshot.tick >= this.nextDecisionTick) {
      this.decisionValue = evaluateSpatialLocomotion({ ...input, previousMove: this.previousMove });
      this.previousMove = { ...this.decisionValue.selectedMove };
      this.nextDecisionTick = input.snapshot.tick + S3_SPATIAL_INTERVAL_TICKS;
    }
    return { actorId: "companion", move: { ...this.decisionValue.selectedMove } };
  }

  debugState(): SpatialLocomotionDecision | null {
    return this.decisionValue;
  }
}
