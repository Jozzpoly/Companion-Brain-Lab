import { describe, expect, it } from "vitest";
import { S2C_ROUTE_CLEARANCE, planStaticShadowRoute } from "../navigation/static-router";
import { RapierPhysicalWorld } from "../physics/rapier-physical-world";
import type { ActorSnapshot, ScenarioSpec, WorldSnapshot } from "../world/types";
import { SpatialLocomotionBrain } from "./spatial-locomotion";

const RADIUS = 0.3;
const SPEED = 3;
const WALL_RIGHT_X = 6.0;
const DESIRED_MIN_X = WALL_RIGHT_X + RADIUS + S2C_ROUTE_CLEARANCE;

const fixture: ScenarioSpec = {
  id: "pillar",
  label: "R1 external clearance release probe",
  width: 12,
  height: 8,
  actors: [
    { id: "player", position: { x: 10, y: 4 }, radius: RADIUS, speed: SPEED },
    { id: "companion", position: { x: 6.35, y: 4 }, radius: RADIUS, speed: SPEED }
  ],
  obstacles: [
    { id: "r1.wall", x: 5.5, y: 0, width: 0.5, height: 8 }
  ]
};

function snapshot(tick: number, actors: readonly ActorSnapshot[]): WorldSnapshot {
  return {
    tick,
    scenarioId: fixture.id,
    width: fixture.width,
    height: fixture.height,
    actors,
    obstacles: fixture.obstacles
  };
}

function companion(value: WorldSnapshot): ActorSnapshot {
  const result = value.actors.find((actor) => actor.id === "companion");
  if (!result) throw new Error("R1 release probe missing companion.");
  return result;
}

describe("R1-0 external clearance release probe", () => {
  it("shows that cached HOLD is not persistent once an external command restores valid desired clearance", async () => {
    const physical = await RapierPhysicalWorld.create(fixture);
    const brain = new SpatialLocomotionBrain();
    const target = { x: 9, y: 4 };
    let tick = 0;
    let world = snapshot(tick, physical.snapshot());

    try {
      expect(companion(world).position.x).toBeLessThan(DESIRED_MIN_X);

      const blockedRoute = planStaticShadowRoute({
        snapshot: world,
        start: companion(world).position,
        target,
        radius: RADIUS,
        query: (from, to, radius) => physical.staticCircleTraversal(from, to, radius)
      });
      const blockedIntent = brain.intent({
        snapshot: world,
        relationshipTarget: target,
        routePlan: blockedRoute,
        query: (from, to, radius) => physical.staticCircleTraversal(from, to, radius)
      });
      const blockedDecision = brain.debugState();

      expect(blockedRoute.status).toBe("unreachable");
      expect(blockedDecision?.state).toBe("HOLD");
      expect(blockedIntent.move).toEqual({ x: 0, y: 0 });

      // Bypass autonomous movement only for this probe and physically carry the
      // companion back outside the desired-clearance band. This asks whether
      // the brain itself remains stale after its evidence becomes valid again.
      for (let step = 0; step < 4; step += 1) {
        const actors = physical.step([
          { actorId: "player", move: { x: 0, y: 0 } },
          { actorId: "companion", move: { x: 1, y: 0 } }
        ]);
        tick += 1;
        world = snapshot(tick, actors);
      }

      expect(companion(world).position.x).toBeGreaterThan(DESIRED_MIN_X + 0.05);

      const recoveredRoute = planStaticShadowRoute({
        snapshot: world,
        start: companion(world).position,
        target,
        radius: RADIUS,
        query: (from, to, radius) => physical.staticCircleTraversal(from, to, radius)
      });
      const recoveredIntent = brain.intent({
        snapshot: world,
        relationshipTarget: target,
        routePlan: recoveredRoute,
        query: (from, to, radius) => physical.staticCircleTraversal(from, to, radius)
      });
      const recoveredDecision = brain.debugState();

      expect(recoveredRoute.status).toBe("direct");
      expect(recoveredDecision?.state).not.toBe("HOLD");
      expect(recoveredIntent.move.x).toBeGreaterThan(0.05);
    } finally {
      physical.dispose();
    }
  });
});
