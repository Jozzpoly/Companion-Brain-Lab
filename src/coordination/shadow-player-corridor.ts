import type { ActorSnapshot, Vec2, WorldSnapshot } from "../world/types";

const MOTION_THRESHOLD = 0.15;
const MAX_REFERENCE_SPEED = 3;
const MIN_MOVING_HORIZON = 0.12;
const MAX_MOVING_HORIZON = 0.55;
const COMFORT_EXPANSION = 0.18;
const EPSILON = 1e-9;
// Current World runs at 60 Hz. Velocity direction is trajectory evidence, not
// semantic facing, so keeping it beyond the prediction horizon would turn old
// motion into persistent pseudo-state. Keep one bounded horizon of memory.
const DIRECTION_MEMORY_TICKS = Math.ceil(MAX_MOVING_HORIZON * 60);

export type ShadowCorridorVelocitySource = "actual" | "requested" | "stationary";
export type ShadowCorridorState = "STATIONARY" | "MOVING" | "REVERSAL_UNCERTAIN";

export interface ShadowPlayerCorridor {
  state: ShadowCorridorState;
  tick: number;
  origin: Vec2;
  observedVelocity: Vec2;
  velocitySource: ShadowCorridorVelocitySource;
  speed: number;
  direction: Vec2;
  previousDirection: Vec2 | null;
  directionDotPrevious: number | null;
  confidence: number;
  horizon: number;
  endpoint: Vec2;
  physicalRadius: number;
  comfortRadius: number;
  reason: string;
}

export interface ShadowPlayerCorridorInput {
  snapshot: WorldSnapshot;
  previousDirection?: Vec2 | null;
  previousDirectionAgeTicks?: number | null;
}

function actor(snapshot: WorldSnapshot, id: ActorSnapshot["id"]): ActorSnapshot {
  const result = snapshot.actors.find((candidate) => candidate.id === id);
  if (!result) throw new Error(`Missing ${id} actor for shadow player corridor.`);
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

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function observedVelocity(player: ActorSnapshot): { velocity: Vec2; source: ShadowCorridorVelocitySource } {
  if (magnitude(player.actualVelocity) > MOTION_THRESHOLD) {
    return { velocity: { ...player.actualVelocity }, source: "actual" };
  }
  if (magnitude(player.requestedVelocity) > MOTION_THRESHOLD) {
    return { velocity: { ...player.requestedVelocity }, source: "requested" };
  }
  return { velocity: { x: 0, y: 0 }, source: "stationary" };
}

function directionMemoryStrength(ageTicks: number | null | undefined): number {
  const age = Math.max(0, Math.floor(ageTicks ?? 0));
  const remaining = clamp(1 - age / DIRECTION_MEMORY_TICKS, 0, 1);
  // Smoothstep keeps the same bounded memory horizon while reducing the semantic
  // step size at both ends. In particular, expiry approaches zero with a zero
  // derivative instead of retaining a material linear remainder until the last
  // cognition observation.
  return remaining * remaining * (3 - 2 * remaining);
}

function previousDirectionEvidence(input: ShadowPlayerCorridorInput): {
  direction: Vec2 | null;
  strength: number;
} {
  if (!input.previousDirection || magnitude(input.previousDirection) <= 0.5) {
    return { direction: null, strength: 0 };
  }
  const strength = directionMemoryStrength(input.previousDirectionAgeTicks);
  return strength > EPSILON
    ? { direction: normalized(input.previousDirection), strength }
    : { direction: null, strength: 0 };
}

export function evaluateShadowPlayerCorridor(input: ShadowPlayerCorridorInput): ShadowPlayerCorridor {
  const player = actor(input.snapshot, "player");
  const observed = observedVelocity(player);
  const speed = magnitude(observed.velocity);
  const previous = previousDirectionEvidence(input);
  const previousDirection = previous.direction;

  if (observed.source === "stationary") {
    return {
      state: "STATIONARY",
      tick: input.snapshot.tick,
      origin: { ...player.position },
      observedVelocity: { x: 0, y: 0 },
      velocitySource: "stationary",
      speed: 0,
      direction: { x: 0, y: 0 },
      previousDirection,
      directionDotPrevious: null,
      confidence: 0,
      horizon: 0,
      endpoint: { ...player.position },
      physicalRadius: player.radius,
      comfortRadius: player.radius + COMFORT_EXPANSION,
      reason: previousDirection
        ? `player motion is below the corridor threshold; recent trajectory memory is fading (${previous.strength.toFixed(2)})`
        : "player motion is below the corridor threshold; no directional flow is fabricated"
    };
  }

  const direction = normalized(observed.velocity);
  const directionDotPrevious = previousDirection ? clamp(dot(direction, previousDirection), -1, 1) : null;

  // Motion just above the noise threshold should carry almost no predictive
  // confidence. The old minimum of 0.15 created a hard semantic jump at exactly
  // the same boundary used to decide stationary vs moving.
  const speedConfidence = clamp((speed - MOTION_THRESHOLD) / (1.2 - MOTION_THRESHOLD), 0, 1);
  const rawPersistence = directionDotPrevious === null
    ? 1
    : clamp((directionDotPrevious + 1) / 2, 0.15, 1);
  // Old velocity evidence fades continuously toward neutral persistence instead of
  // retaining full reversal authority until one abrupt expiry tick.
  const persistenceConfidence = directionDotPrevious === null
    ? 1
    : 1 - previous.strength * (1 - rawPersistence);
  const confidence = clamp(speedConfidence * persistenceConfidence, 0, 1);

  const speedRatio = clamp(speed / MAX_REFERENCE_SPEED, 0, 1);
  const nominalHorizon = MIN_MOVING_HORIZON + (MAX_MOVING_HORIZON - MIN_MOVING_HORIZON) * speedRatio;
  const horizon = MIN_MOVING_HORIZON + (nominalHorizon - MIN_MOVING_HORIZON) * confidence;
  const endpoint = {
    x: player.position.x + observed.velocity.x * horizon,
    y: player.position.y + observed.velocity.y * horizon
  };
  const reversalUncertain = directionDotPrevious !== null &&
    directionDotPrevious < -0.25 &&
    previous.strength > EPSILON;

  return {
    state: reversalUncertain ? "REVERSAL_UNCERTAIN" : "MOVING",
    tick: input.snapshot.tick,
    origin: { ...player.position },
    observedVelocity: { ...observed.velocity },
    velocitySource: observed.source,
    speed,
    direction,
    previousDirection,
    directionDotPrevious,
    confidence,
    horizon,
    endpoint,
    physicalRadius: player.radius,
    comfortRadius: player.radius + COMFORT_EXPANSION,
    reason: reversalUncertain
      ? `recent heading reversal is weighted by fading trajectory memory (${previous.strength.toFixed(2)})`
      : `short deterministic corridor from ${observed.source} player velocity`
  };
}

export const CCC0_CORRIDOR_MOTION_THRESHOLD = MOTION_THRESHOLD;
export const CCC0_CORRIDOR_MAX_HORIZON = MAX_MOVING_HORIZON;
export const CCC0_CORRIDOR_COMFORT_EXPANSION = COMFORT_EXPANSION;
export const CCC0_CORRIDOR_DIRECTION_MEMORY_TICKS = DIRECTION_MEMORY_TICKS;
export const CCC0_CORRIDOR_DIRECTION_MEMORY_STRENGTH = directionMemoryStrength;