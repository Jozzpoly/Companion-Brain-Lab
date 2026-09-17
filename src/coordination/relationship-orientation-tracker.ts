import {
  evaluateA1RelationshipOrientation,
  type A1RelationshipOrientationEvidence,
  type A1RelationshipOrientationMemory
} from "./a1-relationship-orientation";
import type { A1Situation } from "./a1-situation";

function cloneMemory(
  value: A1RelationshipOrientationMemory | null
): A1RelationshipOrientationMemory | null {
  return value
    ? {
        provenance: "OWNER_CONTROL",
        direction: { ...value.direction },
        sourceTick: value.sourceTick,
        sourceStrength: value.sourceStrength
      }
    : null;
}

function cloneEvidence(value: A1RelationshipOrientationEvidence): A1RelationshipOrientationEvidence {
  return {
    tick: value.tick,
    source: value.source,
    direction: value.direction ? { ...value.direction } : null,
    sourceTick: value.sourceTick,
    ageTicks: value.ageTicks,
    strength: value.strength,
    samplingBasis: { ...value.samplingBasis },
    samplingBasisSource: value.samplingBasisSource,
    nextMemory: cloneMemory(value.nextMemory),
    reason: value.reason
  };
}

/**
 * Canonical runtime owner of relationship-orientation continuity.
 *
 * This tracker is deliberately independent from A1 movement-authority variants.
 * It turns same-step Owner control into bounded semantic evidence once per World
 * tick so baseline relationship reasoning and optional A1 research can consume
 * the same truth. Body/solver motion is intentionally absent from this contract.
 */
export class RelationshipOrientationTracker {
  private memoryValue: A1RelationshipOrientationMemory | null = null;
  private latestValue: A1RelationshipOrientationEvidence | null = null;
  private lastTickValue: number | null = null;

  reset(): void {
    this.memoryValue = null;
    this.latestValue = null;
    this.lastTickValue = null;
  }

  observe(situation: A1Situation): A1RelationshipOrientationEvidence {
    if (this.lastTickValue !== null && situation.tick <= this.lastTickValue) {
      throw new Error(
        `Relationship orientation tracker must strictly advance World time: attempted t${situation.tick} after t${this.lastTickValue}.`
      );
    }

    const evidence = evaluateA1RelationshipOrientation({
      situation,
      memory: this.memoryValue
    });
    this.memoryValue = cloneMemory(evidence.nextMemory);
    this.latestValue = cloneEvidence(evidence);
    this.lastTickValue = situation.tick;
    return cloneEvidence(evidence);
  }

  latestEvidence(): A1RelationshipOrientationEvidence | null {
    return this.latestValue ? cloneEvidence(this.latestValue) : null;
  }
}
