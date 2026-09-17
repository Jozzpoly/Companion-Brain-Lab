import type { StaticTraversalQuery } from "../navigation/static-router";
import type { Vec2, WorldSnapshot } from "../world/types";
import {
  buildA1AccessibilityEvidence,
  compareA1AccessibilityContinuity,
  type A1AccessibilityContinuityEvidence,
  type A1AccessibilityEvidence
} from "./a1-accessibility-fragments";
import {
  evaluateA1RelationshipOrientation,
  type A1RelationshipOrientationEvidence,
  type A1RelationshipOrientationMemory
} from "./a1-relationship-orientation";
import {
  projectA1RelationshipSemanticField,
  type A1RelationshipProjectionField,
  type A1RouteQualificationStrategy
} from "./a1-relationship-projection";
import {
  A1_DEFAULT_RELATIONSHIP_OBJECTIVE,
  A1_DEFAULT_RELATIONSHIP_SAMPLING,
  sampleA1RelationshipSemanticField,
  type A1RelationshipObjectiveProfile,
  type A1RelationshipSamplingConfig,
  type A1RelationshipSemanticField
} from "./a1-relationship-utility";
import type { A1Situation } from "./a1-situation";

const ALIGNMENT_EPSILON = 1e-9;

export const A1_RELATIONSHIP_HEAVY_INTERVAL_TICKS = 6;
export const A1_RELATIONSHIP_OBSERVER_ROUTE_BUDGET = 12;
export const A1_RELATIONSHIP_OBSERVER_ROUTE_STRATEGY: A1RouteQualificationStrategy = "STRATIFIED_COVERAGE";

export interface A1RelationshipObserverConfig {
  heavyIntervalTicks: number;
  routeBudget: number;
  routeQualificationStrategy: A1RouteQualificationStrategy;
  objective: A1RelationshipObjectiveProfile;
  sampling: A1RelationshipSamplingConfig;
}

interface A1HeavyRelationshipObservation {
  field: A1RelationshipSemanticField;
  projection: A1RelationshipProjectionField;
  accessibility: A1AccessibilityEvidence;
  continuity: A1AccessibilityContinuityEvidence | null;
}

export interface A1RelationshipObserverDebug {
  lastAttemptTick: number | null;
  latestTick: number | null;
  observations: number;
  heavyAttempts: number;
  heavyEvaluations: number;
  lastHeavyAttemptTick: number | null;
  orientation: {
    source: A1RelationshipOrientationEvidence["source"];
    sourceTick: number | null;
    ageTicks: number | null;
    strength: number;
    direction: Vec2 | null;
  } | null;
  semantic: {
    sourceTick: number;
    objectiveSignature: string;
    samplingSignature: string;
    eligibleSamples: number;
    bestUtility: number;
  } | null;
  heavy: {
    sourceTick: number;
    ageTicks: number;
    coverage: A1AccessibilityEvidence["coverage"];
    qualificationStrategy: A1RelationshipProjectionField["routeQualificationStrategy"];
    fragments: number;
    hardReachable: number;
    hardUnreachable: number;
    untested: number;
    staticTraversalQueries: number;
    continuityComparability: A1AccessibilityContinuityEvidence["semanticComparability"] | null;
    continuityNonComparabilityReason: A1AccessibilityContinuityEvidence["nonComparabilityReason"];
    accessibilityChanged: boolean | null;
  } | null;
}

function vectorDistance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function cloneObjective(value: A1RelationshipObjectiveProfile): A1RelationshipObjectiveProfile {
  const radial = { ...value.radial };
  if (value.directional.kind === "NONE") return { radial, directional: { kind: "NONE" } };
  if (value.directional.kind === "AVOID_FORWARD_HEMISPHERE") {
    return { radial, directional: { ...value.directional } };
  }
  return { radial, directional: { ...value.directional } };
}

function cloneSampling(value: A1RelationshipSamplingConfig): A1RelationshipSamplingConfig {
  return {
    directions: value.directions,
    radii: [...value.radii],
    nearBestUtilityWindow: value.nearBestUtilityWindow
  };
}

function cloneOrientationMemory(
  value: A1RelationshipOrientationMemory | null
): A1RelationshipOrientationMemory | null {
  return value
    ? {
        provenance: "OWNER_CONTROL",
        direction: { ...value.direction },
        sourceTick: value.sourceTick,
        sourceStrength: value.sourceStrength
      }
    : null;
}

function cloneOrientationEvidence(value: A1RelationshipOrientationEvidence): A1RelationshipOrientationEvidence {
  return {
    tick: value.tick,
    source: value.source,
    direction: value.direction ? { ...value.direction } : null,
    sourceTick: value.sourceTick,
    ageTicks: value.ageTicks,
    strength: value.strength,
    samplingBasis: { ...value.samplingBasis },
    samplingBasisSource: value.samplingBasisSource,
    nextMemory: cloneOrientationMemory(value.nextMemory),
    reason: value.reason
  };
}

