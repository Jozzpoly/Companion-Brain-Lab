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
  sampleA1RelationshipSemanticField,
  type A1RelationshipObjectiveProfile,
  type A1RelationshipSamplingConfig
} from "./a1-relationship-utility";

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function orientation(tick: number): A1RelationshipOrientationEvidence {
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
    reason: "objective provenance audit: fixed Owner orientation"
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

const SAMPLING: A1RelationshipSamplingConfig = {
  directions: 32,
  radii: [1.45],
  nearBestUtilityWindow: 0.2
};

const LEFT_OBJECTIVE: A1RelationshipObjectiveProfile = {
  radial: { preferredRadius: 1.45, sigma: 0.3, weight: 1 },
  directional: {
    kind: "PREFER_BEARING",
    preferredBearingRadians: Math.PI / 2,
    sigmaRadians: Math.PI / 8,
    weight: 1
  }
};

const RIGHT_OBJECTIVE: A1RelationshipObjectiveProfile = {
  radial: { preferredRadius: 1.45, sigma: 0.3, weight: 1 },
  directional: {
    kind: "PREFER_BEARING",
    preferredBearingRadians: -Math.PI / 2,
    sigmaRadians: Math.PI / 8,
    weight: 1
  }
};

async function observe(
  world: LabWorld,
  tick: number,
  objective: A1RelationshipObjectiveProfile
) {
  const field = sampleA1RelationshipSemanticField({
    orientation: orientation(tick),
    objective,
    sampling: SAMPLING
  });
  const snapshot = snapshotAt(tick);
  const projection = projectA1RelationshipSemanticField({
    field,
    snapshot,
    query: (from, to, radius, options) => world.staticCircleTraversal(from, to, radius, options),
    routeBudget: field.semanticEligibleSampleIds.length,
    routeQualificationStrategy: "STRATIFIED_COVERAGE"
  });
  const accessibility = buildA1AccessibilityEvidence({ field, projection });
  expect(accessibility.coverage).toBe("COMPLETE");
  expect(projection.routeCoverageComplete).toBe(true);

  const semanticById = new Map(field.samples.map((sample) => [sample.id, sample]));
  const projectedById = new Map(projection.samples.map((sample) => [sample.sampleId, sample]));
  const candidates = accessibility.confirmedReachableSampleIds.map((sampleId) => {
    const semantic = semanticById.get(sampleId);
    const projected = projectedById.get(sampleId);
    if (!semantic || !projected) throw new Error(`Objective provenance audit lost ${sampleId}.`);
    return {
      sampleId,
      utility: semantic.utility.totalUtility,
      worldPosition: projected.worldPosition
    };
  });
  if (candidates.length === 0) throw new Error("Objective provenance audit requires candidates.");
  const semanticBest = [...candidates].sort((a, b) => {
    const utilityDelta = b.utility - a.utility;
    return Math.abs(utilityDelta) > 1e-12 ? utilityDelta : a.sampleId.localeCompare(b.sampleId);
  })[0]!;
  return { field, projection, accessibility, snapshot, candidates, semanticBest };
}

function nearestToAnchor<T extends { sampleId: string; utility: number; worldPosition: Vec2 }>(
  candidates: readonly T[],
  anchor: Vec2
): T {
  const result = [...candidates].sort((a, b) => {
    const delta = distance(a.worldPosition, anchor) - distance(b.worldPosition, anchor);
    if (Math.abs(delta) > 1e-12) return delta;
    const utilityDelta = b.utility - a.utility;
    return Math.abs(utilityDelta) > 1e-12 ? utilityDelta : a.sampleId.localeCompare(b.sampleId);
  })[0];
  if (!result) throw new Error("Objective provenance audit has no candidate.");
  return result;
}

describe("A1 spatial commitment objective provenance", () => {
  it("keeps physical reachability separate from semantic validity when the active objective changes", async () => {
    const world = await LabWorld.create("open");
    try {
      const previous = await observe(world, 0, LEFT_OBJECTIVE);
      const current = await observe(world, 1, RIGHT_OBJECTIVE);
      const anchor = { ...previous.semanticBest.worldPosition };
      const anchorSampleId = previous.semanticBest.sampleId;
      const currentProjectionOfSameSample = current.projection.samples.find(
        (sample) => sample.sampleId === anchorSampleId
      );
      if (!currentProjectionOfSameSample) throw new Error(`Current projection lost ${anchorSampleId}.`);

      const companion = current.snapshot.actors.find((actor) => actor.id === "companion");
      if (!companion) throw new Error("Objective provenance audit lost companion.");
      const physicalTraversal = world.staticCircleTraversal(
        companion.position,
        anchor,
        companion.radius,
        { hardRoute: true }
      );
      const nearestCurrent = nearestToAnchor(current.candidates, anchor);
      const continuity = compareA1AccessibilityContinuity({ previous, current });

      expect(physicalTraversal.clear).toBe(true);
      expect(current.field.semanticEligibleSampleIds).not.toContain(anchorSampleId);
      expect(currentProjectionOfSameSample.routeQualification).toBe("NOT_APPLICABLE");
      expect(distance(nearestCurrent.worldPosition, anchor)).toBeGreaterThan(1);
      expect(continuity.semanticComparability).toBe("NON_COMPARABLE");
      expect(continuity.nonComparabilityReason).toBe("OBJECTIVE_CHANGED");

      console.info(`[A1_OPPORTUNITY_OBJECTIVE_PROVENANCE] ${JSON.stringify({
        sampling: SAMPLING,
        previous: {
          objective: LEFT_OBJECTIVE,
          semanticBestSampleId: previous.semanticBest.sampleId,
          semanticBestWorldPosition: previous.semanticBest.worldPosition,
          semanticBestUtility: previous.semanticBest.utility
        },
        current: {
          objective: RIGHT_OBJECTIVE,
          semanticBestSampleId: current.semanticBest.sampleId,
          semanticBestWorldPosition: current.semanticBest.worldPosition,
          semanticBestUtility: current.semanticBest.utility,
          oldAnchorSampleQualification: currentProjectionOfSameSample.routeQualification,
          oldAnchorSemanticallyEligible: current.field.semanticEligibleSampleIds.includes(anchorSampleId),
          nearestEligibleSampleId: nearestCurrent.sampleId,
          nearestEligibleDistanceFromOldAnchor: distance(nearestCurrent.worldPosition, anchor),
          nearestEligibleUtility: nearestCurrent.utility
        },
        physicalOldAnchorTraversal: {
          clear: physicalTraversal.clear,
          blocker: physicalTraversal.blocker
        },
        continuity: {
          semanticComparability: continuity.semanticComparability,
          nonComparabilityReason: continuity.nonComparabilityReason,
          accessibilityChanged: continuity.accessibilityChanged
        },
        interpretation: "A physically reachable spatial anchor can become semantically invalid solely because commitment meaning changed; objective provenance is therefore not recoverable from geometry alone."
      })}`);
    } finally {
      world.dispose();
    }
  });
});