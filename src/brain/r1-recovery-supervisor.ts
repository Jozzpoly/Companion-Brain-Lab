import type { StaticRoutePlan } from "../navigation/static-router";
import type { Vec2, WorldSnapshot } from "../world/types";
import {
  ProgressRecoveryMonitor,
  type ProgressRecoveryDecision
} from "./progress-recovery";

export interface R1RecoveryOutcomeInput {
  snapshot: WorldSnapshot;
  objectiveKey: string;
  target: Vec2;
  routePlan: StaticRoutePlan;
  intentionalHoldReason?: string | null;
}

export interface R1RecoverySupervisorDebug {
  progress: ProgressRecoveryDecision | null;
  appliedLocalRetries: number;
}

function magnitude(value: Vec2): number {
  return Math.hypot(value.x, value.y);
}

function companion(snapshot: WorldSnapshot) {
  const value = snapshot.actors.find((actor) => actor.id === "companion");
  if (!value) throw new Error("R1 recovery supervisor requires companion state.");
  return value;
}

function copyProgress(value: ProgressRecoveryDecision | null): ProgressRecoveryDecision | null {
  return value ? { ...value } : null;
}

export class R1RecoverySupervisor {
  private readonly progress = new ProgressRecoveryMonitor();
  private progressValue: ProgressRecoveryDecision | null = null;
  private appliedLocalRetriesValue = 0;

  constructor(private readonly retryLocal: () => void) {}

  reset(): void {
    this.progress.reset();
    this.progressValue = null;
    this.appliedLocalRetriesValue = 0;
  }

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
      this.retryLocal();
      this.appliedLocalRetriesValue += 1;
    }

    this.progressValue = decision;
    return { ...decision };
  }

  debugState(): R1RecoverySupervisorDebug {
    return {
      progress: copyProgress(this.progressValue),
      appliedLocalRetries: this.appliedLocalRetriesValue
    };
  }
}
