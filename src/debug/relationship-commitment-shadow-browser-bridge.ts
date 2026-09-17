import type { RelationalDecision } from "../brain/relational-positioning";
import { buildA1AccessibilityEvidence } from "../coordination/a1-accessibility-fragments";
import { A1AuthorityRuntime } from "../coordination/a1-authority-runtime";
import type { A1RelationshipOrientationEvidence } from "../coordination/a1-relationship-orientation";
import { projectA1RelationshipSemanticField } from "../coordination/a1-relationship-projection";
import {
  A1_DEFAULT_RELATIONSHIP_OBJECTIVE,
  A1_DEFAULT_RELATIONSHIP_SAMPLING,
  sampleA1RelationshipSemanticField
} from "../coordination/a1-relationship-utility";
import {
  buildA1SpatialCommitmentFitEvidence,
  type A1SpatialCommitmentDeclaration,
  type A1SpatialCommitmentFitEvidence
} from "../coordination/a1-spatial-commitment-evidence";
import {
  resolveA1SpatialCommitmentReference,
  type A1RetainedSemanticReferenceBasis,
  type A1SpatialCommitmentReferenceFrame,
  type A1SpatialCommitmentReferenceResolutionEvidence
} from "../coordination/a1-spatial-commitment-reference";
import type { MotionIntent, Vec2, WorldSnapshot } from "../world/types";
import { LabWorld } from "../world/world";

const FLAG = "commitmentshadow";
const SCHEMA = "companion-brain-lab-relationship-commitment-shadow-v1";
const CAPACITY = 480;

interface RelationshipOrientationLike {
  latestEvidence(): A1RelationshipOrientationEvidence | null;
}

interface SceneLike {
  world: LabWorld | null;
  companionMode: string;
  relationshipOrientation: RelationshipOrientationLike;
  a1Authority: A1AuthorityRuntime;
}

interface ComputeIntentsResult {
  before: WorldSnapshot;
  intents: MotionIntent[];
  relationship: RelationalDecision | null;
}

type ComputeIntents = (this: SceneLike, before: WorldSnapshot) => ComputeIntentsResult;

interface CommitmentSource {
  declaration: A1SpatialCommitmentDeclaration;
  sourceSampleId: string;
  sourceSemanticUtility: number;
  sourceAnchorWorldPosition: Vec2;
  sourcePlayerWorldPosition: Vec2;
  sourceOrientation: A1RelationshipOrientationEvidence | null;
}

export interface RelationshipCommitmentShadowFrame {
  tick: number;
  scenarioId: WorldSnapshot["scenarioId"];
  companionMode: string;
  a1Variant: ReturnType<A1AuthorityRuntime["debugState"]>["variant"];
  canonicalOrientation: A1RelationshipOrientationEvidence;
  retainedReferenceEnabled: boolean;
  baselineRelationship: RelationalDecision | null;
  baselineCompanionIntent: MotionIntent | null;
  referenceResolution: A1SpatialCommitmentReferenceResolutionEvidence;
  fit: A1SpatialCommitmentFitEvidence;
}

export interface RelationshipCommitmentShadowSnapshot {
  schema: typeof SCHEMA;
  authority: "NONE_QUERY_ONLY_NO_INTENT_MUTATION";
  armedReferenceFrame: A1SpatialCommitmentReferenceFrame | null;
  retainedReferenceEnabled: boolean;
  source: CommitmentSource | null;
  frameCount: number;
  lastError: string | null;
  frames: RelationshipCommitmentShadowFrame[];
}

export interface RelationshipCommitmentShadowBridge {
  readonly enabled: true;
  readonly schema: typeof SCHEMA;
  armNextFrame(referenceFrame: A1SpatialCommitmentReferenceFrame): void;
  setRetainedReferenceEnabled(enabled: boolean): void;
  clear(): void;
  snapshot(): RelationshipCommitmentShadowSnapshot;
  latest(): RelationshipCommitmentShadowFrame | null;
}

declare global {
  interface Window {
    __relationshipCommitmentShadowBridge?: RelationshipCommitmentShadowBridge;
  }
}

function cloneOrientation(
  value: A1RelationshipOrientationEvidence
): A1RelationshipOrientationEvidence {
  return structuredClone(value);
}

function actor(snapshot: WorldSnapshot, id: "player" | "companion") {
  const value = snapshot.actors.find((candidate) => candidate.id === id);
  if (!value) throw new Error(`Commitment shadow snapshot is missing ${id}.`);
  return value;
}

function cloneIntent(value: MotionIntent | null): MotionIntent | null {
  return value ? { actorId: value.actorId, move: { ...value.move } } : null;
}

