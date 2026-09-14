import type { MotionIntent } from "../world/types";
import type { ProgressRecoveryDecision } from "./progress-recovery";
import {
  R1HardComfortSpatialBrain,
  type R1SpatialLocomotionInput,
  type R1SpatialRepairEvidence
} from "./r1-hard-comfort-spatial";
import type { SpatialLocomotionDecision } from "./spatial-locomotion";
import {
  R1RecoverySupervisor,
  type R1RecoveryOutcomeInput
} from "./r1-recovery-supervisor";

export interface R1RecoveringDirectSpatialDebug {
  preferred: SpatialLocomotionDecision | null;
  repair: R1SpatialRepairEvidence | null;
  progress: ProgressRecoveryDecision | null;
  appliedLocalRetries: number;
}

export class R1RecoveringDirectSpatialBrain {
  private readonly movement = new R1HardComfortSpatialBrain();
  private readonly recovery = new R1RecoverySupervisor(() => this.movement.reset());

  reset(): void {
    this.movement.reset();
    this.recovery.reset();
  }

  intent(input: Omit<R1SpatialLocomotionInput, "previousMove">): MotionIntent {
    return this.movement.intent(input);
  }

  observeOutcome(input: R1RecoveryOutcomeInput): ProgressRecoveryDecision {
    return this.recovery.observeOutcome(input);
  }

  debugState(): R1RecoveringDirectSpatialDebug {
    const recovery = this.recovery.debugState();
    return {
      preferred: this.movement.debugState(),
      repair: this.movement.repairEvidence(),
      progress: recovery.progress,
      appliedLocalRetries: recovery.appliedLocalRetries
    };
  }
}
