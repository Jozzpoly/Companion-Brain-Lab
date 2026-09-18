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
import { A1AuthorityRuntime } from "../coordination/a1-authority-runtime";
import { buildA1Situation } from "../coordination/a1-situation";
import { RelationshipOrientationTracker } from "../coordination/relationship-orientation-tracker";
import type { ShadowCoordinationFrame } from "../coordination/shadow-coordination-frame";
import { publishAuthorityA11fBrowserObservation } from "../debug/authority-a1-1f-browser-bridge";
import { publishAuthorityA10BrowserDecision } from "../debug/authority-a1-browser-bridge";
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
import { bindWorldStaticTraversalQuery } from "./static-traversal-query-adapter";

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

function compactNullable(value: number | null): string {
  return value === null ? "n/a" : compact(value);
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
    normalized === "UNREACHABLE" ||
    normalized === "INTENTIONAL_HOLD"
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
  shadowCoordination: ShadowCoordinationFrame | null;
  shadowCoordinationError: string | null;
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
  private readonly relationshipOrientation = new RelationshipOrientationTracker();
  private readonly spatialStack = new R1WorkbenchSpatialStack();
  private readonly a1Authority = new A1AuthorityRuntime();
  private relationalDecision: RelationalDecision | null = null;
  private spatialDecision: SpatialLocomotionDecision | null = null;
  private spatialRepairDecision: R1SpatialRepairEvidence | null = null;
  private refinementDecision: PreferredVelocityRefinement | null = null;
  private continuityDecision: MotionContinuityStepResult | null = null;
  private finalConstraintDecision: FinalCommandConstraintResult | null = null;
  private progressDecision: ProgressRecoveryDecision | null = null;
  private shadowCoordination: ShadowCoordinationFrame | null = null;
  private shadowCoordinationError: string | null = null;
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
          routePlan: this.postRoutePlan,
          intentionalHoldReason: evidence.relationship?.objectiveState === "NO_VALID_RELATIONAL_SLOT"
            ? evidence.relationship.reason
            : null
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
    this.shadowCoordination = null;
    this.shadowCoordinationError = null;
    this.decisionRoutePlan = null;

    const relationshipSemantic = (
      this.companionMode === "relational" || this.companionMode === "spatial"
    ) ? (() => {
      const situation = buildA1Situation({
        snapshot: before,
        playerIntent,
        playerCapability: this.world!.actorMovementCapability("player"),
        companionCapability: this.world!.actorMovementCapability("companion"),
        previousWorldStep: this.world!.latestAuthorityA0StepEvidence()
      });
      return {
        situation,
        orientation: this.relationshipOrientation.observe(situation)
      };
    })() : null;

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
      if (!relationshipSemantic) throw new Error("RELATIONAL mode requires canonical semantic orientation.");
      companionIntent = this.relationalBrain.intentWithSemanticOrientation(before, relationshipSemantic.orientation);
      this.relationalDecision = this.relationalBrain.debugState();
      target = this.relationalDecision ? { ...this.relationalDecision.target } : null;
      this.spatialDecision = null;
    } else {
      if (!relationshipSemantic) throw new Error("SPATIAL mode requires canonical semantic orientation.");
      const relationship = this.relationalBrain.decisionWithSemanticOrientation(before, relationshipSemantic.orientation);
      this.relationalDecision = relationship;
      target = { ...relationship.target };
      objectiveKey = `spatial-slot:${relationship.selectedSlot}`;
      actuator = this.naturalActuator ? "natural" : "direct";
      const route = this.buildRoute(before, relationship.target);
      this.decisionRoutePlan = route;
      const traversalQuery = bindWorldStaticTraversalQuery(this.world);
      const input = {
        snapshot: before,
        relationshipTarget: relationship.target,
        routePlan: route,
        query: traversalQuery,
        occupancy: (center: Vec2, radius: number) => this.world!.staticCircleOccupancy(center, radius)
      };

      companionIntent = this.spatialStack.intent(this.naturalActuator, input);
      const debug = this.spatialStack.debugState(this.naturalActuator);
      this.captureSpatialDebug(debug);
    }

    if (this.companionMode === "spatial" && this.a1Authority.enabled()) {
      if (!relationshipSemantic) throw new Error("Active A1 SPATIAL mode requires canonical relationship semantics.");
      const baselineCompanionIntent: MotionIntent = {
        actorId: "companion",
        move: { ...companionIntent.move }
      };
      const situation = relationshipSemantic.situation;
      this.a1Authority.observeRelationship({
        situation,
        orientation: relationshipSemantic.orientation,
        snapshot: before,
        query: bindWorldStaticTraversalQuery(this.world)
      });
      companionIntent = this.a1Authority.resolveCompanionIntent({
        baselineIntent: baselineCompanionIntent,
        situation
      });
      const a1Runtime = this.a1Authority.debugState();
      publishAuthorityA10BrowserDecision({
        runtime: a1Runtime,
        situation,
        baselineCompanionIntent,
        selectedCompanionIntent: companionIntent
      });
      publishAuthorityA11fBrowserObservation({
        runtime: a1Runtime,
        situation,
        baselineCompanionIntent,
        selectedCompanionIntent: companionIntent
      });
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
      finalConstraint: this.finalConstraintDecision,
      shadowCoordination: this.shadowCoordination,
      shadowCoordinationError: this.shadowCoordinationError
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
    this.shadowCoordination = debug.shadowCoordination;
    this.shadowCoordinationError = debug.shadowCoordinationError;
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
      query: bindWorldStaticTraversalQuery(this.world)
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
        appliedLocalRetries: this.appliedLocalRetries,
        retryBudgetUsedThisEpisode: this.progressDecision.retryCount,
        cumulativeLocalRetriesSinceReset: this.appliedLocalRetries
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
    const shadow = evidence.shadowCoordination;

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
        relationshipState: evidence.relationship?.objectiveState ?? null,
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
        comfortExitCandidateCount: evidence.repair?.comfortExitCandidateIds.length ?? null,
        shadowCoordination: shadow
          ? {
              kind: shadow.kind,
              shadowTick: shadow.tick,
              ageTicks: Math.max(0, evidence.before.tick - shadow.tick),
              regionState: shadow.region.state,
              regionAnchor: shadow.region.representativeAnchor ? { ...shadow.region.representativeAnchor } : null,
              regionBestSampleId: shadow.region.bestSampleId,
              regionCoherentSampleCount: shadow.region.coherentSampleIds.length,
              regionRouteEvaluatedCount: shadow.region.routeEvaluatedCount,
              regionStaticTraversalQueryCount: shadow.region.staticTraversalQueryCount,
              regionTopologyKeyChanged: shadow.regionContinuity.topologyKeyChanged,
              regionCoherentOverlapRatio: shadow.regionContinuity.coherentSampleOverlapRatio,
              regionAnchorDisplacement: shadow.regionContinuity.anchorDisplacement,
              paceLabel: shadow.pace.label,
              paceUrgency: shadow.pace.urgency,
              desiredSpeed: shadow.pace.desiredSpeed,
              playerCorridorState: shadow.playerCorridor.state,
              playerCorridorConfidence: shadow.playerCorridor.confidence,
              playerCorridorEndpoint: { ...shadow.playerCorridor.endpoint },
              preferredFlowConflictState: shadow.preferredPlayerFlowConflict.state,
              preferredFlowClosestApproachTime: shadow.preferredPlayerFlowConflict.closestApproachTime,
              preferredFlowPhysicalClearance: shadow.preferredPlayerFlowConflict.physicalClearance,
              preferredFlowComfortClearance: shadow.preferredPlayerFlowConflict.comfortClearance,
              preferredFlowCompanionClosest: shadow.preferredPlayerFlowConflict.companionAtClosestApproach
                ? { ...shadow.preferredPlayerFlowConflict.companionAtClosestApproach }
                : null,
              preferredFlowPlayerClosest: shadow.preferredPlayerFlowConflict.playerAtClosestApproach
                ? { ...shadow.preferredPlayerFlowConflict.playerAtClosestApproach }
                : null,
              authoritativeFlowConflictState: shadow.authoritativePlayerFlowConflict.state,
              authoritativeFlowClosestApproachTime: shadow.authoritativePlayerFlowConflict.closestApproachTime,
              authoritativeFlowPhysicalClearance: shadow.authoritativePlayerFlowConflict.physicalClearance,
              authoritativeFlowComfortClearance: shadow.authoritativePlayerFlowConflict.comfortClearance,
              authoritativeFlowCompanionClosest: shadow.authoritativePlayerFlowConflict.companionAtClosestApproach
                ? { ...shadow.authoritativePlayerFlowConflict.companionAtClosestApproach }
                : null,
              authoritativeFlowPlayerClosest: shadow.authoritativePlayerFlowConflict.playerAtClosestApproach
                ? { ...shadow.authoritativePlayerFlowConflict.playerAtClosestApproach }
                : null,
              legacyTargetToShadowAnchorDistance: shadow.legacy.targetToShadowAnchorDistance,
              error: evidence.shadowCoordinationError
            }
          : evidence.shadowCoordinationError
            ? {
                kind: "CCC0_SHADOW_COORDINATION",
                shadowTick: evidence.before.tick,
                ageTicks: 0,
                regionState: "ERROR",
                regionAnchor: null,
                regionBestSampleId: null,
                regionCoherentSampleCount: 0,
                regionRouteEvaluatedCount: 0,
                regionStaticTraversalQueryCount: 0,
                regionTopologyKeyChanged: null,
                regionCoherentOverlapRatio: null,
                regionAnchorDisplacement: null,
                paceLabel: "ERROR",
                paceUrgency: 0,
                desiredSpeed: 0,
                playerCorridorState: "ERROR",
                playerCorridorConfidence: 0,
                playerCorridorEndpoint: { ...beforePlayer.position },
                preferredFlowConflictState: "ERROR",
                preferredFlowClosestApproachTime: null,
                preferredFlowPhysicalClearance: null,
                preferredFlowComfortClearance: null,
                preferredFlowCompanionClosest: null,
                preferredFlowPlayerClosest: null,
                authoritativeFlowConflictState: "ERROR",
                authoritativeFlowClosestApproachTime: null,
                authoritativeFlowPhysicalClearance: null,
                authoritativeFlowComfortClearance: null,
                authoritativeFlowCompanionClosest: null,
                authoritativeFlowPlayerClosest: null,
                legacyTargetToShadowAnchorDistance: null,
                error: evidence.shadowCoordinationError
              }
            : null
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
    if (this.panel.layerVisible("coordination")) this.drawCoordination(sx, sy, scale);
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

  private drawCoordination(
    sx: (x: number) => number,
    sy: (y: number) => number,
    scale: number
  ): void {
    const shadow = this.shadowCoordination;
    if (!shadow) return;
    const coherent = new Set(shadow.region.coherentSampleIds);

    for (const sample of shadow.region.samples) {
      let color = 0x6e7681;
      let alpha = 0.18;
      let radius = 2;
      if (!sample.hardValid) {
        color = 0xff5d66;
        alpha = 0.22;
      } else if (sample.routeEvaluated && !sample.reachable) {
        color = 0xe3b341;
        alpha = 0.34;
        radius = 2.5;
      } else if (coherent.has(sample.id)) {
        color = 0x7ee787;
        alpha = 0.9;
        radius = 4;
      } else if (sample.routeEvaluated && sample.reachable) {
        color = 0x58a6ff;
        alpha = 0.48;
        radius = 3;
      }
      this.graphics.fillStyle(color, alpha);
      this.graphics.fillCircle(sx(sample.position.x), sy(sample.position.y), radius);
    }

    const anchor = shadow.region.representativeAnchor;
    if (anchor) {
      this.graphics.lineStyle(3, 0x7ee787, 0.95);
      this.graphics.strokeCircle(sx(anchor.x), sy(anchor.y), 9);
      if (this.relationalDecision) {
        this.graphics.lineStyle(2, 0xd2a8ff, 0.55);
        this.graphics.lineBetween(
          sx(this.relationalDecision.target.x),
          sy(this.relationalDecision.target.y),
          sx(anchor.x),
          sy(anchor.y)
        );
      }
    }

    const corridor = shadow.playerCorridor;
    const corridorAlpha = corridor.state === "STATIONARY" ? 0.2 : 0.72 * Math.max(0.2, corridor.confidence);
    this.graphics.lineStyle(4, 0x63a8ff, corridorAlpha);
    this.graphics.lineBetween(
      sx(corridor.origin.x),
      sy(corridor.origin.y),
      sx(corridor.endpoint.x),
      sy(corridor.endpoint.y)
    );
    this.graphics.lineStyle(1, 0x63a8ff, Math.max(0.18, corridorAlpha * 0.7));
    this.graphics.strokeCircle(
      sx(corridor.endpoint.x),
      sy(corridor.endpoint.y),
      corridor.comfortRadius * scale
    );
    this.graphics.lineStyle(2, 0x63a8ff, Math.max(0.25, corridorAlpha));
    this.graphics.strokeCircle(
      sx(corridor.endpoint.x),
      sy(corridor.endpoint.y),
      corridor.physicalRadius * scale
    );

    const finalConflict = shadow.authoritativePlayerFlowConflict;
    const companionClosest = finalConflict.companionAtClosestApproach;
    const playerClosest = finalConflict.playerAtClosestApproach;
    if (finalConflict.state !== "UNAVAILABLE" && companionClosest && playerClosest) {
      const color = finalConflict.state === "PHYSICAL_CONFLICT"
        ? 0xff5d66
        : finalConflict.state === "COMFORT_CONFLICT"
          ? 0xe3b341
          : 0x8b949e;
      const alpha = finalConflict.state === "CLEAR" ? 0.28 : 0.9;
      this.graphics.lineStyle(finalConflict.state === "CLEAR" ? 1 : 3, color, alpha);
      this.graphics.lineBetween(
        sx(companionClosest.x),
        sy(companionClosest.y),
        sx(playerClosest.x),
        sy(playerClosest.y)
      );
      this.graphics.fillStyle(color, alpha);
      this.graphics.fillCircle(sx(companionClosest.x), sy(companionClosest.y), 4);
      this.graphics.fillCircle(sx(playerClosest.x), sy(playerClosest.y), 4);
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
    const shadow = this.shadowCoordination;
    const preferredConflict = shadow?.preferredPlayerFlowConflict ?? null;
    const finalConflict = shadow?.authoritativePlayerFlowConflict ?? null;
    const shadowAge = shadow ? Math.max(0, snapshot.tick - shadow.tick) : null;
    const a1 = this.a1Authority.debugState();
    const a1Active = a1.variant !== "off" && this.companionMode === "spatial";
    const a1Situation = a1.latestSituation;

    const sections: CausalPanelModel["sections"] = [
      {
        id: "run",
        title: "Run",
        lines: [
          `scenario ${SCENARIOS[snapshot.scenarioId].label}`,
          `tick ${snapshot.tick} · ${this.paused ? "PAUSED" : "RUNNING"} · ${timeScale}x`,
          `mode ${this.companionMode.toUpperCase()} · actuator ${this.naturalActuator ? "NATURAL" : "DIRECT"}`,
          `A1 ${a1.variant.toUpperCase()}${a1.variant !== "off" && this.companionMode !== "spatial" ? " · selected but inactive outside SPATIAL" : ""}`,
          `causal frames ${this.causalTrace.size()}${this.incidentNotice ? ` · ${this.incidentNotice}` : ""}`
        ]
      },
      {
        id: "a1",
        title: "Authority-A1.0 · decision-time seam",
        tone: a1Active ? "success" : "normal",
        lines: a1.variant === "off"
          ? [
              "OFF · baseline companion authority is untouched",
              "selector is orthogonal to Brain mode and Direct/Natural"
            ]
          : !a1Active
            ? [
                `${a1.variant.toUpperCase()} selected · inactive outside SPATIAL`,
                `epoch ${a1.epoch} · A1-owned state is isolated from baseline modes`,
                "A1.0 still has no new movement policy authority"
              ]
            : a1Situation
              ? [
                  `${a1.variant.toUpperCase()} · PASS-THROUGH ONLY · no new movement policy authority`,
                  `epoch ${a1.epoch} · pass-through steps ${a1.passThroughSteps}`,
                  `decision t${a1Situation.tick} · Owner move ${compact(a1Situation.situated.playerControl.move.x)}, ${compact(a1Situation.situated.playerControl.move.y)}`,
                  `same-step requested ${compact(a1Situation.playerRequestedVelocity.velocity.x)}, ${compact(a1Situation.playerRequestedVelocity.velocity.y)} · speed ${compact(a1Situation.playerRequestedVelocity.speed)}`,
                  `pre-step body requested ${compact(a1Situation.situated.playerBody.requestedVelocity.x)}, ${compact(a1Situation.situated.playerBody.requestedVelocity.y)} · actual ${compact(a1Situation.situated.playerBody.actualVelocity.x)}, ${compact(a1Situation.situated.playerBody.actualVelocity.y)}`,
                  `pre-step provenance ${a1Situation.situated.playerMotionProvenance.state}`,
                  a1Situation.previousOutcome
                    ? `previous World t${a1Situation.previousOutcome.observationTick}->${a1Situation.previousOutcome.outcomeTick} · player ${a1Situation.previousOutcome.playerMotionProvenance.state} · companion ${a1Situation.previousOutcome.companionOutcomeAttribution.state}`
                    : "previous World outcome none · initial decision tick"
                ]
              : [
                  `${a1.variant.toUpperCase()} active · waiting for first SPATIAL decision`,
                  `epoch ${a1.epoch}`,
                  "A1.0 still has no new movement policy authority"
                ]
      },
      ...(p2 ? [{
        id: "p2",
        title: "Authority-A1.2p2 · explicit one-step DIRECT",
        tone: p2.lastError ? "warning" : p2.armed ? "success" : "normal",
        lines: [
          p2.latestPreview
            ? `preview t${p2.latestPreview.sourceTick} · h=${compact(p2.latestPreview.horizonSeconds)}s · ${p2.latestPreview.projection.frontierState} · candidates ${p2.latestPreview.projection.frontierProposalIds.length}`
            : "preview none · press P2 Preview while PAUSED, SPATIAL, A1 DIRECT and holding Owner movement input",
          p2.armed
            ? `ARMED one step · t${p2.armed.sourceTick} · proposal ${p2.armed.proposalId}`
            : "armed none · no A1 P2 movement authority pending",
          p2.latestApplication
            ? `last apply t${p2.latestApplication.sourceTick}->${p2.latestApplication.outcomeTick ?? "?"} · ${p2.latestApplication.status} · proposal ${p2.latestApplication.proposalId}`
            : "last apply none",
          p2.latestApplication?.a0CommandVelocityError !== null &&
          p2.latestApplication?.a0CommandVelocityError !== undefined
            ? `A0 command error ${p2.latestApplication.a0CommandVelocityError.toExponential(2)}`
            : "A0 command confirmation none",
          `counts preview ${p2.previewCount} · arm ${p2.armCount} · apply ${p2.applicationCount}`,
          p2.lastError ?? "policy: explicit proposal only · one World step · auto-disarm · no automatic selector"
        ]
      }] : []),
      {
        id: "objective",
        title: "Objective",
        tone: this.relationalDecision?.objectiveState === "NO_VALID_RELATIONAL_SLOT" ? "warning" : "normal",
        lines: this.relationalDecision
          ? [
              `relationship #${this.relationalDecision.reconsiderationCount} · ${this.relationalDecision.selectedSlot}`,
              `relationship state ${this.relationalDecision.objectiveState}`,
              `semantic objective spatial-slot:${this.relationalDecision.selectedSlot}`,
              `target ${compact(this.relationalDecision.target.x)}, ${compact(this.relationalDecision.target.y)}`,
              this.relationalDecision.reason
            ]
          : [`${this.companionMode} baseline has no supervised relational objective`]
      },
      {
        id: "ccc-where",
        title: "CCC-0 shadow · WHERE",
        tone: this.shadowCoordinationError || shadow?.region.state === "NO_REACHABLE_REGION" ? "warning" : "normal",
        lines: this.shadowCoordinationError
          ? [`SHADOW ERROR · ${this.shadowCoordinationError}`, "authoritative movement remains unchanged"]
          : shadow
            ? [
                `sample t${shadow.tick} · age ${shadowAge ?? 0}t · state ${shadow.region.state} · heading ${shadow.region.playerHeadingSource}`,
                `best ${shadow.region.bestSampleId ?? "none"} · coherent ${shadow.region.coherentSampleIds.length} · route candidates ${shadow.region.routeEvaluatedCount} · static traversals ${shadow.region.staticTraversalQueryCount}`,
                `continuity topology ${shadow.regionContinuity.topologyKeyChanged === null ? "n/a" : shadow.regionContinuity.topologyKeyChanged ? "CHANGED" : "same"} · overlap ${compactNullable(shadow.regionContinuity.coherentSampleOverlapRatio)} · anchor Δ ${compactNullable(shadow.regionContinuity.anchorDisplacement)}`,
                shadow.region.representativeAnchor
                  ? `anchor ${compact(shadow.region.representativeAnchor.x)}, ${compact(shadow.region.representativeAnchor.y)} · ${shadow.region.representativeSource}`
                  : "anchor none",
                `legacy target Δ ${shadow.legacy.targetToShadowAnchorDistance === null ? "n/a" : compact(shadow.legacy.targetToShadowAnchorDistance)}`,
                shadow.region.reason
              ]
            : ["shadow coordination inactive outside SPATIAL mode"]
      },
      {
        id: "ccc-pace",
        title: "CCC-0 shadow · PACE",
        lines: shadow
          ? [
              `${shadow.pace.label} · urgency ${compact(shadow.pace.urgency)} · desired speed ${compact(shadow.pace.desiredSpeed)}`,
              `distance to region ${shadow.pace.distanceToRegion === null ? "n/a" : compact(shadow.pace.distanceToRegion)} · route ${shadow.pace.routeDistanceToRegion === null ? "n/a" : compact(shadow.pace.routeDistanceToRegion)}`,
              `separation ${shadow.pace.separationTrend} · opening ${shadow.pace.relativeOpeningSpeed === null ? "n/a" : compact(shadow.pace.relativeOpeningSpeed)}`,
              `outside ${shadow.pace.outsideRegionTicks} world ticks · capability ${compact(shadow.pace.physicalSpeedCapability)}`,
              shadow.pace.reason
            ]
          : ["shadow pace evidence unavailable"]
      },
      {
        id: "ccc-player",
        title: "CCC-0 shadow · PLAYER FLOW",
        tone: finalConflict?.state === "PHYSICAL_CONFLICT"
          ? "danger"
          : finalConflict?.state === "COMFORT_CONFLICT" ||
              preferredConflict?.state === "PHYSICAL_CONFLICT" ||
              shadow?.playerCorridor.state === "REVERSAL_UNCERTAIN"
            ? "warning"
            : "normal",
        lines: shadow && preferredConflict && finalConflict
          ? [
              `${shadow.playerCorridor.state} · source ${shadow.playerCorridor.velocitySource} · confidence ${compact(shadow.playerCorridor.confidence)} · horizon ${compact(shadow.playerCorridor.horizon)}s`,
              `endpoint ${compact(shadow.playerCorridor.endpoint.x)}, ${compact(shadow.playerCorridor.endpoint.y)} · physical r ${compact(shadow.playerCorridor.physicalRadius)} · comfort r ${compact(shadow.playerCorridor.comfortRadius)}`,
              `preferred ${preferredConflict.state} · t* ${compactNullable(preferredConflict.closestApproachTime)}s · hard ${compactNullable(preferredConflict.physicalClearance)} · comfort ${compactNullable(preferredConflict.comfortClearance)}`,
              `final ${finalConflict.state} · t* ${compactNullable(finalConflict.closestApproachTime)}s · hard ${compactNullable(finalConflict.physicalClearance)} · comfort ${compactNullable(finalConflict.comfortClearance)}`,
              preferredConflict.state !== finalConflict.state
                ? `diagnostic split ${preferredConflict.state} → ${finalConflict.state}`
                : `preferred/final agree: ${finalConflict.state}`,
              `sample t${shadow.tick} · cached age ${shadowAge ?? 0}t`,
              finalConflict.reason
            ]
          : ["shadow player-flow evidence unavailable"]
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
      title: "R1 Robustness Workbench · CCC-0 shadow",
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
    else if (action === "cycle-a1-authority") this.cycleA1Authority();
    else if (action === "cycle-time") this.cycleTimeScale();
    else if (action === "capture-incident") this.captureIncident();
    else if (action === "scenario-open") void this.loadScenario("open");
    else if (action === "scenario-pillar") void this.loadScenario("pillar");
    else if (action === "scenario-doorway") void this.loadScenario("doorway");
    else if (action === "scenario-head-on") void this.loadScenario("head-on");
  }

  private previewP2(): void {
    const bridge = window.__authorityA12p2BrowserBridge;
    if (!bridge) {
      this.logEvent("P2 unavailable · open the workbench with ?a1debug=1&a1p2=1");
      return;
    }
    try {
      const preview = bridge.preview(1);
      this.logEvent(
        `P2 preview t${preview.sourceTick} · ${preview.projection.frontierState} · candidates ${preview.projection.frontierProposalIds.length}`
      );
    } catch (error) {
      this.logEvent(`P2 preview refused · ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private armP2Singleton(): void {
    const bridge = window.__authorityA12p2BrowserBridge;
    if (!bridge) {
      this.logEvent("P2 unavailable · open the workbench with ?a1debug=1&a1p2=1");
      return;
    }
    try {
      const snapshot = bridge.snapshot();
      const ids = snapshot.latestPreview?.projection.frontierProposalIds ?? [];
      if (ids.length !== 1) {
        throw new Error(`explicit singleton arm requires exactly one preview candidate; got ${ids.length}`);
      }
      const armed = bridge.arm(ids[0]!);
      this.logEvent(`P2 armed explicitly · t${armed.sourceTick} · ${armed.proposalId}`);
    } catch (error) {
      this.logEvent(`P2 arm refused · ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private disarmP2(): void {
    const bridge = window.__authorityA12p2BrowserBridge;
    if (!bridge) {
      this.logEvent("P2 unavailable · open the workbench with ?a1debug=1&a1p2=1");
      return;
    }
    bridge.disarm();
    this.logEvent("P2 disarmed explicitly");
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
    if (this.a1Authority.enabled()) this.a1Authority.resetOwnedState();
    this.logEvent(`control mode ${previous} -> ${next}`);
  }

  private toggleActuator(): void {
    this.naturalActuator = !this.naturalActuator;
    this.spatialStack.reset();
    this.clearSpatialDebug();
    if (this.a1Authority.enabled()) this.a1Authority.resetOwnedState();
    this.logEvent(`control actuator ${this.naturalActuator ? "NATURAL" : "DIRECT"} (shared R1 movement/recovery state reset)`);
  }

  private cycleA1Authority(): void {
    const transition = this.a1Authority.cycleVariant();
    this.logEvent(
      `control A1 ${transition.previous.toUpperCase()} -> ${transition.next.toUpperCase()} (A1-owned state reset only)`
    );
  }

  private cycleTimeScale(): void {
    this.timeScaleIndex = (this.timeScaleIndex + 1) % TIME_SCALES.length;
    this.logEvent(`control time ${TIME_SCALES[this.timeScaleIndex]}x`);
  }

  private captureIncident(): void {
    const snapshot = this.snapshotValue;
    if (!snapshot) return;
    const incident = {
      schema: "companion-brain-lab-ccc0-causal-incident-v4",
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
    anchor.download = `companion-ccc0-${snapshot.scenarioId}-tick-${snapshot.tick}.json`;
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
    this.shadowCoordination = null;
    this.shadowCoordinationError = null;
    this.appliedLocalRetries = 0;
  }

  private resetBrains(): void {
    this.relationalBrain.reset();
    this.relationshipOrientation.reset();
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
      if (this.a1Authority.enabled()) this.a1Authority.resetOwnedState();
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
