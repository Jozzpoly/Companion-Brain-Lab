import { describe, expect, it } from "vitest";
import { buildA1PlayerFutureHypotheses } from "./a1-player-future-hypotheses";
import { buildA1PlayerFutureInterventionPlan } from "./a1-player-future-interventions";
import { buildA1Situation, type A1Situation } from "./a1-situation";
import type { A1SpatialCommitmentFitEvidence } from "./a1-spatial-commitment-evidence";
import { buildA1SpatialCommitmentJointFutureSetEvidence } from "./a1-spatial-commitment-joint-future";
import { buildA1SpatialCommitmentOwnerFlowImpactEvidence } from "./a1-spatial-commitment-owner-flow-impact";
import { buildA1SpatialCommitmentPlayerFutureSetEvidence } from "./a1-spatial-commitment-player-future-set";
import { buildA1SpatialCommitmentReviewEvidence } from "./a1-spatial-commitment-review";
import { buildA1SpatialCommitmentRightOfWayEvidenceDossier } from "./a1-spatial-commitment-right-of-way-dossier";
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
    anchorProvenance: "NO_CONTACT_CROSS_FUTURE_FALSIFIER",
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
    reason: "cross-future no-contact falsifier fixture"
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

describe("A1 no-contact evidence remains future-scoped", () => {
  it("falsifies sampled anchor overlap as a proxy for reciprocal joint contact", async () => {
    const world = await LabWorld.create("open");
    try {
      const after = world.step([playerIntent(1, 0), companionHold()]);
      const player = after.actors.find((value) => value.id === "player");
      if (!player) throw new Error("missing player");

      const currentFit = fit(after, {
        x: player.position.x + 0.8,
        y: player.position.y
      });
      const currentSituation = situation(world, after, playerIntent(-1, 0));
      const horizonSeconds = 0.5;

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
        snapshot: after,
        plan
      });
      const jointFutureSet = buildA1SpatialCommitmentJointFutureSetEvidence({
        world,
        fit: currentFit,
        situation: currentSituation,
        playerFutureSet
      });
      const review = buildA1SpatialCommitmentReviewEvidence(
        currentFit,
        null,
        null,
        playerFutureSet,
        jointFutureSet
      );
      const impact = buildA1SpatialCommitmentOwnerFlowImpactEvidence({
        world,
        fit: currentFit,
        situation: currentSituation,
        horizonSeconds
      });
      const dossier = buildA1SpatialCommitmentRightOfWayEvidenceDossier({
        review,
        impact
      });

      const h1 = jointFutureSet.futures.find(
        (future) => future.futureFamily === "OWNER_REQUEST_CONTINUATION"
      );
      const h2 = jointFutureSet.futures.find(
        (future) => future.futureFamily === "BODY_RESPONSE_CONTINUATION"
      );
      const h2PlayerFuture = playerFutureSet.futures.find(
        (future) => future.futureFamily === "BODY_RESPONSE_CONTINUATION"
      );

      expect(h1?.status).toBe("REHEARSED");
      expect(h2?.status).toBe("REHEARSED");
      expect(h2PlayerFuture?.interventionStatus).toBe("REHEARSABLE");
      if (!h1 || h1.status !== "REHEARSED") throw new Error("missing rehearsed H1");
      if (!h2 || h2.status !== "REHEARSED") throw new Error("missing rehearsed H2");
      if (!h2PlayerFuture || h2PlayerFuture.interventionStatus !== "REHEARSABLE") {
        throw new Error("missing rehearsable H2 player future");
      }

      expect(h2PlayerFuture.occupancy.status).toBe("SAMPLED_PLAYER_FUTURE_OVERLAP");
      expect(h1.contactFrameCount).toBe(0);
      expect(h2.contactFrameCount).toBe(0);
      expect(jointFutureSet.noContactRehearsedFutureIds).toContain(h1.futureId);
      expect(jointFutureSet.noContactRehearsedFutureIds).toContain(h2.futureId);
      expect(jointFutureSet.contactFutureIds).not.toContain(h2.futureId);
      expect(review.playerFutureOverlapIds).toContain(h2.futureId);
      expect(review.jointNoContactRehearsedFutureIds).toContain(h2.futureId);

      expect(dossier.ownerRequestFutureId).toBe(h1.futureId);
      expect(dossier.ownerRequestJointContactFrameCount).toBe(0);
      expect(dossier.commitmentExecutionContactFrameCount).toBe(0);
      expect(dossier.sourceReview.jointNoContactRehearsedFutureIds).toContain(h2.futureId);
      expect(dossier.sourceReview.jointContactFutureIds).not.toContain(h2.futureId);
      expect(dossier.noContactSafetyClaim).toBe(
        "NONE_NO_OBSERVED_CONTACT_OR_DISTURBANCE_DOES_NOT_ESTABLISH_GENERAL_SAFETY"
      );
      expect(dossier.futureWeightingClaim).toBe("NONE");
      expect(dossier.rightOfWayPriorityClaim).toBe("NONE");
      expect(dossier.yieldPolicyClaim).toBe("NONE");
      expect(dossier.runtimeAuthorityClaim).toBe("NONE");

      console.info(`[A1_NO_CONTACT_CROSS_FUTURE_FALSIFIER] ${JSON.stringify({
        sourceTick: dossier.sourceTick,
        horizonSeconds: dossier.horizonSeconds,
        ownerRequestFutureId: dossier.ownerRequestFutureId,
        ownerRequestContactFrames: h1.contactFrameCount,
        alternateFutureId: h2.futureId,
        alternateFutureFamily: h2.futureFamily,
        alternateAnchorOccupancyStatus: h2PlayerFuture.occupancy.status,
        alternateContactFrames: h2.contactFrameCount,
        jointContactFutureIds: jointFutureSet.contactFutureIds,
        jointNoContactRehearsedFutureIds: jointFutureSet.noContactRehearsedFutureIds,
        noContactSafetyClaim: dossier.noContactSafetyClaim,
        futureWeightingClaim: dossier.futureWeightingClaim,
        rightOfWayPriorityClaim: dossier.rightOfWayPriorityClaim,
        yieldPolicyClaim: dossier.yieldPolicyClaim,
        runtimeAuthorityClaim: dossier.runtimeAuthorityClaim,
        interpretation:
          "The BODY_RESPONSE future overlaps the sampled commitment anchor yet its same-physics joint rehearsal still produces zero reciprocal contact. Sampled anchor occupancy is therefore not a proxy for physical joint contact. No-contact remains future-scoped evidence and establishes no general safety, priority, yield or runtime authority."
      })}`);
    } finally {
      world.dispose();
    }
  });
});
