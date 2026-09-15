import { describe, expect, it } from "vitest";
import { realizeA1DirectCandidate } from "./a1-companion-candidates";
import { rehearseA1DirectJointPhysicalFuture } from "./a1-direct-joint-physical-rehearsal";
import { evaluateA1G3JointTracePolicy } from "./a1-g3-joint-trace-policy";
import {
  buildA1JointHardBodyTrace,
  type A1JointHardBodyTraceEvidence,
  type A1JointHardBodyTraceFrame
} from "./a1-joint-hard-body-trace";
import { buildA1PlayerFutureHypotheses } from "./a1-player-future-hypotheses";
import { buildA1PlayerFutureInterventionPlan } from "./a1-player-future-interventions";
import { buildA1Situation } from "./a1-situation";
import { LabWorld } from "../world/world";
import type { MotionIntent, Vec2 } from "../world/types";

function playerIntent(x: number, y: number): MotionIntent {
  return { actorId: "player", move: { x, y } };
}

function realTrace(input: {
  world: LabWorld;
  playerMove: Vec2;
  companionVelocity: Vec2;
  horizonSeconds: number;
}): A1JointHardBodyTraceEvidence {
  const intent = playerIntent(input.playerMove.x, input.playerMove.y);
  const situation = buildA1Situation({
    snapshot: input.world.snapshot(),
    playerIntent: intent,
    playerCapability: input.world.actorMovementCapability("player"),
    companionCapability: input.world.actorMovementCapability("companion"),
    previousWorldStep: null
  });
  const futures = buildA1PlayerFutureHypotheses({
    situation,
    horizonSeconds: input.horizonSeconds,
    staticTraversal: (from, target, radius, options) =>
      input.world.staticCircleTraversal(from, target, radius, options)
  });
  const interventions = buildA1PlayerFutureInterventionPlan(futures);
  const playerIntervention = interventions.interventions.find(
    (value) => value.futureFamily === "OWNER_REQUEST_CONTINUATION"
  );
  if (!playerIntervention) throw new Error("missing A1.2l H1 intervention");
  const companionRealization = realizeA1DirectCandidate({
    candidate: {
      id: "a1-2l-direct",
      family: "PLAYER_FEED_FORWARD",
      sourceTick: situation.tick,
      desiredVelocity: input.companionVelocity,
      localBasisSource: "NONE"
    },
    capability: input.world.actorMovementCapability("companion"),
    horizonSeconds: input.horizonSeconds
  });
  const rehearsal = rehearseA1DirectJointPhysicalFuture({
    world: input.world,
    situation,
    playerIntervention,
    companionRealization
  });
  return buildA1JointHardBodyTrace({ situation, rehearsal });
}

type SyntheticContact = "none" | "reciprocal" | "player-only" | "companion-only";

