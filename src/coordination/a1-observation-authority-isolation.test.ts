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

describe("Authority-A1.1f passive observation isolation", () => {
  it("does no relationship-observation work while A1 is OFF", async () => {
    const world = await LabWorld.create("open");
    try {
      const runtime = new A1AuthorityRuntime();
      const snapshot = world.snapshot();
      const situation = buildA1Situation({
        snapshot,
        playerIntent: { actorId: "player", move: { x: 1, y: 0 } },
        playerCapability: world.actorMovementCapability("player"),
        companionCapability: world.actorMovementCapability("companion"),
        previousWorldStep: null
      });
      const baseline = { actorId: "companion" as const, move: { x: 0.27, y: -0.31 } };

      expect(runtime.observeRelationship({
        situation,
        snapshot,
        query: () => {
          throw new Error("OFF must not query relationship projection");
        }
      })).toBeNull();
      expect(runtime.resolveCompanionIntent({ baselineIntent: baseline, situation: null })).toEqual(baseline);
      expect(runtime.debugState().relationshipObservation).toMatchObject({
        latestTick: null,
        observations: 0,
        heavyEvaluations: 0,
        heavy: null
      });
      expect(runtime.debugState().relationshipObservationError).toBeNull();
    } finally {
      world.dispose();
    }
  });

  it("contains a heavy-observation failure while preserving the exact baseline companion command", async () => {
    const world = await LabWorld.create("open");
    try {
      const runtime = new A1AuthorityRuntime();
      runtime.setVariant("direct");
      const snapshot = world.snapshot();
      const situation = buildA1Situation({
        snapshot,
        playerIntent: { actorId: "player", move: { x: 1, y: 0 } },
        playerCapability: world.actorMovementCapability("player"),
        companionCapability: world.actorMovementCapability("companion"),
        previousWorldStep: null
      });
      const baseline = { actorId: "companion" as const, move: { x: -0.42, y: 0.19 } };

      expect(runtime.observeRelationship({
        situation,
        snapshot,
        query: () => {
          throw new Error("injected A1.1f traversal failure");
        }
      })).toBeNull();
      expect(runtime.resolveCompanionIntent({ baselineIntent: baseline, situation })).toEqual(baseline);

      const debug = runtime.debugState();
      expect(debug.relationshipObservationError).toEqual({
        tick: 0,
        message: "injected A1.1f traversal failure"
      });
      expect(debug.relationshipObservation.latestTick).toBe(0);
      expect(debug.relationshipObservation.semantic?.sourceTick).toBe(0);
      expect(debug.relationshipObservation.heavy).toBeNull();
      expect(debug.passThroughSteps).toBe(1);
    } finally {
      world.dispose();
    }
  });

  it("clears failure event evidence on the next successful observation without changing pass-through semantics", async () => {
    const world = await LabWorld.create("open");
    try {
      const runtime = new A1AuthorityRuntime();
      runtime.setVariant("temporal");
      let snapshot = world.snapshot();
      let situation = buildA1Situation({
        snapshot,
        playerIntent: { actorId: "player", move: { x: 1, y: 0 } },
        playerCapability: world.actorMovementCapability("player"),
        companionCapability: world.actorMovementCapability("companion"),
        previousWorldStep: null
      });
      runtime.observeRelationship({
        situation,
        snapshot,
        query: () => {
          throw new Error("one-tick observer failure");
        }
      });
      expect(runtime.debugState().relationshipObservationError?.tick).toBe(0);

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
      const baseline = { actorId: "companion" as const, move: { x: 0.13, y: 0.71 } };

      expect(runtime.observeRelationship({ situation, snapshot, query: clearTraversal })).not.toBeNull();
      expect(runtime.resolveCompanionIntent({ baselineIntent: baseline, situation })).toEqual(baseline);
      const recovered = runtime.debugState();
      expect(recovered.relationshipObservationError).toBeNull();
      expect(recovered.relationshipObservation.heavy?.sourceTick).toBe(1);
      expect(recovered.relationshipObservation.heavy?.ageTicks).toBe(0);
      expect(recovered.passThroughSteps).toBe(1);
    } finally {
      world.dispose();
    }
  });

  it("variant changes reset both passive observer clocks and error evidence", async () => {
    const world = await LabWorld.create("open");
    try {
      const runtime = new A1AuthorityRuntime();
      runtime.setVariant("direct");
      const snapshot = world.snapshot();
      const situation = buildA1Situation({
        snapshot,
        playerIntent: { actorId: "player", move: { x: 1, y: 0 } },
        playerCapability: world.actorMovementCapability("player"),
        companionCapability: world.actorMovementCapability("companion"),
        previousWorldStep: null
      });
      runtime.observeRelationship({ situation, snapshot, query: clearTraversal });
      expect(runtime.debugState().relationshipObservation.heavy).not.toBeNull();

      runtime.setVariant("temporal");
      expect(runtime.debugState().relationshipObservation).toEqual({
        latestTick: null,
        observations: 0,
        heavyEvaluations: 0,
        orientation: null,
        semantic: null,
        heavy: null
      });
      expect(runtime.debugState().relationshipObservationError).toBeNull();
    } finally {
      world.dispose();
    }
  });
});
