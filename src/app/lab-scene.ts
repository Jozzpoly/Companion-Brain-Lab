import Phaser from "phaser";
import {
  COMPANION_MODES,
  RelationalPositioningBrain,
  chaseIntent,
  type CompanionMode,
  type RelationalDecision
} from "../brain/relational-positioning";
import {
  SpatialLocomotionBrain,
  type SpatialLocomotionDecision,
  type SpatialVelocityCandidate
} from "../brain/spatial-locomotion";
import { DebugWorkbenchState } from "../debug/debug-workbench";
import { ResearchTrace, type PublicDebugChannel } from "../debug/research-trace";
import {
  S2C_CORNER_EPSILON,
  planStaticShadowRoute,
  type StaticRoutePlan
} from "../navigation/static-router";
import { S0_STEP_SECONDS } from "../physics/rapier-physical-world";
import { SCENARIOS } from "../world/scenarios";
import type {
  DirectTraversalResult,
  MotionIntent,
  ScenarioId,
  Vec2,
  WorldSnapshot
} from "../world/types";
import { LabWorld } from "../world/world";

const VIEW_WIDTH = 1200;
const VIEW_HEIGHT = 800;
const MAX_FRAME_SECONDS = 0.1;

function axis(negative: Phaser.Input.Keyboard.Key, positive: Phaser.Input.Keyboard.Key): number {
  return (positive.isDown ? 1 : 0) - (negative.isDown ? 1 : 0);
}

function motion(x: number, y: number): Vec2 {
  const magnitude = Math.hypot(x, y);
  return magnitude > 1 ? { x: x / magnitude, y: y / magnitude } : { x, y };
}

function vectorSpeed(v: Vec2): number {
  return Math.hypot(v.x, v.y);
}

function compact(value: number): number {
  return Number(value.toFixed(3));
}

function topAcceptedCandidates(decision: SpatialLocomotionDecision, limit = 5): SpatialVelocityCandidate[] {
  return decision.candidates
    .filter((candidate) => !candidate.hardRejected)
    .sort((a, b) => a.score - b.score || a.id.localeCompare(b.id))
    .slice(0, limit);
}

export class LabScene extends Phaser.Scene {
  private world: LabWorld | null = null;
  private snapshotValue: WorldSnapshot | null = null;
  private graphics!: Phaser.GameObjects.Graphics;
  private hud!: Phaser.GameObjects.Text;
  private accumulator = 0;
  private paused = false;
  private loading = false;
  private singleStepQueued = false;
  private scenarioId: ScenarioId = "open";
  private companionMode: CompanionMode = "spatial";

  private readonly relationalBrain = new RelationalPositioningBrain();
  private readonly spatialBrain = new SpatialLocomotionBrain();
  private relationalDecision: RelationalDecision | null = null;
  private spatialDecision: SpatialLocomotionDecision | null = null;
  private directTraversalProbe: DirectTraversalResult | null = null;
  private shadowRoutePlan: StaticRoutePlan | null = null;

  private readonly debugWorkbench = new DebugWorkbenchState("spatial");
  private readonly researchTrace = new ResearchTrace();
  private lastBrainSlot: string | null = null;
  private lastTraversalSignature: string | null = null;
  private lastRouteSignature: string | null = null;
  private lastSpatialSignature: string | null = null;
  private previousCompanionContacts = new Set<string>();
  private incidentNotice = "";

  private keys!: Record<
    "w" | "a" | "s" | "d" | "up" | "down" | "left" | "right" | "reset" | "pause" | "step" | "debug" | "mode" | "incident" | "one" | "two" | "three" | "four",
    Phaser.Input.Keyboard.Key
  >;

  constructor() {
    super("lab");
  }

