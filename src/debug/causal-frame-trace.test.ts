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
      refinedVelocity: { x: 1.8, y: 1.1 },
      routeClearanceConstrained: true,
      comfortStartViolated: true,
      comfortStartBlockers: ["door.wall.top"],
      rehabilitatedCandidateCount: 2,
      comfortExitCandidateCount: 1,
      shadowCoordination: {
        kind: "CCC0_SHADOW_COORDINATION",
        shadowTick: observationTick,
        ageTicks: 0,
        regionState: "REGION",
        regionAnchor: { x: 2.2, y: 3.1 },
        regionBestSampleId: "r1.d12",
        regionCoherentSampleCount: 7,
        regionRouteEvaluatedCount: 12,
        regionStaticTraversalQueryCount: 184,
        regionTopologyKeyChanged: false,
        regionCoherentOverlapRatio: 0.75,
        regionAnchorDisplacement: 0.08,
        paceLabel: "FOLLOWING",
        paceUrgency: 0.42,
        desiredSpeed: 2.1,
        playerCorridorState: "MOVING",
        playerCorridorConfidence: 0.86,
        playerCorridorEndpoint: { x: 4.7, y: 5 },
        preferredFlowConflictState: "CLEAR",
        preferredFlowClosestApproachTime: 0.18,
        preferredFlowPhysicalClearance: 0.28,
        preferredFlowComfortClearance: 0.10,
        preferredFlowCompanionClosest: { x: 2.5, y: 2.5 },
        preferredFlowPlayerClosest: { x: 3.3, y: 2.5 },
        authoritativeFlowConflictState: "COMFORT_CONFLICT",
        authoritativeFlowClosestApproachTime: 0.22,
        authoritativeFlowPhysicalClearance: 0.08,
        authoritativeFlowComfortClearance: -0.10,
        authoritativeFlowCompanionClosest: { x: 2.55, y: 2.5 },
        authoritativeFlowPlayerClosest: { x: 3.20, y: 2.5 },
        legacyTargetToShadowAnchorDistance: 1.12,
        error: null
      }
    },
    command: {
      actuator: "natural",
      commandedMove: { x: 0.5, y: 0.2 },
      commandedVelocity: { x: 1.5, y: 0.6 },
      finalConstraintSource: "preferred-fallback",
      finalConstrained: true,
      finalConstraintReason: "continuity command hard-blocked; using hard-safe preferred move"
    },
    outcome: {
      worldTick: outcomeTick,
      companionPosition: { x: 1.02, y: 2.01 },
      companionRequestedVelocity: { x: 1.5, y: 0.6 },
      companionActualVelocity: { x: 1.2, y: 0.5 },
      companionContacts: ["player"],
      displacement: 0.022,
      postRouteStatus: "routed",
      postRoutePath: "start>corner>target",
      postRouteClearanceConstrained: false
    },
    post: {
      state: "RECOVERING",
      reason: "player conflict cleared; refresh local movement state once before continuing",
      desiredClearanceProbe: "clear",
      hardProbe: "clear",
      action: "RETRY_LOCAL",
      noProgressTicks: 0,
      unreachableTicks: 0,
      retryCount: 1,
      appliedLocalRetries: 9
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
    expect(latest?.post.state).toBe("RECOVERING");
  });

  it("preserves the R1-4 hard/comfort, final-command and post-outcome recovery contract", () => {
    const trace = new CausalFrameTrace();
    trace.record(frame(trace.nextSequence(), 10, 11));

    const latest = trace.latest();
    expect(latest?.decision.routeClearanceConstrained).toBe(true);
    expect(latest?.decision.comfortStartViolated).toBe(true);
    expect(latest?.decision.comfortStartBlockers).toEqual(["door.wall.top"]);
    expect(latest?.decision.rehabilitatedCandidateCount).toBe(2);
    expect(latest?.decision.comfortExitCandidateCount).toBe(1);
    expect(latest?.command.finalConstraintSource).toBe("preferred-fallback");
    expect(latest?.command.finalConstrained).toBe(true);
    expect(latest?.outcome.postRouteClearanceConstrained).toBe(false);
    expect(latest?.post.action).toBe("RETRY_LOCAL");
    expect(latest?.post.retryCount).toBe(1);
    expect(latest?.post.appliedLocalRetries).toBe(9);
    expect(latest?.post.retryBudgetUsedThisEpisode).toBe(1);
    expect(latest?.post.cumulativeLocalRetriesSinceReset).toBe(9);
  });

  it("preserves preferred-vs-final CCC-0 conflict evidence with cognition, cost and continuity provenance", () => {
    const trace = new CausalFrameTrace();
    trace.record(frame(trace.nextSequence(), 12, 13));

    const latest = trace.latest();
    const shadow = latest?.decision.shadowCoordination;
    expect(shadow?.kind).toBe("CCC0_SHADOW_COORDINATION");
    expect(shadow?.shadowTick).toBe(12);
    expect(shadow?.ageTicks).toBe(0);
    expect(shadow?.regionState).toBe("REGION");
    expect(shadow?.regionRouteEvaluatedCount).toBe(12);
    expect(shadow?.regionStaticTraversalQueryCount).toBe(184);
    expect(shadow?.regionTopologyKeyChanged).toBe(false);
    expect(shadow?.regionCoherentOverlapRatio).toBe(0.75);
    expect(shadow?.regionAnchorDisplacement).toBe(0.08);
    expect(shadow?.paceUrgency).toBe(0.42);
    expect(shadow?.playerCorridorConfidence).toBe(0.86);
    expect(shadow?.preferredFlowConflictState).toBe("CLEAR");
    expect(shadow?.authoritativeFlowConflictState).toBe("COMFORT_CONFLICT");
    expect(latest?.command.commandedMove).toEqual({ x: 0.5, y: 0.2 });
  });

  it("adds self-describing recovery aliases to legacy incident-v2 frames", () => {
    const trace = new CausalFrameTrace();
    trace.record(frame(trace.nextSequence(), 20, 21));

    const publicFrame = trace.recent(1)[0];
    expect(publicFrame?.post.retryBudgetUsedThisEpisode).toBe(publicFrame?.post.retryCount);
    expect(publicFrame?.post.cumulativeLocalRetriesSinceReset).toBe(publicFrame?.post.appliedLocalRetries);
  });

  it("defensively clones nested public evidence", () => {
    const trace = new CausalFrameTrace();
    const sourceContacts = ["player"];
    const sourceComfortBlockers = ["door.wall.top"];
    const value = frame(trace.nextSequence(), 1, 2);
    value.outcome.companionContacts = sourceContacts;
    value.decision.comfortStartBlockers = sourceComfortBlockers;
    trace.record(value);

    value.observation.companionPosition.x = 999;
    value.decision.relationshipTarget!.x = 999;
    value.decision.shadowCoordination!.regionAnchor!.x = 999;
    value.decision.shadowCoordination!.playerCorridorEndpoint.x = 999;
    value.decision.shadowCoordination!.preferredFlowCompanionClosest!.x = 999;
    value.decision.shadowCoordination!.preferredFlowPlayerClosest!.x = 999;
    value.decision.shadowCoordination!.authoritativeFlowCompanionClosest!.x = 999;
    value.decision.shadowCoordination!.authoritativeFlowPlayerClosest!.x = 999;
    value.command.commandedMove.x = 999;
    sourceContacts.push("wall");
    sourceComfortBlockers.push("door.wall.bottom");

    const latest = trace.latest();
    expect(latest?.observation.companionPosition.x).toBe(1);
    expect(latest?.decision.relationshipTarget?.x).toBe(3);
    expect(latest?.decision.shadowCoordination?.regionAnchor?.x).toBe(2.2);
    expect(latest?.decision.shadowCoordination?.playerCorridorEndpoint.x).toBe(4.7);
    expect(latest?.decision.shadowCoordination?.preferredFlowCompanionClosest?.x).toBe(2.5);
    expect(latest?.decision.shadowCoordination?.preferredFlowPlayerClosest?.x).toBe(3.3);
    expect(latest?.decision.shadowCoordination?.authoritativeFlowCompanionClosest?.x).toBe(2.55);
    expect(latest?.decision.shadowCoordination?.authoritativeFlowPlayerClosest?.x).toBe(3.20);
    expect(latest?.command.commandedMove.x).toBe(0.5);
    expect(latest?.outcome.companionContacts).toEqual(["player"]);
    expect(latest?.decision.comfortStartBlockers).toEqual(["door.wall.top"]);
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