import { describe, expect, it } from "vitest";
import type { ActorSnapshot, StaticCircleTraversalResult, Vec2, WorldSnapshot } from "../world/types";
import { buildA1AccessibilityEvidence } from "./a1-accessibility-fragments";
import type { A1RelationshipOrientationEvidence } from "./a1-relationship-orientation";
import { projectA1RelationshipSemanticField } from "./a1-relationship-projection";
import {
  sampleA1RelationshipSemanticField,
  type A1RelationshipObjectiveProfile,
  type A1RelationshipSamplingConfig
} from "./a1-relationship-utility";

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

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

function snapshot(tick: number): WorldSnapshot {
  return {
    tick,
    scenarioId: "open",
    width: 40,
    height: 32,
    actors: [actor("player", { x: 20, y: 16 }), actor("companion", { x: 15, y: 16 })],
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
    reason: "pressure coverage audit: directionless controlled ring"
  };
}

function clearTraversal(from: Vec2, to: Vec2, radius: number): StaticCircleTraversalResult {
  return {
    from: { ...from },
    to: { ...to },
    radius,
    distance: distance(from, to),
    clear: true,
    blocker: null
  };
}

const OBJECTIVE: A1RelationshipObjectiveProfile = {
  radial: { preferredRadius: 1.45, sigma: 0.3, weight: 1 },
  directional: { kind: "NONE" }
};

const SAMPLING: A1RelationshipSamplingConfig = {
  directions: 16,
  radii: [1.45],
  nearBestUtilityWindow: 0
};

function observe(tick: number, routeBudget: number) {
  const field = sampleA1RelationshipSemanticField({
    orientation: noOrientation(tick),
    objective: OBJECTIVE,
    sampling: SAMPLING
  });
  const projection = projectA1RelationshipSemanticField({
    field,
    snapshot: snapshot(tick),
    query: clearTraversal,
    routeBudget,
    routeQualificationStrategy: "STRATIFIED_COVERAGE"
  });
  const accessibility = buildA1AccessibilityEvidence({ field, projection });
  return { field, projection, accessibility };
}

function worldPosition(input: ReturnType<typeof observe>, sampleId: string): Vec2 {
  const sample = input.projection.samples.find((candidate) => candidate.sampleId === sampleId);
  if (!sample) throw new Error(`Pressure coverage audit lost ${sampleId}.`);
  return sample.worldPosition;
}

function nearestConfirmedDistance(input: ReturnType<typeof observe>, anchor: Vec2): number {
  if (input.accessibility.confirmedReachableSampleIds.length === 0) return Number.POSITIVE_INFINITY;
  return Math.min(...input.accessibility.confirmedReachableSampleIds.map(
    (sampleId) => distance(worldPosition(input, sampleId), anchor)
  ));
}

describe("A1 commitment pressure coverage honesty", () => {
  it("shows partial route coverage can fabricate positive confirmed pressure when the exact anchor is merely untested", () => {
    const full = observe(0, 16);
    const partial = observe(1, 4);
    const anchorSampleId = "r0.b2";
    const anchor = worldPosition(full, anchorSampleId);

    const fullPressure = nearestConfirmedDistance(full, anchor);
    const partialConfirmedUpperBound = nearestConfirmedDistance(partial, anchor);
    const partialAnchorProjection = partial.projection.samples.find((sample) => sample.sampleId === anchorSampleId);

    expect(full.accessibility.coverage).toBe("COMPLETE");
    expect(full.accessibility.confirmedReachableSampleIds).toContain(anchorSampleId);
    expect(fullPressure).toBeLessThanOrEqual(1e-12);

    expect(partial.accessibility.coverage).toBe("PARTIAL");
    expect(partial.accessibility.untestedSampleIds).toContain(anchorSampleId);
    expect(partialAnchorProjection?.routeQualification).toBe("UNTESTED");
    expect(partialConfirmedUpperBound).toBeGreaterThan(0.5);

    console.info(`[A1_OPPORTUNITY_PRESSURE_COVERAGE] ${JSON.stringify({
      anchorSampleId,
      anchor,
      full: {
        coverage: full.accessibility.coverage,
        evaluatedSampleIds: full.projection.routeEvaluatedSampleIds,
        confirmedReachableSampleIds: full.accessibility.confirmedReachableSampleIds,
        pressureDistance: fullPressure
      },
      partial: {
        coverage: partial.accessibility.coverage,
        evaluatedSampleIds: partial.projection.routeEvaluatedSampleIds,
        confirmedReachableSampleIds: partial.accessibility.confirmedReachableSampleIds,
        untestedSampleIds: partial.accessibility.untestedSampleIds,
        anchorRouteQualification: partialAnchorProjection?.routeQualification ?? null,
        confirmedNearestDistanceUpperBound: partialConfirmedUpperBound
      },
      interpretation: "PARTIAL confirmed-nearest distance is not exact commitment pressure; an untested sample may reduce it"
    })}`);
  });
});