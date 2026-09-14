import { describe, expect, it } from "vitest";
import type {
  ActorSnapshot,
  DirectTraversalBlocker,
  StaticCircleTraversalResult,
  Vec2,
  WorldSnapshot
} from "../world/types";
import type { StaticTraversalQuery } from "../navigation/static-router";
import {
  CCC0_REGION_DIRECTIONS,
  CCC0_REGION_RADII,
  CCC0_REGION_ROUTE_SHORTLIST,
  coherentShadowRegion,
  evaluateShadowRelationshipRegion,
  type ShadowRegionSample
} from "./shadow-relationship-region";

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

function snapshot(options?: {
  tick?: number;
  player?: ActorSnapshot;
  companion?: ActorSnapshot;
}): WorldSnapshot {
  return {
    tick: options?.tick ?? 0,
    scenarioId: "open",
    width: 12,
    height: 8,
    actors: [
      options?.companion ?? actor("companion", 3.5, 4),
      options?.player ?? actor("player", 6, 4, { x: 2, y: 0 })
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

const blockedQuery: StaticTraversalQuery = (from, to, radius): StaticCircleTraversalResult => {
  const blocker: DirectTraversalBlocker = {
    label: "synthetic-blocker",
    distance: 0,
    fraction: 0,
    hitCenter: { ...from },
    contactPoint: { ...from },
    normal: { x: 0, y: 0 }
  };
  return {
    from: { ...from },
    to: { ...to },
    radius,
    distance: Math.hypot(to.x - from.x, to.y - from.y),
    clear: false,
    blocker
  };
};

function syntheticSample(id: string, angleIndex: number, radiusIndex: number, score: number): ShadowRegionSample {
  const angle = (angleIndex / CCC0_REGION_DIRECTIONS) * Math.PI * 2;
  const radius = CCC0_REGION_RADII[radiusIndex] ?? CCC0_REGION_RADII[0];
  return {
    id,
    angleIndex,
    radiusIndex,
    radius,
    angle,
    direction: { x: Math.cos(angle), y: Math.sin(angle) },
    position: { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius },
    hardValid: true,
    localClearance: 1,
    routeEvaluated: true,
    routeStatus: "direct",
    routeCost: 1,
    routeClearanceConstrained: false,
    reachable: true,
    score,
    terms: {
      frontPenalty: 0,
      radialPenalty: 0,
      travelPenalty: 0,
      comfortPenalty: 0,
      continuityPenalty: 0,
      routePenalty: 0,
      routeClearancePenalty: 0
    },
    inCoherentRegion: false
  };
}

describe("CCC-0 shadow relationship region", () => {
  it("is deterministic for identical evidence", () => {
    const state = snapshot();
    const first = evaluateShadowRelationshipRegion({ snapshot: state, query: clearQuery });
    const second = evaluateShadowRelationshipRegion({ snapshot: state, query: clearQuery });
    expect(second).toEqual(first);
  });

  it("keeps broad sampling and route qualification explicitly bounded", () => {
    const result = evaluateShadowRelationshipRegion({ snapshot: snapshot(), query: clearQuery });
    expect(result.samples).toHaveLength(CCC0_REGION_DIRECTIONS * CCC0_REGION_RADII.length);
    expect(result.routeEvaluatedCount).toBeLessThanOrEqual(CCC0_REGION_ROUTE_SHORTLIST);
    expect(result.routeEvaluatedCount).toBeGreaterThan(0);
  });

  it("produces a region representative away from the player instead of centroid-collapsing to player center", () => {
    const result = evaluateShadowRelationshipRegion({ snapshot: snapshot(), query: clearQuery });
    expect(result.state).toBe("REGION");
    expect(result.noRegionReason).toBeNull();
    expect(result.representativeAnchor).not.toBeNull();
    const anchor = result.representativeAnchor;
    if (!anchor) throw new Error("Expected a representative anchor.");
    expect(Math.hypot(anchor.x - result.playerPosition.x, anchor.y - result.playerPosition.y)).toBeGreaterThan(0.9);
    expect(result.coherentSampleIds.length).toBeGreaterThan(0);
  });

  it("labels bounded route-shortlist exhaustion without claiming every untested sample is unreachable", () => {
    const result = evaluateShadowRelationshipRegion({ snapshot: snapshot(), query: blockedQuery });
    expect(result.state).toBe("NO_REACHABLE_REGION");
    expect(result.noRegionReason).toBe("ROUTE_SHORTLIST_EXHAUSTED");
    expect(result.bestSampleId).toBeNull();
    expect(result.coherentSampleIds).toEqual([]);
    expect(result.representativeAnchor).toBeNull();
    expect(result.representativeSource).toBe("none");
    expect(result.reason).toContain("untested samples are not claimed unreachable");
  });

  it("distinguishes a field with no hard-valid body sample from route-shortlist exhaustion", () => {
    const tiny: WorldSnapshot = {
      tick: 0,
      scenarioId: "open",
      width: 1,
      height: 1,
      actors: [actor("companion", 0.5, 0.5), actor("player", 0.5, 0.5)],
      obstacles: []
    };
    const result = evaluateShadowRelationshipRegion({ snapshot: tiny, query: clearQuery });
    expect(result.state).toBe("NO_REACHABLE_REGION");
    expect(result.noRegionReason).toBe("NO_HARD_VALID_SAMPLE");
    expect(result.routeEvaluatedCount).toBe(0);
  });

  it("keeps disconnected near-best polar components separate", () => {
    const best = syntheticSample("best", 0, 1, 1);
    const nearby = syntheticSample("nearby", 1, 1, 1.1);
    const opposite = syntheticSample("opposite", 16, 1, 1.05);
    const oppositeNeighbor = syntheticSample("opposite-neighbor", 17, 1, 1.08);

    const region = coherentShadowRegion([best, nearby, opposite, oppositeNeighbor], best, 0.5);
    expect(region.map((sample) => sample.id)).toEqual(["best", "nearby"]);
  });

  it("prefers actual player motion as observed heading evidence when it is meaningful", () => {
    const player = actor("player", 6, 4, { x: 0, y: 2 });
    player.requestedVelocity = { x: 2, y: 0 };
    const result = evaluateShadowRelationshipRegion({ snapshot: snapshot({ player }), query: clearQuery });
    expect(result.playerHeadingSource).toBe("actual");
    expect(result.playerDirection.x).toBeCloseTo(0);
    expect(result.playerDirection.y).toBeCloseTo(1);
  });

  it("does not invent a world-axis heading when the player is stationary and has no heading history", () => {
    const player = actor("player", 6, 4);
    const result = evaluateShadowRelationshipRegion({ snapshot: snapshot({ player }), query: clearQuery });
    expect(result.playerHeadingSource).toBe("none");
    expect(result.playerDirection).toEqual({ x: 0, y: 0 });
    expect(result.samples.every((sample) => sample.terms.frontPenalty === 0)).toBe(true);
  });

  it("preserves a previous meaningful heading while the player is temporarily stationary", () => {
    const player = actor("player", 6, 4);
    const result = evaluateShadowRelationshipRegion({
      snapshot: snapshot({ player }),
      query: clearQuery,
      previousPlayerDirection: { x: 0, y: -1 }
    });
    expect(result.playerHeadingSource).toBe("previous");
    expect(result.playerDirection.x).toBeCloseTo(0);
    expect(result.playerDirection.y).toBeCloseTo(-1);
    expect(result.samples.some((sample) => sample.terms.frontPenalty > 0)).toBe(true);
  });
});
