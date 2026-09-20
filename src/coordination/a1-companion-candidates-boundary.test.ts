import { describe, expect, it } from "vitest";
import type { MovementCapability } from "../world/movement-capability";
import {
  buildA1CompanionCandidateSet,
  realizeA1TemporalCandidate,
  type A1TemporalActuationModel
} from "./a1-companion-candidates";

const capability: MovementCapability = {
  actorId: "companion",
  maxSpeed: 3,
  radius: 0.35,
  source: "actor-spec"
};

const actuationModel: A1TemporalActuationModel = {
  source: "A1_2B_EXPERIMENTAL_ACTUATION_MODEL",
  integrationStepSeconds: 1 / 60,
  maxAcceleration: 4,
  maxBrakingAcceleration: 6,
  maxJerk: 40
};

describe("Authority-A1.2b temporal entry-state boundary", () => {
  it("rejects acceleration state that is already outside the declared experimental actuator envelope", () => {
    const candidates = buildA1CompanionCandidateSet({
      tick: 4,
      companionCurrentVelocity: { id: "current", sourceTick: 4, velocity: { x: 0, y: 0 } },
      playerFuture: { id: "player", sourceTick: 4, velocity: { x: 2, y: 0 } },
      currentRelativeOffset: { x: -1.45, y: 0 },
      capability,
      localAlternativeDeltaSpeed: 0.5
    });
    const feedForward = candidates.seeds.find((candidate) => candidate.family === "PLAYER_FEED_FORWARD");
    if (!feedForward) throw new Error("missing feed-forward candidate");

    expect(() => realizeA1TemporalCandidate({
      candidate: feedForward,
      capability,
      horizonSeconds: 0.25,
      initialVelocity: { x: 0, y: 0 },
      initialAcceleration: { x: 7, y: 0 },
      actuationModel
    })).toThrow(/initial acceleration lies outside the explicit experimental actuation-model envelope/i);
  });
});
