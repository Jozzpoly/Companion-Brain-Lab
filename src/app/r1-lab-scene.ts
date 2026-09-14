import Phaser from "phaser";
import type { FinalCommandConstraintResult } from "../brain/final-command-constraint";
import type { MotionContinuityStepResult } from "../brain/motion-continuity";
import type { PreferredVelocityRefinement } from "../brain/preferred-velocity-refinement";
import type { ProgressRecoveryDecision } from "../brain/progress-recovery";
import {
  COMPANION_MODES,
  RelationalPositioningBrain,
  chaseIntent,
  type CompanionMode,
  type RelationalDecision
} from "../brain/relational-positioning";
import type { R1SpatialRepairEvidence } from "../brain/r1-hard-comfort-spatial";
import {
  R1WorkbenchSpatialStack,
  type R1WorkbenchSpatialDebug
} from "../brain/r1-workbench-spatial-stack";
import type { SpatialLocomotionDecision } from "../brain/spatial-locomotion";
import {
  CausalPanel,
  type CausalPanelAction,
  type CausalPanelModel
} from "../debug/causal-panel";
import {
  CausalFrameTrace,
  type CausalFrame,
  type CausalPostClassification
} from "../debug/causal-frame-trace";
import {
  S2C_ROUTE_CLEARANCE,
  planStaticShadowRoute,
  type StaticRoutePlan
} from "../navigation/static-router";
import { S0_STEP_SECONDS } from "../physics/rapier-physical-world";
import { SCENARIOS } from "../world/scenarios";
import type {
  ActorSnapshot,
  MotionIntent,
  ScenarioId,
  StaticCircleTraversalResult,
  Vec2,
  WorldSnapshot
} from "../world/types";
import { LabWorld } from "../world/world";

const VIEW_WIDTH = 1200;
const VIEW_HEIGHT = 800;
const MAX_FRAME_SECONDS = 0.1;
const TIME_SCALES = [0.25, 0.5, 1, 2] as const;
const TRAIL_CAPACITY = 240;
const EXPERIMENT_SPEED = 3;

function axis(negative: Phaser.Input.Keyboard.Key, positive: Phaser.Input.Keyboard.Key): number {
  return (positive.isDown ? 1 : 0) - (negative.isDown ? 1 : 0);
}

function normalizedMotion(x: number, y: number): Vec2 {
  const length = Math.hypot(x, y);
  return length > 1 ? { x: x / length, y: y / length } : { x, y };
}

function magnitude(value: Vec2): number {
  return Math.hypot(value.x, value.y);
}

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function actor(snapshot: WorldSnapshot, id: "player" | "companion"): ActorSnapshot {
  const value = snapshot.actors.find((entry) => entry.id === id);
  if (!value) throw new Error(`R1 scene missing ${id}.`);
  return value;
}

function scaled(value: Vec2, scale: number): Vec2 {
  return { x: value.x * scale, y: value.y * scale };
}

function compact(value: number): string {
  return Number.isFinite(value) ? value.toFixed(3) : "n/a";
}

function probeLabel(probe: StaticCircleTraversalResult | null): "clear" | "blocked-zero" | "blocked" | "unknown" {
  if (!probe) return "unknown";
  if (probe.clear) return "clear";
  return (probe.blocker?.distance ?? Number.POSITIVE_INFINITY) < 1e-5 ? "blocked-zero" : "blocked";
}

function hardProbeLabel(probe: StaticCircleTraversalResult | null): "clear" | "blocked" | "unknown" {
  const value = probeLabel(probe);
  return value === "clear" ? "clear" : value === "unknown" ? "unknown" : "blocked";
}

function progressTone(state: string | undefined): CausalPanelModel["badgeTone"] {
  if (!state) return "normal";
  const normalized = state.toUpperCase();
  if (normalized === "PERSISTENT_UNREACHABLE" || normalized === "ROUTE_INVALID") return "danger";
  if (
    normalized === "NO_PROGRESS" ||
    normalized === "BLOCKED_PLAYER" ||
    normalized === "BLOCKED_STATIC" ||
    normalized === "RECOVERING" ||
    normalized === "TRANSIENT_UNREACHABLE" ||
    normalized === "HOLDING_UNEXPLAINED" ||
    normalized === "HOLDING" ||
    normalized === "BLOCKED" ||
    normalized === "UNREACHABLE"
  ) return "warning";
  if (
    normalized === "PROGRESSING" ||
    normalized === "TRACKING_MOVING_OBJECTIVE" ||
    normalized === "ARRIVED"
  ) return "success";
  return "normal";
}

interface StepDecisionEvidence {
  before: WorldSnapshot;
  intents: MotionIntent[];
  route: StaticRoutePlan | null;
  relationship: RelationalDecision | null;
  target: Vec2 | null;
  objectiveKey: string | null;
  actuator: "direct" | "natural" | null;
  spatial: SpatialLocomotionDecision | null;
  repair: R1SpatialRepairEvidence | null;
  refinement: PreferredVelocityRefinement | null;
  continuity: MotionContinuityStepResult | null;
  finalConstraint: FinalCommandConstraintResult | null;
}

