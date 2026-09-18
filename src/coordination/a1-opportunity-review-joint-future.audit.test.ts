import { describe, expect, it } from "vitest";
import { buildA1PlayerFutureHypotheses } from "./a1-player-future-hypotheses";
import { buildA1PlayerFutureInterventionPlan } from "./a1-player-future-interventions";
import { buildA1Situation, type A1Situation } from "./a1-situation";
import type { A1SpatialCommitmentFitEvidence } from "./a1-spatial-commitment-evidence";
import { buildA1SpatialCommitmentJointFutureSetEvidence } from "./a1-spatial-commitment-joint-future";
import { buildA1SpatialCommitmentPlayerFutureSetEvidence } from "./a1-spatial-commitment-player-future-set";
import { buildA1SpatialCommitmentReviewEvidence } from "./a1-spatial-commitment-review";
import { LabWorld } from "../world/world";
import type { MotionIntent, Vec2, WorldSnapshot } from "../world/types";

function playerIntent(x: number, y: number): MotionIntent {
  return { actorId: "player", move: { x, y } };
}

function companionHold(): MotionIntent {
  return { actorId: "companion", move: { x: 0, y: 0 } };
}

function fit(snapshot: WorldSnapshot, anchor: Vec2): A1SpatialCommitmentFitEvidence {
  return {
    kind: "A1_SPATIAL_COMMITMENT_FIT",
    sourceTick: snapshot.tick,
    commitmentSourceTick: 0,
    referenceFrame: "WORLD_FIXED",
    anchorProvenance: "JOINT_REVIEW_AUDIT",
    referenceResolutionStatus: "RESOLVED",
    referenceUnresolvedReason: null,
    referenceSourceBasisProvenance: "NOT_REQUIRED",
    referenceSourceBasisSourceTick: null,
    referenceSourceBasisAgeTicksAtCommitment: null,
    referenceBasisProvenance: "NOT_REQUIRED",
    referenceBasisSourceTick: null,
    referenceBasisAgeTicks: null,
    resolvedAnchorWorldPosition: { ...anchor },
    commitmentObjectiveSignature: "objective",
    currentObjectiveSignature: "objective",
    commitmentOrientationRegime: "DIRECTIONAL",
    currentOrientationRegime: "DIRECTIONAL",
    currentSamplingSignature: "sampling",
    semanticStatus: "COMPARABLE",
    coverage: "COMPLETE",
    qualificationStrategy: "STRATIFIED_COVERAGE",
    pressureStatus: "EXACT_ON_SAMPLED_MESH",
    sampledPressureDistance: 0,
    nearestConfirmedSampleId: "audit",
    nearestConfirmedWorldPosition: { ...anchor },
    nearestConfirmedUtility: 1,
    utilityGapFromCurrentBest: 0,
    confirmedReachableCount: 1,
    untestedCount: 0,
    samplingTruth: "SAMPLED_MESH_ONLY",
    reason: "joint review audit fixture"
  };
}

function situation(
  world: LabWorld,
  snapshot: WorldSnapshot,
  intent: MotionIntent
): A1Situation {
  return buildA1Situation({
    snapshot,
    playerIntent: intent,
    playerCapability: world.actorMovementCapability("player"),
    companionCapability: world.actorMovementCapability("companion"),
    previousWorldStep: snapshot.tick === 0
      ? null
      : world.latestAuthorityA0StepEvidence()
  });
}

function evidence(
  world: LabWorld,
  currentFit: A1SpatialCommitmentFitEvidence,
  currentSituation: A1Situation,
  horizonSeconds: number
) {
  const hypotheses = buildA1PlayerFutureHypotheses({
    situation: currentSituation,
    horizonSeconds,
    staticTraversal: (from, to, radius, options) =>
      world.staticCircleTraversal(from, to, radius, options)
  });
  const plan = buildA1PlayerFutureInterventionPlan(hypotheses);
  const playerFutureSet = buildA1SpatialCommitmentPlayerFutureSetEvidence({
    world,
    fit: currentFit,
    snapshot: world.snapshot(),
    plan
  });
  const jointFutureSet = buildA1SpatialCommitmentJointFutureSetEvidence({
    world,
    fit: currentFit,
    situation: currentSituation,
    playerFutureSet
  });
  return { playerFutureSet, jointFutureSet };
}

