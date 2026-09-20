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
    reason: "split ambiguity audit: directionless control"
  };
}

function snapshotAt(tick: number, playerPosition: Vec2): WorldSnapshot {
  const spec = scenario("doorway");
  const body = (id: ActorId, position: Vec2): ActorSnapshot => {
    const authored = spec.actors.find((candidate) => candidate.id === id);
    if (!authored) throw new Error(`Doorway scenario is missing ${id}.`);
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
    scenarioId: "doorway",
    width: spec.width,
    height: spec.height,
    actors: [body("player", playerPosition), body("companion", { x: 4.2, y: 4.0 })],
    obstacles: spec.obstacles
  };
}

async function observe(tick: number, playerPosition: Vec2) {
  const field = sampleA1RelationshipSemanticField({
    orientation: noneOrientation(tick),
    sampling: {
      ...A1_DEFAULT_RELATIONSHIP_SAMPLING,
      radii: [...A1_DEFAULT_RELATIONSHIP_SAMPLING.radii],
      nearBestUtilityWindow: 1
    }
  });
  const world = await LabWorld.create("doorway");
  try {
    const projection = projectA1RelationshipSemanticField({
      field,
      snapshot: snapshotAt(tick, playerPosition),
      query: (from, to, radius, options) => world.staticCircleTraversal(from, to, radius, options),
      routeBudget: field.semanticEligibleSampleIds.length,
      routeQualificationStrategy: "STRATIFIED_COVERAGE"
    });
    const accessibility = buildA1AccessibilityEvidence({ field, projection });
    expect(accessibility.coverage).toBe("COMPLETE");
    return { field, projection, accessibility, playerPosition } as const;
  } finally {
    world.dispose();
  }
}

function positionById(observation: Awaited<ReturnType<typeof observe>>, sampleId: string): Vec2 {
  const sample = observation.projection.samples.find((candidate) => candidate.sampleId === sampleId);
  if (!sample) throw new Error(`Split ambiguity audit lost ${sampleId}.`);
  return sample.worldPosition;
}

function nearestFragmentDistance(
  observation: Awaited<ReturnType<typeof observe>>,
  fragmentIndex: number,
  anchor: Vec2
): { distance: number; sampleId: string } {
  const fragment = observation.accessibility.fragments[fragmentIndex];
  if (!fragment) throw new Error(`Split ambiguity audit lost fragment ${fragmentIndex}.`);
  const choices = fragment.memberSampleIds.map((sampleId) => ({
    sampleId,
    distance: distance(positionById(observation, sampleId), anchor)
  })).sort((a, b) => a.distance - b.distance || a.sampleId.localeCompare(b.sampleId));
  const first = choices[0];
  if (!first) throw new Error("Split ambiguity audit found empty fragment.");
  return first;
}

describe("A1 commitment ambiguity across a real accessibility split", () => {
  it("measures whether a parent fragment contains commitments whose translated anchors do not uniquely identify a successor child", async () => {
    const previous = await observe(0, { x: 4.4, y: 4.0 });
    const current = await observe(1, { x: 4.8, y: 4.0 });

    expect(previous.accessibility.fragments).toHaveLength(1);
    expect(current.accessibility.fragments).toHaveLength(2);
    const parent = previous.accessibility.fragments[0]!;
    const playerDelta = {
      x: current.playerPosition.x - previous.playerPosition.x,
      y: current.playerPosition.y - previous.playerPosition.y
    };

    const probes = parent.memberSampleIds.map((sampleId) => {
      const previousPosition = positionById(previous, sampleId);
      const translatedAnchor = {
        x: previousPosition.x + playerDelta.x,
        y: previousPosition.y + playerDelta.y
      };
      const child0 = nearestFragmentDistance(current, 0, translatedAnchor);
      const child1 = nearestFragmentDistance(current, 1, translatedAnchor);
      return {
        parentSampleId: sampleId,
        translatedAnchor,
        child0,
        child1,
        distanceDifference: Math.abs(child0.distance - child1.distance),
        preferredChild: child0.distance < child1.distance ? 0 : child1.distance < child0.distance ? 1 : null
      };
    }).sort((a, b) => a.distanceDifference - b.distanceDifference || a.parentSampleId.localeCompare(b.parentSampleId));

    const mostAmbiguous = probes.slice(0, 12);
    const exactOrNearTies = probes.filter((probe) => probe.distanceDifference <= 1e-9);
    const child0Preferred = probes.filter((probe) => probe.preferredChild === 0).length;
    const child1Preferred = probes.filter((probe) => probe.preferredChild === 1).length;

    expect(probes.length).toBe(parent.memberSampleIds.length);
    expect(child0Preferred).toBeGreaterThan(0);
    expect(child1Preferred).toBeGreaterThan(0);

    console.info(`[A1_OPPORTUNITY_SPLIT_AMBIGUITY] ${JSON.stringify({
      previousPlayerPosition: previous.playerPosition,
      currentPlayerPosition: current.playerPosition,
      parentMemberCount: parent.memberSampleIds.length,
      currentFragments: current.accessibility.fragments.map((fragment, index) => ({
        index,
        memberCount: fragment.memberSampleIds.length,
        representativeSampleId: fragment.representativeSampleId
      })),
      childPreferenceCounts: {
        child0: child0Preferred,
        child1: child1Preferred,
        exactOrNearTie: exactOrNearTies.length
      },
      mostAmbiguous
    })}`);
  });
});