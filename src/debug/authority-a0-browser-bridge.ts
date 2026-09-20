import {
  cloneAuthorityA0WorldStepEvidence,
  type AuthorityA0WorldStepEvidence
} from "../world/authority-a0-step-evidence";
import { subscribeAuthorityA0StepEvidence } from "../world/world";
import {
  runAuthorityA0HardRouteBrowserQualification,
  type AuthorityA0HardRouteBrowserQualification
} from "./authority-a0-hard-route-browser-probe";

const QUERY_FLAG = "a0debug";
const BUFFER_CAPACITY = 480;
const INCIDENT_SCHEMA = "companion-brain-lab-authority-a0-incident-v1";

export interface AuthorityA0BrowserIncident {
  schema: typeof INCIDENT_SCHEMA;
  stage: "Authority-A0";
  authority: "ZERO_NEW_MOVEMENT_AUTHORITY";
  capturedAt: string;
  frameCount: number;
  scenarios: string[];
  hardRouteQualification: AuthorityA0HardRouteBrowserQualification | null;
  hardRouteQualificationError: string | null;
  frames: AuthorityA0WorldStepEvidence[];
}

export interface AuthorityA0BrowserBridge {
  readonly enabled: true;
  readonly schema: typeof INCIDENT_SCHEMA;
  latest(): AuthorityA0WorldStepEvidence | null;
  recent(limit?: number): AuthorityA0WorldStepEvidence[];
  incident(): AuthorityA0BrowserIncident;
  downloadIncident(): string;
}

declare global {
  interface Window {
    __authorityA0BrowserBridge?: AuthorityA0BrowserBridge;
  }
}

function cloneFrames(values: readonly AuthorityA0WorldStepEvidence[]): AuthorityA0WorldStepEvidence[] {
  return values.map((value) => cloneAuthorityA0WorldStepEvidence(value));
}

function cloneHardRouteQualification(
  value: AuthorityA0HardRouteBrowserQualification | null
): AuthorityA0HardRouteBrowserQualification | null {
  if (!value) return null;
  return {
    fixture: value.fixture,
    target: { ...value.target },
    evidence: {
      ...value.evidence,
      hardRouteNodeIds: [...value.evidence.hardRouteNodeIds],
      desiredRouteNodeIds: [...value.evidence.desiredRouteNodeIds]
    }
  };
}

export function installAuthorityA0BrowserBridge(search: string): void {
  const params = new URLSearchParams(search);
  if (params.get(QUERY_FLAG) !== "1" || window.__authorityA0BrowserBridge) return;

  const frames: AuthorityA0WorldStepEvidence[] = [];
  let hardRouteQualification: AuthorityA0HardRouteBrowserQualification | null = null;
  let hardRouteQualificationError: string | null = null;

  void runAuthorityA0HardRouteBrowserQualification()
    .then((value) => {
      hardRouteQualification = cloneHardRouteQualification(value);
    })
    .catch((error: unknown) => {
      hardRouteQualificationError = error instanceof Error ? error.message : String(error);
    });

  const unsubscribe = subscribeAuthorityA0StepEvidence((evidence) => {
    frames.push(cloneAuthorityA0WorldStepEvidence(evidence));
    if (frames.length > BUFFER_CAPACITY) {
      frames.splice(0, frames.length - BUFFER_CAPACITY);
    }
  });

  const buildIncident = (): AuthorityA0BrowserIncident => ({
    schema: INCIDENT_SCHEMA,
    stage: "Authority-A0",
    authority: "ZERO_NEW_MOVEMENT_AUTHORITY",
    capturedAt: new Date().toISOString(),
    frameCount: frames.length,
    scenarios: [...new Set(frames.map((frame) => frame.scenarioId))],
    hardRouteQualification: cloneHardRouteQualification(hardRouteQualification),
    hardRouteQualificationError,
    frames: cloneFrames(frames)
  });

  const bridge: AuthorityA0BrowserBridge = {
    enabled: true,
    schema: INCIDENT_SCHEMA,
    latest: () => {
      const value = frames.at(-1);
      return value ? cloneAuthorityA0WorldStepEvidence(value) : null;
    },
    recent: (limit = 60) => {
      const bounded = Math.max(0, Math.min(BUFFER_CAPACITY, Math.floor(limit)));
      return cloneFrames(frames.slice(Math.max(0, frames.length - bounded)));
    },
    incident: buildIncident,
    downloadIncident: () => {
      const incident = buildIncident();
      const scenario = incident.scenarios.at(-1) ?? "none";
      const tick = incident.frames.at(-1)?.outcomeTick ?? 0;
      const fileName = `companion-authority-a0-${scenario}-tick-${tick}.json`;
      const blob = new Blob([JSON.stringify(incident, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      return fileName;
    }
  };

  Object.defineProperty(window, "__authorityA0BrowserBridge", {
    configurable: false,
    enumerable: false,
    writable: false,
    value: bridge
  });

  window.addEventListener("beforeunload", unsubscribe, { once: true });
}
