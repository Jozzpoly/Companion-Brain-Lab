import { describe, expect, it } from "vitest";
import type { ActorSnapshot, StaticCircleTraversalResult, Vec2, WorldSnapshot } from "../world/types";
import type { StaticTraversalQuery } from "../navigation/static-router";
import {
  createEmptyShadowCoordinationHistory,
  evaluateShadowCoordinationFrame,
  type ShadowCoordinationFrame
} from "./shadow-coordination-frame";

function actor(id: ActorSnapshot["id"], position: Vec2, velocity: Vec2): ActorSnapshot {
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

function snapshot(tick: number, speed: number): WorldSnapshot {
  return {
    tick,
    scenarioId: "open",
    width: 20,
    height: 20,
    actors: [
      actor("companion", { x: 11.45, y: 10 }, { x: 0, y: 0 }),
      actor("player", { x: 10, y: 10 }, { x: speed, y: 0 })
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

function frame(state: WorldSnapshot, history = createEmptyShadowCoordinationHistory()): ShadowCoordinationFrame {
  return evaluateShadowCoordinationFrame({
    snapshot: state,
    query: clearQuery,
    physicalSpeedCapability: 3,
    history,
    legacyPreferredVelocity: { x: -0.2, y: 0 },
    legacyAuthoritativeVelocity: { x: -0.2, y: 0 }
  });
}

function anchorGap(a: ShadowCoordinationFrame, b: ShadowCoordinationFrame): number {
  if (!a.region.representativeAnchor || !b.region.representativeAnchor) return Number.POSITIVE_INFINITY;
  return Math.hypot(
    a.region.representativeAnchor.x - b.region.representativeAnchor.x,
    a.region.representativeAnchor.y - b.region.representativeAnchor.y
  );
}

describe("CCC-0 readiness RED: fading velocity memory", () => {
  it("RED: aging stationary trajectory evidence must not expire as a one-tick meter-scale WHERE jump", () => {
    let current = frame(snapshot(0, 2));
    let previousStrength = current.region.playerHeadingStrength;
    let maximumGap = 0;
    const observations: Array<{ tick: number; strength: number; gap: number; source: string }> = [];

    for (let tick = 6; tick <= 72; tick += 6) {
      const next = frame(snapshot(tick, 0), current.nextHistory);
      const gap = anchorGap(current, next);
      maximumGap = Math.max(maximumGap, gap);
      observations.push({
        tick,
        strength: next.region.playerHeadingStrength,
        gap,
        source: next.region.playerHeadingSource
      });

      expect(next.region.playerHeadingStrength).toBeLessThanOrEqual(previousStrength + 1e-9);
      previousStrength = next.region.playerHeadingStrength;
      current = next;
    }

    console.info("[CCC0_RED] memory-fade-continuity", JSON.stringify({ maximumGap, observations }));

    expect(observations.at(-1)?.source).toBe("none");
    expect(maximumGap).toBeLessThan(0.5);
  });
});