export class R1LabScene extends Phaser.Scene {
  private world: LabWorld | null = null;
  private snapshotValue: WorldSnapshot | null = null;
  private graphics!: Phaser.GameObjects.Graphics;
  private panel!: CausalPanel;
  private accumulator = 0;
  private paused = false;
  private loading = false;
  private singleStepQueued = false;
  private scenarioId: ScenarioId = "open";
  private companionMode: CompanionMode = "spatial";
  private naturalActuator = true;
  private timeScaleIndex = 2;

  private readonly relationalBrain = new RelationalPositioningBrain();
  private readonly spatialStack = new R1WorkbenchSpatialStack();
  private relationalDecision: RelationalDecision | null = null;
  private spatialDecision: SpatialLocomotionDecision | null = null;
  private spatialRepairDecision: R1SpatialRepairEvidence | null = null;
  private refinementDecision: PreferredVelocityRefinement | null = null;
  private continuityDecision: MotionContinuityStepResult | null = null;
  private finalConstraintDecision: FinalCommandConstraintResult | null = null;
  private progressDecision: ProgressRecoveryDecision | null = null;
  private appliedLocalRetries = 0;
  private decisionRoutePlan: StaticRoutePlan | null = null;
  private postRoutePlan: StaticRoutePlan | null = null;
  private hardProbe: StaticCircleTraversalResult | null = null;
  private desiredProbe: StaticCircleTraversalResult | null = null;

  private readonly causalTrace = new CausalFrameTrace(480);
  private readonly eventLog: string[] = [];
  private readonly playerTrail: Vec2[] = [];
  private readonly companionTrail: Vec2[] = [];
  private incidentNotice = "";
  private lastPostSignature = "";

  private keys!: Record<
    "w" | "a" | "s" | "d" | "up" | "down" | "left" | "right" |
    "reset" | "pause" | "step" | "mode" | "incident" | "natural" | "time" |
    "one" | "two" | "three" | "four",
    Phaser.Input.Keyboard.Key
  >;

  constructor() {
    super("r1-lab");
  }

  create(): void {
    this.graphics = this.add.graphics();
    this.panel = new CausalPanel((action) => this.handlePanelAction(action));

    const keyboard = this.input.keyboard;
    if (!keyboard) throw new Error("Keyboard input is required for R1 workbench.");
    this.keys = keyboard.addKeys({
      w: Phaser.Input.Keyboard.KeyCodes.W,
      a: Phaser.Input.Keyboard.KeyCodes.A,
      s: Phaser.Input.Keyboard.KeyCodes.S,
      d: Phaser.Input.Keyboard.KeyCodes.D,
      up: Phaser.Input.Keyboard.KeyCodes.UP,
      down: Phaser.Input.Keyboard.KeyCodes.DOWN,
      left: Phaser.Input.Keyboard.KeyCodes.LEFT,
      right: Phaser.Input.Keyboard.KeyCodes.RIGHT,
      reset: Phaser.Input.Keyboard.KeyCodes.R,
      pause: Phaser.Input.Keyboard.KeyCodes.P,
      step: Phaser.Input.Keyboard.KeyCodes.O,
      mode: Phaser.Input.Keyboard.KeyCodes.M,
      incident: Phaser.Input.Keyboard.KeyCodes.I,
      natural: Phaser.Input.Keyboard.KeyCodes.N,
      time: Phaser.Input.Keyboard.KeyCodes.T,
      one: Phaser.Input.Keyboard.KeyCodes.ONE,
      two: Phaser.Input.Keyboard.KeyCodes.TWO,
      three: Phaser.Input.Keyboard.KeyCodes.THREE,
      four: Phaser.Input.Keyboard.KeyCodes.FOUR
    }) as typeof this.keys;

    void this.loadScenario(this.scenarioId);
  }

  update(_time: number, deltaMs: number): void {
    this.handleKeyboard();
    if (!this.world || !this.snapshotValue || this.loading) return;

    const timeScale = TIME_SCALES[this.timeScaleIndex] ?? 1;
    const frameSeconds = Math.min(deltaMs / 1000, MAX_FRAME_SECONDS);
    if (!this.paused) this.accumulator += frameSeconds * timeScale;

    if (this.singleStepQueued) {
      this.stepWorld();
      this.singleStepQueued = false;
    }
    while (!this.paused && this.accumulator >= S0_STEP_SECONDS) {
      this.stepWorld();
      this.accumulator -= S0_STEP_SECONDS;
    }

    this.drawWorld(this.snapshotValue);
    this.updatePanel(this.snapshotValue);
  }

  private stepWorld(): void {
    if (!this.world || !this.snapshotValue) return;
    const evidence = this.computeIntents(this.snapshotValue);
    const after = this.world.step(evidence.intents);
    this.snapshotValue = after;
    this.updatePostEvidence(after, evidence.target);

    if (
      this.companionMode === "spatial" &&
      evidence.target &&
      evidence.objectiveKey &&
      evidence.actuator &&
      this.postRoutePlan
    ) {
      this.progressDecision = this.spatialStack.observeOutcome(
        evidence.actuator === "natural",
        {
          snapshot: after,
          objectiveKey: evidence.objectiveKey,
          target: evidence.target,
          routePlan: this.postRoutePlan
        }
      );
      const postDebug = this.spatialStack.debugState(evidence.actuator === "natural");
      this.appliedLocalRetries = postDebug.appliedLocalRetries;
    } else {
      this.progressDecision = null;
      this.appliedLocalRetries = 0;
    }

    this.recordTrail(after);
    this.recordCausalFrame(evidence, after);
  }