function validateProvidedOrientation(
  situation: A1Situation,
  value: A1RelationshipOrientationEvidence
): A1RelationshipOrientationEvidence {
  if (value.tick !== situation.tick) {
    throw new Error(
      `A1 relationship observer external orientation must match situation tick: orientation t${value.tick}, situation t${situation.tick}.`
    );
  }

  if (value.source === "NONE") {
    if (
      value.direction !== null ||
      value.sourceTick !== null ||
      value.ageTicks !== null ||
      value.strength !== 0 ||
      value.nextMemory !== null
    ) {
      throw new Error("A1 relationship observer NONE orientation must be empty and memory-free.");
    }
    return cloneOrientationEvidence(value);
  }

  if (
    value.direction === null ||
    value.sourceTick === null ||
    value.ageTicks === null ||
    !Number.isFinite(value.strength) ||
    value.strength <= 0 ||
    !value.nextMemory
  ) {
    throw new Error("A1 relationship observer Owner-derived external orientation is incomplete.");
  }
  if (value.sourceTick + value.ageTicks !== situation.tick) {
    throw new Error("A1 relationship observer external orientation age does not match the situation tick.");
  }
  if (value.source === "SAME_STEP_OWNER" && (value.sourceTick !== situation.tick || value.ageTicks !== 0)) {
    throw new Error("A1 SAME_STEP_OWNER external orientation must originate at the current situation tick.");
  }
  if (
    value.nextMemory.provenance !== "OWNER_CONTROL" ||
    value.nextMemory.sourceTick !== value.sourceTick
  ) {
    throw new Error("A1 relationship observer external orientation memory provenance does not match its evidence.");
  }
  return cloneOrientationEvidence(value);
}

function validateConfig(input: Partial<A1RelationshipObserverConfig>): A1RelationshipObserverConfig {
  const heavyIntervalTicks = input.heavyIntervalTicks ?? A1_RELATIONSHIP_HEAVY_INTERVAL_TICKS;
  const routeBudget = input.routeBudget ?? A1_RELATIONSHIP_OBSERVER_ROUTE_BUDGET;
  if (!Number.isInteger(heavyIntervalTicks) || heavyIntervalTicks <= 0) {
    throw new Error("A1 relationship observer heavy interval must be a positive integer number of World ticks.");
  }
  if (!Number.isInteger(routeBudget) || routeBudget < 0) {
    throw new Error("A1 relationship observer route budget must be a non-negative integer.");
  }
  return {
    heavyIntervalTicks,
    routeBudget,
    routeQualificationStrategy: input.routeQualificationStrategy ?? A1_RELATIONSHIP_OBSERVER_ROUTE_STRATEGY,
    objective: cloneObjective(input.objective ?? A1_DEFAULT_RELATIONSHIP_OBJECTIVE),
    sampling: cloneSampling(input.sampling ?? A1_DEFAULT_RELATIONSHIP_SAMPLING)
  };
}

function validateSituationSnapshotAlignment(situation: A1Situation, snapshot: WorldSnapshot): void {
  if (situation.tick !== snapshot.tick || situation.situated.tick !== snapshot.tick) {
    throw new Error("A1 relationship observer requires same-tick situation and World snapshot evidence.");
  }
  const player = snapshot.actors.find((actor) => actor.id === "player");
  const companion = snapshot.actors.find((actor) => actor.id === "companion");
  if (!player || !companion) {
    throw new Error("A1 relationship observer requires player and companion actors in the World snapshot.");
  }
  const aligned =
    vectorDistance(player.position, situation.situated.playerBody.position) <= ALIGNMENT_EPSILON &&
    vectorDistance(player.requestedVelocity, situation.situated.playerBody.requestedVelocity) <= ALIGNMENT_EPSILON &&
    vectorDistance(player.actualVelocity, situation.situated.playerBody.actualVelocity) <= ALIGNMENT_EPSILON &&
    vectorDistance(companion.position, situation.situated.companionBody.position) <= ALIGNMENT_EPSILON &&
    vectorDistance(companion.requestedVelocity, situation.situated.companionBody.requestedVelocity) <= ALIGNMENT_EPSILON &&
    vectorDistance(companion.actualVelocity, situation.situated.companionBody.actualVelocity) <= ALIGNMENT_EPSILON;
  if (!aligned) {
    throw new Error("A1 relationship observer situation/body evidence does not match the supplied World snapshot.");
  }
}

export class A1RelationshipObserver {
  private readonly config: A1RelationshipObserverConfig;
  private orientationMemoryValue: A1RelationshipOrientationMemory | null = null;
  private latestOrientationValue: A1RelationshipOrientationEvidence | null = null;
  private latestSemanticValue: A1RelationshipSemanticField | null = null;
  private latestHeavyValue: A1HeavyRelationshipObservation | null = null;
  private lastAttemptTickValue: number | null = null;
  private latestTickValue: number | null = null;
  private lastHeavyAttemptTickValue: number | null = null;
  private observationsValue = 0;
  private heavyAttemptsValue = 0;
  private heavyEvaluationsValue = 0;

  constructor(config: Partial<A1RelationshipObserverConfig> = {}) {
    this.config = validateConfig(config);
  }

