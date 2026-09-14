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

const clearQuery: StaticTraversalQuery = (from, to, radius): StaticCircleTraversalResult => ({
  from: { ...from },
  to: { ...to },
  radius,
  distance: Math.hypot(to.x - from.x, to.y - from.y),
  clear: true,
  blocker: null
});

function trajectory(tick: number): WorldSnapshot {
  const seconds = tick / 60;
  const theta = seconds * 0.85;
  const playerPosition = {
    x: 10 + 2.0 * Math.cos(theta),
    y: 10 + 1.45 * Math.sin(theta)
  };
  const playerVelocity = {
    x: -2.0 * 0.85 * Math.sin(theta),
    y: 1.45 * 0.85 * Math.cos(theta)
  };
  const lagTheta = theta - 0.52;
  const companionPosition = {
    x: 10 + 2.35 * Math.cos(lagTheta),
    y: 10 + 1.75 * Math.sin(lagTheta)
  };
  const companionVelocity = {
    x: -2.35 * 0.85 * Math.sin(lagTheta),
    y: 1.75 * 0.85 * Math.cos(lagTheta)
  };

  return {
    tick,
    scenarioId: "open",
    width: 24,
    height: 24,
    actors: [
      actor("companion", companionPosition, companionVelocity),
      actor("player", playerPosition, playerVelocity)
    ],
    obstacles: []
  };
}

function evaluateAtCadence(cadence: number): ShadowCoordinationFrame {
  let history: ShadowCoordinationHistory = createEmptyShadowCoordinationHistory();
  let last: ShadowCoordinationFrame | null = null;
  for (let tick = 0; tick <= 240; tick += cadence) {
    const state = trajectory(tick);
    const player = state.actors.find((entry) => entry.id === "player")!;
    const companion = state.actors.find((entry) => entry.id === "companion")!;
    last = evaluateShadowCoordinationFrame({
      snapshot: state,
      query: clearQuery,
      physicalSpeedCapability: 3,
      history,
      legacyRelationshipTarget: {
        x: player.position.x - 1.1,
        y: player.position.y + 0.25
      },
      legacyPreferredVelocity: companion.actualVelocity,
      legacyAuthoritativeVelocity: companion.actualVelocity
    });
    history = last.nextHistory;
  }
  if (!last) throw new Error("missing cadence result");
  return last;
}

function distance(a: Vec2 | null, b: Vec2 | null): number | null {
  if (!a || !b) return null;
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function overlap(left: readonly string[], right: readonly string[]): number | null {
  if (left.length === 0 || right.length === 0) return null;
  const a = new Set(left);
  const b = new Set(right);
  const union = new Set([...a, ...b]);
  let intersection = 0;
  for (const id of a) if (b.has(id)) intersection += 1;
  return union.size > 0 ? intersection / union.size : null;
}

describe("CCC-0 cognition-cadence sensitivity audit", () => {
  it("characterizes whether provisional cadence is only a cost knob or also changes policy evidence", () => {
    const cadences = [1, 2, 3, 4, 6, 8, 12];
    const frames = cadences.map((cadence) => ({ cadence, frame: evaluateAtCadence(cadence) }));
    const reference = frames.find((entry) => entry.cadence === 1)!.frame;

    const observations = frames.map(({ cadence, frame }) => ({
      cadence,
      anchorGapFrom1: distance(reference.region.representativeAnchor, frame.region.representativeAnchor),
      coherentOverlapFrom1: overlap(reference.region.coherentSampleIds, frame.region.coherentSampleIds),
      bestSampleId: frame.region.bestSampleId,
      topologyKey: frame.region.topologyKey,
      urgency: frame.pace.urgency,
      urgencyDeltaFrom1: Math.abs(frame.pace.urgency - reference.pace.urgency),
      desiredSpeed: frame.pace.desiredSpeed,
      corridorState: frame.playerCorridor.state,
      corridorConfidence: frame.playerCorridor.confidence,
      outsideRegionTicks: frame.pace.outsideRegionTicks
    }));

    for (const { frame } of frames) {
      expect(frame.tick).toBe(240);
      expect(Number.isFinite(frame.pace.urgency)).toBe(true);
      expect(Number.isFinite(frame.pace.desiredSpeed)).toBe(true);
      expect(frame.region.representativeAnchor).not.toBeNull();
    }

    console.info("[CCC0_AUDIT] cadence-sensitivity", JSON.stringify(observations));
  });
});
