import type { MotionIntent } from "../world/types";
import type { FinalCommandConstraintResult } from "./final-command-constraint";
import type { FinalPlayerCommandConstraintResult } from "./final-player-command-constraint";
import type { MotionContinuityStepResult } from "./motion-continuity";
import type { PreferredVelocityRefinement } from "./preferred-velocity-refinement";
import type { ProgressRecoveryDecision } from "./progress-recovery";
import {
  R1RecoveringDirectSpatialBrain
} from "./r1-recovering-direct-spatial";
import {
  R1RecoveringNaturalSpatialBrain
} from "./r1-recovering-natural-spatial";
import type { R1RecoveryOutcomeInput } from "./r1-recovery-supervisor";
import type {
  R1SpatialLocomotionInput,
  R1SpatialRepairEvidence
} from "./r1-hard-comfort-spatial";
import type { SpatialLocomotionDecision } from "./spatial-locomotion";

export interface R1WorkbenchSpatialDebug {
  actuator: "direct" | "natural";
  preferred: SpatialLocomotionDecision | null;
  repair: R1SpatialRepairEvidence | null;
  refinement: PreferredVelocityRefinement | null;
  continuity: MotionContinuityStepResult | null;
  finalConstraint: FinalCommandConstraintResult | null;
  finalPlayerConstraint: FinalPlayerCommandConstraintResult | null;
  progress: ProgressRecoveryDecision | null;
  appliedLocalRetries: number;
}

export class R1WorkbenchSpatialStack {
  private readonly direct = new R1RecoveringDirectSpatialBrain();
  private readonly natural = new R1RecoveringNaturalSpatialBrain();

  reset(): void {
    this.direct.reset();
    this.natural.reset();
  }

  resetActuator(natural: boolean): void {
    if (natural) this.natural.reset();
    else this.direct.reset();
  }

  intent(
    natural: boolean,
    input: Omit<R1SpatialLocomotionInput, "previousMove">
  ): MotionIntent {
    return natural ? this.natural.intent(input) : this.direct.intent(input);
  }

  observeOutcome(natural: boolean, input: R1RecoveryOutcomeInput): ProgressRecoveryDecision {
    return natural ? this.natural.observeOutcome(input) : this.direct.observeOutcome(input);
  }

  debugState(natural: boolean): R1WorkbenchSpatialDebug {
    if (natural) {
      const value = this.natural.debugState();
      return {
        actuator: "natural",
        preferred: value.movement.preferred,
        repair: value.movement.repair,
        refinement: value.movement.refinement,
        continuity: value.movement.continuity,
        finalConstraint: value.movement.finalConstraint,
        finalPlayerConstraint: value.movement.finalPlayerConstraint,
        progress: value.progress,
        appliedLocalRetries: value.appliedLocalRetries
      };
    }

    const value = this.direct.debugState();
    return {
      actuator: "direct",
      preferred: value.preferred,
      repair: value.repair,
      refinement: null,
      continuity: null,
      finalConstraint: null,
      finalPlayerConstraint: null,
      progress: value.progress,
      appliedLocalRetries: value.appliedLocalRetries
    };
  }
}
