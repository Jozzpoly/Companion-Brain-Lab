import { circleFitsStaticWorld } from "../navigation/static-body-geometry";
import { evaluateHardRouteTruth, type HardRouteTruthEvidence } from "../navigation/hard-route-truth";
import { S2C_ROUTE_CLEARANCE, type StaticTraversalQuery } from "../navigation/static-router";
import type { ActorSnapshot, Vec2, WorldSnapshot } from "../world/types";
import type {
  A1RelationshipSemanticField,
  A1RelationshipSemanticSample
} from "./a1-relationship-utility";

export const A1_RELATIONSHIP_ROUTE_BUDGET = 12;

export type A1ProjectionRouteQualification =
  | "NOT_APPLICABLE"
  | "UNTESTED"
  | "HARD_REACHABLE"
  | "HARD_UNREACHABLE";

export interface A1RelationshipProjectionSample {
  sampleId: string;
  semanticEligible: boolean;
  semanticUtility: number;
  relativeOffset: Vec2;
  worldPosition: Vec2;
  hardFit: boolean;
  desiredFit: boolean;
  routeQualification: A1ProjectionRouteQualification;
  routeTruth: HardRouteTruthEvidence | null;
}

export interface A1RelationshipProjectionField {
  kind: "A1_RELATIONSHIP_WORLD_PROJECTION";
  sourceTick: number;
  semanticSourceTick: number;
  playerPosition: Vec2;
  companionPosition: Vec2;
  companionRadius: number;
  desiredClearance: number;
  routeBudget: number;
  routeCoverageComplete: boolean;
  counts: {
    totalSamples: number;
    semanticEligible: number;
    hardFit: number;
    hardInvalid: number;
    routeCandidates: number;
    routeEvaluated: number;
    hardReachable: number;
    hardUnreachable: number;
    untested: number;
    staticTraversalQueries: number;
  };
  samples: readonly A1RelationshipProjectionSample[];
}

function actor(snapshot: WorldSnapshot, id: ActorSnapshot["id"]): ActorSnapshot {
  const result = snapshot.actors.find((candidate) => candidate.id === id);
  if (!result) throw new Error(`A1 relationship projection requires ${id} actor in the World snapshot.`);
  return result;
}

function finiteVector(value: Vec2, label: string): Vec2 {
  if (!Number.isFinite(value.x) || !Number.isFinite(value.y)) {
    throw new Error(`${label} requires finite x/y components.`);
  }
  return { ...value };
}

function validatedBudget(value: number): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error("A1 relationship route budget must be a non-negative integer.");
  }
  return value;
}

function validatedClearance(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("A1 relationship desired clearance must be finite and non-negative.");
  }
  return value;
}

export function projectA1RelativeState(playerPosition: Vec2, relativeOffset: Vec2): Vec2 {
  const player = finiteVector(playerPosition, "A1 player projection position");
  const relative = finiteVector(relativeOffset, "A1 relative projection offset");
  return {
    x: player.x + relative.x,
    y: player.y + relative.y
  };
}

function projectionSample(
  snapshot: WorldSnapshot,
  player: ActorSnapshot,
  companion: ActorSnapshot,
  sample: A1RelationshipSemanticSample,
  desiredClearance: number
): A1RelationshipProjectionSample {
  const worldPosition = projectA1RelativeState(player.position, sample.relativeOffset);
  return {
    sampleId: sample.id,
    semanticEligible: sample.semanticEligible,
    semanticUtility: sample.utility.totalUtility,
    relativeOffset: { ...sample.relativeOffset },
    worldPosition,
    hardFit: circleFitsStaticWorld(snapshot, worldPosition, companion.radius),
    desiredFit: circleFitsStaticWorld(snapshot, worldPosition, companion.radius + desiredClearance),
    routeQualification: "NOT_APPLICABLE",
    routeTruth: null
  };
}

