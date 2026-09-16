import { describe, expect, it } from "vitest";
import type {
  ActorSnapshot,
  StaticCircleTraversalResult,
  Vec2,
  WorldSnapshot
} from "../world/types";
import { classifyObservedPlayerMotion } from "./situated-evidence";
import {
  createEmptyShadowCoordinationHistory,
  evaluateShadowCoordinationFrame
} from "./shadow-coordination-frame";

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clearTraversal(from: Vec2, to: Vec2, radius: number): StaticCircleTraversalResult {
  return {
    from: { ...from },
    to: { ...to },
    radius,
    distance: distance(from, to),
    clear: true,
    blocker: null
  };
}

function actor(snapshot: WorldSnapshot, id: "player" | "companion"): ActorSnapshot {
  const value = snapshot.actors.find((candidate) => candidate.id === id);
  if (!value) throw new Error(`missing ${id}`);
  return value;
}

function snapshot(input: {
  tick: number;
  requested: Vec2;
  actual: Vec2;
  contacted?: boolean;
}): WorldSnapshot {
  return {
    tick: input.tick,
    scenarioId: "open",
    width: 12,
    height: 8,
    actors: [
      {
        id: "player",
        position: { x: 4, y: 4 },
        radius: 0.3,
        requestedVelocity: { ...input.requested },
        actualVelocity: { ...input.actual },
        motionError: Math.hypot(input.actual.x - input.requested.x, input.actual.y - input.requested.y),
        contacts: input.contacted ? [{ with: "companion", contactCount: 1 }] : []
      },
      {
        id: "companion",
        position: { x: 1, y: 4 },
        radius: 0.3,
        requestedVelocity: { x: 0, y: 0 },
        actualVelocity: { x: 0, y: 0 },
        motionError: 0,
        contacts: input.contacted ? [{ with: "player", contactCount: 1 }] : []
      }
    ],
    obstacles: []
  };
}

describe("CCC external-motion memory contamination materiality", () => {
  it("persists an externally caused heading into a later stationary observation", () => {
    const pushed = snapshot({
      tick: 0,
      requested: { x: 0, y: 0 },
      actual: { x: -3, y: 0 },
      contacted: true
    });
    const player = actor(pushed, "player");
    const provenance = classifyObservedPlayerMotion({
      sourceTick: pushed.tick,
      position: { ...player.position },
      requestedVelocity: { ...player.requestedVelocity },
      actualVelocity: { ...player.actualVelocity },
      motionError: player.motionError,
      contacts: player.contacts.map((contact) => contact.with)
    });
    expect(provenance.state).toBe("EXTERNAL_MOTION_EVIDENT");

    const contaminated = evaluateShadowCoordinationFrame({
      snapshot: pushed,
      query: clearTraversal,
      physicalSpeedCapability: 3
    });
    expect(contaminated.region.playerHeadingSource).toBe("actual");
    expect(contaminated.nextHistory.previousPlayerDirection).toEqual({ x: -1, y: 0 });

    const quiet = snapshot({
      tick: 6,
      requested: { x: 0, y: 0 },
      actual: { x: 0, y: 0 }
    });
    const persisted = evaluateShadowCoordinationFrame({
      snapshot: quiet,
      query: clearTraversal,
      physicalSpeedCapability: 3,
      history: contaminated.nextHistory
    });

    expect(persisted.region.playerHeadingSource).toBe("previous");
    expect(persisted.region.playerDirection).toEqual({ x: -1, y: 0 });
    expect(persisted.region.playerHeadingStrength).toBeGreaterThan(0);
  });

  it("lets that external-motion memory materially reshape the next stationary relationship region", () => {
    const pushed = snapshot({
      tick: 0,
      requested: { x: 0, y: 0 },
      actual: { x: -3, y: 0 },
      contacted: true
    });
    const contaminated = evaluateShadowCoordinationFrame({
      snapshot: pushed,
      query: clearTraversal,
      physicalSpeedCapability: 3
    });

    const quiet = snapshot({
      tick: 6,
      requested: { x: 0, y: 0 },
      actual: { x: 0, y: 0 }
    });
    const clean = evaluateShadowCoordinationFrame({
      snapshot: quiet,
      query: clearTraversal,
      physicalSpeedCapability: 3,
      history: createEmptyShadowCoordinationHistory()
    });
    const poisoned = evaluateShadowCoordinationFrame({
      snapshot: quiet,
      query: clearTraversal,
      physicalSpeedCapability: 3,
      history: contaminated.nextHistory
    });

    expect(clean.region.playerHeadingSource).toBe("none");
    expect(poisoned.region.playerHeadingSource).toBe("previous");
    expect(clean.region.representativeAnchor).not.toBeNull();
    expect(poisoned.region.representativeAnchor).not.toBeNull();
    if (!clean.region.representativeAnchor || !poisoned.region.representativeAnchor) return;

    expect(poisoned.region.bestSampleId).not.toBe(clean.region.bestSampleId);
    expect(distance(poisoned.region.representativeAnchor, clean.region.representativeAnchor)).toBeGreaterThan(0.25);
  });
});
