import { describe, expect, it } from "vitest";
import { S1_PREFERRED_RADIUS } from "../brain/relational-positioning";
import { circleFitsStaticWorld } from "../navigation/static-body-geometry";
import { scenario } from "../world/scenarios";
import type { ActorId, ActorSnapshot, ScenarioId, Vec2, WorldSnapshot } from "../world/types";
import { LabWorld } from "../world/world";
import { buildA1AccessibilityEvidence } from "./a1-accessibility-fragments";
import type { A1RelationshipOrientationEvidence } from "./a1-relationship-orientation";
import { projectA1RelationshipSemanticField } from "./a1-relationship-projection";
import { sampleA1RelationshipSemanticField } from "./a1-relationship-utility";

function magnitude(value: Vec2): number {
  return Math.hypot(value.x, value.y);
}

function actor(snapshot: WorldSnapshot, id: ActorId): ActorSnapshot {
  const value = snapshot.actors.find((candidate) => candidate.id === id);
  if (!value) throw new Error(`Directionless region audit snapshot is missing ${id}.`);
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
  if (length <= 1e-9) throw new Error("Directionless region audit requires nonzero current-relative bearing.");
  return {
    x: player.position.x + (relative.x / length) * S1_PREFERRED_RADIUS,
    y: player.position.y + (relative.y / length) * S1_PREFERRED_RADIUS
  };
}

async function auditDirectionlessSet(snapshot: WorldSnapshot) {
  const world = await LabWorld.create(snapshot.scenarioId);
  try {
    const orientation = noneOrientation(snapshot.tick);
    const field = sampleA1RelationshipSemanticField({ orientation });

    expect(field.orientationSource).toBe("NONE");
    expect(field.orientationSourceTick).toBeNull();
    expect(field.orientationAgeTicks).toBeNull();
    expect(field.orientationStrength).toBe(0);
    expect(field.samplingBasisSource).toBe("WORLD_AXIS_SAMPLING_ONLY");
    expect(field.samplingBasis).toEqual({ x: 1, y: 0 });
    expect(field.samples.length).toBeGreaterThan(0);
    expect(field.semanticEligibleSampleIds.length).toBeGreaterThan(0);

    for (const sample of field.samples) {
      expect(sample.utility.directionalSemanticsActive).toBe(false);
      expect(sample.utility.relativeBearingRadians).toBeNull();
      expect(sample.utility.frontness).toBeNull();
      expect(sample.utility.directionalUtility).toBeNull();
      expect(sample.utility.orientationStrength).toBe(0);
      expect(sample.utility.effectiveDirectionalWeight).toBe(0);
    }

    const projection = projectA1RelationshipSemanticField({
      field,
      snapshot,
      query: (from, to, radius, options) => world.staticCircleTraversal(from, to, radius, options),
      routeBudget: field.semanticEligibleSampleIds.length,
      routeQualificationStrategy: "STRATIFIED_COVERAGE"
    });
    const accessibility = buildA1AccessibilityEvidence({ field, projection });

    expect(projection.routeCoverageComplete).toBe(true);
    expect(projection.counts.routeEvaluated).toBe(projection.counts.routeCandidates);
    expect(projection.counts.untested).toBe(0);
    expect(projection.counts.hardReachable).toBeGreaterThan(0);
    expect(accessibility.coverage).toBe("COMPLETE");
    expect(accessibility.untestedSampleIds).toEqual([]);
    expect(accessibility.confirmedReachableSampleIds.length).toBeGreaterThan(0);
    expect(accessibility.fragments.length).toBeGreaterThan(0);

    for (const sampleId of accessibility.confirmedReachableSampleIds) {
      const projected = projection.samples.find((candidate) => candidate.sampleId === sampleId);
      expect(projected).toBeDefined();
      expect(projected?.semanticEligible).toBe(true);
      expect(projected?.hardFit).toBe(true);
      expect(projected?.routeQualification).toBe("HARD_REACHABLE");
      expect(projected?.routeTruth?.hardReachable).toBe(true);
    }

    for (const fragment of accessibility.fragments) {
      expect(fragment.memberSampleIds.length).toBeGreaterThan(0);
      expect(fragment.memberSampleIds).toContain(fragment.representativeSampleId);
      expect(accessibility.confirmedReachableSampleIds).toContain(fragment.representativeSampleId);
    }

    return { field, projection, accessibility };
  } finally {
    world.dispose();
  }
}

describe("post-expiry directionless region substrate audit", () => {
  it("keeps an orientation-free reachable set in the open-field control", async () => {
    const snapshot = snapshotAt("open", { x: 3, y: 4 }, { x: 8, y: 4 });
    const target = naiveDirectionlessRadialTarget(snapshot);
    expect(circleFitsStaticWorld(snapshot, target, actor(snapshot, "companion").radius)).toBe(true);

    const { projection, accessibility } = await auditDirectionlessSet(snapshot);
    expect(projection.counts.hardInvalid).toBe(0);
    expect(accessibility.confirmedReachableSampleIds.length).toBeGreaterThan(0);
  });

  it("retains legal reachable alternatives beside the pillar where the naive radial point is invalid", async () => {
    const snapshot = snapshotAt("pillar", { x: 3.8, y: 4 }, { x: 5.1, y: 4 });
    const target = naiveDirectionlessRadialTarget(snapshot);
    expect(circleFitsStaticWorld(snapshot, target, actor(snapshot, "companion").radius)).toBe(false);

    const { projection, accessibility } = await auditDirectionlessSet(snapshot);
    expect(projection.counts.hardInvalid).toBeGreaterThan(0);
    expect(accessibility.confirmedReachableSampleIds.length).toBeGreaterThan(0);
  });

  it("retains legal reachable alternatives beside doorway geometry where the naive radial point is invalid", async () => {
    const snapshot = snapshotAt("doorway", { x: 4.7, y: 4 }, { x: 5.4, y: 4.45 });
    const target = naiveDirectionlessRadialTarget(snapshot);
    expect(circleFitsStaticWorld(snapshot, target, actor(snapshot, "companion").radius)).toBe(false);

    const { projection, accessibility } = await auditDirectionlessSet(snapshot);
    expect(projection.counts.hardInvalid).toBeGreaterThan(0);
    expect(accessibility.confirmedReachableSampleIds.length).toBeGreaterThan(0);
  });
});
