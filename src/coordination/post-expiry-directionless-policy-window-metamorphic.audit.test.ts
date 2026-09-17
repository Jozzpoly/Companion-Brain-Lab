import { describe, expect, it } from "vitest";
import { scenario } from "../world/scenarios";
import type { ActorId, ActorSnapshot, ScenarioId, Vec2, WorldSnapshot } from "../world/types";
import { LabWorld } from "../world/world";
import { buildA1AccessibilityEvidence } from "./a1-accessibility-fragments";
import type { A1RelationshipOrientationEvidence } from "./a1-relationship-orientation";
import { projectA1RelationshipSemanticField } from "./a1-relationship-projection";
import {
  A1_DEFAULT_RELATIONSHIP_OBJECTIVE,
  A1_DEFAULT_RELATIONSHIP_SAMPLING,
  sampleA1RelationshipSemanticField
} from "./a1-relationship-utility";

const COST_EPSILON = 1e-12;
const RADIUS_EPSILON = 1e-9;
const WINDOW_OFFSET = 1e-5;

function magnitude(value: Vec2): number {
  return Math.hypot(value.x, value.y);
}

function actor(snapshot: WorldSnapshot, id: ActorId): ActorSnapshot {
  const value = snapshot.actors.find((candidate) => candidate.id === id);
  if (!value) throw new Error(`Directionless window metamorphic snapshot is missing ${id}.`);
  return value;
}

function snapshotAt(
  scenarioId: ScenarioId,
  playerPosition: Vec2,
  companionPosition: Vec2
): WorldSnapshot {
  const spec = scenario(scenarioId);
  const body = (id: ActorId, position: Vec2): ActorSnapshot => {
    const authored = spec.actors.find((candidate) => candidate.id === id);
    if (!authored) throw new Error(`Scenario ${scenarioId} is missing ${id}.`);
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
    tick: 0,
    scenarioId,
    width: spec.width,
    height: spec.height,
    actors: [body("player", playerPosition), body("companion", companionPosition)],
    obstacles: spec.obstacles
  };
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
    reason: "audit control: explicit post-expiry semantic NONE"
  };
}

function utilityWindowBoundary(): number {
  const orientation = noneOrientation(0);
  const reference = sampleA1RelationshipSemanticField({
    orientation,
    sampling: {
      ...A1_DEFAULT_RELATIONSHIP_SAMPLING,
      radii: [...A1_DEFAULT_RELATIONSHIP_SAMPLING.radii],
      nearBestUtilityWindow: 1
    }
  });
  const preferredRadius = A1_DEFAULT_RELATIONSHIP_OBJECTIVE.radial.preferredRadius;
  const innerRadius = A1_DEFAULT_RELATIONSHIP_SAMPLING.radii.find((radius) => radius < preferredRadius);
  if (innerRadius === undefined) throw new Error("Metamorphic audit requires an inner sampling radius.");

  const inner = reference.samples.find((sample) => Math.abs(sample.radius - innerRadius) <= RADIUS_EPSILON);
  if (!inner) throw new Error("Metamorphic audit could not recover the inner-ring utility.");
  return reference.bestUtility - inner.utility.totalUtility;
}

