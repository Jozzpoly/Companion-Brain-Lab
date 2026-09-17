import { intentToward, type RelationalDecision } from "../brain/relational-positioning";
import { buildA1AccessibilityEvidence } from "../coordination/a1-accessibility-fragments";
import type { A1RelationshipOrientationEvidence } from "../coordination/a1-relationship-orientation";
import { projectA1RelationshipSemanticField } from "../coordination/a1-relationship-projection";
import { sampleA1RelationshipSemanticField } from "../coordination/a1-relationship-utility";
import { planStaticShadowRoute } from "../navigation/static-router";
import type { PhysicalRehearsalResult } from "../physics/rapier-physical-world";
import type { MotionIntent, Vec2, WorldSnapshot } from "../world/types";
import { LabWorld } from "../world/world";

const FLAG = "semanticshadow";
const SCHEMA = "companion-brain-lab-relationship-semantic-physics-shadow-v2";
const SHADOW_STEPS = 6;
const PREFERRED_RADIUS = 1.45;
const COST_EPSILON = 1e-12;

interface RelationshipOrientationLike {
  latestEvidence(): A1RelationshipOrientationEvidence | null;
}

interface SceneLike {
  world: LabWorld | null;
  relationshipOrientation: RelationshipOrientationLike;
}

interface ComputeIntentsResult {
  before: WorldSnapshot;
  intents: MotionIntent[];
  relationship: RelationalDecision | null;
}

type ComputeIntents = (this: SceneLike, before: WorldSnapshot) => ComputeIntentsResult;

export interface RelationshipSemanticPhysicsShadowA1Research {
  selectionHypothesis: "MINIMUM_HARD_ROUTE_WITHIN_DIRECTIONLESS_NEAR_BEST_SET";
  samplingBasisSource: "WORLD_AXIS_SAMPLING_ONLY";
  directionalSemanticsActive: false;
  routeCoverageComplete: true;
  semanticEligibleCount: number;
  hardReachableCount: number;
  fragmentCount: number;
  selectedSampleId: string;
  selectedTarget: Vec2;
  selectedSemanticUtility: number;
  selectedHardRouteCost: number;
  selectedRouteStatus: "direct" | "routed";
  selectedRouteNodeIds: readonly string[];
  selectedRouteWaypoints: readonly Vec2[];
  commandTarget: Vec2;
}

export interface RelationshipSemanticPhysicsShadowBranch {
  policy:
    | "RETAINED_LIVE_COMMAND"
    | "RADIAL_NONE_CURRENT_RELATIVE"
    | "HOLD_CURRENT_BODY"
    | "A1_DIRECTIONLESS_MIN_HARD_ROUTE";
  companionMove: Vec2;
  companionRawVelocity: Vec2;
  radialTarget: Vec2 | null;
  a1Research: RelationshipSemanticPhysicsShadowA1Research | null;
  rehearsal: PhysicalRehearsalResult;
}

export interface RelationshipSemanticPhysicsShadowCapture {
  sourceTick: number;
  historicalFrameForTriggerOnly: Vec2;
  canonicalOrientation: A1RelationshipOrientationEvidence;
  baselineRelationship: RelationalDecision;
  playerIntent: MotionIntent;
  retainedCompanionIntent: MotionIntent;
  sourceSnapshot: WorldSnapshot;
  branches: readonly RelationshipSemanticPhysicsShadowBranch[];
  semantics: {
    horizonTicks: 6;
    horizonSeconds: 0.1;
    stateAlignment: "EXACT_PRE_WORLD_STEP_LIVE_STATE";
    physics: "LIVE_RAPIER_WORLD_SNAPSHOT_RESTORE";
    radialSemantics: "DIRECTIONLESS_CURRENT_RELATIVE_RADIUS_ONLY";
    researchSelection: "A1_DIRECTIONLESS_MIN_HARD_ROUTE_BRANCH_ONLY";
    runtimeSelection: "NONE";
    movementAuthority: "NONE_SHADOW_ONLY";
    liveWorldMutation: "NONE_QUERY_ONLY_CLONES";
  };
}

export interface RelationshipSemanticPhysicsShadowSnapshot {
  schema: typeof SCHEMA;
  authority: "NONE_QUERY_ONLY_LIVE_RAPIER_SNAPSHOT_CLONES";
  armed: boolean;
  capture: RelationshipSemanticPhysicsShadowCapture | null;
}

export interface RelationshipSemanticPhysicsShadowBridge {
  readonly enabled: true;
  readonly schema: typeof SCHEMA;
  armNextDisturbedNoneReconsideration(historicalFrameForTriggerOnly: Vec2): void;
  clear(): void;
  snapshot(): RelationshipSemanticPhysicsShadowSnapshot;
}