function syntheticTrace(input: {
  initialClearance: number;
  clearances: readonly number[];
  contacts?: readonly SyntheticContact[];
}): A1JointHardBodyTraceEvidence {
  const threshold = 0.6;
  const contacts = input.contacts ?? input.clearances.map(() => "none" as const);
  if (contacts.length !== input.clearances.length) throw new Error("synthetic contact length mismatch");

  let contactFrameCount = 0;
  let reciprocalContactFrameCount = 0;
  let asymmetricContactFrameCount = 0;
  let firstContactStepIndex: number | null = null;
  let lastContactStepIndex: number | null = null;

  const frames: A1JointHardBodyTraceFrame[] = input.clearances.map((hardClearance, stepIndex) => {
    const contact = contacts[stepIndex]!;
    const playerReportsCompanionContact = contact === "reciprocal" || contact === "player-only";
    const companionReportsPlayerContact = contact === "reciprocal" || contact === "companion-only";
    const reciprocalPlayerCompanionContact = contact === "reciprocal";
    if (playerReportsCompanionContact || companionReportsPlayerContact) {
      contactFrameCount += 1;
      firstContactStepIndex ??= stepIndex;
      lastContactStepIndex = stepIndex;
      if (reciprocalPlayerCompanionContact) reciprocalContactFrameCount += 1;
      else asymmetricContactFrameCount += 1;
    }
    return {
      stepIndex,
      timeSeconds: (stepIndex + 1) / 60,
      playerPosition: { x: 0, y: 0 },
      companionPosition: { x: threshold + hardClearance, y: 0 },
      playerRadius: 0.3,
      companionRadius: 0.3,
      hardRadiusThreshold: threshold,
      centerDistance: threshold + hardClearance,
      hardClearance,
      playerReportsCompanionContact,
      companionReportsPlayerContact,
      reciprocalPlayerCompanionContact,
      playerCompanionContactCount: playerReportsCompanionContact ? 1 : 0,
      companionPlayerContactCount: companionReportsPlayerContact ? 1 : 0
    };
  });

  const minimumSampledHardClearance = Math.min(...input.clearances);
  const minimumSampledStepIndex = input.clearances.indexOf(minimumSampledHardClearance);
  const terminalHardClearance = input.clearances.at(-1)!;

  return {
    kind: "A1_JOINT_HARD_BODY_TRACE_EVIDENCE",
    sourceTick: 0,
    playerFutureId: "synthetic-player",
    companionCandidateId: "synthetic-companion",
    worldStepSeconds: 1 / 60,
    worldStepCount: frames.length,
    declaredHorizonSeconds: frames.length / 60,
    executedHorizonSeconds: frames.length / 60,
    playerRadius: 0.3,
    companionRadius: 0.3,
    hardRadiusThreshold: threshold,
    initialPlayerPosition: { x: 0, y: 0 },
    initialCompanionPosition: { x: threshold + input.initialClearance, y: 0 },
    initialCenterDistance: threshold + input.initialClearance,
    initialHardClearance: input.initialClearance,
    frames,
    minimumSampledHardClearance,
    minimumSampledStepIndex,
    minimumSampledTimeSeconds: (minimumSampledStepIndex + 1) / 60,
    minimumObservedHardClearanceIncludingInitial: Math.min(
      input.initialClearance,
      minimumSampledHardClearance
    ),
    terminalHardClearance,
    minimumSampledDeltaFromInitial: minimumSampledHardClearance - input.initialClearance,
    terminalDeltaFromInitial: terminalHardClearance - input.initialClearance,
    sampledNegativeClearanceFrameCount: input.clearances.filter((value) => value < 0).length,
    contactFrameCount,
    reciprocalContactFrameCount,
    asymmetricContactFrameCount,
    firstContactStepIndex,
    lastContactStepIndex,
    samplingScopeClaim: "INITIAL_STATE_PLUS_POST_STEP_SAMPLES_A1_2K",
    contactEvidenceClaim: "RAPIER_CONTACT_RECORDS_PER_POST_STEP_FRAME_A1_2K",
    continuousClosestApproachClaim: "NONE_DISCRETE_SAMPLES_PLUS_CONTACT_RECORDS_ONLY_A1_2K",
    g3PolicyClaim: "NONE_A1_2K_TRACE_ONLY",
    cooperationClaim: "NONE_A1_2K_TRACE_ONLY",
    selectionClaim: "NONE_A1_2K_TRACE_ONLY",
    runtimeAuthorityClaim: "NONE_A1_2K_TRACE_ONLY"
  };
}

