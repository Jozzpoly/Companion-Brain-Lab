import { describe, expect, it } from "vitest";
import { buildA1Situation } from "./a1-situation";
import type { A1SpatialCommitmentFitEvidence } from "./a1-spatial-commitment-evidence";
import { buildA1SpatialCommitmentFixedCommandOwnerFlowImpactScan } from "./a1-spatial-commitment-fixed-command-owner-flow-impact-scan";
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
    anchorProvenance: "FIXED_COMMAND_OWNER_FLOW_SCAN_AUDIT",
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
    reason: "fixed-command Owner-flow scan audit fixture"
  };
}

describe("A1 fixed-command Owner-flow impact observation scan", () => {
  it("reveals interference onset over time without changing the executable commitment command", async () => {
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
      const scan = buildA1SpatialCommitmentFixedCommandOwnerFlowImpactScan({
        world,
        fit: fit(snapshot, { x: 5.5, y: 4 }),
        situation,
        commandArrivalHypothesisSeconds: 0.75,
        observationHorizons: [0.25, 0.5, 0.75, 1]
      });

      expect(scan.rows).toHaveLength(4);
      for (const row of scan.rows) {
        expect(row.fixedCompanionCommandVelocity).toEqual(
          scan.fixedCompanionCommandVelocity
        );
        expect(row.impact.companionCommitmentCommandVelocity).toEqual(
          scan.fixedCompanionCommandVelocity
        );
        expect(row.impact.harmClaim).toBe("NONE_MEASURED_DIFFERENCE_ONLY");
        expect(row.impact.rightOfWayPriorityClaim).toBe("NONE");
        expect(row.impact.yieldPolicyClaim).toBe("NONE");
      }

      const short = scan.rows[0]!;
      const crossing = scan.rows[1]!;
      const sourceHorizon = scan.rows[2]!;
      expect(short.observationHorizonSeconds).toBe(0.25);
      expect(short.impact.executionOnlyContactFrameCount).toBe(0);
      expect(short.impact.peakPlayerProgressDeficitVsHold).toBeCloseTo(0, 9);
      expect(crossing.observationHorizonSeconds).toBe(0.5);
      expect(crossing.impact.executionOnlyContactFrameCount).toBeGreaterThan(0);
      expect(crossing.impact.peakPlayerProgressDeficitVsHold).toBeGreaterThan(0);
      expect(sourceHorizon.impact.executionOnlyContactFrameCount).toBeGreaterThan(
        crossing.impact.executionOnlyContactFrameCount
      );
      expect(sourceHorizon.impact.peakPlayerProgressDeficitVsHold).toBeGreaterThan(
        crossing.impact.peakPlayerProgressDeficitVsHold!
      );

      expect(scan.commandAcrossRowsClaim).toBe(
        "EXACTLY_FIXED_EXECUTABLE_VELOCITY"
      );
      expect(scan.observationAxisClaim).toBe(
        "ONLY_REHEARSAL_DURATION_CHANGES_ACROSS_ROWS"
      );
      expect(scan.holdComparatorClaim).toBe(
        "SAME_OWNER_FUTURE_COMPANION_HOLD_PER_ROW_NOT_POLICY"
      );
      expect(scan.horizonPolicyClaim).toBe("NONE_SCAN_ONLY");
      expect(scan.yieldPolicyClaim).toBe("NONE");

      console.info(`[A1_COMMITMENT_FIXED_COMMAND_OWNER_FLOW_SCAN] ${JSON.stringify({
        sourceTick: scan.sourceTick,
        commandArrivalHypothesisSeconds: scan.commandArrivalHypothesisSeconds,
        fixedCompanionCommandVelocity: scan.fixedCompanionCommandVelocity,
        rows: scan.rows.map((row) => ({
          observationHorizonSeconds: row.observationHorizonSeconds,
          executionOnlyContactFrameCount: row.impact.executionOnlyContactFrameCount,
          firstExecutionOnlyContactStepIndex: row.impact.firstExecutionOnlyContactStepIndex,
          peakPlayerProgressDeficitVsHold: row.impact.peakPlayerProgressDeficitVsHold,
          terminalPlayerProgressDeficitVsHold: row.impact.terminalPlayerProgressDeficitVsHold,
          integratedPlayerProgressDeficitSeconds: row.impact.integratedPlayerProgressDeficitSeconds
        })),
        commandAcrossRowsClaim: scan.commandAcrossRowsClaim,
        observationAxisClaim: scan.observationAxisClaim,
        holdComparatorClaim: scan.holdComparatorClaim,
        impactClaim: scan.impactClaim,
        horizonPolicyClaim: scan.horizonPolicyClaim,
        rightOfWayPriorityClaim: scan.rightOfWayPriorityClaim,
        yieldPolicyClaim: scan.yieldPolicyClaim,
        interpretation: "With one executable commitment command held fixed, extending only the same-physics observation window reveals when Owner-flow interference begins and accumulates. The scan establishes temporal evidence, not a preferred horizon, harm threshold, HOLD preference, right-of-way priority or yield policy."
      })}`);
    } finally {
      world.dispose();
    }
  });
});
