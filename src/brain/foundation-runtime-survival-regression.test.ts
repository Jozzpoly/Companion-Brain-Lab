import { describe, expect, it } from "vitest";
import { planStaticShadowRoute, type StaticRoutePlan } from "../navigation/static-router";
import { RapierPhysicalWorld } from "../physics/rapier-physical-world";
import type {
  ActorSnapshot,
  ScenarioSpec,
  StaticCircleOccupancyResult,
  StaticCircleTraversalResult,
  Vec2,
  WorldSnapshot
} from "../world/types";
import { RelationalPositioningBrain } from "./relational-positioning";
import { evaluateR1SpatialLocomotion } from "./r1-hard-comfort-spatial";
import { R1RecoveringDirectSpatialBrain } from "./r1-recovering-direct-spatial";

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

function blockedTraversal(from: Vec2, to: Vec2, radius: number, label = "sealed.fixture"): StaticCircleTraversalResult {
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  return {
    from: { ...from },
    to: { ...to },
    radius,
    distance,
    clear: false,
    blocker: {
      label,
      distance: 0,
      fraction: 0,
      hitCenter: { ...from },
      contactPoint: { ...from },
      normal: { x: 1, y: 0 }
    }
  };
}

function occupied(center: Vec2, radius: number, label = "sealed.fixture"): StaticCircleOccupancyResult {
  return {
    center: { ...center },
    radius,
    clear: false,
    blockers: [label]
  };
}

function directRoute(start: Vec2, target: Vec2): StaticRoutePlan {
  const cost = Math.hypot(target.x - start.x, target.y - start.y);
  return {
    status: "direct",
    reason: "foundation synthetic direct route",
    radius: RADIUS,
    clearance: 0.08,
    queryRadius: RADIUS,
    desiredQueryRadius: RADIUS + 0.08,
    clearanceConstrained: false,
    constrainedEdgeIds: [],
    start: { ...start },
    target: { ...target },
    nodes: [],
    edges: [],
    routeNodeIds: ["start", "target"],
    waypoints: [{ ...target }],
    cost
  };
}

function sealedWorld(): { spec: ScenarioSpec; world: WorldSnapshot; target: Vec2 } {
  const spec: ScenarioSpec = {
    id: "pillar",
    label: "foundation sealed local state",
    width: 12,
    height: 8,
    actors: [],
    obstacles: [{ id: "sealed.fixture", x: 4, y: 0, width: 4, height: 8 }]
  };
  const world = snapshot(spec, [
    {
      id: "companion",
      position: { x: 6, y: 4 },
      radius: RADIUS,
      requestedVelocity: { x: 0, y: 0 },
      actualVelocity: { x: 0, y: 0 },
      motionError: 0,
      contacts: []
    },
    {
      id: "player",
      position: { x: 7.1, y: 4 },
      radius: RADIUS,
      requestedVelocity: { x: -3, y: 0 },
      actualVelocity: { x: -3, y: 0 },
      motionError: 0,
      contacts: []
    }
  ]);
  return { spec, world, target: { x: 9, y: 4 } };
}

describe("foundation runtime-survival regressions", () => {
  it("turns slight hard penetration into explicit hard-egress instead of terminating spatial evaluation", async () => {
    const fixture: ScenarioSpec = {
      id: "pillar",
      label: "foundation hard-egress reproduction",
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

      const evaluation = evaluateR1SpatialLocomotion({
        snapshot: world,
        relationshipTarget: target,
        routePlan: route,
        query: (from, to, radius, options) => physical.staticCircleTraversal(from, to, radius, options),
        occupancy: (center, radius) => physical.staticCircleOccupancy(center, radius)
      });

      expect(evaluation.repair.hardStartViolated).toBe(true);
      expect(evaluation.repair.hardStartBlockers).toContain("foundation.wall");
      expect(evaluation.repair.hardEgressCandidateIds.length).toBeGreaterThan(0);
      expect(evaluation.repair.localSafetyState).toBe("HARD_EGRESS");
      expect(evaluation.decision.reason).not.toContain("NO_SAFE_VELOCITY");
      expect(evaluation.decision.selectedCandidateId).not.toBe("stop");
    } finally {
      physical.dispose();
    }
  });

  it("represents genuine local candidate exhaustion as NO_SAFE_VELOCITY fail-closed STOP", () => {
    const { world, target } = sealedWorld();
    const query = (from: Vec2, to: Vec2, radius: number) => blockedTraversal(from, to, radius);
    const occupancy = (center: Vec2, radius: number) => occupied(center, radius);
    const route = planStaticShadowRoute({
      snapshot: world,
      start: { x: 6, y: 4 },
      target,
      radius: RADIUS,
      query
    });

    const evaluation = evaluateR1SpatialLocomotion({
      snapshot: world,
      relationshipTarget: target,
      routePlan: route,
      query,
      occupancy
    });

    expect(evaluation.repair.hardStartViolated).toBe(true);
    expect(evaluation.repair.hardEgressCandidateIds).toHaveLength(0);
    expect(evaluation.repair.localSafetyState).toBe("NO_SAFE_VELOCITY");
    expect(evaluation.decision.acceptedCount).toBe(0);
    expect(evaluation.decision.state).toBe("HOLD");
    expect(evaluation.decision.selectedMove).toEqual({ x: 0, y: 0 });
    expect(evaluation.decision.reason).toContain("NO_SAFE_VELOCITY");
  });

  it("propagates NO_SAFE_VELOCITY as intentional post-World hold instead of fake no-progress", () => {
    const { world, target } = sealedWorld();
    const query = (from: Vec2, to: Vec2, radius: number) => blockedTraversal(from, to, radius);
    const occupancy = (center: Vec2, radius: number) => occupied(center, radius);
    const route = directRoute({ x: 6, y: 4 }, target);
    const brain = new R1RecoveringDirectSpatialBrain();

    const intent = brain.intent({
      snapshot: world,
      relationshipTarget: target,
      routePlan: route,
      query,
      occupancy
    });
    expect(intent.move).toEqual({ x: 0, y: 0 });
    expect(brain.debugState().repair?.localSafetyState).toBe("NO_SAFE_VELOCITY");

    const postWorld: WorldSnapshot = {
      ...world,
      tick: 1,
      actors: world.actors.map((actor) => actor.id === "companion"
        ? { ...actor, requestedVelocity: { x: 0, y: 0 }, actualVelocity: { x: 0, y: 0 } }
        : actor
      )
    };
    const progress = brain.observeOutcome({
      snapshot: postWorld,
      objectiveKey: "foundation:no-safe",
      target,
      routePlan: route
    });

    expect(progress.state).toBe("INTENTIONAL_HOLD");
    expect(progress.action).toBe("NONE");
    expect(progress.reason).toContain("NO_SAFE_VELOCITY");
    expect(progress.noProgressTicks).toBe(0);
    expect(progress.retryCount).toBe(0);
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
    const decision = brain.decision(world);
    expect(decision.selectedSlot).toBe("hold-current");
    expect(decision.target).toEqual({ x: 0.5, y: 0.5 });
    expect(decision.reason).toContain("NO_VALID_RELATIONAL_SLOT");
  });
});
