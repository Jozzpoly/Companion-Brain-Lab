import { describe, expect, it } from "vitest";
import type { MovementCapability } from "../world/movement-capability";
import type { Vec2 } from "../world/types";
import {
  buildA1CompanionCandidateSet,
  realizeA1DirectCandidate,
  realizeA1TemporalCandidate,
  type A1CompanionCandidateSeed,
  type A1TemporalActuationModel
} from "./a1-companion-candidates";

function capability(maxSpeed = 3): MovementCapability {
  return {
    actorId: "companion",
    maxSpeed,
    radius: 0.35,
    source: "actor-spec"
  };
}

function model(overrides: Partial<A1TemporalActuationModel> = {}): A1TemporalActuationModel {
  return {
    source: "A1_2B_EXPERIMENTAL_ACTUATION_MODEL",
    integrationStepSeconds: 1 / 60,
    maxAcceleration: 4,
    maxBrakingAcceleration: 6,
    maxJerk: 40,
    ...overrides
  };
}

function set(options: {
  maxSpeed?: number;
  current?: Vec2;
  player?: Vec2;
  relative?: Vec2;
  delta?: number;
  tick?: number;
} = {}) {
  const tick = options.tick ?? 11;
  return buildA1CompanionCandidateSet({
    tick,
    companionCurrentVelocity: {
      id: "current-companion-body",
      sourceTick: tick,
      velocity: options.current ?? { x: 1, y: 0 }
    },
    playerFuture: {
      id: "owner-request-continuation",
      sourceTick: tick,
      velocity: options.player ?? { x: 2, y: 0 }
    },
    currentRelativeOffset: options.relative ?? { x: 0, y: -1.5 },
    capability: capability(options.maxSpeed ?? 3),
    localAlternativeDeltaSpeed: options.delta ?? 0.6
  });
}

function seedByFamily(
  candidateSet: ReturnType<typeof set>,
  family: A1CompanionCandidateSeed["family"]
): A1CompanionCandidateSeed {
  const result = candidateSet.seeds.find((candidate) => candidate.family === family);
  if (!result) throw new Error(`Missing candidate family ${family}`);
  return result;
}

function rotate90(value: Vec2): Vec2 {
  return { x: -value.y, y: value.x };
}

function expectVectorClose(actual: Vec2, expected: Vec2, precision = 12): void {
  expect(actual.x).toBeCloseTo(expected.x, precision);
  expect(actual.y).toBeCloseTo(expected.y, precision);
}

