import { describe, expect, it } from "vitest";
import { LabWorld } from "../world/world";
import type { StaticCircleTraversalResult, Vec2 } from "../world/types";
import { A1AuthorityRuntime } from "./a1-authority-runtime";
import { buildA1Situation } from "./a1-situation";

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

describe("Authority-A1.1f observation failure provenance", () => {
  it("preserves the originating same-tick failure when a duplicate observation is attempted", async () => {
    const world = await LabWorld.create("open");
    try {
      const runtime = new A1AuthorityRuntime();
      runtime.setVariant("direct");
      let snapshot = world.snapshot();
      let situation = buildA1Situation({
        snapshot,
        playerIntent: { actorId: "player", move: { x: 1, y: 0 } },
        playerCapability: world.actorMovementCapability("player"),
        companionCapability: world.actorMovementCapability("companion"),
        previousWorldStep: null
      });

      expect(runtime.observeRelationship({
        situation,
        snapshot,
        query: () => {
          throw new Error("originating heavy traversal failure");
        }
      })).toBeNull();
      expect(runtime.debugState().relationshipObservationError).toEqual({
        tick: 0,
        message: "originating heavy traversal failure"
      });

      expect(runtime.observeRelationship({ situation, snapshot, query: clearTraversal })).toBeNull();
      const duplicate = runtime.debugState();
      expect(duplicate.relationshipObservationError).toEqual({
        tick: 0,
        message: "originating heavy traversal failure"
      });
      expect(duplicate.relationshipObservation).toMatchObject({
        latestTick: 0,
        observations: 1,
        heavyAttempts: 1,
        heavyEvaluations: 0,
        lastHeavyAttemptTick: 0,
        heavy: null
      });

      snapshot = world.step([
        { actorId: "player", move: { x: 1, y: 0 } },
        { actorId: "companion", move: { x: 0, y: 0 } }
      ]);
      situation = buildA1Situation({
        snapshot,
        playerIntent: { actorId: "player", move: { x: 1, y: 0 } },
        playerCapability: world.actorMovementCapability("player"),
        companionCapability: world.actorMovementCapability("companion"),
        previousWorldStep: world.latestAuthorityA0StepEvidence()
      });

      expect(runtime.observeRelationship({ situation, snapshot, query: clearTraversal })).not.toBeNull();
      const nextTick = runtime.debugState();
      expect(nextTick.relationshipObservationError).toBeNull();
      expect(nextTick.relationshipObservation).toMatchObject({
        latestTick: 1,
        observations: 2,
        heavyAttempts: 1,
        heavyEvaluations: 0,
        heavy: null
      });
    } finally {
      world.dispose();
    }
  });
});