describe("Authority-A1.2l G3 policy over qualified joint traces", () => {
  it("passes real open parallel motion only because it remains clear and no-contact", async () => {
    const world = await LabWorld.create("open");
    try {
      const trace = realTrace({
        world,
        playerMove: { x: 1, y: 0 },
        companionVelocity: { x: 3, y: 0 },
        horizonSeconds: 0.5
      });
      const result = evaluateA1G3JointTracePolicy(trace);

      expect(result.status).toBe("PASS_CLEAR");
      expect(result.decision).toBe("PASS");
      expect(result.contactFrameCount).toBe(0);
      expect(result.numericPolicyClaim).toBe("NO_PENETRATION_DEPTH_ACCEPTANCE_THRESHOLD_A1_2L");
      expect(result.cooperationClaim).toBe("NONE_G4_REQUIRED_FOR_CONTACT_QUALITY_A1_2L");
      expect(result.runtimeAuthorityClaim).toBe("NONE_A1_2L");
    } finally {
      world.dispose();
    }
  });

  it("routes real persistent head-on reciprocal contact to G4 instead of inventing a penetration-depth pass/fail threshold", async () => {
    const world = await LabWorld.create("head-on");
    try {
      const trace = realTrace({
        world,
        playerMove: { x: 1, y: 0 },
        companionVelocity: { x: -3, y: 0 },
        horizonSeconds: 0.75
      });
      const result = evaluateA1G3JointTracePolicy(trace);

      expect(trace.reciprocalContactFrameCount).toBeGreaterThan(0);
      expect(trace.minimumSampledHardClearance).toBeLessThan(0);
      expect(result.status).toBe("REQUIRE_G4_NEW_RECIPROCAL_CONTACT");
      expect(result.decision).toBe("REQUIRE_G4");
      expect(result.contactPolicyClaim).toBe("NEW_RECIPROCAL_CONTACT_REQUIRES_G4_A1_2L");
      expect(result.selectionClaim).toBe("NONE_A1_2L_POLICY_ONLY");
    } finally {
      world.dispose();
    }
  });

  it("passes pre-existing hard overlap only when sampled clearance improves monotonically", () => {
    const trace = syntheticTrace({
      initialClearance: -0.2,
      clearances: [-0.16, -0.11, -0.04, 0.03],
      contacts: ["reciprocal", "reciprocal", "reciprocal", "none"]
    });
    const result = evaluateA1G3JointTracePolicy(trace);

    expect(result.status).toBe("PASS_MONOTONIC_EGRESS");
    expect(result.decision).toBe("PASS");
    expect(result.monotonicEgressEvidence).toBe(true);
    expect(result.terminallySeparated).toBe(true);
  });

  it("fails pre-existing overlap when any sampled state becomes materially deeper", () => {
    const trace = syntheticTrace({
      initialClearance: -0.1,
      clearances: [-0.08, -0.13, -0.04],
      contacts: ["reciprocal", "reciprocal", "reciprocal"]
    });
    const result = evaluateA1G3JointTracePolicy(trace);

    expect(result.status).toBe("FAIL_WORSENING_PREEXISTING_OVERLAP");
    expect(result.decision).toBe("FAIL");
  });

  it("holds pre-existing contact that persists without proven egress", () => {
    const trace = syntheticTrace({
      initialClearance: -0.1,
      clearances: [-0.1, -0.1, -0.1],
      contacts: ["reciprocal", "reciprocal", "reciprocal"]
    });
    const result = evaluateA1G3JointTracePolicy(trace);

    expect(result.status).toBe("HOLD_PREEXISTING_CONTACT_NOT_EGRESSING");
    expect(result.decision).toBe("HOLD");
  });

  it("refuses asymmetric Rapier contact records as unresolved evidence", () => {
    const trace = syntheticTrace({
      initialClearance: 1,
      clearances: [0.8, 0.7],
      contacts: ["player-only", "none"]
    });
    const result = evaluateA1G3JointTracePolicy(trace);

    expect(result.status).toBe("UNRESOLVED_ASYMMETRIC_CONTACT_EVIDENCE");
    expect(result.decision).toBe("UNRESOLVED");
  });

  it("refuses sampled touch/overlap from an initially clear state when Rapier reports no reciprocal contact", () => {
    const trace = syntheticTrace({
      initialClearance: 0.5,
      clearances: [0.2, -0.01],
      contacts: ["none", "none"]
    });
    const result = evaluateA1G3JointTracePolicy(trace);

    expect(result.status).toBe("UNRESOLVED_GEOMETRY_CONTACT_DIVERGENCE");
    expect(result.decision).toBe("UNRESOLVED");
  });

  it("rejects upstream trace evidence that already claims G3 authority", () => {
    const trace = syntheticTrace({ initialClearance: 1, clearances: [1, 1] });
    const forged = { ...trace, g3PolicyClaim: "FORGED_G3" as never };

    expect(() => evaluateA1G3JointTracePolicy(forged)).toThrow(/already claims G3 policy authority/i);
  });
});
