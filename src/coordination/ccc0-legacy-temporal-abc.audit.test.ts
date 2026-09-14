import { describe, expect, it } from "vitest";
import { RelationalPositioningBrain } from "../brain/relational-positioning";
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

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

interface TemporalMetrics {
  maximumStep: number;
  totalPath: number;
  sequence: Array<{ tick: number; phase: string; target: Vec2; step: number }>;
}

function metrics(sequence: Array<{ tick: number; phase: string; target: Vec2 }>): TemporalMetrics {
  let maximumStep = 0;
  let totalPath = 0;
  const enriched: TemporalMetrics["sequence"] = [];
  let previous: Vec2 | null = null;
  for (const entry of sequence) {
    const step = previous ? distance(previous, entry.target) : 0;
    maximumStep = Math.max(maximumStep, step);
    totalPath += step;
    enriched.push({ ...entry, step });
    previous = entry.target;
  }
  return { maximumStep, totalPath, sequence: enriched };
}

describe("CCC-0 vs legacy temporal target audit", () => {
  it("compares move → stop → reversal target continuity at the real 6-tick cognition cadence", () => {
    const legacy = new RelationalPositioningBrain();
    let shadow = frame(snapshot(0, 2));
    const shadowSequence: Array<{ tick: number; phase: string; target: Vec2 }> = [];
    const legacySequence: Array<{ tick: number; phase: string; target: Vec2 }> = [];

    const observations: Array<{ tick: number; speed: number; phase: string }> = [
      { tick: 0, speed: 2, phase: "east" },
      { tick: 6, speed: 0, phase: "stop" },
      { tick: 12, speed: 0, phase: "stop" },
      { tick: 18, speed: 0, phase: "stop" },
      { tick: 24, speed: 0, phase: "stop" },
      { tick: 30, speed: 0, phase: "stop" },
      { tick: 36, speed: 0, phase: "stop" },
      { tick: 42, speed: -2, phase: "west" },
      { tick: 48, speed: -2, phase: "west" },
      { tick: 54, speed: -2, phase: "west" }
    ];

    for (const observation of observations) {
      const state = snapshot(observation.tick, observation.speed);
      if (observation.tick !== 0) shadow = frame(state, shadow.nextHistory);
      const shadowTarget = shadow.region.representativeAnchor;
      if (!shadowTarget) throw new Error("CCC-0 produced no representative anchor in open-space temporal A/B.");
      shadowSequence.push({ tick: observation.tick, phase: observation.phase, target: { ...shadowTarget } });

      const legacyDecision = legacy.decision(state);
      legacySequence.push({ tick: observation.tick, phase: observation.phase, target: { ...legacyDecision.target } });
    }

    const result = {
      shadow: metrics(shadowSequence),
      legacy: metrics(legacySequence)
    };

    expect(result.shadow.sequence).toHaveLength(result.legacy.sequence.length);
    console.info("[CCC0_AUDIT] legacy-temporal-abc", JSON.stringify(result));
  });
});
