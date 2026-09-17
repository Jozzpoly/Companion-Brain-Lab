import { describe, expect, it } from "vitest";
import { scenario } from "../world/scenarios";
import type { ActorId, ActorSnapshot, ScenarioId, Vec2, WorldSnapshot } from "../world/types";
import { LabWorld } from "../world/world";
import {
  buildA1AccessibilityEvidence,
  compareA1AccessibilityContinuity
} from "./a1-accessibility-fragments";
import type { A1RelationshipOrientationEvidence } from "./a1-relationship-orientation";
import { projectA1RelationshipSemanticField } from "./a1-relationship-projection";
import {
  A1_DEFAULT_RELATIONSHIP_SAMPLING,
  sampleA1RelationshipSemanticField
} from "./a1-relationship-utility";

type SweepPoint = {
  label: string;
  playerPosition: Vec2;
  companionPosition: Vec2;
};

function snapshotAt(
  scenarioId: ScenarioId,
  tick: number,
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
    tick,
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
    reason: "opportunity-persistence audit: explicit directionless control"
  };
}

async function observe(scenarioId: ScenarioId, tick: number, point: SweepPoint) {
  const snapshot = snapshotAt(scenarioId, tick, point.playerPosition, point.companionPosition);
  const field = sampleA1RelationshipSemanticField({
    orientation: noneOrientation(tick),
    sampling: {
      ...A1_DEFAULT_RELATIONSHIP_SAMPLING,
      radii: [...A1_DEFAULT_RELATIONSHIP_SAMPLING.radii],
      nearBestUtilityWindow: 1
    }
  });
  const world = await LabWorld.create(scenarioId);
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
    return { label: point.label, field, projection, accessibility } as const;
  } finally {
    world.dispose();
  }
}

async function runSweep(scenarioId: ScenarioId, points: readonly SweepPoint[]) {
  const observations = [] as Awaited<ReturnType<typeof observe>>[];
  for (const [index, point] of points.entries()) {
    observations.push(await observe(scenarioId, index, point));
  }

  const transitions = [] as Array<Record<string, unknown>>;
  for (let index = 1; index < observations.length; index += 1) {
    const previous = observations[index - 1];
    const current = observations[index];
    if (!previous || !current) continue;
    const continuity = compareA1AccessibilityContinuity({ previous, current });
    expect(continuity.semanticComparability).toBe("COMPARABLE");
    expect(continuity.confirmedReachableOverlapRatio).not.toBeNull();
    expect(continuity.accessibilityChanged).not.toBeNull();

    transitions.push({
      from: previous.label,
      to: current.label,
      previousReachableCount: previous.accessibility.confirmedReachableSampleIds.length,
      currentReachableCount: current.accessibility.confirmedReachableSampleIds.length,
      previousFragmentCount: previous.accessibility.fragments.length,
      currentFragmentCount: current.accessibility.fragments.length,
      confirmedReachableOverlapRatio: continuity.confirmedReachableOverlapRatio,
      accessibilityChanged: continuity.accessibilityChanged,
      fragmentMatches: continuity.fragmentMatches.map((match) => ({
        overlapRatio: match.overlapRatio,
        previousRepresentativeSampleId: match.previousRepresentativeSampleId,
        currentRepresentativeSampleId: match.currentRepresentativeSampleId,
        representativeWorldDelta: match.representativeWorldDelta
      }))
    });
  }

  expect(transitions.length).toBe(points.length - 1);
  console.info(`[A1_OPPORTUNITY_PERSISTENCE_SWEEP] ${JSON.stringify({ scenarioId, transitions })}`);
}

describe("A1 opportunity persistence geometry sweep", () => {
  it("maps sampled accessibility continuity while the player approaches the pillar", async () => {
    const companionPosition = { x: 4.0, y: 4.0 };
    await runSweep("pillar", [
      { label: "x3.60", playerPosition: { x: 3.6, y: 4.0 }, companionPosition },
      { label: "x3.80", playerPosition: { x: 3.8, y: 4.0 }, companionPosition },
      { label: "x4.00", playerPosition: { x: 4.0, y: 4.0 }, companionPosition },
      { label: "x4.20", playerPosition: { x: 4.2, y: 4.0 }, companionPosition },
      { label: "x4.40", playerPosition: { x: 4.4, y: 4.0 }, companionPosition },
      { label: "x4.60", playerPosition: { x: 4.6, y: 4.0 }, companionPosition },
      { label: "x4.80", playerPosition: { x: 4.8, y: 4.0 }, companionPosition },
      { label: "x5.00", playerPosition: { x: 5.0, y: 4.0 }, companionPosition }
    ]);
  });

  it("maps sampled accessibility continuity while the player moves through the doorway aperture", async () => {
    const companionPosition = { x: 4.6, y: 4.0 };
    await runSweep("doorway", [
      { label: "y3.55", playerPosition: { x: 5.0, y: 3.55 }, companionPosition },
      { label: "y3.70", playerPosition: { x: 5.0, y: 3.70 }, companionPosition },
      { label: "y3.85", playerPosition: { x: 5.0, y: 3.85 }, companionPosition },
      { label: "y4.00", playerPosition: { x: 5.0, y: 4.00 }, companionPosition },
      { label: "y4.15", playerPosition: { x: 5.0, y: 4.15 }, companionPosition },
      { label: "y4.30", playerPosition: { x: 5.0, y: 4.30 }, companionPosition },
      { label: "y4.45", playerPosition: { x: 5.0, y: 4.45 }, companionPosition }
    ]);
  });
});