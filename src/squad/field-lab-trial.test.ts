import { describe, expect, it } from "vitest";
import type { FieldLabTrialFrame } from "./field-lab-trial";
import {
  compareFieldLabTrials,
  createFieldLabTrialRecord,
  summarizeFieldLabTrial
} from "./field-lab-trial";

function frame(
  tick: number,
  x: number,
  targetError: number,
  status: "MOVING" | "BLOCKED" | "ARRIVED",
  contactCount = 0
): FieldLabTrialFrame {
  return {
    tick,
    playerPosition: { x: 0, y: 0 },
    cooperativeOutcome: "NONE",
    members: [{
      memberId: "companion",
      position: { x, y: 0 },
      target: { x: 5, y: 0 },
      targetError,
      authority: "FORMATION",
      orderMode: "MOVE",
      requestedVelocity: { x: 2, y: 0 },
      actualVelocity: { x: status === "BLOCKED" ? 0 : 1, y: 0 },
      motionError: status === "BLOCKED" ? 1 : 0.1,
      contactCount,
      status
    }]
  };
}

describe("Field Lab trial traces", () => {
  it("summarizes trajectory, target error and blocked/contact intervals", () => {
    const trial = createFieldLabTrialRecord({
      slot: "A",
      label: "doorway slow",
      startedAtTick: 10,
      frames: [
        frame(11, 0, 5, "MOVING"),
        frame(12, 1, 4, "BLOCKED", 1),
        frame(13, 1, 4, "BLOCKED", 2),
        frame(14, 2, 3, "MOVING")
      ]
    });

    const summary = summarizeFieldLabTrial(trial);
    const companion = summary.members[0]!;

    expect(summary.frameCount).toBe(4);
    expect(summary.endedAtTick).toBe(14);
    expect(companion.pathDistance).toBeCloseTo(2);
    expect(companion.meanTargetError).toBeCloseTo(4);
    expect(companion.maxTargetError).toBeCloseTo(5);
    expect(companion.blockedTicks).toBe(2);
    expect(companion.longestBlockedRun).toBe(2);
    expect(companion.contactTicks).toBe(2);
  });

  it("compares B against A without assigning a winner", () => {
    const a = createFieldLabTrialRecord({
      slot: "A",
      label: "A",
      startedAtTick: 0,
      frames: [
        frame(1, 0, 5, "MOVING"),
        frame(2, 1, 4, "BLOCKED"),
        frame(3, 1, 4, "BLOCKED")
      ]
    });
    const b = createFieldLabTrialRecord({
      slot: "B",
      label: "B",
      startedAtTick: 0,
      frames: [
        frame(1, 0, 5, "MOVING"),
        frame(2, 2, 3, "MOVING"),
        frame(3, 4, 1, "ARRIVED")
      ]
    });

    const comparison = compareFieldLabTrials(a, b);
    const companion = comparison.members[0]!;

    expect(companion.pathDistanceDelta).toBeCloseTo(3);
    expect(companion.meanTargetErrorDelta).toBeCloseTo(-4 / 3);
    expect(companion.blockedTicksDelta).toBe(-2);
    expect(companion.longestBlockedRunDelta).toBe(-2);
  });

  it("rejects empty traces rather than manufacturing evidence", () => {
    expect(() => createFieldLabTrialRecord({
      slot: "A",
      label: "empty",
      startedAtTick: 0,
      frames: []
    })).toThrow(/at least one recorded frame/);
  });
});
