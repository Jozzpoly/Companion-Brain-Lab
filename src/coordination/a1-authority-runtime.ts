import type { MotionIntent } from "../world/types";
import { cloneA1Situation, type A1Situation } from "./a1-situation";

export const A1_AUTHORITY_VARIANTS = ["off", "direct", "temporal"] as const;
export type A1AuthorityVariant = (typeof A1_AUTHORITY_VARIANTS)[number];

export interface A1AuthorityRuntimeDebug {
  variant: A1AuthorityVariant;
  epoch: number;
  passThroughSteps: number;
  latestSituation: A1Situation | null;
}

/**
 * A1.0 owns only selection/isolation/history plumbing.
 * DIRECT/TEMPORAL deliberately pass the baseline companion intent through unchanged
 * until A1.1 installs the first new coordination policy.
 */
export class A1AuthorityRuntime {
  private variantValue: A1AuthorityVariant = "off";
  private epochValue = 0;
  private passThroughStepsValue = 0;
  private latestSituationValue: A1Situation | null = null;

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
      latestSituation: this.latestSituationValue ? cloneA1Situation(this.latestSituationValue) : null
    };
  }
}
