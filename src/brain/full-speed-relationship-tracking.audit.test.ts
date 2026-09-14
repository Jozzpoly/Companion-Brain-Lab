import { describe, expect, it } from "vitest";
import { planStaticShadowRoute } from "../navigation/static-router";
import { RapierPhysicalWorld } from "../physics/rapier-physical-world";
import type { ScenarioSpec, Vec2, WorldSnapshot } from "../world/types";
import { R1RecoveringNaturalSpatialBrain } from "./r1-recovering-natural-spatial";

function actor(snapshot: WorldSnapshot, id: "player" | "companion") {
  const value = snapshot.actors.find((entry) => entry.id === id);
  if (!value) throw new Error(`missing ${id}`);
  return value;
}

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

describe("behavior-forensics: full-speed relationship tracking", () => {
  it("loses an initially satisfied 1.45m back relationship while the player sustains full speed", async () => {
    const spec: ScenarioSpec = {
      id: "open",
      label: "forensics full-speed relationship",
      width: 40,
      height: 10,
      actors: [
        { id: "player", position: { x: 5, y: 5 }, radius: 0.3, speed: 3 },
        { id: "companion", position: { x: 3.55, y: 5 }, radius: 0.3, speed: 3 }
      ],
      obstacles: []
    };
    const physical = await RapierPhysicalWorld.create(spec);
    const brain = new R1RecoveringNaturalSpatialBrain();
    let tick = 0;
    let snapshot: WorldSnapshot = {
      tick,
      scenarioId: "open",
      width: spec.width,
      height: spec.height,
      actors: physical.snapshot(),
      obstacles: []
    };
    let target = { x: 3.55, y: 5 };
    let maximumError = 0;
    let sawRetry = false;

    const query = (from: Vec2, to: Vec2, radius: number, options?: Parameters<RapierPhysicalWorld["staticCircleTraversal"]>[3]) =>
      physical.staticCircleTraversal(from, to, radius, options);

    try {
      for (let step = 0; step < 300; step += 1) {
        if (tick % 6 === 0) {
          const player = actor(snapshot, "player");
          target = { x: player.position.x - 1.45, y: player.position.y };
        }
        const companion = actor(snapshot, "companion");
        const route = planStaticShadowRoute({
          snapshot,
          start: companion.position,
          target,
          radius: companion.radius,
          query
        });
        const intent = brain.intent({
          snapshot,
          relationshipTarget: target,
          routePlan: route,
          query,
          occupancy: (center, radius) => physical.staticCircleOccupancy(center, radius)
        });
        const actors = physical.step([
          { actorId: "player", move: { x: 1, y: 0 } },
          intent
        ]);
        tick += 1;
        snapshot = {
          tick,
          scenarioId: "open",
          width: spec.width,
          height: spec.height,
          actors,
          obstacles: []
        };
        const afterCompanion = actor(snapshot, "companion");
        const postRoute = planStaticShadowRoute({
          snapshot,
          start: afterCompanion.position,
          target,
          radius: afterCompanion.radius,
          query
        });
        const progress = brain.observeOutcome({
          snapshot,
          objectiveKey: "back-slot-stable",
          target,
          routePlan: postRoute
        });
        if (progress.action === "RETRY_LOCAL") sawRetry = true;
        maximumError = Math.max(maximumError, distance(afterCompanion.position, target));
      }

      const finalError = distance(actor(snapshot, "companion").position, target);
      expect(finalError).toBeGreaterThan(2);
      expect(maximumError).toBeGreaterThan(2);
      expect(sawRetry).toBe(true);
    } finally {
      physical.dispose();
    }
  });
});