function candidateOrder(
  semanticById: ReadonlyMap<string, A1RelationshipSemanticSample>,
  a: A1RelationshipProjectionSample,
  b: A1RelationshipProjectionSample
): number {
  const semanticA = semanticById.get(a.sampleId);
  const semanticB = semanticById.get(b.sampleId);
  if (!semanticA || !semanticB) throw new Error("A1 projection lost semantic sample provenance.");
  const utilityDelta = semanticB.utility.totalUtility - semanticA.utility.totalUtility;
  if (Math.abs(utilityDelta) > 1e-12) return utilityDelta;
  return a.sampleId.localeCompare(b.sampleId);
}

export function projectA1RelationshipSemanticField(input: {
  field: A1RelationshipSemanticField;
  snapshot: WorldSnapshot;
  query: StaticTraversalQuery;
  routeBudget?: number;
  desiredClearance?: number;
}): A1RelationshipProjectionField {
  if (input.field.sourceTick !== input.snapshot.tick) {
    throw new Error(
      `A1 relationship projection requires current semantic field t${input.snapshot.tick}; received t${input.field.sourceTick}.`
    );
  }

  const routeBudget = validatedBudget(input.routeBudget ?? A1_RELATIONSHIP_ROUTE_BUDGET);
  const desiredClearance = validatedClearance(input.desiredClearance ?? S2C_ROUTE_CLEARANCE);
  const player = actor(input.snapshot, "player");
  const companion = actor(input.snapshot, "companion");
  const semanticById = new Map(input.field.samples.map((sample) => [sample.id, sample]));
  if (semanticById.size !== input.field.samples.length) {
    throw new Error("A1 relationship semantic field contains duplicate sample ids.");
  }

  const samples = input.field.samples.map((sample) =>
    projectionSample(input.snapshot, player, companion, sample, desiredClearance)
  );
  const routeCandidates = samples
    .filter((sample) => sample.semanticEligible && sample.hardFit)
    .sort((a, b) => candidateOrder(semanticById, a, b));

  for (const candidate of routeCandidates) candidate.routeQualification = "UNTESTED";

  let staticTraversalQueries = 0;
  const countedQuery: StaticTraversalQuery = (from, to, radius, options) => {
    staticTraversalQueries += 1;
    return input.query(from, to, radius, options);
  };

  const evaluated = routeCandidates.slice(0, routeBudget);
  for (const candidate of evaluated) {
    const truth = evaluateHardRouteTruth({
      snapshot: input.snapshot,
      start: companion.position,
      target: candidate.worldPosition,
      radius: companion.radius,
      desiredClearance,
      query: countedQuery
    });
    if (truth.sourceTick !== input.snapshot.tick) {
      throw new Error("A1 hard-route truth returned mismatched temporal provenance.");
    }
    candidate.routeTruth = truth;
    candidate.routeQualification = truth.hardReachable ? "HARD_REACHABLE" : "HARD_UNREACHABLE";
  }

  const semanticEligible = samples.filter((sample) => sample.semanticEligible).length;
  const hardFit = samples.filter((sample) => sample.hardFit).length;
  const hardInvalid = samples.length - hardFit;
  const hardReachable = samples.filter((sample) => sample.routeQualification === "HARD_REACHABLE").length;
  const hardUnreachable = samples.filter((sample) => sample.routeQualification === "HARD_UNREACHABLE").length;
  const untested = samples.filter((sample) => sample.routeQualification === "UNTESTED").length;
  const routeEvaluated = hardReachable + hardUnreachable;

  return {
    kind: "A1_RELATIONSHIP_WORLD_PROJECTION",
    sourceTick: input.snapshot.tick,
    semanticSourceTick: input.field.sourceTick,
    playerPosition: { ...player.position },
    companionPosition: { ...companion.position },
    companionRadius: companion.radius,
    desiredClearance,
    routeBudget,
    routeCoverageComplete: routeEvaluated === routeCandidates.length,
    counts: {
      totalSamples: samples.length,
      semanticEligible,
      hardFit,
      hardInvalid,
      routeCandidates: routeCandidates.length,
      routeEvaluated,
      hardReachable,
      hardUnreachable,
      untested,
      staticTraversalQueries
    },
    samples
  };
}
