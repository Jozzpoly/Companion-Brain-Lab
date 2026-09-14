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
    input: Omit<R1SpatialLocomotionInput, "previousMove">
  ): MotionIntent {
    // Authoritative movement is computed first on every physics tick. CCC-0 is a
    // slower research process: expensive relationship/topology evidence is sampled
    // on a tactical cadence and can never block or alter the already-selected command.
    const intent = natural ? this.natural.intent(input) : this.direct.intent(input);
    const preferred = natural
      ? this.natural.debugState().movement.preferred
      : this.direct.debugState().preferred;

    if (input.snapshot.tick >= this.nextShadowTick) {
      try {
        const frame = this.evaluateShadow({
          snapshot: input.snapshot,
          query: input.query,
          physicalSpeedCapability: S3_EXPERIMENT_MAX_SPEED,
          history: this.shadowHistory,
          legacyRelationshipTarget: input.relationshipTarget,
          legacyPreferredVelocity: preferred?.selectedVelocity ?? null,
          // World will apply the same actor speed scale to MotionIntent. Capture
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