declare global {
  interface Window {
    __relationshipSemanticPhysicsShadowBridge?: RelationshipSemanticPhysicsShadowBridge;
  }
}

function magnitude(value: Vec2): number {
  return Math.hypot(value.x, value.y);
}

function normalized(value: Vec2, label: string): Vec2 {
  if (!Number.isFinite(value.x) || !Number.isFinite(value.y)) {
    throw new Error(`${label} requires finite x/y components.`);
  }
  const length = magnitude(value);
  if (length <= 1e-9) throw new Error(`${label} requires a nonzero direction.`);
  return { x: value.x / length, y: value.y / length };
}

function actor(snapshot: WorldSnapshot, id: "player" | "companion") {
  const value = snapshot.actors.find((candidate) => candidate.id === id);
  if (!value) throw new Error(`Semantic physics shadow snapshot is missing ${id}.`);
  return value;
}

function cloneIntent(value: MotionIntent): MotionIntent {
  return { actorId: value.actorId, move: { ...value.move } };
}

function assertWorldAligned(world: LabWorld, before: WorldSnapshot): void {
  const live = world.snapshot();
  if (live.tick !== before.tick || live.scenarioId !== before.scenarioId) {
    throw new Error("Semantic physics shadow World is not aligned with the current decision snapshot.");
  }
  for (const id of ["player", "companion"] as const) {
    const a = actor(live, id).position;
    const b = actor(before, id).position;
    if (Math.hypot(a.x - b.x, a.y - b.y) > 1e-8) {
      throw new Error(`Semantic physics shadow live ${id} position is not aligned with decision state.`);
    }
  }
}

function assertWorldUnchanged(world: LabWorld, before: WorldSnapshot): void {
  const after = world.snapshot();
  if (after.tick !== before.tick) throw new Error("Semantic physics shadow rehearsal advanced live World time.");
  for (const id of ["player", "companion"] as const) {
    const a = actor(after, id).position;
    const b = actor(before, id).position;
    if (Math.hypot(a.x - b.x, a.y - b.y) > 1e-8) {
      throw new Error(`Semantic physics shadow rehearsal mutated live ${id} position.`);
    }
  }
}

function repeatedSequence(playerVelocity: Vec2, companionVelocity: Vec2) {
  return Array.from({ length: SHADOW_STEPS }, () => [
    { actorId: "player" as const, velocity: { ...playerVelocity } },
    { actorId: "companion" as const, velocity: { ...companionVelocity } }
  ]);
}

