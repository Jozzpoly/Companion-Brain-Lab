import type {
  A1AuthorityRuntimeDebug,
  A1AuthorityVariant,
  A1ObservationErrorEvidence
} from "../coordination/a1-authority-runtime";
import type { A1RelationshipObserverDebug } from "../coordination/a1-relationship-observer";
import { cloneA1Situation, type A1Situation } from "../coordination/a1-situation";
import type { MotionIntent } from "../world/types";

const QUERY_FLAG = "a1debug";
const CAPACITY = 720;
const SCHEMA = "companion-brain-lab-authority-a1-1f-browser-v1";

export interface AuthorityA11fBrowserObservationEvidence {
  publishedAtMs: number;
  tick: number;
  variant: A1AuthorityVariant;
  epoch: number;
  passThroughSteps: number;
  situation: A1Situation;
  observation: A1RelationshipObserverDebug;
  observationError: A1ObservationErrorEvidence | null;
  baselineCompanionIntent: MotionIntent;
  selectedCompanionIntent: MotionIntent;
}

export interface AuthorityA11fBrowserSnapshot {
  schema: typeof SCHEMA;
  stage: "Authority-A1.1f";
  authority: "PASS_THROUGH_ONLY";
  frameCount: number;
  lastBridgeError: string | null;
  frames: AuthorityA11fBrowserObservationEvidence[];
}

export interface AuthorityA11fBrowserBridge {
  readonly enabled: true;
  readonly schema: typeof SCHEMA;
  snapshot(): AuthorityA11fBrowserSnapshot;
  latest(): AuthorityA11fBrowserObservationEvidence | null;
}

declare global {
  interface Window {
    __authorityA11fBrowserBridge?: AuthorityA11fBrowserBridge;
  }
}

let recordObservation: ((value: AuthorityA11fBrowserObservationEvidence) => void) | null = null;
let recordBridgeError: ((message: string) => void) | null = null;

function cloneIntent(value: MotionIntent): MotionIntent {
  return { actorId: value.actorId, move: { ...value.move } };
}

function cloneObserverDebug(value: A1RelationshipObserverDebug): A1RelationshipObserverDebug {
  return {
    lastAttemptTick: value.lastAttemptTick,
    latestTick: value.latestTick,
    observations: value.observations,
    heavyAttempts: value.heavyAttempts,
    heavyEvaluations: value.heavyEvaluations,
    lastHeavyAttemptTick: value.lastHeavyAttemptTick,
    orientation: value.orientation
      ? {
          ...value.orientation,
          direction: value.orientation.direction ? { ...value.orientation.direction } : null
        }
      : null,
    semantic: value.semantic ? { ...value.semantic } : null,
    heavy: value.heavy ? { ...value.heavy } : null
  };
}

function cloneObservationError(
  value: A1ObservationErrorEvidence | null
): A1ObservationErrorEvidence | null {
  return value ? { ...value } : null;
}

function cloneFrame(
  value: AuthorityA11fBrowserObservationEvidence
): AuthorityA11fBrowserObservationEvidence {
  return {
    publishedAtMs: value.publishedAtMs,
    tick: value.tick,
    variant: value.variant,
    epoch: value.epoch,
    passThroughSteps: value.passThroughSteps,
    situation: cloneA1Situation(value.situation),
    observation: cloneObserverDebug(value.observation),
    observationError: cloneObservationError(value.observationError),
    baselineCompanionIntent: cloneIntent(value.baselineCompanionIntent),
    selectedCompanionIntent: cloneIntent(value.selectedCompanionIntent)
  };
}

export function publishAuthorityA11fBrowserObservation(input: {
  runtime: A1AuthorityRuntimeDebug;
  situation: A1Situation;
  baselineCompanionIntent: MotionIntent;
  selectedCompanionIntent: MotionIntent;
}): void {
  if (!recordObservation) return;
  try {
    recordObservation({
      publishedAtMs: performance.now(),
      tick: input.situation.tick,
      variant: input.runtime.variant,
      epoch: input.runtime.epoch,
      passThroughSteps: input.runtime.passThroughSteps,
      situation: cloneA1Situation(input.situation),
      observation: cloneObserverDebug(input.runtime.relationshipObservation),
      observationError: cloneObservationError(input.runtime.relationshipObservationError),
      baselineCompanionIntent: cloneIntent(input.baselineCompanionIntent),
      selectedCompanionIntent: cloneIntent(input.selectedCompanionIntent)
    });
  } catch (error) {
    recordBridgeError?.(error instanceof Error ? error.message : String(error));
  }
}

export function installAuthorityA11fBrowserBridge(search: string): void {
  const params = new URLSearchParams(search);
  if (params.get(QUERY_FLAG) !== "1" || window.__authorityA11fBrowserBridge) return;

  const frames: AuthorityA11fBrowserObservationEvidence[] = [];
  let lastBridgeError: string | null = null;

  recordObservation = (value) => {
    frames.push(cloneFrame(value));
    if (frames.length > CAPACITY) frames.splice(0, frames.length - CAPACITY);
  };
  recordBridgeError = (message) => {
    lastBridgeError = message;
  };

  const snapshot = (): AuthorityA11fBrowserSnapshot => ({
    schema: SCHEMA,
    stage: "Authority-A1.1f",
    authority: "PASS_THROUGH_ONLY",
    frameCount: frames.length,
    lastBridgeError,
    frames: frames.map(cloneFrame)
  });

  const bridge: AuthorityA11fBrowserBridge = {
    enabled: true,
    schema: SCHEMA,
    snapshot,
    latest: () => {
      const value = frames.at(-1);
      return value ? cloneFrame(value) : null;
    }
  };

  Object.defineProperty(window, "__authorityA11fBrowserBridge", {
    configurable: false,
    enumerable: false,
    writable: false,
    value: bridge
  });
}