describe("Authority-A1.2b compact companion candidate families", () => {
  it("builds a small deterministic family set with feed-forward as one candidate rather than privileged policy", () => {
    const first = set();
    const second = set();

    expect(first.seeds.map((candidate) => candidate.family)).toEqual([
      "HOLD",
      "MAINTAIN_CURRENT",
      "PLAYER_FEED_FORWARD",
      "RELATIVE_RADIAL_INWARD",
      "RELATIVE_RADIAL_OUTWARD",
      "RELATIVE_TANGENT_POSITIVE",
      "RELATIVE_TANGENT_NEGATIVE"
    ]);
    expect(first.seeds).toEqual(second.seeds);
    expect(first.seeds).toHaveLength(7);
    expect(seedByFamily(first, "PLAYER_FEED_FORWARD").desiredVelocity).toEqual({ x: 2, y: 0 });
    expect(first.seeds.some((candidate) => candidate.family === "PLAYER_FEED_FORWARD")).toBe(true);
  });

  it("generates symmetric local alternatives in the current player-relative basis", () => {
    const candidates = set({
      player: { x: 1.5, y: 0.25 },
      relative: { x: 0, y: -2 },
      delta: 0.8
    });
    const feedForward = seedByFamily(candidates, "PLAYER_FEED_FORWARD").desiredVelocity;
    const inward = seedByFamily(candidates, "RELATIVE_RADIAL_INWARD").desiredVelocity;
    const outward = seedByFamily(candidates, "RELATIVE_RADIAL_OUTWARD").desiredVelocity;
    const positive = seedByFamily(candidates, "RELATIVE_TANGENT_POSITIVE").desiredVelocity;
    const negative = seedByFamily(candidates, "RELATIVE_TANGENT_NEGATIVE").desiredVelocity;

    expectVectorClose(
      { x: (inward.x + outward.x) / 2, y: (inward.y + outward.y) / 2 },
      feedForward
    );
    expectVectorClose(
      { x: (positive.x + negative.x) / 2, y: (positive.y + negative.y) / 2 },
      feedForward
    );
    expect(candidates.localBasisAvailable).toBe(true);
    expect(seedByFamily(candidates, "RELATIVE_RADIAL_INWARD").localBasisSource)
      .toBe("CURRENT_RELATIVE_OFFSET");
  });

  it("does not fabricate a local semantic axis when companion and player positions coincide", () => {
    const candidates = set({ relative: { x: 0, y: 0 } });

    expect(candidates.localBasisAvailable).toBe(false);
    expect(candidates.seeds.map((candidate) => candidate.family)).toEqual([
      "HOLD",
      "MAINTAIN_CURRENT",
      "PLAYER_FEED_FORWARD"
    ]);
  });

  it("is rotation-covariant when current motion, player future and relative state rotate together", () => {
    const base = set({
      current: { x: 0.8, y: -0.2 },
      player: { x: 1.7, y: 0.4 },
      relative: { x: -1.2, y: 0.7 },
      delta: 0.55
    });
    const rotated = set({
      current: rotate90({ x: 0.8, y: -0.2 }),
      player: rotate90({ x: 1.7, y: 0.4 }),
      relative: rotate90({ x: -1.2, y: 0.7 }),
      delta: 0.55
    });

    for (const candidate of base.seeds) {
      const counterpart = seedByFamily(rotated, candidate.family);
      expectVectorClose(counterpart.desiredVelocity, rotate90(candidate.desiredVelocity));
    }
  });

  it("rejects stale velocity evidence and an unbounded local sampling delta", () => {
    expect(() => buildA1CompanionCandidateSet({
      tick: 7,
      companionCurrentVelocity: { id: "current", sourceTick: 6, velocity: { x: 0, y: 0 } },
      playerFuture: { id: "player", sourceTick: 7, velocity: { x: 0, y: 0 } },
      currentRelativeOffset: { x: 1, y: 0 },
      capability: capability(3),
      localAlternativeDeltaSpeed: 0.5
    })).toThrow(/current velocity sourceTick must equal candidate-set tick 7/i);

    expect(() => set({ maxSpeed: 3, delta: 3.1 }))
      .toThrow(/delta speed must be positive, finite and no greater than companion maxSpeed/i);
  });
});

describe("Authority-A1.2b DIRECT command admissibility", () => {
  it("uses World MovementCapability rather than the legacy hard-coded speed 3", () => {
    const candidates = set({ maxSpeed: 5, player: { x: 4.4, y: 0 } });
    const feedForward = seedByFamily(candidates, "PLAYER_FEED_FORWARD");
    const realization = realizeA1DirectCandidate({
      candidate: feedForward,
      capability: capability(5),
      horizonSeconds: 0.5
    });

    expect(realization.capabilityMaxSpeed).toBe(5);
    expect(realization.capabilityClipped).toBe(false);
    expect(realization.commandVelocity).toEqual({ x: 4.4, y: 0 });
    expect(realization.terminalVelocity).toEqual({ x: 4.4, y: 0 });
    expect(realization.reachabilityClaim).toBe("DIRECT_COMMAND_ADMISSIBLE_ONLY");
    expect(realization.worldLegalityClaim).toBe("NONE_A1_2B");
  });

  it("clips a faster player feed-forward hypothesis honestly at companion command capability", () => {
    const candidates = set({ maxSpeed: 3, player: { x: 5, y: 0 } });
    const feedForward = seedByFamily(candidates, "PLAYER_FEED_FORWARD");
    const realization = realizeA1DirectCandidate({
      candidate: feedForward,
      capability: capability(3),
      horizonSeconds: 0.4
    });

    expect(realization.desiredVelocity).toEqual({ x: 5, y: 0 });
    expect(realization.capabilityClipped).toBe(true);
    expect(Math.hypot(realization.commandVelocity.x, realization.commandVelocity.y)).toBeCloseTo(3, 12);
    expect(realization.predictedDisplacement.x).toBeCloseTo(1.2, 12);
  });
});

