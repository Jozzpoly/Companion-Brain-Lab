import { describe, expect, it } from "vitest";
import { planStaticShadowRoute, type StaticRoutePlan } from "../navigation/static-router";
import type { ActorSnapshot, Vec2, WorldSnapshot } from "../world/types";
import { LabWorld } from "../world/world";
import { R1RecoveringNaturalSpatialBrain } from "./r1-recovering-natural-spatial";

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function companion(snapshot: WorldSnapshot): ActorSnapshot {
  const value = snapshot.actors.find((actor) => actor.id === "companion");
  if (!value) throw new Error("missing companion fixture");
  return value;
}

function route(world: LabWorld, snapshot: WorldSnapshot, target: Vec2): StaticRoutePlan {
  const actor = companion(snapshot);
  return planStaticShadowRoute({
    snapshot,
    start: actor.position,
    target,
    radius: actor.radius,
    query: (from, to, radius) => world.staticCircleTraversal(from, to, radius)
  });
}

function patchedCompanion(
  snapshot: WorldSnapshot,
  tick: number,
  patch: Partial<ActorSnapshot>
): WorldSnapshot {
  return {
    ...snapshot,
    tick,
    actors: snapshot.actors.map((actor) => actor.id === "companion"
      ? {
          ...actor,
          ...patch,
          position: patch.position ? { ...patch.position } : { ...actor.position },
          requestedVelocity: patch.requestedVelocity ? { ...patch.requestedVelocity } : { ...actor.requestedVelocity },
          actualVelocity: patch.actualVelocity ? { ...patch.actualVelocity } : { ...actor.actualVelocity },
          contacts: patch.contacts ? [...patch.contacts] : [...actor.contacts]
        }
      : {
          ...actor,
          position: { ...actor.position },
          requestedVelocity: { ...actor.requestedVelocity },
          actualVelocity: { ...actor.actualVelocity },
          contacts: [...actor.contacts]
        })
  };
}

