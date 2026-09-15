import { describe, expect, it } from "vitest";
import { RapierPhysicalWorld } from "../physics/rapier-physical-world";
import type {
  ActorSnapshot,
  ScenarioSpec,
  StaticCircleTraversalResult,
  Vec2,
  WorldSnapshot
} from "../world/types";
import type { A1RelationshipOrientationEvidence } from "./a1-relationship-orientation";
import {
  A1_DEFAULT_RELATIONSHIP_OBJECTIVE,
  sampleA1RelationshipSemanticField,
  type A1RelationshipObjectiveProfile,
  type A1RelationshipSamplingConfig
} from "./a1-relationship-utility";
import {
  projectA1RelationshipSemanticField,
  projectA1RelativeState
} from "./a1-relationship-projection";

function actor(id: "player" | "companion", position: Vec2, radius = 0.3): ActorSnapshot {
  return {
    id,
    position: { ...position },
    radius,
    requestedVelocity: { x: 0, y: 0 },
    actualVelocity: { x: 0, y: 0 },
    motionError: 0,
    contacts: []
  };
}

function snapshot(options: {
  tick: number;
  player: Vec2;
  companion: Vec2;
  width?: number;
  height?: number;
}): WorldSnapshot {
  return {
    tick: options.tick,
    scenarioId: "open",
    width: options.width ?? 30,
    height: options.height ?? 24,
    actors: [actor("player", options.player), actor("companion", options.companion)],
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
    reason: "projection test orientation none"
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
    reason: "projection test semantic orientation"
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

function projectionById(
  projection: ReturnType<typeof projectA1RelationshipSemanticField>,
  id: string
) {
  const result = projection.samples.find((sample) => sample.sampleId === id);
  if (!result) throw new Error(`missing projection ${id}`);
  return result;
}

const FOUR_DIRECTION_SAMPLING: A1RelationshipSamplingConfig = {
  directions: 4,
  radii: [1.45],
  nearBestUtilityWindow: 0.01
};

describe("Authority-A1.1c relative world projection", () => {
  it("projects relative state by translation without introducing world-space semantics", () => {
    expect(projectA1RelativeState({ x: 5, y: 7 }, { x: -1.2, y: 0.4 }))
      .toEqual({ x: 3.8, y: 7.4 });
  });

  it("rejects a semantic field from a different decision tick", () => {
    const field = sampleA1RelationshipSemanticField({ orientation: noOrientation(4) });
    const current = snapshot({ tick: 5, player: { x: 12, y: 12 }, companion: { x: 8, y: 12 } });

    expect(() => projectA1RelationshipSemanticField({
      field,
      snapshot: current,
      query: (from, to, radius) => clearTraversal(from, to, radius),
      routeBudget: 0
    })).toThrow(/requires current semantic field t5; received t4/);
  });

  it("is translation-covariant before routing and does not execute queries at zero budget", () => {
    const field = sampleA1RelationshipSemanticField({ orientation: noOrientation(8) });
    const a = snapshot({ tick: 8, player: { x: 12, y: 10 }, companion: { x: 8, y: 10 } });
    const shift = { x: 5, y: 3 };
    const b = snapshot({
      tick: 8,
      player: { x: a.actors[0]!.position.x + shift.x, y: a.actors[0]!.position.y + shift.y },
      companion: { x: a.actors[1]!.position.x + shift.x, y: a.actors[1]!.position.y + shift.y }
    });
    const forbiddenQuery = () => {
      throw new Error("route query must not execute at zero budget");
    };

    const projectedA = projectA1RelationshipSemanticField({ field, snapshot: a, query: forbiddenQuery, routeBudget: 0 });
    const projectedB = projectA1RelationshipSemanticField({ field, snapshot: b, query: forbiddenQuery, routeBudget: 0 });

    expect(projectedB.counts.totalSamples).toBe(projectedA.counts.totalSamples);
    expect(projectedB.counts.semanticEligible).toBe(projectedA.counts.semanticEligible);
    expect(projectedB.counts.routeCandidates).toBe(projectedA.counts.routeCandidates);
    expect(projectedA.counts.staticTraversalQueries).toBe(0);
    expect(projectedB.counts.staticTraversalQueries).toBe(0);
    expect(projectedA.routeCoverageComplete).toBe(projectedA.counts.routeCandidates === 0);

    for (const sampleA of projectedA.samples) {
      const sampleB = projectionById(projectedB, sampleA.sampleId);
      expect(sampleB.semanticUtility).toBeCloseTo(sampleA.semanticUtility, 12);
      expect(sampleB.relativeOffset).toEqual(sampleA.relativeOffset);
      expect(sampleB.hardFit).toBe(sampleA.hardFit);
      expect(sampleB.worldPosition.x).toBeCloseTo(sampleA.worldPosition.x + shift.x, 12);
      expect(sampleB.worldPosition.y).toBeCloseTo(sampleA.worldPosition.y + shift.y, 12);
    }
  });

  it("keeps bounded route coverage honest and reports real traversal-query cost", () => {
    const field = sampleA1RelationshipSemanticField({ orientation: noOrientation(11) });
    const current = snapshot({ tick: 11, player: { x: 15, y: 12 }, companion: { x: 10, y: 12 } });
    let observedQueries = 0;
    const query = (from: Vec2, to: Vec2, radius: number) => {
      observedQueries += 1;
      return clearTraversal(from, to, radius);
    };

    const projection = projectA1RelationshipSemanticField({
      field,
      snapshot: current,
      query,
      routeBudget: 2
    });

    expect(projection.counts.routeCandidates).toBeGreaterThan(2);
    expect(projection.counts.routeEvaluated).toBe(2);
    expect(projection.counts.hardReachable).toBe(2);
    expect(projection.counts.hardUnreachable).toBe(0);
    expect(projection.counts.untested).toBe(projection.counts.routeCandidates - 2);
    expect(projection.routeCoverageComplete).toBe(false);
    expect(projection.counts.staticTraversalQueries).toBe(observedQueries);
    expect(observedQueries).toBeGreaterThanOrEqual(4);

    const routeCandidates = projection.samples.filter((sample) => sample.semanticEligible && sample.hardFit);
    expect(routeCandidates.filter((sample) => sample.routeQualification === "HARD_REACHABLE")).toHaveLength(2);
    expect(routeCandidates.filter((sample) => sample.routeQualification === "UNTESTED"))
      .toHaveLength(routeCandidates.length - 2);
    expect(routeCandidates.some((sample) => sample.routeQualification === "HARD_UNREACHABLE")).toBe(false);
  });

  it("can exhaustively qualify open-space semantic candidates without changing their semantic utility", () => {
    const field = sampleA1RelationshipSemanticField({ orientation: noOrientation(14) });
    const current = snapshot({ tick: 14, player: { x: 15, y: 12 }, companion: { x: 10, y: 12 } });
    const semanticUtilities = new Map(field.samples.map((sample) => [sample.id, sample.utility.totalUtility]));

    const projection = projectA1RelationshipSemanticField({
      field,
      snapshot: current,
      query: (from, to, radius) => clearTraversal(from, to, radius),
      routeBudget: 1000
    });

    expect(projection.routeCoverageComplete).toBe(true);
    expect(projection.counts.routeEvaluated).toBe(projection.counts.routeCandidates);
    expect(projection.counts.hardReachable).toBe(projection.counts.routeCandidates);
    expect(projection.counts.hardUnreachable).toBe(0);
    expect(projection.counts.untested).toBe(0);
    for (const sample of projection.samples) {
      expect(sample.semanticUtility).toBeCloseTo(semanticUtilities.get(sample.sampleId)!, 12);
    }
  });

  it("marks locally impossible semantic samples NOT_APPLICABLE rather than fabricating route-unreachable truth", () => {
    const field = sampleA1RelationshipSemanticField({
      orientation: semanticOrientation(3, { x: 1, y: 0 }),
      objective: A1_DEFAULT_RELATIONSHIP_OBJECTIVE,
      sampling: FOUR_DIRECTION_SAMPLING
    });
    const current = snapshot({
      tick: 3,
      player: { x: 0.2, y: 0.2 },
      companion: { x: 2, y: 2 },
      width: 6,
      height: 6
    });
    let queries = 0;
    const projection = projectA1RelationshipSemanticField({
      field,
      snapshot: current,
      query: (from, to, radius) => {
        queries += 1;
        return clearTraversal(from, to, radius);
      },
      routeBudget: 100
    });

    const eligible = projection.samples.filter((sample) => sample.semanticEligible);
    expect(eligible.length).toBeGreaterThan(0);
    expect(eligible.every((sample) => !sample.hardFit)).toBe(true);
    expect(eligible.every((sample) => sample.routeQualification === "NOT_APPLICABLE")).toBe(true);
    expect(eligible.every((sample) => sample.routeTruth === null)).toBe(true);
    expect(projection.counts.routeCandidates).toBe(0);
    expect(projection.counts.hardUnreachable).toBe(0);
    expect(projection.counts.staticTraversalQueries).toBe(0);
    expect(queries).toBe(0);
  });

  it("preserves hard reachability when desired comfort erases connectivity", async () => {
    const spec: ScenarioSpec = {
      id: "open",
      label: "A1.1c hard-only relative projection",
      width: 12,
      height: 8,
      actors: [
        { id: "player", position: { x: 3, y: 2.55 }, radius: 0.3, speed: 3 },
        { id: "companion", position: { x: 8, y: 4 }, radius: 0.3, speed: 3 }
      ],
      obstacles: [
        { id: "hard-only-wall", x: 5.5, y: 0.7, width: 1, height: 7.3 }
      ]
    };
    const physical = await RapierPhysicalWorld.create(spec);
    try {
      const worldSnapshot: WorldSnapshot = {
        tick: 17,
        scenarioId: "open",
        width: spec.width,
        height: spec.height,
        actors: physical.snapshot(),
        obstacles: spec.obstacles
      };
      const objective: A1RelationshipObjectiveProfile = {
        radial: { preferredRadius: 1.45, sigma: 0.3, weight: 1 },
        directional: { kind: "NONE" }
      };
      const sampling: A1RelationshipSamplingConfig = {
        directions: 4,
        radii: [1.45],
        nearBestUtilityWindow: 0
      };
      const field = sampleA1RelationshipSemanticField({
        orientation: noOrientation(17),
        objective,
        sampling
      });
      let observedQueries = 0;
      const projection = projectA1RelationshipSemanticField({
        field,
        snapshot: worldSnapshot,
        query: (from, to, radius, options) => {
          observedQueries += 1;
          return physical.staticCircleTraversal(from, to, radius, options);
        },
        routeBudget: 4
      });

      const hardOnly = projectionById(projection, "r0.b1");
      // Rapier snapshots are f32-backed. This fixture validates the semantic/world
      // projection and route class, not sub-nanometer equality with the source spec.
      expect(hardOnly.worldPosition.x).toBeCloseTo(3, 6);
      expect(hardOnly.worldPosition.y).toBeCloseTo(4, 6);
      expect(hardOnly.hardFit).toBe(true);
      expect(hardOnly.routeQualification).toBe("HARD_REACHABLE");
      expect(hardOnly.routeTruth?.hardReachable).toBe(true);
      expect(hardOnly.routeTruth?.hardStatus).toBe("routed");
      expect(hardOnly.routeTruth?.desiredReachable).toBe(false);
      expect(hardOnly.routeTruth?.desiredStatus).toBe("unreachable");
      expect(hardOnly.routeTruth?.comfortErasesHardConnectivity).toBe(true);
      expect(projection.counts.staticTraversalQueries).toBe(observedQueries);
      expect(observedQueries).toBeGreaterThan(projection.counts.routeEvaluated);
    } finally {
      physical.dispose();
    }
  });
});
