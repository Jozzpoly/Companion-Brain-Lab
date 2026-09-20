import { A1AuthorityRuntime } from "../coordination/a1-authority-runtime";
import {
  buildA1EmbodiedH1ShadowProjection,
  type A1EmbodiedShadowProjection
} from "../coordination/a1-embodied-shadow-projection";
import {
  buildA1ExplicitManualDirectCommand,
  type A1ExplicitManualDirectCommand
} from "../coordination/a1-manual-direct-authority";
import { buildA1Situation } from "../coordination/a1-situation";
import type { MotionIntent, Vec2, WorldSnapshot } from "../world/types";
import type { LabWorld } from "../world/world";

const DEBUG_FLAG = "a1debug";
const P2_FLAG = "a1p2";
const INCOMPATIBLE_PERTURBATION_FLAG = "semanticpush";
const SCHEMA = "companion-brain-lab-authority-a1-2p2-manual-direct-v1";
const VIEW_WIDTH = 1200;
const VIEW_HEIGHT = 800;

interface KeyLike {
  isDown: boolean;
}

interface GraphicsLike {
  lineStyle(width: number, color: number, alpha?: number): GraphicsLike;
  lineBetween(x1: number, y1: number, x2: number, y2: number): GraphicsLike;
  fillStyle(color: number, alpha?: number): GraphicsLike;
  fillCircle(x: number, y: number, radius: number): GraphicsLike;
}

interface SceneLike {
  world: LabWorld | null;
  snapshotValue: WorldSnapshot | null;
  companionMode: string;
  paused: boolean;
  keys: {
    a: KeyLike;
    d: KeyLike;
    w: KeyLike;
    s: KeyLike;
  };
  a1Authority: A1AuthorityRuntime;
  graphics: GraphicsLike;
}

interface ComputeIntentsResult {
  before: WorldSnapshot;
  intents: MotionIntent[];
}

type ComputeIntents = (this: SceneLike, before: WorldSnapshot) => ComputeIntentsResult;
type StepWorld = (this: SceneLike) => void;
type DrawWorld = (this: SceneLike, snapshot: WorldSnapshot) => void;

export interface AuthorityA12p2Preview {
  requestId: number;
  sourceTick: number;
  horizonSeconds: number;
  playerMove: Vec2;
  projection: A1EmbodiedShadowProjection;
  authorityClaim: "NONE_PREVIEW_ONLY_P2";
}

export interface AuthorityA12p2ArmedRequest {
  previewRequestId: number;
  sourceTick: number;
  horizonSeconds: number;
  proposalId: string;
  authorityClaim: "EXPLICIT_ONE_STEP_ARMED_NOT_YET_APPLIED_P2";
}

export interface AuthorityA12p2ApplicationEvidence {
  previewRequestId: number;
  sourceTick: number;
  outcomeTick: number | null;
  proposalId: string;
  baselineCompanionIntent: MotionIntent;
  selectedCompanionIntent: MotionIntent;
  command: A1ExplicitManualDirectCommand;
  a0CommandVelocity: Vec2 | null;
  a0CommandVelocityError: number | null;
  status: "APPLIED_PENDING_OUTCOME" | "APPLIED_OUTCOME_CONFIRMED";
  authorityClaim: "EXPLICIT_CALLER_ONE_STEP_DIRECT_P2";
}

export interface AuthorityA12p2BrowserSnapshot {
  schema: typeof SCHEMA;
  stage: "Authority-A1.2p2";
  authority: "EXPLICIT_MANUAL_ONE_STEP_DIRECT_ONLY_P2";
  previewCount: number;
  armCount: number;
  applicationCount: number;
  latestPreview: AuthorityA12p2Preview | null;
  armed: AuthorityA12p2ArmedRequest | null;
  latestApplication: AuthorityA12p2ApplicationEvidence | null;
  lastError: string | null;
}

export interface AuthorityA12p2BrowserBridge {
  readonly enabled: true;
  readonly schema: typeof SCHEMA;
  preview(horizonSeconds: number): AuthorityA12p2Preview;
  arm(proposalId: string): AuthorityA12p2ArmedRequest;
  disarm(): void;
  snapshot(): AuthorityA12p2BrowserSnapshot;
}

declare global {
  interface Window {
    __authorityA12p2BrowserBridge?: AuthorityA12p2BrowserBridge;
  }
}

