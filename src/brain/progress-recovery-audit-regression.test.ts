import { describe, expect, it } from "vitest";
import {
  ProgressRecoveryMonitor,
  R1_RECOVERY_COOLDOWN_TICKS,
  type ProgressRecoveryObservation,
  type ProgressRecoveryDecision
} from "./progress-recovery";

function observation(overrides: Partial<ProgressRecoveryObservation> = {}): ProgressRecoveryObservation {
  return {
    tick: 0,
    objectiveKey: "audit:stable-objective",
    position: { x: 8, y: 4 },
    target: { x: 3, y: 4 },
    routeStatus: "direct",
    routeRemainingDistance: 5,
    commandedSpeed: 1,
    actualSpeed: 0,
    contacts: [],
    intentionalHoldReason: null,
    ...overrides
  };
}

describe("R1-4 post-qualification claim-vs-code audit regressions", () => {
  it("re-arms bounded local recovery after sustained healthy progress on the same semantic objective", () => {
    const monitor = new ProgressRecoveryMonitor();

    let result = monitor.observe(observation({
      tick: 0,
      contacts: ["player"],
      actualSpeed: 0
    }));
    expect(result.state).toBe("BLOCKED_PLAYER");

    result = monitor.observe(observation({ tick: 1 }));
    expect(result.action).toBe("RETRY_LOCAL");
    expect(result.retryCount).toBe(1);

    const secondBlockTick = 1 + R1_RECOVERY_COOLDOWN_TICKS;
    result = monitor.observe(observation({
      tick: secondBlockTick,
      contacts: ["player"],
      actualSpeed: 0
    }));
    expect(result.state).toBe("BLOCKED_PLAYER");

    result = monitor.observe(observation({ tick: secondBlockTick + 1 }));
    expect(result.action).toBe("RETRY_LOCAL");
    expect(result.retryCount).toBe(2);

    result = monitor.observe(observation({
      tick: secondBlockTick + 12,
      position: { x: 7.4, y: 4 },
      routeRemainingDistance: 4.4,
      actualSpeed: 1
    }));
    expect(result.state).toBe("PROGRESSING");

    const thirdBlockTick = secondBlockTick + R1_RECOVERY_COOLDOWN_TICKS + 12;
    result = monitor.observe(observation({
      tick: thirdBlockTick,
      position: { x: 7.4, y: 4 },
      routeRemainingDistance: 4.4,
      contacts: ["player"],
      actualSpeed: 0
    }));
    expect(result.state).toBe("BLOCKED_PLAYER");

    result = monitor.observe(observation({
      tick: thirdBlockTick + 1,
      position: { x: 7.4, y: 4 },
      routeRemainingDistance: 4.4,
      contacts: [],
      actualSpeed: 0
    }));

    expect(result.action).toBe("RETRY_LOCAL");
    expect(result.retryCount).toBe(1);
  });

  it("recognizes bounded-error tracking when target and companion reverse repeatedly inside the rolling window", () => {
    const monitor = new ProgressRecoveryMonitor();
    let result: ProgressRecoveryDecision | null = null;
    const periodTicks = 30;

    for (let tick = 0; tick < 100; tick += 1) {
      const phase = (tick / periodTicks) * Math.PI * 2;
      const offset = Math.sin(phase) * 0.8;
      result = monitor.observe(observation({
        tick,
        position: { x: 4 + offset, y: 4 },
        target: { x: 6 + offset, y: 4 },
        routeRemainingDistance: 2,
        commandedSpeed: 1,
        actualSpeed: 1
      }));
    }

    if (!result) throw new Error("oscillating tracking fixture produced no decision");
    expect(result.state).toBe("TRACKING_MOVING_OBJECTIVE");
    expect(result.action).toBe("NONE");
    expect(result.retryCount).toBe(0);
  });

  it("lets invalid/unreachable route truth take precedence over euclidean arrival tolerance", () => {
    const invalidMonitor = new ProgressRecoveryMonitor();
    const invalid = invalidMonitor.observe(observation({
      tick: 0,
      position: { x: 4, y: 4 },
      target: { x: 4.1, y: 4 },
      routeStatus: "invalid-target",
      routeRemainingDistance: null,
      commandedSpeed: 0,
      actualSpeed: 0
    }));

    expect(invalid.state).toBe("ROUTE_INVALID");
    expect(invalid.action).toBe("RECONSIDER_OBJECTIVE");

    const unreachableMonitor = new ProgressRecoveryMonitor();
    const unreachable = unreachableMonitor.observe(observation({
      tick: 0,
      position: { x: 4, y: 4 },
      target: { x: 4.1, y: 4 },
      routeStatus: "unreachable",
      routeRemainingDistance: null,
      commandedSpeed: 0,
      actualSpeed: 0
    }));

    expect(unreachable.state).toBe("TRANSIENT_UNREACHABLE");
    expect(unreachable.action).toBe("NONE");
  });

  it("does not report ARRIVED when a close target still requires a materially long routed path", () => {
    const monitor = new ProgressRecoveryMonitor();
    const result = monitor.observe(observation({
      tick: 0,
      position: { x: 4, y: 4 },
      target: { x: 4.1, y: 4 },
      routeStatus: "routed",
      routeRemainingDistance: 3.5,
      commandedSpeed: 1,
      actualSpeed: 0
    }));

    expect(result.state).not.toBe("ARRIVED");
    expect(result.objectiveDistance).toBeLessThan(0.2);
    expect(result.progressMetric).toBeGreaterThan(3);
  });
});
