import { A1AuthorityRuntime } from "../coordination/a1-authority-runtime";
import {
  buildA1EmbodiedH1ShadowProjection,
  type A1EmbodiedShadowProjection
} from "../coordination/a1-embodied-shadow-projection";
import { cloneA1Situation, type A1Situation } from "../coordination/a1-situation";
import type { MotionIntent, WorldSnapshot } from "../world/types";
import type { LabWorld } from "../world/world";

const DEBUG_FLAG = "a1debug";
const P1_FLAG = "a1p1";
const SCHEMA = "companion-brain-lab-authority-a1-2p1-browser-v1";
const VIEW_WIDTH = 1200;
const VIEW_HEIGHT = 800;

interface GraphicsLike {
  lineStyle(width: number, color: number, alpha?: number): GraphicsLike;
  lineBetween(x1: number, y1: number, x2: number, y2: number): GraphicsLike;
  fillStyle(color: number, alpha?: number): GraphicsLike;
  fillCircle(x: number, y: number, radius: number): GraphicsLike;
}

interface SceneLike {
  world: LabWorld | null;
  companionMode: string;
  a1Authority: A1AuthorityRuntime;
  graphics: GraphicsLike;
}

interface ComputeIntentsResult {
  intents: MotionIntent[];
}

type ComputeIntents = (this: SceneLike, before: WorldSnapshot) => ComputeIntentsResult;
type DrawWorld = (this: SceneLike, snapshot: WorldSnapshot) => void;

export interface AuthorityA12p1ProbeEvidence {
  requestId: number;
  publishedAtMs: number;
  durationMs: number;
  tick: number;
  variant: "direct" | "temporal";
  horizonSeconds: number;
  situation: A1Situation;
  selectedCompanionIntent: MotionIntent | null;
  projection: A1EmbodiedShadowProjection;
}

export interface AuthorityA12p1BrowserSnapshot {
  schema: typeof SCHEMA;
  stage: "Authority-A1.2p1";
  authority: "ZERO_MOVEMENT_AUTHORITY_EXPLICIT_EMBODIED_SHADOW_PROBE";
  pendingRequestId: number | null;
  requestCount: number;
  completedCount: number;
  lastError: string | null;
  latest: AuthorityA12p1ProbeEvidence | null;
}

export interface AuthorityA12p1BrowserBridge {
  readonly enabled: true;
  readonly schema: typeof SCHEMA;
  requestProjection(horizonSeconds: number): number;
  snapshot(): AuthorityA12p1BrowserSnapshot;
}

declare global {
  interface Window {
    __authorityA12p1BrowserBridge?: AuthorityA12p1BrowserBridge;
  }
}

function cloneIntent(value: MotionIntent | null): MotionIntent | null {
  return value ? { actorId: value.actorId, move: { ...value.move } } : null;
}

function cloneProjection(value: A1EmbodiedShadowProjection): A1EmbodiedShadowProjection {
  return structuredClone(value);
}

function cloneEvidence(value: AuthorityA12p1ProbeEvidence): AuthorityA12p1ProbeEvidence {
  return {
    requestId: value.requestId,
    publishedAtMs: value.publishedAtMs,
    durationMs: value.durationMs,
    tick: value.tick,
    variant: value.variant,
    horizonSeconds: value.horizonSeconds,
    situation: cloneA1Situation(value.situation),
    selectedCompanionIntent: cloneIntent(value.selectedCompanionIntent),
    projection: cloneProjection(value.projection)
  };
}

function finitePositiveHorizon(value: number): number {
  if (!Number.isFinite(value) || value <= 0 || value > 2) {
    throw new Error("P1 browser projection horizon must be finite, positive and <= 2 seconds.");
  }
  return value;
}

function drawProjection(
  graphics: GraphicsLike,
  snapshot: WorldSnapshot,
  projection: A1EmbodiedShadowProjection
): void {
  // A probe runs immediately before sourceTick -> sourceTick+1. Rendering only
  // on that resulting live frame keeps the ghost causally aligned and prevents
  // stale counterfactuals from following a later live state.
  if (snapshot.tick !== projection.sourceTick + 1 || projection.candidates.length === 0) return;

  const scale = Math.min(VIEW_WIDTH / snapshot.width, VIEW_HEIGHT / snapshot.height);
  const offsetX = (VIEW_WIDTH - snapshot.width * scale) / 2;
  const offsetY = (VIEW_HEIGHT - snapshot.height * scale) / 2;
  const sx = (x: number) => offsetX + x * scale;
  const sy = (y: number) => offsetY + y * scale;

  // Player H1 is common to every frontier member. Draw it once so an ambiguous
  // frontier does not become visually darker merely because it has more members.
  const common = projection.candidates[0]!;
  let previousPlayer = common.playerStart;
  graphics.lineStyle(3, 0x63a8ff, 0.55);
  for (const frame of common.frames) {
    graphics.lineBetween(
      sx(previousPlayer.x),
      sy(previousPlayer.y),
      sx(frame.playerPosition.x),
      sy(frame.playerPosition.y)
    );
    previousPlayer = frame.playerPosition;
  }
  graphics.fillStyle(0x63a8ff, 0.8).fillCircle(sx(previousPlayer.x), sy(previousPlayer.y), 5);

  // Every structured-frontier member is rendered with the same visual weight.
  // P1 therefore exposes alternatives without sneaking in winner/tie semantics.
  for (const candidate of projection.candidates) {
    let previousCompanion = candidate.companionStart;
    graphics.lineStyle(4, 0x39d0d8, 0.72);
    for (const frame of candidate.frames) {
      graphics.lineBetween(
        sx(previousCompanion.x),
        sy(previousCompanion.y),
        sx(frame.companionPosition.x),
        sy(frame.companionPosition.y)
      );
      previousCompanion = frame.companionPosition;
    }
    graphics.fillStyle(0x39d0d8, 0.92).fillCircle(
      sx(previousCompanion.x),
      sy(previousCompanion.y),
      6
    );
  }
}

