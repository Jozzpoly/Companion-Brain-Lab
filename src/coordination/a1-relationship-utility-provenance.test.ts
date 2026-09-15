import { describe, expect, it } from "vitest";
import type { A1RelationshipOrientationEvidence } from "./a1-relationship-orientation";
import {
  evaluateA1RelationshipUtility,
  sampleA1RelationshipSemanticField
} from "./a1-relationship-utility";

function rememberedOrientation(): A1RelationshipOrientationEvidence {
  return {
    tick: 10,
    source: "OWNER_MEMORY",
    direction: { x: 1, y: 0 },
    sourceTick: 4,
    ageTicks: 6,
    strength: 0.72,
    samplingBasis: { x: 1, y: 0 },
    samplingBasisSource: "SEMANTIC_ORIENTATION",
    nextMemory: {
      provenance: "OWNER_CONTROL",
      direction: { x: 1, y: 0 },
      sourceTick: 4,
      sourceStrength: 1
    },
    reason: "remembered test orientation"
  };
}

describe("Authority-A1.1b semantic field provenance", () => {
  it("carries decision tick and original Owner orientation age into the sampled field", () => {
    const orientation = rememberedOrientation();
    const field = sampleA1RelationshipSemanticField({ orientation });

    expect(field.sourceTick).toBe(10);
    expect(field.orientationSource).toBe("OWNER_MEMORY");
    expect(field.orientationSourceTick).toBe(4);
    expect(field.orientationAgeTicks).toBe(6);
    expect(field.orientationStrength).toBeCloseTo(0.72, 12);
  });

  it("rejects internally inconsistent semantic orientation age before utility can consume it", () => {
    const orientation = rememberedOrientation();
    orientation.ageTicks = 5;

    expect(() => evaluateA1RelationshipUtility({
      state: { relativeOffset: { x: -1.45, y: 0 } },
      orientation
    })).toThrow(/aligned source\/age provenance/);
  });

  it("rejects hidden semantic provenance on NONE orientation", () => {
    const orientation: A1RelationshipOrientationEvidence = {
      tick: 10,
      source: "NONE",
      direction: null,
      sourceTick: 4,
      ageTicks: 6,
      strength: 0,
      samplingBasis: { x: 1, y: 0 },
      samplingBasisSource: "WORLD_AXIS_SAMPLING_ONLY",
      nextMemory: null,
      reason: "malformed none orientation"
    };

    expect(() => sampleA1RelationshipSemanticField({ orientation }))
      .toThrow(/NONE orientation must be semantically directionless/);
  });
});
