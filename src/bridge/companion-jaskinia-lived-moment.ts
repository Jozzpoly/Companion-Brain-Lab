/**
 * Companion -> old Jaskinia: a bounded account of a lived cooperative moment.
 *
 * This is a research seam, not a new World authority or persistence engine.
 * It makes an actual Field Lab moment available to Jaskinia's existing
 * state/remark affordance. The lab still owns its simulation and can run alone.
 *
 * Explicit negatives: not solver state, not deterministic replay, no commands,
 * no arbitrary parent-origin bridge, no access to Owner notes or localStorage.
 */
import type { FieldLabSquadControlSnapshot } from "../squad/field-lab-squad-control";
import type { CombatMicroSnapshot } from "../world/combat-micro-contract";
import type { WorldSnapshot, FieldLabSituation, FieldLabLayout } from "../world/types";

export const COMPANION_MOMENT_SCHEMA = "companion-lived-moment/v0" as const;
const MAX_STATE_BYTES = 7800;

export interface CompanionLivedMoment {
  schema: typeof COMPANION_MOMENT_SCHEMA;
  sourceReported: true;
  restorable: false;
  sourceSha: string;
  world: {
    scenarioId: string;
    tick: number;
    situation: FieldLabSituation;
    layout: FieldLabLayout;
    paused: boolean;
  };
  authority: {
    focused: string;
    selected: readonly string[];
    directControl: boolean;
    assignments: readonly { memberId: string; mode: string; anchor: { x: number; y: number } | null }[];
  };
  bodies: readonly {
    id: string; x: number; y: number;
    vx: number; vy: number; contacts: number;
  }[];
  combat: null | {
    phase: string; responsibilityBearer: string; hostileHealth: number;
  };
  trial: null | { slot: string; recordedFrames: number };
}

export function captureCompanionLivedMoment(input: {
  sourceSha: string;
  world: WorldSnapshot;
  control: FieldLabSquadControlSnapshot;
  situation: FieldLabSituation;
  layout: FieldLabLayout;
  paused: boolean;
  combat: CombatMicroSnapshot | null;
  trial: { slot: string; recordedFrames: number } | null;
}): CompanionLivedMoment {
  return {
    schema: COMPANION_MOMENT_SCHEMA,
    sourceReported: true,
    restorable: false,
    sourceSha: input.sourceSha,
    world: {
      scenarioId: input.world.scenarioId,
      tick: input.world.tick,
      situation: input.situation,
      layout: input.layout,
      paused: input.paused
    },
    authority: {
      focused: input.control.focused,
      selected: [...input.control.selected],
      directControl: input.control.directControl,
      assignments: input.control.assignments
        .filter(a => input.control.activeMembers.includes(a.memberId))
        .map(a => ({
          memberId: a.memberId,
          mode: a.mode,
          anchor: a.worldAnchor ? { x: a.worldAnchor.x, y: a.worldAnchor.y } : null
        }))
    },
    bodies: input.world.actors.map(a => ({
      id: a.id,
      x: a.position.x,
      y: a.position.y,
      vx: a.actualVelocity.x,
      vy: a.actualVelocity.y,
      contacts: a.contacts.reduce((sum, c) => sum + c.contactCount, 0)
    })),
    combat: input.combat ? {
      phase: input.combat.phase,
      responsibilityBearer: input.combat.targetActorId,
      hostileHealth: input.combat.hostileHealth
    } : null,
    trial: input.trial ? { ...input.trial } : null
  };
}

export interface CompanionRemark {
  text: string;
  at: string;
  anchoredMoment: CompanionLivedMoment | null;
}

interface ContactHost {
  parent: { postMessage(data: unknown, targetOrigin: string): void };
  self: unknown;
  referrer: string;
  listen(callback: (event: { source: unknown; origin: string; data: unknown }) => void): () => void;
  every(callback: () => void, ms: number): () => void;
}