function axis(negative: KeyLike, positive: KeyLike): number {
  return (positive.isDown ? 1 : 0) - (negative.isDown ? 1 : 0);
}

function normalizedMotion(x: number, y: number): Vec2 {
  const length = Math.hypot(x, y);
  return length > 1 ? { x: x / length, y: y / length } : { x, y };
}

function vectorDistance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function cloneIntent(value: MotionIntent): MotionIntent {
  return { actorId: value.actorId, move: { ...value.move } };
}

function clonePreview(value: AuthorityA12p2Preview): AuthorityA12p2Preview {
  return structuredClone(value);
}

function cloneArmed(value: AuthorityA12p2ArmedRequest): AuthorityA12p2ArmedRequest {
  return { ...value };
}

function cloneApplication(value: AuthorityA12p2ApplicationEvidence): AuthorityA12p2ApplicationEvidence {
  return structuredClone(value);
}

function finitePositiveHorizon(value: number): number {
  if (!Number.isFinite(value) || value <= 0 || value > 2) {
    throw new Error("P2 preview horizon must be finite, positive and <= 2 seconds.");
  }
  return value;
}

function drawPreview(
  graphics: GraphicsLike,
  snapshot: WorldSnapshot,
  preview: AuthorityA12p2Preview | null
): void {
  if (!preview || snapshot.tick !== preview.sourceTick) return;
  const projection = preview.projection;
  if (projection.candidates.length === 0) return;

  const scale = Math.min(VIEW_WIDTH / snapshot.width, VIEW_HEIGHT / snapshot.height);
  const offsetX = (VIEW_WIDTH - snapshot.width * scale) / 2;
  const offsetY = (VIEW_HEIGHT - snapshot.height * scale) / 2;
  const sx = (x: number) => offsetX + x * scale;
  const sy = (y: number) => offsetY + y * scale;

  const common = projection.candidates[0]!;
  let previousPlayer = common.playerStart;
  graphics.lineStyle(3, 0x63a8ff, 0.48);
  for (const frame of common.frames) {
    graphics.lineBetween(
      sx(previousPlayer.x),
      sy(previousPlayer.y),
      sx(frame.playerPosition.x),
      sy(frame.playerPosition.y)
    );
    previousPlayer = frame.playerPosition;
  }
  graphics.fillStyle(0x63a8ff, 0.75).fillCircle(sx(previousPlayer.x), sy(previousPlayer.y), 5);

  for (const candidate of projection.candidates) {
    let previousCompanion = candidate.companionStart;
    graphics.lineStyle(4, 0x39d0d8, 0.7);
    for (const frame of candidate.frames) {
      graphics.lineBetween(
        sx(previousCompanion.x),
        sy(previousCompanion.y),
        sx(frame.companionPosition.x),
        sy(frame.companionPosition.y)
      );
      previousCompanion = frame.companionPosition;
    }
    graphics.fillStyle(0x39d0d8, 0.9).fillCircle(
      sx(previousCompanion.x),
      sy(previousCompanion.y),
      6
    );
  }
}

