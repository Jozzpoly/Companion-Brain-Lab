import { describe, expect, it } from "vitest";
import { LabWorld } from "../world/world";
import type { MotionIntent } from "../world/types";
import { buildA1Situation } from "./a1-situation";

function companionHold(): MotionIntent {
  return { actorId: "companion", move: { x: 0, y: 0 } };
}

describe("Authority-A1 decision-time situation", () => {
  it("exposes same-step Owner request before World while keeping initial body state separate", async () => {
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

  it("sees a same-tick reversal immediately while preserving the previous completed World response", async () => {
    const world = await LabWorld.create("open");
    try {
      const beforeReversal = world.step([
        { actorId: "player", move: { x: 1, y: 0 } },
        companionHold()
      ]);
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

      // The decision snapshot is the rich t1 outcome returned by World.step(t0 -> t1).
      expect(situation.situated.playerBody.sourceTick).toBe(1);
      expect(situation.situated.playerBody.requestedVelocity.x).toBeGreaterThan(2.9);
      expect(situation.previousOutcome?.scenarioId).toBe("open");
      expect(situation.previousOutcome?.observationTick).toBe(0);
      expect(situation.previousOutcome?.outcomeTick).toBe(1);
      expect(situation.previousOutcome?.ageTicks).toBe(0);
      expect(situation.previousOutcome?.playerBody.requestedVelocity.x).toBeGreaterThan(2.9);

      // Current Owner intent has already reversed at exactly the same decision tick.
      expect(situation.playerRequestedVelocity.velocity.x).toBeLessThan(-2.9);
    } finally {
      world.dispose();
    }
  });

  it("rejects a fresh LabWorld.snapshot substitute when it erases prior-step kinematic evidence", async () => {
    const world = await LabWorld.create("open");
    try {
      world.step([
        { actorId: "player", move: { x: 1, y: 0 } },
        companionHold()
      ]);
      const neutralizedSnapshot = world.snapshot();

      expect(() => buildA1Situation({
        snapshot: neutralizedSnapshot,
        playerIntent: { actorId: "player", move: { x: -1, y: 0 } },
        playerCapability: world.actorMovementCapability("player"),
        companionCapability: world.actorMovementCapability("companion"),
        previousWorldStep: world.latestAuthorityA0StepEvidence()
      })).toThrow(/live snapshot returned by the immediately preceding World\.step/);
    } finally {
      world.dispose();
    }
  });

  it("matches real World normalization for an over-unit MotionIntent instead of overestimating requested speed", async () => {
    const world = await LabWorld.create("open");
    try {
      const before = world.snapshot();
      const playerIntent: MotionIntent = { actorId: "player", move: { x: 1.2, y: 0.9 } };
      const situation = buildA1Situation({
        snapshot: before,
        playerIntent,
        playerCapability: world.actorMovementCapability("player"),
        companionCapability: world.actorMovementCapability("companion"),
        previousWorldStep: null
      });
      const after = world.step([playerIntent, companionHold()]);
      const player = after.actors.find((value) => value.id === "player");
      if (!player) throw new Error("missing player");

      expect(Math.hypot(situation.playerRequestedVelocity.move.x, situation.playerRequestedVelocity.move.y)).toBeCloseTo(1, 12);
      expect(situation.playerRequestedVelocity.speed).toBeCloseTo(3, 12);
      expect(situation.playerRequestedVelocity.velocity.x).toBeCloseTo(player.requestedVelocity.x, 12);
      expect(situation.playerRequestedVelocity.velocity.y).toBeCloseTo(player.requestedVelocity.y, 12);
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
      const current = world.step([
        { actorId: "player", move: { x: 0, y: 1 } },
        companionHold()
      ]);

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

  it("rejects previous World evidence from another scenario even when its tick phase happens to match", async () => {
    const openWorld = await LabWorld.create("open");
    const pillarWorld = await LabWorld.create("pillar");
    try {
      openWorld.step([
        { actorId: "player", move: { x: 1, y: 0 } },
        companionHold()
      ]);
      const wrongScenarioEvidence = openWorld.latestAuthorityA0StepEvidence();
      const pillarCurrent = pillarWorld.step([
        { actorId: "player", move: { x: 0, y: 1 } },
        companionHold()
      ]);

      expect(pillarCurrent.tick).toBe(1);
      expect(wrongScenarioEvidence?.outcomeTick).toBe(1);
      expect(() => buildA1Situation({
        snapshot: pillarCurrent,
        playerIntent: { actorId: "player", move: { x: 0, y: -1 } },
        playerCapability: pillarWorld.actorMovementCapability("player"),
        companionCapability: pillarWorld.actorMovementCapability("companion"),
        previousWorldStep: wrongScenarioEvidence
      })).toThrow(/does not match current scenario/);
    } finally {
      openWorld.dispose();
      pillarWorld.dispose();
    }
  });

  it("rejects actor/capability identity mismatches instead of silently rescaling with the wrong actor contract", async () => {
    const world = await LabWorld.create("open");
    try {
      const snapshot = world.snapshot();
      const playerCapability = world.actorMovementCapability("player");
      const companionCapability = world.actorMovementCapability("companion");

      expect(() => buildA1Situation({
        snapshot,
        playerIntent: { actorId: "player", move: { x: 1, y: 0 } },
        playerCapability: companionCapability,
        companionCapability,
        previousWorldStep: null
      })).toThrow(/player movement capability/);

      expect(() => buildA1Situation({
        snapshot,
        playerIntent: { actorId: "player", move: { x: 1, y: 0 } },
        playerCapability,
        companionCapability: playerCapability,
        previousWorldStep: null
      })).toThrow(/companion movement capability/);
    } finally {
      world.dispose();
    }
  });
});