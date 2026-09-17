import { describe, expect, it } from "vitest";
import { buildA1PlayerFutureHypotheses } from "./a1-player-future-hypotheses";
import { buildA1PlayerFutureInterventionPlan } from "./a1-player-future-interventions";
import { rehearseA1PlayerFutureIntervention } from "./a1-player-future-rehearsal";
import { buildA1Situation } from "./a1-situation";
import type { A1SpatialCommitmentFitEvidence } from "./a1-spatial-commitment-evidence";
import { buildA1SpatialCommitmentActorOccupancyEvidence } from "./a1-spatial-commitment-actor-occupancy";
import { buildA1SpatialCommitmentMaterialEvidence } from "./a1-spatial-commitment-material";
import { buildA1SpatialCommitmentPlayerFutureOccupancyEvidence } from "./a1-spatial-commitment-player-future-occupancy";
import { LabWorld } from "../world/world";
import type { MotionIntent, Vec2 } from "../world/types";

function playerIntent(x: number, y: number): MotionIntent {
  return { actorId: "player", move: { x, y } };
}

function companionHold(): MotionIntent {
  return { actorId: "companion", move: { x: 0, y: 0 } };
}

function fit(
  tick: number,
  anchor: Vec2 | null
): A1SpatialCommitmentFitEvidence {
  const unresolved = anchor === null;
  return {
    kind: "A1_SPATIAL_COMMITMENT_FIT",
    sourceTick: tick,
    commitmentSourceTick: 0,
    referenceFrame: "WORLD_FIXED",
    anchorProvenance: "PLAYER_FUTURE_OCCUPANCY_AUDIT",
    referenceResolutionStatus: unresolved ? "UNRESOLVED" : "RESOLVED",
    referenceUnresolvedReason: unresolved ? "CURRENT_BASIS_MISSING" : null,
    referenceSourceBasisProvenance: "NOT_REQUIRED",
    referenceSourceBasisSourceTick: null,
    referenceSourceBasisAgeTicksAtCommitment: null,
    referenceBasisProvenance: unresolved ? "UNRESOLVED" : "NOT_REQUIRED",
    referenceBasisSourceTick: null,
    referenceBasisAgeTicks: null,
    resolvedAnchorWorldPosition: anchor ? { ...anchor } : null,
    commitmentObjectiveSignature: "objective",
    currentObjectiveSignature: "objective",
    commitmentOrientationRegime: "DIRECTIONLESS",
    currentOrientationRegime: "DIRECTIONLESS",
    currentSamplingSignature: "sampling",
    semanticStatus: "COMPARABLE",
    coverage: "COMPLETE",
    qualificationStrategy: "STRATIFIED_COVERAGE",
    pressureStatus: unresolved ? "NON_COMPARABLE" : "EXACT_ON_SAMPLED_MESH",
    sampledPressureDistance: unresolved ? null : 0,
    nearestConfirmedSampleId: unresolved ? null : "audit",
    nearestConfirmedWorldPosition: anchor ? { ...anchor } : null,
    nearestConfirmedUtility: unresolved ? null : 1,
    utilityGapFromCurrentBest: unresolved ? null : 0,
    confirmedReachableCount: unresolved ? 0 : 1,
    untestedCount: 0,
    samplingTruth: "SAMPLED_MESH_ONLY",
    reason: "player future occupancy audit fixture"
  };
}

