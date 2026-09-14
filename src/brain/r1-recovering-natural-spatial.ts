import type { StaticRoutePlan } from "../navigation/static-router";
import type { MotionIntent, Vec2, WorldSnapshot } from "../world/types";
import {
  ProgressRecoveryMonitor,
  type ProgressRecoveryDecision
} from "./progress-recovery";
import {
  R1NaturalSpatialLocomotionBrain,
  type R1NaturalSpatialLocomotionDebug
} from "./r1-natural-spatial-locomotion";
import type { R1SpatialLocomotionInput } from "./r1-hard-comfort-spatial";

export interface R1RecoveryOutcomeInput {
  snapshot: WorldSnapshot;
  objectiveKey: string;
  target: Vec2;
  routePlan: StaticRoutePlan;
  intentionalHoldReason?: string | null;
}

export interface R1RecoveringNaturalSpatialDebug {
  movement: R1NaturalSpatialLocomotionDebug;
  progress: ProgressRecoveryDecision | null;
  appliedLocalRetries: number;
}

function magnitude(value: Vec2): number {
  return Math.hypot(value.x, value.y);
}

function companion(snapshot: WorldSnapshot) {
  const value = snapshot.actors.find((actor) => actor.id === "companion");
  if (!value) throw new Error("R1 recovery coordinator requires companion state.");
  return value;
}

function copyProgress(value: ProgressRecoveryDecision | null): ProgressRecoveryDecision | null {
  return value ? { ...value } : null;
}

export class R1RecoveringNaturalSpatialBrain {
  private readonly movement = new R1NaturalSpatialLocomotionBrain();
  private readonly progress = new ProgressRecoveryMonitor();
  private progressValue: ProgressRecoveryDecision | null = null;
  private appliedLocalRetriesValue = 0;

  reset(): void {
    this.movement.reset();
    this.progress.reset();
    this.progressValue = null;
    this.appliedLocalRetriesValue = 0;
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
    const actor = companion(input.snapshot);
    const routeRemainingDistance =
      input.routePlan.status === "direct" || input.routePlan.status === "routed"
        ? input.routePlan.cost
        : null;

    const decision = this.progress.observe({
      tick: input.snapshot.tick,
      objectiveKey: input.objectiveKey,
      position: actor.position,
      target: input.target,
      routeStatus: input.routePlan.status,
      routeRemainingDistance,
      commandedSpeed: magnitude(actor.requestedVelocity),
      actualSpeed: magnitude(actor.actualVelocity),
      contacts: actor.contacts.map((contact) => contact.with),
      intentionalHoldReason: input.intentionalHoldReason ?? null
    });

    if (decision.action === "RETRY_LOCAL") {
      this.movement.retryLocalState();
      this.appliedLocalRetriesValue += 1;
    }

    this.progressValue = decision;
    return { ...decision };
  }

  debugState(): R1RecoveringNaturalSpatialDebug {
    return {
      movement: this.movement.debugState(),
      progress: copyProgress(this.progressValue),
      appliedLocalRetries: this.appliedLocalRetriesValue
    };
  }
}