/**
 * P1 is explicit research apparatus only. It reuses the Z4c decision seam to
 * build an embodied H1 counterfactual from the exact same-tick A1 situation,
 * returns the original live intents unchanged, and draws all frontier members
 * only on the immediately aligned post-step frame.
 */
export function installAuthorityA12p1BrowserBridge(search: string, scenePrototype: object): void {
  const params = new URLSearchParams(search);
  if (
    params.get(DEBUG_FLAG) !== "1" ||
    params.get(P1_FLAG) !== "1" ||
    window.__authorityA12p1BrowserBridge
  ) return;

  const prototype = scenePrototype as Record<string, unknown>;
  const originalCompute = prototype.computeIntents;
  const originalDraw = prototype.drawWorld;
  if (typeof originalCompute !== "function" || typeof originalDraw !== "function") {
    throw new Error("Authority-A1.2p1 could not locate the R1 decision/draw seams.");
  }

  let nextRequestId = 1;
  let pending: { requestId: number; horizonSeconds: number } | null = null;
  let requestCount = 0;
  let completedCount = 0;
  let lastError: string | null = null;
  let latest: AuthorityA12p1ProbeEvidence | null = null;

  const compute = originalCompute as ComputeIntents;
  prototype.computeIntents = function(this: SceneLike, before: WorldSnapshot): ComputeIntentsResult {
    const result = compute.call(this, before);
    const request = pending;
    if (!request) return result;

    const runtime = this.a1Authority.debugState();
    const situation = runtime.latestSituation;
    const ready =
      this.world !== null &&
      this.companionMode === "spatial" &&
      this.a1Authority.enabled() &&
      (runtime.variant === "direct" || runtime.variant === "temporal") &&
      situation !== null &&
      situation.tick === before.tick &&
      this.world.snapshot().tick === before.tick;
    if (!ready || !situation || !this.world || runtime.variant === "off") return result;

    pending = null;
    const startedAt = performance.now();
    try {
      const projection = buildA1EmbodiedH1ShadowProjection({
        world: this.world,
        situation,
        horizonSeconds: request.horizonSeconds
      });
      latest = {
        requestId: request.requestId,
        publishedAtMs: performance.now(),
        durationMs: performance.now() - startedAt,
        tick: situation.tick,
        variant: runtime.variant,
        horizonSeconds: request.horizonSeconds,
        situation: cloneA1Situation(situation),
        selectedCompanionIntent: cloneIntent(
          result.intents.find((intent) => intent.actorId === "companion") ?? null
        ),
        projection: cloneProjection(projection)
      };
      completedCount += 1;
      lastError = null;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    return result;
  };

  const draw = originalDraw as DrawWorld;
  prototype.drawWorld = function(this: SceneLike, snapshot: WorldSnapshot): void {
    draw.call(this, snapshot);
    if (latest) drawProjection(this.graphics, snapshot, latest.projection);
  };

  const snapshot = (): AuthorityA12p1BrowserSnapshot => ({
    schema: SCHEMA,
    stage: "Authority-A1.2p1",
    authority: "ZERO_MOVEMENT_AUTHORITY_EXPLICIT_EMBODIED_SHADOW_PROBE",
    pendingRequestId: pending?.requestId ?? null,
    requestCount,
    completedCount,
    lastError,
    latest: latest ? cloneEvidence(latest) : null
  });

  const bridge: AuthorityA12p1BrowserBridge = {
    enabled: true,
    schema: SCHEMA,
    requestProjection: (horizonSeconds) => {
      const boundedHorizon = finitePositiveHorizon(horizonSeconds);
      if (pending) return pending.requestId;
      const requestId = nextRequestId;
      nextRequestId += 1;
      pending = { requestId, horizonSeconds: boundedHorizon };
      requestCount += 1;
      return requestId;
    },
    snapshot
  };

  Object.defineProperty(window, "__authorityA12p1BrowserBridge", {
    configurable: false,
    enumerable: false,
    writable: false,
    value: bridge
  });
}
