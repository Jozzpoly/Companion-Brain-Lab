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

function coherentOverlap(a: ShadowCoordinationFrame, b: ShadowCoordinationFrame): number {
  const left = new Set(a.region.coherentSampleIds);
  const right = new Set(b.region.coherentSampleIds);
  const union = new Set([...left, ...right]);
  if (union.size === 0) return 1;
  let intersection = 0;
  for (const id of left) if (right.has(id)) intersection += 1;
  return intersection / union.size;
}

function thresholdGap(delta: number) {
  const below = frame(snapshot(0, 0.15 - delta));
  const above = frame(snapshot(0, 0.15 + delta));
  return {
    anchor: anchorGap(below, above),
    urgency: Math.abs(below.pace.urgency - above.pace.urgency),
    overlap: coherentOverlap(below, above)
  };
}

function reversalAfterStop(stopTicks: number): ShadowCoordinationFrame {
  let current = frame(snapshot(0, 2));
  for (let tick = 6; tick <= stopTicks; tick += 6) {
    current = frame(snapshot(tick, 0), current.nextHistory);
  }
  return frame(snapshot(stopTicks + 6, -2), current.nextHistory);
}

describe("CCC-0 readiness repair regressions", () => {
  it("shrinks semantic displacement as the speed perturbation around 0.15 m/s shrinks", () => {
    const coarse = thresholdGap(0.01);
    const fine = thresholdGap(0.0001);

    console.info("[CCC0_REPAIR] threshold-continuity", JSON.stringify({ coarse, fine }));

    expect(coarse.anchor).toBeLessThan(0.1);
    expect(fine.anchor).toBeLessThan(coarse.anchor);
    expect(fine.anchor).toBeLessThan(0.005);
    expect(fine.urgency).toBeLessThanOrEqual(coarse.urgency);
    expect(fine.overlap).toBeGreaterThanOrEqual(coarse.overlap);
  });

  it("retains a genuinely recent reversal cue but ages velocity direction out after a prolonged stop", () => {
    const shortStop = reversalAfterStop(6);
    const longStop = reversalAfterStop(600);

    console.info("[CCC0_REPAIR] stale-heading-age", JSON.stringify({
      short: {
        state: shortStop.playerCorridor.state,
        confidence: shortStop.playerCorridor.confidence,
        previousDirection: shortStop.playerCorridor.previousDirection,
        headingSource: shortStop.region.playerHeadingSource
      },
      long: {
        state: longStop.playerCorridor.state,
        confidence: longStop.playerCorridor.confidence,
        previousDirection: longStop.playerCorridor.previousDirection,
        headingSource: longStop.region.playerHeadingSource
      }
    }));

    expect(shortStop.playerCorridor.state).toBe("REVERSAL_UNCERTAIN");
    expect(shortStop.playerCorridor.previousDirection).not.toBeNull();
    expect(longStop.playerCorridor.previousDirection).toBeNull();
    expect(longStop.playerCorridor.state).toBe("MOVING");
  });
});
