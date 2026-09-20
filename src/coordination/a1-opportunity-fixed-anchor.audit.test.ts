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

function orientation(tick: number, degrees: number): A1RelationshipOrientationEvidence {
  const radians = degrees * Math.PI / 180;
  const direction = { x: Math.cos(radians), y: Math.sin(radians) };
  return {
    tick,
    source: "SAME_STEP_OWNER",
    direction,
    sourceTick: tick,
    ageTicks: 0,
    strength: 1,
    samplingBasis: { ...direction },
    samplingBasisSource: "SEMANTIC_ORIENTATION",
    nextMemory: {
      provenance: "OWNER_CONTROL",
      direction: { ...direction },
      sourceTick: tick,
      sourceStrength: 1
    },
    reason: "fixed-anchor audit: controlled Owner orientation"
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

async function candidatesAt(world: LabWorld, tick: number, degrees: number) {
  const field = sampleA1RelationshipSemanticField({ orientation: orientation(tick, degrees) });
  expect(field.sampling.nearBestUtilityWindow).toBe(A1_DEFAULT_RELATIONSHIP_SAMPLING.nearBestUtilityWindow);
  const projection = projectA1RelationshipSemanticField({
    field,
    snapshot: snapshotAt(tick),
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
    if (!semantic || !projected) throw new Error(`Fixed-anchor audit lost ${sampleId}.`);
    return {
      sampleId,
      utility: semantic.utility.totalUtility,
      worldPosition: projected.worldPosition
    };
  });
  if (candidates.length === 0) throw new Error("Fixed-anchor audit requires reachable candidates.");
  const semanticBest = [...candidates].sort((a, b) => {
    const utilityDelta = b.utility - a.utility;
    return Math.abs(utilityDelta) > 1e-12 ? utilityDelta : a.sampleId.localeCompare(b.sampleId);
  })[0];
  if (!semanticBest) throw new Error("Fixed-anchor audit lost semantic best.");
  return { candidates, semanticBest };
}

function nearestToAnchor<T extends { sampleId: string; utility: number; worldPosition: Vec2 }>(
  candidates: readonly T[],
  anchor: Vec2
): T {
  const candidate = [...candidates].sort((a, b) => {
    const distanceDelta = distance(a.worldPosition, anchor) - distance(b.worldPosition, anchor);
    if (Math.abs(distanceDelta) > 1e-12) return distanceDelta;
    const utilityDelta = b.utility - a.utility;
    return Math.abs(utilityDelta) > 1e-12 ? utilityDelta : a.sampleId.localeCompare(b.sampleId);
  })[0];
  if (!candidate) throw new Error("Fixed-anchor audit has no candidate.");
  return candidate;
}

describe("A1 fixed spatial commitment anchor", () => {
  it("maps how long a world-space commitment can remain relationally valid while Owner orientation rotates", async () => {
    const world = await LabWorld.create("open");
    try {
      const degrees = Array.from({ length: 37 }, (_, index) => index * 5);
      const initial = await candidatesAt(world, 0, 0);
      const anchor = { ...initial.semanticBest.worldPosition };
      let previousSampleId = initial.semanticBest.sampleId;
      const observations: Array<Record<string, unknown>> = [];

      for (let index = 1; index < degrees.length; index += 1) {
        const degree = degrees[index];
        if (degree === undefined) continue;
        const current = await candidatesAt(world, index, degree);
        const anchored = nearestToAnchor(current.candidates, anchor);
        observations.push({
          degrees: degree,
          candidateCount: current.candidates.length,
          previousAnchorSampleId: previousSampleId,
          anchorSampleId: anchored.sampleId,
          semanticBestSampleId: current.semanticBest.sampleId,
          anchorError: distance(anchored.worldPosition, anchor),
          semanticBestError: distance(current.semanticBest.worldPosition, anchor),
          avoidedWorldChase: distance(current.semanticBest.worldPosition, anchor) - distance(anchored.worldPosition, anchor),
          anchorUtility: anchored.utility,
          semanticBestUtility: current.semanticBest.utility,
          utilityGapFromBest: current.semanticBest.utility - anchored.utility
        });
        previousSampleId = anchored.sampleId;
      }

      expect(observations).toHaveLength(36);
      console.info(`[A1_OPPORTUNITY_FIXED_ANCHOR] ${JSON.stringify({
        samplingWindow: A1_DEFAULT_RELATIONSHIP_SAMPLING.nearBestUtilityWindow,
        initialSampleId: initial.semanticBest.sampleId,
        anchor,
        observations,
        summary: {
          maxAnchorError: Math.max(...observations.map((entry) => Number(entry.anchorError))),
          maxUtilityGapFromBest: Math.max(...observations.map((entry) => Number(entry.utilityGapFromBest))),
          finalAnchorError: Number(observations.at(-1)?.anchorError ?? 0),
          sampleSwitchCount: observations.filter((entry) => entry.previousAnchorSampleId !== entry.anchorSampleId).length
        }
      })}`);
    } finally {
      world.dispose();
    }
  });
});