describe("R1-4 post-outcome recovery authority", () => {
  it("does not spend retry budget during ordinary open-space progress", async () => {
    const world = await LabWorld.create("open");
    const brain = new R1RecoveringNaturalSpatialBrain();
    const target = { x: 3, y: 4 };
    let snapshot = world.snapshot();
    let reached = false;

    try {
      for (let step = 0; step < 360; step += 1) {
        const beforeRoute = route(world, snapshot, target);
        const intent = brain.intent({
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
        const afterRoute = route(world, snapshot, target);
        brain.observeOutcome({
          snapshot,
          objectiveKey: "open-target:rev-1",
          target,
          routePlan: afterRoute
        });

        if (distance(companion(snapshot).position, target) <= 0.2) {
          reached = true;
          break;
        }
      }

      expect(reached).toBe(true);
      expect(brain.debugState().appliedLocalRetries).toBe(0);
      expect(["ARRIVED", "PROGRESSING"]).toContain(brain.debugState().progress?.state);
    } finally {
      world.dispose();
    }
  });

  it("waits through player blocking, then applies exactly one local retry after conflict clears", async () => {
    const world = await LabWorld.create("open");
    const brain = new R1RecoveringNaturalSpatialBrain();
    const target = { x: 3, y: 4 };
    const snapshot = world.snapshot();
    const currentRoute = route(world, snapshot, target);

    try {
      brain.intent({
        snapshot,
        relationshipTarget: target,
        routePlan: currentRoute,
        query: (from, to, radius) => world.staticCircleTraversal(from, to, radius),
        occupancy: (center, radius) => world.staticCircleOccupancy(center, radius)
      });
      expect(brain.debugState().movement.preferred).not.toBeNull();

      const blocked = patchedCompanion(snapshot, 1, {
        requestedVelocity: { x: -1, y: 0 },
        actualVelocity: { x: 0, y: 0 },
        contacts: [{ with: "player", contactCount: 1 }]
      });
      const blockedDecision = brain.observeOutcome({
        snapshot: blocked,
        objectiveKey: "follow-slot:rev-1",
        target,
        routePlan: currentRoute
      });
      expect(blockedDecision.state).toBe("BLOCKED_PLAYER");
      expect(blockedDecision.action).toBe("WAIT_CONFLICT");
      expect(brain.debugState().movement.preferred).not.toBeNull();
      expect(brain.debugState().appliedLocalRetries).toBe(0);

      const cleared = patchedCompanion(snapshot, 2, {
        requestedVelocity: { x: -1, y: 0 },
        actualVelocity: { x: 0, y: 0 },
        contacts: []
      });
      const clearedDecision = brain.observeOutcome({
        snapshot: cleared,
        objectiveKey: "follow-slot:rev-1",
        target,
        routePlan: currentRoute
      });
      expect(clearedDecision.state).toBe("RECOVERING");
      expect(clearedDecision.action).toBe("RETRY_LOCAL");
      expect(brain.debugState().appliedLocalRetries).toBe(1);
      expect(brain.debugState().movement.preferred).toBeNull();
      expect(brain.debugState().movement.continuity).toBeNull();
    } finally {
      world.dispose();
    }
  });

  it("applies one local retry when a transient unreachable route becomes reachable again", async () => {
    const world = await LabWorld.create("open");
    const brain = new R1RecoveringNaturalSpatialBrain();
    const target = { x: 3, y: 4 };
    const snapshot = world.snapshot();
    const direct = route(world, snapshot, target);
    const unreachable: StaticRoutePlan = {
      ...direct,
      status: "unreachable",
      reason: "synthetic transient regression fixture",
      routeNodeIds: [],
      waypoints: [],
      cost: null
    };

    try {
      brain.intent({
        snapshot,
        relationshipTarget: target,
        routePlan: direct,
        query: (from, to, radius) => world.staticCircleTraversal(from, to, radius),
        occupancy: (center, radius) => world.staticCircleOccupancy(center, radius)
      });

      const unreachableDecision = brain.observeOutcome({
        snapshot: patchedCompanion(snapshot, 1, {
          requestedVelocity: { x: 0, y: 0 },
          actualVelocity: { x: 0, y: 0 }
        }),
        objectiveKey: "route-fixture:rev-1",
        target,
        routePlan: unreachable
      });
      expect(unreachableDecision.state).toBe("TRANSIENT_UNREACHABLE");
      expect(unreachableDecision.action).toBe("NONE");
      expect(brain.debugState().movement.preferred).not.toBeNull();

      const restoredDecision = brain.observeOutcome({
        snapshot: patchedCompanion(snapshot, 2, {
          requestedVelocity: { x: 0, y: 0 },
          actualVelocity: { x: 0, y: 0 }
        }),
        objectiveKey: "route-fixture:rev-1",
        target,
        routePlan: direct
      });
      expect(restoredDecision.state).toBe("RECOVERING");
      expect(restoredDecision.action).toBe("RETRY_LOCAL");
      expect(brain.debugState().appliedLocalRetries).toBe(1);
      expect(brain.debugState().movement.preferred).toBeNull();
    } finally {
      world.dispose();
    }
  });

  it("surfaces invalid-target reconsideration without pretending local movement can repair the objective", async () => {
    const world = await LabWorld.create("pillar");
    const brain = new R1RecoveringNaturalSpatialBrain();
    const validTarget = { x: 3, y: 4 };
    const invalidTarget = { x: 6, y: 4 };
    const snapshot = world.snapshot();
    const validRoute = route(world, snapshot, validTarget);
    const invalidRoute = route(world, snapshot, invalidTarget);

    try {
      expect(invalidRoute.status).toBe("invalid-target");
      brain.intent({
        snapshot,
        relationshipTarget: validTarget,
        routePlan: validRoute,
        query: (from, to, radius) => world.staticCircleTraversal(from, to, radius),
        occupancy: (center, radius) => world.staticCircleOccupancy(center, radius)
      });
      expect(brain.debugState().movement.preferred).not.toBeNull();

      const decision = brain.observeOutcome({
        snapshot: patchedCompanion(snapshot, 1, {
          requestedVelocity: { x: 0, y: 0 },
          actualVelocity: { x: 0, y: 0 }
        }),
        objectiveKey: "bad-slot:rev-1",
        target: invalidTarget,
        routePlan: invalidRoute
      });

      expect(decision.state).toBe("ROUTE_INVALID");
      expect(decision.action).toBe("RECONSIDER_OBJECTIVE");
      expect(brain.debugState().appliedLocalRetries).toBe(0);
      expect(brain.debugState().movement.preferred).not.toBeNull();
    } finally {
      world.dispose();
    }
  });
});
