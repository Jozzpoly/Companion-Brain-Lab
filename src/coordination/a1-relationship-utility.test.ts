import { describe, expect, it } from "vitest";
import type { Vec2 } from "../world/types";
import type { A1RelationshipOrientationEvidence } from "./a1-relationship-orientation";
import {
  A1_DEFAULT_RELATIONSHIP_PROFILE,
  evaluateA1RelationshipUtility,
  sampleA1RelationshipSemanticField,
  type A1RelationshipSemanticProfile
} from "./a1-relationship-utility";

function semanticOrientation(direction: Vec2, strength = 1): A1RelationshipOrientationEvidence {
  const length = Math.hypot(direction.x, direction.y);
  const unit = { x: direction.x / length, y: direction.y / length };
  return {
    tick: 0,
    source: "SAME_STEP_OWNER",
    direction: unit,
    sourceTick: 0,
    ageTicks: 0,
    strength,
    samplingBasis: { ...unit },
    samplingBasisSource: "SEMANTIC_ORIENTATION",
    nextMemory: {
      provenance: "OWNER_CONTROL",
      direction: { ...unit },
      sourceTick: 0,
      sourceStrength: strength
    },
    reason: "test semantic orientation"
  };
}

function noOrientation(): A1RelationshipOrientationEvidence {
  return {
    tick: 0,
    source: "NONE",
    direction: null,
    sourceTick: null,
    ageTicks: null,
    strength: 0,
    samplingBasis: { x: 1, y: 0 },
    samplingBasisSource: "WORLD_AXIS_SAMPLING_ONLY",
    nextMemory: null,
    reason: "test orientation none"
  };
}

function rotate90(value: Vec2): Vec2 {
  return { x: -value.y, y: value.x };
}

function sampleById(field: ReturnType<typeof sampleA1RelationshipSemanticField>, id: string) {
  const result = field.samples.find((sample) => sample.id === id);
  if (!result) throw new Error(`missing sample ${id}`);
  return result;
}

