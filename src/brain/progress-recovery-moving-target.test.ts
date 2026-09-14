import { describe, expect, it } from "vitest";
import {
  ProgressRecoveryMonitor,
  R1_NO_PROGRESS_TRIGGER_TICKS,
  type ProgressRecoveryDecision
} from "./progress-recovery";

function runMovingTarget(options: {
  companionStep: number;
  targetStep: number;
  ticks: number;
}): ProgressRecoveryDecision {
  const monitor = new ProgressRecoveryMonitor();
  let result: ProgressRecoveryDecision | null = null;

  for (let tick = 0; tick < options.ticks; tick += 1) {
    const companionX = 3 + tick * options.companionStep;
    const targetX = 6 + tick * options.targetStep;
    const distance = Math.abs(targetX - companionX);
    result = monitor.observe({
      tick,
      objectiveKey: "follow-moving-slot:rev-1",
      position: { x: companionX, y: 4 },
      target: { x: targetX, y: 4 },
      routeStatus: "direct",
      routeRemainingDistance: distance,
      commandedSpeed: 1,
      actualSpeed: 1,
      contacts: []
    });
  }

  if (!result) throw new Error("moving-target fixture produced no decision");
  return result;
}

describe("R1-4 moving objective semantics", () => {
  it("does not spend recovery budget when companion is moving with a target while maintaining bounded distance", () => {
    const result = runMovingTarget({
      companionStep: 0.03,
      targetStep: 0.03,
      ticks: R1_NO_PROGRESS_TRIGGER_TICKS + 50
    });

    expect(result.action).toBe("NONE");
    expect(result.retryCount).toBe(0);
    expect(result.state).toBe("TRACKING_MOVING_OBJECTIVE");
  });

  it("still detects no progress when a moving target is escaping materially faster than the companion", () => {
    const result = runMovingTarget({
      companionStep: 0.005,
      targetStep: 0.03,
      ticks: R1_NO_PROGRESS_TRIGGER_TICKS + 5
    });

    expect(result.retryCount).toBeGreaterThan(0);
    expect(["RECOVERING", "NO_PROGRESS"]).toContain(result.state);
  });
});
