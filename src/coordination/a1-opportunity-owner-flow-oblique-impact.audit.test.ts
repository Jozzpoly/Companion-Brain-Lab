import { describe, expect, it } from "vitest";
import { buildA1Situation } from "./a1-situation";
import type { A1SpatialCommitmentFitEvidence } from "./a1-spatial-commitment-evidence";
import { buildA1SpatialCommitmentOwnerFlowImpactEvidence } from "./a1-spatial-commitment-owner-flow-impact";
import { LabWorld } from "../world/world";
import type { MotionIntent, Vec2, WorldSnapshot } from "../world/types";

function playerIntent(x: number, y: number): MotionIntent {
  return { actorId: "player", move: { x, y } };
}

function fit(snapshot: WorldSnapshot, anchor: Vec2): A1SpatialCommitmentFitEvidence {
  return {
    kind: "A1_SPATIAL_COMMITMENT_FIT",
    sourceTick: snapshot.tick,
    commitmentSourceTick: 0,
    referenceFrame: "WORLD_FIXED",
    anchorProvenance: "OWNER_FLOW_VECTOR_IMPACT_FALSIFIER",
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
    reason: "Owner-flow vector-impact falsifier fixture"
  };
}

describe("A1 commitment Owner-flow impact is not a one-dimensional contact scalar", () => {
  it("preserves lateral disturbance from an oblique commitment collision instead of hiding it in forward progress", async () => {
    const world = await LabWorld.create("head-on");
    try {
      const snapshot = world.snapshot();
      const situation = buildA1Situation({
        snapshot,
        playerIntent: playerIntent(1, 0),
        playerCapability: world.actorMovementCapability("player"),
        companionCapability: world.actorMovementCapability("companion"),
        previousWorldStep: null
      });
      const evidence = buildA1SpatialCommitmentOwnerFlowImpactEvidence({
        world,
        fit: fit(snapshot, { x: 5.5, y: 4.5 }),
        situation,
        horizonSeconds: 0.75
      });

      expect(evidence.executionOnlyContactFrameCount).toBeGreaterThan(0);
      expect(evidence.peakPlayerLateralDeltaMagnitudeVsHold).not.toBeNull();
      expect(evidence.peakPlayerLateralDeltaMagnitudeVsHold!).toBeGreaterThan(0.02);
      expect(evidence.integratedPlayerLateralDeviationSeconds).not.toBeNull();
      expect(evidence.integratedPlayerLateralDeviationSeconds!).toBeGreaterThan(0);
      expect(evidence.peakPlayerProgressDeficitVsHold).not.toBeNull();
      expect(evidence.harmClaim).toBe("NONE_MEASURED_DIFFERENCE_ONLY");
      expect(evidence.rightOfWayPriorityClaim).toBe("NONE");
      expect(evidence.yieldPolicyClaim).toBe("NONE");

      console.info(`[A1_COMMITMENT_OWNER_FLOW_OBLIQUE_IMPACT] ${JSON.stringify({
        sourceTick: evidence.sourceTick,
        horizonSeconds: evidence.horizonSeconds,
        companionCommitmentCommandVelocity: evidence.companionCommitmentCommandVelocity,
        executionOnlyContactFrameCount: evidence.executionOnlyContactFrameCount,
        firstExecutionOnlyContactStepIndex: evidence.firstExecutionOnlyContactStepIndex,
        peakPlayerProgressDeficitVsHold: evidence.peakPlayerProgressDeficitVsHold,
        terminalPlayerProgressDeficitVsHold: evidence.terminalPlayerProgressDeficitVsHold,
        integratedPlayerProgressDeficitSeconds: evidence.integratedPlayerProgressDeficitSeconds,
        peakPlayerLateralDeltaMagnitudeVsHold: evidence.peakPlayerLateralDeltaMagnitudeVsHold,
        terminalPlayerLateralDeltaMagnitudeVsHold: evidence.terminalPlayerLateralDeltaMagnitudeVsHold,
        integratedPlayerLateralDeviationSeconds: evidence.integratedPlayerLateralDeviationSeconds,
        harmClaim: evidence.harmClaim,
        rightOfWayPriorityClaim: evidence.rightOfWayPriorityClaim,
        yieldPolicyClaim: evidence.yieldPolicyClaim,
        interpretation: "An oblique same-physics commitment collision perturbs Owner flow laterally as well as longitudinally. Contact therefore cannot be collapsed into a single forward-progress or contact-count harm scalar without an explicit future policy."
      })}`);
    } finally {
      world.dispose();
    }
  });
});
