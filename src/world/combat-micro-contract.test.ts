import { describe, expect, it } from "vitest";
import {
  initialCombatMicroSnapshot,
  resolveCombatMicroAfterPhysics,
  type CombatMicroActionAttempt,
  type CombatMicroRules,
  type CombatMicroSnapshot
} from "./combat-micro-contract";

const rules: CombatMicroRules = {
  strikeRange: 1.05,
  attackRange: 0.8,
  pressureBreakRange: 1.25,
  pressureTicks: 3,
  recoveryTicks: 2,
  hostileHealth: 2,
  strikeDamage: 1
};

function attempt(actorId: "player" | "companion"): CombatMicroActionAttempt {
  return { actorId, kind: "STRIKE", targetId: "hostile" };
}

function resolve(input: {
  before?: CombatMicroSnapshot;
  hostile?: { x: number; y: number };
  player?: { x: number; y: number };
  companion?: { x: number; y: number };
  attempts?: readonly CombatMicroActionAttempt[];
  tick?: number;
}) {
  return resolveCombatMicroAfterPhysics({
    observationTick: input.tick ?? 10,
    before: input.before ?? initialCombatMicroSnapshot(rules),
    postPhysics: {
      hostilePosition: input.hostile ?? { x: 5, y: 4 },
      playerPosition: input.player ?? { x: 3.5, y: 4 },
      companionPosition: input.companion ?? { x: 5.8, y: 4 }
    },
    attempts: input.attempts ?? [],
    rules
  });
}

function recover(before: CombatMicroSnapshot): CombatMicroSnapshot {
  let state = before;
  for (let i = 0; i < rules.recoveryTicks; i += 1) {
    state = resolve({ before: state, attempts: [], tick: 20 + i }).after;
  }
  return state;
}

