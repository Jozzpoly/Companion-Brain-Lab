import type { ActorSnapshot, Vec2, WorldSnapshot } from "../world/types";
import type { ShadowPlayerCorridor } from "./shadow-player-corridor";

const STATIONARY_PLAYER_INTERACTION_HORIZON = 0.35;
const EPSILON = 1e-9;

export type ShadowPlayerFlowConflictState =
  | "UNAVAILABLE"
  | "CLEAR"
  | "COMFORT_CONFLICT"
  | "PHYSICAL_CONFLICT";

export type ShadowPlayerFlowVelocitySource =
  | "legacy-preferred"
  | "authoritative-command"
  | "unavailable";

export interface ShadowPlayerFlowConflict {
  state: ShadowPlayerFlowConflictState;
  tick: number;
  horizon: number;
  velocitySource: ShadowPlayerFlowVelocitySource;
  companionVelocity: Vec2 | null;
  playerVelocity: Vec2;
  relativeVelocity: Vec2 | null;
  closestApproachTime: number | null;
  closestCenterDistance: number | null;
  physicalClearance: number | null;
  comfortClearance: number | null;
  companionAtClosestApproach: Vec2 | null;
  playerAtClosestApproach: Vec2 | null;
  reason: string;
}

export interface ShadowPlayerFlowConflictInput {
  snapshot: WorldSnapshot;
  corridor: ShadowPlayerCorridor;
  companionVelocity?: Vec2 | null;
  velocitySource?: Exclude<ShadowPlayerFlowVelocitySource, "unavailable">;
}

function actor(snapshot: WorldSnapshot, id: ActorSnapshot["id"]): ActorSnapshot {
  const result = snapshot.actors.find((candidate) => candidate.id === id);
  if (!result) throw new Error(`Missing ${id} actor for shadow player-flow conflict.`);
  return result;
}

function dot(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.y * b.y;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function addScaled(origin: Vec2, velocity: Vec2, time: number): Vec2 {
  return {
    x: origin.x + velocity.x * time,
    y: origin.y + velocity.y * time
  };
}

function finiteVec(value: Vec2 | null | undefined): value is Vec2 {
  return Boolean(value && Number.isFinite(value.x) && Number.isFinite(value.y));
}

export function evaluateShadowPlayerFlowConflict(
  input: ShadowPlayerFlowConflictInput
): ShadowPlayerFlowConflict {
  const player = actor(input.snapshot, "player");
  const companion = actor(input.snapshot, "companion");
  const horizon = input.corridor.horizon > 0
    ? input.corridor.horizon
    : STATIONARY_PLAYER_INTERACTION_HORIZON;
  const playerVelocity = { ...input.corridor.observedVelocity };

  if (!finiteVec(input.companionVelocity)) {
    return {
      state: "UNAVAILABLE",
      tick: input.snapshot.tick,
      horizon,
      velocitySource: "unavailable",
      companionVelocity: null,
      playerVelocity,
      relativeVelocity: null,
      closestApproachTime: null,
      closestCenterDistance: null,
      physicalClearance: null,
      comfortClearance: null,
      companionAtClosestApproach: null,
      playerAtClosestApproach: null,
      reason: "companion velocity evidence is unavailable; no motion-conflict claim is made"
    };
  }

  const velocitySource = input.velocitySource ?? "legacy-preferred";
  const companionVelocity = { ...input.companionVelocity };
  const relativePosition = {
    x: companion.position.x - player.position.x,
    y: companion.position.y - player.position.y
  };
  const relativeVelocity = {
    x: companionVelocity.x - playerVelocity.x,
    y: companionVelocity.y - playerVelocity.y
  };
  const relativeSpeedSquared = dot(relativeVelocity, relativeVelocity);
  const closestApproachTime = relativeSpeedSquared > EPSILON
    ? clamp(-dot(relativePosition, relativeVelocity) / relativeSpeedSquared, 0, horizon)
    : 0;
  const companionAtClosestApproach = addScaled(
    companion.position,
    companionVelocity,
    closestApproachTime
  );
  const playerAtClosestApproach = addScaled(
    player.position,
    playerVelocity,
    closestApproachTime
  );
  const closestCenterDistance = Math.hypot(
    companionAtClosestApproach.x - playerAtClosestApproach.x,
    companionAtClosestApproach.y - playerAtClosestApproach.y
  );
  const physicalThreshold = companion.radius + input.corridor.physicalRadius;
  const comfortThreshold = companion.radius + input.corridor.comfortRadius;
  const physicalClearance = closestCenterDistance - physicalThreshold;
  const comfortClearance = closestCenterDistance - comfortThreshold;

  const state: ShadowPlayerFlowConflictState = physicalClearance < 0
    ? "PHYSICAL_CONFLICT"
    : comfortClearance < 0
      ? "COMFORT_CONFLICT"
      : "CLEAR";

  return {
    state,
    tick: input.snapshot.tick,
    horizon,
    velocitySource,
    companionVelocity,
    playerVelocity,
    relativeVelocity,
    closestApproachTime,
    closestCenterDistance,
    physicalClearance,
    comfortClearance,
    companionAtClosestApproach,
    playerAtClosestApproach,
    reason: state === "PHYSICAL_CONFLICT"
      ? `${velocitySource} predicts body overlap within ${horizon.toFixed(2)}s`
      : state === "COMFORT_CONFLICT"
        ? `${velocitySource} enters player comfort envelope within ${horizon.toFixed(2)}s`
        : `${velocitySource} remains outside player comfort envelope for ${horizon.toFixed(2)}s`
  };
}

export const CCC0_STATIONARY_PLAYER_INTERACTION_HORIZON = STATIONARY_PLAYER_INTERACTION_HORIZON;
