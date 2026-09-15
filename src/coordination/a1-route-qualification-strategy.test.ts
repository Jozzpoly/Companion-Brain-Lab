import { describe, expect, it } from "vitest";
import type { ActorSnapshot, StaticCircleTraversalResult, Vec2, WorldSnapshot } from "../world/types";
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

function snapshot(tick: number): WorldSnapshot {
  return {
    tick,
    scenarioId: "open",
    width: 30,
    height: 24,
    actors: [
      actor("player", { x: 15, y: 12 }),
      actor("companion", { x: 10, y: 12 })
    ],
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
    reason: "route coverage strategy test"
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

const COVERAGE_OBJECTIVE: A1RelationshipObjectiveProfile = {
  radial: { preferredRadius: 1.45, sigma: 0.3, weight: 1 },
  directional: { kind: "NONE" }
};

const COVERAGE_SAMPLING: A1RelationshipSamplingConfig = {
  directions: 16,
  radii: [1.45],
  nearBestUtilityWindow: 0
};

describe("Authority-A1.1c route qualification strategy", () => {
  it("keeps semantic-priority qualification local while stratified coverage spreads the same budget across the lattice", () => {
    const tick = 31;
    const field = sampleA1RelationshipSemanticField({
      orientation: noOrientation(tick),
      objective: COVERAGE_OBJECTIVE,
      sampling: COVERAGE_SAMPLING
    });

    const semanticPriority = projectA1RelationshipSemanticField({
      field,
      snapshot: snapshot(tick),
      query: clearTraversal,
      routeBudget: 4,
      routeQualificationStrategy: "SEMANTIC_PRIORITY"
    });
    const coverage = projectA1RelationshipSemanticField({
      field,
      snapshot: snapshot(tick),
      query: clearTraversal,
      routeBudget: 4,
      routeQualificationStrategy: "STRATIFIED_COVERAGE"
    });

    expect(semanticPriority.routeQualificationStrategy).toBe("SEMANTIC_PRIORITY");
    expect(coverage.routeQualificationStrategy).toBe("STRATIFIED_COVERAGE");
    expect(semanticPriority.routeEvaluatedSampleIds).toEqual([
      "r0.b0",
      "r0.b1",
      "r0.b2",
      "r0.b3"
    ]);
    expect(coverage.routeEvaluatedSampleIds).toEqual([
      "r0.b0",
      "r0.b8",
      "r0.b4",
      "r0.b12"
    ]);
    expect(coverage.counts.routeEvaluated).toBe(4);
    expect(coverage.counts.untested).toBe(12);
    expect(coverage.routeCoverageComplete).toBe(false);
  });

  it("changes only evidence coverage, not semantic utilities or route truth semantics", () => {
    const tick = 41;
    const field = sampleA1RelationshipSemanticField({
      orientation: noOrientation(tick),
      objective: COVERAGE_OBJECTIVE,
      sampling: COVERAGE_SAMPLING
    });
    const semanticUtilities = new Map(field.samples.map((sample) => [sample.id, sample.utility.totalUtility]));

    const coverage = projectA1RelationshipSemanticField({
      field,
      snapshot: snapshot(tick),
      query: clearTraversal,
      routeBudget: 6,
      routeQualificationStrategy: "STRATIFIED_COVERAGE"
    });

    expect(coverage.counts.hardReachable).toBe(6);
    expect(coverage.counts.hardUnreachable).toBe(0);
    expect(coverage.counts.staticTraversalQueries).toBeGreaterThan(coverage.counts.routeEvaluated);
    for (const sample of coverage.samples) {
      expect(sample.semanticUtility).toBeCloseTo(semanticUtilities.get(sample.sampleId)!, 12);
      if (coverage.routeEvaluatedSampleIds.includes(sample.sampleId)) {
        expect(sample.routeQualification).toBe("HARD_REACHABLE");
      }
    }
  });
});