  private computeIntents(before: WorldSnapshot): StepDecisionEvidence {
    if (!this.world) throw new Error("Cannot compute R1 intent without World.");

    const playerIntent: MotionIntent = {
      actorId: "player",
      move: normalizedMotion(axis(this.keys.a, this.keys.d), axis(this.keys.w, this.keys.s))
    };

    let companionIntent: MotionIntent;
    let target: Vec2 | null = null;
    let objectiveKey: string | null = null;
    let actuator: "direct" | "natural" | null = null;
    this.refinementDecision = null;
    this.continuityDecision = null;
    this.finalConstraintDecision = null;
    this.spatialRepairDecision = null;
    this.decisionRoutePlan = null;

    if (this.companionMode === "manual") {
      this.relationalDecision = null;
      this.spatialDecision = null;
      companionIntent = {
        actorId: "companion",
        move: normalizedMotion(axis(this.keys.left, this.keys.right), axis(this.keys.up, this.keys.down))
      };
    } else if (this.companionMode === "chase") {
      this.relationalDecision = null;
      this.spatialDecision = null;
      target = { ...actor(before, "player").position };
      companionIntent = chaseIntent(before);
    } else if (this.companionMode === "relational") {
      companionIntent = this.relationalBrain.intent(before);
      this.relationalDecision = this.relationalBrain.debugState();
      target = this.relationalDecision ? { ...this.relationalDecision.target } : null;
      this.spatialDecision = null;
    } else {
      const relationship = this.relationalBrain.decision(before);
      this.relationalDecision = relationship;
      target = { ...relationship.target };
      objectiveKey = `spatial-slot:${relationship.selectedSlot}`;
      actuator = this.naturalActuator ? "natural" : "direct";
      const route = this.buildRoute(before, relationship.target);
      this.decisionRoutePlan = route;
      const input = {
        snapshot: before,
        relationshipTarget: relationship.target,
        routePlan: route,
        query: (from: Vec2, to: Vec2, radius: number) => this.world!.staticCircleTraversal(from, to, radius),
        occupancy: (center: Vec2, radius: number) => this.world!.staticCircleOccupancy(center, radius)
      };

      companionIntent = this.spatialStack.intent(this.naturalActuator, input);
      const debug = this.spatialStack.debugState(this.naturalActuator);
      this.captureSpatialDebug(debug);
    }

    return {
      before,
      intents: [playerIntent, companionIntent],
      route: this.decisionRoutePlan,
      relationship: this.relationalDecision,
      target,
      objectiveKey,
      actuator,
      spatial: this.spatialDecision,
      repair: this.spatialRepairDecision,
      refinement: this.refinementDecision,
      continuity: this.continuityDecision,
      finalConstraint: this.finalConstraintDecision
    };
  }

  private captureSpatialDebug(debug: R1WorkbenchSpatialDebug): void {
    this.spatialDecision = debug.preferred;
    this.spatialRepairDecision = debug.repair;
    this.refinementDecision = debug.refinement;
    this.continuityDecision = debug.continuity;
    this.finalConstraintDecision = debug.finalConstraint;
    this.progressDecision = debug.progress;
    this.appliedLocalRetries = debug.appliedLocalRetries;
  }

  private navigationTarget(snapshot: WorldSnapshot): Vec2 | null {
    if (this.companionMode === "spatial" || this.companionMode === "relational") {
      return this.relationalDecision?.target ?? null;
    }
    if (this.companionMode === "chase") return { ...actor(snapshot, "player").position };
    return null;
  }

  private buildRoute(snapshot: WorldSnapshot, target: Vec2): StaticRoutePlan {
    if (!this.world) throw new Error("Cannot build R1 route without World.");
    const companion = actor(snapshot, "companion");
    return planStaticShadowRoute({
      snapshot,
      start: companion.position,
      target,
      radius: companion.radius,
      query: (from, to, radius) => this.world!.staticCircleTraversal(from, to, radius)
    });
  }

  private updatePostEvidence(snapshot: WorldSnapshot, targetOverride: Vec2 | null = null): void {
    if (!this.world) return;
    const target = targetOverride ?? this.navigationTarget(snapshot);
    if (!target) {
      this.postRoutePlan = null;
      this.hardProbe = null;
      this.desiredProbe = null;
      return;
    }
    const companion = actor(snapshot, "companion");
    this.postRoutePlan = this.buildRoute(snapshot, target);
    this.hardProbe = this.world.staticCircleTraversal(companion.position, target, companion.radius);
    this.desiredProbe = this.world.staticCircleTraversal(
      companion.position,
      target,
      companion.radius + S2C_ROUTE_CLEARANCE
    );
  }

