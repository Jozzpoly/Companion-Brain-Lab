import { describe, expect, it } from "vitest";
import type { AuthorityA12p2BrowserSnapshot } from "./authority-a1-2p2-manual-browser-bridge";
import type { CausalFrame } from "./causal-frame-trace";
import { buildOwnerSandboxIncident } from "./owner-sandbox-incident";

function frame(): CausalFrame {
  return {
    sequence: 0,
    observation: {
      worldTick: 0,
      companionPosition: { x: 7.5, y: 4 },
      playerPosition: { x: 4.5, y: 4 },
      playerControlMove: { x: 1, y: 0 },
      companionActualVelocity: { x: 0, y: 0 },
      companionContacts: []
    },
    decision: {
      relationshipRevision: 1,
      relationshipLabel: "front",
      relationshipTarget: { x: 6, y: 4 },
      routeStatus: "routed",
      routePath: "start>target",
      routeCost: 1.5,
      spatialState: "ADVANCE",
      spatialCandidate: "d0.s1.00",
      preferredVelocity: { x: -1, y: 0 },
      refinedVelocity: null
    },
    command: {
      actuator: "direct",
      commandedMove: { x: 0, y: -1 },
      commandedVelocity: { x: 0, y: -3 }
    },
    outcome: {
      worldTick: 1,
      companionPosition: { x: 7.5, y: 3.95 },
      companionRequestedVelocity: { x: 0, y: -3 },
      companionActualVelocity: { x: 0, y: -3 },
      companionContacts: [],
      displacement: 0.05,
      postRouteStatus: "routed",
      postRoutePath: "start>target"
    },
    post: {
      state: "PROGRESSING",
      reason: "bounded movement progressed",
      desiredClearanceProbe: "clear",
      hardProbe: "clear"
    }
  };
}

function p2Snapshot(): AuthorityA12p2BrowserSnapshot {
  return {
    schema: "companion-brain-lab-authority-a1-2p2-manual-direct-v1",
    stage: "Authority-A1.2p2",
    authority: "EXPLICIT_MANUAL_ONE_STEP_DIRECT_ONLY_P2",
    previewCount: 1,
    armCount: 1,
    applicationCount: 1,
    latestPreview: null,
    armed: null,
    latestApplication: {
      previewRequestId: 1,
      sourceTick: 0,
      outcomeTick: 1,
      proposalId: "h1:tangent:left",
      baselineCompanionIntent: { actorId: "companion", move: { x: -1, y: 0 } },
      selectedCompanionIntent: { actorId: "companion", move: { x: 0, y: -1 } },
      command: {
        kind: "A1_EXPLICIT_MANUAL_DIRECT_COMMAND",
        sourceTick: 0,
        validForOutcomeTick: 1,
        horizonSeconds: 1,
        proposalId: "h1:tangent:left",
        frontierProposalIds: ["h1:tangent:left"],
        commandVelocity: { x: 0, y: -3 },
        motionIntent: { actorId: "companion", move: { x: 0, y: -1 } },
        commandRepresentationError: 0,
        selectionSource: "EXPLICIT_CALLER_PROPOSAL_ID_P2",
        automaticSelectionClaim: "NONE_P2",
        horizonPolicyClaim: "EXPLICIT_CALLER_SUPPLIED_HORIZON_P2",
        authorityScopeClaim: "SOURCE_TICK_TO_NEXT_WORLD_STEP_ONLY_P2",
        runtimeAuthorityClaim: "EXPLICIT_CALLER_ONE_STEP_DIRECT_P2"
      },
      a0CommandVelocity: { x: 0, y: -3 },
      a0CommandVelocityError: 0,
      status: "APPLIED_OUTCOME_CONFIRMED",
      authorityClaim: "EXPLICIT_CALLER_ONE_STEP_DIRECT_P2"
    },
    lastError: null
  };
}

describe("Owner Sandbox incident evidence", () => {
  it("binds capture identity, causal frames and an available P2 snapshot into one explicit schema", () => {
    const incident = buildOwnerSandboxIncident({
      build: { sourceSha: "abc123", state: "PINNED_SOURCE_SHA" },
      scenario: "head-on",
      tick: 1,
      paused: true,
      mode: "spatial",
      actuator: "direct",
      a1Variant: "direct",
      timeScale: 1,
      p2: p2Snapshot(),
      frames: [frame()],
      events: ["P2 applied"]
    });

    expect(incident.schema).toBe("companion-brain-lab-owner-sandbox-incident-v1");
    expect(incident.build).toEqual({ sourceSha: "abc123", state: "PINNED_SOURCE_SHA" });
    expect(incident.capture).toEqual({
      scenario: "head-on",
      tick: 1,
      paused: true,
      mode: "spatial",
      actuator: "direct",
      a1Variant: "direct",
      timeScale: 1
    });
    expect(incident.p2.available).toBe(true);
    expect(incident.p2.snapshot?.latestApplication?.proposalId).toBe("h1:tangent:left");
    expect(incident.frames[0]?.observation.playerControlMove).toEqual({ x: 1, y: 0 });
    expect(incident.events).toEqual(["P2 applied"]);
  });

  it("defensively clones nested causal and P2 evidence", () => {
    const sourceFrame = frame();
    const sourceP2 = p2Snapshot();
    const events = ["before"];

    const incident = buildOwnerSandboxIncident({
      build: { sourceSha: "abc123", state: "PINNED_SOURCE_SHA" },
      scenario: "head-on",
      tick: 1,
      paused: true,
      mode: "spatial",
      actuator: "direct",
      a1Variant: "direct",
      timeScale: 1,
      p2: sourceP2,
      frames: [sourceFrame],
      events
    });

    sourceFrame.observation.playerControlMove.x = 999;
    sourceP2.latestApplication!.proposalId = "mutated";
    events.push("after");

    expect(incident.frames[0]?.observation.playerControlMove).toEqual({ x: 1, y: 0 });
    expect(incident.p2.snapshot?.latestApplication?.proposalId).toBe("h1:tangent:left");
    expect(incident.events).toEqual(["before"]);
  });

  it("distinguishes unavailable P2 from an available bridge with no activity", () => {
    const unavailable = buildOwnerSandboxIncident({
      build: { sourceSha: null, state: "UNPINNED_LOCAL" },
      scenario: "open",
      tick: 0,
      paused: false,
      mode: "spatial",
      actuator: "natural",
      a1Variant: "shadow",
      timeScale: 1,
      p2: null,
      frames: [],
      events: []
    });

    expect(unavailable.p2).toEqual({ available: false, snapshot: null });

    const available = buildOwnerSandboxIncident({
      build: { sourceSha: null, state: "UNPINNED_LOCAL" },
      scenario: "open",
      tick: 0,
      paused: false,
      mode: "spatial",
      actuator: "natural",
      a1Variant: "shadow",
      timeScale: 1,
      p2: {
        ...p2Snapshot(),
        previewCount: 0,
        armCount: 0,
        applicationCount: 0,
        latestApplication: null
      },
      frames: [],
      events: []
    });

    expect(available.p2.available).toBe(true);
    expect(available.p2.snapshot?.applicationCount).toBe(0);
  });
});
