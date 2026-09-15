import { describe, expect, it } from "vitest";
import { LabWorld } from "../world/world";
import type { MotionIntent } from "../world/types";
import { buildA1Situation } from "./a1-situation";

function companionHold(): MotionIntent {
  return { actorId: "companion", move: { x: 0, y: 0 } };
}

describe("Authority-A1 decision-time situation", () => {
  it("exposes same-step Owner request before World while keeping pre-step body motion separate", async () => {
    const world = await LabWorld.create("open");
    try {
      const before = world.snapshot();
      const playerIntent: MotionIntent = { actorId: "player", move: { x: 1, y: 0 } };
      const situation = buildA1Situation({
        snapshot: before,
        playerIntent,
        playerCapability: world.actorMovementCapability("player"),
        companionCapability: world.actorMovementCapability("companion"),
        previousWorldStep: world.latestAuthorityA0StepEvidence()
      });

      expect(situation.tick).toBe(0);
      expect(situation.situated.playerControl.sourceTick).toBe(0);
      expect(situation.situated.playerControl.move).toEqual({ x: 1, y: 0 });
      expect(situation.playerRequestedVelocity.sourceTick).toBe(0);
      expect(situation.playerRequestedVelocity.velocity).toEqual({ x: 3, y: 0 });
      expect(situation.situated.playerBody.requestedVelocity).toEqual({ x: 0, y: 0 });
      expect(situation.previousOutcome).toBeNull();
    } finally {
      world.dispose();
    }
  });

  it("sees a same-tick reversal immediately instead of inheriting the previous requested direction", async () => {
    const world = await LabWorld.create("open");
    try {
      world.step([
        { actorId: "player", move: { x: 1, y: 0 } },
        companionHold()
      ]);
      const beforeReversal = world.snapshot();
      expect(beforeReversal.tick).toBe(1);

      const situation = buildA1Situation({
        snapshot: beforeReversal,
        playerIntent: { actorId: "player", move: { x: -1, y: 0 } },
        playerCapability: world.actorMovementCapability("player"),
        companionCapability: world.actorMovementCapability("companion"),
        previousWorldStep: world.latestAuthorityA0StepEvidence()
      });

      expect(situation.tick).toBe(1);
      expect(situation.situated.playerControl.sourceTick).toBe(1);
      expect(situation.situated.playerControl.move).toEqual({ x: -1, y: 0 });
      expect(situation.playerRequestedVelocity.velocity).toEqual({ x: -3, y: 0 });

      // Body state at observation t1 still reports what World executed on t0 -> t1.
      expect(situation.situated.playerBody.sourceTick).toBe(1);
      expect(situation.situated.playerBody.requestedVelocity.x).toBeGreaterThan(2.9);
      expect(situation.previousOutcome?.observationTick).toBe(0);
      expect(situation.previousOutcome?.outcomeTick).toBe(1);
      expect(situation.previousOutcome?.ageTicks).toBe(0);
      expect(situation.previousOutcome?.playerBody.requestedVelocity.x).toBeGreaterThan(2.9);

      // The decision-time request is nevertheless already the new direction at the same tick.
      expect(situation.playerRequestedVelocity.velocity.x).toBeLessThan(-2.9);
    } finally {
      world.dispose();
    }
  });

  it("rejects stale previous-outcome evidence instead of silently accepting a clock-phase mismatch", async () => {
    const world = await LabWorld.create("open");
    try {
      world.step([
        { actorId: "player", move: { x: 1, y: 0 } },
        companionHold()
      ]);
      const stale = world.latestAuthorityA0StepEvidence();
      world.step([
        { actorId: "player", move: { x: 0, y: 1 } },
        companionHold()
      ]);
      const current = world.snapshot();

      expect(() => buildA1Situation({
        snapshot: current,
        playerIntent: { actorId: "player", move: { x: 0, y: -1 } },
        playerCapability: world.actorMovementCapability("player"),
        companionCapability: world.actorMovementCapability("companion"),
        previousWorldStep: stale
      })).toThrow(/must end at current tick/);
    } finally {
      world.dispose();
    }
  });
});
