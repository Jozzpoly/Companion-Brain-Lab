import { describe, expect, it } from "vitest";
import { scenario } from "../world/scenarios";
import type { ActorId, ActorSnapshot, Vec2, WorldSnapshot } from "../world/types";
import { LabWorld } from "../world/world";
import { buildA1AccessibilityEvidence } from "./a1-accessibility-fragments";
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
import {
  resolveA1SpatialCommitmentReference,
  type A1RetainedSemanticReferenceBasis
} from "./a1-spatial-commitment-reference";

function ownerOrientation(
  tick: number,
  direction: Vec2,
  source: "SAME_STEP_OWNER" | "OWNER_MEMORY" = "SAME_STEP_OWNER",
  sourceTick = tick,
  ageTicks = tick - sourceTick
): A1RelationshipOrientationEvidence {
  const length = Math.hypot(direction.x, direction.y);
  if (length <= 1e-12) throw new Error("Lifecycle audit requires nonzero orientation.");
  const normalized = { x: direction.x / length, y: direction.y / length };
  return {
    tick,
    source,
    direction: normalized,
    sourceTick,
    ageTicks,
    strength: 1,
    samplingBasis: { ...normalized },
    samplingBasisSource: "SEMANTIC_ORIENTATION",
    nextMemory: {
      provenance: "OWNER_CONTROL",
      direction: { ...normalized },
      sourceTick,
      sourceStrength: 1
    },
    reason: "commitment lifecycle audit: controlled semantic orientation"
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
    reason: "commitment lifecycle audit: canonical semantic orientation expired"
  };
}

