import { S0_STEP_SECONDS } from "../physics/rapier-physical-world";
import type { MotionIntent, Vec2 } from "../world/types";
import {
  S3_EXPERIMENT_MAX_SPEED,
  SpatialLocomotionBrain,
  type SpatialLocomotionDecision,
  type SpatialLocomotionInput
} from "./spatial-locomotion";
import {
  MotionContinuityController,
  S4_DEFAULT_MOTION_CONTINUITY,
  type MotionContinuityConfig,
  type MotionContinuityStepResult
} from "./motion-continuity";

export interface NaturalSpatialLocomotionDebug {
  preferred: SpatialLocomotionDecision | null;
  continuity: MotionContinuityStepResult | null;
}

function companionVelocity(input: Omit<SpatialLocomotionInput, "previousMove">): Vec2 {
  const companion = input.snapshot.actors.find((actor) => actor.id === "companion");
  if (!companion) throw new Error("Natural spatial locomotion requires companion snapshot.");
  return { ...companion.actualVelocity };
}

export class NaturalSpatialLocomotionBrain {
  private readonly preferredBrain = new SpatialLocomotionBrain();
  private readonly continuity = new MotionContinuityController();
  private readonly config: MotionContinuityConfig;

  constructor(config: MotionContinuityConfig = S4_DEFAULT_MOTION_CONTINUITY) {
    this.config = { ...config, maxSpeed: S3_EXPERIMENT_MAX_SPEED };
  }

  reset(): void {
    this.preferredBrain.reset();
    this.continuity.reset();
  }

  intent(input: Omit<SpatialLocomotionInput, "previousMove">): MotionIntent {
    const preferredIntent = this.preferredBrain.intent(input);
    const shaped = this.continuity.step({
      currentVelocity: companionVelocity(input),
      preferredMove: preferredIntent.move,
      deltaSeconds: S0_STEP_SECONDS,
      config: this.config
    });
    return { actorId: "companion", move: { ...shaped.commandedMove } };
  }

  debugState(): NaturalSpatialLocomotionDebug {
    return {
      preferred: this.preferredBrain.debugState(),
      continuity: this.continuity.debugState()
    };
  }
}
