import { describe, expect, it } from "vitest";
import { S2C_ROUTE_CLEARANCE } from "../navigation/static-router";
import { S0_STEP_SECONDS, RapierPhysicalWorld } from "../physics/rapier-physical-world";
import type { ScenarioSpec, Vec2 } from "../world/types";
import { MotionContinuityController } from "./motion-continuity";

const RADIUS = 0.3;
const SPEED = 3;
const WALL_LEFT_X = 5.5;
const DESIRED_MAX_X = WALL_LEFT_X - RADIUS - S2C_ROUTE_CLEARANCE;
const HARD_MAX_X = WALL_LEFT_X - RADIUS;

const fixture: ScenarioSpec = {
  id: "pillar",
  label: "R1 actuator-boundary probe",
  width: 12,
  height: 8,
  actors: [
    { id: "player", position: { x: 2, y: 4 }, radius: RADIUS, speed: SPEED },
    { id: "companion", position: { x: 5.1, y: 4 }, radius: RADIUS, speed: SPEED }
  ],
  obstacles: [
    { id: "r1.wall", x: WALL_LEFT_X, y: 0, width: 0.5, height: 8 }
  ]
};

function addScaled(origin: Vec2, velocity: Vec2, seconds: number): Vec2 {
  return {
    x: origin.x + velocity.x * seconds,
    y: origin.y + velocity.y * seconds
  };
}

describe("R1-0 S4 final-command safety probe", () => {
  it("demonstrates that a safe preferred reversal can become a desired-clearance-violating final command", async () => {
    const physical = await RapierPhysicalWorld.create(fixture);
    const controller = new MotionContinuityController();

    try {
      const start = { x: 5.1, y: 4 };
      expect(start.x).toBeLessThan(DESIRED_MAX_X);

      // Simulate the exact temporal situation S4 exists to create: the body is
      // still moving toward the wall at full speed when the spatial brain changes
      // its preferred motion to a full reversal directly away from the wall.
      const shaped = controller.step({
        currentVelocity: { x: SPEED, y: 0 },
        preferredMove: { x: -1, y: 0 },
        deltaSeconds: S0_STEP_SECONDS
      });

      const preferredEnd = addScaled(start, shaped.preferredVelocity, S0_STEP_SECONDS);
      const commandedEnd = addScaled(start, shaped.commandedVelocity, S0_STEP_SECONDS);

      const preferredDesired = physical.staticCircleTraversal(
        start,
        preferredEnd,
        RADIUS + S2C_ROUTE_CLEARANCE
      );
      const commandedDesired = physical.staticCircleTraversal(
        start,
        commandedEnd,
        RADIUS + S2C_ROUTE_CLEARANCE
      );
      const commandedHard = physical.staticCircleTraversal(
        start,
        commandedEnd,
        RADIUS
      );

      // Upstream preferred motion is safe and moves away from the obstacle.
      expect(shaped.preferredVelocity.x).toBeLessThan(0);
      expect(preferredDesired.clear).toBe(true);

      // Temporal continuity deliberately preserves old momentum on the first tick.
      // That final command still points toward the wall strongly enough to cross
      // the desired-clearance boundary, despite remaining hard-body legal.
      expect(shaped.commandedVelocity.x).toBeGreaterThan(0);
      expect(commandedEnd.x).toBeGreaterThan(DESIRED_MAX_X);
      expect(commandedEnd.x).toBeLessThan(HARD_MAX_X);
      expect(commandedDesired.clear).toBe(false);
      expect(commandedDesired.blocker?.label).toBe("r1.wall");
      expect(commandedHard.clear).toBe(true);

      // Confirm the real physical step accepts the S4 final command and actually
      // places the companion inside the desired-clearance-invalid band.
      const after = physical.step([
        { actorId: "player", move: { x: 0, y: 0 } },
        { actorId: "companion", move: shaped.commandedMove }
      ]);
      const companion = after.find((actor) => actor.id === "companion");
      if (!companion) throw new Error("R1 actuator probe missing companion after World step.");

      expect(companion.position.x).toBeGreaterThan(DESIRED_MAX_X);
      expect(companion.position.x).toBeLessThanOrEqual(HARD_MAX_X + 1e-4);
      expect(companion.contacts.some((contact) => contact.with === "r1.wall")).toBe(false);
    } finally {
      physical.dispose();
    }
  });
});
