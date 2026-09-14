import { describe, expect, it } from "vitest";
import { planStaticShadowRoute } from "../navigation/static-router";
import type { ActorSnapshot, Vec2, WorldSnapshot } from "../world/types";
import { LabWorld } from "../world/world";
import { R1WorkbenchSpatialStack } from "./r1-workbench-spatial-stack";

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function companion(snapshot: WorldSnapshot): ActorSnapshot {
  const value = snapshot.actors.find((actor) => actor.id === "companion");
  if (!value) throw new Error("missing companion fixture");
  return value;
}

async function runActuator(natural: boolean) {
  const world = await LabWorld.create("open");
  const stack = new R1WorkbenchSpatialStack();
  const target = { x: 5, y: 4 };
  let snapshot = world.snapshot();
  let reached = false;

  try {
    for (let step = 0; step < 360; step += 1) {
      const beforeCompanion = companion(snapshot);
      const beforeRoute = planStaticShadowRoute({
        snapshot,
        start: beforeCompanion.position,
        target,
        radius: beforeCompanion.radius,
        query: (from, to, radius) => world.staticCircleTraversal(from, to, radius)
      });
      const intent = stack.intent(natural, {
        snapshot,
        relationshipTarget: target,
        routePlan: beforeRoute,
        query: (from, to, radius) => world.staticCircleTraversal(from, to, radius),
        occupancy: (center, radius) => world.staticCircleOccupancy(center, radius)
      });

      snapshot = world.step([
        { actorId: "player", move: { x: 0, y: 0 } },
        intent
      ]);
      const afterCompanion = companion(snapshot);
      const afterRoute = planStaticShadowRoute({
        snapshot,
        start: afterCompanion.position,
        target,
        radius: afterCompanion.radius,
        query: (from, to, radius) => world.staticCircleTraversal(from, to, radius)
      });
      stack.observeOutcome(natural, {
        snapshot,
        objectiveKey: "workbench-free-target:rev-1",
        target,
        routePlan: afterRoute
      });

      if (distance(afterCompanion.position, target) <= 0.2) {
        reached = true;
        break;
      }
    }

    return { reached, debug: stack.debugState(natural) };
  } finally {
    world.dispose();
  }
}

describe("R1-4/R1-5A workbench DIRECT/NATURAL A/B contract", () => {
  it("runs DIRECT through the repaired R1 spatial and post-outcome recovery contract", async () => {
    const result = await runActuator(false);

    expect(result.reached).toBe(true);
    expect(result.debug.actuator).toBe("direct");
    expect(result.debug.preferred).not.toBeNull();
    expect(result.debug.repair).not.toBeNull();
    expect(result.debug.progress?.state).toBe("ARRIVED");
    expect(result.debug.appliedLocalRetries).toBe(0);
    expect(result.debug.refinement).toBeNull();
    expect(result.debug.continuity).toBeNull();
    expect(result.debug.finalConstraint).toBeNull();
    expect(result.debug.finalPlayerConstraint).toBeNull();
  });

  it("runs NATURAL through the same repaired contract with temporal and both final-authority evidence layers", async () => {
    const result = await runActuator(true);

    expect(result.reached).toBe(true);
    expect(result.debug.actuator).toBe("natural");
    expect(result.debug.preferred).not.toBeNull();
    expect(result.debug.repair).not.toBeNull();
    expect(result.debug.progress?.state).toBe("ARRIVED");
    expect(result.debug.appliedLocalRetries).toBe(0);
    expect(result.debug.refinement).not.toBeNull();
    expect(result.debug.continuity).not.toBeNull();
    expect(result.debug.finalConstraint).not.toBeNull();
    expect(result.debug.finalPlayerConstraint).not.toBeNull();
    expect(result.debug.finalPlayerConstraint?.source).toBe("unchanged");
    expect(result.debug.finalPlayerConstraint?.constrained).toBe(false);
  });
});
