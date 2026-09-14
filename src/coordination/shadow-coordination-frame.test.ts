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

function conflictSnapshot(): WorldSnapshot {
  return {
    tick: 20,
    scenarioId: "head-on",
    width: 12,
    height: 8,
    actors: [
      actor("companion", 5, 4),
      actor("player", 4, 4, { x: 1, y: 0 })
    ],
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
      legacyPreferredVelocity: { x: 1.5, y: 0 },
      legacyAuthoritativeVelocity: { x: 1.2, y: 0 }
    };

    const first = evaluateShadowCoordinationFrame(input);
    const second = evaluateShadowCoordinationFrame(input);
    expect(second).toEqual(first);
    expect(first.kind).toBe("CCC0_SHADOW_COORDINATION");
    expect(first.region.state).toBe("REGION");
    expect(first.region.staticTraversalQueryCount).toBeGreaterThan(0);
    expect(first.preferredPlayerFlowConflict.velocitySource).toBe("legacy-preferred");
    expect(first.authoritativePlayerFlowConflict.velocitySource).toBe("authoritative-command");
    expect(first.legacy.relationshipTarget).toEqual({ x: 4.55, y: 4 });
    expect(first.legacy.preferredVelocity).toEqual({ x: 1.5, y: 0 });
    expect(first.legacy.authoritativeVelocity).toEqual({ x: 1.2, y: 0 });
    expect("command" in first).toBe(false);
  });

  it("keeps both conflict channels explicitly unavailable when velocity evidence is absent", () => {
    const result = evaluateShadowCoordinationFrame({
      snapshot: snapshot(0, { x: 2, y: 0 }),
      query: clearQuery,
      physicalSpeedCapability: 3,
      history: createEmptyShadowCoordinationHistory()
    });

    expect(result.preferredPlayerFlowConflict.state).toBe("UNAVAILABLE");
    expect(result.authoritativePlayerFlowConflict.state).toBe("UNAVAILABLE");
  });

  it("distinguishes an upstream-safe preferred velocity from a conflicting final command", () => {
    const result = evaluateShadowCoordinationFrame({
      snapshot: conflictSnapshot(),
      query: clearQuery,
      physicalSpeedCapability: 3,
      history: createEmptyShadowCoordinationHistory(),
      legacyPreferredVelocity: { x: 1, y: 0 },
      legacyAuthoritativeVelocity: { x: -1, y: 0 }
    });

    expect(result.preferredPlayerFlowConflict.state).toBe("CLEAR");
    expect(result.authoritativePlayerFlowConflict.state).toBe("PHYSICAL_CONFLICT");
    expect(result.authoritativePlayerFlowConflict.physicalClearance).toBeLessThan(0);
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

  it("keeps a small heading change topologically overlapping instead of teleporting the region", () => {
    const first = evaluateShadowCoordinationFrame({
      snapshot: snapshot(0, { x: 2, y: 0 }),
      query: clearQuery,
      physicalSpeedCapability: 3,
      history: createEmptyShadowCoordinationHistory()
    });
    const second = evaluateShadowCoordinationFrame({
      snapshot: snapshot(6, { x: 2, y: 0.15 }),
      query: clearQuery,
      physicalSpeedCapability: 3,
      history: first.nextHistory
    });

    expect(first.region.state).toBe("REGION");
    expect(second.region.state).toBe("REGION");
    expect(second.regionContinuity.previousRegionPresent).toBe(true);
    expect(second.regionContinuity.currentRegionPresent).toBe(true);
    expect(second.regionContinuity.coherentSampleOverlapRatio).not.toBeNull();
    expect(second.regionContinuity.coherentSampleOverlapRatio ?? 0).toBeGreaterThan(0);
    expect(second.regionContinuity.anchorDisplacement).not.toBeNull();
    expect(second.regionContinuity.anchorDisplacement ?? Number.POSITIVE_INFINITY).toBeLessThan(0.5);
  });

  it("accounts outside-region duration in world ticks rather than cognition evaluations", () => {
    const first = evaluateShadowCoordinationFrame({
      snapshot: snapshot(0, { x: 2, y: 0 }),
      query: clearQuery,
      physicalSpeedCapability: 3,
      history: createEmptyShadowCoordinationHistory()
    });
    const second = evaluateShadowCoordinationFrame({
      snapshot: snapshot(6, { x: 2, y: 0 }),
      query: clearQuery,
      physicalSpeedCapability: 3,
      history: first.nextHistory
    });

    expect(second.nextHistory.previousEvaluationTick).toBe(6);
    if (!second.pace.insideUsefulRegion) {
      expect(second.nextHistory.outsideRegionTicks).toBe(first.nextHistory.outsideRegionTicks + 6);
    }
  });
});
