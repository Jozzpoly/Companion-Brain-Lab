import { describe, expect, it } from "vitest";
import { LabWorld } from "../world/world";
import type { MotionIntent, StaticCircleTraversalResult, Vec2, WorldSnapshot } from "../world/types";
import { buildA1Situation, type A1Situation } from "./a1-situation";
import {
  A1RelationshipObserver,
  A1_RELATIONSHIP_HEAVY_INTERVAL_TICKS
} from "./a1-relationship-observer";
import type {
  A1RelationshipObjectiveProfile,
  A1RelationshipSamplingConfig
} from "./a1-relationship-utility";

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

function situation(
  world: LabWorld,
  snapshot: WorldSnapshot,
  playerMove: Vec2
): A1Situation {
  return buildA1Situation({
    snapshot,
    playerIntent: { actorId: "player", move: { ...playerMove } },
    playerCapability: world.actorMovementCapability("player"),
    companionCapability: world.actorMovementCapability("companion"),
    previousWorldStep: world.latestAuthorityA0StepEvidence()
  });
}

function step(world: LabWorld, playerMove: Vec2, companionMove: Vec2 = { x: 0, y: 0 }): WorldSnapshot {
  const intents: readonly MotionIntent[] = [
    { actorId: "player", move: { ...playerMove } },
    { actorId: "companion", move: { ...companionMove } }
  ];
  return world.step(intents);
}

