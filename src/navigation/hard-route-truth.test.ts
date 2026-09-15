import { describe, expect, it } from "vitest";
import { RapierPhysicalWorld } from "../physics/rapier-physical-world";
import type { ScenarioSpec, Vec2, WorldSnapshot } from "../world/types";
import { evaluateHardRouteTruth } from "./hard-route-truth";

async function narrowHardOnlyFixture() {
  const spec: ScenarioSpec = {
    id: "open",
    label: "A0 narrow hard-only passage",
    width: 12,
    height: 8,
    actors: [
      { id: "player", position: { x: 2, y: 7 }, radius: 0.3, speed: 3 },
      { id: "companion", position: { x: 8, y: 4 }, radius: 0.3, speed: 3 }
    ],
    obstacles: [
      { id: "hard-only-wall", x: 5.5, y: 0.7, width: 1, height: 7.3 }
    ]
  };
  const physical = await RapierPhysicalWorld.create(spec);
  const snapshot: WorldSnapshot = {
    tick: 17,
    scenarioId: "open",
    width: spec.width,
    height: spec.height,
    actors: physical.snapshot(),
    obstacles: spec.obstacles
  };
  return { spec, physical, snapshot };
}

describe("Authority-A0 hard route truth", () => {
  it("reports hard reachability separately when desired comfort erases graph connectivity", async () => {
    const fixture = await narrowHardOnlyFixture();
    try {
      const companion = fixture.snapshot.actors.find((actor) => actor.id === "companion");
      if (!companion) throw new Error("missing companion");
      const query = (from: Vec2, to: Vec2, radius: number, options?: Parameters<RapierPhysicalWorld["staticCircleTraversal"]>[3]) =>
        fixture.physical.staticCircleTraversal(from, to, radius, options);

      const evidence = evaluateHardRouteTruth({
        snapshot: fixture.snapshot,
        start: companion.position,
        target: { x: 3, y: 4 },
        radius: companion.radius,
        query
      });

      expect(evidence.sourceTick).toBe(17);
      expect(evidence.hardReachable).toBe(true);
      expect(evidence.hardStatus).toBe("routed");
      expect(evidence.desiredReachable).toBe(false);
      expect(evidence.desiredStatus).toBe("unreachable");
      expect(evidence.comfortErasesHardConnectivity).toBe(true);
    } finally {
      fixture.physical.dispose();
    }
  });

  it("does not fabricate a divergence when hard and desired routes agree", async () => {
    const spec: ScenarioSpec = {
      id: "open",
      label: "A0 open hard/comfort agreement",
      width: 12,
      height: 8,
      actors: [
        { id: "player", position: { x: 2, y: 6 }, radius: 0.3, speed: 3 },
        { id: "companion", position: { x: 8, y: 4 }, radius: 0.3, speed: 3 }
      ],
      obstacles: []
    };
    const physical = await RapierPhysicalWorld.create(spec);
    try {
      const snapshot: WorldSnapshot = {
        tick: 23,
        scenarioId: "open",
        width: spec.width,
        height: spec.height,
        actors: physical.snapshot(),
        obstacles: []
      };
      const companion = snapshot.actors.find((actor) => actor.id === "companion");
      if (!companion) throw new Error("missing companion");
      const query = (from: Vec2, to: Vec2, radius: number, options?: Parameters<RapierPhysicalWorld["staticCircleTraversal"]>[3]) =>
        physical.staticCircleTraversal(from, to, radius, options);

      const evidence = evaluateHardRouteTruth({
        snapshot,
        start: companion.position,
        target: { x: 3, y: 4 },
        radius: companion.radius,
        query
      });

      expect(evidence.sourceTick).toBe(23);
      expect(evidence.hardReachable).toBe(true);
      expect(evidence.desiredReachable).toBe(true);
      expect(evidence.comfortErasesHardConnectivity).toBe(false);
    } finally {
      physical.dispose();
    }
  });
});