  private classifyPost(
    target: Vec2 | null,
    commandedMove: Vec2,
    displacement: number
  ): CausalPostClassification {
    const hard = hardProbeLabel(this.hardProbe);
    const desired = probeLabel(this.desiredProbe);

    if (this.companionMode === "spatial" && this.progressDecision) {
      return {
        state: this.progressDecision.state,
        action: this.progressDecision.action,
        reason: this.progressDecision.reason,
        hardProbe: hard,
        desiredClearanceProbe: desired,
        noProgressTicks: this.progressDecision.noProgressTicks,
        unreachableTicks: this.progressDecision.unreachableTicks,
        retryCount: this.progressDecision.retryCount,
        appliedLocalRetries: this.appliedLocalRetries
      };
    }

    const route = this.postRoutePlan;
    if (!target || !this.snapshotValue) {
      return {
        state: "unknown",
        reason: "baseline mode has no supervised spatial navigation target",
        hardProbe: hard,
        desiredClearanceProbe: desired
      };
    }
    const companion = actor(this.snapshotValue, "companion");
    if (distance(companion.position, target) < 0.16) {
      return {
        state: "arrived",
        reason: "baseline diagnostic: navigation target satisfied",
        hardProbe: hard,
        desiredClearanceProbe: desired
      };
    }
    if (route?.status === "unreachable" || route?.status === "invalid-target") {
      return {
        state: "unreachable",
        reason: `baseline diagnostic: ${route.reason}`,
        hardProbe: hard,
        desiredClearanceProbe: desired
      };
    }
    if (magnitude(commandedMove) < 0.03) {
      return {
        state: "holding",
        reason: "baseline diagnostic: commanded move is approximately zero",
        hardProbe: hard,
        desiredClearanceProbe: desired
      };
    }
    if (displacement < 0.002) {
      return {
        state: "blocked",
        reason: "baseline diagnostic: nonzero command produced negligible displacement",
        hardProbe: hard,
        desiredClearanceProbe: desired
      };
    }
    return {
      state: "moving",
      reason: "baseline diagnostic: nonzero command produced physical displacement; not R1 progress semantics",
      hardProbe: hard,
      desiredClearanceProbe: desired
    };
  }

  private recordCausalFrame(evidence: StepDecisionEvidence, after: WorldSnapshot): void {
    const beforeCompanion = actor(evidence.before, "companion");
    const beforePlayer = actor(evidence.before, "player");
    const afterCompanion = actor(after, "companion");
    const companionIntent = evidence.intents.find((intent) => intent.actorId === "companion") ?? {
      actorId: "companion" as const,
      move: { x: 0, y: 0 }
    };
    const target = evidence.target;
    const displacement = distance(beforeCompanion.position, afterCompanion.position);
    const post = this.classifyPost(target, companionIntent.move, displacement);

    const refinedVelocity = evidence.continuity?.preferredVelocity
      ?? (evidence.refinement ? scaled(evidence.refinement.refinedMove, EXPERIMENT_SPEED) : null);
    const actuator: CausalFrame["command"]["actuator"] = this.companionMode === "manual"
      ? "manual"
      : this.companionMode === "chase"
        ? "chase"
        : this.companionMode === "relational"
          ? "relational"
          : evidence.actuator ?? (this.naturalActuator ? "natural" : "direct");

    const frame: CausalFrame = {
      sequence: this.causalTrace.nextSequence(),
      observation: {
        worldTick: evidence.before.tick,
        companionPosition: { ...beforeCompanion.position },
        playerPosition: { ...beforePlayer.position },
        companionActualVelocity: { ...beforeCompanion.actualVelocity },
        companionContacts: beforeCompanion.contacts.map((contact) => contact.with)
      },
      decision: {
        relationshipRevision: evidence.relationship?.reconsiderationCount ?? null,
        relationshipLabel: evidence.relationship?.selectedSlot ?? null,
        relationshipTarget: target ? { ...target } : null,
        routeStatus: evidence.route?.status ?? null,
        routePath: evidence.route?.routeNodeIds.join(">") ?? "",
        routeCost: evidence.route?.cost ?? null,
        routeClearanceConstrained: evidence.route?.clearanceConstrained ?? null,
        spatialState: evidence.spatial?.state ?? null,
        spatialCandidate: evidence.spatial?.selectedCandidateId ?? null,
        preferredVelocity: evidence.spatial ? { ...evidence.spatial.selectedVelocity } : null,
        refinedVelocity,
        comfortStartViolated: evidence.repair?.comfortStartViolated ?? null,
        comfortStartBlockers: evidence.repair ? [...evidence.repair.comfortStartBlockers] : [],
        rehabilitatedCandidateCount: evidence.repair?.rehabilitatedCandidateIds.length ?? null,
        comfortExitCandidateCount: evidence.repair?.comfortExitCandidateIds.length ?? null
      },
      command: {
        actuator,
        commandedMove: { ...companionIntent.move },
        commandedVelocity: { ...afterCompanion.requestedVelocity },
        finalConstraintSource: evidence.finalConstraint?.source ?? null,
        finalConstrained: evidence.finalConstraint?.constrained ?? null,
        finalConstraintReason: evidence.finalConstraint?.reason ?? null
      },
      outcome: {
        worldTick: after.tick,
        companionPosition: { ...afterCompanion.position },
        companionRequestedVelocity: { ...afterCompanion.requestedVelocity },
        companionActualVelocity: { ...afterCompanion.actualVelocity },
        companionContacts: afterCompanion.contacts.map((contact) => contact.with),
        displacement,
        postRouteStatus: this.postRoutePlan?.status ?? null,
        postRoutePath: this.postRoutePlan?.routeNodeIds.join(">") ?? "",
        postRouteClearanceConstrained: this.postRoutePlan?.clearanceConstrained ?? null
      },
      post
    };
    this.causalTrace.record(frame);

    const postSignature = `${post.state}|${post.action ?? "NONE"}|${post.reason}`;
    if (postSignature !== this.lastPostSignature) {
      this.lastPostSignature = postSignature;
      this.logEvent(
        `f${frame.sequence} t${frame.observation.worldTick}->${frame.outcome.worldTick} ${post.state}${post.action ? ` / ${post.action}` : ""}: ${post.reason}`
      );
    }
  }

