import Phaser from "phaser";
import type { FinalCommandConstraintResult } from "../brain/final-command-constraint";
import type { MotionContinuityStepResult } from "../brain/motion-continuity";
import type { PreferredVelocityRefinement } from "../brain/preferred-velocity-refinement";
import type { ProgressRecoveryDecision } from "../brain/progress-recovery";
import {
  decideStageBPartnerAction,
  type StageBPartnerAction
} from "../brain/stage-b-partner";
import {
  evaluateS2SituatedResponsibility,
  type S2SituatedResponsibilityDecision
} from "../brain/situated-responsibility";
import {
  proposeS3MaterialContribution,
  type S3MaterialContributionProposal
} from "../brain/s3-material-contribution";
import {
  applyS4Correction,
  type S4CorrectionDecision
} from "../brain/s4-correction";
import {
  evaluateSharedDangerReadiness,
  type SharedDangerReadinessDecision
} from "../brain/shared-danger-readiness";
import {
  PlayerDirectiveRuntime,
  arbitrateCompanionAction,
  type CompanionArbitrationDecision,
  type PlayerDirectiveKind,
  type PlayerDirectiveSnapshot
} from "../brain/player-directive";
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
  type CausalPanelModel,
  type CausalPanelSection
} from "../debug/causal-panel";
import { CURRENT_COMPANION_BUILD_IDENTITY } from "../debug/build-identity";
import {
  CausalFrameTrace,
  type CausalFrame,
  type CausalPostClassification
} from "../debug/causal-frame-trace";
import { buildOwnerSandboxIncident } from "../debug/owner-sandbox-incident";
import { currentOwnerControlScale, scaleOwnerControlMove } from "../debug/owner-control-scale-browser-bridge";
import {
  S2C_ROUTE_CLEARANCE,
  planStaticShadowRoute,
  type StaticRoutePlan
} from "../navigation/static-router";
import { S0_STEP_SECONDS } from "../physics/rapier-physical-world";
import { SCENARIOS } from "../world/scenarios";
import type {
  CooperativeEpisodeActionAttempt,
  CooperativeEpisodeActionOutcome,
  CooperativeEpisodeOutcome,
  CooperativeEpisodeSnapshot
} from "../world/cooperative-episode-contract";
import type { SharedPressureSnapshot } from "../world/shared-pressure";
import type {
  SharedDangerEpisodeOutcome,
  SharedDangerSnapshot,
  WorldActionAttempt,
  WorldActionOutcome
} from "../world/shared-danger-contract";
import type {
  ActorSnapshot,
  MotionIntent,
  ScenarioId,
  StaticCircleTraversalResult,
  Vec2,
  WorldSnapshot,
  WorldBodyId
} from "../world/types";
import { LabWorld, S1_SHARED_DANGER_RULES, S5_COOPERATIVE_EPISODE_RULES } from "../world/world";
import { isOwnerReviewSearch, isTeammateReviewSearch, ownerReviewAllowsPanelAction } from "./owner-review-mode";
import { PlayerCommandHud } from "./player-command-hud";
import { SharedDangerApparatusHud } from "./shared-danger-apparatus-hud";
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

