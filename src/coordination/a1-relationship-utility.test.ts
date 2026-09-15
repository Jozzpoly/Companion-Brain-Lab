import { describe, expect, it } from "vitest";
import type { Vec2 } from "../world/types";
import type { A1RelationshipOrientationEvidence } from "./a1-relationship-orientation";
import {
  A1_DEFAULT_RELATIONSHIP_OBJECTIVE,
  A1_DEFAULT_RELATIONSHIP_SAMPLING,
  evaluateA1RelationshipUtility,
  sampleA1RelationshipSemanticField,
  type A1RelationshipObjectiveProfile,
  type A1RelationshipSamplingConfig
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

describe("Authority-A1.1 pure relationship objective utility", () => {
  it("makes radial meaning independent of absolute world state when semantic orientation is absent", () => {
    const preferred = A1_DEFAULT_RELATIONSHIP_OBJECTIVE.radial.preferredRadius;
    const sigma = A1_DEFAULT_RELATIONSHIP_OBJECTIVE.radial.sigma;
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

  it("preserves the first follow-like hypothesis as an explicit forward-avoidance objective", () => {
    const radius = A1_DEFAULT_RELATIONSHIP_OBJECTIVE.radial.preferredRadius;
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

    expect(front.directionalObjectiveKind).toBe("AVOID_FORWARD_HEMISPHERE");
    expect(front.frontness).toBeCloseTo(1, 12);
    expect(front.directionalUtility).toBeCloseTo(0, 12);
    expect(front.totalUtility).toBeLessThan(side.totalUtility);
    expect(side.frontness).toBeCloseTo(0, 12);
    expect(side.directionalUtility).toBeCloseTo(1, 12);
    expect(side.totalUtility).toBeCloseTo(1, 12);
    expect(back.totalUtility).toBeCloseTo(1, 12);
  });

  it("lets low-strength Owner orientation influence utility continuously instead of acting like full facing", () => {
    const radius = A1_DEFAULT_RELATIONSHIP_OBJECTIVE.radial.preferredRadius;
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
    expect(b.relativeBearingRadians).toBeCloseTo(a.relativeBearingRadians ?? 0, 12);
    expect(b.effectiveDirectionalWeight).toBeCloseTo(a.effectiveDirectionalWeight, 12);
    expect(b.totalUtility).toBeCloseTo(a.totalUtility, 12);
  });

  it("samples the same semantic objective instead of introducing a second point-target score", () => {
    const orientation = semanticOrientation({ x: 1, y: 0 });
    const field = sampleA1RelationshipSemanticField({ orientation });

    expect(field.samples).toHaveLength(
      A1_DEFAULT_RELATIONSHIP_SAMPLING.directions * A1_DEFAULT_RELATIONSHIP_SAMPLING.radii.length
    );
    expect(new Set(field.samples.map((sample) => sample.id)).size).toBe(field.samples.length);
    expect(field.semanticEligibleSampleIds.length).toBeGreaterThan(0);
    expect(field.bestUtility).toBeCloseTo(1, 12);
    expect(field.nearBestUtilityFloor).toBeCloseTo(
      field.bestUtility - A1_DEFAULT_RELATIONSHIP_SAMPLING.nearBestUtilityWindow,
      12
    );

    for (const sample of field.samples) {
      const direct = evaluateA1RelationshipUtility({
        state: { relativeOffset: sample.relativeOffset },
        orientation
      });
      expect(sample.utility.totalUtility).toBeCloseTo(direct.totalUtility, 12);
      expect(sample.semanticEligible).toBe(field.semanticEligibleSampleIds.includes(sample.id));
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

  it("lets objective semantics and observation sampling vary independently", () => {
    const objective: A1RelationshipObjectiveProfile = {
      radial: { preferredRadius: 2, sigma: 0.25, weight: 2 },
      directional: { kind: "NONE" }
    };
    const sparseSampling: A1RelationshipSamplingConfig = {
      directions: 8,
      radii: [1, 2, 3],
      nearBestUtilityWindow: 0.1
    };
    const denseSampling: A1RelationshipSamplingConfig = {
      directions: 24,
      radii: [1.5, 2, 2.5],
      nearBestUtilityWindow: 0.05
    };
    const orientation = semanticOrientation({ x: 1, y: 0 });
    const front = evaluateA1RelationshipUtility({
      state: { relativeOffset: { x: 2, y: 0 } },
      orientation,
      objective
    });
    const back = evaluateA1RelationshipUtility({
      state: { relativeOffset: { x: -2, y: 0 } },
      orientation,
      objective
    });
    const sparse = sampleA1RelationshipSemanticField({ orientation, objective, sampling: sparseSampling });
    const dense = sampleA1RelationshipSemanticField({ orientation, objective, sampling: denseSampling });

    expect(front.totalUtility).toBeCloseTo(1, 12);
    expect(back.totalUtility).toBeCloseTo(front.totalUtility, 12);
    expect(front.effectiveDirectionalWeight).toBe(0);
    expect(sparse.samples).toHaveLength(8 * 3);
    expect(dense.samples).toHaveLength(24 * 3);
    expect(sparse.objective).toEqual(dense.objective);
    expect(sparse.sampling).not.toEqual(dense.sampling);
    expect(sparse.sampleDirections).toBe(8);
    expect(dense.sampleDirections).toBe(24);
  });

  it("expresses a materially different lateral preferred-bearing objective without role-name branches", () => {
    const lateralObjective: A1RelationshipObjectiveProfile = {
      radial: { preferredRadius: 1.8, sigma: 0.3, weight: 1 },
      directional: {
        kind: "PREFER_BEARING",
        preferredBearingRadians: Math.PI / 2,
        sigmaRadians: Math.PI / 8,
        weight: 2
      }
    };
    const orientationX = semanticOrientation({ x: 1, y: 0 });
    const preferred = evaluateA1RelationshipUtility({
      state: { relativeOffset: { x: 0, y: 1.8 } },
      orientation: orientationX,
      objective: lateralObjective
    });
    const forward = evaluateA1RelationshipUtility({
      state: { relativeOffset: { x: 1.8, y: 0 } },
      orientation: orientationX,
      objective: lateralObjective
    });
    const oppositeSide = evaluateA1RelationshipUtility({
      state: { relativeOffset: { x: 0, y: -1.8 } },
      orientation: orientationX,
      objective: lateralObjective
    });
    const rotatedPreferred = evaluateA1RelationshipUtility({
      state: { relativeOffset: { x: -1.8, y: 0 } },
      orientation: semanticOrientation({ x: 0, y: 1 }),
      objective: lateralObjective
    });

    expect(preferred.directionalObjectiveKind).toBe("PREFER_BEARING");
    expect(preferred.relativeBearingRadians).toBeCloseTo(Math.PI / 2, 12);
    expect(preferred.directionalUtility).toBeCloseTo(1, 12);
    expect(preferred.totalUtility).toBeCloseTo(1, 12);
    expect(forward.totalUtility).toBeLessThan(preferred.totalUtility);
    expect(oppositeSide.totalUtility).toBeLessThan(forward.totalUtility);
    expect(rotatedPreferred.totalUtility).toBeCloseTo(preferred.totalUtility, 12);
  });

  it("rejects semantic-orientation/basis divergence and malformed objective or sampling data", () => {
    const malformed = semanticOrientation({ x: 1, y: 0 });
    malformed.samplingBasis = { x: 0, y: 1 };

    expect(() => evaluateA1RelationshipUtility({
      state: { relativeOffset: { x: 1, y: 0 } },
      orientation: malformed
    })).toThrow(/sampling basis must align/);

    expect(() => evaluateA1RelationshipUtility({
      state: { relativeOffset: { x: 1, y: 0 } },
      orientation: semanticOrientation({ x: 1, y: 0 }),
      objective: {
        radial: { preferredRadius: 1.5, sigma: 0.3, weight: 1 },
        directional: {
          kind: "PREFER_BEARING",
          preferredBearingRadians: 0,
          sigmaRadians: Math.PI * 2,
          weight: 1
        }
      }
    })).toThrow(/must not exceed PI/);

    expect(() => sampleA1RelationshipSemanticField({
      orientation: noOrientation(),
      sampling: {
        ...A1_DEFAULT_RELATIONSHIP_SAMPLING,
        directions: 3
      }
    })).toThrow(/at least four directions/);
  });
});
