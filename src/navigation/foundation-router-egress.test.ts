import { describe, expect, it } from "vitest";
import { RapierPhysicalWorld } from "../physics/rapier-physical-world";
import type { ScenarioSpec, WorldSnapshot } from "../world/types";
import { planStaticShadowRoute } from "./static-router";

const RADIUS = 0.3;

describe("foundation route egress semantics", () => {
  it("keeps an outward route reachable when physics leaves the body slightly inside static geometry", async () => {
    const fixture: ScenarioSpec = {
      id: "pillar",
      label: "hard-overlap route egress",
      width: 12,
      height: 8,
      actors: [
        { id: "companion", position: { x: 6.285, y: 4 }, radius: RADIUS, speed: 3 },
        { id: "player", position: { x: 9.5, y: 4 }, radius: RADIUS, speed: 3 }
      ],
      obstacles: [{ id: "foundation.wall", x: 5.5, y: 0, width: 0.5, height: 8 }]
    };
    const physical = await RapierPhysicalWorld.create(fixture);

    try {
      const actors = physical.snapshot();
      const companion = actors.find((actor) => actor.id === "companion");
      if (!companion) throw new Error("fixture missing companion");
      const snapshot: WorldSnapshot = {
        tick: 0,
        scenarioId: fixture.id,
        width: fixture.width,
        height: fixture.height,
        actors,
        obstacles: fixture.obstacles
      };
      const result = planStaticShadowRoute({
        snapshot,
        start: companion.position,
        target: { x: 8.8, y: 4 },
        radius: companion.radius,
        query: (from, to, radius, options) => physical.staticCircleTraversal(from, to, radius, options)
      });

      expect(result.status).toBe("direct");
      expect(result.reason).toContain("egress");
      expect(result.routeNodeIds).toEqual(["start", "target"]);
      expect(result.edges.find((edge) => edge.id === "start<->target")?.clear).toBe(true);
    } finally {
      physical.dispose();
    }
  });
});