  private recordTrail(snapshot: WorldSnapshot): void {
    this.pushTrail(this.playerTrail, actor(snapshot, "player").position);
    this.pushTrail(this.companionTrail, actor(snapshot, "companion").position);
  }

  private pushTrail(trail: Vec2[], point: Vec2): void {
    trail.push({ ...point });
    if (trail.length > TRAIL_CAPACITY) trail.splice(0, trail.length - TRAIL_CAPACITY);
  }

  private logEvent(value: string): void {
    this.eventLog.push(value);
    if (this.eventLog.length > 80) this.eventLog.splice(0, this.eventLog.length - 80);
  }

  private drawWorld(snapshot: WorldSnapshot): void {
    const scale = Math.min(VIEW_WIDTH / snapshot.width, VIEW_HEIGHT / snapshot.height);
    const offsetX = (VIEW_WIDTH - snapshot.width * scale) / 2;
    const offsetY = (VIEW_HEIGHT - snapshot.height * scale) / 2;
    const sx = (x: number) => offsetX + x * scale;
    const sy = (y: number) => offsetY + y * scale;

    this.graphics.clear();
    this.graphics.fillStyle(0x171b22, 1).fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
    this.graphics.lineStyle(2, 0x55606f, 1).strokeRect(offsetX, offsetY, snapshot.width * scale, snapshot.height * scale);
    this.graphics.fillStyle(0x39414d, 1);
    for (const obstacle of snapshot.obstacles) {
      this.graphics.fillRect(sx(obstacle.x), sy(obstacle.y), obstacle.width * scale, obstacle.height * scale);
    }

    if (this.panel.layerVisible("trails")) this.drawTrails(sx, sy);
    if (this.panel.layerVisible("relationship")) this.drawRelationship(sx, sy);
    if (this.panel.layerVisible("route")) this.drawRoute(sx, sy);
    if (this.panel.layerVisible("spatial")) this.drawSpatial(sx, sy);

    for (const value of snapshot.actors) {
      const contact = value.contacts.length > 0;
      this.graphics.fillStyle(value.id === "player" ? 0x63a8ff : 0xf2c15c, 1);
      this.graphics.fillCircle(sx(value.position.x), sy(value.position.y), value.radius * scale);
      this.graphics.lineStyle(3, contact && this.panel.layerVisible("contacts") ? 0xff5d66 : 0xe7e9ee, 0.95);
      this.graphics.strokeCircle(sx(value.position.x), sy(value.position.y), value.radius * scale);
      if (value.id === "companion" && this.panel.layerVisible("route")) {
        const comfortViolated = this.spatialRepairDecision?.comfortStartViolated ?? false;
        this.graphics.lineStyle(2, comfortViolated ? 0xe3b341 : 0xf2c15c, comfortViolated ? 0.8 : 0.25);
        this.graphics.strokeCircle(
          sx(value.position.x),
          sy(value.position.y),
          (value.radius + S2C_ROUTE_CLEARANCE) * scale
        );
      }
      if (this.panel.layerVisible("motion")) this.drawMotion(value, sx, sy, scale);
    }
  }

  private drawTrails(sx: (x: number) => number, sy: (y: number) => number): void {
    const draw = (trail: readonly Vec2[], color: number): void => {
      this.graphics.lineStyle(2, color, 0.32);
      for (let index = 1; index < trail.length; index += 1) {
        const a = trail[index - 1];
        const b = trail[index];
        if (a && b) this.graphics.lineBetween(sx(a.x), sy(a.y), sx(b.x), sy(b.y));
      }
    };
    draw(this.playerTrail, 0x63a8ff);
    draw(this.companionTrail, 0xf2c15c);
  }

  private drawRelationship(sx: (x: number) => number, sy: (y: number) => number): void {
    const decision = this.relationalDecision;
    if (!decision) return;
    for (const candidate of decision.candidates) {
      const selected = candidate.slot === decision.selectedSlot;
      this.graphics.lineStyle(selected ? 3 : 1, candidate.valid ? 0x9da7b3 : 0xff5d66, selected ? 1 : 0.45);
      this.graphics.strokeCircle(sx(candidate.position.x), sy(candidate.position.y), selected ? 8 : 4);
    }
  }

  private drawRoute(sx: (x: number) => number, sy: (y: number) => number): void {
    const plan = this.postRoutePlan ?? this.decisionRoutePlan;
    if (!plan) return;
    const nodes = new Map(plan.nodes.map((node) => [node.id, node]));
    const routeColor = plan.clearanceConstrained ? 0xe3b341 : 0x58a6ff;
    for (let index = 0; index < plan.routeNodeIds.length - 1; index += 1) {
      const a = nodes.get(plan.routeNodeIds[index] ?? "");
      const b = nodes.get(plan.routeNodeIds[index + 1] ?? "");
      if (!a || !b) continue;
      this.graphics.lineStyle(5, routeColor, 0.85);
      this.graphics.lineBetween(sx(a.position.x), sy(a.position.y), sx(b.position.x), sy(b.position.y));
    }
    for (const node of plan.nodes) {
      const selected = plan.routeNodeIds.includes(node.id);
      this.graphics.fillStyle(selected ? routeColor : 0x8b949e, selected ? 0.9 : 0.28);
      this.graphics.fillCircle(sx(node.position.x), sy(node.position.y), selected ? 4 : 2);
    }
  }