async function routeFirstAtWindow(snapshot: WorldSnapshot, nearBestUtilityWindow: number) {
  const orientation = noneOrientation(snapshot.tick);
  const field = sampleA1RelationshipSemanticField({
    orientation,
    sampling: {
      ...A1_DEFAULT_RELATIONSHIP_SAMPLING,
      radii: [...A1_DEFAULT_RELATIONSHIP_SAMPLING.radii],
      nearBestUtilityWindow
    }
  });
  const world = await LabWorld.create(snapshot.scenarioId);
  try {
    const projection = projectA1RelationshipSemanticField({
      field,
      snapshot,
      query: (from, to, radius, options) => world.staticCircleTraversal(from, to, radius, options),
      routeBudget: field.semanticEligibleSampleIds.length,
      routeQualificationStrategy: "STRATIFIED_COVERAGE"
    });
    const accessibility = buildA1AccessibilityEvidence({ field, projection });
    expect(projection.routeCoverageComplete).toBe(true);
    expect(accessibility.coverage).toBe("COMPLETE");

    const reachableIds = new Set(accessibility.confirmedReachableSampleIds);
    const candidates = projection.samples.flatMap((sample) => {
      if (!reachableIds.has(sample.sampleId) || sample.routeQualification !== "HARD_REACHABLE") return [];
      const hardCost = sample.routeTruth?.hardCost;
      if (hardCost === null || hardCost === undefined || !Number.isFinite(hardCost)) {
        throw new Error(`Reachable sample ${sample.sampleId} lacks finite hard-route cost.`);
      }
      return [{ sample, hardCost }];
    });

    const routeFirst = [...candidates].sort((a, b) => {
      const costDelta = a.hardCost - b.hardCost;
      if (Math.abs(costDelta) > COST_EPSILON) return costDelta;
      const utilityDelta = b.sample.semanticUtility - a.sample.semanticUtility;
      if (Math.abs(utilityDelta) > COST_EPSILON) return utilityDelta;
      return a.sample.sampleId.localeCompare(b.sample.sampleId);
    })[0];
    const semanticFirst = [...candidates].sort((a, b) => {
      const utilityDelta = b.sample.semanticUtility - a.sample.semanticUtility;
      if (Math.abs(utilityDelta) > COST_EPSILON) return utilityDelta;
      const costDelta = a.hardCost - b.hardCost;
      if (Math.abs(costDelta) > COST_EPSILON) return costDelta;
      return a.sample.sampleId.localeCompare(b.sample.sampleId);
    })[0];
    if (!routeFirst || !semanticFirst) throw new Error("Metamorphic audit found no HARD_REACHABLE candidate.");

    const preferredRadius = A1_DEFAULT_RELATIONSHIP_OBJECTIVE.radial.preferredRadius;
    const innerRadius = Math.max(...A1_DEFAULT_RELATIONSHIP_SAMPLING.radii.filter((radius) => radius < preferredRadius));
    const eligibleInnerCount = field.samples.filter(
      (sample) => sample.semanticEligible && Math.abs(sample.radius - innerRadius) <= RADIUS_EPSILON
    ).length;

    return {
      scenario: snapshot.scenarioId,
      nearBestUtilityWindow,
      nearBestUtilityFloor: field.nearBestUtilityFloor,
      semanticEligibleCount: field.semanticEligibleSampleIds.length,
      eligibleInnerCount,
      routeFirst: {
        sampleId: routeFirst.sample.sampleId,
        radius: magnitude(routeFirst.sample.relativeOffset),
        semanticUtility: routeFirst.sample.semanticUtility,
        hardCost: routeFirst.hardCost
      },
      semanticFirst: {
        sampleId: semanticFirst.sample.sampleId,
        radius: magnitude(semanticFirst.sample.relativeOffset),
        semanticUtility: semanticFirst.sample.semanticUtility,
        hardCost: semanticFirst.hardCost
      }
    } as const;
  } finally {
    world.dispose();
  }
}

async function requireThresholdCliff(snapshot: WorldSnapshot) {
  const boundary = utilityWindowBoundary();
  expect(boundary).toBeGreaterThan(0);
  expect(boundary).toBeLessThan(1);

  const below = await routeFirstAtWindow(snapshot, boundary - WINDOW_OFFSET);
  const above = await routeFirstAtWindow(snapshot, boundary + WINDOW_OFFSET);
  const preferredRadius = A1_DEFAULT_RELATIONSHIP_OBJECTIVE.radial.preferredRadius;
  const innerRadius = Math.max(...A1_DEFAULT_RELATIONSHIP_SAMPLING.radii.filter((radius) => radius < preferredRadius));

  expect(below.eligibleInnerCount).toBe(0);
  expect(above.eligibleInnerCount).toBe(A1_DEFAULT_RELATIONSHIP_SAMPLING.directions);
  expect(below.routeFirst.radius).toBeCloseTo(preferredRadius, 9);
  expect(above.routeFirst.radius).toBeCloseTo(innerRadius, 9);
  expect(below.semanticFirst.radius).toBeCloseTo(preferredRadius, 9);
  expect(above.semanticFirst.radius).toBeCloseTo(preferredRadius, 9);
  expect(above.routeFirst.hardCost).toBeLessThan(above.semanticFirst.hardCost);
  expect(above.routeFirst.semanticUtility).toBeLessThan(above.semanticFirst.semanticUtility);

  const summary = {
    scenario: snapshot.scenarioId,
    boundary,
    windowOffset: WINDOW_OFFSET,
    below,
    above,
    interpretation: {
      innerRingEligibilityFlipsAtBoundary: true,
      routeFirstWinnerFlipsWithEligibility: true,
      semanticFirstWinnerRemainsPreferredRadius: true,
      runtimeAuthorityChanged: false
    },
    authority: "NONE_AUDIT_ONLY"
  } as const;
  console.info(`[POST_EXPIRY_DIRECTIONLESS_WINDOW_METAMORPHIC] ${JSON.stringify(summary)}`);
}

describe("post-expiry directionless near-best window metamorphic audit", () => {
  it("exposes the route-first winner cliff beside the pillar", async () => {
    await requireThresholdCliff(snapshotAt("pillar", { x: 3.8, y: 4 }, { x: 5.1, y: 4 }));
  });

  it("exposes the route-first winner cliff beside doorway geometry", async () => {
    await requireThresholdCliff(snapshotAt("doorway", { x: 4.7, y: 4 }, { x: 5.4, y: 4.45 }));
  });
});
