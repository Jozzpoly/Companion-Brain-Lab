import { describe, expect, it } from "vitest";
import { buildA1Situation } from "./a1-situation";
import type { A1SpatialCommitmentFitEvidence } from "./a1-spatial-commitment-evidence";
import { buildA1SpatialCommitmentFixedCommandObservationScan } from "./a1-spatial-commitment-fixed-command-observation-scan";
import { LabWorld } from "../world/world";
import type { MotionIntent, Vec2, WorldSnapshot } from "../world/types";

function playerIntent(x: number, y: number): MotionIntent {
  return { actorId: "player", move: { x, y } };
}

function fit(snapshot: WorldSnapshot, anchor: Vec2): A1SpatialCommitmentFitEvidence {
  return {
    kind: "A1_SPATIAL_COMMITMENT_FIT",
    sourceTick: snapshot.tick,
    commitmentSourceTick: snapshot.tick,
    referenceFrame: "WORLD_FIXED",
    anchorProvenance: "FIXED_COMMAND_OBSERVATION_AUDIT",
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
    reason: "fixed-command observation audit fixture"
  };
}

describe("A1 fixed-command commitment observation horizon", () => {
  it("shows contact onset from longer temporal exposure while companion command velocity stays exactly fixed", async () => {
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
      const scan = buildA1SpatialCommitmentFixedCommandObservationScan({
        world,
        fit: currentFit,
        situation,
        commandArrivalHypothesisSeconds: 0.75,
        observationHorizons: [0.25, 0.5, 0.75]
      });

      expect(scan.commandSourceCapabilityClipped).toBe(false);
      expect(scan.commandSourceTerminalAnchorError).toBeLessThan(1e-9);
      expect(scan.fixedCompanionCommandVelocity.x).toBeCloseTo(-8 / 3, 9);
      expect(scan.fixedCompanionCommandVelocity.y).toBeCloseTo(0, 9);

      const h025 = scan.rows.find((row) => row.observationHorizonSeconds === 0.25);
      const h05 = scan.rows.find((row) => row.observationHorizonSeconds === 0.5);
      const h075 = scan.rows.find((row) => row.observationHorizonSeconds === 0.75);
      if (!h025 || !h05 || !h075) throw new Error("missing fixed-command rows");

      for (const row of scan.rows) {
        expect(row.fixedCompanionCommandVelocity.x)
          .toBeCloseTo(scan.fixedCompanionCommandVelocity.x, 12);
        expect(row.fixedCompanionCommandVelocity.y)
          .toBeCloseTo(scan.fixedCompanionCommandVelocity.y, 12);
      }

      expect(h025.contactFrameCount).toBe(0);
      expect(h025.firstContactStepIndex).toBeNull();
      expect(h05.contactFrameCount).toBeGreaterThan(0);
      expect(h05.firstContactStepIndex).not.toBeNull();
      expect(h075.contactFrameCount).toBeGreaterThan(h05.contactFrameCount);
      expect(h075.companionPredictedAnchorError).toBeLessThan(1e-9);

      expect(scan.commandAcrossRowsClaim).toBe("EXACTLY_FIXED_EXECUTABLE_VELOCITY");
      expect(scan.observationAxisClaim).toBe("ONLY_REHEARSAL_DURATION_CHANGES_ACROSS_ROWS");
      expect(scan.horizonPolicyClaim).toBe("NONE_SCAN_ONLY");
      expect(scan.yieldPolicyClaim).toBe("NONE");
      expect(scan.selectionClaim).toBe("NONE");
      expect(scan.runtimeAuthorityClaim).toBe("NONE");

      console.info(`[A1_COMMITMENT_FIXED_COMMAND_OBSERVATION_HORIZON] ${JSON.stringify({
        sourceTick: scan.sourceTick,
        commandArrivalHypothesisSeconds: scan.commandArrivalHypothesisSeconds,
        fixedCompanionCommandVelocity: scan.fixedCompanionCommandVelocity,
        commandSourceCapabilityClipped: scan.commandSourceCapabilityClipped,
        rows: scan.rows,
        observationAxisClaim: scan.observationAxisClaim,
        horizonPolicyClaim: scan.horizonPolicyClaim,
        yieldPolicyClaim: scan.yieldPolicyClaim,
        interpretation: "With companion command velocity held exactly fixed, 0.25 s remains contact-free while 0.5/0.75 s contain reciprocal contact. Contact onset therefore depends on temporal exposure itself, not only on the earlier scan's horizon-dependent direct-to-anchor command generation. This still establishes no preferred horizon or yield policy."
      })}`);
    } finally {
      world.dispose();
    }
  });
});
