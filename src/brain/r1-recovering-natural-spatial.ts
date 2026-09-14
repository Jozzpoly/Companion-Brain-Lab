import type { MotionIntent } from "../world/types";
import type { ProgressRecoveryDecision } from "./progress-recovery";
import type { R1SpatialLocomotionInput } from "./r1-hard-comfort-spatial";
import {
  R1NaturalSpatialLocomotionBrain,
  type R1NaturalSpatialLocomotionDebug
} from "./r1-natural-spatial-locomotion";
import {
  R1RecoverySupervisor,
  type R1RecoveryOutcomeInput
} from "./r1-recovery-supervisor";

export type { R1RecoveryOutcomeInput } from "./r1-recovery-supervisor";

export interface R1RecoveringNaturalSpatialDebug {
  movement: R1NaturalSpatialLocomotionDebug;
  progress: ProgressRecoveryDecision | null;
  appliedLocalRetries: number;
}

export class R1RecoveringNaturalSpatialBrain {
  private readonly movement = new R1NaturalSpatialLocomotionBrain();
  private readonly recovery = new R1RecoverySupervisor(() => this.movement.retryLocalState());

  reset(): void {
    this.movement.reset();
    this.recovery.reset();
  }

  intent(input: Omit<R1SpatialLocomotionInput, "previousMove">): MotionIntent {
    return this.movement.intent(input);
  }

  /**
   * Must be called with post-World state and a route recomputed from that state.
   * RETRY_LOCAL affects only the next local movement decision. Higher-level
   * actions such as RECONSIDER_OBJECTIVE are exposed but never executed here.
   */
  observeOutcome(input: R1RecoveryOutcomeInput): ProgressRecoveryDecision {
    return this.recovery.observeOutcome(input);
  }

  debugState(): R1RecoveringNaturalSpatialDebug {
    const recovery = this.recovery.debugState();
    return {
      movement: this.movement.debugState(),
      progress: recovery.progress,
      appliedLocalRetries: recovery.appliedLocalRetries
    };
  }
}
