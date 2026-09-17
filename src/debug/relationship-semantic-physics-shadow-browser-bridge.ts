import { intentToward, type RelationalDecision } from "../brain/relational-positioning";
import type { A1RelationshipOrientationEvidence } from "../coordination/a1-relationship-orientation";
import type { PhysicalRehearsalResult } from "../physics/rapier-physical-world";
import type { MotionIntent, Vec2, WorldSnapshot } from "../world/types";
import { LabWorld } from "../world/world";

const FLAG = "semanticshadow";
const SCHEMA = "companion-brain-lab-relationship-semantic-physics-shadow-v1";
const SHADOW_STEPS = 6;
const PREFERRED_RADIUS = 1.45;

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

export interface RelationshipSemanticPhysicsShadowBranch {
  policy: "RETAINED_LIVE_COMMAND" | "RADIAL_NONE_CURRENT_RELATIVE" | "HOLD_CURRENT_BODY";
  companionMove: Vec2;
  companionRawVelocity: Vec2;
  radialTarget: Vec2 | null;
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
    selection: "NONE_RESEARCH_COMPARISON_ONLY";
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
              rehearsal: structuredClone(retained)
            },
            {
              policy: "RADIAL_NONE_CURRENT_RELATIVE",
              companionMove: { ...radialIntent.move },
              companionRawVelocity: radialRaw,
              radialTarget,
              rehearsal: structuredClone(radial)
            },
            {
              policy: "HOLD_CURRENT_BODY",
              companionMove: { x: 0, y: 0 },
              companionRawVelocity: holdRaw,
              radialTarget: null,
              rehearsal: structuredClone(hold)
            }
          ],
          semantics: {
            horizonTicks: 6,
            horizonSeconds: 0.1,
            stateAlignment: "EXACT_PRE_WORLD_STEP_LIVE_STATE",
            physics: "LIVE_RAPIER_WORLD_SNAPSHOT_RESTORE",
            radialSemantics: "DIRECTIONLESS_CURRENT_RELATIVE_RADIUS_ONLY",
            selection: "NONE_RESEARCH_COMPARISON_ONLY",
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
