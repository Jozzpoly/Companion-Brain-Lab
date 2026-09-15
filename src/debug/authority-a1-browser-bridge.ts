import type { MotionIntent } from "../world/types";
import type { A1AuthorityRuntimeDebug, A1AuthorityVariant } from "../coordination/a1-authority-runtime";
import { cloneA1Situation, type A1Situation } from "../coordination/a1-situation";

const QUERY_FLAG = "a1debug";
const CAPACITY = 480;
const SCHEMA = "companion-brain-lab-authority-a1-0-browser-v1";

export interface AuthorityA10BrowserDecisionEvidence {
  tick: number;
  variant: A1AuthorityVariant;
  epoch: number;
  passThroughSteps: number;
  situation: A1Situation;
  baselineCompanionIntent: MotionIntent;
  selectedCompanionIntent: MotionIntent;
}

export interface AuthorityA10BrowserSnapshot {
  schema: typeof SCHEMA;
  stage: "Authority-A1.0";
  authority: "PASS_THROUGH_ONLY";
  frameCount: number;
  lastError: string | null;
  frames: AuthorityA10BrowserDecisionEvidence[];
}

export interface AuthorityA10BrowserBridge {
  readonly enabled: true;
  readonly schema: typeof SCHEMA;
  snapshot(): AuthorityA10BrowserSnapshot;
  latest(): AuthorityA10BrowserDecisionEvidence | null;
}

declare global {
  interface Window {
    __authorityA10BrowserBridge?: AuthorityA10BrowserBridge;
  }
}

let recordDecision: ((value: AuthorityA10BrowserDecisionEvidence) => void) | null = null;
let recordError: ((message: string) => void) | null = null;

function cloneIntent(value: MotionIntent): MotionIntent {
  return { actorId: value.actorId, move: { ...value.move } };
}

function cloneDecision(value: AuthorityA10BrowserDecisionEvidence): AuthorityA10BrowserDecisionEvidence {
  return {
    tick: value.tick,
    variant: value.variant,
    epoch: value.epoch,
    passThroughSteps: value.passThroughSteps,
    situation: cloneA1Situation(value.situation),
    baselineCompanionIntent: cloneIntent(value.baselineCompanionIntent),
    selectedCompanionIntent: cloneIntent(value.selectedCompanionIntent)
  };
}

export function publishAuthorityA10BrowserDecision(input: {
  runtime: A1AuthorityRuntimeDebug;
  situation: A1Situation;
  baselineCompanionIntent: MotionIntent;
  selectedCompanionIntent: MotionIntent;
}): void {
  if (!recordDecision) return;
  try {
    recordDecision({
      tick: input.situation.tick,
      variant: input.runtime.variant,
      epoch: input.runtime.epoch,
      passThroughSteps: input.runtime.passThroughSteps,
      situation: cloneA1Situation(input.situation),
      baselineCompanionIntent: cloneIntent(input.baselineCompanionIntent),
      selectedCompanionIntent: cloneIntent(input.selectedCompanionIntent)
    });
  } catch (error) {
    recordError?.(error instanceof Error ? error.message : String(error));
  }
}

export function installAuthorityA10BrowserBridge(search: string): void {
  const params = new URLSearchParams(search);
  if (params.get(QUERY_FLAG) !== "1" || window.__authorityA10BrowserBridge) return;

  const frames: AuthorityA10BrowserDecisionEvidence[] = [];
  let lastError: string | null = null;

  recordDecision = (value) => {
    frames.push(cloneDecision(value));
    if (frames.length > CAPACITY) frames.splice(0, frames.length - CAPACITY);
  };
  recordError = (message) => {
    lastError = message;
  };

  const snapshot = (): AuthorityA10BrowserSnapshot => ({
    schema: SCHEMA,
    stage: "Authority-A1.0",
    authority: "PASS_THROUGH_ONLY",
    frameCount: frames.length,
    lastError,
    frames: frames.map(cloneDecision)
  });

  const bridge: AuthorityA10BrowserBridge = {
    enabled: true,
    schema: SCHEMA,
    snapshot,
    latest: () => {
      const value = frames.at(-1);
      return value ? cloneDecision(value) : null;
    }
  };

  Object.defineProperty(window, "__authorityA10BrowserBridge", {
    configurable: false,
    enumerable: false,
    writable: false,
    value: bridge
  });
}