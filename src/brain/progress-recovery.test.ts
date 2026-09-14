import { describe, expect, it } from "vitest";
import {
  ProgressRecoveryMonitor,
  R1_MAX_LOCAL_RETRIES_PER_EPISODE,
  R1_NO_PROGRESS_TRIGGER_TICKS,
  R1_RECOVERY_COOLDOWN_TICKS,
  R1_UNREACHABLE_PERSIST_TICKS,
  type ProgressRecoveryObservation
} from "./progress-recovery";

function observation(overrides: Partial<ProgressRecoveryObservation> = {}): ProgressRecoveryObservation {
  return {
    tick: 0,
    objectiveKey: "follow-slot:rev-1",
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

describe("R1-4 temporal progress/recovery contract", () => {
  it("reports objective progress from decreasing route/objective metric, not merely elapsed time", () => {
    const monitor = new ProgressRecoveryMonitor();
    monitor.observe(observation({ tick: 0, routeRemainingDistance: 5 }));
    const result = monitor.observe(observation({
      tick: 10,
      position: { x: 7.7, y: 4 },
      routeRemainingDistance: 4.7,
      actualSpeed: 1
    }));

    expect(result.state).toBe("PROGRESSING");
    expect(result.action).toBe("NONE");
    expect(result.progressDelta).toBeGreaterThan(0.06);
  });

  it("does not call lateral/non-goal motion progress when the objective metric is not improving", () => {
    const monitor = new ProgressRecoveryMonitor();
    let result = monitor.observe(observation({ tick: 0, actualSpeed: 1, routeRemainingDistance: 5 }));

    for (let tick = 1; tick < R1_NO_PROGRESS_TRIGGER_TICKS; tick += 1) {
      result = monitor.observe(observation({
        tick,
        position: { x: 8, y: 4 + tick * 0.01 },
        routeRemainingDistance: 5,
        actualSpeed: 1
      }));
    }

    expect(result.state).toBe("RECOVERING");
    expect(result.action).toBe("RETRY_LOCAL");
    expect(result.progressDelta).toBe(0);
  });

  it("keeps an explicit intentional HOLD legitimate without consuming recovery budget", () => {
    const monitor = new ProgressRecoveryMonitor();
    let result = monitor.observe(observation({
      tick: 0,
      commandedSpeed: 0,
      actualSpeed: 0,
      intentionalHoldReason: "player currently owns the doorway"
    }));

    for (let tick = 1; tick < 120; tick += 1) {
      result = monitor.observe(observation({
        tick,
        commandedSpeed: 0,
        actualSpeed: 0,
        intentionalHoldReason: "player currently owns the doorway"
      }));
    }

    expect(result.state).toBe("INTENTIONAL_HOLD");
    expect(result.action).toBe("NONE");
    expect(result.retryCount).toBe(0);
  });

  it("waits during player blocking and emits one bounded retry when the conflict clears", () => {
    const monitor = new ProgressRecoveryMonitor();
    let blocked = monitor.observe(observation({
      tick: 20,
      contacts: ["player"],
      commandedSpeed: 1,
      actualSpeed: 0
    }));

    expect(blocked.state).toBe("BLOCKED_PLAYER");
    expect(blocked.action).toBe("WAIT_CONFLICT");
    expect(blocked.retryCount).toBe(0);

    blocked = monitor.observe(observation({ tick: 21, contacts: [], commandedSpeed: 1, actualSpeed: 0 }));
    expect(blocked.state).toBe("RECOVERING");
    expect(blocked.action).toBe("RETRY_LOCAL");
    expect(blocked.retryCount).toBe(1);

    const next = monitor.observe(observation({ tick: 22, contacts: [], commandedSpeed: 1, actualSpeed: 0 }));
    expect(next.action).toBe("NONE");
    expect(next.retryCount).toBe(1);
  });

  it("treats short unreachable episodes as transient and retries once when reachability returns", () => {
    const monitor = new ProgressRecoveryMonitor();
    let result = monitor.observe(observation({ tick: 0, routeStatus: "unreachable", routeRemainingDistance: null }));
    expect(result.state).toBe("TRANSIENT_UNREACHABLE");
    expect(result.action).toBe("NONE");

    for (let tick = 1; tick < 12; tick += 1) {
      result = monitor.observe(observation({ tick, routeStatus: "unreachable", routeRemainingDistance: null }));
    }
    expect(result.state).toBe("TRANSIENT_UNREACHABLE");

    result = monitor.observe(observation({ tick: 12, routeStatus: "direct", routeRemainingDistance: 5 }));
    expect(result.state).toBe("RECOVERING");
    expect(result.action).toBe("RETRY_LOCAL");
    expect(result.retryCount).toBe(1);
  });

  it("separates an invalid target from hard unreachable and asks upstream to reconsider it once", () => {
    const monitor = new ProgressRecoveryMonitor();
    let result = monitor.observe(observation({
      tick: 0,
      routeStatus: "invalid-target",
      routeRemainingDistance: null
    }));

    expect(result.state).toBe("ROUTE_INVALID");
    expect(result.action).toBe("RECONSIDER_OBJECTIVE");
    expect(result.unreachableTicks).toBe(0);
    expect(result.retryCount).toBe(0);

    result = monitor.observe(observation({
      tick: 1,
      routeStatus: "invalid-target",
      routeRemainingDistance: null
    }));
    expect(result.state).toBe("ROUTE_INVALID");
    expect(result.action).toBe("NONE");
    expect(result.unreachableTicks).toBe(0);
  });

  it("reports persistent hard unreachable once without retry thrash", () => {
    const monitor = new ProgressRecoveryMonitor();
    let result = monitor.observe(observation({ tick: 0, routeStatus: "unreachable", routeRemainingDistance: null }));

    for (let tick = 1; tick < R1_UNREACHABLE_PERSIST_TICKS; tick += 1) {
      result = monitor.observe(observation({ tick, routeStatus: "unreachable", routeRemainingDistance: null }));
    }

    expect(result.state).toBe("PERSISTENT_UNREACHABLE");
    expect(result.action).toBe("REPORT_UNREACHABLE");
    expect(result.retryCount).toBe(0);

    result = monitor.observe(observation({
      tick: R1_UNREACHABLE_PERSIST_TICKS,
      routeStatus: "unreachable",
      routeRemainingDistance: null
    }));
    expect(result.state).toBe("PERSISTENT_UNREACHABLE");
    expect(result.action).toBe("NONE");
  });

  it("bounds repeated local retries by both cooldown and episode budget", () => {
    const monitor = new ProgressRecoveryMonitor();
    let result = monitor.observe(observation({ tick: 0, commandedSpeed: 1, actualSpeed: 0 }));

    for (let tick = 1; tick < R1_NO_PROGRESS_TRIGGER_TICKS; tick += 1) {
      result = monitor.observe(observation({ tick, commandedSpeed: 1, actualSpeed: 0 }));
    }
    const firstRetryTick = R1_NO_PROGRESS_TRIGGER_TICKS - 1;
    expect(result.action).toBe("RETRY_LOCAL");
    expect(result.retryCount).toBe(1);

    const secondRetryTick = firstRetryTick + R1_RECOVERY_COOLDOWN_TICKS;
    for (let tick = firstRetryTick + 1; tick < secondRetryTick; tick += 1) {
      result = monitor.observe(observation({ tick, commandedSpeed: 1, actualSpeed: 0 }));
    }
    expect(result.retryCount).toBe(1);
    expect(result.action).toBe("NONE");

    result = monitor.observe(observation({ tick: secondRetryTick, commandedSpeed: 1, actualSpeed: 0 }));
    expect(result.action).toBe("RETRY_LOCAL");
    expect(result.retryCount).toBe(2);

    for (let tick = secondRetryTick + 1; tick < secondRetryTick + R1_RECOVERY_COOLDOWN_TICKS + R1_NO_PROGRESS_TRIGGER_TICKS + 4; tick += 1) {
      result = monitor.observe(observation({ tick, commandedSpeed: 1, actualSpeed: 0 }));
    }
    expect(result.retryCount).toBe(R1_MAX_LOCAL_RETRIES_PER_EPISODE);
    expect(result.action).toBe("NONE");
    expect(result.state).toBe("NO_PROGRESS");
  });

  it("resets temporal debt when the semantic objective revision changes", () => {
    const monitor = new ProgressRecoveryMonitor();
    let result = monitor.observe(observation({ tick: 0, routeStatus: "unreachable", routeRemainingDistance: null }));
    for (let tick = 1; tick < 40; tick += 1) {
      result = monitor.observe(observation({ tick, routeStatus: "unreachable", routeRemainingDistance: null }));
    }
    expect(result.unreachableTicks).toBe(40);

    result = monitor.observe(observation({
      tick: 40,
      objectiveKey: "follow-slot:rev-2",
      target: { x: 9, y: 4 },
      routeStatus: "direct",
      routeRemainingDistance: 1,
      commandedSpeed: 0,
      actualSpeed: 0
    }));

    expect(result.unreachableTicks).toBe(0);
    expect(result.retryCount).toBe(0);
    expect(result.action).toBe("NONE");
  });

  it("allows the target coordinates to move without resetting the episode when objectiveKey is stable", () => {
    const monitor = new ProgressRecoveryMonitor();
    monitor.observe(observation({ tick: 0, target: { x: 3, y: 4 }, routeRemainingDistance: 5 }));
    const result = monitor.observe(observation({
      tick: 10,
      target: { x: 2.8, y: 4.2 },
      routeRemainingDistance: 4.7,
      position: { x: 7.7, y: 4.1 },
      actualSpeed: 1
    }));

    expect(result.progressDelta).toBeGreaterThan(0);
    expect(result.state).toBe("PROGRESSING");
    expect(result.objectiveKey).toBe("follow-slot:rev-1");
  });
});