describe("Authority-A1.2b TEMPORAL experimental actuation rollout", () => {
  it("does not pretend an instantaneous full-speed velocity jump is temporally realized", () => {
    const candidates = set({ maxSpeed: 5, player: { x: 5, y: 0 } });
    const feedForward = seedByFamily(candidates, "PLAYER_FEED_FORWARD");
    const realization = realizeA1TemporalCandidate({
      candidate: feedForward,
      capability: capability(5),
      horizonSeconds: 1 / 60,
      initialVelocity: { x: 0, y: 0 },
      initialAcceleration: { x: 0, y: 0 },
      actuationModel: model()
    });

    expect(realization.boundedDesiredVelocity).toEqual({ x: 5, y: 0 });
    expect(realization.terminalVelocity.x).toBeGreaterThan(0);
    expect(realization.terminalVelocity.x).toBeLessThan(0.1);
    expect(realization.terminalVelocityError).toBeGreaterThan(4.9);
    expect(realization.integrationSteps).toBe(1);
    expect(realization.reachabilityClaim).toBe("TEMPORAL_EXPERIMENTAL_MODEL_ROLLOUT");
    expect(realization.worldLegalityClaim).toBe("NONE_A1_2B");
  });

  it("binds temporal max speed to World capability while keeping accel/brake/jerk explicit experiment parameters", () => {
    const candidates = set({ maxSpeed: 5, player: { x: 5, y: 0 } });
    const feedForward = seedByFamily(candidates, "PLAYER_FEED_FORWARD");
    const actuationModel = model({
      maxAcceleration: 100,
      maxBrakingAcceleration: 120,
      maxJerk: 10_000
    });
    const realization = realizeA1TemporalCandidate({
      candidate: feedForward,
      capability: capability(5),
      horizonSeconds: 0.2,
      initialVelocity: { x: 0, y: 0 },
      initialAcceleration: { x: 0, y: 0 },
      actuationModel
    });

    expect(realization.capabilityMaxSpeed).toBe(5);
    expect(realization.terminalVelocity.x).toBeGreaterThan(4.9);
    expect(realization.terminalVelocity.x).toBeLessThanOrEqual(5 + 1e-9);
    expect(realization.actuationModel).toEqual(actuationModel);
    expect(realization.actuationModel.maxAcceleration).toBe(100);
    expect(realization.actuationModel.maxBrakingAcceleration).toBe(120);
    expect(realization.actuationModel.maxJerk).toBe(10_000);
  });

  it("reports capability clipping separately from temporal realization error", () => {
    const candidates = set({ maxSpeed: 3, player: { x: 6, y: 0 } });
    const feedForward = seedByFamily(candidates, "PLAYER_FEED_FORWARD");
    const realization = realizeA1TemporalCandidate({
      candidate: feedForward,
      capability: capability(3),
      horizonSeconds: 0.25,
      initialVelocity: { x: 0, y: 0 },
      initialAcceleration: { x: 0, y: 0 },
      actuationModel: model()
    });

    expect(realization.desiredVelocity).toEqual({ x: 6, y: 0 });
    expect(realization.boundedDesiredVelocity).toEqual({ x: 3, y: 0 });
    expect(realization.capabilityClipped).toBe(true);
    expect(realization.terminalVelocityError).toBeGreaterThanOrEqual(0);
  });

  it("refuses to reinterpret extreme externally-induced body velocity as ordinary continuity-model truth", () => {
    const hold = seedByFamily(set({ maxSpeed: 3 }), "HOLD");

    expect(() => realizeA1TemporalCandidate({
      candidate: hold,
      capability: capability(3),
      horizonSeconds: 0.25,
      initialVelocity: { x: 4.6, y: 0 },
      initialAcceleration: { x: 0, y: 0 },
      actuationModel: model()
    })).toThrow(/exceeds the continuity donor's explicit 1.5x capability input envelope/i);
  });
});
