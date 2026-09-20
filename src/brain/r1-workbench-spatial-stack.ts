import {
  createEmptyShadowCoordinationHistory,
  evaluateShadowCoordinationFrame,
  type ShadowCoordinationFrame,
  type ShadowCoordinationFrameInput,
  type ShadowCoordinationHistory
} from "../coordination/shadow-coordination-frame";
import type { MotionIntent, Vec2 } from "../world/types";
import type { FinalCommandConstraintResult } from "./final-command-constraint";
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
import {
  S3_EXPERIMENT_MAX_SPEED,
  type SpatialLocomotionDecision
} from "./spatial-locomotion";

export const CCC0_SHADOW_INTERVAL_TICKS = 6;

export interface R1WorkbenchSpatialDebug {
  actuator: "direct" | "natural";
  preferred: SpatialLocomotionDecision | null;
  repair: R1SpatialRepairEvidence | null;
  refinement: PreferredVelocityRefinement | null;
  continuity: MotionContinuityStepResult | null;
  finalConstraint: FinalCommandConstraintResult | null;
  progress: ProgressRecoveryDecision | null;
  appliedLocalRetries: number;
  shadowCoordination: ShadowCoordinationFrame | null;
  shadowCoordinationError: string | null;
  shadowNextEvaluationTick: number;
}

type ShadowCoordinationEvaluator = (input: ShadowCoordinationFrameInput) => ShadowCoordinationFrame;

export type R1WorkbenchSpatialIntentInput = Omit<R1SpatialLocomotionInput, "previousMove"> & {
  /** Preserve the actual baseline relationship semantic when live movement serves another objective. */
  shadowLegacyRelationshipTarget?: Vec2;
};

function intentVelocity(intent: MotionIntent): Vec2 {
  return {
    x: intent.move.x * S3_EXPERIMENT_MAX_SPEED,
    y: intent.move.y * S3_EXPERIMENT_MAX_SPEED
  };
}

export class R1WorkbenchSpatialStack {
  private readonly direct = new R1RecoveringDirectSpatialBrain();
  private readonly natural = new R1RecoveringNaturalSpatialBrain();
  private shadowHistory: ShadowCoordinationHistory = createEmptyShadowCoordinationHistory();
  private shadowFrame: ShadowCoordinationFrame | null = null;
  private shadowError: string | null = null;
  private nextShadowTick = 0;

  constructor(
    private readonly evaluateShadow: ShadowCoordinationEvaluator = evaluateShadowCoordinationFrame
  ) {}

  reset(): void {
    this.direct.reset();
    this.natural.reset();
    this.shadowHistory = createEmptyShadowCoordinationHistory();
    this.shadowFrame = null;
    this.shadowError = null;
    this.nextShadowTick = 0;
  }

  resetActuator(natural: boolean): void {
    if (natural) this.natural.reset();
    else this.direct.reset();
  }

  intent(
    natural: boolean,
    input: R1WorkbenchSpatialIntentInput
  ): MotionIntent {
    // Authoritative movement is selected first on every physics tick. CCC-0 cannot
    // alter that selected value, but its synchronous research work may still add
    // wall-clock latency; browser/perf evidence must qualify that separately.
    const intent = natural ? this.natural.intent(input) : this.direct.intent(input);
    const preferred = natural
      ? this.natural.debugState().movement.preferred
      : this.direct.debugState().preferred;

    // A failed shadow evaluation is event evidence from its originating cognition
    // tick, not persistent state. Do not let a cached failure masquerade as fresh
    // same-tick evidence on the intervening motor ticks.
    if (input.snapshot.tick < this.nextShadowTick && this.shadowError !== null) {
      this.shadowError = null;
    }

    if (input.snapshot.tick >= this.nextShadowTick) {
      try {
        const frame = this.evaluateShadow({
          snapshot: input.snapshot,
          query: input.query,
          physicalSpeedCapability: S3_EXPERIMENT_MAX_SPEED,
          history: this.shadowHistory,
          legacyRelationshipTarget: input.shadowLegacyRelationshipTarget ?? input.relationshipTarget,
          legacyPreferredVelocity: preferred?.selectedVelocity ?? null,
          // World applies the same workbench speed scale to MotionIntent. Capture
          // the already-selected command as velocity evidence without changing it.
          legacyAuthoritativeVelocity: intentVelocity(intent)
        });
        this.shadowFrame = frame;
        this.shadowHistory = frame.nextHistory;
        this.shadowError = null;
      } catch (error) {
        this.shadowFrame = null;
        this.shadowError = error instanceof Error ? error.message : String(error);
      } finally {
        this.nextShadowTick = input.snapshot.tick + CCC0_SHADOW_INTERVAL_TICKS;
      }
    }

    return intent;
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
        progress: value.progress,
        appliedLocalRetries: value.appliedLocalRetries,
        shadowCoordination: this.shadowFrame,
        shadowCoordinationError: this.shadowError,
        shadowNextEvaluationTick: this.nextShadowTick
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
      progress: value.progress,
      appliedLocalRetries: value.appliedLocalRetries,
      shadowCoordination: this.shadowFrame,
      shadowCoordinationError: this.shadowError,
      shadowNextEvaluationTick: this.nextShadowTick
    };
  }
}
