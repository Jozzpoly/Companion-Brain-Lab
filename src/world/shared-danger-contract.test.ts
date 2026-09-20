import { describe, expect, it } from "vitest";
import {
  initialSharedDangerSnapshot,
  resolveSharedDangerAfterPhysics,
  type ResolveSharedDangerTickInput,
  type SharedDangerRules,
  type SharedDangerSnapshot,
  type WorldActionAttempt
} from "./shared-danger-contract";

const rules: SharedDangerRules = {
  interventionRange: 0.9,
  attackRange: 0.7,
  windupTicks: 3,
  recoveryTicks: 2
};

function windup(remaining = 1): SharedDangerSnapshot {
  return {
    ...initialSharedDangerSnapshot(),
    phase: "WINDUP",
    phaseTicksRemaining: remaining
  };
}

function recovering(remaining = 1): SharedDangerSnapshot {
  return {
    ...initialSharedDangerSnapshot(),
    phase: "RECOVERING",
    phaseTicksRemaining: remaining
  };
}

function attempt(actorId: "player" | "companion"): WorldActionAttempt {
  return { actorId, kind: "INTERVENE", targetId: "hostile" };
}

function resolve(
  partial: Partial<ResolveSharedDangerTickInput> = {}
) {
  return resolveSharedDangerAfterPhysics({
    observationTick: 10,
    before: windup(1),
    postPhysics: {
      hostilePosition: { x: 5, y: 4 },
      playerPosition: { x: 4.5, y: 4 },
      companionPosition: { x: 5.5, y: 4 }
    },
    attempts: [],
    rules,
    ...partial
  });
}

describe("S1-A shared-danger World contract", () => {
  it("rejects duplicate same-actor action authority before resolution", () => {
    expect(() =>
      resolve({
        attempts: [attempt("player"), attempt("player")]
      })
    ).toThrow(/Duplicate world action attempt/);
  });

  it("validates simultaneous player and companion interventions against one shared frame", () => {
    const forward = resolve({
      attempts: [attempt("player"), attempt("companion")]
    });
    const reverse = resolve({
      attempts: [attempt("companion"), attempt("player")]
    });

    expect(forward).toEqual(reverse);
    expect(forward.episodeOutcome).toBe("INTERRUPTED");
    expect(forward.after.phase).toBe("RECOVERING");
    expect(forward.after.interruptedBy).toEqual(["companion", "player"]);
    expect(forward.actionOutcomes.map((value) => [value.actorId, value.status])).toEqual([
      ["companion", "SUCCEEDED"],
      ["player", "SUCCEEDED"]
    ]);
  });

  it("does not let proximity substitute for an explicit action attempt", () => {
    const result = resolve({ attempts: [] });

    expect(result.episodeOutcome).toBe("PLAYER_HIT");
    expect(result.actionOutcomes).toEqual([]);
    expect(result.after.phase).toBe("RECOVERING");
    expect(result.after.interruptedBy).toEqual([]);
  });

  it("records out-of-range intervention as factual failure without cancelling the attack", () => {
    const result = resolve({
      postPhysics: {
        hostilePosition: { x: 5, y: 4 },
        playerPosition: { x: 4.5, y: 4 },
        companionPosition: { x: 8, y: 4 }
      },
      attempts: [attempt("companion")]
    });

    expect(result.actionOutcomes).toHaveLength(1);
    expect(result.actionOutcomes[0]?.status).toBe("OUT_OF_RANGE");
    expect(result.episodeOutcome).toBe("PLAYER_HIT");
  });

  it("lets a legal last-moment intervention resolve before hostile consequence", () => {
    const result = resolve({
      before: windup(1),
      attempts: [attempt("companion")]
    });

    expect(result.actionOutcomes[0]?.status).toBe("SUCCEEDED");
    expect(result.episodeOutcome).toBe("INTERRUPTED");
    expect(result.after.lastOutcome).toBe("INTERRUPTED");
    expect(result.after.lastOutcomeTick).toBe(11);
  });

  it("does not retroactively validate an APPROACHING action when post-physics range starts WINDUP", () => {
    const result = resolve({
      before: initialSharedDangerSnapshot(),
      attempts: [attempt("player")]
    });

    expect(result.actionOutcomes[0]?.status).toBe("INVALID_PHASE");
    expect(result.after.phase).toBe("WINDUP");
    expect(result.after.phaseTicksRemaining).toBe(rules.windupTicks);
    expect(result.episodeOutcome).toBe("NONE");
  });

  it("allows player movement during windup to make the factual attack miss", () => {
    const result = resolve({
      before: windup(1),
      postPhysics: {
        hostilePosition: { x: 5, y: 4 },
        playerPosition: { x: 6.5, y: 4 },
        companionPosition: { x: 8, y: 4 }
      },
      attempts: []
    });

    expect(result.episodeOutcome).toBe("ATTACK_MISSED");
    expect(result.after.lastOutcome).toBe("ATTACK_MISSED");
    expect(result.after.phase).toBe("RECOVERING");
  });

  it("does not resolve a windup before its explicit deadline", () => {
    const result = resolve({
      before: windup(3),
      attempts: []
    });

    expect(result.episodeOutcome).toBe("NONE");
    expect(result.after.phase).toBe("WINDUP");
    expect(result.after.phaseTicksRemaining).toBe(2);
    expect(result.after.lastOutcome).toBe("NONE");
  });

  it("ends the one-shot encounter when recovery time is exhausted", () => {
    const waiting = resolve({
      before: recovering(2),
      attempts: [attempt("player")]
    });
    expect(waiting.actionOutcomes[0]?.status).toBe("INVALID_PHASE");
    expect(waiting.after.phase).toBe("RECOVERING");
    expect(waiting.after.phaseTicksRemaining).toBe(1);

    const released = resolve({
      before: recovering(1),
      attempts: []
    });
    expect(released.after.phase).toBe("COMPLETE");
    expect(released.after.phaseTicksRemaining).toBe(0);
  });

  it("keeps a completed encounter inert until the scenario is reset", () => {
    const complete: SharedDangerSnapshot = {
      ...initialSharedDangerSnapshot(),
      phase: "COMPLETE",
      lastOutcome: "INTERRUPTED",
      lastOutcomeTick: 9
    };
    const result = resolve({
      before: complete,
      attempts: [attempt("player")]
    });

    expect(result.actionOutcomes[0]?.status).toBe("INVALID_PHASE");
    expect(result.after.phase).toBe("COMPLETE");
    expect(result.after.lastOutcome).toBe("INTERRUPTED");
  });
});