  private drawSpatial(sx: (x: number) => number, sy: (y: number) => number): void {
    const decision = this.spatialDecision;
    if (!decision) return;
    const origin = decision.observation.companionPosition;
    const rehabilitated = new Set(this.spatialRepairDecision?.rehabilitatedCandidateIds ?? []);
    for (const ray of decision.observation.rays) {
      const end = {
        x: origin.x + ray.direction.x * ray.freeDistance,
        y: origin.y + ray.direction.y * ray.freeDistance
      };
      this.graphics.lineStyle(1, ray.blockedBy ? 0xff7b72 : 0x7ee787, ray.blockedBy ? 0.34 : 0.12);
      this.graphics.lineBetween(sx(origin.x), sy(origin.y), sx(end.x), sy(end.y));
    }
    for (const candidate of decision.candidates) {
      if (candidate.id === decision.selectedCandidateId) continue;
      const color = candidate.hardRejected
        ? 0xff5d66
        : rehabilitated.has(candidate.id)
          ? 0xe3b341
          : 0x8b949e;
      const alpha = candidate.hardRejected ? 0.16 : rehabilitated.has(candidate.id) ? 0.5 : 0.22;
      this.graphics.fillStyle(color, alpha);
      this.graphics.fillCircle(sx(candidate.predictedPosition.x), sy(candidate.predictedPosition.y), rehabilitated.has(candidate.id) ? 3 : 2);
    }
    this.graphics.lineStyle(3, 0xd2a8ff, 0.9);
    this.graphics.lineBetween(
      sx(origin.x),
      sy(origin.y),
      sx(decision.observation.routeLookahead.x),
      sy(decision.observation.routeLookahead.y)
    );
  }

  private drawMotion(
    value: ActorSnapshot,
    sx: (x: number) => number,
    sy: (y: number) => number,
    scale: number
  ): void {
    const arrow = scale * 0.18;
    if (value.id === "companion" && this.spatialDecision) {
      const coarse = this.spatialDecision.selectedVelocity;
      this.graphics.lineStyle(2, 0x8b949e, 0.85);
      this.graphics.lineBetween(
        sx(value.position.x), sy(value.position.y),
        sx(value.position.x) + coarse.x * arrow,
        sy(value.position.y) + coarse.y * arrow
      );
    }
    if (value.id === "companion" && this.continuityDecision) {
      const refined = this.continuityDecision.preferredVelocity;
      this.graphics.lineStyle(4, 0xd2a8ff, 0.95);
      this.graphics.lineBetween(
        sx(value.position.x), sy(value.position.y),
        sx(value.position.x) + refined.x * arrow,
        sy(value.position.y) + refined.y * arrow
      );
    }
    const commandColor = value.id === "companion" && this.finalConstraintDecision?.constrained
      ? 0xe3b341
      : 0x7ee787;
    this.graphics.lineStyle(3, commandColor, 0.95);
    this.graphics.lineBetween(
      sx(value.position.x), sy(value.position.y),
      sx(value.position.x) + value.requestedVelocity.x * arrow,
      sy(value.position.y) + value.requestedVelocity.y * arrow
    );
    this.graphics.lineStyle(2, 0xff7b72, 0.95);
    this.graphics.lineBetween(
      sx(value.position.x), sy(value.position.y),
      sx(value.position.x) + value.actualVelocity.x * arrow,
      sy(value.position.y) + value.actualVelocity.y * arrow
    );
  }

