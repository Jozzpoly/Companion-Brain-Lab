import { describe, expect, it } from "vitest";
import { scenario } from "../world/scenarios";
import type { ActorId, ActorSnapshot, ScenarioId, Vec2, WorldSnapshot } from "../world/types";
import { LabWorld } from "../world/world";
import { buildA1AccessibilityEvidence } from "./a1-accessibility-fragments";
import type { A1RelationshipOrientationEvidence } from "./a1-relationship-orientation";
import { projectA1RelationshipSemanticField } from "./a1-relationship-projection";
import {
  A1_DEFAULT_RELATIONSHIP_SAMPLING,
  sampleA1RelationshipSemanticField
} from "./a1-relationship-utility";

const EPSILON = 1e-12;
const PERTURBATION_METERS = 0.01;

type ReachablePoint = {
  sampleId: string;
  semanticRegret: number;
  semanticUtility: number;
  hardCost: number;
  radius: number;
  worldPosition: Vec2;
};

type Perturbation = {
  id: string;
  playerDelta: Vec2;
  companionDelta: Vec2;
};

const PERTURBATIONS: readonly Perturbation[] = [
  { id: "BASE", playerDelta: { x: 0, y: 0 }, companionDelta: { x: 0, y: 0 } },
  { id: "PLAYER_X_MINUS_1CM", playerDelta: { x: -PERTURBATION_METERS, y: 0 }, companionDelta: { x: 0, y: 0 } },
  { id: "PLAYER_X_PLUS_1CM", playerDelta: { x: PERTURBATION_METERS, y: 0 }, companionDelta: { x: 0, y: 0 } },
  { id: "PLAYER_Y_MINUS_1CM", playerDelta: { x: 0, y: -PERTURBATION_METERS }, companionDelta: { x: 0, y: 0 } },
  { id: "PLAYER_Y_PLUS_1CM", playerDelta: { x: 0, y: PERTURBATION_METERS }, companionDelta: { x: 0, y: 0 } },
  { id: "COMPANION_X_MINUS_1CM", playerDelta: { x: 0, y: 0 }, companionDelta: { x: -PERTURBATION_METERS, y: 0 } },
  { id: "COMPANION_X_PLUS_1CM", playerDelta: { x: 0, y: 0 }, companionDelta: { x: PERTURBATION_METERS, y: 0 } },
  { id: "COMPANION_Y_MINUS_1CM", playerDelta: { x: 0, y: 0 }, companionDelta: { x: 0, y: -PERTURBATION_METERS } },
  { id: "COMPANION_Y_PLUS_1CM", playerDelta: { x: 0, y: 0 }, companionDelta: { x: 0, y: PERTURBATION_METERS } }
];

