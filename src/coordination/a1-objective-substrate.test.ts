import { describe, expect, it } from "vitest";
import type { ActorSnapshot, StaticCircleTraversalResult, Vec2, WorldSnapshot } from "../world/types";
import { buildA1AccessibilityEvidence } from "./a1-accessibility-fragments";
import type { A1RelationshipOrientationEvidence } from "./a1-relationship-orientation";
import { projectA1RelationshipSemanticField } from "./a1-relationship-projection";
import {
  A1_DEFAULT_RELATIONSHIP_OBJECTIVE,
  evaluateA1RelationshipUtility,
  sampleA1RelationshipSemanticField,
  type A1RelationshipObjectiveProfile,
  type A1RelationshipSamplingConfig
} from "./a1-relationship-utility";

function actor(id: "player" | "companion", position: Vec2): ActorSnapshot {
  return {
    id,
    position: { ...position },
    radius: 0.3,
    requestedVelocity: { x: 0, y: 0 },
    actualVelocity: { x: 0, y: 0 },
    motionError: 0,
    contacts: []
  };
}

function world(tick: number): WorldSnapshot {
  return {
    tick,
    scenarioId: "open",
    width: 40,
    height: 32,
    actors: [
      actor("player", { x: 20, y: 16 }),
      actor("companion", { x: 15, y: 16 })
    ],
    obstacles: []
  };
}

function ownerOrientation(tick: number): A1RelationshipOrientationEvidence {
  return {
    tick,
    source: "SAME_STEP_OWNER",
    direction: { x: 1, y: 0 },
    sourceTick: tick,
    ageTicks: 0,
    strength: 1,
    samplingBasis: { x: 1, y: 0 },
    samplingBasisSource: "SEMANTIC_ORIENTATION",
    nextMemory: {
      provenance: "OWNER_CONTROL",
      direction: { x: 1, y: 0 },
      sourceTick: tick,
      sourceStrength: 1
    },
    reason: "A1.1e owner-oriented objective fixture"
  };
}

function noOrientation(tick: number): A1RelationshipOrientationEvidence {
  return {
    tick,
    source: "NONE",
    direction: null,
    sourceTick: null,
    ageTicks: null,
    strength: 0,
    samplingBasis: { x: 1, y: 0 },
    samplingBasisSource: "WORLD_AXIS_SAMPLING_ONLY",
    nextMemory: null,
    reason: "A1.1e directionless objective fixture"
  };
}

function clearTraversal(from: Vec2, to: Vec2, radius: number): StaticCircleTraversalResult {
  return {
    from: { ...from },
    to: { ...to },
    radius,
    distance: Math.hypot(to.x - from.x, to.y - from.y),
    clear: true,
    blocker: null
  };
}

const COMMON_SAMPLING: A1RelationshipSamplingConfig = {
  directions: 16,
  radii: [1.2, 1.8, 2.4],
  nearBestUtilityWindow: 0.12
};

const LATERAL_OBJECTIVE: A1RelationshipObjectiveProfile = {
  radial: { preferredRadius: 1.8, sigma: 0.32, weight: 1 },
  directional: {
    kind: "PREFER_BEARING",
    preferredBearingRadians: Math.PI / 2,
    sigmaRadians: Math.PI / 10,
    weight: 2
  }
};

function fullObservation(input: {
  tick: number;
  objective: A1RelationshipObjectiveProfile;
  orientation: A1RelationshipOrientationEvidence;
}) {
  const field = sampleA1RelationshipSemanticField({
    orientation: input.orientation,
    objective: input.objective,
    sampling: COMMON_SAMPLING
  });
  const projection = projectA1RelationshipSemanticField({
    field,
    snapshot: world(input.tick),
    query: clearTraversal,
    routeBudget: 1000,
    routeQualificationStrategy: "STRATIFIED_COVERAGE"
  });
  const accessibility = buildA1AccessibilityEvidence({ field, projection });
  return { field, projection, accessibility };
}