function realHost(): ContactHost | null {
  if (typeof window === "undefined" || window.parent === window) return null;
  return {
    parent: window.parent,
    self: window,
    referrer: document.referrer,
    listen(callback) {
      const handler = (event: MessageEvent) => callback(event);
      window.addEventListener("message", handler);
      return () => window.removeEventListener("message", handler);
    },
    every(callback, ms) {
      const id = window.setInterval(callback, ms);
      return () => window.clearInterval(id);
    }
  };
}

/**
 * Explicitly pins the research bridge to the *old Jaskinia*, not to arbitrary
 * framing sites. Local authoring tests may use a locally served Jaskinia build.
 * This is not a comprehensive security sandbox; it never carries secrets.
 */
export function trustedJaskiniaOrigin(referrer: string): string | null {
  let url: URL;
  try { url = new URL(referrer); } catch { return null; }
  if (url.protocol === "https:" &&
      url.hostname === "jozzpoly.github.io" &&
      url.pathname.startsWith("/Jozz-Cave-Workbench/")) return url.origin;
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (local && url.protocol === "http:" &&
      /\/jaskinia(?:-web)?\.html$/i.test(url.pathname)) return url.origin;
  return null;
}

export function installCompanionJaskiniaLivedMoment(input: {
  read: () => CompanionLivedMoment | null;
  onRemark?: (remark: CompanionRemark) => void;
  host?: ContactHost | null;
}): () => void {
  const host = input.host === undefined ? realHost() : input.host;
  if (!host || host.self === host.parent) return () => {};
  const origin = trustedJaskiniaOrigin(host.referrer);
  if (!origin) return () => {};
  let alive = true;
  let latestRequestedMoment: CompanionLivedMoment | null = null;

  function send(type: string, payload: Record<string, unknown>): void {
    if (!alive) return;
    try { host!.parent.postMessage({ jaskinia: 1, type, ...payload }, origin!); }
    catch { /* no simulation impact */ }
  }
  function emitMoment(): void {
    try {
      const moment = input.read();
      if (!moment) return;
      if (moment.schema !== COMPANION_MOMENT_SCHEMA) return;
      const raw = JSON.stringify(moment);
      if (raw.length > MAX_STATE_BYTES) return; // never truncate structural evidence
      latestRequestedMoment = JSON.parse(raw) as CompanionLivedMoment;
      send("state", {
        text: `Companion · ${moment.world.situation} · tick ${moment.world.tick} · ${moment.authority.focused} · ${moment.combat?.phase ?? "no combat"}`,
        data: latestRequestedMoment
      });
      send("signals", { values: {
        tick: moment.world.tick,
        bodies: moment.bodies.length,
        contacts: moment.bodies.reduce((n, b) => n + b.contacts, 0),
        directControl: Number(moment.authority.directControl)
      } });
    } catch { /* contact failure must not affect World or input */ }
  }
  const stopListening = host.listen(event => {
    if (!alive || event.source !== host.parent || event.origin !== origin) return;
    const data = event.data as Record<string, unknown> | null;
    if (!data || data.jaskinia !== 1) return;
    if (data.type === "hi") {
      send("hello", { name: "Companion · Shared Moment", version: "lived-moment v0", wants: ["remark"] });
      emitMoment();
    } else if (data.type === "state?") {
      emitMoment(); // pins the *current* world before the Owner writes the note
    } else if (data.type === "remark") {
      try {
        input.onRemark?.({
          text: String(data.text ?? ""),
          at: String(data.at ?? ""),
          anchoredMoment: latestRequestedMoment
        });
      } catch { /* Owner note must not affect World authority */ }
    }
  });
  // The iframe 'hi' can race scene creation; proactively advertise as well.
  send("hello", { name: "Companion · Shared Moment", version: "lived-moment v0", wants: ["remark"] });
  const stopInterval = host.every(emitMoment, 1000);
  return () => {
    alive = false;
    stopInterval();
    stopListening();
  };
}
