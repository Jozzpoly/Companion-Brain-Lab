import { describe, expect, it } from "vitest";
import {
  S2C_ROUTE_CLEARANCE,
  planStaticShadowRoute
} from "../navigation/static-router";
import { RapierPhysicalWorld } from "../physics/rapier-physical-world";
import type { ScenarioSpec, Vec2, WorldSnapshot } from "../world/types";
import { evaluateSpatialLocomotion } from "./spatial-locomotion";

const ACTOR_RADIUS = 0.3;
const ACTOR_SPEED = 3;

const fixture: ScenarioSpec = {
  id: "pillar",
  label: "R1 clearance-egress red fixture",
  width: 12,
  height: 8,
  actors: [
    { id: "player", position: { x: 2, y: 4 }, radius: ACTOR_RADIUS, speed: ACTOR_SPEED },
    // Wall left face is x=5.5. Physical legality requires center <= 5.2.
    // Current desired planning clearance requires center <= 5.12.
    // x=5.16 is deliberately inside that 8 cm disagreement band.
    { id: "companion", position: { x: 5.16, y: 4 }, radius: ACTOR_RADIUS, speed: ACTOR_SPEED }
  ],
  obstacles: [
    { id: "r1.wall", x: 5.5, y: 0, width: 0.5, height: 8 }
  ]
};

function snapshot(spec: ScenarioSpec, physical: RapierPhysicalWorld): WorldSnapshot {
  return {
    tick: 0,
    scenarioId: spec.id,
    width: spec.width,
    height: spec.height,
    actors: physical.snapshot(),
    obstacles: spec.obstacles
  };
}

function companionPosition(value: WorldSnapshot): Vec2 {
  const companion = value.actors.find((actor) => actor.id === "companion");
  if (!companion) throw new Error("R1 fixture is missing companion.");
  return companion.position;
}

describe("R1-0 clearance-egress red reproduction", () => {
  it("does not self-lock a physically legal companion merely because desired clearance is violated", async () => {
    const physical = await RapierPhysicalWorld.create(fixture);
    const target = { x: 3.5, y: 4 };

    try {
      const world = snapshot(fixture, physical);
      const start = companionPosition(world);
      const hard = physical.staticCircleTraversal(start, target, ACTOR_RADIUS);
      const desired = physical.staticCircleTraversal(
        start,
        target,
        ACTOR_RADIUS + S2C_ROUTE_CLEARANCE
      );

      // Fixture validity: the real body can move away from the wall while the
      // enlarged planning envelope begins inside the desired-clearance band.
      expect(hard.clear).toBe(true);
      expect(desired.clear).toBe(false);
      expect(desired.blocker?.label).toBe("r1.wall");
      expect(desired.blocker?.distance ?? Number.POSITIVE_INFINITY).toBeLessThan(1e-5);

      const route = planStaticShadowRoute({
        snapshot: world,
        start,
        target,
        radius: ACTOR_RADIUS,
        query: (from, to, radius) => physical.staticCircleTraversal(from, to, radius)
      });

      const spatial = evaluateSpatialLocomotion({
        snapshot: world,
        relationshipTarget: target,
        routePlan: route,
        query: (from, to, radius) => physical.staticCircleTraversal(from, to, radius)
      });
      const acceptedMoving = spatial.candidates.filter(
        (candidate) => !candidate.hardRejected && candidate.speedFraction >= 0.05
      );

      const diagnostic = JSON.stringify({
        start,
        target,
        hard: {
          clear: hard.clear,
          blocker: hard.blocker?.label ?? null,
          distance: hard.blocker?.distance ?? null
        },
        desired: {
          radius: ACTOR_RADIUS + S2C_ROUTE_CLEARANCE,
          clear: desired.clear,
          blocker: desired.blocker?.label ?? null,
          distance: desired.blocker?.distance ?? null
        },
        route: {
          status: route.status,
          reason: route.reason,
          path: route.routeNodeIds
        },
        spatial: {
          state: spatial.state,
          selectedCandidate: spatial.selectedCandidateId,
          accepted: spatial.acceptedCount,
          rejected: spatial.rejectedCount,
          acceptedMoving: acceptedMoving.length
        }
      }, null, 2);

      // R1 invariant: a physically legal state with a clear hard-body egress
      // must not become a permanent planning dead-end solely because the actor
      // begins inside a desired-clearance envelope.
      if (
        route.status === "unreachable" ||
        acceptedMoving.length === 0 ||
        spatial.state === "HOLD"
      ) {
        throw new Error(
          `R1-0 RED REPRODUCTION: physically legal clearance egress self-locked.\n${diagnostic}`
        );
      }
    } finally {
      physical.dispose();
    }
  });
});
