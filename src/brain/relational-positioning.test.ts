import { describe, expect, it } from "vitest";
import type { ActorSnapshot, ObstacleSpec, WorldSnapshot } from "../world/types";
import {
  RelationalPositioningBrain,
  chaseIntent,
  evaluateRelationalCandidates,
  intentToward,
  selectRelationalCandidate,
  type RelationalCandidate
} from "./relational-positioning";

function actor(
  id: ActorSnapshot["id"],
  x: number,
  y: number,
  requestedVelocity = { x: 0, y: 0 },
  actualVelocity = { x: 0, y: 0 }
): ActorSnapshot {
  return {
    id,
    position: { x, y },
    radius: 0.3,
    requestedVelocity,
    actualVelocity,
    motionError: 0,
    contacts: []
  };
}

function snapshot(options?: {
  tick?: number;
  player?: ActorSnapshot;
  companion?: ActorSnapshot;
  obstacles?: readonly ObstacleSpec[];
}): WorldSnapshot {
  return {
    tick: options?.tick ?? 0,
    scenarioId: "open",
    width: 12,
    height: 8,
    actors: [
      options?.companion ?? actor("companion", 7, 4),
      options?.player ?? actor("player", 4, 4)
    ],
    obstacles: options?.obstacles ?? []
  };
}

function candidate(slot: string, score: number): RelationalCandidate {
  return {
    slot,
    position: { x: 0, y: 0 },
    valid: true,
    score,
    terms: {
      frontPenalty: 0,
      travelCost: score,
      switchCost: 0,
      invalidPenalty: 0
    }
  };
}

describe("S1 relational positioning probe", () => {
  it("scores front positions worse than back positions while the player moves", () => {
    const state = snapshot({
      player: actor("player", 4, 4, { x: 3, y: 0 }, { x: 3, y: 0 })
    });
    const candidates = evaluateRelationalCandidates(state, { x: 1, y: 0 }, null);
    const front = candidates.find((entry) => entry.slot === "front");
    const back = candidates.find((entry) => entry.slot === "back");
    expect(front).toBeDefined();
    expect(back).toBeDefined();
    expect(front?.score).toBeGreaterThan(back?.score ?? Number.POSITIVE_INFINITY);
  });

  it("is deterministic for identical snapshot and brain state", () => {
    const state = snapshot();
    const first = evaluateRelationalCandidates(state, { x: 1, y: 0 }, "left");
    const second = evaluateRelationalCandidates(state, { x: 1, y: 0 }, "left");
    expect(second).toEqual(first);
    expect(selectRelationalCandidate(second, "left")).toEqual(selectRelationalCandidate(first, "left"));
  });

  it("retains the current slot when an alternative is only marginally better", () => {
    const selection = selectRelationalCandidate(
      [candidate("left", 1.10), candidate("right", 0.90)],
      "left"
    );
    expect(selection.candidate.slot).toBe("left");
    expect(selection.reason).toContain("retain");
  });

  it("breaks hysteresis when another slot is materially better", () => {
    const selection = selectRelationalCandidate(
      [candidate("left", 1.10), candidate("right", 0.60)],
      "left"
    );
    expect(selection.candidate.slot).toBe("right");
    expect(selection.reason).toContain("switch");
  });

  it("marks a candidate inside static geometry invalid", () => {
    const state = snapshot({
      obstacles: [{ id: "block", x: 5.15, y: 3.6, width: 0.6, height: 0.8 }]
    });
    const candidates = evaluateRelationalCandidates(state, { x: 1, y: 0 }, null);
    const front = candidates.find((entry) => entry.slot === "front");
    expect(front).toBeDefined();
    expect(front?.valid).toBe(false);
    expect(front?.terms.invalidPenalty).toBeGreaterThan(1000);
  });

  it("produces bounded normalized movement toward a relationship target", () => {
    const move = intentToward(snapshot(), { x: 1, y: 1 }).move;
    expect(Math.hypot(move.x, move.y)).toBeLessThanOrEqual(1);
    expect(Math.hypot(move.x, move.y)).toBeGreaterThan(0);
  });

  it("naive chase emits an intent without mutating the snapshot", () => {
    const state = snapshot();
    const before = JSON.stringify(state);
    const intent = chaseIntent(state);
    expect(intent.actorId).toBe("companion");
    expect(Math.hypot(intent.move.x, intent.move.y)).toBeLessThanOrEqual(1);
    expect(JSON.stringify(state)).toBe(before);
  });

  it("reconsiders at 10 Hz while preserving the decision between tactical ticks", () => {
    const brain = new RelationalPositioningBrain();
    const initial = brain.decision(snapshot({ tick: 0 }));
    const held = brain.decision(snapshot({ tick: 5 }));
    const reconsidered = brain.decision(snapshot({ tick: 6 }));

    expect(initial.reconsiderationCount).toBe(1);
    expect(held.reconsiderationCount).toBe(1);
    expect(held.reconsideredAtTick).toBe(0);
    expect(reconsidered.reconsiderationCount).toBe(2);
    expect(reconsidered.reconsideredAtTick).toBe(6);
  });
});
