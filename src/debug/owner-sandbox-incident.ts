import type { AuthorityA12p2BrowserSnapshot } from "./authority-a1-2p2-manual-browser-bridge";
import type { CompanionBuildIdentity } from "./build-identity";
import type { CausalFrame } from "./causal-frame-trace";

export interface OwnerSandboxIncident {
  schema: "companion-brain-lab-owner-sandbox-incident-v1";
  build: CompanionBuildIdentity;
  capture: {
    scenario: string;
    tick: number;
    paused: boolean;
    mode: string;
    actuator: "natural" | "direct";
    a1Variant: string;
    timeScale: number;
  };
  p2: {
    available: boolean;
    snapshot: AuthorityA12p2BrowserSnapshot | null;
  };
  frames: CausalFrame[];
  events: string[];
}

export function buildOwnerSandboxIncident(input: {
  build: CompanionBuildIdentity;
  scenario: string;
  tick: number;
  paused: boolean;
  mode: string;
  actuator: "natural" | "direct";
  a1Variant: string;
  timeScale: number;
  p2: AuthorityA12p2BrowserSnapshot | null;
  frames: readonly CausalFrame[];
  events: readonly string[];
}): OwnerSandboxIncident {
  return {
    schema: "companion-brain-lab-owner-sandbox-incident-v1",
    build: { ...input.build },
    capture: {
      scenario: input.scenario,
      tick: input.tick,
      paused: input.paused,
      mode: input.mode,
      actuator: input.actuator,
      a1Variant: input.a1Variant,
      timeScale: input.timeScale
    },
    p2: {
      available: input.p2 !== null,
      snapshot: input.p2 ? structuredClone(input.p2) : null
    },
    frames: structuredClone(input.frames),
    events: [...input.events]
  };
}
