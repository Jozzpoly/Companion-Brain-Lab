import { describe, expect, it } from "vitest";
import { planStaticShadowRoute } from "../navigation/static-router";
import { RapierPhysicalWorld } from "../physics/rapier-physical-world";
import type { ActorSnapshot, ScenarioSpec, WorldSnapshot } from "../world/types";
import { RelationalPositioningBrain } from "./relational-positioning";
import { evaluateR1SpatialLocomotion } from "./r1-hard-comfort-spatial";

const RADIUS = 0.3;
const SPEED = 3;

function snapshot(spec: ScenarioSpec, actors: readonly ActorSnapshot[], tick = 0): WorldSnapshot {
  return {
    tick,
    scenarioId: spec.id,
    width: spec.width,
    height: spec.height,
    actors,
    obstacles: spec.obstacles
  };
}

describe("foundation runtime-survival regressions", () => {
  it("does not terminate spatial evaluation when hard-overlap and an approaching player exhaust ordinary candidates", async () => {
    const fixture: ScenarioSpec = {
      id: "pillar",
      label: "foundation no-safe-velocity reproduction",
      width: 12,
      height: 8,
      actors: [
        { id: "companion", position: { x: 6.285, y: 4 }, radius: RADIUS, speed: SPEED },
        { id: "player", position: { x: 7.6, y: 4 }, radius: RADIUS, speed: SPEED }
      ],
      obstacles: [{ id: "foundation.wall", x: 5.5, y: 0, width: 0.5, height: 8 }]
    };
    const physical = await RapierPhysicalWorld.create(fixture);

    try {
      const actors = physical.snapshot().map((actor) => actor.id === "player"
        ? {
            ...actor,
            requestedVelocity: { x: -3, y: 0 },
            actualVelocity: { x: -3, y: 0 }
          }
        : actor
      );
      const world = snapshot(fixture, actors);
      const companion = world.actors.find((actor) => actor.id === "companion");
      if (!companion) throw new Error("foundation fixture missing companion");
      const target = { x: 8.8, y: 4 };
      const route = planStaticShadowRoute({
        snapshot: world,
        start: companion.position,
        target,
        radius: companion.radius,
        query: (from, to, radius, options) => physical.staticCircleTraversal(from, to, radius, options)
      });

      let evaluation: ReturnType<typeof evaluateR1SpatialLocomotion> | null = null;
      expect(() => {
        evaluation = evaluateR1SpatialLocomotion({
          snapshot: world,
          relationshipTarget: target,
          routePlan: route,
          query: (from, to, radius, options) => physical.staticCircleTraversal(from, to, radius, options),
          occupancy: (center, radius) => physical.staticCircleOccupancy(center, radius)
        });
      }).not.toThrow();

      expect(evaluation).not.toBeNull();
    } finally {
      physical.dispose();
    }
  });

  it("does not terminate relationship evaluation when no authored slot is currently legal", () => {
    const world: WorldSnapshot = {
      tick: 0,
      scenarioId: "open",
      width: 1,
      height: 1,
      actors: [
        {
          id: "player",
          position: { x: 0.5, y: 0.5 },
          radius: RADIUS,
          requestedVelocity: { x: 1, y: 0 },
          actualVelocity: { x: 1, y: 0 },
          motionError: 0,
          contacts: []
        },
        {
          id: "companion",
          position: { x: 0.5, y: 0.5 },
          radius: RADIUS,
          requestedVelocity: { x: 0, y: 0 },
          actualVelocity: { x: 0, y: 0 },
          motionError: 0,
          contacts: []
        }
      ],
      obstacles: []
    };

    const brain = new RelationalPositioningBrain();
    expect(() => brain.decision(world)).not.toThrow();
  });
});