function buildDirectionlessA1Branch(input: {
  world: LabWorld;
  before: WorldSnapshot;
  orientation: A1RelationshipOrientationEvidence;
  companionSpeed: number;
  rawPlayer: Vec2;
}): RelationshipSemanticPhysicsShadowBranch {
  if (
    input.orientation.source !== "NONE" ||
    input.orientation.direction !== null ||
    input.orientation.strength !== 0 ||
    input.orientation.samplingBasisSource !== "WORLD_AXIS_SAMPLING_ONLY"
  ) {
    throw new Error("Directionless A1 shadow branch requires canonical semantic NONE.");
  }

  const field = sampleA1RelationshipSemanticField({ orientation: input.orientation });
  if (
    field.samples.some((sample) =>
      sample.utility.directionalSemanticsActive ||
      sample.utility.directionalUtility !== null ||
      sample.utility.effectiveDirectionalWeight !== 0
    )
  ) {
    throw new Error("Directionless A1 shadow field unexpectedly activated directional utility.");
  }

  const projection = projectA1RelationshipSemanticField({
    field,
    snapshot: input.before,
    query: (from, to, radius, options) => input.world.staticCircleTraversal(from, to, radius, options),
    routeBudget: field.semanticEligibleSampleIds.length,
    routeQualificationStrategy: "STRATIFIED_COVERAGE"
  });
  const accessibility = buildA1AccessibilityEvidence({ field, projection });
  if (!projection.routeCoverageComplete || accessibility.coverage !== "COMPLETE") {
    throw new Error("Directionless A1 shadow selection requires complete route coverage.");
  }

  const reachableIds = new Set(accessibility.confirmedReachableSampleIds);
  const candidates = projection.samples.flatMap((sample) => {
    if (!reachableIds.has(sample.sampleId) || sample.routeQualification !== "HARD_REACHABLE") return [];
    const hardCost = sample.routeTruth?.hardCost;
    if (hardCost === null || hardCost === undefined || !Number.isFinite(hardCost)) {
      throw new Error(`Directionless A1 reachable sample ${sample.sampleId} lacks finite hard-route cost.`);
    }
    return [{ sample, hardCost }];
  });
  candidates.sort((a, b) => {
    const costDelta = a.hardCost - b.hardCost;
    if (Math.abs(costDelta) > COST_EPSILON) return costDelta;
    const utilityDelta = b.sample.semanticUtility - a.sample.semanticUtility;
    if (Math.abs(utilityDelta) > COST_EPSILON) return utilityDelta;
    return a.sample.sampleId.localeCompare(b.sample.sampleId);
  });

  const selected = candidates[0];
  if (!selected) throw new Error("Directionless A1 shadow set has no hard-reachable candidate.");
  const companion = actor(input.before, "companion");
  const route = planStaticShadowRoute({
    snapshot: input.before,
    start: companion.position,
    target: selected.sample.worldPosition,
    radius: companion.radius,
    clearance: 0,
    query: (from, to, radius, options) => input.world.staticCircleTraversal(from, to, radius, options)
  });
  if (route.status !== "direct" && route.status !== "routed") {
    throw new Error(`Directionless A1 selected reachable sample produced ${route.status} route.`);
  }
  const commandTarget = route.waypoints[0] ?? selected.sample.worldPosition;
  const intent = intentToward(input.before, commandTarget);
  const rawVelocity = {
    x: intent.move.x * input.companionSpeed,
    y: intent.move.y * input.companionSpeed
  };
  const rehearsal = input.world.rehearseVelocitySequence(
    repeatedSequence(input.rawPlayer, rawVelocity)
  );

  return {
    policy: "A1_DIRECTIONLESS_MIN_HARD_ROUTE",
    companionMove: { ...intent.move },
    companionRawVelocity: rawVelocity,
    radialTarget: null,
    a1Research: {
      selectionHypothesis: "MINIMUM_HARD_ROUTE_WITHIN_DIRECTIONLESS_NEAR_BEST_SET",
      samplingBasisSource: "WORLD_AXIS_SAMPLING_ONLY",
      directionalSemanticsActive: false,
      routeCoverageComplete: true,
      semanticEligibleCount: field.semanticEligibleSampleIds.length,
      hardReachableCount: accessibility.confirmedReachableSampleIds.length,
      fragmentCount: accessibility.fragments.length,
      selectedSampleId: selected.sample.sampleId,
      selectedTarget: { ...selected.sample.worldPosition },
      selectedSemanticUtility: selected.sample.semanticUtility,
      selectedHardRouteCost: selected.hardCost,
      selectedRouteStatus: route.status,
      selectedRouteNodeIds: [...route.routeNodeIds],
      selectedRouteWaypoints: route.waypoints.map((waypoint) => ({ ...waypoint })),
      commandTarget: { ...commandTarget }
    },
    rehearsal
  };
}