function observation(input: {
  world: LabWorld;
  before: WorldSnapshot;
  orientation: A1RelationshipOrientationEvidence;
}) {
  const field = sampleA1RelationshipSemanticField({
    orientation: input.orientation,
    objective: A1_DEFAULT_RELATIONSHIP_OBJECTIVE,
    sampling: A1_DEFAULT_RELATIONSHIP_SAMPLING
  });
  const projection = projectA1RelationshipSemanticField({
    field,
    snapshot: input.before,
    query: (from, to, radius, options) =>
      input.world.staticCircleTraversal(from, to, radius, options),
    routeBudget: field.semanticEligibleSampleIds.length,
    routeQualificationStrategy: "STRATIFIED_COVERAGE"
  });
  const accessibility = buildA1AccessibilityEvidence({ field, projection });
  if (!projection.routeCoverageComplete || accessibility.coverage !== "COMPLETE") {
    throw new Error("Commitment shadow requires complete sampled route coverage.");
  }
  return { field, projection, accessibility };
}

function bestReachable(input: ReturnType<typeof observation>) {
  const reachable = new Set(input.accessibility.confirmedReachableSampleIds);
  const semantic = [...input.field.samples]
    .filter((sample) => reachable.has(sample.id))
    .sort((a, b) => {
      const utilityDelta = b.utility.totalUtility - a.utility.totalUtility;
      return Math.abs(utilityDelta) > 1e-12
        ? utilityDelta
        : a.id.localeCompare(b.id);
    })[0];
  if (!semantic) throw new Error("Commitment shadow declaration has no confirmed reachable semantic candidate.");
  const projected = input.projection.samples.find((sample) => sample.sampleId === semantic.id);
  if (!projected) throw new Error(`Commitment shadow lost projection ${semantic.id}.`);
  return {
    sampleId: semantic.id,
    utility: semantic.utility.totalUtility,
    worldPosition: { ...projected.worldPosition }
  };
}

function orientationRegime(
  orientation: A1RelationshipOrientationEvidence
): A1SpatialCommitmentDeclaration["orientationRegime"] {
  return orientation.samplingBasisSource === "SEMANTIC_ORIENTATION"
    ? "DIRECTIONAL"
    : "DIRECTIONLESS";
}

function retainedBasis(
  orientation: A1RelationshipOrientationEvidence
): A1RetainedSemanticReferenceBasis | null {
  if (
    orientation.samplingBasisSource !== "SEMANTIC_ORIENTATION" ||
    !orientation.direction ||
    orientation.sourceTick === null
  ) {
    return null;
  }
  return {
    provenance: "RETAINED_LAST_SEMANTIC_FRAME",
    direction: { ...orientation.direction },
    sourceTick: orientation.sourceTick
  };
}

function cloneSource(value: CommitmentSource | null): CommitmentSource | null {
  return value ? structuredClone(value) : null;
}

function cloneFrame(value: RelationshipCommitmentShadowFrame): RelationshipCommitmentShadowFrame {
  return structuredClone(value);
}

