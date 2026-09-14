import { describe, expect, it } from "vitest";
import type { StaticRoutePlan } from "../navigation/static-router";
import type {
  StaticCircleOccupancyResult,
  StaticCircleTraversalResult,
  Vec2,
  WorldSnapshot
} from "../world/types";
import { evaluateR1SpatialLocomotion } from "./r1-hard-comfort-spatial";

const RADIUS = 0.3;

function blockedTraversal(from: Vec2, to: Vec2, radius: number): StaticCircleTraversalResult {
  return {
    from: { ...from },
    to: { ...to },
    radius,
    distance: Math.hypot(to.x - from.x, to.y - from.y),
    clear: false,
    blocker: {
      label: "sealed.fixture",
      distance: 0,
      fraction: 0,
      hitCenter: { ...from },
      contactPoint: { ...from },
      normal: { x: 1, y: 0 }
    }
  };
}

function occupied(center: Vec2, radius: number): StaticCircleOccupancyResult {
  return { center: { ...center }, radius, clear: false, blockers: ["sealed.fixture"] };
}

describe("foundation hard-overlap hold invariant", () => {
  it("never classifies STOP inside hard penetration as an admissible safe velocity", () => {
    const snapshot: WorldSnapshot = {
      tick: 0,
      scenarioId: "pillar",
      width: 12,
      height: 8,
      actors: [
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
          position: { x: 10, y: 7 },
          radius: RADIUS,
          requestedVelocity: { x: 0, y: 0 },
          actualVelocity: { x: 0, y: 0 },
          motionError: 0,
          contacts: []
        }
      ],
      obstacles: [{ id: "sealed.fixture", x: 5.5, y: 0, width: 1, height: 8 }]
    };
    const target = { x: 8, y: 4 };
    const route: StaticRoutePlan = {
      status: "direct",
      reason: "synthetic fixture; local hard safety is under test",
      radius: RADIUS,
      clearance: 0.08,
      queryRadius: RADIUS,
      desiredQueryRadius: RADIUS + 0.08,
      clearanceConstrained: false,
      constrainedEdgeIds: [],
      start: { x: 6, y: 4 },
      target: { ...target },
      nodes: [],
      edges: [],
      routeNodeIds: ["start", "target"],
      waypoints: [{ ...target }],
      cost: 2
    };

    const evaluation = evaluateR1SpatialLocomotion({
      snapshot,
      relationshipTarget: target,
      routePlan: route,
      query: blockedTraversal,
      occupancy: occupied
    });

    const stop = evaluation.decision.candidates.find((candidate) => candidate.id === "stop");
    expect(evaluation.repair.hardStartViolated).toBe(true);
    expect(evaluation.repair.hardEgressCandidateIds).toHaveLength(0);
    expect(stop?.hardRejected).toBe(true);
    expect(stop?.rejectionReason).toContain("hold-inside-penetration");
    expect(evaluation.repair.localSafetyState).toBe("NO_SAFE_VELOCITY");
    expect(evaluation.decision.acceptedCount).toBe(0);
    expect(evaluation.decision.selectedMove).toEqual({ x: 0, y: 0 });
    expect(evaluation.decision.reason).toContain("NO_SAFE_VELOCITY");
  });
});
