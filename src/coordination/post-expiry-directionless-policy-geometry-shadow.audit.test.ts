import { describe, expect, it } from "vitest";
import { S1_PREFERRED_RADIUS } from "../brain/relational-positioning";
import { circleFitsStaticWorld } from "../navigation/static-body-geometry";
import { planStaticShadowRoute } from "../navigation/static-router";
import { scenario } from "../world/scenarios";
import type { ActorId, ActorSnapshot, ScenarioId, Vec2, WorldSnapshot } from "../world/types";
import { LabWorld } from "../world/world";
import { buildA1AccessibilityEvidence } from "./a1-accessibility-fragments";
import type { A1RelationshipOrientationEvidence } from "./a1-relationship-orientation";
import { projectA1RelationshipSemanticField } from "./a1-relationship-projection";
import {
  A1_DEFAULT_RELATIONSHIP_OBJECTIVE,
  sampleA1RelationshipSemanticField
} from "./a1-relationship-utility";

const COST_EPSILON = 1e-12;
const RADIUS_EPSILON = 1e-9;

function magnitude(value: Vec2): number {
  return Math.hypot(value.x, value.y);
}

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function actor(snapshot: WorldSnapshot, id: ActorId): ActorSnapshot {
  const value = snapshot.actors.find((candidate) => candidate.id === id);
  if (!value) throw new Error(`Directionless policy geometry audit snapshot is missing ${id}.`);
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

function naiveDirectionlessRadialTarget(snapshot: WorldSnapshot): Vec2 {
  const player = actor(snapshot, "player");
  const companion = actor(snapshot, "companion");
  const relative = {
    x: companion.position.x - player.position.x,
    y: companion.position.y - player.position.y
  };
  const length = magnitude(relative);
  if (length <= 1e-9) throw new Error("Directionless policy geometry audit requires nonzero current-relative bearing.");
  return {
    x: player.position.x + (relative.x / length) * S1_PREFERRED_RADIUS,
    y: player.position.y + (relative.y / length) * S1_PREFERRED_RADIUS
  };
}

async function auditGeometryPolicy(snapshot: WorldSnapshot) {
  const world = await LabWorld.create(snapshot.scenarioId);
  try {
    const companion = actor(snapshot, "companion");
    expect(circleFitsStaticWorld(snapshot, actor(snapshot, "player").position, actor(snapshot, "player").radius)).toBe(true);
    expect(circleFitsStaticWorld(snapshot, companion.position, companion.radius)).toBe(true);

    const radialTarget = naiveDirectionlessRadialTarget(snapshot);
    expect(circleFitsStaticWorld(snapshot, radialTarget, companion.radius)).toBe(false);
    const radialRoute = planStaticShadowRoute({
      snapshot,
      start: companion.position,
      target: radialTarget,
      radius: companion.radius,
      query: () => {
        throw new Error("Invalid radial target must be rejected before traversal queries execute.");
      }
    });
    expect(radialRoute.status).toBe("invalid-target");
    expect(radialRoute.cost).toBeNull();

    const orientation = noneOrientation(snapshot.tick);
    const field = sampleA1RelationshipSemanticField({ orientation });
    expect(field.orientationSource).toBe("NONE");
    expect(field.orientationStrength).toBe(0);
    expect(field.samplingBasisSource).toBe("WORLD_AXIS_SAMPLING_ONLY");
    expect(field.samples.every((sample) => !sample.utility.directionalSemanticsActive)).toBe(true);

    const query = (from: Vec2, to: Vec2, radius: number, options?: { initialOverlap?: "block" | "allow-egress" }) =>
      world.staticCircleTraversal(from, to, radius, options);
    const projection = projectA1RelationshipSemanticField({
      field,
      snapshot,
      query,
      routeBudget: field.semanticEligibleSampleIds.length,
      routeQualificationStrategy: "STRATIFIED_COVERAGE"
    });
    const accessibility = buildA1AccessibilityEvidence({ field, projection });

    expect(projection.routeCoverageComplete).toBe(true);
    expect(accessibility.coverage).toBe("COMPLETE");
    expect(projection.counts.untested).toBe(0);
    expect(accessibility.confirmedReachableSampleIds.length).toBeGreaterThan(0);

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

    expect(routeFirst).toBeDefined();
    expect(semanticFirst).toBeDefined();
    if (!routeFirst || !semanticFirst) {
      throw new Error("Directionless policy geometry audit found no concrete HARD_REACHABLE candidate.");
    }

    const preferredRadius = A1_DEFAULT_RELATIONSHIP_OBJECTIVE.radial.preferredRadius;
    const preferredReachable = candidates.filter(
      ({ sample }) => Math.abs(magnitude(sample.relativeOffset) - preferredRadius) <= RADIUS_EPSILON
    );
    const bestPreferred = [...preferredReachable].sort((a, b) => {
      const costDelta = a.hardCost - b.hardCost;
      if (Math.abs(costDelta) > COST_EPSILON) return costDelta;
      return a.sample.sampleId.localeCompare(b.sample.sampleId);
    })[0] ?? null;

    expect(routeFirst.sample.hardFit).toBe(true);
    expect(routeFirst.sample.routeQualification).toBe("HARD_REACHABLE");
    expect(routeFirst.sample.routeTruth?.hardReachable).toBe(true);
    expect(circleFitsStaticWorld(snapshot, routeFirst.sample.worldPosition, companion.radius)).toBe(true);
    expect(distance(routeFirst.sample.worldPosition, radialTarget)).toBeGreaterThan(1e-3);

    const route = planStaticShadowRoute({
      snapshot,
      start: companion.position,
      target: routeFirst.sample.worldPosition,
      radius: companion.radius,
      clearance: 0,
      query
    });
    expect(["direct", "routed"]).toContain(route.status);
    expect(route.cost).not.toBeNull();
    expect(route.waypoints.length).toBeGreaterThan(0);

    const commandTarget = route.waypoints[0] ?? routeFirst.sample.worldPosition;
    const commandDelta = {
      x: commandTarget.x - companion.position.x,
      y: commandTarget.y - companion.position.y
    };
    expect(Number.isFinite(commandDelta.x)).toBe(true);
    expect(Number.isFinite(commandDelta.y)).toBe(true);
    expect(magnitude(commandDelta)).toBeGreaterThan(1e-6);

    const summarizeCandidate = (candidate: typeof routeFirst) => ({
      sampleId: candidate.sample.sampleId,
      relativeRadius: magnitude(candidate.sample.relativeOffset),
      target: candidate.sample.worldPosition,
      semanticUtility: candidate.sample.semanticUtility,
      hardRouteCost: candidate.hardCost
    });

    const summary = {
      scenario: snapshot.scenarioId,
      radial: {
        target: radialTarget,
        routeStatus: radialRoute.status
      },
      candidateField: {
        concreteReachableCount: candidates.length,
        preferredRadius,
        preferredReachableCount: preferredReachable.length,
        bestPreferred: bestPreferred ? summarizeCandidate(bestPreferred) : null
      },
      routeFirst: summarizeCandidate(routeFirst),
      semanticFirst: summarizeCandidate(semanticFirst),
      tradeoff: {
        utilityGainSemanticFirst: semanticFirst.sample.semanticUtility - routeFirst.sample.semanticUtility,
        hardCostPenaltySemanticFirst: semanticFirst.hardCost - routeFirst.hardCost,
        sameWinner: semanticFirst.sample.sampleId === routeFirst.sample.sampleId
      },
      execution: {
        selectedRouteStatus: route.status,
        selectedRouteNodeIds: route.routeNodeIds,
        commandTarget,
        fieldCounts: projection.counts,
        fragmentCount: accessibility.fragments.length
      },
      authority: "NONE_AUDIT_ONLY"
    } as const;

    console.info(`[POST_EXPIRY_DIRECTIONLESS_POLICY_ORDERING] ${JSON.stringify(summary)}`);
    return summary;
  } finally {
    world.dispose();
  }
}

function requireRouteCostBiasWitness(summary: Awaited<ReturnType<typeof auditGeometryPolicy>>) {
  expect(summary.candidateField.preferredReachableCount).toBeGreaterThan(0);
  expect(summary.candidateField.bestPreferred).not.toBeNull();
  expect(summary.semanticFirst.relativeRadius).toBeCloseTo(summary.candidateField.preferredRadius, 9);
  expect(summary.routeFirst.relativeRadius).toBeLessThan(summary.candidateField.preferredRadius - RADIUS_EPSILON);
  expect(summary.tradeoff.sameWinner).toBe(false);
  expect(summary.tradeoff.utilityGainSemanticFirst).toBeGreaterThan(0);
  expect(summary.tradeoff.hardCostPenaltySemanticFirst).toBeGreaterThan(0);
}

describe("post-expiry directionless policy geometry shadow audit", () => {
  it("falsifies route-cost-first against reachable preferred-radius semantics beside the pillar", async () => {
    const summary = await auditGeometryPolicy(
      snapshotAt("pillar", { x: 3.8, y: 4 }, { x: 5.1, y: 4 })
    );
    expect(summary.radial.routeStatus).toBe("invalid-target");
    expect(["direct", "routed"]).toContain(summary.execution.selectedRouteStatus);
    requireRouteCostBiasWitness(summary);
  });

  it("falsifies route-cost-first against reachable preferred-radius semantics beside doorway geometry", async () => {
    const summary = await auditGeometryPolicy(
      snapshotAt("doorway", { x: 4.7, y: 4 }, { x: 5.4, y: 4.45 })
    );
    expect(summary.radial.routeStatus).toBe("invalid-target");
    expect(["direct", "routed"]).toContain(summary.execution.selectedRouteStatus);
    requireRouteCostBiasWitness(summary);
  });
});
