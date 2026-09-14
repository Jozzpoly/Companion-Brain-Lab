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

describe("CCC-0 readiness RED falsifiers", () => {
  it("RED: shrinking an infinitesimal speed perturbation around the observation threshold should shrink its semantic discontinuity", () => {
    const coarse = thresholdGap(0.01);
    const fine = thresholdGap(0.0001);

    console.info("[CCC0_RED] threshold-continuity", JSON.stringify({ coarse, fine }));

    // This is a metamorphic continuity oracle rather than an arbitrary absolute
    // distance threshold: as the input perturbation tends toward zero, the induced
    // region/pace discontinuity should contract rather than remain a full mode jump.
    expect(fine.anchor).toBeLessThan(coarse.anchor);
    expect(fine.urgency).toBeLessThan(coarse.urgency);
    expect(fine.overlap).toBeGreaterThanOrEqual(coarse.overlap);
  });

  it("RED: a ten-second stop should age out old velocity direction before a new reversal is classified", () => {
    const shortStop = reversalAfterStop(6);
    const longStop = reversalAfterStop(600);

    console.info("[CCC0_RED] stale-heading-age", JSON.stringify({
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
    // After 10 seconds with zero motion there is no fresh velocity evidence that
    // justifies treating the new westward motion as a reversal of the old eastward
    // trajectory. If facing becomes a future semantic input it should be explicit,
    // not smuggled through stale velocity history.
    expect(longStop.playerCorridor.previousDirection).toBeNull();
    expect(longStop.playerCorridor.state).toBe("MOVING");
  });
});
