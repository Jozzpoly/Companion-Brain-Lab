import { describe, expect, it } from "vitest";
import { buildA1Situation } from "./a1-situation";
import type { A1SpatialCommitmentFitEvidence } from "./a1-spatial-commitment-evidence";
import { buildA1SpatialCommitmentOwnerFlowImpactEvidence } from "./a1-spatial-commitment-owner-flow-impact";
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
    anchorProvenance: "OWNER_FLOW_IMPACT_AUDIT",
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
    reason: "owner-flow impact audit fixture"
  };
}

describe("A1 commitment execution impact on Owner-request flow", () => {
  it("shows execution-added contact and lost forward progress relative to companion HOLD in head-on convergence", async () => {
    const world = await LabWorld.create("head-on");
    try {
      const snapshot = world.snapshot();
      const currentFit = fit(snapshot, { x: 5.5, y: 4 });
      const situation = buildA1Situation({
        snapshot,
        playerIntent: playerIntent(1, 0),
        playerCapability: world.actorMovementCapability("player"),
        companionCapability: world.actorMovementCapability("companion"),
        previousWorldStep: null
      });
      const evidence = buildA1SpatialCommitmentOwnerFlowImpactEvidence({
        world,
        fit: currentFit,
        situation,
        horizonSeconds: 0.75
      });

      expect(evidence.holdBaselineContactFrameCount).toBe(0);
      expect(evidence.commitmentExecutionContactFrameCount).toBeGreaterThan(0);
      expect(evidence.addedContactFrameCountVsHold).toBeGreaterThan(0);
      expect(evidence.playerProgressDeltaVsHold).toBeLessThan(-0.5);
      expect(evidence.playerLateralDeltaMagnitudeVsHold).toBeLessThan(1e-6);
      expect(evidence.harmClaim).toBe("NONE_MEASURED_DIFFERENCE_ONLY");
      expect(evidence.rightOfWayPriorityClaim).toBe("NONE");
      expect(evidence.yieldPolicyClaim).toBe("NONE");

      console.info(`[A1_COMMITMENT_OWNER_FLOW_IMPACT_HEAD_ON] ${JSON.stringify({
        sourceTick: evidence.sourceTick,
        horizonSeconds: evidence.horizonSeconds,
        holdBaselineContactFrameCount: evidence.holdBaselineContactFrameCount,
        commitmentExecutionContactFrameCount: evidence.commitmentExecutionContactFrameCount,
        addedContactFrameCountVsHold: evidence.addedContactFrameCountVsHold,
        holdBaselineFinalPlayerPosition: evidence.holdBaselineFinalPlayerPosition,
        commitmentExecutionFinalPlayerPosition: evidence.commitmentExecutionFinalPlayerPosition,
        playerProgressDeltaVsHold: evidence.playerProgressDeltaVsHold,
        playerLateralDeltaMagnitudeVsHold: evidence.playerLateralDeltaMagnitudeVsHold,
        harmClaim: evidence.harmClaim,
        rightOfWayPriorityClaim: evidence.rightOfWayPriorityClaim,
        yieldPolicyClaim: evidence.yieldPolicyClaim,
        interpretation: "Under the same Owner-request future, executing the commitment introduces reciprocal contacts absent from companion HOLD and reduces the player's terminal progress. This is execution-caused player-flow difference evidence, not yet a harm threshold, right-of-way priority or yield decision."
      })}`);
    } finally {
      world.dispose();
    }
  });

  it("falsifies contact-free commitment motion as automatic player-flow impact when companion stays remote", async () => {
    const world = await LabWorld.create("open");
    try {
      const after = world.step([playerIntent(1, 0), companionHold()]);
      const player = after.actors.find((value) => value.id === "player");
      if (!player) throw new Error("missing player");
      const currentFit = fit(after, {
        x: player.position.x - 0.604891167664243,
        y: player.position.y + 1.339625322141366
      });
      const situation = buildA1Situation({
        snapshot: after,
        playerIntent: playerIntent(-1, 1),
        playerCapability: world.actorMovementCapability("player"),
        companionCapability: world.actorMovementCapability("companion"),
        previousWorldStep: world.latestAuthorityA0StepEvidence()
      });
      const evidence = buildA1SpatialCommitmentOwnerFlowImpactEvidence({
        world,
        fit: currentFit,
        situation,
        horizonSeconds: 0.5
      });

      expect(evidence.holdBaselineContactFrameCount).toBe(0);
      expect(evidence.commitmentExecutionContactFrameCount).toBe(0);
      expect(evidence.addedContactFrameCountVsHold).toBe(0);
      expect(evidence.playerProgressDeltaVsHold).toBeCloseTo(0, 9);
      expect(evidence.playerLateralDeltaMagnitudeVsHold).toBeCloseTo(0, 9);
      expect(evidence.yieldPolicyClaim).toBe("NONE");
    } finally {
      world.dispose();
    }
  });
});
