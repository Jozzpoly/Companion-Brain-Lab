import type { ActorId, ScenarioSpec } from "./types";

export interface MovementCapability {
  actorId: ActorId;
  maxSpeed: number;
  radius: number;
  source: "actor-spec";
}

export function movementCapabilityFromScenario(
  spec: ScenarioSpec,
  actorId: ActorId
): MovementCapability {
  const actor = spec.actors.find((candidate) => candidate.id === actorId);
  if (!actor) throw new Error(`Scenario ${spec.id} is missing actor capability for ${actorId}.`);
  if (!Number.isFinite(actor.speed) || actor.speed <= 0) {
    throw new Error(`Actor ${actorId} requires a positive finite movement speed.`);
  }
  if (!Number.isFinite(actor.radius) || actor.radius <= 0) {
    throw new Error(`Actor ${actorId} requires a positive finite radius.`);
  }
  return {
    actorId,
    maxSpeed: actor.speed,
    radius: actor.radius,
    source: "actor-spec"
  };
}
