import { describe, expect, it } from "vitest";
import { decideStageBPartnerAction } from "./stage-b-partner";
import { R1WorkbenchSpatialStack } from "./r1-workbench-spatial-stack";
import { planStaticShadowRoute } from "../navigation/static-router";
import { LabWorld } from "../world/world";
import type { ActorSnapshot, Vec2, WorldSnapshot } from "../world/types";

function actor(snapshot: WorldSnapshot, id: "player" | "companion"): ActorSnapshot {
  const found = snapshot.actors.find((value) => value.id === id);
  if (!found) throw new Error(`missing ${id}`);
  return found;
}

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

describe("Stage B live teammate vertical slice", () => {
  it("lets the ordinary NATURAL companion intercept an advancing threat without player input, contain it, and regroup", async () => {
    const world = await LabWorld.create("open");
    const stack = new R1WorkbenchSpatialStack();
    let snapshot = world.snapshot();

    let sawRespond = false;
    let containedByCompanion = false;
    let sawRegroupAfterContainment = false;
    let containmentDistance = Number.POSITIVE_INFINITY;
    let firstThreatTarget: Vec2 | null = null;
    let maximumThreatDisplacement = 0;

    try {
      for (let step = 0; step < 900; step += 1) {
        const pressureBefore = world.sharedPressure();
        const action = decideStageBPartnerAction(pressureBefore);
        if (action.kind === "RESPOND_TO_THREAT" && action.target) {
          sawRespond = true;
          if (!firstThreatTarget) firstThreatTarget = { ...action.target };
          maximumThreatDisplacement = Math.max(
            maximumThreatDisplacement,
            distance(firstThreatTarget, action.target)
          );
        }
        if (containedByCompanion && action.kind === "REGROUP") {
          sawRegroupAfterContainment = true;
        }

        const player = actor(snapshot, "player");
        const companion = actor(snapshot, "companion");
        const relationshipTarget = {
          x: player.position.x + 1.6,
          y: player.position.y
        };
        const liveTarget = action.target ?? relationshipTarget;
        const route = planStaticShadowRoute({
          snapshot,
          start: companion.position,
          target: liveTarget,
          radius: companion.radius,
          query: (from, to, radius) => world.staticCircleTraversal(from, to, radius)
        });

        const companionIntent = stack.intent(true, {
          snapshot,
          relationshipTarget: liveTarget,
          shadowLegacyRelationshipTarget: relationshipTarget,
          routePlan: route,
          query: (from, to, radius) => world.staticCircleTraversal(from, to, radius),
          occupancy: (center, radius) => world.staticCircleOccupancy(center, radius)
        });

        snapshot = world.step([
          { actorId: "player", move: { x: 0, y: 0 } },
          companionIntent
        ]);

        const afterCompanion = actor(snapshot, "companion");
        const afterRoute = planStaticShadowRoute({
          snapshot,
          start: afterCompanion.position,
          target: liveTarget,
          radius: afterCompanion.radius,
          query: (from, to, radius) => world.staticCircleTraversal(from, to, radius)
        });
        stack.observeOutcome(true, {
          snapshot,
          objectiveKey: action.objectiveKey ?? "stage-b-regroup",
          target: liveTarget,
          routePlan: afterRoute
        });

        const pressureAfter = world.sharedPressure();
        if (
          pressureAfter.lastOutcome === "CONTAINED" &&
          pressureAfter.lastResolvedBy === "companion"
        ) {
          containedByCompanion = true;
          if (pressureAfter.target) {
            containmentDistance = distance(afterCompanion.position, pressureAfter.target);
          }
        }

        if (containedByCompanion && sawRegroupAfterContainment) break;
      }

      const finalPressure = world.sharedPressure();
      expect(sawRespond).toBe(true);
      expect(maximumThreatDisplacement).toBeGreaterThan(0.1);
      expect(containedByCompanion).toBe(true);
      expect(containmentDistance).toBeLessThanOrEqual(finalPressure.responseRadius + 0.03);
      expect(sawRegroupAfterContainment).toBe(true);
      expect(finalPressure.breaches).toBe(0);
      expect(stack.debugState(true).shadowCoordinationError).toBeNull();
    } finally {
      world.dispose();
    }
  });
});
