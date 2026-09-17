import { describe, expect, it } from "vitest";
import type { ActorSnapshot, StaticCircleTraversalResult, Vec2, WorldSnapshot } from "../world/types";
import { buildA1AccessibilityEvidence } from "./a1-accessibility-fragments";
import type { A1RelationshipOrientationEvidence } from "./a1-relationship-orientation";
import { projectA1RelationshipSemanticField } from "./a1-relationship-projection";
import {
  sampleA1RelationshipSemanticField,
  type A1RelationshipObjectiveProfile,
  type A1RelationshipSamplingConfig
} from "./a1-relationship-utility";

const CENTER = { x: 20, y: 16 };
const COMPANION = { x: 15, y: 16 };
const RADIUS = 1.45;
const ANCHOR_ANGLE = 3 * Math.PI / 32; // 16.875°, exact only on the 64-direction mesh below.

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

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
    width: 40,
    height: 32,
    actors: [actor("player", CENTER), actor("companion", COMPANION)],
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
    reason: "sampling uncertainty audit: directionless ideal ring"
  };
}

function clearTraversal(from: Vec2, to: Vec2, radius: number): StaticCircleTraversalResult {
  return {
    from: { ...from },
    to: { ...to },
    radius,
    distance: distance(from, to),
    clear: true,
    blocker: null
  };
}

const OBJECTIVE: A1RelationshipObjectiveProfile = {
  radial: { preferredRadius: RADIUS, sigma: 0.3, weight: 1 },
  directional: { kind: "NONE" }
};

function observe(tick: number, directions: number) {
  const sampling: A1RelationshipSamplingConfig = {
    directions,
    radii: [RADIUS],
    nearBestUtilityWindow: 0
  };
  const field = sampleA1RelationshipSemanticField({
    orientation: noOrientation(tick),
    objective: OBJECTIVE,
    sampling
  });
  const projection = projectA1RelationshipSemanticField({
    field,
    snapshot: snapshot(tick),
    query: clearTraversal,
    routeBudget: field.semanticEligibleSampleIds.length,
    routeQualificationStrategy: "STRATIFIED_COVERAGE"
  });
  const accessibility = buildA1AccessibilityEvidence({ field, projection });
  expect(accessibility.coverage).toBe("COMPLETE");
  expect(projection.routeCoverageComplete).toBe(true);
  return { directions, field, projection, accessibility };
}

function sampledPressure(observation: ReturnType<typeof observe>, anchor: Vec2) {
  const samplesById = new Map(observation.projection.samples.map((sample) => [sample.sampleId, sample]));
  const distances = observation.accessibility.confirmedReachableSampleIds.map((sampleId) => {
    const sample = samplesById.get(sampleId);
    if (!sample) throw new Error(`Sampling uncertainty audit lost ${sampleId}.`);
    return { sampleId, distance: distance(sample.worldPosition, anchor), worldPosition: sample.worldPosition };
  }).sort((a, b) => a.distance - b.distance || a.sampleId.localeCompare(b.sampleId));
  const nearest = distances[0];
  if (!nearest) throw new Error("Sampling uncertainty audit has no reachable sample.");
  return nearest;
}

describe("A1 commitment pressure sampling uncertainty", () => {
  it("shows complete route coverage is exact for the current mesh but not for the latent continuous opportunity", () => {
    const anchor = {
      x: CENTER.x + Math.cos(ANCHOR_ANGLE) * RADIUS,
      y: CENTER.y + Math.sin(ANCHOR_ANGLE) * RADIUS
    };
    const continuousRadialError = Math.abs(distance(anchor, CENTER) - RADIUS);
    expect(continuousRadialError).toBeLessThanOrEqual(1e-12);

    const meshes = [8, 16, 32, 64].map((directions, tick) => {
      const observation = observe(tick, directions);
      const nearest = sampledPressure(observation, anchor);
      return {
        directions,
        coverage: observation.accessibility.coverage,
        semanticEligibleCount: observation.field.semanticEligibleSampleIds.length,
        nearestSampleId: nearest.sampleId,
        sampledPressureDistance: nearest.distance,
        nearestWorldPosition: nearest.worldPosition
      };
    });

    const byDirections = new Map(meshes.map((row) => [row.directions, row]));
    expect(byDirections.get(8)?.sampledPressureDistance).toBeGreaterThan(0.3);
    expect(byDirections.get(16)?.sampledPressureDistance).toBeGreaterThan(0.1);
    expect(byDirections.get(32)?.sampledPressureDistance).toBeGreaterThan(0.1);
    expect(byDirections.get(64)?.sampledPressureDistance).toBeLessThanOrEqual(1e-12);

    console.info(`[A1_OPPORTUNITY_PRESSURE_SAMPLING] ${JSON.stringify({
      anchorAngleRadians: ANCHOR_ANGLE,
      anchor,
      continuousIdealRing: {
        preferredRadius: RADIUS,
        radialError: continuousRadialError,
        latentContinuousPressureDistance: 0
      },
      meshes,
      interpretation: "COMPLETE means exact over the sampled mesh. A positive mesh-nearest distance can still be discretization error when an unsampled continuous opportunity exists at the anchor."
    })}`);
  });
});