describe("Authority-A1.1b pure relationship utility", () => {
  it("makes radial meaning independent of absolute world state when semantic orientation is absent", () => {
    const preferred = A1_DEFAULT_RELATIONSHIP_PROFILE.preferredRadius;
    const sigma = A1_DEFAULT_RELATIONSHIP_PROFILE.radialSigma;
    const orientation = noOrientation();

    const atPreferred = evaluateA1RelationshipUtility({
      state: { relativeOffset: { x: preferred, y: 0 } },
      orientation
    });
    const rotatedPreferred = evaluateA1RelationshipUtility({
      state: { relativeOffset: { x: 0, y: -preferred } },
      orientation
    });
    const oneSigmaAway = evaluateA1RelationshipUtility({
      state: { relativeOffset: { x: preferred + sigma, y: 0 } },
      orientation
    });

    expect(atPreferred.radius).toBeCloseTo(preferred, 12);
    expect(atPreferred.radialUtility).toBeCloseTo(1, 12);
    expect(atPreferred.totalUtility).toBeCloseTo(1, 12);
    expect(atPreferred.directionalSemanticsActive).toBe(false);
    expect(atPreferred.frontness).toBeNull();
    expect(atPreferred.directionalUtility).toBeNull();
    expect(rotatedPreferred.totalUtility).toBeCloseTo(atPreferred.totalUtility, 12);
    expect(oneSigmaAway.radialUtility).toBeCloseTo(Math.exp(-0.5), 12);
    expect(oneSigmaAway.totalUtility).toBeCloseTo(oneSigmaAway.radialUtility, 12);
  });

  it("penalizes only the forward hemisphere and keeps side/back useful under full Owner orientation", () => {
    const radius = A1_DEFAULT_RELATIONSHIP_PROFILE.preferredRadius;
    const orientation = semanticOrientation({ x: 1, y: 0 });
    const front = evaluateA1RelationshipUtility({
      state: { relativeOffset: { x: radius, y: 0 } },
      orientation
    });
    const side = evaluateA1RelationshipUtility({
      state: { relativeOffset: { x: 0, y: radius } },
      orientation
    });
    const back = evaluateA1RelationshipUtility({
      state: { relativeOffset: { x: -radius, y: 0 } },
      orientation
    });

    expect(front.frontness).toBeCloseTo(1, 12);
    expect(front.directionalUtility).toBeCloseTo(0, 12);
    expect(front.totalUtility).toBeLessThan(side.totalUtility);
    expect(side.frontness).toBeCloseTo(0, 12);
    expect(side.directionalUtility).toBeCloseTo(1, 12);
    expect(side.totalUtility).toBeCloseTo(1, 12);
    expect(back.frontness).toBeCloseTo(0, 12);
    expect(back.directionalUtility).toBeCloseTo(1, 12);
    expect(back.totalUtility).toBeCloseTo(1, 12);
  });

  it("lets low-strength Owner orientation influence utility continuously instead of acting like full facing", () => {
    const radius = A1_DEFAULT_RELATIONSHIP_PROFILE.preferredRadius;
    const weak = evaluateA1RelationshipUtility({
      state: { relativeOffset: { x: radius, y: 0 } },
      orientation: semanticOrientation({ x: 1, y: 0 }, 0.04)
    });
    const full = evaluateA1RelationshipUtility({
      state: { relativeOffset: { x: radius, y: 0 } },
      orientation: semanticOrientation({ x: 1, y: 0 }, 1)
    });
    const none = evaluateA1RelationshipUtility({
      state: { relativeOffset: { x: radius, y: 0 } },
      orientation: noOrientation()
    });

    expect(weak.effectiveDirectionalWeight).toBeCloseTo(0.04, 12);
    expect(weak.totalUtility).toBeGreaterThan(full.totalUtility);
    expect(weak.totalUtility).toBeLessThan(none.totalUtility);
    expect(weak.totalUtility).toBeCloseTo(1 / 1.04, 12);
  });

  it("is rotation-covariant for arbitrary relative states when orientation rotates with them", () => {
    const offset = { x: 0.61, y: -1.17 };
    const rotatedOffset = rotate90(offset);
    const a = evaluateA1RelationshipUtility({
      state: { relativeOffset: offset },
      orientation: semanticOrientation({ x: 1, y: 0 }, 0.63)
    });
    const b = evaluateA1RelationshipUtility({
      state: { relativeOffset: rotatedOffset },
      orientation: semanticOrientation({ x: 0, y: 1 }, 0.63)
    });

    expect(b.radius).toBeCloseTo(a.radius, 12);
    expect(b.radialUtility).toBeCloseTo(a.radialUtility, 12);
    expect(b.frontness).toBeCloseTo(a.frontness ?? 0, 12);
    expect(b.directionalUtility).toBeCloseTo(a.directionalUtility ?? 0, 12);
    expect(b.effectiveDirectionalWeight).toBeCloseTo(a.effectiveDirectionalWeight, 12);
    expect(b.totalUtility).toBeCloseTo(a.totalUtility, 12);
  });

  it("samples the semantic function rather than introducing a separate point-target score", () => {
    const field = sampleA1RelationshipSemanticField({
      orientation: semanticOrientation({ x: 1, y: 0 })
    });

    expect(field.samples).toHaveLength(32 * 3);
    expect(new Set(field.samples.map((sample) => sample.id)).size).toBe(field.samples.length);
    expect(field.semanticEligibleSampleIds.length).toBeGreaterThan(0);
    expect(field.bestUtility).toBeCloseTo(1, 12);
    expect(field.nearBestUtilityFloor).toBeCloseTo(
      field.bestUtility - A1_DEFAULT_RELATIONSHIP_PROFILE.nearBestUtilityWindow,
      12
    );

    for (const sample of field.samples) {
      const direct = evaluateA1RelationshipUtility({
        state: { relativeOffset: sample.relativeOffset },
        orientation: semanticOrientation({ x: 1, y: 0 })
      });
      expect(sample.utility.totalUtility).toBeCloseTo(direct.totalUtility, 12);
      expect(sample.semanticEligible).toBe(
        field.semanticEligibleSampleIds.includes(sample.id)
      );
    }

    const frontPreferred = sampleById(field, "r1.b0");
    const sidePreferred = sampleById(field, "r1.b8");
    const backPreferred = sampleById(field, "r1.b16");
    expect(frontPreferred.utility.totalUtility).toBeLessThan(sidePreferred.utility.totalUtility);
    expect(sidePreferred.utility.totalUtility).toBeCloseTo(1, 12);
    expect(backPreferred.utility.totalUtility).toBeCloseTo(1, 12);
  });

  it("rotates sampled offsets with semantic orientation while preserving sample-id utility structure", () => {
    const xField = sampleA1RelationshipSemanticField({
      orientation: semanticOrientation({ x: 1, y: 0 }, 0.72)
    });
    const yField = sampleA1RelationshipSemanticField({
      orientation: semanticOrientation({ x: 0, y: 1 }, 0.72)
    });

    expect(yField.samples.map((sample) => sample.id)).toEqual(xField.samples.map((sample) => sample.id));
    expect(yField.semanticEligibleSampleIds).toEqual(xField.semanticEligibleSampleIds);

    for (const xSample of xField.samples) {
      const ySample = sampleById(yField, xSample.id);
      const rotated = rotate90(xSample.relativeOffset);
      expect(ySample.relativeOffset.x).toBeCloseTo(rotated.x, 12);
      expect(ySample.relativeOffset.y).toBeCloseTo(rotated.y, 12);
      expect(ySample.utility.totalUtility).toBeCloseTo(xSample.utility.totalUtility, 12);
      expect(ySample.utility.radialUtility).toBeCloseTo(xSample.utility.radialUtility, 12);
      expect(ySample.utility.frontness).toBeCloseTo(xSample.utility.frontness ?? 0, 12);
    }
  });

  it("keeps the world-axis lattice explicitly non-semantic when orientation is NONE", () => {
    const field = sampleA1RelationshipSemanticField({ orientation: noOrientation() });
    expect(field.orientationSource).toBe("NONE");
    expect(field.orientationStrength).toBe(0);
    expect(field.samplingBasis).toEqual({ x: 1, y: 0 });
    expect(field.samplingBasisSource).toBe("WORLD_AXIS_SAMPLING_ONLY");

    const front = sampleById(field, "r1.b0");
    const side = sampleById(field, "r1.b8");
    const back = sampleById(field, "r1.b16");
    expect(front.utility.directionalSemanticsActive).toBe(false);
    expect(side.utility.directionalSemanticsActive).toBe(false);
    expect(back.utility.directionalSemanticsActive).toBe(false);
    expect(front.utility.totalUtility).toBeCloseTo(side.utility.totalUtility, 12);
    expect(front.utility.totalUtility).toBeCloseTo(back.utility.totalUtility, 12);
  });

  it("keeps semantic policy parameters explicit and replaceable rather than burying them in the evaluator", () => {
    const custom: A1RelationshipSemanticProfile = {
      preferredRadius: 2,
      radialSigma: 0.25,
      radialWeight: 2,
      directionalWeight: 0,
      sampleDirections: 8,
      sampleRadii: [1, 2, 3],
      nearBestUtilityWindow: 0.1
    };
    const orientation = semanticOrientation({ x: 1, y: 0 });
    const front = evaluateA1RelationshipUtility({
      state: { relativeOffset: { x: 2, y: 0 } },
      orientation,
      profile: custom
    });
    const back = evaluateA1RelationshipUtility({
      state: { relativeOffset: { x: -2, y: 0 } },
      orientation,
      profile: custom
    });
    const field = sampleA1RelationshipSemanticField({ orientation, profile: custom });

    expect(front.radialUtility).toBeCloseTo(1, 12);
    expect(front.totalUtility).toBeCloseTo(1, 12);
    expect(back.totalUtility).toBeCloseTo(front.totalUtility, 12);
    expect(front.effectiveDirectionalWeight).toBe(0);
    expect(field.samples).toHaveLength(8 * 3);
    expect(field.sampleDirections).toBe(8);
    expect(field.sampleRadii).toEqual([1, 2, 3]);
  });

  it("rejects semantic-orientation/basis divergence and malformed profile data", () => {
    const malformed = semanticOrientation({ x: 1, y: 0 });
    malformed.samplingBasis = { x: 0, y: 1 };

    expect(() => evaluateA1RelationshipUtility({
      state: { relativeOffset: { x: 1, y: 0 } },
      orientation: malformed
    })).toThrow(/sampling basis must align/);

    expect(() => sampleA1RelationshipSemanticField({
      orientation: noOrientation(),
      profile: {
        ...A1_DEFAULT_RELATIONSHIP_PROFILE,
        sampleDirections: 3
      }
    })).toThrow(/at least four sample directions/);
  });
});
