import { describe, expect, it } from "vitest";
import { realizeA1DirectCandidate } from "./a1-companion-candidates";
import { rehearseA1DirectJointPhysicalFuture } from "./a1-direct-joint-physical-rehearsal";
import { buildA1JointHardBodyTrace } from "./a1-joint-hard-body-trace";
import { buildA1PlayerFutureHypotheses } from "./a1-player-future-hypotheses";
import { buildA1PlayerFutureInterventionPlan } from "./a1-player-future-interventions";
import { buildA1Situation } from "./a1-situation";
import { LabWorld } from "../world/world";
import type { MotionIntent, Vec2 } from "../world/types";

function playerIntent(x: number, y: number): MotionIntent {
  return { actorId: "player", move: { x, y } };
}

function situationAt(world: LabWorld, intent: MotionIntent) {
  return buildA1Situation({
    snapshot: world.snapshot(),
    playerIntent: intent,
    playerCapability: world.actorMovementCapability("player"),
    companionCapability: world.actorMovementCapability("companion"),
    previousWorldStep: null
  });
}

function jointRehearsal(input: {
  world: LabWorld;
  playerMove: Vec2;
  companionVelocity: Vec2;
  horizonSeconds: number;
}) {
  const intent = playerIntent(input.playerMove.x, input.playerMove.y);
  const situation = situationAt(input.world, intent);
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
  if (!playerIntervention) throw new Error("missing A1.2k H1 intervention");
  const companionRealization = realizeA1DirectCandidate({
    candidate: {
      id: "a1-2k-direct",
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
  return { situation, rehearsal };
}

describe("Authority-A1.2k joint hard-body trace evidence", () => {
  it("records open parallel motion as positive sampled clearance with no actor contact", async () => {
    const world = await LabWorld.create("open");
    try {
      const before = world.snapshot();
      const { situation, rehearsal } = jointRehearsal({
        world,
        playerMove: { x: 1, y: 0 },
        companionVelocity: { x: 3, y: 0 },
        horizonSeconds: 0.5
      });
      const trace = buildA1JointHardBodyTrace({ situation, rehearsal });

      expect(trace.kind).toBe("A1_JOINT_HARD_BODY_TRACE_EVIDENCE");
      expect(trace.worldStepCount).toBe(30);
      expect(trace.frames).toHaveLength(30);
      expect(trace.initialHardClearance).toBeGreaterThan(0);
      expect(trace.minimumSampledHardClearance).toBeGreaterThan(0);
      expect(trace.terminalHardClearance).toBeGreaterThan(0);
      expect(trace.contactFrameCount).toBe(0);
      expect(trace.reciprocalContactFrameCount).toBe(0);
      expect(trace.asymmetricContactFrameCount).toBe(0);
      expect(trace.firstContactStepIndex).toBeNull();
      expect(trace.lastContactStepIndex).toBeNull();
      expect(trace.sampledNegativeClearanceFrameCount).toBe(0);
      expect(trace.continuousClosestApproachClaim).toBe(
        "NONE_DISCRETE_SAMPLES_PLUS_CONTACT_RECORDS_ONLY_A1_2K"
      );
      expect(trace.g3PolicyClaim).toBe("NONE_A1_2K_TRACE_ONLY");
      expect(trace.cooperationClaim).toBe("NONE_A1_2K_TRACE_ONLY");
      expect(world.snapshot()).toEqual(before);
    } finally {
      world.dispose();
    }
  });

  it("retains reciprocal Rapier contact evidence in a real head-on joint future", async () => {
    const world = await LabWorld.create("head-on");
    try {
      const before = world.snapshot();
      const { situation, rehearsal } = jointRehearsal({
        world,
        playerMove: { x: 1, y: 0 },
        companionVelocity: { x: -3, y: 0 },
        horizonSeconds: 0.75
      });
      const trace = buildA1JointHardBodyTrace({ situation, rehearsal });

      expect(trace.worldStepCount).toBe(45);
      expect(trace.contactFrameCount).toBeGreaterThan(0);
      expect(trace.reciprocalContactFrameCount).toBeGreaterThan(0);
      expect(trace.firstContactStepIndex).not.toBeNull();
      expect(trace.lastContactStepIndex).not.toBeNull();
      expect(trace.minimumSampledStepIndex).toBeGreaterThanOrEqual(0);
      expect(trace.minimumSampledTimeSeconds).toBeGreaterThan(0);
      expect(Number.isFinite(trace.minimumSampledHardClearance)).toBe(true);
      expect(Number.isFinite(trace.terminalHardClearance)).toBe(true);
      expect(trace.samplingScopeClaim).toBe("INITIAL_STATE_PLUS_POST_STEP_SAMPLES_A1_2K");
      expect(trace.contactEvidenceClaim).toBe("RAPIER_CONTACT_RECORDS_PER_POST_STEP_FRAME_A1_2K");
      expect(world.snapshot()).toEqual(before);

      console.log("[A1_2K_TRACE] head-on", JSON.stringify({
        initialHardClearance: trace.initialHardClearance,
        minimumSampledHardClearance: trace.minimumSampledHardClearance,
        terminalHardClearance: trace.terminalHardClearance,
        sampledNegativeClearanceFrameCount: trace.sampledNegativeClearanceFrameCount,
        contactFrameCount: trace.contactFrameCount,
        reciprocalContactFrameCount: trace.reciprocalContactFrameCount,
        asymmetricContactFrameCount: trace.asymmetricContactFrameCount,
        firstContactStepIndex: trace.firstContactStepIndex,
        lastContactStepIndex: trace.lastContactStepIndex
      }));
    } finally {
      world.dispose();
    }
  });

  it("rejects trace evidence whose source tick no longer aligns with its A1 situation", async () => {
    const world = await LabWorld.create("open");
    try {
      const { situation, rehearsal } = jointRehearsal({
        world,
        playerMove: { x: 1, y: 0 },
        companionVelocity: { x: 3, y: 0 },
        horizonSeconds: 0.5
      });
      const forgedRehearsal = { ...rehearsal, sourceTick: rehearsal.sourceTick + 1 };

      expect(() => buildA1JointHardBodyTrace({
        situation,
        rehearsal: forgedRehearsal
      })).toThrow(/rehearsal source tick must equal A1 situation tick/i);
    } finally {
      world.dispose();
    }
  });

  it("rejects non-contiguous physical step evidence instead of inventing missing time", async () => {
    const world = await LabWorld.create("open");
    try {
      const { situation, rehearsal } = jointRehearsal({
        world,
        playerMove: { x: 1, y: 0 },
        companionVelocity: { x: 3, y: 0 },
        horizonSeconds: 0.5
      });
      const physical = {
        ...rehearsal.physical,
        frames: rehearsal.physical.frames.map((frame, index) =>
          index === 4 ? { ...frame, stepIndex: 9 } : frame
        )
      };
      const forgedRehearsal = { ...rehearsal, physical };

      expect(() => buildA1JointHardBodyTrace({
        situation,
        rehearsal: forgedRehearsal
      })).toThrow(/contiguous zero-based physical rehearsal step indices/i);
    } finally {
      world.dispose();
    }
  });

  it("rejects actor-radius drift in the physical trace", async () => {
    const world = await LabWorld.create("open");
    try {
      const { situation, rehearsal } = jointRehearsal({
        world,
        playerMove: { x: 1, y: 0 },
        companionVelocity: { x: 3, y: 0 },
        horizonSeconds: 0.5
      });
      const firstFrame = rehearsal.physical.frames[0]!;
      const physical = {
        ...rehearsal.physical,
        frames: rehearsal.physical.frames.map((frame, index) => index === 0
          ? {
              ...frame,
              actors: firstFrame.actors.map((value) => value.id === "player"
                ? { ...value, radius: value.radius + 0.01 }
                : value)
            }
          : frame)
      };
      const forgedRehearsal = { ...rehearsal, physical };

      expect(() => buildA1JointHardBodyTrace({
        situation,
        rehearsal: forgedRehearsal
      })).toThrow(/player radius changed across the physical rehearsal trace/i);
    } finally {
      world.dispose();
    }
  });
});