describe("Authority-A1.1f passive relationship observer", () => {
  it("keeps current semantic evidence fresh while heavy world evidence ages on its own clock", async () => {
    const world = await LabWorld.create("open");
    try {
      const observer = new A1RelationshipObserver();
      let snapshot = world.snapshot();
      let queryCalls = 0;
      const countedQuery = (from: Vec2, to: Vec2, radius: number) => {
        queryCalls += 1;
        return clearTraversal(from, to, radius);
      };

      const t0 = observer.observe({
        situation: situation(world, snapshot, { x: 1, y: 0 }),
        snapshot,
        query: countedQuery
      });
      expect(t0.lastAttemptTick).toBe(0);
      expect(t0.latestTick).toBe(0);
      expect(t0.orientation?.source).toBe("SAME_STEP_OWNER");
      expect(t0.orientation?.direction).toEqual({ x: 1, y: 0 });
      expect(t0.semantic?.sourceTick).toBe(0);
      expect(t0.heavy?.sourceTick).toBe(0);
      expect(t0.heavy?.ageTicks).toBe(0);
      expect(t0.heavyAttempts).toBe(1);
      expect(t0.heavyEvaluations).toBe(1);
      expect(t0.lastHeavyAttemptTick).toBe(0);
      expect(queryCalls).toBeGreaterThan(0);
      const afterInitialQueries = queryCalls;

      snapshot = step(world, { x: 1, y: 0 });
      const forbiddenQuery = () => {
        throw new Error("heavy query must not execute before its World-tick cadence is due");
      };
      const t1 = observer.observe({
        situation: situation(world, snapshot, { x: -1, y: 0 }),
        snapshot,
        query: forbiddenQuery
      });

      expect(t1.lastAttemptTick).toBe(1);
      expect(t1.latestTick).toBe(1);
      expect(t1.orientation?.source).toBe("SAME_STEP_OWNER");
      expect(t1.orientation?.sourceTick).toBe(1);
      expect(t1.orientation?.direction?.x).toBeCloseTo(-1, 12);
      expect(t1.semantic?.sourceTick).toBe(1);
      expect(t1.heavy?.sourceTick).toBe(0);
      expect(t1.heavy?.ageTicks).toBe(1);
      expect(t1.heavyAttempts).toBe(1);
      expect(t1.heavyEvaluations).toBe(1);
      expect(queryCalls).toBe(afterInitialQueries);
    } finally {
      world.dispose();
    }
  });

  it("refreshes heavy evidence exactly from World-tick cadence and compares heavy observations causally", async () => {
    const world = await LabWorld.create("open");
    try {
      const observer = new A1RelationshipObserver();
      let snapshot = world.snapshot();
      let queryCalls = 0;
      const countedQuery = (from: Vec2, to: Vec2, radius: number) => {
        queryCalls += 1;
        return clearTraversal(from, to, radius);
      };

      observer.observe({
        situation: situation(world, snapshot, { x: 1, y: 0 }),
        snapshot,
        query: countedQuery
      });
      const firstHeavyQueries = queryCalls;

      for (let tick = 1; tick < A1_RELATIONSHIP_HEAVY_INTERVAL_TICKS; tick += 1) {
        snapshot = step(world, { x: 1, y: 0 });
        const debug = observer.observe({
          situation: situation(world, snapshot, { x: 1, y: 0 }),
          snapshot,
          query: () => {
            throw new Error(`unexpected heavy query at t${tick}`);
          }
        });
        expect(debug.lastAttemptTick).toBe(tick);
        expect(debug.heavy?.sourceTick).toBe(0);
        expect(debug.heavy?.ageTicks).toBe(tick);
        expect(debug.heavyAttempts).toBe(1);
        expect(debug.heavyEvaluations).toBe(1);
      }

      snapshot = step(world, { x: 1, y: 0 });
      const refreshed = observer.observe({
        situation: situation(world, snapshot, { x: 1, y: 0 }),
        snapshot,
        query: countedQuery
      });

      expect(snapshot.tick).toBe(A1_RELATIONSHIP_HEAVY_INTERVAL_TICKS);
      expect(refreshed.lastAttemptTick).toBe(A1_RELATIONSHIP_HEAVY_INTERVAL_TICKS);
      expect(refreshed.heavy?.sourceTick).toBe(A1_RELATIONSHIP_HEAVY_INTERVAL_TICKS);
      expect(refreshed.heavy?.ageTicks).toBe(0);
      expect(refreshed.heavyAttempts).toBe(2);
      expect(refreshed.heavyEvaluations).toBe(2);
      expect(queryCalls).toBeGreaterThan(firstHeavyQueries);
      expect(refreshed.heavy?.continuityComparability).toBe("COMPARABLE");
      expect(refreshed.heavy?.continuityNonComparabilityReason).toBeNull();
    } finally {
      world.dispose();
    }
  });

  it("does not retry a failed heavy evaluation every motor tick", async () => {
    const world = await LabWorld.create("open");
    try {
      const observer = new A1RelationshipObserver();
      let snapshot = world.snapshot();
      let failedQueries = 0;

      expect(() => observer.observe({
        situation: situation(world, snapshot, { x: 1, y: 0 }),
        snapshot,
        query: () => {
          failedQueries += 1;
          throw new Error("injected heavy failure");
        }
      })).toThrow(/injected heavy failure/);
      const afterFailure = observer.debugState();
      expect(afterFailure.lastAttemptTick).toBe(0);
      expect(afterFailure.latestTick).toBe(0);
      expect(afterFailure.heavyAttempts).toBe(1);
      expect(afterFailure.heavyEvaluations).toBe(0);
      expect(afterFailure.lastHeavyAttemptTick).toBe(0);
      expect(afterFailure.heavy).toBeNull();
      expect(failedQueries).toBe(1);

      for (let tick = 1; tick < A1_RELATIONSHIP_HEAVY_INTERVAL_TICKS; tick += 1) {
        snapshot = step(world, { x: 1, y: 0 });
        const debug = observer.observe({
          situation: situation(world, snapshot, { x: 1, y: 0 }),
          snapshot,
          query: () => {
            throw new Error(`heavy retry storm at t${tick}`);
          }
        });
        expect(debug.lastAttemptTick).toBe(tick);
        expect(debug.latestTick).toBe(tick);
        expect(debug.semantic?.sourceTick).toBe(tick);
        expect(debug.heavyAttempts).toBe(1);
        expect(debug.heavyEvaluations).toBe(0);
        expect(debug.heavy).toBeNull();
      }

      snapshot = step(world, { x: 1, y: 0 });
      const recovered = observer.observe({
        situation: situation(world, snapshot, { x: 1, y: 0 }),
        snapshot,
        query: clearTraversal
      });
      expect(recovered.lastAttemptTick).toBe(A1_RELATIONSHIP_HEAVY_INTERVAL_TICKS);
      expect(recovered.latestTick).toBe(A1_RELATIONSHIP_HEAVY_INTERVAL_TICKS);
      expect(recovered.heavyAttempts).toBe(2);
      expect(recovered.heavyEvaluations).toBe(1);
      expect(recovered.heavy?.sourceTick).toBe(A1_RELATIONSHIP_HEAVY_INTERVAL_TICKS);
      expect(recovered.heavy?.ageTicks).toBe(0);
    } finally {
      world.dispose();
    }
  });

  it("rejects a duplicate World tick before it can mutate evidence or query heavy projection", async () => {
    const world = await LabWorld.create("open");
    try {
      const observer = new A1RelationshipObserver();
      const snapshot = world.snapshot();
      observer.observe({
        situation: situation(world, snapshot, { x: 1, y: 0 }),
        snapshot,
        query: clearTraversal
      });
      const beforeDuplicate = observer.debugState();
      let queries = 0;

      expect(() => observer.observe({
        situation: situation(world, snapshot, { x: -1, y: 0 }),
        snapshot,
        query: (from, to, radius) => {
          queries += 1;
          return clearTraversal(from, to, radius);
        }
      })).toThrow(/must strictly advance World time/);

      expect(queries).toBe(0);
      expect(observer.debugState()).toEqual(beforeDuplicate);
    } finally {
      world.dispose();
    }
  });

  it("defensively owns objective and sampling config instead of accepting external mutation mid-epoch", async () => {
    const world = await LabWorld.create("open");
    try {
      const objective: A1RelationshipObjectiveProfile = {
        radial: { preferredRadius: 1.45, sigma: 0.45, weight: 1 },
        directional: { kind: "AVOID_FORWARD_HEMISPHERE", weight: 1 }
      };
      const sampling: A1RelationshipSamplingConfig = {
        directions: 16,
        radii: [1.45],
        nearBestUtilityWindow: 0.2
      };
      const observer = new A1RelationshipObserver({ objective, sampling });
      let snapshot = world.snapshot();
      const first = observer.observe({
        situation: situation(world, snapshot, { x: 1, y: 0 }),
        snapshot,
        query: clearTraversal
      });
      const objectiveSignature = first.semantic?.objectiveSignature;
      const samplingSignature = first.semantic?.samplingSignature;

      objective.radial.preferredRadius = 9;
      if (objective.directional.kind === "AVOID_FORWARD_HEMISPHERE") objective.directional.weight = 7;
      sampling.directions = 64;
      sampling.radii = [0.4, 4.2];

      snapshot = step(world, { x: 1, y: 0 });
      const second = observer.observe({
        situation: situation(world, snapshot, { x: 1, y: 0 }),
        snapshot,
        query: () => {
          throw new Error("next-tick light observation must not trigger heavy work");
        }
      });
      expect(second.lastAttemptTick).toBe(1);
      expect(second.semantic?.sourceTick).toBe(1);
      expect(second.semantic?.objectiveSignature).toBe(objectiveSignature);
      expect(second.semantic?.samplingSignature).toBe(samplingSignature);
      expect(second.semantic?.eligibleSamples).toBe(first.semantic?.eligibleSamples);
      expect(second.heavyAttempts).toBe(1);
    } finally {
      world.dispose();
    }
  });

  it("resets semantic memory and heavy cache together instead of leaking evidence across epochs", async () => {
    const world = await LabWorld.create("open");
    try {
      const observer = new A1RelationshipObserver();
      const snapshot = world.snapshot();
      observer.observe({
        situation: situation(world, snapshot, { x: 1, y: 0 }),
        snapshot,
        query: clearTraversal
      });
      expect(observer.debugState().heavy).not.toBeNull();

      observer.reset();
      expect(observer.debugState()).toEqual({
        lastAttemptTick: null,
        latestTick: null,
        observations: 0,
        heavyAttempts: 0,
        heavyEvaluations: 0,
        lastHeavyAttemptTick: null,
        orientation: null,
        semantic: null,
        heavy: null
      });
    } finally {
      world.dispose();
    }
  });

  it("rejects stale or mismatched body evidence before any heavy traversal query can run", async () => {
    const world = await LabWorld.create("open");
    try {
      const observer = new A1RelationshipObserver();
      const snapshot = world.snapshot();
      const current = situation(world, snapshot, { x: 1, y: 0 });
      const mismatched: WorldSnapshot = {
        ...snapshot,
        actors: snapshot.actors.map((actor) => actor.id === "player"
          ? { ...actor, position: { x: actor.position.x + 0.01, y: actor.position.y } }
          : actor)
      };
      let queries = 0;

      expect(() => observer.observe({
        situation: current,
        snapshot: mismatched,
        query: (from, to, radius) => {
          queries += 1;
          return clearTraversal(from, to, radius);
        }
      })).toThrow(/does not match the supplied World snapshot/);
      expect(queries).toBe(0);
      expect(observer.debugState().lastAttemptTick).toBe(0);
      expect(observer.debugState().latestTick).toBeNull();
      expect(observer.debugState().observations).toBe(0);
    } finally {
      world.dispose();
    }
  });

  it("rejects backward World time so cached evidence cannot silently cross a reset boundary", async () => {
    const world = await LabWorld.create("open");
    try {
      const observer = new A1RelationshipObserver();
      let snapshot = world.snapshot();
      observer.observe({
        situation: situation(world, snapshot, { x: 1, y: 0 }),
        snapshot,
        query: clearTraversal
      });
      snapshot = step(world, { x: 1, y: 0 });
      observer.observe({
        situation: situation(world, snapshot, { x: 1, y: 0 }),
        snapshot,
        query: clearTraversal
      });

      const resetWorld = await LabWorld.create("open");
      try {
        const resetSnapshot = resetWorld.snapshot();
        expect(() => observer.observe({
          situation: situation(resetWorld, resetSnapshot, { x: 1, y: 0 }),
          snapshot: resetSnapshot,
          query: clearTraversal
        })).toThrow(/must strictly advance World time/);
      } finally {
        resetWorld.dispose();
      }
    } finally {
      world.dispose();
    }
  });
});