function add(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

function magnitude(value: Vec2): number {
  return Math.hypot(value.x, value.y);
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

function dominates(a: ReachablePoint, b: ReachablePoint): boolean {
  const noWorseSemantic = a.semanticRegret <= b.semanticRegret + EPSILON;
  const noWorseRoute = a.hardCost <= b.hardCost + EPSILON;
  const strictlyBetterSemantic = a.semanticRegret < b.semanticRegret - EPSILON;
  const strictlyBetterRoute = a.hardCost < b.hardCost - EPSILON;
  return noWorseSemantic && noWorseRoute && (strictlyBetterSemantic || strictlyBetterRoute);
}

function paretoFrontier(points: readonly ReachablePoint[]): ReachablePoint[] {
  return points
    .filter((candidate, index) => !points.some((other, otherIndex) => otherIndex !== index && dominates(other, candidate)))
    .sort((a, b) => {
      const semanticDelta = a.semanticRegret - b.semanticRegret;
      if (Math.abs(semanticDelta) > EPSILON) return semanticDelta;
      const routeDelta = a.hardCost - b.hardCost;
      if (Math.abs(routeDelta) > EPSILON) return routeDelta;
      return a.sampleId.localeCompare(b.sampleId);
    });
}

function jaccard(a: readonly string[], b: readonly string[]): number {
  const left = new Set(a);
  const right = new Set(b);
  const union = new Set([...left, ...right]);
  if (union.size === 0) return 1;
  let intersection = 0;
  for (const value of left) if (right.has(value)) intersection += 1;
  return intersection / union.size;
}

async function observeLandscape(snapshot: WorldSnapshot) {
  const orientation = noneOrientation(snapshot.tick);
  const field = sampleA1RelationshipSemanticField({
    orientation,
    sampling: {
      ...A1_DEFAULT_RELATIONSHIP_SAMPLING,
      radii: [...A1_DEFAULT_RELATIONSHIP_SAMPLING.radii],
      nearBestUtilityWindow: 1
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
    const reachable: ReachablePoint[] = projection.samples.flatMap((sample) => {
      if (!reachableIds.has(sample.sampleId) || sample.routeQualification !== "HARD_REACHABLE") return [];
      const hardCost = sample.routeTruth?.hardCost;
      if (hardCost === null || hardCost === undefined || !Number.isFinite(hardCost)) {
        throw new Error(`Pareto audit reachable sample ${sample.sampleId} lacks finite hard-route cost.`);
      }
      return [{
        sampleId: sample.sampleId,
        semanticRegret: field.bestUtility - sample.semanticUtility,
        semanticUtility: sample.semanticUtility,
        hardCost,
        radius: magnitude(sample.relativeOffset),
        worldPosition: { ...sample.worldPosition }
      }];
    });

    expect(reachable.length).toBeGreaterThan(0);
    const frontier = paretoFrontier(reachable);
    expect(frontier.length).toBeGreaterThan(0);
    for (const point of frontier) {
      expect(reachable.some((other) => other.sampleId === point.sampleId)).toBe(true);
      expect(reachable.some((other) => other.sampleId !== point.sampleId && dominates(other, point))).toBe(false);
    }

    return {
      reachableCount: reachable.length,
      frontier,
      frontierIds: frontier.map((point) => point.sampleId),
      projectionCounts: projection.counts
    } as const;
  } finally {
    world.dispose();
  }
}

async function observePerturbationFamily(input: {
  scenarioId: ScenarioId;
  playerPosition: Vec2;
  companionPosition: Vec2;
}) {
  const observations = [] as Array<{
    id: string;
    playerPosition: Vec2;
    companionPosition: Vec2;
    reachableCount: number;
    frontierIds: readonly string[];
    frontier: readonly ReachablePoint[];
    projectionCounts: Awaited<ReturnType<typeof observeLandscape>>["projectionCounts"];
  }>;

  for (const perturbation of PERTURBATIONS) {
    const playerPosition = add(input.playerPosition, perturbation.playerDelta);
    const companionPosition = add(input.companionPosition, perturbation.companionDelta);
    const observation = await observeLandscape(snapshotAt(input.scenarioId, playerPosition, companionPosition));
    observations.push({
      id: perturbation.id,
      playerPosition,
      companionPosition,
      ...observation
    });
  }

  const base = observations.find((observation) => observation.id === "BASE");
  if (!base) throw new Error("Pareto perturbation audit lost BASE observation.");
  const baseIds = new Set(base.frontierIds);

  const summary = {
    scenario: input.scenarioId,
    perturbationMeters: PERTURBATION_METERS,
    semanticSource: "NONE_DIRECTIONLESS",
    observationWindow: 1,
    base: {
      reachableCount: base.reachableCount,
      frontierSize: base.frontier.length,
      frontier: base.frontier
    },
    perturbations: observations
      .filter((observation) => observation.id !== "BASE")
      .map((observation) => ({
        id: observation.id,
        playerPosition: observation.playerPosition,
        companionPosition: observation.companionPosition,
        reachableCount: observation.reachableCount,
        frontierSize: observation.frontier.length,
        frontierJaccardVsBase: jaccard(base.frontierIds, observation.frontierIds),
        addedFrontierSampleIds: observation.frontierIds.filter((sampleId) => !baseIds.has(sampleId)),
        removedFrontierSampleIds: base.frontierIds.filter((sampleId) => !observation.frontierIds.includes(sampleId)),
        frontier: observation.frontier
      })),
    interpretation: {
      winnerSelected: false,
      utilityWeightSelected: false,
      runtimeAuthorityChanged: false,
      qualityThresholdApplied: false
    },
    authority: "NONE_AUDIT_ONLY"
  } as const;

  console.info(`[POST_EXPIRY_DIRECTIONLESS_PARETO_PERTURBATION] ${JSON.stringify(summary)}`);
}

describe("post-expiry directionless Pareto landscape perturbation audit", () => {
  it("observes the full reachable Pareto landscape around the pillar without selecting a policy winner", async () => {
    await observePerturbationFamily({
      scenarioId: "pillar",
      playerPosition: { x: 3.8, y: 4 },
      companionPosition: { x: 5.1, y: 4 }
    });
  });

  it("observes the full reachable Pareto landscape around doorway geometry without selecting a policy winner", async () => {
    await observePerturbationFamily({
      scenarioId: "doorway",
      playerPosition: { x: 4.7, y: 4 },
      companionPosition: { x: 5.4, y: 4.45 }
    });
  });
});
