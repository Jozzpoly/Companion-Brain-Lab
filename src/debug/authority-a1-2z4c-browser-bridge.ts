import { A1AuthorityRuntime } from "../coordination/a1-authority-runtime";
import {
  evaluateA1H1PrimaryLiveStateShadow,
  type A1H1PrimaryShadowEvaluation
} from "../coordination/a1-h1-primary-shadow";
import type { A1RelationshipOrientationEvidence } from "../coordination/a1-relationship-orientation";
import { cloneA1Situation, type A1Situation } from "../coordination/a1-situation";
import type { MotionIntent, WorldSnapshot } from "../world/types";
import type { LabWorld } from "../world/world";

const DEBUG_FLAG = "a1debug";
const Z4C_FLAG = "a1z4c";
const SCHEMA = "companion-brain-lab-authority-a1-2z4c-browser-v1";

interface SceneLike {
  world: LabWorld | null;
  companionMode: string;
  a1Authority: A1AuthorityRuntime;
}

interface ComputeIntentsResult {
  intents: MotionIntent[];
}

type ComputeIntents = (this: SceneLike, before: WorldSnapshot) => ComputeIntentsResult;

export interface AuthorityA12z4cProbeEvidence {
  requestId: number;
  publishedAtMs: number;
  durationMs: number;
  tick: number;
  variant: "direct" | "temporal";
  situation: A1Situation;
  relationshipOrientation: A1RelationshipOrientationEvidence;
  selectedCompanionIntent: MotionIntent | null;
  evaluation: A1H1PrimaryShadowEvaluation;
}

export interface AuthorityA12z4cBrowserSnapshot {
  schema: typeof SCHEMA;
  stage: "Authority-A1.2z4c";
  authority: "ZERO_MOVEMENT_AUTHORITY_EXPLICIT_RESEARCH_PROBE";
  pendingRequestId: number | null;
  requestCount: number;
  completedCount: number;
  lastError: string | null;
  latest: AuthorityA12z4cProbeEvidence | null;
}

export interface AuthorityA12z4cBrowserBridge {
  readonly enabled: true;
  readonly schema: typeof SCHEMA;
  requestProbe(): number;
  snapshot(): AuthorityA12z4cBrowserSnapshot;
}

declare global {
  interface Window {
    __authorityA12z4cBrowserBridge?: AuthorityA12z4cBrowserBridge;
  }
}

function cloneIntent(value: MotionIntent | null): MotionIntent | null {
  return value ? { actorId: value.actorId, move: { ...value.move } } : null;
}

function cloneEvaluation(value: A1H1PrimaryShadowEvaluation): A1H1PrimaryShadowEvaluation {
  return structuredClone(value);
}

function cloneOrientation(value: A1RelationshipOrientationEvidence): A1RelationshipOrientationEvidence {
  return structuredClone(value);
}

function cloneEvidence(value: AuthorityA12z4cProbeEvidence): AuthorityA12z4cProbeEvidence {
  return {
    requestId: value.requestId,
    publishedAtMs: value.publishedAtMs,
    durationMs: value.durationMs,
    tick: value.tick,
    variant: value.variant,
    situation: cloneA1Situation(value.situation),
    relationshipOrientation: cloneOrientation(value.relationshipOrientation),
    selectedCompanionIntent: cloneIntent(value.selectedCompanionIntent),
    evaluation: cloneEvaluation(value.evaluation)
  };
}

/**
 * Z4c is explicit browser research apparatus only. It wraps the existing scene
 * decision function so the requested probe runs after A1 has captured the exact
 * same-tick situation and relationship-orientation evidence but before the live
 * World step. The original intent result is returned unchanged; the evaluator
 * itself only advances Rapier snapshot clones.
 */
export function installAuthorityA12z4cBrowserBridge(search: string, scenePrototype: object): void {
  const params = new URLSearchParams(search);
  if (
    params.get(DEBUG_FLAG) !== "1" ||
    params.get(Z4C_FLAG) !== "1" ||
    window.__authorityA12z4cBrowserBridge
  ) return;

  const prototype = scenePrototype as Record<string, unknown>;
  const original = prototype.computeIntents;
  if (typeof original !== "function") {
    throw new Error("Authority-A1.2z4c could not locate the R1 decision seam.");
  }

  let nextRequestId = 1;
  let pendingRequestId: number | null = null;
  let requestCount = 0;
  let completedCount = 0;
  let lastError: string | null = null;
  let latest: AuthorityA12z4cProbeEvidence | null = null;

  const originalCompute = original as ComputeIntents;
  prototype.computeIntents = function(this: SceneLike, before: WorldSnapshot): ComputeIntentsResult {
    const result = originalCompute.call(this, before);
    const requestId = pendingRequestId;
    if (requestId === null) return result;

    const runtime = this.a1Authority.debugState();
    const situation = runtime.latestSituation;
    const relationshipOrientation = this.a1Authority.latestRelationshipOrientationEvidence();
    const ready =
      this.world !== null &&
      this.companionMode === "spatial" &&
      this.a1Authority.enabled() &&
      (runtime.variant === "direct" || runtime.variant === "temporal") &&
      situation !== null &&
      relationshipOrientation !== null &&
      relationshipOrientation.tick === situation.tick &&
      situation.tick === before.tick &&
      this.world.snapshot().tick === before.tick;
    if (!ready || !situation || !relationshipOrientation || !this.world || runtime.variant === "off") return result;

    pendingRequestId = null;
    const startedAt = performance.now();
    try {
      const evaluation = evaluateA1H1PrimaryLiveStateShadow({
        world: this.world,
        situation,
        orientation: relationshipOrientation
      });
      const durationMs = performance.now() - startedAt;
      const selectedCompanionIntent = result.intents.find((intent) => intent.actorId === "companion") ?? null;
      latest = {
        requestId,
        publishedAtMs: performance.now(),
        durationMs,
        tick: situation.tick,
        variant: runtime.variant,
        situation: cloneA1Situation(situation),
        relationshipOrientation: cloneOrientation(relationshipOrientation),
        selectedCompanionIntent: cloneIntent(selectedCompanionIntent),
        evaluation: cloneEvaluation(evaluation)
      };
      completedCount += 1;
      lastError = null;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    return result;
  };

  const snapshot = (): AuthorityA12z4cBrowserSnapshot => ({
    schema: SCHEMA,
    stage: "Authority-A1.2z4c",
    authority: "ZERO_MOVEMENT_AUTHORITY_EXPLICIT_RESEARCH_PROBE",
    pendingRequestId,
    requestCount,
    completedCount,
    lastError,
    latest: latest ? cloneEvidence(latest) : null
  });

  const bridge: AuthorityA12z4cBrowserBridge = {
    enabled: true,
    schema: SCHEMA,
    requestProbe: () => {
      if (pendingRequestId !== null) return pendingRequestId;
      const requestId = nextRequestId;
      nextRequestId += 1;
      pendingRequestId = requestId;
      requestCount += 1;
      return requestId;
    },
    snapshot
  };

  Object.defineProperty(window, "__authorityA12z4cBrowserBridge", {
    configurable: false,
    enumerable: false,
    writable: false,
    value: bridge
  });
}
