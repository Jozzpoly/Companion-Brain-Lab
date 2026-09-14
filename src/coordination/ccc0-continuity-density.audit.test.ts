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

function anchorDistance(a: ShadowCoordinationFrame, b: ShadowCoordinationFrame): number {
  if (!a.region.representativeAnchor || !b.region.representativeAnchor) return Number.POSITIVE_INFINITY;
  return Math.hypot(
    a.region.representativeAnchor.x - b.region.representativeAnchor.x,
    a.region.representativeAnchor.y - b.region.representativeAnchor.y
  );
}

function overlap(a: ShadowCoordinationFrame, b: ShadowCoordinationFrame): number {
  const left = new Set(a.region.coherentSampleIds);
  const right = new Set(b.region.coherentSampleIds);
  const union = new Set([...left, ...right]);
  if (union.size === 0) return 1;
  let intersection = 0;
  for (const id of left) if (right.has(id)) intersection += 1;
  return intersection / union.size;
}

describe("CCC-0 continuity density audit", () => {
  it("characterizes every 0.001 m/s step from near-stationary through full heading influence", () => {
    let previous = frame(snapshot(0, 0.14));
    let maximum = {
      from: 0.14,
      to: 0.14,
      anchorGap: 0,
      overlap: 1,
      urgencyGap: 0,
      fromBest: previous.region.bestSampleId,
      toBest: previous.region.bestSampleId,
      fromStrength: previous.region.playerHeadingStrength,
      toStrength: previous.region.playerHeadingStrength
    };
    const largeJumps: typeof maximum[] = [];

    for (let milli = 141; milli <= 650; milli += 1) {
      const speed = milli / 1000;
      const current = frame(snapshot(0, speed));
      const candidate = {
        from: (milli - 1) / 1000,
        to: speed,
        anchorGap: anchorDistance(previous, current),
        overlap: overlap(previous, current),
        urgencyGap: Math.abs(previous.pace.urgency - current.pace.urgency),
        fromBest: previous.region.bestSampleId,
        toBest: current.region.bestSampleId,
        fromStrength: previous.region.playerHeadingStrength,
        toStrength: current.region.playerHeadingStrength
      };
      if (candidate.anchorGap > maximum.anchorGap) maximum = candidate;
      if (candidate.anchorGap > 0.25 || candidate.overlap < 0.5 || candidate.urgencyGap > 0.1) {
        largeJumps.push(candidate);
      }
      previous = current;
    }

    expect(Number.isFinite(maximum.anchorGap)).toBe(true);
    console.info("[CCC0_AUDIT] dense-speed-continuity", JSON.stringify({ maximum, largeJumps }));
  });

  it("characterizes continuity while recent velocity direction ages through a stationary stop", () => {
    let current = frame(snapshot(0, 2));
    const observations: Array<{
      tick: number;
      source: string;
      strength: number;
      anchor: Vec2 | null;
      gapFromPrevious: number;
      corridorPrevious: Vec2 | null;
      corridorState: string;
      playerAge: number | null;
      corridorAge: number | null;
    }> = [];

    for (let tick = 6; tick <= 72; tick += 6) {
      const next = frame(snapshot(tick, 0), current.nextHistory);
      observations.push({
        tick,
        source: next.region.playerHeadingSource,
        strength: next.region.playerHeadingStrength,
        anchor: next.region.representativeAnchor,
        gapFromPrevious: anchorDistance(current, next),
        corridorPrevious: next.playerCorridor.previousDirection,
        corridorState: next.playerCorridor.state,
        playerAge: next.nextHistory.previousPlayerDirectionAgeTicks,
        corridorAge: next.nextHistory.previousCorridorDirectionAgeTicks
      });
      current = next;
    }

    expect(observations.at(-1)?.source).toBe("none");
    console.info("[CCC0_AUDIT] direction-memory-expiry", JSON.stringify(observations));
  });
});
