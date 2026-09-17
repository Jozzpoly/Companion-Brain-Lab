import { describe, expect, it } from "vitest";
import { scenario } from "../world/scenarios";
import type { ActorId, ActorSnapshot, Vec2, WorldSnapshot } from "../world/types";
import { LabWorld } from "../world/world";
import {
  buildA1AccessibilityEvidence,
  compareA1AccessibilityContinuity
} from "./a1-accessibility-fragments";
import type { A1RelationshipOrientationEvidence } from "./a1-relationship-orientation";
import { projectA1RelationshipSemanticField } from "./a1-relationship-projection";
import {
  A1_DEFAULT_RELATIONSHIP_OBJECTIVE,
  A1_DEFAULT_RELATIONSHIP_SAMPLING,
  sampleA1RelationshipSemanticField
} from "./a1-relationship-utility";
import {
  buildA1SpatialCommitmentFitEvidence,
  type A1SpatialCommitmentDeclaration
} from "./a1-spatial-commitment-evidence";

function sameStepOrientation(tick: number): A1RelationshipOrientationEvidence {
  return {
    tick,
    source: "SAME_STEP_OWNER",
    direction: { x: 1, y: 0 },
    sourceTick: tick,
    ageTicks: 0,
    strength: 1,
    samplingBasis: { x: 1, y: 0 },
    samplingBasisSource: "SEMANTIC_ORIENTATION",
    nextMemory: {
      provenance: "OWNER_CONTROL",
      direction: { x: 1, y: 0 },
      sourceTick: tick,
      sourceStrength: 1
    },
    reason: "orientation-regime contract audit: live +X Owner orientation"
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
    reason: "orientation-regime contract audit: expired semantic orientation"
  };
}

function snapshotAt(tick: number): WorldSnapshot {
  const spec = scenario("open");
  const actor = (id: ActorId): ActorSnapshot => {
    const authored = spec.actors.find((candidate) => candidate.id === id);
    if (!authored) throw new Error(`Open scenario is missing ${id}.`);
    return {
      id,
      position: { ...authored.position },
      radius: authored.radius,
      requestedVelocity: { x: 0, y: 0 },
      actualVelocity: { x: 0, y: 0 },
      motionError: 0,
      contacts: []
    };
  };
  return {
    tick,
    scenarioId: "open",
    width: spec.width,
    height: spec.height,
    actors: [actor("player"), actor("companion")],
    obstacles: spec.obstacles
  };
}

async function observe(
  world: LabWorld,
  orientation: A1RelationshipOrientationEvidence
) {
  const field = sampleA1RelationshipSemanticField({
    orientation,
    objective: A1_DEFAULT_RELATIONSHIP_OBJECTIVE,
    sampling: A1_DEFAULT_RELATIONSHIP_SAMPLING
  });
  const snapshot = snapshotAt(orientation.tick);
  const projection = projectA1RelationshipSemanticField({
    field,
    snapshot,
    query: (from, to, radius, options) => world.staticCircleTraversal(from, to, radius, options),
    routeBudget: field.semanticEligibleSampleIds.length,
    routeQualificationStrategy: "STRATIFIED_COVERAGE"
  });
  const accessibility = buildA1AccessibilityEvidence({ field, projection });
  expect(accessibility.coverage).toBe("COMPLETE");
  return { field, projection, accessibility };
}

function worldPosition(
  observation: Awaited<ReturnType<typeof observe>>,
  sampleId: string
): Vec2 {
  const sample = observation.projection.samples.find((candidate) => candidate.sampleId === sampleId);
  if (!sample) throw new Error(`Orientation-regime audit lost ${sampleId}.`);
  return sample.worldPosition;
}

describe("A1 commitment fit orientation-regime falsifier", () => {
  it("demonstrates that objective equality alone currently masks a directional-to-directionless semantic regime change", async () => {
    const world = await LabWorld.create("open");
    try {
      const previous = await observe(world, sameStepOrientation(0));
      const current = await observe(world, noOrientation(1));
      const continuity = compareA1AccessibilityContinuity({ previous, current });
      const previousBestSampleId = [...previous.field.samples]
        .sort((a, b) => b.utility.totalUtility - a.utility.totalUtility || a.id.localeCompare(b.id))[0]?.id;
      if (!previousBestSampleId) throw new Error("Orientation-regime audit lost previous semantic best.");
      const anchor = worldPosition(previous, previousBestSampleId);
      const declaration: A1SpatialCommitmentDeclaration = {
        kind: "A1_SPATIAL_COMMITMENT_DECLARATION",
        sourceTick: previous.field.sourceTick,
        objectiveSignature: previous.field.objectiveSignature,
        referenceFrame: "WORLD_FIXED",
        anchorProvenance: "ORIENTATION_REGIME_FALSIFIER"
      };
      const fit = buildA1SpatialCommitmentFitEvidence({
        declaration,
        resolvedAnchorWorldPosition: anchor,
        ...current
      });

      expect(previous.field.objectiveSignature).toBe(current.field.objectiveSignature);
      expect(previous.field.samplingSignature).toBe(current.field.samplingSignature);
      expect(previous.field.samplingBasisSource).toBe("SEMANTIC_ORIENTATION");
      expect(current.field.samplingBasisSource).toBe("WORLD_AXIS_SAMPLING_ONLY");
      expect(continuity.semanticComparability).toBe("NON_COMPARABLE");
      expect(continuity.nonComparabilityReason).toBe("ORIENTATION_REGIME_CHANGED");

      // Characterize the current gap before repairing the fit contract: it only
      // knows the objective signature, so it incorrectly calls this comparable.
      expect(fit.semanticStatus).toBe("COMPARABLE");
      expect(fit.pressureStatus).toBe("EXACT_ON_SAMPLED_MESH");

      console.info(`[A1_SPATIAL_COMMITMENT_ORIENTATION_REGIME_GAP] ${JSON.stringify({
        previous: {
          orientationSource: previous.field.orientationSource,
          samplingBasisSource: previous.field.samplingBasisSource,
          objectiveSignature: previous.field.objectiveSignature,
          samplingSignature: previous.field.samplingSignature,
          semanticEligibleCount: previous.field.semanticEligibleSampleIds.length
        },
        current: {
          orientationSource: current.field.orientationSource,
          samplingBasisSource: current.field.samplingBasisSource,
          objectiveSignature: current.field.objectiveSignature,
          samplingSignature: current.field.samplingSignature,
          semanticEligibleCount: current.field.semanticEligibleSampleIds.length
        },
        accessibilityContinuity: {
          semanticComparability: continuity.semanticComparability,
          nonComparabilityReason: continuity.nonComparabilityReason
        },
        commitmentFitBeforeRepair: {
          semanticStatus: fit.semanticStatus,
          pressureStatus: fit.pressureStatus,
          sampledPressureDistance: fit.sampledPressureDistance,
          reason: fit.reason
        },
        interpretation: "Commitment fit must carry the declaration orientation regime; objective-signature equality is insufficient semantic provenance."
      })}`);
    } finally {
      world.dispose();
    }
  });
});