export function installAuthorityA12p2BrowserBridge(search: string, scenePrototype: object): void {
  const params = new URLSearchParams(search);
  if (
    params.get(DEBUG_FLAG) !== "1" ||
    params.get(P2_FLAG) !== "1" ||
    window.__authorityA12p2BrowserBridge
  ) return;
  if (params.get(INCOMPATIBLE_PERTURBATION_FLAG) === "1") {
    throw new Error("P2 explicit authority cannot run with semanticpush perturbation apparatus.");
  }

  const prototype = scenePrototype as Record<string, unknown>;
  const originalCompute = prototype.computeIntents;
  const originalStepWorld = prototype.stepWorld;
  const originalDraw = prototype.drawWorld;
  if (
    typeof originalCompute !== "function" ||
    typeof originalStepWorld !== "function" ||
    typeof originalDraw !== "function"
  ) {
    throw new Error("Authority-A1.2p2 could not locate the R1 decision/step/draw seams.");
  }

  let scene: SceneLike | null = null;
  let nextPreviewRequestId = 1;
  let previewCount = 0;
  let armCount = 0;
  let applicationCount = 0;
  let latestPreview: AuthorityA12p2Preview | null = null;
  let armed: AuthorityA12p2ArmedRequest | null = null;
  let latestApplication: AuthorityA12p2ApplicationEvidence | null = null;
  let pendingOutcome: AuthorityA12p2ApplicationEvidence | null = null;
  let lastError: string | null = null;

  const compute = originalCompute as ComputeIntents;
  prototype.computeIntents = function(this: SceneLike, before: WorldSnapshot): ComputeIntentsResult {
    scene = this;
    const result = compute.call(this, before);
    const request = armed;
    if (!request) return result;

    // Authorization is one-shot even if validation refuses it.
    armed = null;
    try {
      if (!this.world) throw new Error("P2 armed step has no live World.");
      if (this.companionMode !== "spatial") {
        throw new Error("P2 explicit authority requires SPATIAL companion mode.");
      }
      const runtime = this.a1Authority.debugState();
      if (runtime.variant !== "direct" || !runtime.latestSituation) {
        throw new Error("P2 explicit authority requires live A1 DIRECT decision state.");
      }
      if (before.tick !== request.sourceTick || runtime.latestSituation.tick !== request.sourceTick) {
        throw new Error(
          `P2 armed request is stale: armed t${request.sourceTick}, live t${before.tick}.`
        );
      }

      const orientation = this.a1Authority.latestRelationshipOrientationEvidence();
      const command = buildA1ExplicitManualDirectCommand({
        world: this.world,
        situation: runtime.latestSituation,
        expectedSourceTick: request.sourceTick,
        horizonSeconds: request.horizonSeconds,
        proposalId: request.proposalId,
        orientation: orientation ?? undefined
      });
      const baselineCompanionIntent = result.intents.find(
        (intent) => intent.actorId === "companion"
      );
      if (!baselineCompanionIntent) throw new Error("P2 live step is missing baseline companion intent.");

      const selectedCompanionIntent = cloneIntent(command.motionIntent);
      const intents = result.intents.map((intent) =>
        intent.actorId === "companion" ? selectedCompanionIntent : intent
      );
      const application: AuthorityA12p2ApplicationEvidence = {
        previewRequestId: request.previewRequestId,
        sourceTick: command.sourceTick,
        outcomeTick: null,
        proposalId: command.proposalId,
        baselineCompanionIntent: cloneIntent(baselineCompanionIntent),
        selectedCompanionIntent: cloneIntent(selectedCompanionIntent),
        command: structuredClone(command),
        a0CommandVelocity: null,
        a0CommandVelocityError: null,
        status: "APPLIED_PENDING_OUTCOME",
        authorityClaim: "EXPLICIT_CALLER_ONE_STEP_DIRECT_P2"
      };
      pendingOutcome = application;
      latestApplication = application;
      applicationCount += 1;
      lastError = null;
      return { ...result, intents };
    } catch (error) {
      pendingOutcome = null;
      lastError = error instanceof Error ? error.message : String(error);
      return result;
    }
  };

  const stepWorld = originalStepWorld as StepWorld;
  prototype.stepWorld = function(this: SceneLike): void {
    scene = this;
    stepWorld.call(this);
    const application = pendingOutcome;
    if (!application) return;
    pendingOutcome = null;

    try {
      if (!this.world || !this.snapshotValue) {
        throw new Error("P2 applied command has no post-step World snapshot.");
      }
      const a0 = this.world.latestAuthorityA0StepEvidence();
      if (
        !a0 ||
        a0.observationTick !== application.sourceTick ||
        a0.outcomeTick !== application.command.validForOutcomeTick ||
        this.snapshotValue.tick !== application.command.validForOutcomeTick
      ) {
        throw new Error("P2 post-step A0 outcome is not aligned to the explicit one-step authorization.");
      }
      const error = vectorDistance(
        a0.companionVelocityCommand.velocity,
        application.command.commandVelocity
      );
      latestApplication = {
        ...application,
        outcomeTick: a0.outcomeTick,
        a0CommandVelocity: { ...a0.companionVelocityCommand.velocity },
        a0CommandVelocityError: error,
        status: "APPLIED_OUTCOME_CONFIRMED"
      };
      lastError = error <= 1e-9
        ? null
        : `P2 actual A0 command diverged from explicit command by ${error}.`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  };

  const draw = originalDraw as DrawWorld;
  prototype.drawWorld = function(this: SceneLike, snapshot: WorldSnapshot): void {
    scene = this;
    draw.call(this, snapshot);
    if (this.paused) drawPreview(this.graphics, snapshot, latestPreview);
  };

  const preview = (horizonSeconds: number): AuthorityA12p2Preview => {
    if (!scene || !scene.world || !scene.snapshotValue) {
      throw new Error("P2 preview requires an initialized live scene.");
    }
    if (!scene.paused) throw new Error("P2 preview requires PAUSED mode.");
    if (scene.companionMode !== "spatial") {
      throw new Error("P2 preview requires SPATIAL companion mode.");
    }
    if (scene.a1Authority.variant() !== "direct") {
      throw new Error("P2 preview requires A1 DIRECT.");
    }
    const live = scene.world.snapshot();
    if (live.tick !== scene.snapshotValue.tick) {
      throw new Error("P2 preview requires scene/World tick alignment.");
    }
    const playerMove = normalizedMotion(
      axis(scene.keys.a, scene.keys.d),
      axis(scene.keys.w, scene.keys.s)
    );
    if (Math.hypot(playerMove.x, playerMove.y) <= 1e-9) {
      throw new Error("P2 v0 preview requires active same-step Owner movement input.");
    }
    const boundedHorizon = finitePositiveHorizon(horizonSeconds);
    const situation = buildA1Situation({
      snapshot: live,
      playerIntent: { actorId: "player", move: playerMove },
      playerCapability: scene.world.actorMovementCapability("player"),
      companionCapability: scene.world.actorMovementCapability("companion"),
      previousWorldStep: scene.world.latestAuthorityA0StepEvidence()
    });
    const projection = buildA1EmbodiedH1ShadowProjection({
      world: scene.world,
      situation,
      horizonSeconds: boundedHorizon
    });
    const value: AuthorityA12p2Preview = {
      requestId: nextPreviewRequestId,
      sourceTick: live.tick,
      horizonSeconds: boundedHorizon,
      playerMove: { ...playerMove },
      projection,
      authorityClaim: "NONE_PREVIEW_ONLY_P2"
    };
    nextPreviewRequestId += 1;
    previewCount += 1;
    latestPreview = value;
    armed = null;
    lastError = null;
    return clonePreview(value);
  };

  const arm = (proposalId: string): AuthorityA12p2ArmedRequest => {
    if (!scene || !scene.world || !scene.snapshotValue) {
      throw new Error("P2 arm requires an initialized live scene.");
    }
    if (!scene.paused) throw new Error("P2 arm requires PAUSED mode.");
    if (!latestPreview) throw new Error("P2 arm requires a same-tick preview first.");
    const tick = scene.world.snapshot().tick;
    if (tick !== latestPreview.sourceTick || scene.snapshotValue.tick !== latestPreview.sourceTick) {
      throw new Error(
        `P2 preview is stale: preview t${latestPreview.sourceTick}, live t${tick}.`
      );
    }
    if (!latestPreview.projection.frontierProposalIds.includes(proposalId)) {
      throw new Error(`P2 cannot arm proposal ${proposalId}; it is outside the previewed frontier.`);
    }
    const value: AuthorityA12p2ArmedRequest = {
      previewRequestId: latestPreview.requestId,
      sourceTick: latestPreview.sourceTick,
      horizonSeconds: latestPreview.horizonSeconds,
      proposalId,
      authorityClaim: "EXPLICIT_ONE_STEP_ARMED_NOT_YET_APPLIED_P2"
    };
    armed = value;
    armCount += 1;
    lastError = null;
    return cloneArmed(value);
  };

  const snapshot = (): AuthorityA12p2BrowserSnapshot => ({
    schema: SCHEMA,
    stage: "Authority-A1.2p2",
    authority: "EXPLICIT_MANUAL_ONE_STEP_DIRECT_ONLY_P2",
    previewCount,
    armCount,
    applicationCount,
    latestPreview: latestPreview ? clonePreview(latestPreview) : null,
    armed: armed ? cloneArmed(armed) : null,
    latestApplication: latestApplication ? cloneApplication(latestApplication) : null,
    lastError
  });

  const bridge: AuthorityA12p2BrowserBridge = {
    enabled: true,
    schema: SCHEMA,
    preview,
    arm,
    disarm: () => {
      armed = null;
      lastError = null;
    },
    snapshot
  };

  Object.defineProperty(window, "__authorityA12p2BrowserBridge", {
    configurable: false,
    enumerable: false,
    writable: false,
    value: bridge
  });
}
