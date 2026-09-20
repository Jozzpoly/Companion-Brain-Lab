import { describe, expect, it } from "vitest";
import type { A1SpatialCommitmentFitEvidence } from "./a1-spatial-commitment-evidence";
import { buildA1SpatialCommitmentDeliberationHorizonScan } from "./a1-spatial-commitment-deliberation-horizon-scan";
import { buildA1Situation } from "./a1-situation";
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
    anchorProvenance: "DELIBERATION_HORIZON_AUDIT",
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
    reason: "deliberation horizon audit fixture"
  };
}

describe("A1 commitment deliberation horizon sensitivity", () => {
  it("shows that Owner anchor overlap can precede joint interference and refuses to turn one horizon into policy", async () => {
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
      const scan = buildA1SpatialCommitmentDeliberationHorizonScan({
        world,
        fit: currentFit,
        situation,
        horizons: [0.25, 0.5, 0.75]
      });

      const h025 = scan.rows.find((row) => row.horizonSeconds === 0.25);
      const h05 = scan.rows.find((row) => row.horizonSeconds === 0.5);
      const h075 = scan.rows.find((row) => row.horizonSeconds === 0.75);
      if (!h025 || !h05 || !h075) throw new Error("missing horizon rows");

      expect(h025.ownerRequestAnchorOverlap).toBe(true);
      expect(h025.ownerRequestJointContact).toBe(false);
      expect(h025.yieldReasonPresent).toBe(false);
      expect(h025.directCapabilityClipped).toBe(true);
      expect(h025.directTerminalAnchorError).toBeGreaterThan(1);

      expect(h05.ownerRequestAnchorOverlap).toBe(true);
      expect(h05.ownerRequestJointContact).toBe(true);
      expect(h05.yieldReasonPresent).toBe(true);
      expect(h05.directCapabilityClipped).toBe(true);

      expect(h075.ownerRequestAnchorOverlap).toBe(true);
      expect(h075.ownerRequestJointContact).toBe(true);
      expect(h075.yieldReasonPresent).toBe(true);
      expect(h075.directCapabilityClipped).toBe(false);
      expect(h075.directTerminalAnchorError).toBeLessThan(1e-9);

      expect(scan.horizonMeaning).toBe(
        "EXECUTION_ARRIVAL_HYPOTHESIS_AND_REHEARSAL_DURATION"
      );
      expect(scan.horizonPolicyClaim).toBe("NONE_SCAN_ONLY");
      expect(scan.crossHorizonAggregationClaim).toBe("NONE");
      expect(scan.preferredHorizonClaim).toBe("NONE");
      expect(scan.selectionClaim).toBe("NONE");
      expect(scan.runtimeAuthorityClaim).toBe("NONE");

      console.info(`[A1_COMMITMENT_DELIBERATION_HORIZON_SENSITIVITY] ${JSON.stringify({
        sourceTick: scan.sourceTick,
        rows: scan.rows.map((row) => ({
          horizonSeconds: row.horizonSeconds,
          ownerRequestAnchorOverlap: row.ownerRequestAnchorOverlap,
          ownerRequestJointContact: row.ownerRequestJointContact,
          yieldReasonPresent: row.yieldReasonPresent,
          directCapabilityClipped: row.directCapabilityClipped,
          directTerminalAnchorError: row.directTerminalAnchorError,
          directCommandVelocity: row.directCommandVelocity
        })),
        horizonMeaning: scan.horizonMeaning,
        horizonPolicyClaim: scan.horizonPolicyClaim,
        preferredHorizonClaim: scan.preferredHorizonClaim,
        interpretation: "The same exact commitment and Owner request can show anchor occupancy before spatiotemporal joint contact. Longer rows are also different arrival-speed hypotheses, not merely longer observation windows; the scan therefore establishes horizon sensitivity without choosing a horizon or yielding policy."
      })}`);
    } finally {
      world.dispose();
    }
  });
});
