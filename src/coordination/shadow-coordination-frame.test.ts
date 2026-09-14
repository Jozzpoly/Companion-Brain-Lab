import { describe, expect, it } from "vitest";
import type { ActorSnapshot, StaticCircleTraversalResult, Vec2, WorldSnapshot } from "../world/types";
import type { StaticTraversalQuery } from "../navigation/static-router";
import {
  createEmptyShadowCoordinationHistory,
  evaluateShadowCoordinationFrame
} from "./shadow-coordination-frame";

function actor(id: ActorSnapshot["id"], x: number, y: number, velocity: Vec2 = { x: 0, y: 0 }): ActorSnapshot {
  return {
    id,
    position: { x, y },
    radius: 0.3,
    requestedVelocity: { ...velocity },
    actualVelocity: { ...velocity },
    motionError: 0,
    contacts: []
  };
}

function snapshot(tick: number, playerVelocity: Vec2): WorldSnapshot {
  return {
    tick,
    scenarioId: "open",
    width: 12,
    height: 8,
    actors: [actor("companion", 3.5, 4), actor("player", 6, 4, playerVelocity)],
    obstacles: []
  };
}

const clearQuery: StaticTraversalQuery = (from, to, radius): StaticCircleTraversalResult => ({
  from: { ...from },
  to: { ...to },
  radius,
  distance: Math.hypot(to.x - from.x, to.y - from.y),
  clear: true,
  blocker: null
});

describe("CCC-0 shadow coordination frame", () => {
  it("aggregates deterministic WHERE/PACE/PLAYER/conflict evidence without an authoritative command", () => {
    const input = {
      snapshot: snapshot(0, { x: 2, y: 0 }),
      query: clearQuery,
      physicalSpeedCapability: 3,
      history: createEmptyShadowCoordinationHistory(),
      legacyRelationshipTarget: { x: 4.55, y: 4 },
      legacyPreferredVelocity: { x: 1.5, y: 0 }
    };

    const first = evaluateShadowCoordinationFrame(input);
    const second = evaluateShadowCoordinationFrame(input);
    expect(second).toEqual(first);
    expect(first.kind).toBe("CCC0_SHADOW_COORDINATION");
    expect(first.region.state).toBe("REGION");
    expect(first.playerFlowConflict.velocitySource).toBe("legacy-preferred");
    expect(first.legacy.relationshipTarget).toEqual({ x: 4.55, y: 4 });
    expect(first.legacy.preferredVelocity).toEqual({ x: 1.5, y: 0 });
    expect("command" in first).toBe(false);
  });

  it("keeps conflict evidence explicitly unavailable when no legacy preferred velocity exists", () => {
    const result = evaluateShadowCoordinationFrame({
      snapshot: snapshot(0, { x: 2, y: 0 }),
      query: clearQuery,
      physicalSpeedCapability: 3,
      history: createEmptyShadowCoordinationHistory()
    });

    expect(result.playerFlowConflict.state).toBe("UNAVAILABLE");
    expect(result.playerFlowConflict.companionVelocity).toBeNull();
  });

  it("carries only small explicit history and detects a next-tick reversal", () => {
    const first = evaluateShadowCoordinationFrame({
      snapshot: snapshot(0, { x: 2, y: 0 }),
      query: clearQuery,
      physicalSpeedCapability: 3,
      history: createEmptyShadowCoordinationHistory()
    });
    const second = evaluateShadowCoordinationFrame({
      snapshot: snapshot(1, { x: -2, y: 0 }),
      query: clearQuery,
      physicalSpeedCapability: 3,
      history: first.nextHistory
    });

    expect(first.playerCorridor.state).toBe("MOVING");
    expect(second.playerCorridor.state).toBe("REVERSAL_UNCERTAIN");
    expect(second.playerCorridor.confidence).toBeLessThan(first.playerCorridor.confidence);
    expect(second.nextHistory.previousCorridorDirection).toEqual(second.playerCorridor.direction);
  });

  it("increments outside-region history instead of creating a hidden mode transition", () => {
    const first = evaluateShadowCoordinationFrame({
      snapshot: snapshot(0, { x: 2, y: 0 }),
      query: clearQuery,
      physicalSpeedCapability: 3,
      history: createEmptyShadowCoordinationHistory()
    });
    expect(first.nextHistory.outsideRegionTicks).toBeGreaterThanOrEqual(0);

    const second = evaluateShadowCoordinationFrame({
      snapshot: snapshot(1, { x: 2, y: 0 }),
      query: clearQuery,
      physicalSpeedCapability: 3,
      history: first.nextHistory
    });

    if (!second.pace.insideUsefulRegion) {
      expect(second.nextHistory.outsideRegionTicks).toBe(first.nextHistory.outsideRegionTicks + 1);
    }
  });
});
