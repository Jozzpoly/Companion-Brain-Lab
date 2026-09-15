import { describe, expect, it } from "vitest";
import type { ActorSnapshot, StaticCircleTraversalResult, Vec2, WorldSnapshot } from "../world/types";
import {
  buildA1AccessibilityEvidence,
  compareA1AccessibilityContinuity
} from "./a1-accessibility-fragments";
import type { A1RelationshipOrientationEvidence } from "./a1-relationship-orientation";
import {
  sampleA1RelationshipSemanticField,
  type A1RelationshipObjectiveProfile,
  type A1RelationshipSamplingConfig
} from "./a1-relationship-utility";
import { projectA1RelationshipSemanticField } from "./a1-relationship-projection";

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

function snapshot(input: {
  tick: number;
  player: Vec2;
  companion: Vec2;
}): WorldSnapshot {
  return {
    tick: input.tick,
    scenarioId: "open",
    width: 40,
    height: 32,
    actors: [actor("player", input.player), actor("companion", input.companion)],
    obstacles: []
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
    reason: "A1.1d directionless fixture"
  };
}

function semanticOrientation(tick: number, direction: Vec2): A1RelationshipOrientationEvidence {
  const length = Math.hypot(direction.x, direction.y);
  const unit = { x: direction.x / length, y: direction.y / length };
  return {
    tick,
    source: "SAME_STEP_OWNER",
    direction: unit,
    sourceTick: tick,
    ageTicks: 0,
    strength: 1,
    samplingBasis: { ...unit },
    samplingBasisSource: "SEMANTIC_ORIENTATION",
    nextMemory: {
      provenance: "OWNER_CONTROL",
      direction: { ...unit },
      sourceTick: tick,
      sourceStrength: 1
    },
    reason: "A1.1d directional fixture"
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

const RING_OBJECTIVE: A1RelationshipObjectiveProfile = {
  radial: { preferredRadius: 1.45, sigma: 0.3, weight: 1 },
  directional: { kind: "NONE" }
};

const DIRECTIONAL_OBJECTIVE: A1RelationshipObjectiveProfile = {
  radial: { preferredRadius: 1.45, sigma: 0.3, weight: 1 },
  directional: { kind: "AVOID_FORWARD_HEMISPHERE", weight: 1 }
};

const RING_SAMPLING: A1RelationshipSamplingConfig = {
  directions: 16,
  radii: [1.45],
  nearBestUtilityWindow: 0
};

const DIRECTIONAL_SAMPLING: A1RelationshipSamplingConfig = {
  directions: 16,
  radii: [1.45],
  nearBestUtilityWindow: 0.2
};

function observation(input: {
  tick: number;
  player: Vec2;
  companion: Vec2;
  orientation: A1RelationshipOrientationEvidence;
  objective?: A1RelationshipObjectiveProfile;
  sampling?: A1RelationshipSamplingConfig;
  budget?: number;
  strategy?: "SEMANTIC_PRIORITY" | "STRATIFIED_COVERAGE";
}) {
  const field = sampleA1RelationshipSemanticField({
    orientation: input.orientation,
    objective: input.objective ?? RING_OBJECTIVE,
    sampling: input.sampling ?? RING_SAMPLING
  });
  const projection = projectA1RelationshipSemanticField({
    field,
    snapshot: snapshot({ tick: input.tick, player: input.player, companion: input.companion }),
    query: clearTraversal,
    routeBudget: input.budget ?? 1000,
    routeQualificationStrategy: input.strategy ?? "SEMANTIC_PRIORITY"
  });
  const accessibility = buildA1AccessibilityEvidence({ field, projection });
  return { field, projection, accessibility };
}

describe("Authority-A1.1d sampled accessibility", () => {
  it("forms one complete confirmed fragment for a fully qualified open relative ring", () => {
    const result = observation({
      tick: 10,
      player: { x: 20, y: 16 },
      companion: { x: 15, y: 16 },
      orientation: noOrientation(10)
    });

    expect(result.accessibility.coverage).toBe("COMPLETE");
    expect(result.accessibility.confirmedReachableSampleIds).toHaveLength(16);
    expect(result.accessibility.untestedSampleIds).toEqual([]);
    expect(result.accessibility.potentialConnectorSampleIds).toEqual([]);
    expect(result.accessibility.fragments).toHaveLength(1);
    expect(result.accessibility.fragments[0]?.memberSampleIds).toHaveLength(16);
    expect(result.accessibility.fragments[0]?.representativeSampleId).toBe("r0.b0");
  });

  it("keeps partial coverage honest and identifies untested chains that could merge confirmed fragments", () => {
    const result = observation({
      tick: 20,
      player: { x: 20, y: 16 },
      companion: { x: 15, y: 16 },
      orientation: noOrientation(20),
      budget: 4,
      strategy: "STRATIFIED_COVERAGE"
    });

    expect(result.projection.routeEvaluatedSampleIds).toEqual([
      "r0.b0",
      "r0.b8",
      "r0.b4",
      "r0.b12"
    ]);
    expect(result.accessibility.coverage).toBe("PARTIAL");
    expect(result.accessibility.confirmedReachableSampleIds).toHaveLength(4);
    expect(result.accessibility.fragments).toHaveLength(4);
    expect(result.accessibility.fragments.every((fragment) => fragment.memberSampleIds.length === 1)).toBe(true);
    expect(result.accessibility.untestedSampleIds).toHaveLength(12);
    expect(result.accessibility.potentialConnectorSampleIds).toHaveLength(12);
    expect(new Set(result.accessibility.potentialConnectorSampleIds))
      .toEqual(new Set(result.accessibility.untestedSampleIds));
  });

  it("treats pure player+companion translation as stable relative accessibility rather than semantic churn", () => {
    const previous = observation({
      tick: 30,
      player: { x: 14, y: 12 },
      companion: { x: 9, y: 12 },
      orientation: noOrientation(30)
    });
    const shift = { x: 7, y: 5 };
    const current = observation({
      tick: 31,
      player: { x: 14 + shift.x, y: 12 + shift.y },
      companion: { x: 9 + shift.x, y: 12 + shift.y },
      orientation: noOrientation(31)
    });

    const continuity = compareA1AccessibilityContinuity({ previous, current });

    expect(continuity.orientationComparability).toBe("COMPARABLE");
    expect(continuity.semanticEligibleOverlapRatio).toBe(1);
    expect(continuity.confirmedReachableOverlapRatio).toBe(1);
    expect(continuity.accessibilityChanged).toBe(false);
    expect(continuity.fragmentMatches).toHaveLength(1);
    expect(continuity.fragmentMatches[0]?.overlapRatio).toBe(1);
    expect(continuity.playerTranslationDelta).toBeCloseTo(Math.hypot(shift.x, shift.y), 12);
    expect(continuity.fragmentMatches[0]?.representativeWorldDelta)
      .toBeCloseTo(Math.hypot(shift.x, shift.y), 12);
  });

  it("preserves relative identity across a 90-degree semantic-frame rotation in open space", () => {
    const center = { x: 20, y: 16 };
    const previous = observation({
      tick: 40,
      player: center,
      companion: { x: 16, y: 16 },
      orientation: semanticOrientation(40, { x: 1, y: 0 }),
      objective: DIRECTIONAL_OBJECTIVE,
      sampling: DIRECTIONAL_SAMPLING
    });
    const current = observation({
      tick: 41,
      player: center,
      companion: { x: 20, y: 12 },
      orientation: semanticOrientation(41, { x: 0, y: 1 }),
      objective: DIRECTIONAL_OBJECTIVE,
      sampling: DIRECTIONAL_SAMPLING
    });

    const continuity = compareA1AccessibilityContinuity({ previous, current });

    expect(continuity.orientationComparability).toBe("COMPARABLE");
    expect(continuity.semanticEligibleOverlapRatio).toBe(1);
    expect(continuity.confirmedReachableOverlapRatio).toBe(1);
    expect(continuity.accessibilityChanged).toBe(false);
    expect(continuity.fragmentMatches.length).toBeGreaterThan(0);
    expect(continuity.fragmentMatches.every((match) => match.overlapRatio === 1)).toBe(true);
  });

  it("marks directional-to-directionless semantics non-comparable rather than fabricating continuity", () => {
    const previous = observation({
      tick: 50,
      player: { x: 20, y: 16 },
      companion: { x: 16, y: 16 },
      orientation: semanticOrientation(50, { x: 1, y: 0 }),
      objective: DIRECTIONAL_OBJECTIVE,
      sampling: DIRECTIONAL_SAMPLING
    });
    const current = observation({
      tick: 51,
      player: { x: 20, y: 16 },
      companion: { x: 16, y: 16 },
      orientation: noOrientation(51),
      objective: DIRECTIONAL_OBJECTIVE,
      sampling: DIRECTIONAL_SAMPLING
    });

    const continuity = compareA1AccessibilityContinuity({ previous, current });

    expect(continuity.orientationComparability).toBe("NON_COMPARABLE");
    expect(continuity.semanticEligibleOverlapRatio).toBeNull();
    expect(continuity.confirmedReachableOverlapRatio).toBeNull();
    expect(continuity.fragmentMatches).toEqual([]);
    expect(continuity.accessibilityChanged).toBeNull();
  });

  it("refuses to declare accessibility changed while comparable observations still have partial route coverage", () => {
    const previous = observation({
      tick: 60,
      player: { x: 20, y: 16 },
      companion: { x: 15, y: 16 },
      orientation: noOrientation(60),
      budget: 4,
      strategy: "STRATIFIED_COVERAGE"
    });
    const current = observation({
      tick: 61,
      player: { x: 20, y: 16 },
      companion: { x: 15, y: 16 },
      orientation: noOrientation(61),
      budget: 5,
      strategy: "STRATIFIED_COVERAGE"
    });

    const continuity = compareA1AccessibilityContinuity({ previous, current });

    expect(continuity.orientationComparability).toBe("COMPARABLE");
    expect(previous.accessibility.coverage).toBe("PARTIAL");
    expect(current.accessibility.coverage).toBe("PARTIAL");
    expect(continuity.accessibilityChanged).toBeNull();
  });

  it("rejects accessibility evidence whose temporal provenance no longer aligns with the semantic/projection observation", () => {
    const previous = observation({
      tick: 70,
      player: { x: 20, y: 16 },
      companion: { x: 15, y: 16 },
      orientation: noOrientation(70)
    });
    const current = observation({
      tick: 71,
      player: { x: 20, y: 16 },
      companion: { x: 15, y: 16 },
      orientation: noOrientation(71)
    });
    const corrupted = {
      ...current,
      accessibility: {
        ...current.accessibility,
        sourceTick: 70
      }
    };

    expect(() => compareA1AccessibilityContinuity({ previous, current: corrupted }))
      .toThrow(/aligned accessibility evidence/);
  });
});
