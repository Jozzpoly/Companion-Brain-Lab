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
  hostileHealth: 3,
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

    expect(result.after.hostileHealth).toBe(3);
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
    expect(result.after.hostileHealth).toBe(2);
    expect(result.after.successfulStrikeHistory).toEqual(["companion"]);
  });

  it("makes a single intervention transfer the next hostile pressure to its author", () => {
    const companionStrike = resolve({
      companion: { x: 5.8, y: 4 },
      attempts: [attempt("companion")]
    });
    expect(companionStrike.after.targetActorId).toBe("companion");

    const reopened = recover(companionStrike.after);
    const pressure = resolve({
      before: reopened,
      hostile: { x: 5, y: 4 },
      player: { x: 2.5, y: 4 },
      companion: { x: 5.6, y: 4 },
      attempts: [],
      tick: 30
    });

    expect(pressure.after.phase).toBe("PRESSURING");
    expect(pressure.after.targetActorId).toBe("companion");
  });

  it("lets later explicit action take responsibility back from the other actor", () => {
    const companionStrike = resolve({
      companion: { x: 5.8, y: 4 },
      attempts: [attempt("companion")]
    });
    const afterCompanionRecovery = recover(companionStrike.after);

    const playerStrike = resolve({
      before: afterCompanionRecovery,
      player: { x: 4.2, y: 4 },
      companion: { x: 7, y: 4 },
      attempts: [attempt("player")],
      tick: 30
    });

    expect(playerStrike.episodeOutcome).toBe("HOSTILE_STRUCK");
    expect(playerStrike.after.hostileHealth).toBe(1);
    expect(playerStrike.after.targetActorId).toBe("player");
    expect(playerStrike.after.successfulStrikeHistory).toEqual(["companion", "player"]);
  });

  it("keeps simultaneous contribution order-independent without inventing a winner", () => {
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
    expect(forward.episodeOutcome).toBe("HOSTILE_STRUCK");
    expect(forward.after.hostileHealth).toBe(1);
    expect(forward.after.targetActorId).toBe("player");
    expect(forward.after.successfulStrikeHistory).toEqual(["companion", "player"]);
  });

  it("keeps out-of-range action failure factual without transferring pressure", () => {
    const result = resolve({
      companion: { x: 8, y: 4 },
      attempts: [attempt("companion")]
    });

    expect(result.actionOutcomes[0]?.status).toBe("OUT_OF_RANGE");
    expect(result.after.hostileHealth).toBe(3);
    expect(result.after.targetActorId).toBe("player");
    expect(result.episodeOutcome).toBe("NONE");
  });

  it("lets sustained unopposed pressure hit the current target rather than always the player", () => {
    const pressingCompanion: CombatMicroSnapshot = {
      ...initialCombatMicroSnapshot(rules),
      phase: "PRESSURING",
      phaseTicksRemaining: 1,
      targetActorId: "companion"
    };

    const hit = resolve({
      before: pressingCompanion,
      hostile: { x: 5, y: 4 },
      player: { x: 2.5, y: 4 },
      companion: { x: 5.5, y: 4 },
      attempts: []
    });

    expect(hit.episodeOutcome).toBe("ACTOR_HIT");
    expect(hit.after.lastHitActorId).toBe("companion");
    expect(hit.after.actorHitCounts).toEqual({ player: 0, companion: 1 });
    expect(hit.after.phase).toBe("RECOVERING");
  });

  it("lets movement by the current target break pressure before the consequence", () => {
    const pressingCompanion: CombatMicroSnapshot = {
      ...initialCombatMicroSnapshot(rules),
      phase: "PRESSURING",
      phaseTicksRemaining: 1,
      targetActorId: "companion"
    };

    const result = resolve({
      before: pressingCompanion,
      hostile: { x: 5, y: 4 },
      player: { x: 4.5, y: 4 },
      companion: { x: 7, y: 4 },
      attempts: []
    });

    expect(result.episodeOutcome).toBe("NONE");
    expect(result.after.phase).toBe("APPROACHING");
    expect(result.after.actorHitCounts).toEqual({ player: 0, companion: 0 });
  });

  it("supports a player-only multi-beat solution", () => {
    let state = initialCombatMicroSnapshot(rules);
    for (let strike = 0; strike < 3; strike += 1) {
      const result = resolve({
        before: state,
        player: { x: 4.2, y: 4 },
        companion: { x: 8, y: 4 },
        attempts: [attempt("player")],
        tick: 30 + strike * 10
      });
      state = result.after;
      if (strike < 2) state = recover(state);
    }

    expect(state.phase).toBe("DEFEATED");
    expect(state.successfulStrikeHistory).toEqual(["player", "player", "player"]);
  });

  it("supports a companion-only multi-beat solution that carries its own pressure", () => {
    let state = initialCombatMicroSnapshot(rules);
    for (let strike = 0; strike < 3; strike += 1) {
      const result = resolve({
        before: state,
        player: { x: 2.5, y: 4 },
        companion: { x: 5.8, y: 4 },
        attempts: [attempt("companion")],
        tick: 30 + strike * 10
      });
      state = result.after;
      if (strike < 2) {
        expect(state.targetActorId).toBe("companion");
        state = recover(state);
      }
    }

    expect(state.phase).toBe("DEFEATED");
    expect(state.successfulStrikeHistory).toEqual(["companion", "companion", "companion"]);
  });

  it("supports split responsibility across a persistent encounter", () => {
    const playerFirst = resolve({
      player: { x: 4.2, y: 4 },
      companion: { x: 8, y: 4 },
      attempts: [attempt("player")]
    });
    const reopenedForCompanion = recover(playerFirst.after);
    const companionSecond = resolve({
      before: reopenedForCompanion,
      player: { x: 2.5, y: 4 },
      companion: { x: 5.8, y: 4 },
      attempts: [attempt("companion")],
      tick: 30
    });
    const reopenedForPlayer = recover(companionSecond.after);
    const playerFinish = resolve({
      before: reopenedForPlayer,
      player: { x: 4.2, y: 4 },
      companion: { x: 8, y: 4 },
      attempts: [attempt("player")],
      tick: 40
    });

    expect(playerFinish.episodeOutcome).toBe("HOSTILE_DEFEATED");
    expect(playerFinish.after.successfulStrikeHistory).toEqual([
      "player",
      "companion",
      "player"
    ]);
  });

  it("lets the current target disengage while the other actor explicitly takes over", () => {
    const before: CombatMicroSnapshot = {
      ...initialCombatMicroSnapshot(rules),
      phase: "PRESSURING",
      phaseTicksRemaining: 1,
      hostileHealth: 2,
      targetActorId: "player",
      successfulStrikeHistory: ["player"]
    };

    const result = resolve({
      before,
      hostile: { x: 5, y: 4 },
      player: { x: 7, y: 4 },
      companion: { x: 5.8, y: 4 },
      attempts: [attempt("companion")]
    });

    expect(result.episodeOutcome).toBe("HOSTILE_STRUCK");
    expect(result.after.actorHitCounts.player).toBe(0);
    expect(result.after.hostileHealth).toBe(1);
    expect(result.after.targetActorId).toBe("companion");
    expect(result.after.successfulStrikeHistory).toEqual(["player", "companion"]);
  });

  it("allows action during PRESSURING rather than requiring a hidden commitment frame", () => {
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
    expect(result.after.actorHitCounts.player).toBe(0);
  });

  it("makes recovery an explicit no-strike beat instead of allowing action spam", () => {
    const recovering: CombatMicroSnapshot = {
      ...initialCombatMicroSnapshot(rules),
      phase: "RECOVERING",
      phaseTicksRemaining: 1,
      hostileHealth: 2,
      targetActorId: "player",
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
    expect(result.after.hostileHealth).toBe(2);
    expect(result.after.successfulStrikeHistory).toEqual(["player"]);
  });
});
