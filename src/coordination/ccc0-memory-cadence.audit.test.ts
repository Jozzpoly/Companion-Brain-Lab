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

function gap(a: Vec2 | null, b: Vec2 | null): number {
  if (!a || !b) return Number.POSITIVE_INFINITY;
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function run(cadence: number) {
  let current = frame(snapshot(0, 2));
  let maximumStep = 0;
  let maximumNormalizedSpeed = 0;
  let totalPath = 0;
  let observations = 0;
  let maximumAtTick = 0;

  for (let tick = cadence; tick <= 72; tick += cadence) {
    const next = frame(snapshot(tick, 0), current.nextHistory);
    const step = gap(current.region.representativeAnchor, next.region.representativeAnchor);
    maximumStep = Math.max(maximumStep, step);
    if (step === maximumStep) maximumAtTick = tick;
    totalPath += step;
    // Convert target displacement per observation to an equivalent m/s. This is
    // diagnostic only; the target is not itself an actor and is not required to
    // obey companion speed authority.
    maximumNormalizedSpeed = Math.max(maximumNormalizedSpeed, step / (cadence / 60));
    observations += 1;
    current = next;
  }

  return { cadence, observations, maximumStep, maximumAtTick, maximumNormalizedSpeed, totalPath };
}

describe("CCC-0 memory fade cadence localization", () => {
  it("measures whether the stop transition is a policy cliff or a sampling cliff", () => {
    const result = [1, 2, 3, 4, 6, 8, 12].map(run);
    expect(result).toHaveLength(7);
    console.info("[CCC0_AUDIT] memory-cadence", JSON.stringify(result));
  });
});
