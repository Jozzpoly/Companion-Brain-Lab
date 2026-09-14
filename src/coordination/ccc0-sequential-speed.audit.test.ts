import { describe, expect, it } from "vitest";
import type { ActorSnapshot, StaticCircleTraversalResult, Vec2, WorldSnapshot } from "../world/types";
import type { StaticTraversalQuery } from "../navigation/static-router";
import {
  createEmptyShadowCoordinationHistory,
  evaluateShadowCoordinationFrame,
  type ShadowCoordinationFrame,
  type ShadowCoordinationHistory
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

function evaluate(tick: number, speed: number, history: ShadowCoordinationHistory): ShadowCoordinationFrame {
  return evaluateShadowCoordinationFrame({
    snapshot: snapshot(tick, speed),
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

describe("CCC-0 sequential low-speed continuity audit", () => {
  it("characterizes a 0.001 m/s ramp while preserving the real previous-region history", () => {
    let history = createEmptyShadowCoordinationHistory();
    let previous = evaluate(0, 0.14, history);
    history = previous.nextHistory;
    let maximum = { from: 0.14, to: 0.14, gap: 0, fromBest: previous.region.bestSampleId, toBest: previous.region.bestSampleId };
    const large: typeof maximum[] = [];
    let tick = 6;

    for (let milli = 141; milli <= 300; milli += 1, tick += 6) {
      const speed = milli / 1000;
      const current = evaluate(tick, speed, history);
      const candidate = {
        from: (milli - 1) / 1000,
        to: speed,
        gap: anchorGap(previous, current),
        fromBest: previous.region.bestSampleId,
        toBest: current.region.bestSampleId
      };
      if (candidate.gap > maximum.gap) maximum = candidate;
      if (candidate.gap > 0.25) large.push(candidate);
      previous = current;
      history = current.nextHistory;
    }

    expect(Number.isFinite(maximum.gap)).toBe(true);
    console.info("[CCC0_AUDIT] sequential-speed-ramp", JSON.stringify({ maximum, large }));
  });

  it("characterizes alternating ±0.001 m/s jitter around 0.20 with continuity history", () => {
    let history = createEmptyShadowCoordinationHistory();
    let previous = evaluate(0, 0.2, history);
    history = previous.nextHistory;
    let maximumGap = 0;
    const sequence: Array<{ tick: number; speed: number; gap: number; best: string | null; anchor: Vec2 | null }> = [];

    for (let step = 1; step <= 60; step += 1) {
      const speed = step % 2 === 0 ? 0.199 : 0.201;
      const current = evaluate(step * 6, speed, history);
      const gap = anchorGap(previous, current);
      maximumGap = Math.max(maximumGap, gap);
      if (step <= 12 || gap > 0.25) {
        sequence.push({
          tick: step * 6,
          speed,
          gap,
          best: current.region.bestSampleId,
          anchor: current.region.representativeAnchor
        });
      }
      previous = current;
      history = current.nextHistory;
    }

    expect(Number.isFinite(maximumGap)).toBe(true);
    console.info("[CCC0_AUDIT] sequential-speed-jitter", JSON.stringify({ maximumGap, sequence }));
  });
});
