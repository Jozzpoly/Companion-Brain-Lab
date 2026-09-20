import { describe, expect, it } from "vitest";
import { decideStageBPartnerAction } from "./stage-b-partner";
import type { SharedPressureSnapshot } from "../world/shared-pressure";

function pressure(
  overrides: Partial<SharedPressureSnapshot> = {}
): SharedPressureSnapshot {
  return {
    enabled: true,
    phase: "QUIET",
    cycle: 0,
    target: null,
    responseRadius: 0.72,
    responseTicks: 0,
    requiredResponseTicks: 42,
    deadlineTick: null,
    ticksUntilDeadline: null,
    ticksUntilActivation: 90,
    lastResponder: "none",
    lastOutcome: "NONE",
    lastResolvedBy: "none",
    breaches: 0,
    reason: "fixture",
    ...overrides
  };
}

describe("Stage B partner action identity", () => {
  it("claims bounded responsibility for an active shared-world threat", () => {
    const decision = decideStageBPartnerAction(pressure({
      phase: "ACTIVE",
      target: { x: 9.4, y: 2 },
      deadlineTick: 510,
      ticksUntilDeadline: 300
    }));

    expect(decision.kind).toBe("RESPOND_TO_THREAT");
    expect(decision.objectiveKey).toBe("stage-b-pressure:0");
    expect(decision.target).toEqual({ x: 9.4, y: 2 });
  });

  it("returns to the relationship layer when pressure is absent", () => {
    const decision = decideStageBPartnerAction(pressure());
    expect(decision.kind).toBe("REGROUP");
    expect(decision.target).toBeNull();
    expect(decision.objectiveKey).toBeNull();
  });
});