function snapshotAt(
  tick: number,
  playerPosition: Vec2,
  companionPosition: Vec2
): WorldSnapshot {
  const spec = scenario("open");
  const body = (id: ActorId, position: Vec2): ActorSnapshot => {
    const authored = spec.actors.find((candidate) => candidate.id === id);
    if (!authored) throw new Error(`Open scenario is missing ${id}.`);
    return {
      id,
      position: { ...position },
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
    actors: [
      body("player", playerPosition),
      body("companion", companionPosition)
    ],
    obstacles: spec.obstacles
  };
}

async function observe(input: {
  world: LabWorld;
  tick: number;
  playerPosition: Vec2;
  companionPosition: Vec2;
  orientation: A1RelationshipOrientationEvidence;
}) {
  const field = sampleA1RelationshipSemanticField({
    orientation: input.orientation,
    objective: A1_DEFAULT_RELATIONSHIP_OBJECTIVE,
    sampling: A1_DEFAULT_RELATIONSHIP_SAMPLING
  });
  const projection = projectA1RelationshipSemanticField({
    field,
    snapshot: snapshotAt(
      input.tick,
      input.playerPosition,
      input.companionPosition
    ),
    query: (from, to, radius, options) =>
      input.world.staticCircleTraversal(from, to, radius, options),
    routeBudget: field.semanticEligibleSampleIds.length,
    routeQualificationStrategy: "STRATIFIED_COVERAGE"
  });
  const accessibility = buildA1AccessibilityEvidence({ field, projection });
  expect(accessibility.coverage).toBe("COMPLETE");
  return {
    field,
    projection,
    accessibility,
    orientation: input.orientation
  };
}

function bestReachable(
  observation: Awaited<ReturnType<typeof observe>>
): { sampleId: string; worldPosition: Vec2; utility: number } {
  const confirmed = new Set(observation.accessibility.confirmedReachableSampleIds);
  const semantic = [...observation.field.samples]
    .filter((sample) => confirmed.has(sample.id))
    .sort((a, b) => {
      const delta = b.utility.totalUtility - a.utility.totalUtility;
      return Math.abs(delta) > 1e-12 ? delta : a.id.localeCompare(b.id);
    })[0];
  if (!semantic) throw new Error("Lifecycle audit requires a reachable semantic candidate.");
  const projected = observation.projection.samples.find(
    (candidate) => candidate.sampleId === semantic.id
  );
  if (!projected) throw new Error(`Lifecycle audit lost projection for ${semantic.id}.`);
  return {
    sampleId: semantic.id,
    worldPosition: { ...projected.worldPosition },
    utility: semantic.utility.totalUtility
  };
}

describe("A1 query-only teammate commitment lifecycle", () => {
  it("separates persistent spatial reference from live semantic comparability across turn, expiry, retention and fresh reversal", async () => {
    const world = await LabWorld.create("open");
    try {
      const companionPosition = { x: 8, y: 4 };
      const sourcePlayer = { x: 3, y: 4 };
      const sourceOrientation = ownerOrientation(0, { x: 1, y: 0 });
      const source = await observe({
        world,
        tick: 0,
        playerPosition: sourcePlayer,
        companionPosition,
        orientation: sourceOrientation
      });
      const sourceBest = bestReachable(source);
      const declaration: A1SpatialCommitmentDeclaration = {
        kind: "A1_SPATIAL_COMMITMENT_DECLARATION",
        sourceTick: 0,
        objectiveSignature: source.field.objectiveSignature,
        orientationRegime: "DIRECTIONAL",
        referenceFrame: "PLAYER_RIGID",
        anchorProvenance: "QUERY_ONLY_TEAMMATE_LIFECYCLE"
      };

      const states = [
        {
          label: "established",
          tick: 0,
          playerPosition: sourcePlayer,
          orientation: sourceOrientation,
          retained: null
        },
        {
          label: "translate-turn",
          tick: 1,
          playerPosition: { x: 3.8, y: 4 },
          orientation: ownerOrientation(
            1,
            { x: Math.SQRT1_2, y: Math.SQRT1_2 }
          ),
          retained: null
        },
        {
          label: "expiry-with-explicit-retained-reference",
          tick: 2,
          playerPosition: { x: 4, y: 4 },
          orientation: noOrientation(2),
          retained: {
            provenance: "RETAINED_LAST_SEMANTIC_FRAME",
            direction: { x: Math.SQRT1_2, y: Math.SQRT1_2 },
            sourceTick: 1
          } satisfies A1RetainedSemanticReferenceBasis
        },
        {
          label: "expiry-without-retained-reference",
          tick: 3,
          playerPosition: { x: 4.2, y: 4 },
          orientation: noOrientation(3),
          retained: null
        },
        {
          label: "fresh-owner-reversal",
          tick: 4,
          playerPosition: { x: 4, y: 4 },
          orientation: ownerOrientation(4, { x: -1, y: 0 }),
          retained: null
        }
      ] as const;

      const rows: Array<Record<string, unknown>> = [];
      for (const state of states) {
        const observation = state.tick === 0
          ? source
          : await observe({
              world,
              tick: state.tick,
              playerPosition: state.playerPosition,
              companionPosition,
              orientation: state.orientation
            });
        const referenceResolution = resolveA1SpatialCommitmentReference({
          commitmentSourceTick: declaration.sourceTick,
          referenceFrame: declaration.referenceFrame,
          sourceAnchorWorldPosition: sourceBest.worldPosition,
          sourcePlayerWorldPosition: sourcePlayer,
          currentPlayerWorldPosition: state.playerPosition,
          sourceOrientation,
          currentOrientation: state.orientation,
          retainedCurrentSemanticBasis: state.retained
        });
        const fit = buildA1SpatialCommitmentFitEvidence({
          declaration,
          referenceResolution,
          ...observation
        });

        rows.push({
          label: state.label,
          tick: state.tick,
          playerPosition: state.playerPosition,
          canonicalOrientationSource: state.orientation.source,
          canonicalSamplingBasisSource: state.orientation.samplingBasisSource,
          semanticEligibleCount: observation.field.semanticEligibleSampleIds.length,
          referenceResolutionStatus: referenceResolution.status,
          referenceBasisProvenance: referenceResolution.currentBasisProvenance,
          referenceBasisAgeTicks: referenceResolution.currentBasisAgeTicks,
          resolvedAnchorWorldPosition: referenceResolution.resolvedAnchorWorldPosition,
          semanticStatus: fit.semanticStatus,
          pressureStatus: fit.pressureStatus,
          sampledPressureDistance: fit.sampledPressureDistance,
          nearestConfirmedSampleId: fit.nearestConfirmedSampleId
        });

        if (state.label === "established" || state.label === "translate-turn") {
          expect(referenceResolution.status).toBe("RESOLVED");
          expect(referenceResolution.currentBasisProvenance).toBe(
            "CANONICAL_SEMANTIC_ORIENTATION"
          );
          expect(fit.semanticStatus).toBe("COMPARABLE");
          expect(fit.pressureStatus).toBe("EXACT_ON_SAMPLED_MESH");
          expect(fit.sampledPressureDistance).toBeLessThanOrEqual(1e-9);
        }

        if (state.label === "expiry-with-explicit-retained-reference") {
          expect(referenceResolution.status).toBe("RESOLVED");
          expect(referenceResolution.currentBasisProvenance).toBe(
            "RETAINED_LAST_SEMANTIC_FRAME"
          );
          expect(referenceResolution.currentBasisAgeTicks).toBe(1);
          expect(referenceResolution.resolvedAnchorWorldPosition).not.toBeNull();
          expect(fit.semanticStatus).toBe("ORIENTATION_REGIME_CHANGED");
          expect(fit.pressureStatus).toBe("NON_COMPARABLE");
          expect(fit.sampledPressureDistance).toBeNull();
        }

        if (state.label === "expiry-without-retained-reference") {
          expect(referenceResolution.status).toBe("UNRESOLVED");
          expect(referenceResolution.unresolvedReason).toBe(
            "CURRENT_BASIS_MISSING"
          );
          expect(fit.semanticStatus).toBe("ORIENTATION_REGIME_CHANGED");
          expect(fit.pressureStatus).toBe("NON_COMPARABLE");
          expect(fit.sampledPressureDistance).toBeNull();
        }

        if (state.label === "fresh-owner-reversal") {
          expect(referenceResolution.status).toBe("RESOLVED");
          expect(referenceResolution.currentBasisProvenance).toBe(
            "CANONICAL_SEMANTIC_ORIENTATION"
          );
          expect(fit.semanticStatus).toBe("COMPARABLE");
          expect(fit.pressureStatus).toBe("EXACT_ON_SAMPLED_MESH");
          expect(fit.sampledPressureDistance).toBeLessThanOrEqual(1e-9);
        }
      }

      console.info(`[A1_TEAMMATE_COMMITMENT_LIFECYCLE] ${JSON.stringify({
        authority: "QUERY_ONLY_ZERO_A1_MOVEMENT_AUTHORITY",
        declaration,
        source: {
          playerPosition: sourcePlayer,
          sourceBest
        },
        rows,
        interpretation: "Spatial reference persistence and semantic persistence are separate. An explicitly retained basis can keep PLAYER_RIGID geometry resolvable after canonical orientation expires, while fit correctly remains semantically non-comparable until live directional semantics return."
      })}`);
    } finally {
      world.dispose();
    }
  });
});