  reset(): void {
    this.orientationMemoryValue = null;
    this.latestOrientationValue = null;
    this.latestSemanticValue = null;
    this.latestHeavyValue = null;
    this.lastAttemptTickValue = null;
    this.latestTickValue = null;
    this.lastHeavyAttemptTickValue = null;
    this.observationsValue = 0;
    this.heavyAttemptsValue = 0;
    this.heavyEvaluationsValue = 0;
  }

  observe(input: {
    situation: A1Situation;
    snapshot: WorldSnapshot;
    query: StaticTraversalQuery;
    orientation?: A1RelationshipOrientationEvidence;
  }): A1RelationshipObserverDebug {
    if (this.lastAttemptTickValue !== null && input.situation.tick <= this.lastAttemptTickValue) {
      throw new Error(
        `A1 relationship observer must strictly advance World time: attempted t${input.situation.tick} after attempt t${this.lastAttemptTickValue}; duplicate/backward observation requires reset.`
      );
    }
    this.lastAttemptTickValue = input.situation.tick;

    validateSituationSnapshotAlignment(input.situation, input.snapshot);

    const orientation = input.orientation
      ? validateProvidedOrientation(input.situation, input.orientation)
      : evaluateA1RelationshipOrientation({
          situation: input.situation,
          memory: this.orientationMemoryValue
        });
    const field = sampleA1RelationshipSemanticField({
      orientation,
      objective: this.config.objective,
      sampling: this.config.sampling
    });

    this.orientationMemoryValue = cloneOrientationMemory(orientation.nextMemory);
    this.latestOrientationValue = cloneOrientationEvidence(orientation);
    this.latestSemanticValue = field;
    this.latestTickValue = input.situation.tick;
    this.observationsValue += 1;

    const previousHeavy = this.latestHeavyValue;
    const heavyDue = this.lastHeavyAttemptTickValue === null ||
      input.situation.tick - this.lastHeavyAttemptTickValue >= this.config.heavyIntervalTicks;

    if (heavyDue) {
      this.lastHeavyAttemptTickValue = input.situation.tick;
      this.heavyAttemptsValue += 1;
      const projection = projectA1RelationshipSemanticField({
        field,
        snapshot: input.snapshot,
        query: input.query,
        routeBudget: this.config.routeBudget,
        routeQualificationStrategy: this.config.routeQualificationStrategy
      });
      const accessibility = buildA1AccessibilityEvidence({ field, projection });
      const continuity = previousHeavy
        ? compareA1AccessibilityContinuity({
            previous: {
              field: previousHeavy.field,
              projection: previousHeavy.projection,
              accessibility: previousHeavy.accessibility
            },
            current: { field, projection, accessibility }
          })
        : null;
      this.latestHeavyValue = { field, projection, accessibility, continuity };
      this.heavyEvaluationsValue += 1;
    }

    return this.debugState();
  }

  latestOrientationEvidence(): A1RelationshipOrientationEvidence | null {
    return this.latestOrientationValue ? cloneOrientationEvidence(this.latestOrientationValue) : null;
  }

  debugState(): A1RelationshipObserverDebug {
    const latestTick = this.latestTickValue;
    const orientation = this.latestOrientationValue;
    const semantic = this.latestSemanticValue;
    const heavy = this.latestHeavyValue;
    const heavyAge = latestTick !== null && heavy
      ? Math.max(0, latestTick - heavy.projection.sourceTick)
      : null;

    return {
      lastAttemptTick: this.lastAttemptTickValue,
      latestTick,
      observations: this.observationsValue,
      heavyAttempts: this.heavyAttemptsValue,
      heavyEvaluations: this.heavyEvaluationsValue,
      lastHeavyAttemptTick: this.lastHeavyAttemptTickValue,
      orientation: orientation
        ? {
            source: orientation.source,
            sourceTick: orientation.sourceTick,
            ageTicks: orientation.ageTicks,
            strength: orientation.strength,
            direction: orientation.direction ? { ...orientation.direction } : null
          }
        : null,
      semantic: semantic
        ? {
            sourceTick: semantic.sourceTick,
            objectiveSignature: semantic.objectiveSignature,
            samplingSignature: semantic.samplingSignature,
            eligibleSamples: semantic.semanticEligibleSampleIds.length,
            bestUtility: semantic.bestUtility
          }
        : null,
      heavy: heavy && heavyAge !== null
        ? {
            sourceTick: heavy.projection.sourceTick,
            ageTicks: heavyAge,
            coverage: heavy.accessibility.coverage,
            qualificationStrategy: heavy.projection.routeQualificationStrategy,
            fragments: heavy.accessibility.fragments.length,
            hardReachable: heavy.projection.counts.hardReachable,
            hardUnreachable: heavy.projection.counts.hardUnreachable,
            untested: heavy.projection.counts.untested,
            staticTraversalQueries: heavy.projection.counts.staticTraversalQueries,
            continuityComparability: heavy.continuity?.semanticComparability ?? null,
            continuityNonComparabilityReason: heavy.continuity?.nonComparabilityReason ?? null,
            accessibilityChanged: heavy.continuity?.accessibilityChanged ?? null
          }
        : null
    };
  }
}