  create(): void {
    this.graphics = this.add.graphics();
    this.hud = this.add.text(12, 10, "Loading S3 spatial locomotion workbench...", {
      fontFamily: "monospace",
      fontSize: "14px",
      color: "#e7e9ee",
      backgroundColor: "rgba(12,14,18,0.82)",
      padding: { x: 8, y: 6 }
    }).setDepth(10);

    const keyboard = this.input.keyboard;
    if (!keyboard) throw new Error("Keyboard input is required for S3.");
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
      debug: Phaser.Input.Keyboard.KeyCodes.B,
      mode: Phaser.Input.Keyboard.KeyCodes.M,
      incident: Phaser.Input.Keyboard.KeyCodes.I,
      one: Phaser.Input.Keyboard.KeyCodes.ONE,
      two: Phaser.Input.Keyboard.KeyCodes.TWO,
      three: Phaser.Input.Keyboard.KeyCodes.THREE,
      four: Phaser.Input.Keyboard.KeyCodes.FOUR
    }) as typeof this.keys;

    void this.loadScenario(this.scenarioId);
  }

  update(_time: number, deltaMs: number): void {
    this.handleCommands();
    if (!this.world || !this.snapshotValue || this.loading) return;

    const frameSeconds = Math.min(deltaMs / 1000, MAX_FRAME_SECONDS);
    if (!this.paused) this.accumulator += frameSeconds;

    if (this.singleStepQueued) {
      this.stepWorld();
      this.singleStepQueued = false;
    }

    while (!this.paused && this.accumulator >= S0_STEP_SECONDS) {
      this.stepWorld();
      this.accumulator -= S0_STEP_SECONDS;
    }

    this.draw(this.snapshotValue);
  }

  private stepWorld(): void {
    if (!this.world) throw new Error("Cannot step without a World.");
    const intents = this.currentIntents();
    this.snapshotValue = this.world.step(intents);
    this.updateNavigationEvidence(this.snapshotValue);
    this.recordTrace(this.snapshotValue);
  }

  private currentIntents(): MotionIntent[] {
    if (!this.snapshotValue || !this.world) throw new Error("Cannot produce intents without World state.");

    const playerIntent: MotionIntent = {
      actorId: "player",
      move: motion(axis(this.keys.a, this.keys.d), axis(this.keys.w, this.keys.s))
    };

    let companionIntent: MotionIntent;
    if (this.companionMode === "manual") {
      this.relationalDecision = null;
      this.spatialDecision = null;
      companionIntent = {
        actorId: "companion",
        move: motion(axis(this.keys.left, this.keys.right), axis(this.keys.up, this.keys.down))
      };
    } else if (this.companionMode === "chase") {
      this.relationalDecision = null;
      this.spatialDecision = null;
      companionIntent = chaseIntent(this.snapshotValue);
    } else if (this.companionMode === "relational") {
      companionIntent = this.relationalBrain.intent(this.snapshotValue);
      this.relationalDecision = this.relationalBrain.debugState();
      this.spatialDecision = null;
      this.observeBrainDecision(this.snapshotValue.tick);
    } else {
      const relationship = this.relationalBrain.decision(this.snapshotValue);
      this.relationalDecision = relationship;
      this.observeBrainDecision(this.snapshotValue.tick);
      const plan = this.buildRoutePlan(this.snapshotValue, relationship.target);
      this.shadowRoutePlan = plan;
      companionIntent = this.spatialBrain.intent({
        snapshot: this.snapshotValue,
        relationshipTarget: relationship.target,
        routePlan: plan,
        query: (from, to, radius) => this.world!.staticCircleTraversal(from, to, radius)
      });
      this.spatialDecision = this.spatialBrain.debugState();
      this.observeSpatialDecision(this.snapshotValue.tick);
    }

    return [playerIntent, companionIntent];
  }

  private navigationTarget(snapshot: WorldSnapshot): Vec2 | null {
    if (this.companionMode === "relational" || this.companionMode === "spatial") {
      return this.relationalDecision?.target ?? null;
    }
    if (this.companionMode === "chase") {
      const player = snapshot.actors.find((entry) => entry.id === "player");
      return player ? { ...player.position } : null;
    }
    return null;
  }

  private buildRoutePlan(snapshot: WorldSnapshot, target: Vec2): StaticRoutePlan {
    if (!this.world) throw new Error("Cannot build route plan without a World.");
    const companion = snapshot.actors.find((entry) => entry.id === "companion");
    if (!companion) throw new Error("Cannot build route plan without companion actor.");
    return planStaticShadowRoute({
      snapshot,
      start: companion.position,
      target,
      radius: companion.radius,
      query: (from, to, radius) => this.world!.staticCircleTraversal(from, to, radius)
    });
  }

  private updateNavigationEvidence(snapshot: WorldSnapshot): void {
    if (!this.world) return;
    const target = this.navigationTarget(snapshot);
    if (!target) {
      this.resetNavigationEvidence();
      return;
    }

    const probe = this.world.directTraversal("companion", target);
    const plan = this.buildRoutePlan(snapshot, target);
    this.directTraversalProbe = probe;
    this.shadowRoutePlan = plan;
    this.observeDirectTraversal(snapshot, probe);
    this.observeShadowRoute(snapshot, plan);
  }

  private observeDirectTraversal(snapshot: WorldSnapshot, probe: DirectTraversalResult): void {
    const signature = probe.clear ? "clear" : `blocked:${probe.blocker?.label ?? "unknown"}`;
    if (signature === this.lastTraversalSignature) return;
    const previous = this.lastTraversalSignature;
    this.lastTraversalSignature = signature;

    if (probe.clear) {
      this.researchTrace.recordEvent(snapshot.tick, "nav.direct.clear", "direct whole-body traversal is clear", {
        actorId: "companion",
        fields: {
          previous,
          targetX: compact(probe.to.x),
          targetY: compact(probe.to.y),
          distance: compact(probe.distance),
          radius: compact(probe.radius)
        }
      });
      return;
    }

    const blocker = probe.blocker;
    this.researchTrace.recordEvent(snapshot.tick, "nav.direct.blocked", `direct traversal blocked by ${blocker?.label ?? "unknown"}`, {
      actorId: "companion",
      fields: blocker
        ? {
            previous,
            blocker: blocker.label,
            hitDistance: compact(blocker.distance),
            fraction: compact(blocker.fraction),
            hitX: compact(blocker.hitCenter.x),
            hitY: compact(blocker.hitCenter.y),
            contactX: compact(blocker.contactPoint.x),
            contactY: compact(blocker.contactPoint.y),
            normalX: compact(blocker.normal.x),
            normalY: compact(blocker.normal.y)
          }
        : { previous }
    });
  }

  private observeShadowRoute(snapshot: WorldSnapshot, plan: StaticRoutePlan): void {
    const routePath = plan.routeNodeIds.join(">");
    const signature = `${plan.status}|${routePath}`;
    if (signature === this.lastRouteSignature) return;
    const previous = this.lastRouteSignature;
    this.lastRouteSignature = signature;
    const blockedEdges = plan.edges.filter((edge) => !edge.clear).length;
    this.researchTrace.recordEvent(snapshot.tick, `nav.route.${plan.status}`, `route ${plan.status}: ${plan.reason}`, {
      actorId: "companion",
      fields: {
        previous,
        status: plan.status,
        path: routePath || "none",
        cost: plan.cost === null ? null : compact(plan.cost),
        nodes: plan.nodes.length,
        edges: plan.edges.length,
        blockedEdges,
        clearance: compact(plan.clearance),
        cornerEpsilon: compact(S2C_CORNER_EPSILON),
        feedsSpatialLocomotion: this.companionMode === "spatial"
      }
    });
  }

  private observeBrainDecision(tick: number): void {
    const decision = this.relationalDecision;
    if (!decision || decision.selectedSlot === this.lastBrainSlot) return;
    const previous = this.lastBrainSlot;
    this.lastBrainSlot = decision.selectedSlot;
    this.researchTrace.recordEvent(tick, "brain.relationship", previous === null
      ? `selected ${decision.selectedSlot}`
      : `slot ${previous} -> ${decision.selectedSlot}`, {
      actorId: "companion",
      fields: {
        previous,
        selected: decision.selectedSlot,
        reason: decision.reason,
        targetX: compact(decision.target.x),
        targetY: compact(decision.target.y)
      }
    });
  }

  private observeSpatialDecision(tick: number): void {
    const decision = this.spatialDecision;
    if (!decision) return;
    const signature = `${decision.state}|${decision.selectedCandidateId}`;
    if (signature === this.lastSpatialSignature) return;
    const previous = this.lastSpatialSignature;
    this.lastSpatialSignature = signature;
    const selected = decision.candidates.find((candidate) => candidate.id === decision.selectedCandidateId);
    this.researchTrace.recordEvent(tick, "spatial.choice", decision.reason, {
      actorId: "companion",
      fields: {
        previous,
        state: decision.state,
        candidate: decision.selectedCandidateId,
        accepted: decision.acceptedCount,
        rejected: decision.rejectedCount,
        moveX: compact(decision.selectedMove.x),
        moveY: compact(decision.selectedMove.y),
        score: selected ? compact(selected.score) : null,
        minPlayerClearance: selected ? compact(selected.minimumPlayerClearance) : null
      }
    });
  }

  private recordTrace(snapshot: WorldSnapshot): void {
    const companion = snapshot.actors.find((entry) => entry.id === "companion");
    if (companion) {
      const currentContacts = new Set(companion.contacts.map((contact) => contact.with));
      for (const label of currentContacts) {
        if (!this.previousCompanionContacts.has(label)) {
          this.researchTrace.recordEvent(snapshot.tick, "contact.begin", `contact with ${label}`, {
            actorId: "companion",
            fields: { collider: label }
          });
        }
      }
      for (const label of this.previousCompanionContacts) {
        if (!currentContacts.has(label)) {
          this.researchTrace.recordEvent(snapshot.tick, "contact.end", `contact cleared with ${label}`, {
            actorId: "companion",
            fields: { collider: label }
          });
        }
      }
      this.previousCompanionContacts = currentContacts;
    }
    this.researchTrace.recordSample(snapshot, this.companionMode, this.publicDebugChannels(snapshot));
  }

  private publicDebugChannels(snapshot: WorldSnapshot): PublicDebugChannel[] {
    const channels: PublicDebugChannel[] = [];
    const companion = snapshot.actors.find((entry) => entry.id === "companion");

    if (this.relationalDecision && (this.companionMode === "relational" || this.companionMode === "spatial")) {
      channels.push({
        id: "brain",
        summary: `relationship slot ${this.relationalDecision.selectedSlot}`,
        fields: {
          selectedSlot: this.relationalDecision.selectedSlot,
          targetX: compact(this.relationalDecision.target.x),
          targetY: compact(this.relationalDecision.target.y),
          rethink: this.relationalDecision.reconsiderationCount,
          reason: this.relationalDecision.reason,
          feedsSpatial: this.companionMode === "spatial"
        }
      });
    } else {
      channels.push({ id: "brain", summary: `${this.companionMode} baseline` });
    }

    const probe = this.directTraversalProbe;
    const plan = this.shadowRoutePlan;
    if (probe && plan) {
      const blocker = probe.blocker;
      const blockedEdges = plan.edges.filter((edge) => !edge.clear).length;
      channels.push({
        id: "nav",
        summary: `${plan.status}; direct ${probe.clear ? "clear" : `blocked by ${blocker?.label ?? "unknown"}`}`,
        fields: {
          routeModel: "visibility-graph-v0",
          feedsSpatial: this.companionMode === "spatial",
          routeStatus: plan.status,
          routeReason: plan.reason,
          routePath: plan.routeNodeIds.join(">") || "none",
          routeCost: plan.cost === null ? null : compact(plan.cost),
          routeNodes: plan.nodes.length,
          routeEdges: plan.edges.length,
          rejectedEdges: blockedEdges,
          routeClearance: compact(plan.clearance),
          cornerEpsilon: compact(S2C_CORNER_EPSILON),
          directClear: probe.clear,
          blocker: blocker?.label ?? null,
          hitDistance: blocker ? compact(blocker.distance) : null
        }
      });
    } else {
      channels.push({ id: "nav", summary: "no autonomous route evidence" });
    }

    const spatial = this.spatialDecision;
    if (spatial) {
      const selected = spatial.candidates.find((candidate) => candidate.id === spatial.selectedCandidateId);
      const blockedRays = spatial.observation.rays.filter((ray) => ray.blockedBy !== null).length;
      channels.push({
        id: "spatial",
        summary: `${spatial.state} via ${spatial.selectedCandidateId}`,
        fields: {
          state: spatial.state,
          candidate: spatial.selectedCandidateId,
          accepted: spatial.acceptedCount,
          rejected: spatial.rejectedCount,
          blockedRays,
          rays: spatial.observation.rays.length,
          lookaheadX: compact(spatial.observation.routeLookahead.x),
          lookaheadY: compact(spatial.observation.routeLookahead.y),
          predictedPlayerX: compact(spatial.observation.predictedPlayerPosition.x),
          predictedPlayerY: compact(spatial.observation.predictedPlayerPosition.y),
          selectedScore: selected ? compact(selected.score) : null,
          playerClearance: selected ? compact(selected.minimumPlayerClearance) : null,
          routeTerm: selected ? compact(selected.terms.routeDistance) : null,
          relationshipTerm: selected ? compact(selected.terms.relationshipDistance) : null,
          clearanceTerm: selected ? compact(selected.terms.clearancePenalty) : null,
          playerRiskTerm: selected ? compact(selected.terms.playerRiskPenalty) : null,
          continuityTerm: selected ? compact(selected.terms.continuityPenalty) : null
        }
      });
    } else {
      channels.push({ id: "spatial", summary: "SPATIAL locomotion inactive" });
    }

    if (companion) {
      channels.push({
        id: "motion",
        summary: companion.contacts.length > 0 ? "moving with contact" : "moving without contact",
        fields: {
          requestedSpeed: compact(vectorSpeed(companion.requestedVelocity)),
          actualSpeed: compact(vectorSpeed(companion.actualVelocity)),
          motionError: compact(companion.motionError),
          contacts: companion.contacts.map((contact) => contact.with).join(",") || "none"
        }
      });
    }

    return channels;
  }

  private handleCommands(): void {
    if (Phaser.Input.Keyboard.JustDown(this.keys.reset)) void this.loadScenario(this.scenarioId);
    if (Phaser.Input.Keyboard.JustDown(this.keys.pause)) {
      this.paused = !this.paused;
      this.recordControlEvent("simulation.pause", this.paused ? "paused" : "resumed");
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.step)) {
      this.paused = true;
      this.singleStepQueued = true;
      this.recordControlEvent("simulation.step", "single-step queued");
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.debug)) {
      const preset = this.debugWorkbench.cycle();
      this.recordControlEvent("debug.preset", `debug preset ${preset}`, { preset });
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.mode)) this.cycleCompanionMode();
    if (Phaser.Input.Keyboard.JustDown(this.keys.incident)) this.captureIncident();
    if (Phaser.Input.Keyboard.JustDown(this.keys.one)) void this.loadScenario("open");
    if (Phaser.Input.Keyboard.JustDown(this.keys.two)) void this.loadScenario("pillar");
    if (Phaser.Input.Keyboard.JustDown(this.keys.three)) void this.loadScenario("doorway");
    if (Phaser.Input.Keyboard.JustDown(this.keys.four)) void this.loadScenario("head-on");
  }

  private recordControlEvent(kind: string, summary: string, fields?: Record<string, string | number | boolean | null>): void {
    if (!this.snapshotValue) return;
    this.researchTrace.recordEvent(this.snapshotValue.tick, kind, summary, { fields });
  }

  private resetNavigationEvidence(): void {
    this.directTraversalProbe = null;
    this.shadowRoutePlan = null;
    this.lastTraversalSignature = null;
    this.lastRouteSignature = null;
  }

  private resetBrains(): void {
    this.relationalBrain.reset();
    this.spatialBrain.reset();
    this.relationalDecision = null;
    this.spatialDecision = null;
    this.lastBrainSlot = null;
    this.lastSpatialSignature = null;
  }

  private cycleCompanionMode(): void {
    const currentIndex = COMPANION_MODES.indexOf(this.companionMode);
    const next = COMPANION_MODES[(currentIndex + 1) % COMPANION_MODES.length];
    if (!next) throw new Error("Companion mode cycle produced no next mode.");
    const previous = this.companionMode;
    this.companionMode = next;
    this.resetBrains();
    this.resetNavigationEvidence();
    this.recordControlEvent("companion.mode", `${previous} -> ${next}`, { previous, next });
  }

  private captureIncident(): void {
    const snapshot = this.snapshotValue;
    if (!snapshot) return;
    this.researchTrace.recordEvent(snapshot.tick, "incident.capture", "Owner marked incident", {
      fields: { scenario: snapshot.scenarioId, mode: this.companionMode }
    });
    const incident = this.researchTrace.captureIncident(
      snapshot,
      this.companionMode,
      `Owner incident at tick ${snapshot.tick}`,
      this.publicDebugChannels(snapshot)
    );
    const blob = new Blob([JSON.stringify(incident, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `companion-lab-${snapshot.scenarioId}-tick-${snapshot.tick}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    this.incidentNotice = `incident captured @ tick ${snapshot.tick} (${this.researchTrace.sampleCount()} samples)`;
  }

  private async loadScenario(id: ScenarioId): Promise<void> {
    if (this.loading) return;
    this.loading = true;
    this.hud?.setText(`Loading ${id}...`);
    const previous = this.world;
    try {
      const next = await LabWorld.create(id);
      previous?.dispose();
      this.world = next;
      this.scenarioId = id;
      this.snapshotValue = next.snapshot();
      this.accumulator = 0;
      this.singleStepQueued = false;
      this.resetBrains();
      this.resetNavigationEvidence();
      this.previousCompanionContacts.clear();
      this.researchTrace.reset();
      this.incidentNotice = "";
      this.researchTrace.recordEvent(this.snapshotValue.tick, "scenario.load", `loaded ${id}`, {
        fields: { scenario: id, mode: this.companionMode }
      });
      this.recordTrace(this.snapshotValue);
      this.draw(this.snapshotValue);
    } finally {
      this.loading = false;
    }
  }

  private draw(snapshot: WorldSnapshot): void {
    const scale = Math.min(VIEW_WIDTH / snapshot.width, VIEW_HEIGHT / snapshot.height);
    const offsetX = (VIEW_WIDTH - snapshot.width * scale) / 2;
    const offsetY = (VIEW_HEIGHT - snapshot.height * scale) / 2;
    const sx = (x: number) => offsetX + x * scale;
    const sy = (y: number) => offsetY + y * scale;
    const visibility = this.debugWorkbench.visibility();

    this.graphics.clear();
    this.graphics.fillStyle(0x171b22, 1).fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
    this.graphics.lineStyle(2, 0x55606f, 1).strokeRect(offsetX, offsetY, snapshot.width * scale, snapshot.height * scale);

    this.graphics.fillStyle(0x39414d, 1);
    for (const obstacle of snapshot.obstacles) {
      this.graphics.fillRect(sx(obstacle.x), sy(obstacle.y), obstacle.width * scale, obstacle.height * scale);
    }

    if (visibility.brain) this.drawRelationshipOverlay(snapshot, sx, sy);
    if (visibility.nav) this.drawNavigationOverlay(sx, sy, scale);
    if (visibility.spatial) this.drawSpatialOverlay(sx, sy, scale);

    for (const actor of snapshot.actors) {
      const isPlayer = actor.id === "player";
      const inContact = actor.contacts.length > 0;
      this.graphics.fillStyle(isPlayer ? 0x63a8ff : 0xf2c15c, 1);
      this.graphics.fillCircle(sx(actor.position.x), sy(actor.position.y), actor.radius * scale);
      this.graphics.lineStyle(3, inContact ? 0xff5d66 : 0xe7e9ee, 0.95);
      this.graphics.strokeCircle(sx(actor.position.x), sy(actor.position.y), actor.radius * scale);

      if (visibility.motion) {
        const arrowScale = scale * 0.18;
        this.graphics.lineStyle(3, 0x7ee787, 0.95);
        this.graphics.lineBetween(
          sx(actor.position.x), sy(actor.position.y),
          sx(actor.position.x) + actor.requestedVelocity.x * arrowScale,
          sy(actor.position.y) + actor.requestedVelocity.y * arrowScale
        );
        this.graphics.lineStyle(2, 0xff7b72, 0.95);
        this.graphics.lineBetween(
          sx(actor.position.x), sy(actor.position.y),
          sx(actor.position.x) + actor.actualVelocity.x * arrowScale,
          sy(actor.position.y) + actor.actualVelocity.y * arrowScale
        );
      }
    }

    const actorLines = snapshot.actors.map((actor) => {
      const contactText = actor.contacts.length
        ? actor.contacts.map((contact) => `${contact.with}:${contact.contactCount}`).join(", ")
        : "none";
      return `${actor.id.padEnd(9)} pos ${actor.position.x.toFixed(2)},${actor.position.y.toFixed(2)}  requested ${vectorSpeed(actor.requestedVelocity).toFixed(2)}  actual ${vectorSpeed(actor.actualVelocity).toFixed(2)}  error ${actor.motionError.toFixed(2)}  contacts ${contactText}`;
    });

    const scenarioLabel = SCENARIOS[snapshot.scenarioId].label;
    const authority = this.companionMode === "spatial"
      ? "SPATIAL LOCAL LOCOMOTION AUTHORITY ACTIVE"
      : `${this.companionMode.toUpperCase()} BASELINE AUTHORITY`;
    const baseLines = [
      `S3 · ${scenarioLabel} · tick ${snapshot.tick} · ${this.paused ? "PAUSED" : "RUNNING"} · companion ${this.companionMode.toUpperCase()} · debug ${this.debugWorkbench.preset().toUpperCase()}`,
      authority,
      "WASD player · M mode [MANUAL/CHASE/RELATIONAL/SPATIAL] · arrows manual companion · 1-4 scenarios · R reset · P pause · O step · B debug · I incident"
    ];
    if (this.incidentNotice) baseLines.push(this.incidentNotice);

    const debugLines: string[] = [];
    if (visibility.brain) this.appendBrainHud(debugLines);
    if (visibility.nav) this.appendNavigationHud(debugLines);
    if (visibility.spatial) this.appendSpatialHud(debugLines);
    if (visibility.motion) {
      debugLines.push("MOTION green=requested velocity · red=actual velocity · red body outline=contact", ...actorLines);
    }
    if (visibility.events) {
      const events = this.researchTrace.recentEvents(6);
      debugLines.push(`EVENTS trace ${this.researchTrace.sampleCount()} samples / ${this.researchTrace.eventCount()} events`);
      for (const event of events) debugLines.push(`  t${event.tick} ${event.kind}: ${event.summary}`);
    }
    this.hud.setVisible(true).setText([...baseLines, ...debugLines]);
  }

  private drawRelationshipOverlay(
    snapshot: WorldSnapshot,
    sx: (x: number) => number,
    sy: (y: number) => number
  ): void {
    if ((this.companionMode === "relational" || this.companionMode === "spatial") && this.relationalDecision) {
      const companion = snapshot.actors.find((entry) => entry.id === "companion");
      const player = snapshot.actors.find((entry) => entry.id === "player");
      for (const candidate of this.relationalDecision.candidates) {
        const selected = candidate.slot === this.relationalDecision.selectedSlot;
        this.graphics.lineStyle(selected ? 3 : 1, candidate.valid ? 0x9da7b3 : 0xff5d66, selected ? 1 : 0.55);
        this.graphics.strokeCircle(sx(candidate.position.x), sy(candidate.position.y), selected ? 8 : 5);
      }
      if (companion) {
        this.graphics.lineStyle(2, 0xd2a8ff, 0.9);
        this.graphics.lineBetween(
          sx(companion.position.x), sy(companion.position.y),
          sx(this.relationalDecision.target.x), sy(this.relationalDecision.target.y)
        );
      }
      if (player) {
        this.graphics.lineStyle(2, 0x79c0ff, 0.9);
        this.graphics.lineBetween(
          sx(player.position.x), sy(player.position.y),
          sx(player.position.x + this.relationalDecision.playerDirection.x),
          sy(player.position.y + this.relationalDecision.playerDirection.y)
        );
      }
      return;
    }

    if (this.companionMode === "chase") {
      const companion = snapshot.actors.find((entry) => entry.id === "companion");
      const player = snapshot.actors.find((entry) => entry.id === "player");
      if (companion && player) {
        this.graphics.lineStyle(2, 0xd29922, 0.8);
        this.graphics.lineBetween(sx(companion.position.x), sy(companion.position.y), sx(player.position.x), sy(player.position.y));
      }
    }
  }

  private drawNavigationOverlay(
    sx: (x: number) => number,
    sy: (y: number) => number,
    scale: number
  ): void {
    const probe = this.directTraversalProbe;
    if (probe) {
      const corridorColor = probe.clear ? 0x3fb950 : 0xff7b72;
      const corridorWidth = Math.max(6, probe.radius * 2 * scale);
      this.graphics.lineStyle(corridorWidth, corridorColor, 0.1);
      this.graphics.lineBetween(sx(probe.from.x), sy(probe.from.y), sx(probe.to.x), sy(probe.to.y));
      this.graphics.lineStyle(2, corridorColor, 0.8);
      this.graphics.lineBetween(sx(probe.from.x), sy(probe.from.y), sx(probe.to.x), sy(probe.to.y));
      const blocker = probe.blocker;
      if (blocker) {
        this.graphics.fillStyle(0xffa657, 1);
        this.graphics.fillCircle(sx(blocker.contactPoint.x), sy(blocker.contactPoint.y), 4);
      }
    }

    const plan = this.shadowRoutePlan;
    if (!plan) return;
    const nodes = new Map(plan.nodes.map((node) => [node.id, node]));
    const routeEdges = new Set<string>();
    for (let index = 0; index < plan.routeNodeIds.length - 1; index += 1) {
      const a = plan.routeNodeIds[index];
      const b = plan.routeNodeIds[index + 1];
      if (!a || !b) continue;
      routeEdges.add(a < b ? `${a}<->${b}` : `${b}<->${a}`);
    }

    for (const edge of plan.edges) {
      if (routeEdges.has(edge.id)) continue;
      const from = nodes.get(edge.from);
      const to = nodes.get(edge.to);
      if (!from || !to) continue;
      this.graphics.lineStyle(1, edge.clear ? 0x8b949e : 0xff5d66, edge.clear ? 0.16 : 0.08);
      this.graphics.lineBetween(sx(from.position.x), sy(from.position.y), sx(to.position.x), sy(to.position.y));
    }
    for (const edgeId of routeEdges) {
      const edge = plan.edges.find((candidate) => candidate.id === edgeId);
      if (!edge) continue;
      const from = nodes.get(edge.from);
      const to = nodes.get(edge.to);
      if (!from || !to) continue;
      this.graphics.lineStyle(5, 0x58a6ff, 0.82);
      this.graphics.lineBetween(sx(from.position.x), sy(from.position.y), sx(to.position.x), sy(to.position.y));
    }
    for (const node of plan.nodes) {
      const inRoute = plan.routeNodeIds.includes(node.id);
      this.graphics.fillStyle(node.kind === "target" ? 0xd2a8ff : inRoute ? 0x58a6ff : 0x8b949e, inRoute ? 1 : 0.65);
      this.graphics.fillCircle(sx(node.position.x), sy(node.position.y), inRoute ? 5 : 3);
    }
  }

  private drawSpatialOverlay(
    sx: (x: number) => number,
    sy: (y: number) => number,
    scale: number
  ): void {
    const decision = this.spatialDecision;
    if (!decision) return;
    const observation = decision.observation;
    const origin = observation.companionPosition;

    for (const ray of observation.rays) {
      const endpoint = {
        x: origin.x + ray.direction.x * ray.freeDistance,
        y: origin.y + ray.direction.y * ray.freeDistance
      };
      this.graphics.lineStyle(1, ray.blockedBy ? 0xff7b72 : 0x7ee787, ray.blockedBy ? 0.42 : 0.18);
      this.graphics.lineBetween(sx(origin.x), sy(origin.y), sx(endpoint.x), sy(endpoint.y));
      if (ray.blockedBy && ray.hitPoint) {
        this.graphics.fillStyle(0xff7b72, 0.7);
        this.graphics.fillCircle(sx(ray.hitPoint.x), sy(ray.hitPoint.y), 2.5);
      }
    }

    for (const candidate of decision.candidates) {
      const selected = candidate.id === decision.selectedCandidateId;
      if (selected) continue;
      this.graphics.fillStyle(candidate.hardRejected ? 0xff5d66 : 0x8b949e, candidate.hardRejected ? 0.22 : 0.28);
      this.graphics.fillCircle(sx(candidate.predictedPosition.x), sy(candidate.predictedPosition.y), candidate.hardRejected ? 2 : 2.5);
    }

    const selected = decision.candidates.find((candidate) => candidate.id === decision.selectedCandidateId);
    if (selected) {
      this.graphics.lineStyle(6, 0x39d0d8, 0.9);
      this.graphics.lineBetween(
        sx(origin.x), sy(origin.y),
        sx(selected.predictedPosition.x), sy(selected.predictedPosition.y)
      );
      this.graphics.fillStyle(0x39d0d8, 1);
      this.graphics.fillCircle(sx(selected.predictedPosition.x), sy(selected.predictedPosition.y), 6);
    }

    this.graphics.lineStyle(3, 0xd2a8ff, 0.9);
    this.graphics.lineBetween(
      sx(origin.x), sy(origin.y),
      sx(observation.routeLookahead.x), sy(observation.routeLookahead.y)
    );
    this.graphics.strokeCircle(sx(observation.routeLookahead.x), sy(observation.routeLookahead.y), 7);

    this.graphics.lineStyle(3, 0x79c0ff, 0.75);
    this.graphics.lineBetween(
      sx(observation.playerPosition.x), sy(observation.playerPosition.y),
      sx(observation.predictedPlayerPosition.x), sy(observation.predictedPlayerPosition.y)
    );
    this.graphics.lineStyle(2, 0x79c0ff, 0.8);
    this.graphics.strokeCircle(
      sx(observation.predictedPlayerPosition.x),
      sy(observation.predictedPlayerPosition.y),
      observation.playerRadius * scale
    );
  }

  private appendBrainHud(lines: string[]): void {
    if ((this.companionMode === "relational" || this.companionMode === "spatial") && this.relationalDecision) {
      const scores = this.relationalDecision.candidates
        .map((candidate) => `${candidate.slot}:${candidate.valid ? candidate.score.toFixed(2) : "X"}`)
        .join("  ");
      lines.push(
        `BRAIN relationship ${this.relationalDecision.selectedSlot} · rethink #${this.relationalDecision.reconsiderationCount}`,
        `BRAIN reason: ${this.relationalDecision.reason}`,
        `BRAIN candidates: ${scores}`
      );
    } else if (this.companionMode === "chase") {
      lines.push("BRAIN CHASE baseline: direct center-seeking");
    } else {
      lines.push("BRAIN MANUAL baseline: arrow keys own companion intent");
    }
  }

  private appendNavigationHud(lines: string[]): void {
    const probe = this.directTraversalProbe;
    const plan = this.shadowRoutePlan;
    if (!probe || !plan) {
      lines.push("NAV no autonomous route evidence");
      return;
    }
    const blockedEdges = plan.edges.filter((edge) => !edge.clear).length;
    const acceptedEdges = plan.edges.length - blockedEdges;
    lines.push(
      `NAV direct ${probe.clear ? "CLEAR" : `BLOCKED ${probe.blocker?.label ?? "unknown"}`} · route ${plan.status.toUpperCase()} · cost ${plan.cost?.toFixed(2) ?? "n/a"}`,
      `NAV path ${plan.routeNodeIds.join(" → ") || "none"}`,
      `NAV graph ${plan.nodes.length} nodes · ${acceptedEdges} accepted / ${blockedEdges} rejected · clearance ${plan.clearance.toFixed(2)} · corner ε ${S2C_CORNER_EPSILON.toFixed(2)}`,
      `NAV reason: ${plan.reason}`,
      this.companionMode === "spatial"
        ? "NAV route is corridor/lookahead guidance for SPATIAL; local locomotion chooses the actual velocity"
        : "NAV route is observational only in this baseline mode"
    );
  }

  private appendSpatialHud(lines: string[]): void {
    const decision = this.spatialDecision;
    if (!decision) {
      lines.push("SPATIAL inactive — switch companion mode with M");
      return;
    }
    const selected = decision.candidates.find((candidate) => candidate.id === decision.selectedCandidateId);
    const blockedRays = decision.observation.rays.filter((ray) => ray.blockedBy !== null).length;
    const top = topAcceptedCandidates(decision, 4)
      .map((candidate) => `${candidate.id}:${candidate.score.toFixed(2)}`)
      .join("  ");
    lines.push(
      `SPATIAL ${decision.state} · selected ${decision.selectedCandidateId} · ${decision.acceptedCount} accepted / ${decision.rejectedCount} rejected`,
      `SPATIAL 360° awareness ${decision.observation.rays.length} rays · ${blockedRays} blocked · lookahead ${decision.observation.routeLookahead.x.toFixed(2)},${decision.observation.routeLookahead.y.toFixed(2)}`,
      `SPATIAL player now ${decision.observation.playerPosition.x.toFixed(2)},${decision.observation.playerPosition.y.toFixed(2)} → predicted ${decision.observation.predictedPlayerPosition.x.toFixed(2)},${decision.observation.predictedPlayerPosition.y.toFixed(2)}`,
      selected
        ? `SPATIAL score ${selected.score.toFixed(2)} = route ${selected.terms.routeDistance.toFixed(2)} + relation ${selected.terms.relationshipDistance.toFixed(2)} + clearance ${selected.terms.clearancePenalty.toFixed(2)} + player ${selected.terms.playerRiskPenalty.toFixed(2)} + continuity ${selected.terms.continuityPenalty.toFixed(2)} + motion ${selected.terms.unnecessaryMotionPenalty.toFixed(2)}`
        : "SPATIAL selected candidate data unavailable",
      `SPATIAL top: ${top}`,
      `SPATIAL reason: ${decision.reason}`
    );
  }
}