describe("A1 commitment occupancy across separate player futures", () => {
  it("preserves reversal ambiguity: H2 enters the anchor while H1 and H3 remain sampled-clear", async () => {
    const world = await LabWorld.create("open");
    try {
      const after = world.step([playerIntent(1, 0), companionHold()]);
      const currentPlayer = after.find((actor) => actor.id === "player");
      if (!currentPlayer) throw new Error("missing player");
      const anchor = {
        x: currentPlayer.position.x + 0.8,
        y: currentPlayer.position.y
      };
      const currentFit = fit(after.tick, anchor);

      const material = buildA1SpatialCommitmentMaterialEvidence({
        fit: currentFit,
        snapshot: after,
        occupancy: (center, radius) => world.staticCircleOccupancy(center, radius),
        query: (from, to, radius, options) =>
          world.staticCircleTraversal(from, to, radius, options)
      });
      const currentActor = buildA1SpatialCommitmentActorOccupancyEvidence({
        fit: currentFit,
        snapshot: after
      });
      expect(material.status).toBe("STATIC_ROUTE_REACHABLE");
      expect(currentActor.status).toBe("CURRENT_ACTOR_SPACE_CLEAR");

      const situation = buildA1Situation({
        snapshot: after,
        playerIntent: playerIntent(-1, 0),
        playerCapability: world.actorMovementCapability("player"),
        companionCapability: world.actorMovementCapability("companion"),
        previousWorldStep: world.latestAuthorityA0StepEvidence()
      });
      const futures = buildA1PlayerFutureHypotheses({
        situation,
        horizonSeconds: 0.5,
        staticTraversal: (from, to, radius, options) =>
          world.staticCircleTraversal(from, to, radius, options)
      });
      const plan = buildA1PlayerFutureInterventionPlan(futures);

      expect(plan.interventions.map((value) => value.futureFamily)).toEqual([
        "OWNER_REQUEST_CONTINUATION",
        "BODY_RESPONSE_CONTINUATION",
        "TRANSITION_HOLD"
      ]);
      expect(plan.interventions.every((value) => value.status === "REHEARSABLE")).toBe(true);

      const evidence = plan.interventions.map((intervention) => {
        if (intervention.status !== "REHEARSABLE") {
          throw new Error(`unexpected unresolved future ${intervention.futureId}`);
        }
        const rehearsal = rehearseA1PlayerFutureIntervention({ world, intervention });
        return buildA1SpatialCommitmentPlayerFutureOccupancyEvidence({
          fit: currentFit,
          snapshot: after,
          rehearsal
        });
      });
      const byFamily = new Map(evidence.map((value) => [value.futureFamily, value]));

      expect(byFamily.get("OWNER_REQUEST_CONTINUATION")?.status)
        .toBe("NO_SAMPLED_PLAYER_FUTURE_OVERLAP");
      expect(byFamily.get("BODY_RESPONSE_CONTINUATION")?.status)
        .toBe("SAMPLED_PLAYER_FUTURE_OVERLAP");
      expect(byFamily.get("TRANSITION_HOLD")?.status)
        .toBe("NO_SAMPLED_PLAYER_FUTURE_OVERLAP");

      const h2 = byFamily.get("BODY_RESPONSE_CONTINUATION");
      expect(h2?.firstOverlapSampleIndex).not.toBeNull();
      expect(h2?.overlapSampleCount).toBeGreaterThan(0);
      expect(h2?.minSampledClearance).toBeLessThan(0);

      for (const value of evidence) {
        expect(value.futureProbabilityClaim).toBe("NONE_COUNTERFACTUAL_NOT_PROBABILITY");
        expect(value.aggregationClaim).toBe("NONE_SINGLE_FUTURE_ONLY");
        expect(value.continuousInterstepSafetyClaim).toBe("NONE_NO_INTERSTEP_SWEEP");
        expect(value.runtimeAuthorityClaim).toBe("NONE");
      }

      console.info(`[A1_COMMITMENT_PLAYER_FUTURE_OCCUPANCY_REVERSAL] ${JSON.stringify({
        sourceTick: after.tick,
        anchor,
        current: {
          materialStatus: material.status,
          actorOccupancyStatus: currentActor.status
        },
        futures: evidence.map((value) => ({
          futureId: value.futureId,
          futureFamily: value.futureFamily,
          causalMeaning: value.causalMeaning,
          status: value.status,
          minSampledCenterDistance: value.minSampledCenterDistance,
          minSampledClearance: value.minSampledClearance,
          firstOverlapSampleIndex: value.firstOverlapSampleIndex,
          overlapSampleCount: value.overlapSampleCount,
          sampleCount: value.sampleCount
        })),
        interpretation: "One live reversal state yields separate provenance-preserving counterfactuals: the new Owner request and transition hold stay sampled-clear while the still-owner-directed body-response continuation enters the same currently clear, statically reachable commitment anchor. No future is selected or assigned probability."
      })}`);
    } finally {
      world.dispose();
    }
  });

  it("refuses to infer future occupancy when the commitment reference is unresolved", async () => {
    const world = await LabWorld.create("open");
    try {
      const before = world.snapshot();
      const situation = buildA1Situation({
        snapshot: before,
        playerIntent: playerIntent(1, 0),
        playerCapability: world.actorMovementCapability("player"),
        companionCapability: world.actorMovementCapability("companion"),
        previousWorldStep: null
      });
      const futures = buildA1PlayerFutureHypotheses({
        situation,
        horizonSeconds: 0.5,
        staticTraversal: (from, to, radius, options) =>
          world.staticCircleTraversal(from, to, radius, options)
      });
      const plan = buildA1PlayerFutureInterventionPlan(futures);
      const h1 = plan.interventions.find(
        (value) => value.futureFamily === "OWNER_REQUEST_CONTINUATION"
      );
      if (!h1 || h1.status !== "REHEARSABLE") throw new Error("missing H1");
      const rehearsal = rehearseA1PlayerFutureIntervention({ world, intervention: h1 });
      const evidence = buildA1SpatialCommitmentPlayerFutureOccupancyEvidence({
        fit: fit(before.tick, null),
        snapshot: before,
        rehearsal
      });

      expect(evidence.status).toBe("REFERENCE_UNRESOLVED");
      expect(evidence.anchorWorldPosition).toBeNull();
      expect(evidence.sampleCount).toBe(0);
      expect(evidence.minSampledCenterDistance).toBeNull();
    } finally {
      world.dispose();
    }
  });
});
