import type { Vec2 } from "../world/types";

const EPSILON = 1e-9;

export interface MotionContinuityConfig {
  maxSpeed: number;
  maxAcceleration: number;
  maxBrakingAcceleration: number;
  maxJerk: number;
}

export const S4_DEFAULT_MOTION_CONTINUITY: MotionContinuityConfig = {
  maxSpeed: 3,
  maxAcceleration: 13,
  maxBrakingAcceleration: 18,
  maxJerk: 160
};

export type MotionContinuityRegime = "ACCELERATE" | "STEER" | "BRAKE" | "HOLD";

export interface MotionContinuityStepInput {
  currentVelocity: Vec2;
  preferredMove: Vec2;
  previousAcceleration: Vec2;
  deltaSeconds: number;
  config?: MotionContinuityConfig;
}

export interface MotionContinuityStepResult {
  preferredVelocity: Vec2;
  commandedVelocity: Vec2;
  commandedMove: Vec2;
  acceleration: Vec2;
  jerk: Vec2;
  regime: MotionContinuityRegime;
  speed: number;
  preferredSpeed: number;
  accelerationMagnitude: number;
  jerkMagnitude: number;
  velocityError: number;
}

function magnitude(value: Vec2): number {
  return Math.hypot(value.x, value.y);
}

function dot(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.y * b.y;
}

function clampMagnitude(value: Vec2, maximum: number): Vec2 {
  const length = magnitude(value);
  if (length <= maximum || length <= EPSILON) return { ...value };
  const scale = maximum / length;
  return { x: value.x * scale, y: value.y * scale };
}

function subtract(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

function addScaled(origin: Vec2, vector: Vec2, scale: number): Vec2 {
  return { x: origin.x + vector.x * scale, y: origin.y + vector.y * scale };
}

function classifyRegime(currentVelocity: Vec2, preferredVelocity: Vec2): MotionContinuityRegime {
  const currentSpeed = magnitude(currentVelocity);
  const preferredSpeed = magnitude(preferredVelocity);
  if (preferredSpeed < 0.03 && currentSpeed < 0.03) return "HOLD";
  if (preferredSpeed + 0.08 < currentSpeed || dot(currentVelocity, preferredVelocity) < -0.02) return "BRAKE";
  if (currentSpeed > 0.15 && preferredSpeed > 0.15) {
    const alignment = dot(currentVelocity, preferredVelocity) / Math.max(EPSILON, currentSpeed * preferredSpeed);
    if (alignment < 0.94) return "STEER";
  }
  return "ACCELERATE";
}

export function stepMotionContinuity(input: MotionContinuityStepInput): MotionContinuityStepResult {
  const config = input.config ?? S4_DEFAULT_MOTION_CONTINUITY;
  if (!(input.deltaSeconds > 0) || !Number.isFinite(input.deltaSeconds)) {
    throw new Error("Motion continuity requires a positive finite deltaSeconds.");
  }

  const preferredMove = clampMagnitude(input.preferredMove, 1);
  const preferredVelocity = {
    x: preferredMove.x * config.maxSpeed,
    y: preferredMove.y * config.maxSpeed
  };
  const currentVelocity = clampMagnitude(input.currentVelocity, config.maxSpeed * 1.5);
  const velocityDelta = subtract(preferredVelocity, currentVelocity);
  const regime = classifyRegime(currentVelocity, preferredVelocity);
  const accelerationLimit = regime === "BRAKE" ? config.maxBrakingAcceleration : config.maxAcceleration;

  const desiredAcceleration = clampMagnitude({
    x: velocityDelta.x / input.deltaSeconds,
    y: velocityDelta.y / input.deltaSeconds
  }, accelerationLimit);

  const accelerationDelta = subtract(desiredAcceleration, input.previousAcceleration);
  const acceleration = addScaled(
    input.previousAcceleration,
    clampMagnitude(accelerationDelta, config.maxJerk * input.deltaSeconds),
    1
  );
  const boundedAcceleration = clampMagnitude(acceleration, accelerationLimit);

  let commandedVelocity = addScaled(currentVelocity, boundedAcceleration, input.deltaSeconds);
  const beforeError = subtract(currentVelocity, preferredVelocity);
  const afterError = subtract(commandedVelocity, preferredVelocity);
  if (dot(beforeError, afterError) <= 0 || magnitude(afterError) < 0.015) {
    commandedVelocity = { ...preferredVelocity };
  }
  commandedVelocity = clampMagnitude(commandedVelocity, config.maxSpeed);

  const actualAcceleration = {
    x: (commandedVelocity.x - currentVelocity.x) / input.deltaSeconds,
    y: (commandedVelocity.y - currentVelocity.y) / input.deltaSeconds
  };
  const jerk = {
    x: (actualAcceleration.x - input.previousAcceleration.x) / input.deltaSeconds,
    y: (actualAcceleration.y - input.previousAcceleration.y) / input.deltaSeconds
  };

  return {
    preferredVelocity,
    commandedVelocity,
    commandedMove: {
      x: commandedVelocity.x / config.maxSpeed,
      y: commandedVelocity.y / config.maxSpeed
    },
    acceleration: actualAcceleration,
    jerk,
    regime,
    speed: magnitude(commandedVelocity),
    preferredSpeed: magnitude(preferredVelocity),
    accelerationMagnitude: magnitude(actualAcceleration),
    jerkMagnitude: magnitude(jerk),
    velocityError: magnitude(subtract(preferredVelocity, commandedVelocity))
  };
}

export class MotionContinuityController {
  private accelerationValue: Vec2 = { x: 0, y: 0 };
  private lastResultValue: MotionContinuityStepResult | null = null;

  reset(): void {
    this.accelerationValue = { x: 0, y: 0 };
    this.lastResultValue = null;
  }

  step(input: Omit<MotionContinuityStepInput, "previousAcceleration">): MotionContinuityStepResult {
    const result = stepMotionContinuity({ ...input, previousAcceleration: this.accelerationValue });
    this.accelerationValue = { ...result.acceleration };
    this.lastResultValue = result;
    return result;
  }

  debugState(): MotionContinuityStepResult | null {
    return this.lastResultValue;
  }
}