describe("A1 commitment review keeps anchor conflict distinct from joint interference", () => {
  it("preserves every source future explicitly when companion direct execution is statically blocked", async () => {
    const world = await LabWorld.create("pillar");
    try {
      const before = world.snapshot();
      const currentFit = fit(before, { x: 4.5, y: 4 });
      const currentSituation = situation(world, before, playerIntent(-1, 0));
      const { playerFutureSet, jointFutureSet } = evidence(
        world,
        currentFit,
        currentSituation,
        1
      );
      const review = buildA1SpatialCommitmentReviewEvidence(
        currentFit,
        null,
        null,
        playerFutureSet,
        jointFutureSet
      );

      expect(jointFutureSet.status).toBe("COMPANION_DIRECT_STATIC_BLOCKED");
      expect(jointFutureSet.staticQualification?.g2.status).toBe(
        "FAIL_STATIC_HARD_LEGALITY"
      );
      expect(jointFutureSet.futures.map((future) => future.futureId)).toEqual(
        playerFutureSet.futures.map((future) => future.futureId)
      );

      const sourceRehearsableIds = playerFutureSet.futures
        .filter((future) => future.interventionStatus === "REHEARSABLE")
        .map((future) => future.futureId);
      expect(sourceRehearsableIds.length).toBeGreaterThan(0);
      expect(jointFutureSet.staticBlockedFutureIds).toEqual(sourceRehearsableIds);
      expect(review.jointStaticBlockedFutureIds).toEqual(sourceRehearsableIds);
      expect(jointFutureSet.contactFutureIds).toEqual([]);
      expect(jointFutureSet.noContactRehearsedFutureIds).toEqual([]);
      for (const id of sourceRehearsableIds) {
        const blocked = jointFutureSet.futures.find((future) => future.futureId === id);
        expect(blocked?.status).toBe("COMPANION_DIRECT_STATIC_BLOCKED");
      }
      expect(review.jointNoContactSafetyClaim).toBe("NONE");
      expect(review.jointCooperationPolicyClaim).toBe("NONE");
      expect(review.decisionClaim).toBe("NONE_EVIDENCE_ONLY");
      expect(review.runtimeAuthorityClaim).toBe("NONE");

      console.info(`[A1_COMMITMENT_JOINT_STATIC_BLOCK_COMPLETENESS] ${JSON.stringify({
        sourceTick: jointFutureSet.sourceTick,
        horizonSeconds: jointFutureSet.horizonSeconds,
        sourceFutureIds: playerFutureSet.futures.map((future) => future.futureId),
        jointFutureStatuses: jointFutureSet.futures.map((future) => ({
          futureId: future.futureId,
          status: future.status
        })),
        staticBlockedFutureIds: jointFutureSet.staticBlockedFutureIds,
        causalUnresolvedFutureIds: jointFutureSet.causalUnresolvedFutureIds,
        contactFutureIds: jointFutureSet.contactFutureIds,
        noContactRehearsedFutureIds: jointFutureSet.noContactRehearsedFutureIds,
        g2: jointFutureSet.staticQualification?.g2 ?? null,
        interpretation: "Static blockage of the companion direct realization no longer erases rehearsable player futures. Each remains explicit as blocked-before-joint-rehearsal and is not mislabeled as no-contact or safety evidence."
      })}`);
    } finally {
      world.dispose();
    }
  });

  it("keeps H1 anchor overlap visible while preserving zero joint contact when companion cannot reach in time", async () => {
    const world = await LabWorld.create("open");
    try {
      const after = world.step([playerIntent(1, 0), companionHold()]);
      const player = after.actors.find((value) => value.id === "player");
      if (!player) throw new Error("missing player");
      const currentFit = fit(after, {
        x: player.position.x - 0.604891167664243,
        y: player.position.y + 1.339625322141366
      });
      const currentSituation = situation(world, after, playerIntent(-1, 1));
      const { playerFutureSet, jointFutureSet } = evidence(
        world,
        currentFit,
        currentSituation,
        0.5
      );
      const review = buildA1SpatialCommitmentReviewEvidence(
        currentFit,
        null,
        null,
        playerFutureSet,
        jointFutureSet
      );

      expect(review.playerFutureOverlapIds).toContain("owner-request-continuation");
      expect(review.jointContactFutureIds).toEqual([]);
      expect(review.jointNoContactRehearsedFutureIds).toContain(
        "owner-request-continuation"
      );
      expect(review.jointDirectCapabilityClipped).toBe(true);
      expect(review.jointDirectTerminalAnchorError).toBeGreaterThan(3);
      expect(review.jointAnchorOccupancyEquivalenceClaim).toBe("NONE");
      expect(review.jointNoContactSafetyClaim).toBe("NONE");
      expect(review.jointCooperationPolicyClaim).toBe("NONE");
      expect(review.jointBooleanCollapseClaim).toBe("NONE");
      expect(review.decisionClaim).toBe("NONE_EVIDENCE_ONLY");
    } finally {
      world.dispose();
    }
  });

  it("preserves real same-physics reciprocal contact as a separate future-specific signal without yielding policy", async () => {
    const world = await LabWorld.create("head-on");
    try {
      const before = world.snapshot();
      const currentFit = fit(before, { x: 5.5, y: 4 });
      const currentSituation = situation(world, before, playerIntent(1, 0));
      const { playerFutureSet, jointFutureSet } = evidence(
        world,
        currentFit,
        currentSituation,
        0.75
      );
      const review = buildA1SpatialCommitmentReviewEvidence(
        currentFit,
        null,
        null,
        playerFutureSet,
        jointFutureSet
      );

      expect(review.playerFutureOverlapIds).toContain("owner-request-continuation");
      expect(review.jointContactFutureIds).toContain("owner-request-continuation");
      expect(review.jointDirectCapabilityClipped).toBe(false);
      expect(review.jointDirectTerminalAnchorError).toBeLessThan(1e-9);
      expect(review.jointContactEvidenceClaim).toBe(
        "SAME_PHYSICS_RECIPROCAL_CONTACT_FRAMES_ONLY"
      );
      expect(review.jointCooperationPolicyClaim).toBe("NONE");
      expect(review.selectionClaim).toBe("NONE");
      expect(review.runtimeAuthorityClaim).toBe("NONE");

      console.info(`[A1_SPATIAL_COMMITMENT_REVIEW_JOINT_FUTURE] ${JSON.stringify({
        sourceTick: review.sourceTick,
        playerFutureOverlapIds: review.playerFutureOverlapIds,
        jointContactFutureIds: review.jointContactFutureIds,
        jointNoContactRehearsedFutureIds: review.jointNoContactRehearsedFutureIds,
        jointDirectCapabilityClipped: review.jointDirectCapabilityClipped,
        jointDirectTerminalAnchorError: review.jointDirectTerminalAnchorError,
        contactEvidenceClaim: review.jointContactEvidenceClaim,
        anchorOccupancyEquivalenceClaim: review.jointAnchorOccupancyEquivalenceClaim,
        noContactSafetyClaim: review.jointNoContactSafetyClaim,
        cooperationPolicyClaim: review.jointCooperationPolicyClaim,
        booleanCollapseClaim: review.jointBooleanCollapseClaim,
        decisionClaim: review.decisionClaim,
        selectionClaim: review.selectionClaim,
        runtimeAuthorityClaim: review.runtimeAuthorityClaim,
        interpretation: "Review preserves player-future anchor occupancy and same-physics joint contact as different evidence axes. Reciprocal contact is concrete future-specific interference evidence, but it does not become a yield decision, safety theorem, score, selector or runtime authority."
      })}`);
    } finally {
      world.dispose();
    }
  });
});