function actor(snapshot: WorldSnapshot, id: WorldBodyId): ActorSnapshot {
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
  playerDirective: PlayerDirectiveSnapshot | null;
  autonomousProposal: StageBPartnerAction | null;
  arbitration: CompanionArbitrationDecision | null;
  pressureBefore: SharedPressureSnapshot | null;
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
  private ownerReviewSurface = false;
  private teammateSpecimenSurface = false;
  private commandHud!: PlayerCommandHud;
  private apparatusHud!: SharedDangerApparatusHud;

  private readonly relationalBrain = new RelationalPositioningBrain();
  private readonly relationshipOrientation = new RelationshipOrientationTracker();
  private readonly spatialStack = new R1WorkbenchSpatialStack();
  private readonly a1Authority = new A1AuthorityRuntime();
  private readonly playerDirective = new PlayerDirectiveRuntime();
  private relationalDecision: RelationalDecision | null = null;
  private spatialDecision: SpatialLocomotionDecision | null = null;
  private spatialRepairDecision: R1SpatialRepairEvidence | null = null;
  private refinementDecision: PreferredVelocityRefinement | null = null;
  private continuityDecision: MotionContinuityStepResult | null = null;
  private finalConstraintDecision: FinalCommandConstraintResult | null = null;
  private progressDecision: ProgressRecoveryDecision | null = null;
  private shadowCoordination: ShadowCoordinationFrame | null = null;
  private shadowCoordinationError: string | null = null;
  private autonomousProposalDecision: StageBPartnerAction | null = null;
  private arbitrationDecision: CompanionArbitrationDecision | null = null;
  private sharedPressure: SharedPressureSnapshot | null = null;
  private sharedDanger: SharedDangerSnapshot | null = null;
  private cooperativeEpisode: CooperativeEpisodeSnapshot | null = null;
  private situatedResponsibility: S2SituatedResponsibilityDecision | null = null;
  private s3AuthorityEnabled = false;
  private s3Contribution: S3MaterialContributionProposal | null = null;
  private s4WithholdEnabled = false;
  private s4CorrectionDecision: S4CorrectionDecision | null = null;
  private sharedDangerReadinessEnabled = false;
  private sharedDangerReadiness: SharedDangerReadinessDecision | null = null;
  private pendingActionAttempts: WorldActionAttempt[] = [];
  private lastActionOutcomes: readonly WorldActionOutcome[] = [];
  private lastSharedDangerEpisodeOutcome: SharedDangerEpisodeOutcome = "NONE";
  private pendingCooperativeEpisodeAttempts: CooperativeEpisodeActionAttempt[] = [];
  private lastCooperativeEpisodeActionOutcomes: readonly CooperativeEpisodeActionOutcome[] = [];
  private lastCooperativeEpisodeOutcome: CooperativeEpisodeOutcome = "NONE";
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
    "one" | "two" | "three" | "four" | "five" | "six" | "f1" | "f2" | "f3" |
    "playerAction" | "companionAction" | "withhold",
    Phaser.Input.Keyboard.Key
  >;

  constructor() {
    super("r1-lab");
  }

  create(): void {
    this.ownerReviewSurface = isOwnerReviewSearch(window.location.search);
    this.teammateSpecimenSurface = isTeammateReviewSearch(window.location.search);
    if (this.ownerReviewSurface) {
      // Historical movement-review identity remains frozen for comparison only.
      this.companionMode = "spatial";
      this.naturalActuator = true;
      this.timeScaleIndex = 2;
      this.a1Authority.setVariant("off");
    } else if (this.teammateSpecimenSurface) {
      this.scenarioId = "shared-danger";
      this.companionMode = "manual";
      this.a1Authority.setVariant("off");
    }

    this.graphics = this.add.graphics();
    this.panel = new CausalPanel((action) => this.handlePanelAction(action));
    this.commandHud = new PlayerCommandHud((kind) => this.issuePlayerDirective(kind));
    this.apparatusHud = new SharedDangerApparatusHud((actorId) => this.queueWorldAction(actorId));

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
      four: Phaser.Input.Keyboard.KeyCodes.FOUR,
      five: Phaser.Input.Keyboard.KeyCodes.FIVE,
      six: Phaser.Input.Keyboard.KeyCodes.SIX,
      f1: Phaser.Input.Keyboard.KeyCodes.F1,
      f2: Phaser.Input.Keyboard.KeyCodes.F2,
      f3: Phaser.Input.Keyboard.KeyCodes.F3,
      playerAction: Phaser.Input.Keyboard.KeyCodes.E,
      companionAction: Phaser.Input.Keyboard.KeyCodes.ENTER,
      withhold: Phaser.Input.Keyboard.KeyCodes.Q
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
    const beforeDanger = this.world.sharedDanger();
    const beforeCooperativeEpisode = this.world.cooperativeEpisode();
    const actionAttempts = this.scenarioId === "shared-danger"
      ? this.pendingActionAttempts.splice(0)
      : [];
    const cooperativeEpisodeAttempts = this.scenarioId === "cooperative-episode"
      ? this.pendingCooperativeEpisodeAttempts.splice(0)
      : [];
    const worldResult = this.world.stepSituation({
      motionIntents: evidence.intents,
      actionAttempts,
      cooperativeEpisodeAttempts
    });
    const after = worldResult.snapshot;
    this.snapshotValue = after;
    this.sharedPressure = this.world.sharedPressure();
    this.sharedDanger = worldResult.sharedDanger;
    this.cooperativeEpisode = worldResult.cooperativeEpisode;
    this.updateSituatedResponsibility(after);
    if (worldResult.actionOutcomes.length > 0) {
      this.lastActionOutcomes = worldResult.actionOutcomes;
    }
    if (worldResult.episodeOutcome !== "NONE") {
      this.lastSharedDangerEpisodeOutcome = worldResult.episodeOutcome;
    }
    if (worldResult.cooperativeEpisodeActionOutcomes.length > 0) {
      this.lastCooperativeEpisodeActionOutcomes = worldResult.cooperativeEpisodeActionOutcomes;
    }
    if (worldResult.cooperativeEpisodeOutcome !== "NONE") {
      this.lastCooperativeEpisodeOutcome = worldResult.cooperativeEpisodeOutcome;
    }
    this.logSharedPressureTransition(evidence.pressureBefore, this.sharedPressure);
    this.logSharedDangerTransition(beforeDanger, this.sharedDanger, worldResult.actionOutcomes, worldResult.episodeOutcome);
    this.logCooperativeEpisodeTransition(
      beforeCooperativeEpisode,
      this.cooperativeEpisode,
      worldResult.cooperativeEpisodeActionOutcomes,
      worldResult.cooperativeEpisodeOutcome
    );
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
      move: scaleOwnerControlMove(
        normalizedMotion(axis(this.keys.a, this.keys.d), axis(this.keys.w, this.keys.s)),
        currentOwnerControlScale()
      )
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
    const pressureBefore = this.world.sharedPressure();
    this.sharedPressure = pressureBefore;
    this.autonomousProposalDecision = null;
    this.arbitrationDecision = null;
    this.s3Contribution = null;
    this.s4CorrectionDecision = null;
    const previousReadinessSide = this.sharedDangerReadiness?.side ?? null;
    this.sharedDangerReadiness = null;

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

    if (this.scenarioId === "shared-danger" && this.s3AuthorityEnabled) {
      this.relationalDecision = null;
      this.spatialDecision = null;
      const proposal = proposeS3MaterialContribution({
        snapshot: before,
        responsibility: this.situatedResponsibility,
        rules: S1_SHARED_DANGER_RULES
      });
      this.s3Contribution = proposal;
      const correction = applyS4Correction({
        proposal,
        correction: this.s4WithholdEnabled ? "WITHHOLD_CURRENT_CONTRIBUTION" : "NONE"
      });
      this.s4CorrectionDecision = correction;

      const readiness = this.sharedDangerReadinessEnabled
        ? evaluateSharedDangerReadiness({
            snapshot: before,
            danger: this.sharedDanger,
            responsibility: this.situatedResponsibility,
            previousSide: previousReadinessSide
          })
        : null;
      this.sharedDangerReadiness = readiness;

      if (proposal.kind === "NONE" && readiness && readiness.state !== "NONE") {
        companionIntent = readiness.motionIntent;
        if (readiness.target) {
          target = { ...readiness.target };
          objectiveKey = "shared-danger:readiness:guard-player";
        }
      } else {
        companionIntent = correction.effectiveMotionIntent;
        if (
          correction.effectiveActionAttempt &&
          !this.pendingActionAttempts.some((attempt) => attempt.actorId === "companion")
        ) {
          this.pendingActionAttempts.push(correction.effectiveActionAttempt);
          this.logEvent("S3 autonomous companion INTERVENE queued after S4 correction gate");
        }
        if (proposal.focusId === "hostile") {
          target = { ...actor(before, "hostile").position };
          objectiveKey = `s3:${proposal.kind.toLowerCase()}:hostile`;
        }
      }
    } else if (this.companionMode === "manual") {
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
      const autonomousProposal = decideStageBPartnerAction(pressureBefore);
      this.autonomousProposalDecision = autonomousProposal;
      const arbitration = arbitrateCompanionAction({
        directive: this.playerDirective.snapshot(),
        autonomousProposal,
        relationshipTarget: relationship.target,
        playerPosition: actor(before, "player").position
      });
      this.arbitrationDecision = arbitration;
      const liveTarget = arbitration.target;
      target = { ...liveTarget };
      objectiveKey = arbitration.objectiveKey;
      actuator = this.naturalActuator ? "natural" : "direct";
      const route = this.buildRoute(before, liveTarget);
      this.decisionRoutePlan = route;
      const traversalQuery = bindWorldStaticTraversalQuery(this.world);
      const input = {
        snapshot: before,
        relationshipTarget: liveTarget,
        shadowLegacyRelationshipTarget: relationship.target,
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
      shadowCoordinationError: this.shadowCoordinationError,
      playerDirective: this.playerDirective.snapshot(),
      autonomousProposal: this.autonomousProposalDecision,
      arbitration: this.arbitrationDecision,
      pressureBefore
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
    const playerIntent = evidence.intents.find((intent) => intent.actorId === "player") ?? {
      actorId: "player" as const,
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
        playerControlMove: { ...playerIntent.move },
        companionActualVelocity: { ...beforeCompanion.actualVelocity },
        companionContacts: beforeCompanion.contacts.map((contact) => contact.with)
      },
      decision: {
        relationshipRevision: evidence.relationship?.reconsiderationCount ?? null,
        relationshipLabel: evidence.relationship?.selectedSlot ?? null,
        relationshipState: evidence.relationship?.objectiveState ?? null,
        relationshipTarget: evidence.relationship ? { ...evidence.relationship.target } : null,
        playerDirectiveKind: evidence.playerDirective?.kind ?? null,
        playerDirectiveIssuedTick: evidence.playerDirective?.issuedTick ?? null,
        playerDirectiveHoldAnchor: evidence.playerDirective?.holdAnchor
          ? { ...evidence.playerDirective.holdAnchor }
          : null,
        autonomousProposalKind: evidence.autonomousProposal?.kind ?? null,
        autonomousProposalReason: evidence.autonomousProposal?.reason ?? null,
        partnerAction: evidence.arbitration?.selectedKind ?? null,
        partnerActionReason: evidence.arbitration?.reason ?? null,
        arbitrationSource: evidence.arbitration?.source ?? null,
        arbitrationCompatibility: evidence.arbitration?.compatibility ?? null,
        arbitrationConstraintDistance: evidence.arbitration?.constraintDistance ?? null,
        arbitrationConstraintLimit: evidence.arbitration?.constraintLimit ?? null,
        arbitrationReason: evidence.arbitration?.reason ?? null,
        liveObjectiveKey: evidence.objectiveKey,
        liveObjectiveTarget: target ? { ...target } : null,
        sharedPressurePhase: evidence.pressureBefore?.phase ?? null,
        sharedPressureCycle: evidence.pressureBefore?.cycle ?? null,
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
        postRouteClearanceConstrained: this.postRoutePlan?.clearanceConstrained ?? null,
        sharedPressurePhase: this.sharedPressure?.phase ?? null,
        sharedPressureOutcome: this.sharedPressure?.lastOutcome ?? null,
        sharedPressureResolvedBy: this.sharedPressure?.lastResolvedBy ?? null,
        sharedPressureResponseTicks: this.sharedPressure?.responseTicks ?? null
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

  private logSharedPressureTransition(
    before: SharedPressureSnapshot | null,
    after: SharedPressureSnapshot | null
  ): void {
    if (!after?.enabled) return;
    if (
      !before ||
      before.phase !== after.phase ||
      before.lastOutcome !== after.lastOutcome ||
      before.cycle !== after.cycle
    ) {
      this.logEvent(
        `team pressure ${before?.phase ?? "NONE"} -> ${after.phase} · outcome ${after.lastOutcome} · ${after.reason}`
      );
    }
  }

  private updateSituatedResponsibility(snapshot: WorldSnapshot): void {
    const previous = this.situatedResponsibility;

    if (snapshot.scenarioId !== "shared-danger" || !this.world || !this.sharedDanger) {
      this.situatedResponsibility = null;
      return;
    }

    const next = evaluateS2SituatedResponsibility({
      snapshot,
      danger: this.sharedDanger,
      rules: S1_SHARED_DANGER_RULES,
      companionMaxSpeed: this.world.actorMovementCapability("companion").maxSpeed,
      worldStepSeconds: S0_STEP_SECONDS
    });
    this.situatedResponsibility = next;

    const changed =
      !previous ||
      previous.focusId !== next.focusId ||
      previous.attention !== next.attention ||
      previous.responsibility !== next.responsibility ||
      previous.reasonCode !== next.reasonCode;

    if (changed) {
      this.logEvent(
        `S2 focus ${previous?.focusId ?? "none"} -> ${next.focusId ?? "none"} · ` +
        `attention ${next.attention} · responsibility ${next.responsibility} · ${next.reasonCode}`
      );
    }
  }

  private logSharedDangerTransition(
    before: SharedDangerSnapshot | null,
    after: SharedDangerSnapshot | null,
    actionOutcomes: readonly WorldActionOutcome[],
    episodeOutcome: SharedDangerEpisodeOutcome
  ): void {
    if (!after) return;
    if (!before || before.phase !== after.phase || before.lastOutcome !== after.lastOutcome) {
      this.logEvent(
        `S1 danger ${before?.phase ?? "NONE"} -> ${after.phase} · outcome ${after.lastOutcome}`
      );
    }
    for (const outcome of actionOutcomes) {
      this.logEvent(
        `S1 ${outcome.actorId} ${outcome.kind} -> ${outcome.status} · ${compact(outcome.distance)}m · ${outcome.phaseObserved}`
      );
    }
    if (episodeOutcome !== "NONE") {
      this.logEvent(`S1 episode outcome ${episodeOutcome}`);
    }
  }

  private logCooperativeEpisodeTransition(
    before: CooperativeEpisodeSnapshot | null,
    after: CooperativeEpisodeSnapshot | null,
    actionOutcomes: readonly CooperativeEpisodeActionOutcome[],
    episodeOutcome: CooperativeEpisodeOutcome
  ): void {
    if (!after) return;
    if (
      !before ||
      before.phase !== after.phase ||
      before.cycle !== after.cycle ||
      before.lastOutcome !== after.lastOutcome
    ) {
      this.logEvent(
        `S5 manual episode ${before?.phase ?? "NONE"} -> ${after.phase} · cycle ${after.cycle} · outcome ${after.lastOutcome}`
      );
    }
    for (const outcome of actionOutcomes) {
      this.logEvent(
        `S5 ${outcome.actorId} ${outcome.kind} -> ${outcome.status} · ${compact(outcome.distance)}m · ${outcome.phaseObserved}`
      );
    }
    if (episodeOutcome !== "NONE") {
      this.logEvent(`S5 manual episode outcome ${episodeOutcome}`);
    }
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

    this.drawSharedPressure(sx, sy, scale);

    if (this.panel.layerVisible("trails")) this.drawTrails(sx, sy);
    if (this.panel.layerVisible("relationship")) this.drawRelationship(sx, sy);
    if (this.panel.layerVisible("coordination")) this.drawCoordination(sx, sy, scale);
    if (this.panel.layerVisible("route")) this.drawRoute(sx, sy);
    if (this.panel.layerVisible("spatial")) this.drawSpatial(sx, sy);

    for (const value of snapshot.actors) {
      const contact = value.contacts.length > 0;
      const fillColor = value.id === "player"
        ? 0x63a8ff
        : value.id === "companion"
          ? 0xf2c15c
          : this.cooperativeEpisode
            ? this.cooperativeEpisode.phase === "PRESSURING"
              ? 0xff5d66
              : this.cooperativeEpisode.phase === "DRIVEN_BACK"
                ? this.cooperativeEpisode.lastOutcome === "PLAYER_HIT"
                  ? 0xff7b72
                  : 0x7ee787
                : this.cooperativeEpisode.phase === "RESETTING"
                  ? 0x8b949e
                  : this.cooperativeEpisode.phase === "CALM"
                    ? 0x6e7681
                    : 0xff9b5e
            : this.sharedDanger?.phase === "WINDUP"
              ? 0xff5d66
              : this.sharedDanger?.phase === "RECOVERING"
                ? 0x8b949e
                : this.sharedDanger?.phase === "COMPLETE"
                  ? 0x484f58
                  : 0xff9b5e;
      this.graphics.fillStyle(fillColor, 1);
      this.graphics.fillCircle(sx(value.position.x), sy(value.position.y), value.radius * scale);
      this.graphics.lineStyle(3, contact && this.panel.layerVisible("contacts") ? 0xff5d66 : 0xe7e9ee, 0.95);
      this.graphics.strokeCircle(sx(value.position.x), sy(value.position.y), value.radius * scale);
      if (value.id === "hostile") {
        this.drawSharedDangerBody(value, snapshot, sx, sy, scale);
        this.drawCooperativeEpisodeBody(value, snapshot, sx, sy, scale);
      }
      if (value.id === "companion") {
        this.drawSharedDangerReadinessGlyph(value, snapshot, sx, sy, scale);
      }
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

  private drawSharedPressure(
    sx: (x: number) => number,
    sy: (y: number) => number,
    scale: number
  ): void {
    const pressure = this.sharedPressure;
    if (!pressure?.enabled || !pressure.target || pressure.phase === "QUIET") return;

    const contained = pressure.lastOutcome === "CONTAINED";
    const breached = pressure.lastOutcome === "BREACHED";
    const color = contained ? 0x7ee787 : breached ? 0xff5d66 : 0xff7b72;
    const ringAlpha = pressure.phase === "ACTIVE" ? 0.72 : 0.4;
    const coreAlpha = pressure.phase === "ACTIVE" ? 0.95 : 0.55;
    const x = sx(pressure.target.x);
    const y = sy(pressure.target.y);

    // Outer ring is the companion's effective interception distance; the solid
    // inner body is the actual advancing threat proxy. Keeping the two visually
    // distinct avoids presenting another anonymous waypoint disk.
    this.graphics.fillStyle(color, pressure.phase === "ACTIVE" ? 0.055 : 0.035);
    this.graphics.fillCircle(x, y, pressure.responseRadius * scale);
    this.graphics.lineStyle(2, color, ringAlpha);
    this.graphics.strokeCircle(x, y, pressure.responseRadius * scale);

    this.graphics.fillStyle(color, coreAlpha);
    this.graphics.fillCircle(x, y, pressure.threatRadius * scale);
    this.graphics.lineStyle(3, 0xe7e9ee, pressure.phase === "ACTIVE" ? 0.9 : 0.5);
    this.graphics.strokeCircle(x, y, pressure.threatRadius * scale);

    const spikeInner = pressure.threatRadius * scale * 1.15;
    const spikeOuter = pressure.threatRadius * scale * 1.85;
    this.graphics.lineStyle(3, color, ringAlpha);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      this.graphics.lineBetween(
        x + dx * spikeInner,
        y + dy * spikeInner,
        x + dx * spikeOuter,
        y + dy * spikeOuter
      );
    }
  }

  private drawSharedDangerBody(
    hostile: ActorSnapshot,
    snapshot: WorldSnapshot,
    sx: (x: number) => number,
    sy: (y: number) => number,
    scale: number
  ): void {
    const danger = this.sharedDanger;
    if (!danger) return;
    const x = sx(hostile.position.x);
    const y = sy(hostile.position.y);

    const spikeInner = hostile.radius * scale * 1.12;
    const spikeOuter = hostile.radius * scale * 1.48;
    this.graphics.lineStyle(3, danger.phase === "WINDUP" ? 0xff5d66 : 0xff9b5e, 0.9);
    for (let index = 0; index < 8; index += 1) {
      const angle = (Math.PI * 2 * index) / 8;
      const dx = Math.cos(angle);
      const dy = Math.sin(angle);
      this.graphics.lineBetween(
        x + dx * spikeInner,
        y + dy * spikeInner,
        x + dx * spikeOuter,
        y + dy * spikeOuter
      );
    }

    if (danger.phase === "WINDUP") {
      const player = actor(snapshot, "player");
      this.graphics.lineStyle(3, 0xff7b72, 0.7);
      this.graphics.lineBetween(x, y, sx(player.position.x), sy(player.position.y));
      for (const factor of [1.7, 2.3, 2.9]) {
        this.graphics.lineStyle(2, 0xff5d66, 0.55);
        this.graphics.strokeCircle(x, y, hostile.radius * scale * factor);
      }
    }

    if (danger.phase === "RECOVERING" && danger.lastOutcome === "INTERRUPTED") {
      const r = hostile.radius * scale * 1.55;
      this.graphics.lineStyle(4, 0x7ee787, 0.95);
      this.graphics.lineBetween(x - r, y - r, x + r, y + r);
      this.graphics.lineBetween(x - r, y + r, x + r, y - r);
      for (const interrupterId of danger.interruptedBy) {
        const interrupter = actor(snapshot, interrupterId);
        const ix = sx(interrupter.position.x);
        const iy = sy(interrupter.position.y);
        const ir = interrupter.radius * scale * 1.4;
        this.graphics.lineStyle(3, 0x7ee787, 0.9);
        this.graphics.strokeCircle(ix, iy, ir);
        this.graphics.lineBetween(ix, iy, x, y);
      }
    }

    if (danger.lastOutcome === "PLAYER_HIT") {
      const player = actor(snapshot, "player");
      const px = sx(player.position.x);
      const py = sy(player.position.y);
      const r = player.radius * scale * 2.1;
      this.graphics.lineStyle(5, 0xff5d66, 0.95);
      this.graphics.strokeCircle(px, py, r);
      this.graphics.lineBetween(px - r, py, px + r, py);
      this.graphics.lineBetween(px, py - r, px, py + r);
    } else if (danger.lastOutcome === "ATTACK_MISSED") {
      this.graphics.lineStyle(3, 0xe3b341, 0.85);
      this.graphics.strokeCircle(x, y, hostile.radius * scale * 2.2);
    }
  }

  private drawCooperativeEpisodeBody(
    hostile: ActorSnapshot,
    snapshot: WorldSnapshot,
    sx: (x: number) => number,
    sy: (y: number) => number,
    scale: number
  ): void {
    const episode = this.cooperativeEpisode;
    if (!episode) return;

    const x = sx(hostile.position.x);
    const y = sy(hostile.position.y);
    const bodyR = hostile.radius * scale;
    const threatColor = episode.phase === "PRESSURING" ? 0xff5d66 : 0xff9b5e;

    if (episode.phase === "APPROACHING" || episode.phase === "PRESSURING") {
      const spikeInner = bodyR * 1.12;
      const spikeOuter = bodyR * 1.5;
      this.graphics.lineStyle(3, threatColor, 0.9);
      for (let index = 0; index < 8; index += 1) {
        const angle = (Math.PI * 2 * index) / 8;
        const dx = Math.cos(angle);
        const dy = Math.sin(angle);
        this.graphics.lineBetween(
          x + dx * spikeInner,
          y + dy * spikeInner,
          x + dx * spikeOuter,
          y + dy * spikeOuter
        );
      }
    }

    if (episode.phase === "PRESSURING") {
      const player = actor(snapshot, "player");
      this.graphics.lineStyle(4, 0xff5d66, 0.78);
      this.graphics.lineBetween(x, y, sx(player.position.x), sy(player.position.y));
      const progress = episode.phaseTicksRemaining / S5_COOPERATIVE_EPISODE_RULES.pressureTicks;
      const pulse = bodyR * (1.8 + (1 - progress) * 1.6);
      this.graphics.lineStyle(3, 0xff5d66, 0.7);
      this.graphics.strokeCircle(x, y, pulse);
    }

    if (episode.phase === "DRIVEN_BACK" && episode.lastOutcome === "REPELLED") {
      const r = bodyR * 1.65;
      this.graphics.lineStyle(5, 0x7ee787, 0.95);
      this.graphics.lineBetween(x - r, y - r, x + r, y + r);
      this.graphics.lineBetween(x - r, y + r, x + r, y - r);
      for (const actorId of episode.repelledBy) {
        const source = actor(snapshot, actorId);
        const sx0 = sx(source.position.x);
        const sy0 = sy(source.position.y);
        this.graphics.lineStyle(3, 0x7ee787, 0.92);
        this.graphics.strokeCircle(sx0, sy0, source.radius * scale * 1.45);
        this.graphics.lineBetween(sx0, sy0, x, y);
      }
    }

    if (episode.phase === "DRIVEN_BACK" && episode.lastOutcome === "PLAYER_HIT") {
      const player = actor(snapshot, "player");
      const px = sx(player.position.x);
      const py = sy(player.position.y);
      const r = player.radius * scale * 2.2;
      this.graphics.lineStyle(5, 0xff5d66, 0.95);
      this.graphics.strokeCircle(px, py, r);
      this.graphics.lineBetween(px - r, py, px + r, py);
      this.graphics.lineBetween(px, py - r, px, py + r);
    }

    if (episode.phase === "CALM") {
      this.graphics.lineStyle(2, 0x8b949e, 0.55);
      this.graphics.strokeCircle(x, y, bodyR * 1.45);
    }
  }

  private drawSharedDangerReadinessGlyph(
    companion: ActorSnapshot,
    snapshot: WorldSnapshot,
    sx: (x: number) => number,
    sy: (y: number) => number,
    scale: number
  ): void {
    const readiness = this.sharedDangerReadiness;
    if (!readiness || readiness.state === "NONE" || this.sharedDanger?.phase !== "APPROACHING") return;

    const hostile = actor(snapshot, "hostile");
    const dx = hostile.position.x - companion.position.x;
    const dy = hostile.position.y - companion.position.y;
    const length = Math.hypot(dx, dy);
    if (length <= 1e-9) return;

    const ux = dx / length;
    const uy = dy / length;
    const px = -uy;
    const py = ux;
    const cx = sx(companion.position.x);
    const cy = sy(companion.position.y);
    const bodyR = companion.radius * scale;
    const base = bodyR * 1.05;
    const tip = bodyR * 1.8;
    const wing = bodyR * 0.72;
    const color = readiness.state === "GUARDING" ? 0xf2c15c : 0xe3b341;

    this.graphics.lineStyle(4, color, 0.95);
    this.graphics.lineBetween(
      cx + ux * base + px * wing,
      cy + uy * base + py * wing,
      cx + ux * tip,
      cy + uy * tip
    );
    this.graphics.lineBetween(
      cx + ux * base - px * wing,
      cy + uy * base - py * wing,
      cx + ux * tip,
      cy + uy * tip
    );
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
    const p2 = window.__authorityA12p2BrowserBridge?.snapshot() ?? null;
    const pressure = this.sharedPressure;
    const directive = this.playerDirective.snapshot();
    const autonomousProposal = this.autonomousProposalDecision;
    const arbitration = this.arbitrationDecision;

    const apparatusActive = snapshot.scenarioId === "shared-danger";
    const cooperativeEpisodeActive = snapshot.scenarioId === "cooperative-episode";
    this.commandHud.setVisible(!apparatusActive && !cooperativeEpisodeActive);
    this.commandHud.update({ directive });
    this.apparatusHud.update({
      active: apparatusActive,
      danger: this.sharedDanger,
      lastEpisodeOutcome: this.lastSharedDangerEpisodeOutcome,
      lastActionOutcomes: this.lastActionOutcomes,
      teammateSpecimen: this.teammateSpecimenSurface && apparatusActive,
      autonomyEnabled: this.s3AuthorityEnabled,
      withholdActive: this.s4WithholdEnabled
    });

    const sections: CausalPanelModel["sections"] = [
      ...(cooperativeEpisodeActive && this.cooperativeEpisode ? [{
        id: "s5-manual-episode",
        title: "S5 manual baseline · continuous cooperative episode",
        tone: this.cooperativeEpisode.phase === "PRESSURING"
          ? "danger" as const
          : this.cooperativeEpisode.phase === "DRIVEN_BACK"
            ? this.cooperativeEpisode.lastOutcome === "PLAYER_HIT"
              ? "danger" as const
              : "success" as const
            : this.cooperativeEpisode.phase === "CALM"
              ? "normal" as const
              : "warning" as const,
        lines: [
          `phase ${this.cooperativeEpisode.phase} · cycle ${this.cooperativeEpisode.cycle + 1} · remaining ${this.cooperativeEpisode.phaseTicksRemaining}t`,
          `last world outcome ${this.cooperativeEpisode.lastOutcome} · outcome tick ${this.cooperativeEpisode.lastOutcomeTick ?? "none"}`,
          `repelled by ${this.cooperativeEpisode.repelledBy.join(", ") || "none"}`,
          (() => {
            const hostile = actor(snapshot, "hostile");
            const player = actor(snapshot, "player");
            const manualCompanion = actor(snapshot, "companion");
            return `hostile ${compact(hostile.position.x)}, ${compact(hostile.position.y)} · player distance ${compact(distance(hostile.position, player.position))}m · companion distance ${compact(distance(hostile.position, manualCompanion.position))}m`;
          })(),
          this.lastCooperativeEpisodeActionOutcomes.length > 0
            ? `latest attempts ${this.lastCooperativeEpisodeActionOutcomes.map((outcome) => `${outcome.actorId}:${outcome.status}@${compact(outcome.distance)}m`).join(" · ")}`
            : "latest attempts none",
          `REPEL range ${compact(S5_COOPERATIVE_EPISODE_RULES.repelRange)}m · valid throughout APPROACHING / PRESSURING`,
          "MANUAL BASELINE ONLY · WASD + E player · arrows + Enter companion · no companion cognition authority"
        ]
      } satisfies CausalPanelSection] : []),
      ...(apparatusActive ? [{
        id: "s1-apparatus",
        title: "S1 apparatus · shared danger",
        tone: this.sharedDanger?.phase === "WINDUP"
          ? "danger" as const
          : this.sharedDanger?.lastOutcome === "INTERRUPTED"
            ? "success" as const
            : this.sharedDanger?.lastOutcome === "PLAYER_HIT"
              ? "danger" as const
              : "normal" as const,
        lines: [
          `phase ${this.sharedDanger?.phase ?? "UNAVAILABLE"} · remaining ${this.sharedDanger?.phaseTicksRemaining ?? 0}t`,
          `last world outcome ${this.sharedDanger?.lastOutcome ?? "NONE"} · outcome tick ${this.sharedDanger?.lastOutcomeTick ?? "none"}`,
          `interrupted by ${this.sharedDanger?.interruptedBy.join(", ") || "none"}`,
          this.lastActionOutcomes.length > 0
            ? `latest attempts ${this.lastActionOutcomes.map((outcome) => `${outcome.actorId}:${outcome.status}@${compact(outcome.distance)}m`).join(" · ")}`
            : "latest attempts none",
          this.s3AuthorityEnabled
            ? "S3 bounded authority ON · S1 manual baseline overridden for research"
            : "S1 apparatus only · companion authority locked to MANUAL"
        ]
      }] : []),
      ...(apparatusActive && this.situatedResponsibility ? [{
        id: "s2-responsibility",
        title: "S2 zero authority · attention / responsibility",
        tone: this.situatedResponsibility.responsibility === "OWNED"
          ? "warning" as const
          : "normal" as const,
        lines: [
          `focus ${this.situatedResponsibility.focusId ?? "none"} · attention ${this.situatedResponsibility.attention} · responsibility ${this.situatedResponsibility.responsibility}`,
          `player risk ${this.situatedResponsibility.evidence.playerAtMaterialRisk ? "YES" : "no"} · player↔hostile ${compactNullable(this.situatedResponsibility.evidence.playerToHostileDistance)}m`,
          `companion↔hostile ${compactNullable(this.situatedResponsibility.evidence.companionToHostileDistance)}m · straight-line reach ${this.situatedResponsibility.evidence.straightLineTicksToInterventionRange ?? "n/a"}t · consequence window ${this.situatedResponsibility.evidence.consequenceTicksRemaining ?? "n/a"}t`,
          `basis ${this.situatedResponsibility.reasonCode}`,
          this.situatedResponsibility.reason,
          "S2 ZERO AUTHORITY · the judgement itself cannot emit movement or action"
        ]
      }] : []),
      ...(apparatusActive && this.sharedDangerReadiness ? [{
        id: "readiness",
        title: "Pre-contact readiness · player-local intercept flank",
        tone: this.sharedDangerReadiness.state === "GUARDING"
          ? "success" as const
          : this.sharedDangerReadiness.state === "HOLDING_READY"
            ? "warning" as const
            : "normal" as const,
        lines: [
          `authority ${this.sharedDangerReadinessEnabled ? "ON" : "OFF"} · state ${this.sharedDangerReadiness.state} · basis ${this.sharedDangerReadiness.reasonCode}`,
          this.sharedDangerReadiness.target
            ? `intercept target ${compact(this.sharedDangerReadiness.target.x)}, ${compact(this.sharedDangerReadiness.target.y)} · companion gap ${compactNullable(this.sharedDangerReadiness.companionToTargetDistance)}m`
            : "intercept target none",
          `player↔hostile ${compactNullable(this.sharedDangerReadiness.playerToHostileDistance)}m`,
          this.sharedDangerReadiness.reason,
          "READINESS MOVEMENT ONLY · no World action attempt"
        ]
      }] : []),
      ...(apparatusActive ? [{
        id: "s3-contribution",
        title: "S3 bounded material contribution",
        tone: this.s3AuthorityEnabled
          ? this.s3Contribution?.kind === "INTERVENE"
            ? "success" as const
            : "warning" as const
          : "normal" as const,
        lines: [
          `authority ${this.s3AuthorityEnabled ? "ON" : "OFF"}`,
          `proposal ${this.s3Contribution?.kind ?? "NOT_EVALUATED"} · focus ${this.s3Contribution?.focusId ?? "none"} · distance ${compactNullable(this.s3Contribution?.distanceToFocus ?? null)}m`,
          `world action ${this.s3Contribution?.actionAttempt?.kind ?? "none"}`,
          this.s3Contribution?.reason ?? "S3 is dormant until bounded authority is explicitly enabled",
          "S3 authority is fixture-local and downstream of S2 responsibility; no command grammar"
        ]
      }] : []),
      ...(apparatusActive ? [{
        id: "s4-correction",
        title: "S4 corrigibility · execution constraint",
        tone: this.s4WithholdEnabled
          ? this.s4CorrectionDecision?.blocked
            ? "warning" as const
            : "normal" as const
          : "normal" as const,
        lines: [
          `correction ${this.s4WithholdEnabled ? "WITHHOLD_CURRENT_CONTRIBUTION" : "NONE"}`,
          `raw S3 ${this.s3Contribution?.kind ?? "NOT_EVALUATED"} · S2 responsibility ${this.situatedResponsibility?.responsibility ?? "UNKNOWN"}`,
          `blocked ${this.s4CorrectionDecision?.blocked ? "YES" : "no"} · effective move ${this.s4CorrectionDecision ? `${compact(this.s4CorrectionDecision.effectiveMotionIntent.move.x)}, ${compact(this.s4CorrectionDecision.effectiveMotionIntent.move.y)}` : "n/a"}`,
          `effective world action ${this.s4CorrectionDecision?.effectiveActionAttempt?.kind ?? "none"}`,
          this.s4CorrectionDecision?.reason ?? "S4 is dormant until S3 authority evaluates a contribution",
          "S4 research correction constrains execution only; it does not rewrite S2 judgement or raw S3 proposal"
        ]
      }] : []),
      {
        id: "direction",
        title: "Player direction ↔ local autonomy",
        tone: arbitration?.source === "PLAYER_DIRECTIVE" ? "success" : "normal",
        lines: [
          `directive ${directive.kind} · issued t${directive.issuedTick}`,
          directive.holdAnchor
            ? `hold anchor ${compact(directive.holdAnchor.x)}, ${compact(directive.holdAnchor.y)}`
            : "hold anchor none",
          `local brain proposes ${autonomousProposal?.kind ?? "NOT_EVALUATED"}`,
          autonomousProposal?.reason ?? "autonomous proposal unavailable",
          arbitration
            ? `selected ${arbitration.selectedKind} · source ${arbitration.source} · target ${compact(arbitration.target.x)}, ${compact(arbitration.target.y)}`
            : "arbitration waiting for first SPATIAL decision",
          arbitration
            ? `constraint ${arbitration.compatibility}${arbitration.constraintDistance !== null ? ` · distance ${compact(arbitration.constraintDistance)}m` : ""}${arbitration.constraintLimit !== null ? ` / limit ${compact(arbitration.constraintLimit)}m` : ""}`
            : "constraint not evaluated",
          arbitration?.reason ?? "no arbitration result yet"
        ]
      },
      {
        id: "stage-b",
        title: "Stage B · live shared responsibility",
        tone: !pressure?.enabled
          ? "normal"
          : pressure.phase === "ACTIVE"
            ? "warning"
            : pressure.lastOutcome === "BREACHED"
              ? "danger"
              : pressure.lastOutcome === "CONTAINED"
                ? "success"
                : "normal",
        lines: !pressure?.enabled
          ? [
              "bounded pressure loop inactive in this fixture",
              "switch to Open field for the first live teammate vertical slice"
            ]
          : [
              `world pressure ${pressure.phase} · episode ${pressure.cycle + 1} · breaches ${pressure.breaches}`,
              pressure.phase === "ACTIVE" && pressure.target
                ? `advancing threat ${compact(pressure.target.x)}, ${compact(pressure.target.y)} · player distance ${compact(pressure.threatDistanceToPlayer ?? 0)}m · breach <=${compact(pressure.breachDistance)}m`
                : pressure.phase === "QUIET"
                  ? `next advancing threat in ${pressure.ticksUntilActivation ?? 0}t`
                  : `outcome ${pressure.lastOutcome} · resolved by ${pressure.lastResolvedBy}`,
              `intercept ${pressure.responseTicks}/${pressure.requiredResponseTicks}t · ${pressure.lastResponder === "companion" ? "companion ENGAGED" : pressure.phase === "ACTIVE" ? "threat advancing" : "no active intercept"}`,
              `autonomous proposal ${autonomousProposal?.kind ?? "NOT_EVALUATED"}`,
              `selected action ${arbitration?.selectedKind ?? "NOT_EVALUATED"} · ${arbitration?.source ?? "no arbitration"}`,
              arbitration?.reason ?? pressure.reason,
              pressure.reason
            ]
      },
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
      } satisfies CausalPanelSection] : []),
      {
        id: "objective",
        title: "Objective · live vs relationship",
        tone: this.relationalDecision?.objectiveState === "NO_VALID_RELATIONAL_SLOT" ? "warning" : "normal",
        lines: this.relationalDecision
          ? [
              `LIVE ${arbitration?.selectedKind ?? "NOT_EVALUATED"} · ${arbitration?.objectiveKey ?? "unkeyed"}`,
              arbitration
                ? `live target ${compact(arbitration.target.x)}, ${compact(arbitration.target.y)} · source ${arbitration.source}`
                : "live target unavailable",
              `baseline relationship ${this.relationalDecision.selectedSlot} · target ${compact(this.relationalDecision.target.x)}, ${compact(this.relationalDecision.target.y)}`,
              `autonomy ${autonomousProposal?.kind ?? "NOT_EVALUATED"} · directive ${directive.kind}`,
              arbitration?.reason ?? this.relationalDecision.reason
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
      title: "Companion Brain Lab · Command / Autonomy Workbench",
      subtitle: `frame ${latest?.sequence ?? "-"} · observation t${latest?.observation.worldTick ?? "-"} → outcome t${latest?.outcome.worldTick ?? "-"}`,
      badge: post ? post.state.toUpperCase() : "LOADING",
      badgeTone,
      sections
    });
  }

  private handleKeyboard(): void {
    if (Phaser.Input.Keyboard.JustDown(this.keys.reset)) void this.loadScenario(this.scenarioId);
    if (Phaser.Input.Keyboard.JustDown(this.keys.incident)) this.captureIncident();

    if (Phaser.Input.Keyboard.JustDown(this.keys.one)) void this.loadScenario("open");
    if (Phaser.Input.Keyboard.JustDown(this.keys.two)) void this.loadScenario("pillar");
    if (Phaser.Input.Keyboard.JustDown(this.keys.three)) void this.loadScenario("doorway");
    if (Phaser.Input.Keyboard.JustDown(this.keys.four)) void this.loadScenario("head-on");

    if (this.ownerReviewSurface) return;

    if (this.teammateSpecimenSurface && this.scenarioId === "shared-danger") {
      const nextWithhold = this.keys.withhold.isDown;
      if (nextWithhold !== this.s4WithholdEnabled) {
        this.s4WithholdEnabled = nextWithhold;
        this.logEvent(`teammate specimen correction ${nextWithhold ? "WITHHOLD_CURRENT_CONTRIBUTION" : "NONE"}`);
      }
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.five)) void this.loadScenario("shared-danger");
    if (Phaser.Input.Keyboard.JustDown(this.keys.six)) void this.loadScenario("cooperative-episode");

    if (this.scenarioId === "shared-danger") {
      if (Phaser.Input.Keyboard.JustDown(this.keys.playerAction)) this.queueWorldAction("player");
      if (!this.teammateSpecimenSurface && Phaser.Input.Keyboard.JustDown(this.keys.companionAction)) {
        this.queueWorldAction("companion");
      }
      if (Phaser.Input.Keyboard.JustDown(this.keys.pause)) this.togglePause();
      if (Phaser.Input.Keyboard.JustDown(this.keys.step)) this.queueSingleStep();
      if (Phaser.Input.Keyboard.JustDown(this.keys.time)) this.cycleTimeScale();
      return;
    }

    if (this.scenarioId === "cooperative-episode") {
      if (Phaser.Input.Keyboard.JustDown(this.keys.playerAction)) {
        this.queueCooperativeEpisodeAction("player");
      }
      if (Phaser.Input.Keyboard.JustDown(this.keys.companionAction)) {
        this.queueCooperativeEpisodeAction("companion");
      }
      if (Phaser.Input.Keyboard.JustDown(this.keys.pause)) this.togglePause();
      if (Phaser.Input.Keyboard.JustDown(this.keys.step)) this.queueSingleStep();
      if (Phaser.Input.Keyboard.JustDown(this.keys.time)) this.cycleTimeScale();
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.f1)) this.issuePlayerDirective("AT_WILL");
    if (Phaser.Input.Keyboard.JustDown(this.keys.f2)) this.issuePlayerDirective("FOLLOW_ME");
    if (Phaser.Input.Keyboard.JustDown(this.keys.f3)) this.issuePlayerDirective("HOLD_HERE");
    if (Phaser.Input.Keyboard.JustDown(this.keys.pause)) this.togglePause();
    if (Phaser.Input.Keyboard.JustDown(this.keys.step)) this.queueSingleStep();
    if (Phaser.Input.Keyboard.JustDown(this.keys.mode)) this.cycleCompanionMode();
    if (Phaser.Input.Keyboard.JustDown(this.keys.natural)) this.toggleActuator();
    if (Phaser.Input.Keyboard.JustDown(this.keys.time)) this.cycleTimeScale();
  }

  private handlePanelAction(action: CausalPanelAction): void {
    if (this.ownerReviewSurface && !ownerReviewAllowsPanelAction(action)) {
      this.logEvent(`Owner review ignored research action ${action}`);
      return;
    }

    if (action === "toggle-pause") this.togglePause();
    else if (action === "single-step") this.queueSingleStep();
    else if (action === "reset") void this.loadScenario(this.scenarioId);
    else if (action === "cycle-mode") this.cycleCompanionMode();
    else if (action === "toggle-actuator") this.toggleActuator();
    else if (action === "cycle-a1-authority") this.cycleA1Authority();
    else if (action === "cycle-time") this.cycleTimeScale();
    else if (action === "capture-incident") this.captureIncident();
    else if (action === "directive-at-will") this.issuePlayerDirective("AT_WILL");
    else if (action === "directive-follow") this.issuePlayerDirective("FOLLOW_ME");
    else if (action === "directive-hold") this.issuePlayerDirective("HOLD_HERE");
    else if (action === "p2-preview") this.previewP2();
    else if (action === "p2-arm-singleton") this.armP2Singleton();
    else if (action === "p2-disarm") this.disarmP2();
    else if (action === "scenario-open") void this.loadScenario("open");
    else if (action === "scenario-pillar") void this.loadScenario("pillar");
    else if (action === "scenario-doorway") void this.loadScenario("doorway");
    else if (action === "scenario-head-on") void this.loadScenario("head-on");
    else if (action === "scenario-shared-danger") void this.loadScenario("shared-danger");
    else if (action === "scenario-cooperative-episode") void this.loadScenario("cooperative-episode");
    else if (action === "s1-player-intervene") this.queueWorldAction("player");
    else if (action === "s1-companion-intervene") this.queueWorldAction("companion");
    else if (action === "toggle-s3-authority") this.toggleS3Authority();
    else if (action === "toggle-s4-withhold") this.toggleS4Withhold();
  }

  private queueWorldAction(actorId: "player" | "companion"): void {
    if (this.scenarioId !== "shared-danger") {
      this.logEvent(`S1 action ignored outside shared-danger · ${actorId}`);
      return;
    }
    if (this.pendingActionAttempts.some((attempt) => attempt.actorId === actorId)) {
      this.logEvent(`S1 action already queued this frame · ${actorId}`);
      return;
    }
    this.pendingActionAttempts.push({ actorId, kind: "INTERVENE", targetId: "hostile" });
    this.logEvent(`S1 INTERVENE queued · ${actorId}`);
  }

  private queueCooperativeEpisodeAction(actorId: "player" | "companion"): void {
    if (this.scenarioId !== "cooperative-episode") {
      this.logEvent(`S5 manual action ignored outside cooperative episode · ${actorId}`);
      return;
    }
    if (this.pendingCooperativeEpisodeAttempts.some((attempt) => attempt.actorId === actorId)) {
      this.logEvent(`S5 REPEL already queued this frame · ${actorId}`);
      return;
    }
    this.pendingCooperativeEpisodeAttempts.push({ actorId, kind: "REPEL", targetId: "hostile" });
    this.logEvent(`S5 manual REPEL queued · ${actorId}`);
  }

  private toggleS4Withhold(): void {
    if (this.teammateSpecimenSurface) {
      this.logEvent("S4 debug toggle ignored in teammate specimen; hold Q for the participant correction");
      return;
    }
    if (this.scenarioId !== "shared-danger" || !this.s3AuthorityEnabled) {
      this.logEvent("S4 withhold ignored unless shared-danger S3 authority is enabled");
      return;
    }
    this.s4WithholdEnabled = !this.s4WithholdEnabled;
    this.logEvent(
      `S4 correction ${this.s4WithholdEnabled ? "WITHHOLD_CURRENT_CONTRIBUTION" : "NONE"}`
    );
  }

  private toggleS3Authority(): void {
    if (this.scenarioId !== "shared-danger") {
      this.logEvent("S3 authority ignored outside shared-danger apparatus");
      return;
    }
    this.s3AuthorityEnabled = !this.s3AuthorityEnabled;
    this.s3Contribution = null;
    if (!this.s3AuthorityEnabled) this.s4WithholdEnabled = false;
    this.s4CorrectionDecision = null;
    this.logEvent(`S3 bounded material authority ${this.s3AuthorityEnabled ? "ON" : "OFF"}`);
  }

  private issuePlayerDirective(kind: PlayerDirectiveKind): void {
    const snapshot = this.snapshotValue;
    if (!snapshot) return;
    const companion = actor(snapshot, "companion");
    const previous = this.playerDirective.snapshot();
    const next = this.playerDirective.issue(kind, snapshot.tick, companion.position);
    this.logEvent(
      `player directive ${previous.kind} -> ${next.kind} @ t${snapshot.tick}${next.holdAnchor ? ` · anchor ${compact(next.holdAnchor.x)}, ${compact(next.holdAnchor.y)}` : ""}`
    );
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
    if (this.scenarioId === "shared-danger") {
      this.logEvent("shared-danger keeps legacy companion mode MANUAL; S3 bounded authority is a separate research gate");
      return;
    }
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

    const incident = buildOwnerSandboxIncident({
      build: CURRENT_COMPANION_BUILD_IDENTITY,
      scenario: snapshot.scenarioId,
      tick: snapshot.tick,
      paused: this.paused,
      mode: this.companionMode,
      actuator: this.naturalActuator ? "natural" : "direct",
      a1Variant: this.a1Authority.debugState().variant,
      timeScale: TIME_SCALES[this.timeScaleIndex] ?? 1,
      p2: window.__authorityA12p2BrowserBridge?.snapshot() ?? null,
      frames: this.causalTrace.recent(240),
      events: this.eventLog
    });
    const blob = new Blob([JSON.stringify(incident, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const sourceLabel = incident.build.sourceSha?.slice(0, 12) ?? "unbound";
    anchor.href = url;
    anchor.download = `companion-workbench-${sourceLabel}-${snapshot.scenarioId}-tick-${snapshot.tick}.json`;
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
    this.autonomousProposalDecision = null;
    this.arbitrationDecision = null;
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
      this.sharedPressure = next.sharedPressure();
      this.sharedDanger = next.sharedDanger();
      this.cooperativeEpisode = next.cooperativeEpisode();
      if (id === "shared-danger" || id === "cooperative-episode") {
        this.companionMode = "manual";
        this.a1Authority.setVariant("off");
      }
      this.commandHud.setVisible(id !== "shared-danger" && id !== "cooperative-episode");
      this.apparatusHud.setVisible(id === "shared-danger");
      this.autonomousProposalDecision = null;
      this.arbitrationDecision = null;
      this.playerDirective.reset(this.snapshotValue.tick);
      this.accumulator = 0;
      this.singleStepQueued = false;
      this.pendingActionAttempts.length = 0;
      this.lastActionOutcomes = [];
      this.lastSharedDangerEpisodeOutcome = "NONE";
      this.pendingCooperativeEpisodeAttempts.length = 0;
      this.lastCooperativeEpisodeActionOutcomes = [];
      this.lastCooperativeEpisodeOutcome = "NONE";
      this.s3AuthorityEnabled = this.teammateSpecimenSurface && id === "shared-danger";
      this.sharedDangerReadinessEnabled = this.teammateSpecimenSurface && id === "shared-danger";
      this.s3Contribution = null;
      this.s4WithholdEnabled = false;
      this.s4CorrectionDecision = null;
      this.sharedDangerReadiness = null;
      this.playerTrail.length = 0;
      this.companionTrail.length = 0;
      this.causalTrace.reset();
      this.eventLog.length = 0;
      this.incidentNotice = "";
      this.lastPostSignature = "";
      this.resetBrains();
      if (this.a1Authority.enabled()) this.a1Authority.resetOwnedState();
      this.updateSituatedResponsibility(this.snapshotValue);
      this.recordTrail(this.snapshotValue);
      this.updatePostEvidence(this.snapshotValue);
      this.logEvent(`scenario ${id} loaded`);
      if (this.teammateSpecimenSurface && id === "shared-danger") {
        this.logEvent("teammate specimen armed · S3 autonomy ON · hold Q to withhold execution");
      }
      if (id === "cooperative-episode") {
        this.logEvent("S5 manual baseline armed · WASD+E player · arrows+Enter companion · no AI authority");
      }
      this.drawWorld(this.snapshotValue);
      this.updatePanel(this.snapshotValue);
    } finally {
      this.loading = false;
    }
  }
}
