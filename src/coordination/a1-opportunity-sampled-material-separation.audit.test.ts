import { describe, expect, it } from "vitest";
import type { ActorSnapshot, Vec2, WorldSnapshot } from "../world/types";
import { LabWorld } from "../world/world";
import { buildA1AccessibilityEvidence } from "./a1-accessibility-fragments";
import type { A1RelationshipOrientationEvidence } from "./a1-relationship-orientation";
import { projectA1RelationshipSemanticField } from "./a1-relationship-projection";
import {
  sampleA1RelationshipSemanticField,
  type A1RelationshipObjectiveProfile,
  type A1RelationshipSamplingConfig
} from "./a1-relationship-utility";
import {
  buildA1SpatialCommitmentFitEvidence,
  type A1SpatialCommitmentDeclaration
} from "./a1-spatial-commitment-evidence";
import { buildA1SpatialCommitmentMaterialEvidence } from "./a1-spatial-commitment-material";
import { resolveA1SpatialCommitmentReference } from "./a1-spatial-commitment-reference";
import { buildA1SpatialCommitmentReviewEvidence } from "./a1-spatial-commitment-review";

const PLAYER = { x: 3, y: 4 };
const COMPANION = { x: 8, y: 4 };
const PREFERRED_RADIUS = 1.45;
const ANCHOR_ANGLE = 3 * Math.PI / 32; // 16.875°, between 16-direction samples.

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

function snapshot(tick: number): WorldSnapshot {
  return {
    tick,
    scenarioId: "open",
    width: 12,
    height: 8,
    actors: [actor("player", PLAYER), actor("companion", COMPANION)],
    obstacles: []
  };
}

function noOrientation(tick: number): A1RelationshipOrientationEvidence {
  return {
    tick,
    source: "NONE",
    direction: null,
    sourceTick: null,
    ageTicks: null,
    strength: 0,
    samplingBasis: { x: 1, y: 0 },
    samplingBasisSource: "WORLD_AXIS_SAMPLING_ONLY",
    nextMemory: null,
    reason: "sample/material separation audit: directionless ideal ring"
  };
}

const OBJECTIVE: A1RelationshipObjectiveProfile = {
  radial: { preferredRadius: PREFERRED_RADIUS, sigma: 0.3, weight: 1 },
  directional: { kind: "NONE" }
};

const SAMPLING: A1RelationshipSamplingConfig = {
  directions: 16,
  radii: [PREFERRED_RADIUS],
  nearBestUtilityWindow: 0
};

describe("A1 sampled pressure versus exact-anchor material truth", () => {
  it("proves positive exact-mesh pressure can coexist with a clear and hard-route-reachable exact anchor", async () => {
    const world = await LabWorld.create("open");
    try {
      const before = snapshot(0);
      const orientation = noOrientation(0);
      const field = sampleA1RelationshipSemanticField({
        orientation,
        objective: OBJECTIVE,
        sampling: SAMPLING
      });
      const projection = projectA1RelationshipSemanticField({
        field,
        snapshot: before,
        query: (from, to, radius, options) =>
          world.staticCircleTraversal(from, to, radius, options),
        routeBudget: field.semanticEligibleSampleIds.length,
        routeQualificationStrategy: "STRATIFIED_COVERAGE"
      });
      const accessibility = buildA1AccessibilityEvidence({ field, projection });
      expect(accessibility.coverage).toBe("COMPLETE");

      const anchor = {
        x: PLAYER.x + Math.cos(ANCHOR_ANGLE) * PREFERRED_RADIUS,
        y: PLAYER.y + Math.sin(ANCHOR_ANGLE) * PREFERRED_RADIUS
      };
      expect(Math.abs(Math.hypot(anchor.x - PLAYER.x, anchor.y - PLAYER.y) - PREFERRED_RADIUS))
        .toBeLessThanOrEqual(1e-12);

      const declaration: A1SpatialCommitmentDeclaration = {
        kind: "A1_SPATIAL_COMMITMENT_DECLARATION",
        sourceTick: 0,
        objectiveSignature: field.objectiveSignature,
        orientationRegime: "DIRECTIONLESS",
        referenceFrame: "WORLD_FIXED",
        anchorProvenance: "CONTINUOUS_IDEAL_RING_AUDIT"
      };
      const referenceResolution = resolveA1SpatialCommitmentReference({
        commitmentSourceTick: 0,
        referenceFrame: "WORLD_FIXED",
        sourceAnchorWorldPosition: anchor,
        sourcePlayerWorldPosition: PLAYER,
        currentPlayerWorldPosition: PLAYER,
        currentOrientation: orientation
      });
      const fit = buildA1SpatialCommitmentFitEvidence({
        declaration,
        referenceResolution,
        field,
        projection,
        accessibility
      });
      const review = buildA1SpatialCommitmentReviewEvidence(fit);
      const material = buildA1SpatialCommitmentMaterialEvidence({
        fit,
        snapshot: before,
        occupancy: (center, radius) => world.staticCircleOccupancy(center, radius),
        query: (from, to, radius, options) =>
          world.staticCircleTraversal(from, to, radius, options)
      });

      expect(fit.pressureStatus).toBe("EXACT_ON_SAMPLED_MESH");
      expect(fit.sampledPressureDistance).not.toBeNull();
      expect(fit.sampledPressureDistance!).toBeGreaterThan(0.1);
      expect(review.facts).toEqual(["SAMPLED_ANCHOR_OFFSET_OBSERVED"]);

      expect(material.status).toBe("STATIC_ROUTE_REACHABLE");
      expect(material.occupancyTargetClear).toBe(true);
      expect(material.hardRouteReachable).toBe(true);
      expect(material.hardRouteTruth?.hardStatus).toBe("direct");

      console.info(`[A1_SAMPLED_PRESSURE_MATERIAL_SEPARATION] ${JSON.stringify({
        anchor,
        sampling: {
          directions: SAMPLING.directions,
          sampledPressureDistance: fit.sampledPressureDistance,
          nearestConfirmedSampleId: fit.nearestConfirmedSampleId
        },
        review: {
          facts: review.facts,
          evidenceScope: review.evidenceScope
        },
        material: {
          status: material.status,
          occupancyTargetClear: material.occupancyTargetClear,
          hardRouteReachable: material.hardRouteReachable,
          hardStatus: material.hardRouteTruth?.hardStatus ?? null
        },
        interpretation: "Positive complete-mesh commitment pressure is not material conflict: the exact unsampled anchor is physically clear and directly hard-route reachable. Sampled offset and material obstruction must remain separate evidence axes."
      })}`);
    } finally {
      world.dispose();
    }
  });
});
