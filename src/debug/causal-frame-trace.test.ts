import { describe, expect, it } from "vitest";
import { CausalFrameTrace, type CausalFrame } from "./causal-frame-trace";

function frame(sequence: number, observationTick: number, outcomeTick: number): CausalFrame {
  return {
    sequence,
    observation: {
      worldTick: observationTick,
      companionPosition: { x: 1, y: 2 },
      playerPosition: { x: 4, y: 5 },
      companionActualVelocity: { x: 0.5, y: 0 },
      companionContacts: []
    },
    decision: {
      relationshipRevision: 3,
      relationshipLabel: "back-left",
      relationshipTarget: { x: 3, y: 4 },
      routeStatus: "routed",
      routePath: "start>corner>target",
      routeCost: 5,
      spatialState: "ADVANCE",
      spatialCandidate: "d3.s1.00",
      preferredVelocity: { x: 2, y: 1 },
      refinedVelocity: { x: 1.8, y: 1.1 }
    },
    command: {
      actuator: "natural",
      commandedMove: { x: 0.5, y: 0.2 },
      commandedVelocity: { x: 1.5, y: 0.6 }
    },
    outcome: {
      worldTick: outcomeTick,
      companionPosition: { x: 1.02, y: 2.01 },
      companionRequestedVelocity: { x: 1.5, y: 0.6 },
      companionActualVelocity: { x: 1.2, y: 0.5 },
      companionContacts: ["player"],
      displacement: 0.022,
      postRouteStatus: "routed",
      postRoutePath: "start>corner>target"
    },
    post: {
      state: "progressing",
      reason: "diagnostic",
      desiredClearanceProbe: "clear",
      hardProbe: "clear"
    }
  };
}

describe("R1 causal frame trace", () => {
  it("keeps observation and outcome phases explicitly distinct", () => {
    const trace = new CausalFrameTrace();
    const value = frame(trace.nextSequence(), 41, 42);
    trace.record(value);

    const latest = trace.latest();
    expect(latest?.sequence).toBe(0);
    expect(latest?.observation.worldTick).toBe(41);
    expect(latest?.outcome.worldTick).toBe(42);
    expect(latest?.decision.routeStatus).toBe("routed");
    expect(latest?.post.state).toBe("progressing");
  });

  it("defensively clones nested public evidence", () => {
    const trace = new CausalFrameTrace();
    const value = frame(trace.nextSequence(), 1, 2);
    trace.record(value);

    value.observation.companionPosition.x = 999;
    value.decision.relationshipTarget!.x = 999;
    value.command.commandedMove.x = 999;
    value.outcome.companionContacts.push("wall");

    const latest = trace.latest();
    expect(latest?.observation.companionPosition.x).toBe(1);
    expect(latest?.decision.relationshipTarget?.x).toBe(3);
    expect(latest?.command.commandedMove.x).toBe(0.5);
    expect(latest?.outcome.companionContacts).toEqual(["player"]);
  });

  it("bounds history while keeping sequence monotonic", () => {
    const trace = new CausalFrameTrace(2);
    for (let tick = 0; tick < 4; tick += 1) {
      const sequence = trace.nextSequence();
      trace.record(frame(sequence, tick, tick + 1));
    }

    expect(trace.size()).toBe(2);
    expect(trace.recent(10).map((entry) => entry.sequence)).toEqual([2, 3]);
    expect(trace.latest()?.outcome.worldTick).toBe(4);
  });

  it("reset clears history and restarts local frame sequence", () => {
    const trace = new CausalFrameTrace();
    trace.record(frame(trace.nextSequence(), 3, 4));
    trace.reset();

    expect(trace.size()).toBe(0);
    expect(trace.latest()).toBeNull();
    expect(trace.nextSequence()).toBe(0);
  });
});
