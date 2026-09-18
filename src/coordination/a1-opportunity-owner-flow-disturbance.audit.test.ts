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
    anchorProvenance: "OWNER_FLOW_DISTURBANCE_AUDIT",
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
    reason: "owner-flow disturbance audit fixture"
  };
}

describe("A1 commitment Owner-flow stepwise disturbance evidence", () => {
  it("preserves when and how commitment execution disturbs Owner flow instead of only terminal/net summaries", async () => {
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
        fit: fit(snapshot, { x: 5.5, y: 4 }),
        situation,
        horizonSeconds: 0.75
      });

      expect(evidence.frames).toHaveLength(45);
      expect(evidence.executionOnlyContactFrameCount).toBeGreaterThan(0);
      expect(evidence.holdOnlyContactFrameCount).toBe(0);
      expect(evidence.bothContactFrameCount).toBe(0);
      expect(evidence.firstExecutionOnlyContactStepIndex).not.toBeNull();
      expect(evidence.lastExecutionOnlyContactStepIndex).not.toBeNull();
      expect(evidence.netContactFrameCountDeltaVsHold).toBe(
        evidence.commitmentExecutionContactFrameCount - evidence.holdBaselineContactFrameCount
      );
      expect(evidence.peakPlayerProgressDeficitVsHold).not.toBeNull();
      expect(evidence.peakPlayerProgressDeficitVsHold!).toBeGreaterThan(0.5);
      expect(evidence.integratedPlayerProgressDeficitSeconds).not.toBeNull();
      expect(evidence.integratedPlayerProgressDeficitSeconds!).toBeGreaterThan(0);
      expect(evidence.peakPlayerLateralDeltaMagnitudeVsHold).toBeLessThan(1e-6);
      expect(evidence.legacyAddedContactFieldClaim).toBe(
        "ADDED_CONTACT_FRAME_COUNT_VS_HOLD_IS_NET_COUNT_DELTA_ONLY"
      );
      expect(evidence.transientImpactClaim).toBe(
        "PEAK_AND_INTEGRATED_DEVIATIONS_ARE_MEASURED_DIFFERENCES_NOT_HARM"
      );
      expect(evidence.harmClaim).toBe("NONE_MEASURED_DIFFERENCE_ONLY");
      expect(evidence.rightOfWayPriorityClaim).toBe("NONE");
      expect(evidence.yieldPolicyClaim).toBe("NONE");

      console.info(`[A1_COMMITMENT_OWNER_FLOW_DISTURBANCE_TRACE] ${JSON.stringify({
        sourceTick: evidence.sourceTick,
        horizonSeconds: evidence.horizonSeconds,
        worldStepSeconds: evidence.worldStepSeconds,
        netContactFrameCountDeltaVsHold: evidence.netContactFrameCountDeltaVsHold,
        executionOnlyContactFrameCount: evidence.executionOnlyContactFrameCount,
        holdOnlyContactFrameCount: evidence.holdOnlyContactFrameCount,
        bothContactFrameCount: evidence.bothContactFrameCount,
        firstExecutionOnlyContactStepIndex: evidence.firstExecutionOnlyContactStepIndex,
        lastExecutionOnlyContactStepIndex: evidence.lastExecutionOnlyContactStepIndex,
        peakPlayerProgressDeficitVsHold: evidence.peakPlayerProgressDeficitVsHold,
        terminalPlayerProgressDeficitVsHold: evidence.terminalPlayerProgressDeficitVsHold,
        integratedPlayerProgressDeficitSeconds: evidence.integratedPlayerProgressDeficitSeconds,
        peakPlayerLateralDeltaMagnitudeVsHold: evidence.peakPlayerLateralDeltaMagnitudeVsHold,
        terminalPlayerLateralDeltaMagnitudeVsHold: evidence.terminalPlayerLateralDeltaMagnitudeVsHold,
        integratedPlayerLateralDeviationSeconds: evidence.integratedPlayerLateralDeviationSeconds,
        harmClaim: evidence.harmClaim,
        rightOfWayPriorityClaim: evidence.rightOfWayPriorityClaim,
        yieldPolicyClaim: evidence.yieldPolicyClaim,
        interpretation: "Stepwise HOLD-vs-execution comparison preserves onset/duration and transient Owner-flow deviation. These are measured causal differences under explicit counterfactuals, not a harm threshold, HOLD preference, right-of-way priority or yield policy."
      })}`);
    } finally {
      world.dispose();
    }
  });

  it("keeps remote contact-free execution at zero differential disturbance", async () => {
    const world = await LabWorld.create("open");
    try {
      const after = world.step([playerIntent(1, 0), companionHold()]);
      const player = after.actors.find((value) => value.id === "player");
      if (!player) throw new Error("missing player");
      const situation = buildA1Situation({
        snapshot: after,
        playerIntent: playerIntent(-1, 1),
        playerCapability: world.actorMovementCapability("player"),
        companionCapability: world.actorMovementCapability("companion"),
        previousWorldStep: world.latestAuthorityA0StepEvidence()
      });
      const evidence = buildA1SpatialCommitmentOwnerFlowImpactEvidence({
        world,
        fit: fit(after, {
          x: player.position.x - 0.604891167664243,
          y: player.position.y + 1.339625322141366
        }),
        situation,
        horizonSeconds: 0.5
      });

      expect(evidence.executionOnlyContactFrameCount).toBe(0);
      expect(evidence.holdOnlyContactFrameCount).toBe(0);
      expect(evidence.netContactFrameCountDeltaVsHold).toBe(0);
      expect(evidence.peakPlayerProgressDeficitVsHold).toBeCloseTo(0, 9);
      expect(evidence.terminalPlayerProgressDeficitVsHold).toBeCloseTo(0, 9);
      expect(evidence.integratedPlayerProgressDeficitSeconds).toBeCloseTo(0, 9);
      expect(evidence.peakPlayerLateralDeltaMagnitudeVsHold).toBeCloseTo(0, 9);
      expect(evidence.integratedPlayerLateralDeviationSeconds).toBeCloseTo(0, 9);
      expect(evidence.yieldPolicyClaim).toBe("NONE");
    } finally {
      world.dispose();
    }
  });
});