export function installRelationshipCommitmentShadowBrowserBridge(
  search: string,
  scenePrototype: object
): void {
  const params = new URLSearchParams(search);
  if (params.get(FLAG) !== "1" || window.__relationshipCommitmentShadowBridge) return;

  const prototype = scenePrototype as Record<string, unknown>;
  const originalCompute = prototype.computeIntents;
  if (typeof originalCompute !== "function") {
    throw new Error("Commitment shadow could not locate the R1 computeIntents seam.");
  }

  const compute = originalCompute as ComputeIntents;
  const frames: RelationshipCommitmentShadowFrame[] = [];
  let armedReferenceFrame: A1SpatialCommitmentReferenceFrame | null = null;
  let retainLastSemanticReference = false;
  let source: CommitmentSource | null = null;
  let lastSemanticBasis: A1RetainedSemanticReferenceBasis | null = null;
  let lastObservedTick: number | null = null;
  let lastScenarioId: WorldSnapshot["scenarioId"] | null = null;
  let lastError: string | null = null;

  const resetCommitment = (clearFrames: boolean): void => {
    armedReferenceFrame = null;
    source = null;
    lastSemanticBasis = null;
    lastObservedTick = null;
    lastScenarioId = null;
    lastError = null;
    if (clearFrames) frames.splice(0, frames.length);
  };

  prototype.computeIntents = function(this: SceneLike, before: WorldSnapshot): ComputeIntentsResult {
    const result = compute.call(this, before);

    try {
      const world = this.world;
      const orientation = this.relationshipOrientation.latestEvidence();
      if (!world || !orientation) return result;

      if (
        lastObservedTick !== null &&
        (before.tick < lastObservedTick || (lastScenarioId !== null && before.scenarioId !== lastScenarioId))
      ) {
        resetCommitment(false);
      }
      lastObservedTick = before.tick;
      lastScenarioId = before.scenarioId;

      const semanticBasis = retainedBasis(orientation);
      if (semanticBasis) lastSemanticBasis = semanticBasis;

      if (!source && !armedReferenceFrame) return result;

      const current = observation({ world, before, orientation });

      if (!source && armedReferenceFrame) {
        const best = bestReachable(current);
        const regime = orientationRegime(orientation);
        if (armedReferenceFrame === "PLAYER_RIGID" && regime !== "DIRECTIONAL") {
          throw new Error("PLAYER_RIGID commitment declaration requires live semantic orientation at the declaration tick.");
        }
        source = {
          declaration: {
            kind: "A1_SPATIAL_COMMITMENT_DECLARATION",
            sourceTick: before.tick,
            objectiveSignature: current.field.objectiveSignature,
            orientationRegime: regime,
            referenceFrame: armedReferenceFrame,
            anchorProvenance: "LIVE_QUERY_ONLY_SEMANTIC_BEST_AT_DECLARATION"
          },
          sourceSampleId: best.sampleId,
          sourceSemanticUtility: best.utility,
          sourceAnchorWorldPosition: { ...best.worldPosition },
          sourcePlayerWorldPosition: { ...actor(before, "player").position },
          sourceOrientation: regime === "DIRECTIONAL" ? cloneOrientation(orientation) : null
        };
        armedReferenceFrame = null;
      }

      if (!source) return result;

      const useRetained =
        retainLastSemanticReference &&
        orientation.samplingBasisSource !== "SEMANTIC_ORIENTATION"
          ? lastSemanticBasis
          : null;
      const referenceResolution = resolveA1SpatialCommitmentReference({
        commitmentSourceTick: source.declaration.sourceTick,
        referenceFrame: source.declaration.referenceFrame,
        sourceAnchorWorldPosition: source.sourceAnchorWorldPosition,
        sourcePlayerWorldPosition: source.sourcePlayerWorldPosition,
        currentPlayerWorldPosition: actor(before, "player").position,
        sourceOrientation: source.sourceOrientation,
        currentOrientation: orientation,
        retainedCurrentSemanticBasis: useRetained
      });
      const fit = buildA1SpatialCommitmentFitEvidence({
        declaration: source.declaration,
        referenceResolution,
        field: current.field,
        projection: current.projection,
        accessibility: current.accessibility
      });
      const companionIntent =
        result.intents.find((intent) => intent.actorId === "companion") ?? null;
      frames.push({
        tick: before.tick,
        scenarioId: before.scenarioId,
        companionMode: this.companionMode,
        a1Variant: this.a1Authority.debugState().variant,
        canonicalOrientation: cloneOrientation(orientation),
        retainedReferenceEnabled: retainLastSemanticReference,
        baselineRelationship: result.relationship ? structuredClone(result.relationship) : null,
        baselineCompanionIntent: cloneIntent(companionIntent),
        referenceResolution: structuredClone(referenceResolution),
        fit: structuredClone(fit)
      });
      if (frames.length > CAPACITY) frames.splice(0, frames.length - CAPACITY);
      lastError = null;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      armedReferenceFrame = null;
    }

    return result;
  };

  const snapshot = (): RelationshipCommitmentShadowSnapshot => ({
    schema: SCHEMA,
    authority: "NONE_QUERY_ONLY_NO_INTENT_MUTATION",
    armedReferenceFrame,
    retainedReferenceEnabled: retainLastSemanticReference,
    source: cloneSource(source),
    frameCount: frames.length,
    lastError,
    frames: frames.map(cloneFrame)
  });

  const bridge: RelationshipCommitmentShadowBridge = {
    enabled: true,
    schema: SCHEMA,
    armNextFrame: (referenceFrame) => {
      if (
        referenceFrame !== "WORLD_FIXED" &&
        referenceFrame !== "PLAYER_TRANSLATED" &&
        referenceFrame !== "PLAYER_RIGID"
      ) {
        throw new Error(`Unsupported commitment shadow reference frame: ${String(referenceFrame)}.`);
      }
      resetCommitment(true);
      armedReferenceFrame = referenceFrame;
    },
    setRetainedReferenceEnabled: (enabled) => {
      retainLastSemanticReference = enabled;
    },
    clear: () => {
      retainLastSemanticReference = false;
      resetCommitment(true);
    },
    snapshot,
    latest: () => {
      const value = frames.at(-1);
      return value ? cloneFrame(value) : null;
    }
  };

  Object.defineProperty(window, "__relationshipCommitmentShadowBridge", {
    configurable: false,
    enumerable: false,
    writable: false,
    value: bridge
  });
}
