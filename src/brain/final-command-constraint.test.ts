import { describe, expect, it } from "vitest";
import { S2C_ROUTE_CLEARANCE } from "../navigation/static-router";
import { RapierPhysicalWorld, S0_STEP_SECONDS } from "../physics/rapier-physical-world";
import type { ScenarioSpec, Vec2 } from "../world/types";
import { constrainFinalCommand } from "./final-command-constraint";
import { MotionContinuityController } from "./motion-continuity";

const RADIUS = 0.3;
const SPEED = 3;
const WALL_LEFT_X = 5.5;
const HARD_MAX_X = WALL_LEFT_X - RADIUS;
const DESIRED_MAX_X = WALL_LEFT_X - RADIUS - S2C_ROUTE_CLEARANCE;

function fixtureAt(x: number): ScenarioSpec {
  return {
    id: "pillar",
    label: "R1 final-command constraint fixture",
    width: 12,
    height: 8,
    actors: [
      { id: "player", position: { x: 2, y: 4 }, radius: RADIUS, speed: SPEED },
      { id: "companion", position: { x, y: 4 }, radius: RADIUS, speed: SPEED }
    ],
    obstacles: [{ id: "r1.wall", x: WALL_LEFT_X, y: 0, width: 0.5, height: 8 }]
  };
}

function addScaled(origin: Vec2, move: Vec2, speed: number, seconds: number): Vec2 {
  return {
    x: origin.x + move.x * speed * seconds,
    y: origin.y + move.y * speed * seconds
  };
}

describe("R1-2B final hard-command constraint", () => {
  it("replaces continuity carry that would cross hard static geometry with a hard-safe preferred reversal", async () => {
    const start = { x: 5.18, y: 4 };
    const physical = await RapierPhysicalWorld.create(fixtureAt(start.x));
    const continuity = new MotionContinuityController();

    try {
      const shaped = continuity.step({
        currentVelocity: { x: SPEED, y: 0 },
        preferredMove: { x: -1, y: 0 },
        deltaSeconds: S0_STEP_SECONDS
      });
      const unsafeEnd = addScaled(start, shaped.commandedMove, SPEED, S0_STEP_SECONDS);
      const unsafeHard = physical.staticCircleTraversal(start, unsafeEnd, RADIUS);
      expect(shaped.commandedMove.x).toBeGreaterThan(0);
      expect(unsafeEnd.x).toBeGreaterThan(HARD_MAX_X);
      expect(unsafeHard.clear).toBe(false);
      expect(unsafeHard.blocker?.label).toBe("r1.wall");

      const constrained = constrainFinalCommand({
        position: start,
        radius: RADIUS,
        commandedMove: shaped.commandedMove,
        preferredMoves: [{ x: -1, y: 0 }],
        maxSpeed: SPEED,
        deltaSeconds: S0_STEP_SECONDS,
        query: (from, to, radius, options) => physical.staticCircleTraversal(from, to, radius, options)
      });
      const finalEnd = addScaled(start, constrained.finalMove, SPEED, S0_STEP_SECONDS);
      const finalHard = physical.staticCircleTraversal(start, finalEnd, RADIUS);

      expect(constrained.constrained).toBe(true);
      expect(constrained.source).toBe("preferred-fallback");
      expect(constrained.blockedBy).toBe("r1.wall");
      expect(constrained.finalMove.x).toBeLessThan(-0.5);
      expect(finalHard.clear).toBe(true);

      const after = physical.step([
        { actorId: "player", move: { x: 0, y: 0 } },
        { actorId: "companion", move: constrained.finalMove }
      ]);
      const companion = after.find((entry) => entry.id === "companion");
      if (!companion) throw new Error("R1-2B fixture missing companion after step.");
      expect(companion.position.x).toBeLessThan(start.x);
      expect(companion.position.x).toBeLessThanOrEqual(HARD_MAX_X);
      expect(companion.contacts.some((contact) => contact.with === "r1.wall")).toBe(false);
    } finally {
      physical.dispose();
    }
  });

  it("does not turn desired clearance back into a final-command hard law", async () => {
    const start = { x: 5.1, y: 4 };
    const physical = await RapierPhysicalWorld.create(fixtureAt(start.x));
    const continuity = new MotionContinuityController();

    try {
      const shaped = continuity.step({
        currentVelocity: { x: SPEED, y: 0 },
        preferredMove: { x: -1, y: 0 },
        deltaSeconds: S0_STEP_SECONDS
      });
      const commandedEnd = addScaled(start, shaped.commandedMove, SPEED, S0_STEP_SECONDS);
      const hard = physical.staticCircleTraversal(start, commandedEnd, RADIUS);
      const desired = physical.staticCircleTraversal(
        start,
        commandedEnd,
        RADIUS + S2C_ROUTE_CLEARANCE
      );
      expect(commandedEnd.x).toBeGreaterThan(DESIRED_MAX_X);
      expect(commandedEnd.x).toBeLessThan(HARD_MAX_X);
      expect(hard.clear).toBe(true);
      expect(desired.clear).toBe(false);

      const constrained = constrainFinalCommand({
        position: start,
        radius: RADIUS,
        commandedMove: shaped.commandedMove,
        preferredMoves: [{ x: -1, y: 0 }],
        maxSpeed: SPEED,
        deltaSeconds: S0_STEP_SECONDS,
        query: (from, to, radius, options) => physical.staticCircleTraversal(from, to, radius, options)
      });

      expect(constrained.constrained).toBe(false);
      expect(constrained.source).toBe("continuity");
      expect(constrained.finalMove.x).toBeCloseTo(shaped.commandedMove.x, 9);
      expect(constrained.finalMove.y).toBeCloseTo(shaped.commandedMove.y, 9);
    } finally {
      physical.dispose();
    }
  });

  it("falls back to explicit stop when neither continuity nor the supplied preferred move is hard-safe", async () => {
    const start = { x: 5.18, y: 4 };
    const physical = await RapierPhysicalWorld.create(fixtureAt(start.x));

    try {
      const result = constrainFinalCommand({
        position: start,
        radius: RADIUS,
        commandedMove: { x: 1, y: 0 },
        preferredMoves: [{ x: 1, y: 0 }],
        maxSpeed: SPEED,
        deltaSeconds: S0_STEP_SECONDS,
        query: (from, to, radius, options) => physical.staticCircleTraversal(from, to, radius, options)
      });

      expect(result.constrained).toBe(true);
      expect(result.source).toBe("stop-fallback");
      expect(result.finalMove).toEqual({ x: 0, y: 0 });
      expect(result.blockedBy).toBe("r1.wall");
    } finally {
      physical.dispose();
    }
  });
});