  private updatePanel(snapshot: WorldSnapshot): void {
    const latest = this.causalTrace.latest();
    const timeScale = TIME_SCALES[this.timeScaleIndex] ?? 1;
    const post = latest?.post;
    const badgeTone = progressTone(post?.state);
    const route = latest?.decision;
    const outcome = latest?.outcome;
    const spatial = this.spatialDecision;
    const c = this.continuityDecision;
    const repair = this.spatialRepairDecision;
    const constraint = this.finalConstraintDecision;
    const companion = actor(snapshot, "companion");

    const sections: CausalPanelModel["sections"] = [
      {
        id: "run",
        title: "Run",
        lines: [
          `scenario ${SCENARIOS[snapshot.scenarioId].label}`,
          `tick ${snapshot.tick} · ${this.paused ? "PAUSED" : "RUNNING"} · ${timeScale}x`,
          `mode ${this.companionMode.toUpperCase()} · actuator ${this.naturalActuator ? "NATURAL" : "DIRECT"}`,
          `causal frames ${this.causalTrace.size()}${this.incidentNotice ? ` · ${this.incidentNotice}` : ""}`
        ]
      },
      {
        id: "objective",
        title: "Objective",
        lines: this.relationalDecision
          ? [
              `relationship #${this.relationalDecision.reconsiderationCount} · ${this.relationalDecision.selectedSlot}`,
              `semantic objective spatial-slot:${this.relationalDecision.selectedSlot}`,
              `target ${compact(this.relationalDecision.target.x)}, ${compact(this.relationalDecision.target.y)}`,
              this.relationalDecision.reason
            ]
          : [`${this.companionMode} baseline has no supervised relational objective`]
      },
      {
        id: "route",
        title: "Route · pre-decision vs post-outcome",
        tone: post?.state === "PERSISTENT_UNREACHABLE" || post?.state === "ROUTE_INVALID" ? "danger" : "normal",
        lines: [
          `used at observation t${latest?.observation.worldTick ?? "-"}: ${route?.routeStatus ?? "none"} · ${route?.routePath || "none"}`,
          `pre comfort-constrained ${route?.routeClearanceConstrained ?? "n/a"} · cost ${route?.routeCost ?? "n/a"}`,
          `after World t${outcome?.worldTick ?? "-"}: ${outcome?.postRouteStatus ?? "none"} · ${outcome?.postRoutePath || "none"}`,
          `post comfort-constrained ${outcome?.postRouteClearanceConstrained ?? "n/a"}`,
          `hard target corridor ${post?.hardProbe ?? "unknown"}`,
          `desired +${S2C_ROUTE_CLEARANCE.toFixed(2)} corridor ${post?.desiredClearanceProbe ?? "unknown"}`
        ]
      },
      {
        id: "spatial",
        title: "Local spatial decision · hard vs comfort",
        tone: repair?.comfortStartViolated ? "warning" : "normal",
        lines: spatial
          ? [
              `${spatial.state} via ${spatial.selectedCandidateId}`,
              `${spatial.acceptedCount} accepted / ${spatial.rejectedCount} rejected`,
              `coarse preferred ${compact(spatial.selectedVelocity.x)}, ${compact(spatial.selectedVelocity.y)}`,
              `route remaining ${compact(spatial.observation.routeRemainingDistance)}`,
              repair
                ? `comfort start ${repair.comfortStartViolated ? "VIOLATED" : "clear"} · blockers ${repair.comfortStartBlockers.join(", ") || "none"}`
                : "R1 hard/comfort evidence unavailable",
              repair
                ? `rehabilitated hard-safe ${repair.rehabilitatedCandidateIds.length} · hard rejects ${repair.hardRejectedCandidateIds.length} · exits ${repair.comfortExitCandidateIds.length}`
                : "candidate repair unavailable",
              this.refinementDecision
                ? `refinement ${this.refinementDecision.source} · Δ ${this.refinementDecision.angularDeltaDegrees.toFixed(1)}°`
                : this.naturalActuator ? "refinement unavailable" : "DIRECT: no temporal refinement"
            ]
          : ["spatial layer inactive"]
      },
      {
        id: "motion",
        title: "Motion realization · final hard command",
        tone: constraint?.constrained ? "warning" : "normal",
        lines: [
          `command/requested ${compact(companion.requestedVelocity.x)}, ${compact(companion.requestedVelocity.y)} · speed ${compact(magnitude(companion.requestedVelocity))}`,
          `actual ${compact(companion.actualVelocity.x)}, ${compact(companion.actualVelocity.y)} · speed ${compact(magnitude(companion.actualVelocity))}`,
          c
            ? `NATURAL ${c.regime} · preferred ${compact(c.preferredSpeed)} · continuity ${compact(c.speed)} · error ${compact(c.velocityError)}`
            : `${this.naturalActuator ? "NATURAL idle" : "DIRECT"}`,
          c ? `accel ${compact(c.accelerationMagnitude)} · jerk ${compact(c.jerkMagnitude)}` : "accel/jerk unavailable",
          constraint
            ? `final gate ${constraint.source} · constrained=${constraint.constrained} · blocker ${constraint.blockedBy ?? "none"}`
            : this.naturalActuator ? "final hard gate unavailable" : "DIRECT command already comes from hard-safe spatial selection",
          constraint?.reason ?? ""
        ].filter((line) => line.length > 0)
      },
      {
        id: "recovery",
        title: "Progress / recovery · post-World authority",
        tone: badgeTone,
        lines: [
          `state ${post?.state ?? "unknown"} · action ${post?.action ?? "NONE"}`,
          `no-progress ${post?.noProgressTicks ?? 0}t · unreachable ${post?.unreachableTicks ?? 0}t`,
          `retry episode ${post?.retryCount ?? 0} · applied local retries ${post?.appliedLocalRetries ?? 0}`,
          post?.reason ?? "no completed causal frame yet",
          this.companionMode === "spatial"
            ? "classification comes from post-World R1-4 monitor"
            : "baseline mode: diagnostic fallback only"
        ]
      },
      {
        id: "events",
        title: "Recent semantic transitions",
        lines: this.eventLog.slice(-8).reverse()
      }
    ];

    this.panel.update({
      title: "R1 Robustness Workbench",
      subtitle: `frame ${latest?.sequence ?? "-"} · observation t${latest?.observation.worldTick ?? "-"} → outcome t${latest?.outcome.worldTick ?? "-"}`,
      badge: post ? post.state.toUpperCase() : "LOADING",
      badgeTone,
      sections
    });
  }

