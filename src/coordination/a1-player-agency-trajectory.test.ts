import { describe, expect, it } from "vitest";
import { realizeA1DirectCandidate } from "./a1-companion-candidates";
import { rehearseA1DirectJointPhysicalFuture } from "./a1-direct-joint-physical-rehearsal";
import { buildA1JointHardBodyTrace } from "./a1-joint-hard-body-trace";
import {
  analyzeA1PlayerAgencyRelativeTrajectory,
  buildA1PlayerAgencyTrajectoryEvidence
} from "./a1-player-agency-trajectory";
import { buildA1PlayerFutureHypotheses } from "./a1-player-future-hypotheses";
import { buildA1PlayerFutureInterventionPlan } from "./a1-player-future-interventions";
import { buildA1Situation } from "./a1-situation";
import { LabWorld } from "../world/world";
import type { MotionIntent, Vec2 } from "../world/types";

function playerIntent(x: number, y: number): MotionIntent {
  return { actorId: "player", move: { x, y } };
}

function realEvidence(input: {
  world: LabWorld;
  playerMove: Vec2;
  companionVelocity: Vec2;
  horizonSeconds: number;
}) {
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
  const plan = buildA1PlayerFutureInterventionPlan(futures);
  const playerIntervention = plan.interventions.find(
    (value) => value.futureFamily === "OWNER_REQUEST_CONTINUATION"
  );
  if (!playerIntervention) throw new Error("missing A1.2m H1 intervention");
  const companionRealization = realizeA1DirectCandidate({
    candidate: {
      id: "a1-2m-direct",
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
  const trace = buildA1JointHardBodyTrace({ situation, rehearsal });
  return {
    rehearsal,
    trace,
    evidence: buildA1PlayerAgencyTrajectoryEvidence({ rehearsal, trace })
  };
}

function rotate90(value: Vec2): Vec2 {
  return { x: -value.y, y: value.x };
}

function expectVectorClose(actual: Vec2 | null, expected: Vec2 | null, precision = 10): void {
  if (actual === null || expected === null) {
    expect(actual).toBe(expected);
    return;
  }
  expect(actual.x).toBeCloseTo(expected.x, precision);
  expect(actual.y).toBeCloseTo(expected.y, precision);
}

describe("Authority-A1.2m player-agency trajectory evidence", () => {
  it("keeps real equal-speed parallel motion stable in the player-flow frame without fabricating crossing", async () => {
    const world = await LabWorld.create("open");
    try {
      const before = world.snapshot();
      const { evidence } = realEvidence({
        world,
        playerMove: { x: 1, y: 0 },
        companionVelocity: { x: 3, y: 0 },
        horizonSeconds: 0.5
      });

      expect(evidence.flowBasisState).toBe("MOVING_PLAYER_FUTURE");
      expectVectorClose(evidence.forwardAxis, { x: 1, y: 0 });
      expectVectorClose(evidence.lateralAxis, { x: 0, y: 1 });
      expect(evidence.initialLongitudinalOrder).toBe("AHEAD");
      expect(evidence.terminalLongitudinalOrder).toBe("AHEAD");
      expect(evidence.initialLateralSide).toBe("CENTER");
      expect(evidence.terminalLateralSide).toBe("CENTER");
      expect(evidence.longitudinalOrderingChangeCount).toBe(0);
      expect(evidence.lateralSideChangeCount).toBe(0);
      expect(evidence.contactFrameCount).toBe(0);
      expect(evidence.terminalContactPersists).toBe(false);
      expect(evidence.comfortEnvelopeClaim).toBe("NONE_A1_2M");
      expect(evidence.cooperationDecisionClaim).toBe("NONE_A1_2M_EVIDENCE_ONLY");
      expect(world.snapshot()).toEqual(before);
    } finally {
      world.dispose();
    }
  });

  it("represents real head-on pressure as persistent contact in Owner-directed player-flow evidence", async () => {
    const world = await LabWorld.create("head-on");
    try {
      const { evidence } = realEvidence({
        world,
        playerMove: { x: 1, y: 0 },
        companionVelocity: { x: -3, y: 0 },
        horizonSeconds: 0.75
      });

      expect(evidence.playerCausalMeaning).toBe("OWNER_REQUEST_PERSISTS_COUNTERFACTUAL");
      expect(evidence.flowBasisState).toBe("MOVING_PLAYER_FUTURE");
      expect(evidence.initialLongitudinalOffset).toBeGreaterThan(0);
      expect(evidence.terminalLongitudinalOffset).toBeGreaterThan(0);
      expect(evidence.terminalLongitudinalOffset).toBeLessThan(evidence.initialLongitudinalOffset!);
      expect(evidence.reciprocalContactFrameCount).toBe(21);
      expect(evidence.firstContactStepIndex).toBe(24);
      expect(evidence.lastContactStepIndex).toBe(44);
      expect(evidence.terminalContactPersists).toBe(true);
      expect(evidence.runtimeAuthorityClaim).toBe("NONE_A1_2M_EVIDENCE_ONLY");
    } finally {
      world.dispose();
    }
  });

  it("does not fabricate a directional flow basis for a stationary Owner future", async () => {
    const world = await LabWorld.create("open");
    try {
      const { evidence } = realEvidence({
        world,
        playerMove: { x: 0, y: 0 },
        companionVelocity: { x: 0, y: 0 },
        horizonSeconds: 0.25
      });

      expect(evidence.playerSpeed).toBe(0);
      expect(evidence.flowBasisState).toBe("FLOW_BASIS_UNAVAILABLE_STATIONARY");
      expect(evidence.forwardAxis).toBeNull();
      expect(evidence.lateralAxis).toBeNull();
      expect(evidence.initialLongitudinalOffset).toBeNull();
      expect(evidence.initialLateralOffset).toBeNull();
      expect(evidence.frames.every((frame) => frame.longitudinalOffset === null)).toBe(true);
      expect(evidence.frames.every((frame) => frame.lateralOffset === null)).toBe(true);
      expect(evidence.longitudinalOrderingChangeCount).toBe(0);
      expect(evidence.lateralSideChangeCount).toBe(0);
    } finally {
      world.dispose();
    }
  });

  it("detects cross-front geometry from the trajectory rather than endpoint coincidence", () => {
    const geometry = analyzeA1PlayerAgencyRelativeTrajectory({
      playerVelocity: { x: 2, y: 0 },
      initialRelativeOffset: { x: 0.8, y: 0.9 },
      frames: [
        { stepIndex: 0, timeSeconds: 0.1, relativeOffset: { x: 0.5, y: 0.45 } },
        { stepIndex: 1, timeSeconds: 0.2, relativeOffset: { x: 0.15, y: 0.08 } },
        { stepIndex: 2, timeSeconds: 0.3, relativeOffset: { x: -0.2, y: -0.3 } },
        { stepIndex: 3, timeSeconds: 0.4, relativeOffset: { x: -0.55, y: -0.7 } }
      ]
    });

    expect(geometry.initialLongitudinalOrder).toBe("AHEAD");
    expect(geometry.terminalLongitudinalOrder).toBe("BEHIND");
    expect(geometry.initialLateralSide).toBe("LEFT");
    expect(geometry.terminalLateralSide).toBe("RIGHT");
    expect(geometry.longitudinalOrderingChangeCount).toBe(1);
    expect(geometry.lateralSideChangeCount).toBe(1);
    expect(geometry.minimumAbsoluteLateralOffsetIncludingInitial).toBeCloseTo(0.08, 12);
    expect(geometry.minimumAbsoluteLateralSampleStepIndex).toBe(1);
  });

  it("is rotation-covariant when the player future and complete relative trajectory rotate together", () => {
    const baseFrames = [
      { stepIndex: 0, timeSeconds: 0.1, relativeOffset: { x: 1.2, y: 0.7 } },
      { stepIndex: 1, timeSeconds: 0.2, relativeOffset: { x: 0.8, y: 0.2 } },
      { stepIndex: 2, timeSeconds: 0.3, relativeOffset: { x: 0.4, y: -0.4 } }
    ];
    const base = analyzeA1PlayerAgencyRelativeTrajectory({
      playerVelocity: { x: 1.5, y: 0.5 },
      initialRelativeOffset: { x: 1.6, y: 1 },
      frames: baseFrames
    });
    const rotated = analyzeA1PlayerAgencyRelativeTrajectory({
      playerVelocity: rotate90({ x: 1.5, y: 0.5 }),
      initialRelativeOffset: rotate90({ x: 1.6, y: 1 }),
      frames: baseFrames.map((frame) => ({ ...frame, relativeOffset: rotate90(frame.relativeOffset) }))
    });

    expectVectorClose(rotated.forwardAxis, rotate90(base.forwardAxis!));
    expectVectorClose(rotated.lateralAxis, rotate90(base.lateralAxis!));
    expect(rotated.initialLongitudinalOffset).toBeCloseTo(base.initialLongitudinalOffset!, 12);
    expect(rotated.initialLateralOffset).toBeCloseTo(base.initialLateralOffset!, 12);
    expect(rotated.longitudinalOrderingChangeCount).toBe(base.longitudinalOrderingChangeCount);
    expect(rotated.lateralSideChangeCount).toBe(base.lateralSideChangeCount);
    for (let index = 0; index < base.frames.length; index += 1) {
      expect(rotated.frames[index]!.longitudinalOffset).toBeCloseTo(
        base.frames[index]!.longitudinalOffset!,
        12
      );
      expect(rotated.frames[index]!.lateralOffset).toBeCloseTo(
        base.frames[index]!.lateralOffset!,
        12
      );
    }
  });

  it("rejects a trace whose source tick no longer matches its rehearsal", async () => {
    const world = await LabWorld.create("open");
    try {
      const { rehearsal, trace } = realEvidence({
        world,
        playerMove: { x: 1, y: 0 },
        companionVelocity: { x: 3, y: 0 },
        horizonSeconds: 0.5
      });
      const forged = { ...trace, sourceTick: trace.sourceTick + 1 };

      expect(() => buildA1PlayerAgencyTrajectoryEvidence({
        rehearsal,
        trace: forged
      })).toThrow(/source ticks are misaligned/i);
    } finally {
      world.dispose();
    }
  });
});
