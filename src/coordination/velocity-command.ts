import type { MovementCapability } from "../world/movement-capability";
import type { MotionIntent, Vec2 } from "../world/types";

export interface VelocityCommand {
  actorId: MotionIntent["actorId"];
  velocity: Vec2;
  capabilityMaxSpeed: number;
  sourceTick: number;
  source: "legacy-motion-intent-derived";
}

function finiteVector(value: Vec2): boolean {
  return Number.isFinite(value.x) && Number.isFinite(value.y);
}

function validateCapability(capability: MovementCapability): void {
  if (!Number.isFinite(capability.maxSpeed) || capability.maxSpeed <= 0) {
    throw new Error("Velocity command requires a positive finite movement capability.");
  }
}

export function velocityCommandFromMotionIntent(input: {
  intent: MotionIntent;
  capability: MovementCapability;
  sourceTick: number;
}): VelocityCommand {
  validateCapability(input.capability);
  if (input.intent.actorId !== input.capability.actorId) {
    throw new Error("MotionIntent actor does not match movement capability actor.");
  }
  if (!finiteVector(input.intent.move)) throw new Error("MotionIntent move must be finite.");
  if (!Number.isInteger(input.sourceTick) || input.sourceTick < 0) {
    throw new Error("Velocity command sourceTick must be a non-negative integer.");
  }

  return {
    actorId: input.intent.actorId,
    velocity: {
      x: input.intent.move.x * input.capability.maxSpeed,
      y: input.intent.move.y * input.capability.maxSpeed
    },
    capabilityMaxSpeed: input.capability.maxSpeed,
    sourceTick: input.sourceTick,
    source: "legacy-motion-intent-derived"
  };
}

export function motionIntentFromVelocityCommand(command: VelocityCommand): MotionIntent {
  if (!Number.isFinite(command.capabilityMaxSpeed) || command.capabilityMaxSpeed <= 0) {
    throw new Error("Velocity command capabilityMaxSpeed must be positive and finite.");
  }
  if (!finiteVector(command.velocity)) throw new Error("Velocity command must be finite.");

  return {
    actorId: command.actorId,
    move: {
      x: command.velocity.x / command.capabilityMaxSpeed,
      y: command.velocity.y / command.capabilityMaxSpeed
    }
  };
}

export function motionIntentRoundTripError(
  intent: MotionIntent,
  capability: MovementCapability,
  sourceTick = 0
): number {
  const reconstructed = motionIntentFromVelocityCommand(
    velocityCommandFromMotionIntent({ intent, capability, sourceTick })
  );
  return Math.hypot(
    reconstructed.move.x - intent.move.x,
    reconstructed.move.y - intent.move.y
  );
}
