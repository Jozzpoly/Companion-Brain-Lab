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
  A1_DEFAULT_RELATIONSHIP_SAMPLING,
  sampleA1RelationshipSemanticField
} from "./a1-relationship-utility";

function normalized(direction: Vec2): Vec2 {
  const length = Math.hypot(direction.x, direction.y);
  return { x: direction.x / length, y: direction.y / length };
}

function ownerOrientation(tick: number, rawDirection: Vec2): A1RelationshipOrientationEvidence {
  const direction = normalized(rawDirection);
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
    reason: "orientation continuity audit: exact same relationship objective under changed Owner direction"
  };
}

function snapshotAt(tick: number): WorldSnapshot {
  const spec = scenario("open");
  const body = (id: ActorId): ActorSnapshot => {
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
    actors: [body("player"), body("companion")],
    obstacles: spec.obstacles
  };
}

async function observe(world: LabWorld, tick: number, direction: Vec2) {
  const orientation = ownerOrientation(tick, direction);
  const field = sampleA1RelationshipSemanticField({
    orientation,
    sampling: {
      ...A1_DEFAULT_RELATIONSHIP_SAMPLING,
      radii: [...A1_DEFAULT_RELATIONSHIP_SAMPLING.radii],
      nearBestUtilityWindow: 1
    }
  });
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
  expect(accessibility.fragments.length).toBe(1);
  return { field, projection, accessibility };
}

describe("A1 semantic opportunity continuity versus spatial commitment", () => {
  it("keeps semantic accessibility identity while the same samples rotate substantially in World space", async () => {
    const world = await LabWorld.create("open");
    try {
      const observations = [
        await observe(world, 0, { x: 1, y: 0 }),
        await observe(world, 1, { x: Math.cos(Math.PI / 18), y: Math.sin(Math.PI / 18) }),
        await observe(world, 2, { x: 0, y: 1 }),
        await observe(world, 3, { x: -1, y: 0 })
      ];

      const transitions = [] as Array<Record<string, unknown>>;
      for (let index = 1; index < observations.length; index += 1) {
        const previous = observations[index - 1];
        const current = observations[index];
        if (!previous || !current) continue;
        const continuity = compareA1AccessibilityContinuity({ previous, current });
        expect(continuity.semanticComparability).toBe("COMPARABLE");
        expect(continuity.semanticEligibleOverlapRatio).toBe(1);
        expect(continuity.confirmedReachableOverlapRatio).toBe(1);
        expect(continuity.accessibilityChanged).toBe(false);
        expect(continuity.fragmentMatches).toHaveLength(1);
        expect(continuity.fragmentMatches[0]?.overlapRatio).toBe(1);
        transitions.push({
          previousTick: continuity.previousTick,
          currentTick: continuity.currentTick,
          accessibilityChanged: continuity.accessibilityChanged,
          fragmentOverlap: continuity.fragmentMatches[0]?.overlapRatio,
          representativeSampleId: continuity.fragmentMatches[0]?.currentRepresentativeSampleId,
          representativeWorldDelta: continuity.fragmentMatches[0]?.representativeWorldDelta,
          previousDirection: previous.field.samplingBasis,
          currentDirection: current.field.samplingBasis
        });
      }

      expect(transitions).toHaveLength(3);
      expect(Number(transitions[2]?.representativeWorldDelta)).toBeGreaterThan(1);
      console.info(`[A1_OPPORTUNITY_ORIENTATION_CONTINUITY] ${JSON.stringify({ transitions })}`);
    } finally {
      world.dispose();
    }
  });
});