  private handleKeyboard(): void {
    if (Phaser.Input.Keyboard.JustDown(this.keys.reset)) void this.loadScenario(this.scenarioId);
    if (Phaser.Input.Keyboard.JustDown(this.keys.pause)) this.togglePause();
    if (Phaser.Input.Keyboard.JustDown(this.keys.step)) this.queueSingleStep();
    if (Phaser.Input.Keyboard.JustDown(this.keys.mode)) this.cycleCompanionMode();
    if (Phaser.Input.Keyboard.JustDown(this.keys.natural)) this.toggleActuator();
    if (Phaser.Input.Keyboard.JustDown(this.keys.time)) this.cycleTimeScale();
    if (Phaser.Input.Keyboard.JustDown(this.keys.incident)) this.captureIncident();
    if (Phaser.Input.Keyboard.JustDown(this.keys.one)) void this.loadScenario("open");
    if (Phaser.Input.Keyboard.JustDown(this.keys.two)) void this.loadScenario("pillar");
    if (Phaser.Input.Keyboard.JustDown(this.keys.three)) void this.loadScenario("doorway");
    if (Phaser.Input.Keyboard.JustDown(this.keys.four)) void this.loadScenario("head-on");
  }

  private handlePanelAction(action: CausalPanelAction): void {
    if (action === "toggle-pause") this.togglePause();
    else if (action === "single-step") this.queueSingleStep();
    else if (action === "reset") void this.loadScenario(this.scenarioId);
    else if (action === "cycle-mode") this.cycleCompanionMode();
    else if (action === "toggle-actuator") this.toggleActuator();
    else if (action === "cycle-time") this.cycleTimeScale();
    else if (action === "capture-incident") this.captureIncident();
    else if (action === "scenario-open") void this.loadScenario("open");
    else if (action === "scenario-pillar") void this.loadScenario("pillar");
    else if (action === "scenario-doorway") void this.loadScenario("doorway");
    else if (action === "scenario-head-on") void this.loadScenario("head-on");
  }

  private togglePause(): void {
    this.paused = !this.paused;
    this.logEvent(`control pause=${this.paused}`);
  }

  private queueSingleStep(): void {
    this.paused = true;
    this.singleStepQueued = true;
    this.logEvent("control single-step");
  }

  private cycleCompanionMode(): void {
    const index = COMPANION_MODES.indexOf(this.companionMode);
    const next = COMPANION_MODES[(index + 1) % COMPANION_MODES.length];
    if (!next) return;
    const previous = this.companionMode;
    this.companionMode = next;
    this.resetBrains();
    this.logEvent(`control mode ${previous} -> ${next}`);
  }

  private toggleActuator(): void {
    this.naturalActuator = !this.naturalActuator;
    this.spatialStack.reset();
    this.clearSpatialDebug();
    this.logEvent(`control actuator ${this.naturalActuator ? "NATURAL" : "DIRECT"} (shared R1 movement/recovery state reset)`);
  }

  private cycleTimeScale(): void {
    this.timeScaleIndex = (this.timeScaleIndex + 1) % TIME_SCALES.length;
    this.logEvent(`control time ${TIME_SCALES[this.timeScaleIndex]}x`);
  }

  private captureIncident(): void {
    const snapshot = this.snapshotValue;
    if (!snapshot) return;
    const incident = {
      schema: "companion-brain-lab-r1-causal-incident-v2",
      scenario: snapshot.scenarioId,
      tick: snapshot.tick,
      mode: this.companionMode,
      actuator: this.naturalActuator ? "natural" : "direct",
      timeScale: TIME_SCALES[this.timeScaleIndex] ?? 1,
      frames: this.causalTrace.recent(240),
      events: [...this.eventLog]
    };
    const blob = new Blob([JSON.stringify(incident, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `companion-r1-${snapshot.scenarioId}-tick-${snapshot.tick}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    this.incidentNotice = `incident @ t${snapshot.tick}`;
    this.logEvent(this.incidentNotice);
  }

  private clearSpatialDebug(): void {
    this.spatialDecision = null;
    this.spatialRepairDecision = null;
    this.refinementDecision = null;
    this.continuityDecision = null;
    this.finalConstraintDecision = null;
    this.progressDecision = null;
    this.appliedLocalRetries = 0;
  }

  private resetBrains(): void {
    this.relationalBrain.reset();
    this.spatialStack.reset();
    this.relationalDecision = null;
    this.clearSpatialDebug();
    this.decisionRoutePlan = null;
    this.postRoutePlan = null;
    this.hardProbe = null;
    this.desiredProbe = null;
    this.lastPostSignature = "";
  }

  private async loadScenario(id: ScenarioId): Promise<void> {
    if (this.loading) return;
    this.loading = true;
    const previous = this.world;
    try {
      const next = await LabWorld.create(id);
      previous?.dispose();
      this.world = next;
      this.scenarioId = id;
      this.snapshotValue = next.snapshot();
      this.accumulator = 0;
      this.singleStepQueued = false;
      this.playerTrail.length = 0;
      this.companionTrail.length = 0;
      this.causalTrace.reset();
      this.eventLog.length = 0;
      this.incidentNotice = "";
      this.lastPostSignature = "";
      this.resetBrains();
      this.recordTrail(this.snapshotValue);
      this.updatePostEvidence(this.snapshotValue);
      this.logEvent(`scenario ${id} loaded`);
      this.drawWorld(this.snapshotValue);
      this.updatePanel(this.snapshotValue);
    } finally {
      this.loading = false;
    }
  }
}
