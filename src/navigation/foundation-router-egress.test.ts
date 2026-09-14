import { describe, expect, it } from "vitest";
import { RapierPhysicalWorld } from "../physics/rapier-physical-world";
import type { ScenarioSpec, WorldSnapshot } from "../world/types";
import { planStaticShadowRoute } from "./static-router";

const RADIUS = 0.3;

function snapshotFor(fixture: ScenarioSpec, physical: RapierPhysicalWorld): WorldSnapshot {
  return {
    tick: 0,
    scenarioId: fixture.id,
    width: fixture.width,
    height: fixture.height,
    actors: physical.snapshot(),
    obstacles: fixture.obstacles
  };
}

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
      const snapshot = snapshotFor(fixture, physical);
      const companion = snapshot.actors.find((actor) => actor.id === "companion");
      if (!companion) throw new Error("fixture missing companion");
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

  it("does not turn exact legal world-boundary contact into a false unreachable route", async () => {
    const fixture: ScenarioSpec = {
      id: "open",
      label: "exact left-boundary contact",
      width: 12,
      height: 8,
      actors: [
        { id: "companion", position: { x: RADIUS, y: 4 }, radius: RADIUS, speed: 3 },
        { id: "player", position: { x: 9.5, y: 4 }, radius: RADIUS, speed: 3 }
      ],
      obstacles: []
    };
    const physical = await RapierPhysicalWorld.create(fixture);

    try {
      const snapshot = snapshotFor(fixture, physical);
      const companion = snapshot.actors.find((actor) => actor.id === "companion");
      if (!companion) throw new Error("fixture missing companion");

      const defaultSweep = physical.staticCircleTraversal(
        companion.position,
        { x: 2, y: 4 },
        companion.radius
      );
      const egressSweep = physical.staticCircleTraversal(
        companion.position,
        { x: 2, y: 4 },
        companion.radius,
        { initialOverlap: "allow-egress" }
      );
      const result = planStaticShadowRoute({
        snapshot,
        start: companion.position,
        target: { x: 2, y: 4 },
        radius: companion.radius,
        query: (from, to, radius, options) => physical.staticCircleTraversal(from, to, radius, options)
      });

      expect(defaultSweep.clear).toBe(false);
      expect(defaultSweep.blocker?.label).toBe("boundary.left");
      expect(defaultSweep.blocker?.distance).toBeCloseTo(0, 6);
      expect(egressSweep.clear).toBe(true);
      expect(result.status).toBe("direct");
      expect(result.routeNodeIds).toEqual(["start", "target"]);
      expect(result.edges.find((edge) => edge.id === "start<->target")?.clear).toBe(true);
    } finally {
      physical.dispose();
    }
  });
});
