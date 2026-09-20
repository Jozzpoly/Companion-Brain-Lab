import { describe, expect, it } from "vitest";
import type { ActorSnapshot, StaticCircleTraversalResult, Vec2, WorldSnapshot } from "../world/types";
import type { StaticTraversalQuery } from "../navigation/static-router";
import {
  createEmptyShadowCoordinationHistory,
  evaluateShadowCoordinationFrame,
  type ShadowCoordinationFrame,
  type ShadowCoordinationHistory
} from "./shadow-coordination-frame";

function actor(
  id: ActorSnapshot["id"],
  position: Vec2,
  velocity: Vec2 = { x: 0, y: 0 }
): ActorSnapshot {
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

function snapshot(options: {
  tick?: number;
  playerPosition: Vec2;
  companionPosition: Vec2;
  playerVelocity?: Vec2;
  companionVelocity?: Vec2;
}): WorldSnapshot {
  return {
    tick: options.tick ?? 0,
    scenarioId: "open",
    width: 24,
    height: 24,
    actors: [
      actor("companion", options.companionPosition, options.companionVelocity),
      actor("player", options.playerPosition, options.playerVelocity)
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

function evaluate(
  state: WorldSnapshot,
  history: ShadowCoordinationHistory = createEmptyShadowCoordinationHistory(),
  options?: {
    relationshipTarget?: Vec2;
    preferredVelocity?: Vec2;
    authoritativeVelocity?: Vec2;
  }
): ShadowCoordinationFrame {
  return evaluateShadowCoordinationFrame({
    snapshot: state,
    query: clearQuery,
    physicalSpeedCapability: 3,
    history,
    legacyRelationshipTarget: options?.relationshipTarget,
    legacyPreferredVelocity: options?.preferredVelocity,
    legacyAuthoritativeVelocity: options?.authoritativeVelocity
  });
}

function add(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

function rotate90Vector(value: Vec2): Vec2 {
  return { x: -value.y, y: value.x };
}

function rotate90Point(value: Vec2, center: Vec2): Vec2 {
  const relative = { x: value.x - center.x, y: value.y - center.y };
  const rotated = rotate90Vector(relative);
  return { x: center.x + rotated.x, y: center.y + rotated.y };
}

function expectVecClose(actual: Vec2 | null, expected: Vec2 | null, precision = 8): void {
  if (actual === null || expected === null) {
    expect(actual).toBe(expected);
    return;
  }
  expect(actual.x).toBeCloseTo(expected.x, precision);
  expect(actual.y).toBeCloseTo(expected.y, precision);
}

function lcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

function signature(frame: ShadowCoordinationFrame) {
  return {
    tick: frame.tick,
    region: {
      state: frame.region.state,
      best: frame.region.bestSampleId,
      coherent: [...frame.region.coherentSampleIds],
      topology: frame.region.topologyKey,
      anchor: frame.region.representativeAnchor,
      headingSource: frame.region.playerHeadingSource,
      headingStrength: frame.region.playerHeadingStrength
    },
    pace: {
      label: frame.pace.label,
      urgency: frame.pace.urgency,
      speed: frame.pace.desiredSpeed
    },
    corridor: {
      state: frame.playerCorridor.state,
      source: frame.playerCorridor.velocitySource,
      confidence: frame.playerCorridor.confidence,
      endpoint: frame.playerCorridor.endpoint
    },
    preferredConflict: frame.preferredPlayerFlowConflict.state,
    authoritativeConflict: frame.authoritativePlayerFlowConflict.state
  };
}

function seededReplay(seed: number) {
  const random = lcg(seed);
  let history = createEmptyShadowCoordinationHistory();
  const result: ReturnType<typeof signature>[] = [];

  for (let step = 0; step < 240; step += 1) {
    const angle = random() * Math.PI * 2;
    const speed = random() * 3;
    const player = { x: 8 + random() * 8, y: 8 + random() * 8 };
    const companion = { x: 8 + random() * 8, y: 8 + random() * 8 };
    const playerVelocity = { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed };
    const frame = evaluate(snapshot({
      tick: step * 6,
      playerPosition: player,
      companionPosition: companion,
      playerVelocity,
      companionVelocity: { x: random() - 0.5, y: random() - 0.5 }
    }), history, {
      relationshipTarget: add(player, { x: -1, y: 0.35 }),
      preferredVelocity: { x: random() - 0.5, y: random() - 0.5 },
      authoritativeVelocity: { x: random() - 0.5, y: random() - 0.5 }
    });
    result.push(signature(frame));
    history = frame.nextHistory;
  }

  return result;
}

describe("CCC-0 repaired metamorphic invariants", () => {
  it("remains translation-covariant in open space", () => {
    const delta = { x: 3.2, y: -2.1 };
    const player = { x: 11, y: 10 };
    const companion = { x: 8.4, y: 9.1 };
    const target = { x: 9.8, y: 10.6 };
    const playerVelocity = { x: 1.2, y: 0.6 };
    const companionVelocity = { x: 0.3, y: -0.2 };
    const preferred = { x: 0.8, y: 0.4 };
    const final = { x: 0.65, y: 0.3 };

    const base = evaluate(snapshot({
      playerPosition: player,
      companionPosition: companion,
      playerVelocity,
      companionVelocity
    }), undefined, { relationshipTarget: target, preferredVelocity: preferred, authoritativeVelocity: final });
    const shifted = evaluate(snapshot({
      playerPosition: add(player, delta),
      companionPosition: add(companion, delta),
      playerVelocity,
      companionVelocity
    }), undefined, {
      relationshipTarget: add(target, delta),
      preferredVelocity: preferred,
      authoritativeVelocity: final
    });

    expect(shifted.region.state).toBe(base.region.state);
    expect(shifted.region.bestSampleId).toBe(base.region.bestSampleId);
    expect(shifted.region.coherentSampleIds).toEqual(base.region.coherentSampleIds);
    expect(shifted.region.playerHeadingStrength).toBeCloseTo(base.region.playerHeadingStrength, 12);
    expectVecClose(
      shifted.region.representativeAnchor,
      base.region.representativeAnchor ? add(base.region.representativeAnchor, delta) : null
    );
    expect(shifted.pace.urgency).toBeCloseTo(base.pace.urgency, 10);
    expect(shifted.pace.desiredSpeed).toBeCloseTo(base.pace.desiredSpeed, 10);
    expectVecClose(shifted.playerCorridor.endpoint, add(base.playerCorridor.endpoint, delta));
    expect(shifted.preferredPlayerFlowConflict.state).toBe(base.preferredPlayerFlowConflict.state);
    expect(shifted.authoritativePlayerFlowConflict.state).toBe(base.authoritativePlayerFlowConflict.state);
  });

  it("remains quarter-turn rotation-covariant on the 32-direction lattice", () => {
    const center = { x: 12, y: 12 };
    const player = { x: 13.2, y: 11.1 };
    const companion = { x: 9.5, y: 10.2 };
    const playerVelocity = { x: 1.35, y: 0.55 };
    const companionVelocity = { x: 0.3, y: -0.25 };
    const target = { x: 11.7, y: 11.8 };
    const preferred = { x: 0.9, y: 0.35 };
    const final = { x: 0.7, y: 0.2 };

    const base = evaluate(snapshot({
      playerPosition: player,
      companionPosition: companion,
      playerVelocity,
      companionVelocity
    }), undefined, { relationshipTarget: target, preferredVelocity: preferred, authoritativeVelocity: final });
    const rotated = evaluate(snapshot({
      playerPosition: rotate90Point(player, center),
      companionPosition: rotate90Point(companion, center),
      playerVelocity: rotate90Vector(playerVelocity),
      companionVelocity: rotate90Vector(companionVelocity)
    }), undefined, {
      relationshipTarget: rotate90Point(target, center),
      preferredVelocity: rotate90Vector(preferred),
      authoritativeVelocity: rotate90Vector(final)
    });

    expect(rotated.region.state).toBe(base.region.state);
    expect(rotated.region.routeEvaluatedCount).toBe(base.region.routeEvaluatedCount);
    expect(rotated.region.staticTraversalQueryCount).toBe(base.region.staticTraversalQueryCount);
    expect(rotated.region.playerHeadingStrength).toBeCloseTo(base.region.playerHeadingStrength, 12);
    expectVecClose(
      rotated.region.representativeAnchor,
      base.region.representativeAnchor ? rotate90Point(base.region.representativeAnchor, center) : null,
      7
    );
    expectVecClose(rotated.region.playerDirection, rotate90Vector(base.region.playerDirection), 8);
    expect(rotated.pace.urgency).toBeCloseTo(base.pace.urgency, 8);
    expect(rotated.pace.desiredSpeed).toBeCloseTo(base.pace.desiredSpeed, 8);
    expectVecClose(rotated.playerCorridor.endpoint, rotate90Point(base.playerCorridor.endpoint, center), 8);
    expect(rotated.preferredPlayerFlowConflict.state).toBe(base.preferredPlayerFlowConflict.state);
    expect(rotated.authoritativePlayerFlowConflict.state).toBe(base.authoritativePlayerFlowConflict.state);
  });

  it("replays the same 24-second seeded adversarial evidence sequence exactly", () => {
    expect(seededReplay(0xc0ffee)).toEqual(seededReplay(0xc0ffee));
  });
});
