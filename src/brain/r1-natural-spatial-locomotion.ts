import { S0_STEP_SECONDS } from "../physics/rapier-physical-world";
import type { MotionIntent, Vec2 } from "../world/types";
import { constrainFinalCommand, type FinalCommandConstraintResult } from "./final-command-constraint";
import {
  R1HardComfortSpatialBrain,
  type R1SpatialLocomotionInput,
  type R1SpatialRepairEvidence
} from "./r1-hard-comfort-spatial";
import {
  S3_EXPERIMENT_MAX_SPEED,
  type SpatialLocomotionDecision
} from "./spatial-locomotion";
import {
  MotionContinuityController,
  S4_DEFAULT_MOTION_CONTINUITY,
  type MotionContinuityConfig,
  type MotionContinuityStepResult
} from "./motion-continuity";
import {
  refinePreferredVelocity,
  type PreferredVelocityRefinement
} from "./preferred-velocity-refinement";

export interface R1NaturalSpatialLocomotionDebug {
  preferred: SpatialLocomotionDecision | null;
  repair: R1SpatialRepairEvidence | null;
  refinement: PreferredVelocityRefinement | null;
  continuity: MotionContinuityStepResult | null;
  finalConstraint: FinalCommandConstraintResult | null;
}

function companionState(input: Omit<R1SpatialLocomotionInput, "previousMove">): {
  position: Vec2;
  radius: number;
  actualVelocity: Vec2;
} {
  const companion = input.snapshot.actors.find((actor) => actor.id === "companion");
  if (!companion) throw new Error("R1 natural spatial locomotion requires companion snapshot.");
  return {
    position: { ...companion.position },
    radius: companion.radius,
    actualVelocity: { ...companion.actualVelocity }
  };
}

export class R1NaturalSpatialLocomotionBrain {
  private readonly preferredBrain = new R1HardComfortSpatialBrain();
  private readonly continuity = new MotionContinuityController();
  private readonly config: MotionContinuityConfig;
  private refinementValue: PreferredVelocityRefinement | null = null;
  private continuityValue: MotionContinuityStepResult | null = null;
  private constraintValue: FinalCommandConstraintResult | null = null;

  constructor(config: MotionContinuityConfig = S4_DEFAULT_MOTION_CONTINUITY) {
    this.config = { ...config, maxSpeed: S3_EXPERIMENT_MAX_SPEED };
  }

  reset(): void {
    this.retryLocalState();
  }

  /**
   * R1-4 bounded local recovery seam. This deliberately resets only local
   * movement realization state. It does not mutate World, route authority,
   * relationship objective, or progress-monitor episode state.
   */
  retryLocalState(): void {
    this.preferredBrain.reset();
    this.continuity.reset();
    this.refinementValue = null;
    this.continuityValue = null;
    this.constraintValue = null;
  }

  intent(input: Omit<R1SpatialLocomotionInput, "previousMove">): MotionIntent {
    const preferredIntent = this.preferredBrain.intent(input);
    const decision = this.preferredBrain.debugState();
    this.refinementValue = decision
      ? refinePreferredVelocity(decision, input.query)
      : null;
    const refinedMove = this.refinementValue?.refinedMove ?? preferredIntent.move;
    const companion = companionState(input);

    const shaped = this.continuity.step({
      currentVelocity: companion.actualVelocity,
      preferredMove: refinedMove,
      deltaSeconds: S0_STEP_SECONDS,
      config: this.config
    });
    this.continuityValue = shaped;

    const constrained = constrainFinalCommand({
      position: companion.position,
      radius: companion.radius,
      commandedMove: shaped.commandedMove,
      preferredMoves: [refinedMove, preferredIntent.move],
      maxSpeed: this.config.maxSpeed,
      deltaSeconds: S0_STEP_SECONDS,
      query: input.query
    });
    this.constraintValue = constrained;

    // The continuity controller's stored acceleration describes the command it
    // produced. If the hard gate rejects that command, that temporal state no
    // longer corresponds to the command World will execute. Reset only that
    // actuator history; upstream spatial state and the World remain untouched.
    if (constrained.constrained) this.continuity.reset();

    return { actorId: "companion", move: { ...constrained.finalMove } };
  }

  debugState(): R1NaturalSpatialLocomotionDebug {
    return {
      preferred: this.preferredBrain.debugState(),
      repair: this.preferredBrain.repairEvidence(),
      refinement: this.refinementValue ? {
        ...this.refinementValue,
        coarseMove: { ...this.refinementValue.coarseMove },
        refinedMove: { ...this.refinementValue.refinedMove },
        contributorIds: [...this.refinementValue.contributorIds]
      } : null,
      continuity: this.continuityValue ? {
        ...this.continuityValue,
        preferredVelocity: { ...this.continuityValue.preferredVelocity },
        commandedVelocity: { ...this.continuityValue.commandedVelocity },
        commandedMove: { ...this.continuityValue.commandedMove },
        acceleration: { ...this.continuityValue.acceleration },
        jerk: { ...this.continuityValue.jerk }
      } : null,
      finalConstraint: this.constraintValue ? {
        ...this.constraintValue,
        originalMove: { ...this.constraintValue.originalMove },
        finalMove: { ...this.constraintValue.finalMove }
      } : null
    };
  }
}
