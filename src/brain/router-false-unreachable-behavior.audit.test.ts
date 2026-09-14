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

describe("behavior-forensics: false route authority propagation", () => {
  it("a hard-feasible narrow passage can be reported persistently unreachable by the comfort-coupled router", async () => {
    const spec: ScenarioSpec = {
      id: "open",
      label: "forensics narrow hard-only passage",
      width: 12,
      height: 8,
      actors: [
        { id: "player", position: { x: 2, y: 7 }, radius: 0.3, speed: 3 },
        { id: "companion", position: { x: 8, y: 4 }, radius: 0.3, speed: 3 }
      ],
      obstacles: [{ id: "hard-only-wall", x: 5.5, y: 0.7, width: 1, height: 7.3 }]
    };
    const physical = await RapierPhysicalWorld.create(spec);
    const brain = new R1RecoveringNaturalSpatialBrain();
    const target = { x: 3, y: 4 };
    let tick = 0;
    let snapshot: WorldSnapshot = {
      tick,
      scenarioId: "open",
      width: spec.width,
      height: spec.height,
      actors: physical.snapshot(),
      obstacles: spec.obstacles
    };
    const query = (from: Vec2, to: Vec2, radius: number, options?: Parameters<RapierPhysicalWorld["staticCircleTraversal"]>[3]) =>
      physical.staticCircleTraversal(from, to, radius, options);

    try {
      const initialCompanion = actor(snapshot, "companion");
      const hardTruth = planStaticShadowRoute({
        snapshot,
        start: initialCompanion.position,
        target,
        radius: initialCompanion.radius,
        clearance: 0,
        query
      });
      const defaultPlan = planStaticShadowRoute({
        snapshot,
        start: initialCompanion.position,
        target,
        radius: initialCompanion.radius,
        query
      });
      expect(hardTruth.status).toBe("routed");
      expect(defaultPlan.status).toBe("unreachable");

      let falsePersistentReport = false;
      for (let step = 0; step < 90; step += 1) {
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
          { actorId: "player", move: { x: 0, y: 0 } },
          intent
        ]);
        tick += 1;
        snapshot = {
          tick,
          scenarioId: "open",
          width: spec.width,
          height: spec.height,
          actors,
          obstacles: spec.obstacles
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
          objectiveKey: "hard-feasible-narrow-target",
          target,
          routePlan: postRoute
        });
        if (progress.state === "PERSISTENT_UNREACHABLE" || progress.action === "REPORT_UNREACHABLE") {
          const hardPost = planStaticShadowRoute({
            snapshot,
            start: afterCompanion.position,
            target,
            radius: afterCompanion.radius,
            clearance: 0,
            query
          });
          if (hardPost.status === "direct" || hardPost.status === "routed") {
            falsePersistentReport = true;
            break;
          }
        }
      }

      expect(falsePersistentReport).toBe(true);
    } finally {
      physical.dispose();
    }
  });
});
