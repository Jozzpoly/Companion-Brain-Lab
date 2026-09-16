import type { StaticTraversalQuery } from "../navigation/static-router";
import type { MotionIntent, WorldSnapshot } from "../world/types";
import {
  A1RelationshipObserver,
  type A1RelationshipObserverDebug
} from "./a1-relationship-observer";
import type { A1RelationshipOrientationEvidence } from "./a1-relationship-orientation";
import { cloneA1Situation, type A1Situation } from "./a1-situation";

export const A1_AUTHORITY_VARIANTS = ["off", "direct", "temporal"] as const;
export type A1AuthorityVariant = (typeof A1_AUTHORITY_VARIANTS)[number];

export interface A1ObservationErrorEvidence {
  tick: number;
  message: string;
}

export interface A1AuthorityRuntimeDebug {
  variant: A1AuthorityVariant;
  epoch: number;
  passThroughSteps: number;
  latestSituation: A1Situation | null;
  relationshipObservation: A1RelationshipObserverDebug;
  relationshipObservationError: A1ObservationErrorEvidence | null;
}

/**
 * A1 owns experimental observation/history independently from actuator authority.
 * DIRECT/TEMPORAL deliberately pass the baseline companion intent through unchanged
 * until a later stage qualifies a complete coordination policy for movement authority.
 */
export class A1AuthorityRuntime {
  private variantValue: A1AuthorityVariant = "off";
  private epochValue = 0;
  private passThroughStepsValue = 0;
  private latestSituationValue: A1Situation | null = null;
  private readonly relationshipObserver = new A1RelationshipObserver();
  private relationshipObservationErrorValue: A1ObservationErrorEvidence | null = null;

  variant(): A1AuthorityVariant {
    return this.variantValue;
  }

  enabled(): boolean {
    return this.variantValue !== "off";
  }

  cycleVariant(): { previous: A1AuthorityVariant; next: A1AuthorityVariant } {
    const index = A1_AUTHORITY_VARIANTS.indexOf(this.variantValue);
    const next = A1_AUTHORITY_VARIANTS[(index + 1) % A1_AUTHORITY_VARIANTS.length] ?? "off";
    const previous = this.variantValue;
    this.setVariant(next);
    return { previous, next };
  }

  setVariant(next: A1AuthorityVariant): void {
    if (next === this.variantValue) return;
    this.variantValue = next;
    this.resetOwnedState();
  }

  resetOwnedState(): void {
    this.epochValue += 1;
    this.passThroughStepsValue = 0;
    this.latestSituationValue = null;
    this.relationshipObserver.reset();
    this.relationshipObservationErrorValue = null;
  }

  /**
   * Passive A1.1 observation path. Failure is contained as tick-local research
   * evidence and cannot become control-flow authority over the companion command.
   * If multiple failures are accidentally reported in one World tick, preserve
   * the first causal failure rather than allowing a derivative error to overwrite it.
   */
  observeRelationship(input: {
    situation: A1Situation;
    snapshot: WorldSnapshot;
    query: StaticTraversalQuery;
  }): A1RelationshipObserverDebug | null {
    if (!this.enabled()) return null;

    try {
      const result = this.relationshipObserver.observe(input);
      this.relationshipObservationErrorValue = null;
      return result;
    } catch (error) {
      if (this.relationshipObservationErrorValue?.tick !== input.situation.tick) {
        this.relationshipObservationErrorValue = {
          tick: input.situation.tick,
          message: error instanceof Error ? error.message : String(error)
        };
      }
      return null;
    }
  }

  latestRelationshipOrientationEvidence(): A1RelationshipOrientationEvidence | null {
    return this.relationshipObserver.latestOrientationEvidence();
  }

  resolveCompanionIntent(input: {
    baselineIntent: MotionIntent;
    situation: A1Situation | null;
  }): MotionIntent {
    if (input.baselineIntent.actorId !== "companion") {
      throw new Error("A1 authority runtime can only wrap the companion MotionIntent.");
    }

    if (this.variantValue === "off") {
      return {
        actorId: "companion",
        move: { ...input.baselineIntent.move }
      };
    }

    if (!input.situation) {
      throw new Error(`A1 ${this.variantValue.toUpperCase()} requires a decision-time A1Situation.`);
    }

    this.latestSituationValue = cloneA1Situation(input.situation);
    this.passThroughStepsValue += 1;

    return {
      actorId: "companion",
      move: { ...input.baselineIntent.move }
    };
  }

  debugState(): A1AuthorityRuntimeDebug {
    return {
      variant: this.variantValue,
      epoch: this.epochValue,
      passThroughSteps: this.passThroughStepsValue,
      latestSituation: this.latestSituationValue ? cloneA1Situation(this.latestSituationValue) : null,
      relationshipObservation: this.relationshipObserver.debugState(),
      relationshipObservationError: this.relationshipObservationErrorValue
        ? { ...this.relationshipObservationErrorValue }
        : null
    };
  }
}
