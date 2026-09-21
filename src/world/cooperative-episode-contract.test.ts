import { describe, expect, it } from "vitest";
import {
  initialCooperativeEpisodeSnapshot,
  resolveCooperativeEpisodeAfterPhysics,
  type CooperativeEpisodeActionAttempt,
  type CooperativeEpisodeRules,
  type CooperativeEpisodeSnapshot
} from "./cooperative-episode-contract";

const rules: CooperativeEpisodeRules = {
  repelRange: 1.1,
  pressureRange: 0.8,
  pressureBreakRange: 1.2,
  pressureTicks: 3,
  drivenBackTicks: 2,
  calmTicks: 2,
  home: { x: 10, y: 4 },
  homeArrivalRange: 0.1
};

function attempt(actorId: "player" | "companion" | "squad-2" | "squad-3" | "squad-4"): CooperativeEpisodeActionAttempt {
  return { actorId, kind: "REPEL", targetId: "hostile" };
}

function snapshot(
  phase: CooperativeEpisodeSnapshot["phase"],
  phaseTicksRemaining = 0
): CooperativeEpisodeSnapshot {
  return {
    ...initialCooperativeEpisodeSnapshot(rules),
    phase,
    phaseTicksRemaining
  };
}

function resolve(input: {
  before?: CooperativeEpisodeSnapshot;
  hostile?: { x: number; y: number };
  player?: { x: number; y: number };
  companion?: { x: number; y: number };
  squad2?: { x: number; y: number };
  squad3?: { x: number; y: number };
  squad4?: { x: number; y: number };
  attempts?: readonly CooperativeEpisodeActionAttempt[];
}) {
  return resolveCooperativeEpisodeAfterPhysics({
    observationTick: 10,
    before: input.before ?? snapshot("APPROACHING"),
    postPhysics: {
      hostilePosition: input.hostile ?? { x: 5, y: 4 },
      playerPosition: input.player ?? { x: 4, y: 4 },
      squadPositions: {
        companion: input.companion ?? { x: 6, y: 4 },
        "squad-2": input.squad2,
        "squad-3": input.squad3,
        "squad-4": input.squad4
      }
    },
    attempts: input.attempts ?? [],
    rules
  });
}

describe("S5 manual cooperative episode World contract", () => {
  it("starts calm, then opens a real approaching threat without an Owner timing oracle", () => {
    const initial = initialCooperativeEpisodeSnapshot(rules);
    expect(initial.phase).toBe("CALM");
    const waiting = resolve({ before: initial });
    expect(waiting.after.phase).toBe("CALM");
    expect(waiting.after.phaseTicksRemaining).toBe(1);
    const active = resolve({ before: waiting.after });
    expect(active.after.phase).toBe("APPROACHING");
  });

  it("allows REPEL during APPROACHING, not only a hidden commitment window", () => {
    const result = resolve({
      hostile: { x: 5, y: 4 },
      player: { x: 4.1, y: 4 },
      attempts: [attempt("player")]
    });
    expect(result.actionOutcomes[0]?.status).toBe("SUCCEEDED");
    expect(result.episodeOutcome).toBe("REPELLED");
    expect(result.after.phase).toBe("DRIVEN_BACK");
    expect(result.after.repelledBy).toEqual(["player"]);
    expect(result.after.drivenBackDirection?.x).toBeGreaterThan(0);
  });

  it("gives out-of-range attempts an explicit factual failure without changing the episode", () => {
    const result = resolve({
      player: { x: 2, y: 4 },
      attempts: [attempt("player")]
    });
    expect(result.actionOutcomes[0]?.status).toBe("OUT_OF_RANGE");
    expect(result.episodeOutcome).toBe("NONE");
    expect(result.after.phase).toBe("APPROACHING");
  });

  it("lets player movement break pressure before the consequence", () => {
    const result = resolve({
      before: snapshot("PRESSURING", 2),
      hostile: { x: 5, y: 4 },
      player: { x: 6.5, y: 4 }
    });
    expect(result.after.phase).toBe("APPROACHING");
    expect(result.episodeOutcome).toBe("NONE");
  });

  it("produces a consequence only after sustained pressure, then drives the hostile back", () => {
    const first = resolve({
      before: snapshot("PRESSURING", 2),
      hostile: { x: 5, y: 4 },
      player: { x: 4.5, y: 4 }
    });
    expect(first.after.phase).toBe("PRESSURING");
    expect(first.after.phaseTicksRemaining).toBe(1);

    const hit = resolve({
      before: first.after,
      hostile: { x: 5, y: 4 },
      player: { x: 4.5, y: 4 }
    });
    expect(hit.episodeOutcome).toBe("PLAYER_HIT");
    expect(hit.after.phase).toBe("DRIVEN_BACK");
    expect(hit.after.drivenBackDirection?.x).toBeGreaterThan(0);
  });

  it("supports simultaneous player and companion material contribution without actor-order bias", () => {
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
    expect(forward.after.repelledBy).toEqual(["companion", "player"]);
  });

  it("accepts simultaneous material contribution from multiple real squad members", () => {
    const result = resolve({
      companion: { x: 5.8, y: 4 },
      squad2: { x: 5.4, y: 4.5 },
      squad3: { x: 4.7, y: 4.4 },
      attempts: [attempt("companion"), attempt("squad-2"), attempt("squad-3")]
    });

    expect(result.episodeOutcome).toBe("REPELLED");
    expect(result.after.repelledBy).toEqual(["companion", "squad-2", "squad-3"]);
    expect(result.actionOutcomes.every((outcome) => outcome.status === "SUCCEEDED")).toBe(true);
  });

  it("rejects an action from a squad participant whose embodied position is absent", () => {
    expect(() =>
      resolve({
        attempts: [attempt("squad-4")]
      })
    ).toThrow(/missing post-physics position for squad-4/);
  });

  it("returns through driven-back and reset into a new calm cycle instead of COMPLETE", () => {
    const driven = resolve({
      before: {
        ...snapshot("DRIVEN_BACK", 1),
        lastOutcome: "REPELLED",
        lastOutcomeTick: 8,
        repelledBy: ["companion"],
        drivenBackDirection: { x: 1, y: 0 }
      }
    });
    expect(driven.after.phase).toBe("RESETTING");

    const home = resolve({
      before: driven.after,
      hostile: { x: 10.05, y: 4 }
    });
    expect(home.after.phase).toBe("CALM");
    expect(home.after.cycle).toBe(1);
    expect(home.after.phaseTicksRemaining).toBe(rules.calmTicks);
  });
});
