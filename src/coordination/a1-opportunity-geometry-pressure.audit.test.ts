import { describe, expect, it } from "vitest";
import { scenario } from "../world/scenarios";
import type { ActorId, ActorSnapshot, Vec2, WorldSnapshot } from "../world/types";
import { LabWorld } from "../world/world";
import { buildA1AccessibilityEvidence } from "./a1-accessibility-fragments";
import type { A1RelationshipOrientationEvidence } from "./a1-relationship-orientation";
import { projectA1RelationshipSemanticField } from "./a1-relationship-projection";
import {
  A1_DEFAULT_RELATIONSHIP_SAMPLING,
  sampleA1RelationshipSemanticField
} from "./a1-relationship-utility";

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function noneOrientation(tick: number): A1RelationshipOrientationEvidence {
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
    reason: "geometry-pressure audit: isolate physical feasibility from Owner orientation"
  };
}

function snapshotAt(tick: number, playerPosition: Vec2): WorldSnapshot {
  const spec = scenario("pillar");
  const body = (id: ActorId, position: Vec2): ActorSnapshot => {
    const authored = spec.actors.find((candidate) => candidate.id === id);
    if (!authored) throw new Error(`Pillar scenario is missing ${id}.`);
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
  const companion = spec.actors.find((actor) => actor.id === "companion");
  if (!companion) throw new Error("Pillar scenario is missing companion.");
  return {
    tick,
    scenarioId: "pillar",
    width: spec.width,
    height: spec.height,
    actors: [body("player", playerPosition), body("companion", companion.position)],
    obstacles: spec.obstacles
  };
}

async function observe(world: LabWorld, tick: number, playerPosition: Vec2) {
  const field = sampleA1RelationshipSemanticField({ orientation: noneOrientation(tick) });
  expect(field.sampling.nearBestUtilityWindow).toBe(A1_DEFAULT_RELATIONSHIP_SAMPLING.nearBestUtilityWindow);
  const projection = projectA1RelationshipSemanticField({
    field,
    snapshot: snapshotAt(tick, playerPosition),
    query: (from, to, radius, options) => world.staticCircleTraversal(from, to, radius, options),
    routeBudget: field.semanticEligibleSampleIds.length,
    routeQualificationStrategy: "STRATIFIED_COVERAGE"
  });
  const accessibility = buildA1AccessibilityEvidence({ field, projection });
  expect(projection.routeCoverageComplete).toBe(true);
  expect(accessibility.coverage).toBe("COMPLETE");

  const semanticById = new Map(field.samples.map((sample) => [sample.id, sample]));
  const projectionById = new Map(projection.samples.map((sample) => [sample.sampleId, sample]));
  const candidates = accessibility.confirmedReachableSampleIds.map((sampleId) => {
    const semantic = semanticById.get(sampleId);
    const projected = projectionById.get(sampleId);
    if (!semantic || !projected) throw new Error(`Geometry-pressure audit lost ${sampleId}.`);
    return {
      sampleId,
      utility: semantic.utility.totalUtility,
      worldPosition: projected.worldPosition,
      routeTruth: projected.routeTruth
    };
  });
  if (candidates.length === 0) throw new Error("Geometry-pressure audit requires reachable candidates.");
  const semanticBest = [...candidates].sort((a, b) => {
    const utilityDelta = b.utility - a.utility;
    return Math.abs(utilityDelta) > 1e-12 ? utilityDelta : a.sampleId.localeCompare(b.sampleId);
  })[0];
  if (!semanticBest) throw new Error("Geometry-pressure audit lost semantic best.");
  return { field, projection, accessibility, candidates, semanticBest };
}

function nearestToAnchor<T extends { sampleId: string; utility: number; worldPosition: Vec2 }>(candidates: readonly T[], anchor: Vec2): T {
  const candidate = [...candidates].sort((a, b) => {
    const distanceDelta = distance(a.worldPosition, anchor) - distance(b.worldPosition, anchor);
    if (Math.abs(distanceDelta) > 1e-12) return distanceDelta;
    const utilityDelta = b.utility - a.utility;
    return Math.abs(utilityDelta) > 1e-12 ? utilityDelta : a.sampleId.localeCompare(b.sampleId);
  })[0];
  if (!candidate) throw new Error("Geometry-pressure audit has no candidate.");
  return candidate;
}

describe("A1 spatial commitment projection under obstacle pressure", () => {
  it("separates a translated commitment anchor from the nearest still-reachable relational target as the pillar occludes it", async () => {
    const world = await LabWorld.create("pillar");
    try {
      const playerPositions = [3.4, 3.6, 3.8, 4.0, 4.2, 4.4, 4.6, 4.8, 5.0, 5.2].map((x) => ({ x, y: 4 }));
      const initial = await observe(world, 0, playerPositions[0]!);
      const initialPlayer = playerPositions[0]!;
      const initialAnchor = { ...initial.semanticBest.worldPosition };
      const observations: Array<Record<string, unknown>> = [];

      for (const [index, playerPosition] of playerPositions.entries()) {
        const current = index === 0 ? initial : await observe(world, index, playerPosition);
        const translatedAnchor = {
          x: initialAnchor.x + (playerPosition.x - initialPlayer.x),
          y: initialAnchor.y + (playerPosition.y - initialPlayer.y)
        };
        const projectedCommitment = nearestToAnchor(current.candidates, translatedAnchor);
        const exactAnchorSample = current.projection.samples.find(
          (sample) => distance(sample.worldPosition, translatedAnchor) <= 1e-9
        );
        observations.push({
          playerPosition,
          translatedAnchor,
          anchorSampleId: exactAnchorSample?.sampleId ?? null,
          anchorRouteQualification: exactAnchorSample?.routeQualification ?? null,
          anchorHardStatus: exactAnchorSample?.routeTruth?.hardStatus ?? null,
          projectedSampleId: projectedCommitment.sampleId,
          commitmentPressureDistance: distance(projectedCommitment.worldPosition, translatedAnchor),
          projectedUtility: projectedCommitment.utility,
          semanticBestUtility: current.semanticBest.utility,
          utilityGapFromBest: current.semanticBest.utility - projectedCommitment.utility,
          projectedHardStatus: projectedCommitment.routeTruth?.hardStatus ?? null,
          projectedHardRouteNodeIds: projectedCommitment.routeTruth?.hardRouteNodeIds ?? [],
          reachableCount: current.accessibility.confirmedReachableSampleIds.length,
          fragmentCount: current.accessibility.fragments.length
        });
      }

      expect(observations).toHaveLength(playerPositions.length);
      console.info(`[A1_OPPORTUNITY_GEOMETRY_PRESSURE] ${JSON.stringify({
        samplingWindow: A1_DEFAULT_RELATIONSHIP_SAMPLING.nearBestUtilityWindow,
        initialSampleId: initial.semanticBest.sampleId,
        initialAnchor,
        observations,
        summary: {
          maxCommitmentPressureDistance: Math.max(...observations.map((entry) => Number(entry.commitmentPressureDistance))),
          maxUtilityGapFromBest: Math.max(...observations.map((entry) => Number(entry.utilityGapFromBest))),
          blockedAnchorObservationCount: observations.filter((entry) => entry.anchorRouteQualification !== "HARD_REACHABLE").length
        }
      })}`);
    } finally {
      world.dispose();
    }
  });
});