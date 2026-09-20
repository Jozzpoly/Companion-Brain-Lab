import { describe, expect, it } from "vitest";
import { decideStageBPartnerAction } from "./stage-b-partner";
import type { SharedPressureSnapshot } from "../world/shared-pressure";

function pressure(
  overrides: Partial<SharedPressureSnapshot> = {}
): SharedPressureSnapshot {
  return {
    enabled: true,
    kind: "ADVANCING_THREAT_PROXY",
    phase: "QUIET",
    cycle: 0,
    target: null,
    threatRadius: 0.24,
    threatSpeed: 1.1,
    breachDistance: 0.56,
    threatDistanceToPlayer: null,
    responseRadius: 0.68,
    responseTicks: 0,
    requiredResponseTicks: 36,
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
  it("claims bounded responsibility for an active advancing shared-world threat", () => {
    const decision = decideStageBPartnerAction(pressure({
      phase: "ACTIVE",
      target: { x: 10.4, y: 2.1 },
      threatDistanceToPlayer: 7.6,
      deadlineTick: 690,
      ticksUntilDeadline: 500
    }));

    expect(decision.kind).toBe("RESPOND_TO_THREAT");
    expect(decision.objectiveKey).toBe("stage-b-pressure:0");
    expect(decision.target).toEqual({ x: 10.4, y: 2.1 });
  });

  it("returns to the relationship layer when pressure is absent", () => {
    const decision = decideStageBPartnerAction(pressure());
    expect(decision.kind).toBe("REGROUP");
    expect(decision.target).toBeNull();
    expect(decision.objectiveKey).toBeNull();
  });
});
