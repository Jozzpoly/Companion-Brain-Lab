import { describe, expect, it } from "vitest";
import type { WorldSnapshot } from "../world/types";
import { ProgressRecoveryMonitor } from "./progress-recovery";
import { RelationalPositioningBrain } from "./relational-positioning";

function exhaustedRelationshipWorld(): WorldSnapshot {
  return {
    tick: 0,
    scenarioId: "open",
    width: 1,
    height: 1,
    actors: [
      {
        id: "player",
        position: { x: 0.5, y: 0.5 },
        radius: 0.3,
        requestedVelocity: { x: 1, y: 0 },
        actualVelocity: { x: 1, y: 0 },
        motionError: 0,
        contacts: []
      },
      {
        id: "companion",
        position: { x: 0.5, y: 0.5 },
        radius: 0.3,
        requestedVelocity: { x: 0, y: 0 },
        actualVelocity: { x: 0, y: 0 },
        motionError: 0,
        contacts: []
      }
    ],
    obstacles: []
  };
}

describe("foundation relationship-exhaustion recovery semantics", () => {
  it("keeps NO_VALID_RELATIONAL_SLOT visible instead of relabeling hold-current as ARRIVED", () => {
    const world = exhaustedRelationshipWorld();
    const relationship = new RelationalPositioningBrain().decision(world);
    expect(relationship.objectiveState).toBe("NO_VALID_RELATIONAL_SLOT");
    expect(relationship.target).toEqual({ x: 0.5, y: 0.5 });

    const progress = new ProgressRecoveryMonitor().observe({
      tick: 1,
      objectiveKey: `spatial-slot:${relationship.selectedSlot}`,
      position: { x: 0.5, y: 0.5 },
      target: relationship.target,
      routeStatus: "direct",
      routeRemainingDistance: 0,
      commandedSpeed: 0,
      actualSpeed: 0,
      contacts: [],
      intentionalHoldReason: relationship.reason
    });

    expect(progress.state).toBe("INTENTIONAL_HOLD");
    expect(progress.action).toBe("NONE");
    expect(progress.reason).toContain("NO_VALID_RELATIONAL_SLOT");
    expect(progress.objectiveDistance).toBe(0);
    expect(progress.progressMetric).toBe(0);
    expect(progress.retryCount).toBe(0);
  });

  it("still lets invalid route truth outrank an explicit intentional hold", () => {
    const progress = new ProgressRecoveryMonitor().observe({
      tick: 0,
      objectiveKey: "foundation:invalid-hold",
      position: { x: 0.5, y: 0.5 },
      target: { x: 0.5, y: 0.5 },
      routeStatus: "invalid-target",
      routeRemainingDistance: null,
      commandedSpeed: 0,
      actualSpeed: 0,
      contacts: [],
      intentionalHoldReason: "NO_VALID_RELATIONAL_SLOT"
    });

    expect(progress.state).toBe("ROUTE_INVALID");
    expect(progress.action).toBe("RECONSIDER_OBJECTIVE");
  });
});
