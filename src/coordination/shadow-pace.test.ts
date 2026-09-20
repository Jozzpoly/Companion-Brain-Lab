import { describe, expect, it } from "vitest";
import type { ActorSnapshot, Vec2, WorldSnapshot } from "../world/types";
import type { ShadowRelationshipRegion, ShadowRegionSample } from "./shadow-relationship-region";
import { evaluateShadowPace } from "./shadow-pace";

function actor(
  id: ActorSnapshot["id"],
  position: Vec2,
  velocity: Vec2 = { x: 0, y: 0 }
): ActorSnapshot {
  return {
    id,
    position: { ...position },
    radius: 0.3,
    requestedVelocity: { ...velocity },
    actualVelocity: { ...velocity },
    motionError: 0,
    contacts: []
  };
}

function snapshot(
  playerVelocity: Vec2,
  companionVelocity: Vec2 = { x: 0, y: 0 },
  companionPosition: Vec2 = { x: 4, y: 4 }
): WorldSnapshot {
  return {
    tick: 30,
    scenarioId: "open",
    width: 12,
    height: 8,
    actors: [
      actor("companion", companionPosition, companionVelocity),
      actor("player", { x: 6, y: 4 }, playerVelocity)
    ],
    obstacles: []
  };
}

function sample(id: string, position: Vec2): ShadowRegionSample {
  return {
    id,
    angleIndex: 0,
    radiusIndex: 0,
    radius: 1.45,
    angle: 0,
    direction: { x: 1, y: 0 },
    position: { ...position },
    hardValid: true,
    localClearance: 2,
    routeEvaluated: true,
    routeStatus: "direct",
    routeCost: 2.5,
    routeClearanceConstrained: false,
    reachable: true,
    score: 1,
    terms: {
      frontPenalty: 0,
      radialPenalty: 0,
      travelPenalty: 0,
      comfortPenalty: 0,
      continuityPenalty: 0,
      routePenalty: 0,
      routeClearancePenalty: 0
    },
    inCoherentRegion: true
  };
}

function region(position: Vec2): ShadowRelationshipRegion {
  const entry = sample("region", position);
  return {
    state: "REGION",
    noRegionReason: null,
    tick: 30,
    playerPosition: { x: 6, y: 4 },
    playerDirection: { x: 1, y: 0 },
    playerHeadingSource: "actual",
    playerHeadingStrength: 1,
    companionPosition: { x: 4, y: 4 },
    samples: [entry],
    routeEvaluatedCount: 1,
    staticTraversalQueryCount: 1,
    bestSampleId: entry.id,
    coherentSampleIds: [entry.id],
    topologyKey: entry.id,
    representativeAnchor: { ...position },
    representativeSource: "best-sample",
    representativeRouteStatus: "direct",
    reason: "test region"
  };
}

function noRegion(): ShadowRelationshipRegion {
  return {
    state: "NO_REACHABLE_REGION",
    noRegionReason: "ROUTE_SHORTLIST_EXHAUSTED",
    tick: 30,
    playerPosition: { x: 6, y: 4 },
    playerDirection: { x: 1, y: 0 },
    playerHeadingSource: "actual",
    playerHeadingStrength: 1,
    companionPosition: { x: 4, y: 4 },
    samples: [],
    routeEvaluatedCount: 0,
    staticTraversalQueryCount: 0,
    bestSampleId: null,
    coherentSampleIds: [],
    topologyKey: null,
    representativeAnchor: null,
    representativeSource: "none",
    representativeRouteStatus: "not-evaluated",
    reason: "test no region"
  };
}

describe("CCC-0 shadow pace", () => {
  it("raises urgency when the player is moving away at the same geometric distance", () => {
    const fixedRegion = region({ x: 6.5, y: 4 });
    const stationary = evaluateShadowPace({
      snapshot: snapshot({ x: 0, y: 0 }),
      region: fixedRegion,
      physicalSpeedCapability: 3,
      outsideRegionTicks: 30
    });
    const movingAway = evaluateShadowPace({
      snapshot: snapshot({ x: 2, y: 0 }),
      region: fixedRegion,
      physicalSpeedCapability: 3,
      outsideRegionTicks: 30
    });

    expect(movingAway.distanceToRegion).toBeCloseTo(stationary.distanceToRegion ?? -1);
    expect(movingAway.separationTrend).toBe("opening");
    expect(movingAway.urgency).toBeGreaterThan(stationary.urgency);
  });

  it("reduces urgency when the player reverses toward the companion at the same distance", () => {
    const fixedRegion = region({ x: 6.5, y: 4 });
    const movingAway = evaluateShadowPace({
      snapshot: snapshot({ x: 2, y: 0 }),
      region: fixedRegion,
      physicalSpeedCapability: 3,
      outsideRegionTicks: 30
    });
    const movingToward = evaluateShadowPace({
      snapshot: snapshot({ x: -2, y: 0 }),
      region: fixedRegion,
      physicalSpeedCapability: 3,
      outsideRegionTicks: 30
    });

    expect(movingToward.separationTrend).toBe("closing");
    expect(movingToward.urgency).toBeLessThan(movingAway.urgency);
  });

  it("reduces pressure while the companion is already closing on the region before overshoot", () => {
    const fixedRegion = region({ x: 6.5, y: 4 });
    const far = evaluateShadowPace({
      snapshot: snapshot({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 4, y: 4 }),
      region: fixedRegion,
      physicalSpeedCapability: 3,
      outsideRegionTicks: 30
    });
    const approaching = evaluateShadowPace({
      snapshot: snapshot({ x: 0, y: 0 }, { x: 1.5, y: 0 }, { x: 5.8, y: 4 }),
      region: fixedRegion,
      physicalSpeedCapability: 3,
      outsideRegionTicks: 30
    });

    expect(approaching.insideUsefulRegion).toBe(false);
    expect(approaching.separationTrend).toBe("closing");
    expect(approaching.distanceToRegion).toBeLessThan(far.distanceToRegion ?? Number.POSITIVE_INFINITY);
    expect(approaching.urgency).toBeLessThan(far.urgency);
    expect(approaching.desiredSpeed).toBeLessThanOrEqual(far.desiredSpeed);
  });

  it("settles instead of inventing locomotion when already in-region beside a stationary player", () => {
    const result = evaluateShadowPace({
      snapshot: snapshot({ x: 0, y: 0 }),
      region: region({ x: 4.1, y: 4 }),
      physicalSpeedCapability: 3
    });
    expect(result.insideUsefulRegion).toBe(true);
    expect(result.label).toBe("SETTLED");
    expect(result.desiredSpeed).toBe(0);
  });

  it("exposes missing region as recovery pressure without inventing a route distance", () => {
    const result = evaluateShadowPace({
      snapshot: snapshot({ x: 0, y: 0 }),
      region: noRegion(),
      physicalSpeedCapability: 3
    });
    expect(result.label).toBe("RECOVERING");
    expect(result.urgency).toBe(1);
    expect(result.desiredSpeed).toBe(3);
    expect(result.distanceToRegion).toBeNull();
    expect(result.routeDistanceToRegion).toBeNull();
  });

  it("never requests a desired speed above physical capability", () => {
    const result = evaluateShadowPace({
      snapshot: snapshot({ x: 20, y: 0 }),
      region: region({ x: 10, y: 4 }),
      physicalSpeedCapability: 3,
      outsideRegionTicks: 999
    });
    expect(result.desiredSpeed).toBeLessThanOrEqual(3);
    expect(result.urgency).toBeGreaterThanOrEqual(0);
    expect(result.urgency).toBeLessThanOrEqual(1);
  });
});
