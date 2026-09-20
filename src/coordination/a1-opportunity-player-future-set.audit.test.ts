import { describe, expect, it } from "vitest";
import { buildA1PlayerFutureHypotheses } from "./a1-player-future-hypotheses";
import { buildA1PlayerFutureInterventionPlan } from "./a1-player-future-interventions";
import { buildA1Situation } from "./a1-situation";
import type { A1SpatialCommitmentFitEvidence } from "./a1-spatial-commitment-evidence";
import { buildA1SpatialCommitmentPlayerFutureSetEvidence } from "./a1-spatial-commitment-player-future-set";
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
    anchorProvenance: "PLAYER_FUTURE_SET_AUDIT",
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
    reason: "player future set audit fixture"
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

describe("A1 complete player-future set commitment evidence", () => {
  it("preserves a causal-unresolved H2 instead of silently omitting it from commitment review substrate", async () => {
    const world = await LabWorld.create("open");
    try {
      const before = world.snapshot();
      const currentFit = fit(before, { x: 4, y: 4 });
      const currentPlan = plan(world, before, playerIntent(1, 0), 0.5);
      const evidence = buildA1SpatialCommitmentPlayerFutureSetEvidence({
        world,
        fit: currentFit,
        snapshot: before,
        plan: currentPlan
      });

      expect(currentPlan.futureCount).toBe(2);
      expect(currentPlan.rehearsableCount).toBe(1);
      expect(currentPlan.unresolvedCount).toBe(1);
      expect(evidence.futureCount).toBe(2);
      expect(evidence.rehearsedCount).toBe(1);
      expect(evidence.causalUnresolvedCount).toBe(1);

      const h1 = evidence.futures.find(
        (value) => value.futureFamily === "OWNER_REQUEST_CONTINUATION"
      );
      const h2 = evidence.futures.find(
        (value) => value.futureFamily === "BODY_RESPONSE_CONTINUATION"
      );
      expect(h1?.interventionStatus).toBe("REHEARSABLE");
      if (!h1 || h1.interventionStatus !== "REHEARSABLE") throw new Error("missing rehearsed H1");
      expect(h1.occupancy).not.toBeNull();

      expect(h2?.interventionStatus).toBe("UNRESOLVED");
      if (!h2 || h2.interventionStatus !== "UNRESOLVED") throw new Error("missing unresolved H2");
      expect(h2.unresolvedReason).toBe("H2_STATIONARY_IS_OBSERVATION_NOT_QUALIFIED_CONTROL");
      expect(h2.occupancy).toBeNull();

      expect(evidence.aggregationClaim).toBe("NONE_PRESERVE_DISTINCT_PLAYER_FUTURES");
      expect(evidence.probabilityClaim).toBe("NONE_COUNTERFACTUAL_SET_NOT_FORECAST_DISTRIBUTION");
      expect(evidence.selectionClaim).toBe("NONE");
      expect(evidence.fallbackSubstitutionClaim).toBe("NONE_UNRESOLVED_FUTURES_REMAIN_EXPLICIT");
      expect(evidence.runtimeAuthorityClaim).toBe("NONE");

      console.info(`[A1_COMMITMENT_PLAYER_FUTURE_SET_UNRESOLVED] ${JSON.stringify({
        sourceTick: evidence.sourceTick,
        horizonSeconds: evidence.horizonSeconds,
        futureCount: evidence.futureCount,
        rehearsedCount: evidence.rehearsedCount,
        causalUnresolvedCount: evidence.causalUnresolvedCount,
        futures: evidence.futures.map((value) => ({
          futureId: value.futureId,
          futureFamily: value.futureFamily,
          interventionStatus: value.interventionStatus,
          causalMeaning: value.causalMeaning,
          unresolvedReason: value.unresolvedReason,
          occupancyStatus: value.occupancy?.status ?? null
        })),
        interpretation: "Commitment future evidence preserves the complete causal intervention plan. A stationary H2 remains explicitly unresolved and is not silently dropped or replaced by H1."
      })}`);
    } finally {
      world.dispose();
    }
  });
});
