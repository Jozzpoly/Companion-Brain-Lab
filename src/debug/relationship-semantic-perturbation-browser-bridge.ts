import type { RelationalDecision } from "../brain/relational-positioning";
import { A1AuthorityRuntime } from "../coordination/a1-authority-runtime";
import type { A1RelationshipOrientationEvidence } from "../coordination/a1-relationship-orientation";
import type { MotionIntent, Vec2, WorldSnapshot } from "../world/types";

const FLAG = "semanticpush";
const SCHEMA = "companion-brain-lab-relationship-semantic-perturbation-v1";
const CAPACITY = 360;

interface RelationshipOrientationLike {
  latestEvidence(): A1RelationshipOrientationEvidence | null;
}

interface SceneLike {
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

export interface RelationshipSemanticPerturbationFrame {
  tick: number;
  apparatusApplied: boolean;
  forcedCompanionMove: Vec2 | null;
  canonicalOrientation: A1RelationshipOrientationEvidence | null;
  baselineRelationship: RelationalDecision | null;
  prePerturbationCompanionIntent: MotionIntent | null;
  executedCompanionIntent: MotionIntent | null;
  a1Variant: ReturnType<A1AuthorityRuntime["debugState"]>["variant"];
}

export interface RelationshipSemanticPerturbationSnapshot {
  schema: typeof SCHEMA;
  authority: "TEST_APPARATUS_PHYSICAL_PERTURBATION_NOT_A1_AUTHORITY";
  forcedCompanionMove: Vec2 | null;
  frameCount: number;
  frames: RelationshipSemanticPerturbationFrame[];
}

export interface RelationshipSemanticPerturbationBridge {
  readonly enabled: true;
  readonly schema: typeof SCHEMA;
  setForcedCompanionMove(move: Vec2 | null): void;
  snapshot(): RelationshipSemanticPerturbationSnapshot;
}

declare global {
  interface Window {
    __relationshipSemanticPerturbationBridge?: RelationshipSemanticPerturbationBridge;
  }
}

function cloneIntent(value: MotionIntent | null): MotionIntent | null {
  return value ? { actorId: value.actorId, move: { ...value.move } } : null;
}

function cloneOrientation(
  value: A1RelationshipOrientationEvidence | null
): A1RelationshipOrientationEvidence | null {
  return value ? structuredClone(value) : null;
}

function cloneRelationship(value: RelationalDecision | null): RelationalDecision | null {
  return value ? structuredClone(value) : null;
}

function cloneFrame(value: RelationshipSemanticPerturbationFrame): RelationshipSemanticPerturbationFrame {
  return {
    tick: value.tick,
    apparatusApplied: value.apparatusApplied,
    forcedCompanionMove: value.forcedCompanionMove ? { ...value.forcedCompanionMove } : null,
    canonicalOrientation: cloneOrientation(value.canonicalOrientation),
    baselineRelationship: cloneRelationship(value.baselineRelationship),
    prePerturbationCompanionIntent: cloneIntent(value.prePerturbationCompanionIntent),
    executedCompanionIntent: cloneIntent(value.executedCompanionIntent),
    a1Variant: value.a1Variant
  };
}

function validatedMove(value: Vec2 | null): Vec2 | null {
  if (value === null) return null;
  if (!Number.isFinite(value.x) || !Number.isFinite(value.y)) {
    throw new Error("Semantic perturbation move must have finite x/y components.");
  }
  const length = Math.hypot(value.x, value.y);
  if (length > 1 + 1e-9) {
    throw new Error("Semantic perturbation move must stay inside the World unit disk.");
  }
  return { ...value };
}

export function installRelationshipSemanticPerturbationBrowserBridge(
  search: string,
  scenePrototype: object
): void {
  const params = new URLSearchParams(search);
  if (params.get(FLAG) !== "1" || window.__relationshipSemanticPerturbationBridge) return;

  const prototype = scenePrototype as Record<string, unknown>;
  const originalCompute = prototype.computeIntents;
  if (typeof originalCompute !== "function") {
    throw new Error("Semantic perturbation bridge could not locate the R1 computeIntents seam.");
  }

  const frames: RelationshipSemanticPerturbationFrame[] = [];
  let forcedCompanionMove: Vec2 | null = null;
  const compute = originalCompute as ComputeIntents;

  prototype.computeIntents = function(this: SceneLike, before: WorldSnapshot): ComputeIntentsResult {
    const result = compute.call(this, before);
    const runtime = this.a1Authority.debugState();
    const canonicalOrientation = this.relationshipOrientation.latestEvidence();
    const prePerturbationCompanionIntent =
      result.intents.find((intent) => intent.actorId === "companion") ?? null;
    const apparatusApplied =
      forcedCompanionMove !== null &&
      this.companionMode === "spatial" &&
      this.a1Authority.enabled() &&
      prePerturbationCompanionIntent !== null;

    let executedCompanionIntent = prePerturbationCompanionIntent;
    let returned = result;
    if (apparatusApplied && forcedCompanionMove && prePerturbationCompanionIntent) {
      executedCompanionIntent = {
        actorId: "companion",
        move: { ...forcedCompanionMove }
      };
      returned = {
        ...result,
        intents: result.intents.map((intent) =>
          intent.actorId === "companion"
            ? { actorId: "companion", move: { ...forcedCompanionMove! } }
            : { actorId: intent.actorId, move: { ...intent.move } }
        )
      };
    }

    frames.push({
      tick: before.tick,
      apparatusApplied,
      forcedCompanionMove: forcedCompanionMove ? { ...forcedCompanionMove } : null,
      canonicalOrientation: cloneOrientation(canonicalOrientation),
      baselineRelationship: cloneRelationship(result.relationship),
      prePerturbationCompanionIntent: cloneIntent(prePerturbationCompanionIntent),
      executedCompanionIntent: cloneIntent(executedCompanionIntent),
      a1Variant: runtime.variant
    });
    if (frames.length > CAPACITY) frames.splice(0, frames.length - CAPACITY);
    return returned;
  };

  const snapshot = (): RelationshipSemanticPerturbationSnapshot => ({
    schema: SCHEMA,
    authority: "TEST_APPARATUS_PHYSICAL_PERTURBATION_NOT_A1_AUTHORITY",
    forcedCompanionMove: forcedCompanionMove ? { ...forcedCompanionMove } : null,
    frameCount: frames.length,
    frames: frames.map(cloneFrame)
  });

  const bridge: RelationshipSemanticPerturbationBridge = {
    enabled: true,
    schema: SCHEMA,
    setForcedCompanionMove: (move) => {
      forcedCompanionMove = validatedMove(move);
    },
    snapshot
  };

  Object.defineProperty(window, "__relationshipSemanticPerturbationBridge", {
    configurable: false,
    enumerable: false,
    writable: false,
    value: bridge
  });
}