describe("Authority-A1.1e objective-space anti-hardcoding", () => {
  it("runs a lateral preferred-bearing objective through the same semantic/projection/accessibility pipeline", () => {
    const tick = 80;
    const followLike = fullObservation({
      tick,
      objective: A1_DEFAULT_RELATIONSHIP_OBJECTIVE,
      orientation: ownerOrientation(tick)
    });
    const lateral = fullObservation({
      tick,
      objective: LATERAL_OBJECTIVE,
      orientation: ownerOrientation(tick)
    });

    expect(lateral.field.objective.directional.kind).toBe("PREFER_BEARING");
    expect(lateral.field.sampling).toEqual(COMMON_SAMPLING);
    expect(lateral.field.semanticEligibleSampleIds).not.toEqual(followLike.field.semanticEligibleSampleIds);
    expect(lateral.projection.routeCoverageComplete).toBe(true);
    expect(lateral.projection.counts.hardReachable).toBe(lateral.projection.counts.routeCandidates);
    expect(lateral.accessibility.coverage).toBe("COMPLETE");
    expect(lateral.accessibility.fragments.length).toBeGreaterThan(0);

    const preferred = lateral.field.samples.find((sample) => sample.id === "r1.b4");
    expect(preferred).toBeDefined();
    expect(preferred?.utility.totalUtility).toBeCloseTo(1, 12);
    expect(preferred?.utility.relativeBearingRadians).toBeCloseTo(Math.PI / 2, 12);
    expect(preferred?.semanticEligible).toBe(true);

    const direct = evaluateA1RelationshipUtility({
      state: { relativeOffset: preferred!.relativeOffset },
      orientation: ownerOrientation(tick),
      objective: LATERAL_OBJECTIVE
    });
    expect(direct.totalUtility).toBeCloseTo(preferred!.utility.totalUtility, 12);
  });

  it("does not turn the non-semantic world-axis sampling basis into lateral meaning when orientation is absent", () => {
    const tick = 90;
    const field = sampleA1RelationshipSemanticField({
      orientation: noOrientation(tick),
      objective: LATERAL_OBJECTIVE,
      sampling: COMMON_SAMPLING
    });

    const sameRadius = field.samples.filter((sample) => sample.radiusIndex === 1);
    expect(sameRadius).toHaveLength(COMMON_SAMPLING.directions);
    const baseline = sameRadius[0]?.utility.totalUtility;
    expect(baseline).toBeDefined();
    for (const sample of sameRadius) {
      expect(sample.utility.directionalSemanticsActive).toBe(false);
      expect(sample.utility.relativeBearingRadians).toBeNull();
      expect(sample.utility.totalUtility).toBeCloseTo(baseline!, 12);
    }
  });

  it("keeps direct objective meaning invariant when only the observation mesh changes", () => {
    const orientation = ownerOrientation(100);
    const state = { relativeOffset: { x: -0.7, y: 1.55 } };
    const directBefore = evaluateA1RelationshipUtility({
      state,
      orientation,
      objective: LATERAL_OBJECTIVE
    });
    const coarse: A1RelationshipSamplingConfig = {
      directions: 8,
      radii: [1.2, 1.8, 2.4],
      nearBestUtilityWindow: 0.2
    };
    const dense: A1RelationshipSamplingConfig = {
      directions: 64,
      radii: [1.0, 1.4, 1.8, 2.2, 2.6],
      nearBestUtilityWindow: 0.05
    };
    const coarseField = sampleA1RelationshipSemanticField({
      orientation,
      objective: LATERAL_OBJECTIVE,
      sampling: coarse
    });
    const denseField = sampleA1RelationshipSemanticField({
      orientation,
      objective: LATERAL_OBJECTIVE,
      sampling: dense
    });
    const directAfter = evaluateA1RelationshipUtility({
      state,
      orientation,
      objective: LATERAL_OBJECTIVE
    });

    expect(directAfter).toEqual(directBefore);
    expect(coarseField.samples).toHaveLength(8 * 3);
    expect(denseField.samples).toHaveLength(64 * 5);
    expect(coarseField.objective).toEqual(denseField.objective);
    expect(coarseField.sampling).not.toEqual(denseField.sampling);
  });
});