describe("bounded combat micro situation contract", () => {
  it("does not let proximity or body placement damage the hostile", () => {
    const result = resolve({
      player: { x: 4.2, y: 4 },
      companion: { x: 5.7, y: 4 },
      attempts: []
    });

    expect(result.after.hostileHealth).toBe(2);
    expect(result.after.successfulStrikeHistory).toEqual([]);
    expect(result.episodeOutcome).toBe("NONE");
  });

  it("allows an explicit strike during APPROACHING instead of a hidden timing window", () => {
    const result = resolve({
      companion: { x: 5.8, y: 4 },
      attempts: [attempt("companion")]
    });

    expect(result.actionOutcomes[0]?.status).toBe("SUCCEEDED");
    expect(result.episodeOutcome).toBe("HOSTILE_STRUCK");
    expect(result.after.phase).toBe("RECOVERING");
    expect(result.after.hostileHealth).toBe(1);
    expect(result.after.successfulStrikeHistory).toEqual(["companion"]);
  });

  it("keeps out-of-range action failure factual and visible in the result", () => {
    const result = resolve({
      companion: { x: 8, y: 4 },
      attempts: [attempt("companion")]
    });

    expect(result.actionOutcomes[0]?.status).toBe("OUT_OF_RANGE");
    expect(result.after.hostileHealth).toBe(2);
    expect(result.episodeOutcome).toBe("NONE");
  });

  it("lets sustained unopposed pressure produce a player consequence", () => {
    const started = resolve({
      player: { x: 4.4, y: 4 },
      attempts: []
    });

    expect(started.after.phase).toBe("PRESSURING");
    expect(started.after.phaseTicksRemaining).toBe(rules.pressureTicks);

    const middle = resolve({
      before: started.after,
      player: { x: 4.4, y: 4 },
      attempts: [],
      tick: 11
    });
    expect(middle.after.phase).toBe("PRESSURING");
    expect(middle.after.phaseTicksRemaining).toBe(2);

    const late = resolve({
      before: middle.after,
      player: { x: 4.4, y: 4 },
      attempts: [],
      tick: 12
    });
    const hit = resolve({
      before: late.after,
      player: { x: 4.4, y: 4 },
      attempts: [],
      tick: 13
    });

    expect(hit.episodeOutcome).toBe("PLAYER_HIT");
    expect(hit.after.playerHitCount).toBe(1);
    expect(hit.after.phase).toBe("RECOVERING");
    expect(hit.after.hostileHealth).toBe(2);
  });

  it("lets player movement break pressure before the consequence", () => {
    const pressing: CombatMicroSnapshot = {
      ...initialCombatMicroSnapshot(rules),
      phase: "PRESSURING",
      phaseTicksRemaining: 1
    };

    const result = resolve({
      before: pressing,
      player: { x: 6.6, y: 4 },
      attempts: []
    });

    expect(result.episodeOutcome).toBe("NONE");
    expect(result.after.phase).toBe("APPROACHING");
    expect(result.after.playerHitCount).toBe(0);
  });

  it("supports a player-only two-beat solution", () => {
    const first = resolve({
      player: { x: 4.2, y: 4 },
      attempts: [attempt("player")]
    });
    const reopened = recover(first.after);
    const second = resolve({
      before: reopened,
      player: { x: 4.2, y: 4 },
      attempts: [attempt("player")],
      tick: 30
    });

    expect(second.episodeOutcome).toBe("HOSTILE_DEFEATED");
    expect(second.after.phase).toBe("DEFEATED");
    expect(second.after.successfulStrikeHistory).toEqual(["player", "player"]);
  });

  it("supports a companion-only two-beat solution", () => {
    const first = resolve({
      companion: { x: 5.8, y: 4 },
      attempts: [attempt("companion")]
    });
    const reopened = recover(first.after);
    const second = resolve({
      before: reopened,
      companion: { x: 5.8, y: 4 },
      attempts: [attempt("companion")],
      tick: 30
    });

    expect(second.episodeOutcome).toBe("HOSTILE_DEFEATED");
    expect(second.after.successfulStrikeHistory).toEqual(["companion", "companion"]);
  });

  it("supports split responsibility across two beats", () => {
    const first = resolve({
      player: { x: 4.2, y: 4 },
      companion: { x: 7, y: 4 },
      attempts: [attempt("player")]
    });
    const reopened = recover(first.after);
    const second = resolve({
      before: reopened,
      player: { x: 3.5, y: 4 },
      companion: { x: 5.8, y: 4 },
      attempts: [attempt("companion")],
      tick: 30
    });

    expect(second.episodeOutcome).toBe("HOSTILE_DEFEATED");
    expect(second.after.successfulStrikeHistory).toEqual(["player", "companion"]);
  });

  it("supports simultaneous material contribution without actor-order bias", () => {
    const forward = resolve({
      player: { x: 4.2, y: 4 },
      companion: { x: 5.8, y: 4 },
      attempts: [attempt("player"), attempt("companion")]
    });
    const reverse = resolve({
      player: { x: 4.2, y: 4 },
      companion: { x: 5.8, y: 4 },
      attempts: [attempt("companion"), attempt("player")]
    });

    expect(forward).toEqual(reverse);
    expect(forward.episodeOutcome).toBe("HOSTILE_DEFEATED");
    expect(forward.after.successfulStrikeHistory).toEqual(["companion", "player"]);
  });

  it("lets a player act during PRESSURING rather than waiting for a hidden commitment phase", () => {
    const pressing: CombatMicroSnapshot = {
      ...initialCombatMicroSnapshot(rules),
      phase: "PRESSURING",
      phaseTicksRemaining: 1
    };

    const result = resolve({
      before: pressing,
      player: { x: 4.2, y: 4 },
      attempts: [attempt("player")]
    });

    expect(result.actionOutcomes[0]?.status).toBe("SUCCEEDED");
    expect(result.episodeOutcome).toBe("HOSTILE_STRUCK");
    expect(result.after.playerHitCount).toBe(0);
  });

  it("makes recovery an explicit no-strike beat instead of allowing action spam", () => {
    const recovering: CombatMicroSnapshot = {
      ...initialCombatMicroSnapshot(rules),
      phase: "RECOVERING",
      phaseTicksRemaining: 1,
      hostileHealth: 1,
      lastOutcome: "HOSTILE_STRUCK",
      lastOutcomeTick: 9,
      lastSuccessfulStrikers: ["player"],
      successfulStrikeHistory: ["player"]
    };

    const result = resolve({
      before: recovering,
      player: { x: 4.2, y: 4 },
      companion: { x: 5.8, y: 4 },
      attempts: [attempt("player"), attempt("companion")]
    });

    expect(result.actionOutcomes.every((value) => value.status === "INACTIVE_PHASE")).toBe(true);
    expect(result.after.phase).toBe("APPROACHING");
    expect(result.after.hostileHealth).toBe(1);
    expect(result.after.successfulStrikeHistory).toEqual(["player"]);
  });
});
