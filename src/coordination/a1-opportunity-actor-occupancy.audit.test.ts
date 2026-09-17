import { describe, expect, it } from "vitest";
import type { ActorSnapshot, Vec2, WorldSnapshot } from "../world/types";
import { LabWorld } from "../world/world";
import type { A1SpatialCommitmentFitEvidence } from "./a1-spatial-commitment-evidence";
import { buildA1SpatialCommitmentActorOccupancyEvidence } from "./a1-spatial-commitment-actor-occupancy";
import { buildA1SpatialCommitmentMaterialEvidence } from "./a1-spatial-commitment-material";

const PLAYER = { x: 3, y: 4 };
const COMPANION = { x: 8, y: 4 };

function actor(id: "player" | "companion", position: Vec2): ActorSnapshot {
  return {
    id,
    position: { ...position },
    radius: 0.3,
    requestedVelocity: { x: 0, y: 0 },
    actualVelocity: { x: 0, y: 0 },
    motionError: 0,
    contacts: []
  };
}

function snapshot(tick = 0): WorldSnapshot {
  return {
    tick,
    scenarioId: "open",
    width: 12,
    height: 8,
    actors: [actor("player", PLAYER), actor("companion", COMPANION)],
    obstacles: []
  };
}

function fit(anchor: Vec2 | null, tick = 0): A1SpatialCommitmentFitEvidence {
  const unresolved = anchor === null;
  return {
    kind: "A1_SPATIAL_COMMITMENT_FIT",
    sourceTick: tick,
    commitmentSourceTick: 0,
    referenceFrame: "WORLD_FIXED",
    anchorProvenance: "ACTOR_OCCUPANCY_AUDIT",
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
    reason: "actor occupancy audit fixture"
  };
}

describe("A1 current actor occupancy at exact commitment anchor", () => {
  it("proves a statically reachable exact anchor can still be occupied by the player body", async () => {
    const world = await LabWorld.create("open");
    try {
      const before = snapshot();
      const currentFit = fit(PLAYER);
      const material = buildA1SpatialCommitmentMaterialEvidence({
        fit: currentFit,
        snapshot: before,
        occupancy: (center, radius) => world.staticCircleOccupancy(center, radius),
        query: (from, to, radius, options) =>
          world.staticCircleTraversal(from, to, radius, options)
      });
      const actorOccupancy = buildA1SpatialCommitmentActorOccupancyEvidence({
        fit: currentFit,
        snapshot: before
      });

      expect(material.status).toBe("STATIC_ROUTE_REACHABLE");
      expect(material.occupancyTargetClear).toBe(true);
      expect(material.hardRouteReachable).toBe(true);

      expect(actorOccupancy.status).toBe("PLAYER_BODY_OVERLAP");
      expect(actorOccupancy.centerDistanceToPlayer).toBe(0);
      expect(actorOccupancy.overlapDepth).toBeCloseTo(0.6, 12);
      expect(actorOccupancy.temporalClaim).toBe("CURRENT_TICK_ONLY_NO_FUTURE_PREDICTION");

      console.info(`[A1_STATIC_REACHABLE_PLAYER_OCCUPIED_ANCHOR] ${JSON.stringify({
        anchor: PLAYER,
        staticMaterial: {
          status: material.status,
          occupancyTargetClear: material.occupancyTargetClear,
          hardRouteReachable: material.hardRouteReachable
        },
        currentActorOccupancy: actorOccupancy,
        interpretation: "Static world reachability is insufficient relational execution evidence: an exact anchor can be statically clear and directly reachable while currently occupied by the player's hard body."
      })}`);
    } finally {
      world.dispose();
    }
  });

  it("reports clear current actor space when the exact anchor is outside player-body overlap", () => {
    const before = snapshot();
    const actorOccupancy = buildA1SpatialCommitmentActorOccupancyEvidence({
      fit: fit({ x: 4, y: 4 }),
      snapshot: before
    });

    expect(actorOccupancy.status).toBe("CURRENT_ACTOR_SPACE_CLEAR");
    expect(actorOccupancy.centerDistanceToPlayer).toBe(1);
    expect(actorOccupancy.overlapDepth).toBe(0);
  });

  it("treats exact body tangency as non-overlap", () => {
    const before = snapshot();
    const actorOccupancy = buildA1SpatialCommitmentActorOccupancyEvidence({
      fit: fit({ x: 3.6, y: 4 }),
      snapshot: before
    });

    expect(actorOccupancy.centerDistanceToPlayer).toBeCloseTo(0.6, 12);
    expect(actorOccupancy.status).toBe("CURRENT_ACTOR_SPACE_CLEAR");
    expect(actorOccupancy.overlapDepth).toBeCloseTo(0, 12);
  });

  it("does not fabricate actor occupancy when the reference is unresolved", () => {
    const evidence = buildA1SpatialCommitmentActorOccupancyEvidence({
      fit: fit(null, 4),
      snapshot: snapshot(4)
    });

    expect(evidence.status).toBe("REFERENCE_UNRESOLVED");
    expect(evidence.anchorWorldPosition).toBeNull();
    expect(evidence.centerDistanceToPlayer).toBeNull();
    expect(evidence.overlapDepth).toBeNull();
  });
});
