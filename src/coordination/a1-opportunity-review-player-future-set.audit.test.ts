import { describe, expect, it } from "vitest";
import { buildA1PlayerFutureHypotheses } from "./a1-player-future-hypotheses";
import { buildA1PlayerFutureInterventionPlan } from "./a1-player-future-interventions";
import { buildA1Situation } from "./a1-situation";
import type { A1SpatialCommitmentFitEvidence } from "./a1-spatial-commitment-evidence";
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
    anchorProvenance: "PLAYER_FUTURE_REVIEW_AUDIT",
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
    commitmentOrientationRegime: "DIRECTIONLESS",
    currentOrientationRegime: "DIRECTIONLESS",
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
    reason: "player future review audit fixture"
  };
}

function plan(
  world: LabWorld,
  snapshot: WorldSnapshot,
  intent: MotionIntent,
  horizonSeconds: number
) {
  const situation = buildA1Situation({
    snapshot,
    playerIntent: intent,
    playerCapability: world.actorMovementCapability("player"),
    companionCapability: world.actorMovementCapability("companion"),
    previousWorldStep: snapshot.tick === 0
      ? null
      : world.latestAuthorityA0StepEvidence()
  });
  const futures = buildA1PlayerFutureHypotheses({
    situation,
    horizonSeconds,
    staticTraversal: (from, to, radius, options) =>
      world.staticCircleTraversal(from, to, radius, options)
  });
  return buildA1PlayerFutureInterventionPlan(futures);
}

describe("A1 commitment review preserves complete player-future disagreement", () => {
  it("keeps causal-unresolved future separate from rehearsed overlap evidence", async () => {
    const world = await LabWorld.create("open");
    try {
      const before = world.snapshot();
      const currentFit = fit(before, { x: 4, y: 4 });
      const futureSet = buildA1SpatialCommitmentPlayerFutureSetEvidence({
        world,
        fit: currentFit,
        snapshot: before,
        plan: plan(world, before, playerIntent(1, 0), 0.5)
      });
      const review = buildA1SpatialCommitmentReviewEvidence(
        currentFit,
        null,
        null,
        futureSet
      );

      expect(review.playerFutureSetStatus).toBe("PRESERVED_DISTINCT_COUNTERFACTUALS");
      expect(review.playerFutureOverlapIds).toEqual(["owner-request-continuation"]);
      expect(review.playerFutureSampledClearIds).toEqual([]);
      expect(review.playerFutureReferenceUnresolvedIds).toEqual([]);
      expect(review.playerFutureCausalUnresolvedIds).toEqual([
        "body-response-continuation"
      ]);
      expect(review.playerFutureAggregationClaim).toBe("NONE");
      expect(review.playerFutureProbabilityClaim).toBe("NONE");
      expect(review.playerFutureBooleanCollapseClaim).toBe("NONE");
      expect(review.decisionClaim).toBe("NONE_EVIDENCE_ONLY");
    } finally {
      world.dispose();
    }
  });

  it("preserves reversal disagreement instead of collapsing futures into one conflict boolean", async () => {
    const world = await LabWorld.create("open");
    try {
      const after = world.step([playerIntent(1, 0), companionHold()]);
      const player = after.actors.find((value) => value.id === "player");
      if (!player) throw new Error("missing player");
      const currentFit = fit(after, {
        x: player.position.x + 0.8,
        y: player.position.y
      });
      const futureSet = buildA1SpatialCommitmentPlayerFutureSetEvidence({
        world,
        fit: currentFit,
        snapshot: after,
        plan: plan(world, after, playerIntent(-1, 0), 0.5)
      });
      const review = buildA1SpatialCommitmentReviewEvidence(
        currentFit,
        null,
        null,
        futureSet
      );

      expect(review.playerFutureOverlapIds).toEqual([
        "body-response-continuation"
      ]);
      expect(review.playerFutureSampledClearIds).toEqual([
        "owner-request-continuation",
        "transition-hold"
      ]);
      expect(review.playerFutureReferenceUnresolvedIds).toEqual([]);
      expect(review.playerFutureCausalUnresolvedIds).toEqual([]);
      expect(review.playerFutureBooleanCollapseClaim).toBe("NONE");
      expect(review.selectionClaim).toBe("NONE");
      expect(review.scalarScoreClaim).toBe("NONE");
      expect(review.runtimeAuthorityClaim).toBe("NONE");

      console.info(`[A1_SPATIAL_COMMITMENT_REVIEW_PLAYER_FUTURE_SET] ${JSON.stringify({
        sourceTick: review.sourceTick,
        horizonSeconds: review.playerFutureHorizonSeconds,
        overlapFutureIds: review.playerFutureOverlapIds,
        sampledClearFutureIds: review.playerFutureSampledClearIds,
        referenceUnresolvedFutureIds: review.playerFutureReferenceUnresolvedIds,
        causalUnresolvedFutureIds: review.playerFutureCausalUnresolvedIds,
        aggregationClaim: review.playerFutureAggregationClaim,
        probabilityClaim: review.playerFutureProbabilityClaim,
        booleanCollapseClaim: review.playerFutureBooleanCollapseClaim,
        decisionClaim: review.decisionClaim,
        selectionClaim: review.selectionClaim,
        runtimeAuthorityClaim: review.runtimeAuthorityClaim,
        interpretation: "Commitment review preserves the full counterfactual disagreement. H2 overlaps while H1/H3 are sampled-clear, but review emits no aggregate future-conflict boolean, probability, winner, score or runtime decision."
      })}`);
    } finally {
      world.dispose();
    }
  });
});
