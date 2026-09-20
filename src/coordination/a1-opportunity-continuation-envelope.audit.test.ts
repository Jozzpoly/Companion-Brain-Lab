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

function normalized(direction: Vec2): Vec2 {
  const length = Math.hypot(direction.x, direction.y);
  if (length <= 1e-12) throw new Error("Continuation-envelope direction must be nonzero.");
  return { x: direction.x / length, y: direction.y / length };
}

function ownerOrientation(tick: number, radians: number): A1RelationshipOrientationEvidence {
  const direction = normalized({ x: Math.cos(radians), y: Math.sin(radians) });
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
    reason: "continuation-envelope audit: controlled Owner orientation"
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

async function observe(world: LabWorld, tick: number, radians: number) {
  const orientation = ownerOrientation(tick, radians);
  const field = sampleA1RelationshipSemanticField({ orientation });
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
  expect(accessibility.fragments.length).toBeGreaterThan(0);

  const semanticById = new Map(field.samples.map((sample) => [sample.id, sample]));
  const projectionById = new Map(projection.samples.map((sample) => [sample.sampleId, sample]));
  const candidates = accessibility.confirmedReachableSampleIds.map((sampleId) => {
    const semantic = semanticById.get(sampleId);
    const projected = projectionById.get(sampleId);
    if (!semantic || !projected) throw new Error(`Continuation envelope lost ${sampleId}.`);
    return {
      sampleId,
      utility: semantic.utility.totalUtility,
      worldPosition: projected.worldPosition,
      relativeOffset: semantic.relativeOffset
    };
  });
  if (candidates.length === 0) throw new Error("Continuation envelope requires at least one reachable candidate.");

  const semanticBest = [...candidates].sort((a, b) => {
    const utilityDelta = b.utility - a.utility;
    if (Math.abs(utilityDelta) > 1e-12) return utilityDelta;
    return a.sampleId.localeCompare(b.sampleId);
  })[0];
  if (!semanticBest) throw new Error("Continuation envelope lost semantic best candidate.");

  return { radians, orientation, field, accessibility, candidates, semanticBest };
}

function nearestContinuation(
  candidates: readonly Awaited<ReturnType<typeof observe>>["candidates"][number][],
  previousWorldTarget: Vec2
) {
  const ordered = [...candidates].sort((a, b) => {
    const displacementDelta = distance(a.worldPosition, previousWorldTarget) - distance(b.worldPosition, previousWorldTarget);
    if (Math.abs(displacementDelta) > 1e-12) return displacementDelta;
    const utilityDelta = b.utility - a.utility;
    if (Math.abs(utilityDelta) > 1e-12) return utilityDelta;
    return a.sampleId.localeCompare(b.sampleId);
  });
  const best = ordered[0];
  if (!best) throw new Error("Continuation envelope has no candidate.");
  return best;
}

async function traceEnvelope(world: LabWorld, degrees: readonly number[]) {
  const observations = [] as Awaited<ReturnType<typeof observe>>[];
  for (const [tick, degreesValue] of degrees.entries()) {
    observations.push(await observe(world, tick, degreesValue * Math.PI / 180));
  }

  const first = observations[0];
  if (!first) throw new Error("Continuation envelope lost initial observation.");
  const initialWorldTarget = { ...first.semanticBest.worldPosition };
  let committedWorldTarget = { ...initialWorldTarget };
  let committedSampleId = first.semanticBest.sampleId;
  const transitions: Array<Record<string, unknown>> = [];

  for (let index = 1; index < observations.length; index += 1) {
    const current = observations[index];
    if (!current) continue;
    const continuation = nearestContinuation(current.candidates, committedWorldTarget);
    const continuationDisplacement = distance(continuation.worldPosition, committedWorldTarget);
    const semanticBestDisplacement = distance(current.semanticBest.worldPosition, committedWorldTarget);
    const utilityGapFromBest = current.semanticBest.utility - continuation.utility;

    transitions.push({
      fromDegrees: degrees[index - 1],
      toDegrees: degrees[index],
      candidateCount: current.candidates.length,
      previousCommittedSampleId: committedSampleId,
      continuationSampleId: continuation.sampleId,
      semanticBestSampleId: current.semanticBest.sampleId,
      continuationDisplacement,
      semanticBestDisplacement,
      avoidedWorldChase: semanticBestDisplacement - continuationDisplacement,
      continuationUtility: continuation.utility,
      semanticBestUtility: current.semanticBest.utility,
      utilityGapFromBest,
      driftFromInitialWorldTarget: distance(continuation.worldPosition, initialWorldTarget),
      continuationRelativeOffset: continuation.relativeOffset
    });

    committedWorldTarget = { ...continuation.worldPosition };
    committedSampleId = continuation.sampleId;
  }

  return {
    initialSampleId: first.semanticBest.sampleId,
    initialWorldTarget,
    transitions,
    summary: {
      maxContinuationDisplacement: Math.max(...transitions.map((transition) => Number(transition.continuationDisplacement))),
      maxSemanticBestDisplacement: Math.max(...transitions.map((transition) => Number(transition.semanticBestDisplacement))),
      maxUtilityGapFromBest: Math.max(...transitions.map((transition) => Number(transition.utilityGapFromBest))),
      finalDriftFromInitialWorldTarget: Number(transitions.at(-1)?.driftFromInitialWorldTarget ?? 0),
      sampleSwitchCount: transitions.filter(
        (transition) => transition.previousCommittedSampleId !== transition.continuationSampleId
      ).length
    }
  };
}

describe("A1 default-window spatial continuation envelope", () => {
  it("maps dense 5-degree continuation pressure through a full half-turn", async () => {
    const world = await LabWorld.create("open");
    try {
      const degrees = Array.from({ length: 37 }, (_, index) => index * 5);
      const trace = await traceEnvelope(world, degrees);
      expect(trace.transitions).toHaveLength(36);
      expect(trace.transitions.every((transition) => Number(transition.candidateCount) > 0)).toBe(true);
      console.info(`[A1_OPPORTUNITY_CONTINUATION_DENSE] ${JSON.stringify({
        samplingWindow: A1_DEFAULT_RELATIONSHIP_SAMPLING.nearBestUtilityWindow,
        ...trace
      })}`);
    } finally {
      world.dispose();
    }
  });

  it("keeps abrupt 90-degree turns as a control rather than conflating them with gradual temporal continuation", async () => {
    const world = await LabWorld.create("open");
    try {
      const trace = await traceEnvelope(world, [0, 90, 180]);
      expect(trace.transitions).toHaveLength(2);
      console.info(`[A1_OPPORTUNITY_CONTINUATION_ABRUPT] ${JSON.stringify({
        samplingWindow: A1_DEFAULT_RELATIONSHIP_SAMPLING.nearBestUtilityWindow,
        ...trace
      })}`);
    } finally {
      world.dispose();
    }
  });
});