export function installRelationshipSemanticPhysicsShadowBrowserBridge(
  search: string,
  scenePrototype: object
): void {
  const params = new URLSearchParams(search);
  if (params.get(FLAG) !== "1" || window.__relationshipSemanticPhysicsShadowBridge) return;

  const prototype = scenePrototype as Record<string, unknown>;
  const originalCompute = prototype.computeIntents;
  if (typeof originalCompute !== "function") {
    throw new Error("Semantic physics shadow bridge could not locate the R1 computeIntents seam.");
  }

  let historicalFrameForTriggerOnly: Vec2 | null = null;
  let capture: RelationshipSemanticPhysicsShadowCapture | null = null;
  const compute = originalCompute as ComputeIntents;

  prototype.computeIntents = function(this: SceneLike, before: WorldSnapshot): ComputeIntentsResult {
    const result = compute.call(this, before);
    const world = this.world;
    const orientation = this.relationshipOrientation.latestEvidence();
    const relationship = result.relationship;
    const playerIntent = result.intents.find((intent) => intent.actorId === "player") ?? null;
    const companionIntent = result.intents.find((intent) => intent.actorId === "companion") ?? null;

    if (
      historicalFrameForTriggerOnly &&
      !capture &&
      world &&
      orientation?.source === "NONE" &&
      orientation.direction === null &&
      relationship?.reconsideredAtTick === before.tick &&
      relationship.semanticFrame?.evidenceSource === "NONE" &&
      relationship.semanticFrame?.frameProvenance === "RETAINED_LAST_SEMANTIC_FRAME" &&
      playerIntent &&
      magnitude(playerIntent.move) < 0.08 &&
      companionIntent
    ) {
      const frame = normalized(historicalFrameForTriggerOnly, "semantic physics shadow trigger frame");
      const player = actor(before, "player");
      const companion = actor(before, "companion");
      const externallyDrivenOpposite =
        magnitude(player.requestedVelocity) < 0.08 &&
        player.actualVelocity.x * frame.x + player.actualVelocity.y * frame.y < -0.15 &&
        player.contacts.some((contact) => contact.with === "companion" && contact.contactCount > 0);

      if (externallyDrivenOpposite) {
        assertWorldAligned(world, before);
        const companionSpeed = world.actorMovementCapability("companion").maxSpeed;
        const relative = {
          x: companion.position.x - player.position.x,
          y: companion.position.y - player.position.y
        };
        const relativeDirection = normalized(relative, "directionless radial current-relative pose");
        const radialTarget = {
          x: player.position.x + relativeDirection.x * PREFERRED_RADIUS,
          y: player.position.y + relativeDirection.y * PREFERRED_RADIUS
        };
        const radialIntent = intentToward(before, radialTarget);
        const rawPlayer = { x: 0, y: 0 };
        const retainedRaw = {
          x: companionIntent.move.x * companionSpeed,
          y: companionIntent.move.y * companionSpeed
        };
        const radialRaw = {
          x: radialIntent.move.x * companionSpeed,
          y: radialIntent.move.y * companionSpeed
        };
        const holdRaw = { x: 0, y: 0 };

        const retained = world.rehearseVelocitySequence(repeatedSequence(rawPlayer, retainedRaw));
        const radial = world.rehearseVelocitySequence(repeatedSequence(rawPlayer, radialRaw));
        const hold = world.rehearseVelocitySequence(repeatedSequence(rawPlayer, holdRaw));
        const a1Directionless = buildDirectionlessA1Branch({
          world,
          before,
          orientation,
          companionSpeed,
          rawPlayer
        });
        assertWorldUnchanged(world, before);

        capture = {
          sourceTick: before.tick,
          historicalFrameForTriggerOnly: { ...frame },
          canonicalOrientation: structuredClone(orientation),
          baselineRelationship: structuredClone(relationship),
          playerIntent: cloneIntent(playerIntent),
          retainedCompanionIntent: cloneIntent(companionIntent),
          sourceSnapshot: structuredClone(before),
          branches: [
            {
              policy: "RETAINED_LIVE_COMMAND",
              companionMove: { ...companionIntent.move },
              companionRawVelocity: retainedRaw,
              radialTarget: null,
              a1Research: null,
              rehearsal: structuredClone(retained)
            },
            {
              policy: "RADIAL_NONE_CURRENT_RELATIVE",
              companionMove: { ...radialIntent.move },
              companionRawVelocity: radialRaw,
              radialTarget,
              a1Research: null,
              rehearsal: structuredClone(radial)
            },
            {
              policy: "HOLD_CURRENT_BODY",
              companionMove: { x: 0, y: 0 },
              companionRawVelocity: holdRaw,
              radialTarget: null,
              a1Research: null,
              rehearsal: structuredClone(hold)
            },
            {
              ...a1Directionless,
              rehearsal: structuredClone(a1Directionless.rehearsal),
              a1Research: a1Directionless.a1Research
                ? structuredClone(a1Directionless.a1Research)
                : null
            }
          ],
          semantics: {
            horizonTicks: 6,
            horizonSeconds: 0.1,
            stateAlignment: "EXACT_PRE_WORLD_STEP_LIVE_STATE",
            physics: "LIVE_RAPIER_WORLD_SNAPSHOT_RESTORE",
            radialSemantics: "DIRECTIONLESS_CURRENT_RELATIVE_RADIUS_ONLY",
            researchSelection: "A1_DIRECTIONLESS_MIN_HARD_ROUTE_BRANCH_ONLY",
            runtimeSelection: "NONE",
            movementAuthority: "NONE_SHADOW_ONLY",
            liveWorldMutation: "NONE_QUERY_ONLY_CLONES"
          }
        };
        historicalFrameForTriggerOnly = null;
      }
    }

    return result;
  };

  const bridge: RelationshipSemanticPhysicsShadowBridge = {
    enabled: true,
    schema: SCHEMA,
    armNextDisturbedNoneReconsideration: (value) => {
      historicalFrameForTriggerOnly = normalized(value, "semantic physics shadow historical trigger frame");
      capture = null;
    },
    clear: () => {
      historicalFrameForTriggerOnly = null;
      capture = null;
    },
    snapshot: () => ({
      schema: SCHEMA,
      authority: "NONE_QUERY_ONLY_LIVE_RAPIER_SNAPSHOT_CLONES",
      armed: historicalFrameForTriggerOnly !== null,
      capture: capture ? structuredClone(capture) : null
    })
  };

  Object.defineProperty(window, "__relationshipSemanticPhysicsShadowBridge", {
    configurable: false,
    enumerable: false,
    writable: false,
    value: bridge
  });
}
