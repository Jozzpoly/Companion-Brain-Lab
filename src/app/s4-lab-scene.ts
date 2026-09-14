import Phaser from "phaser";
import {
  COMPANION_MODES,
  RelationalPositioningBrain,
  chaseIntent,
  type CompanionMode,
  type RelationalDecision
} from "../brain/relational-positioning";
import { NaturalSpatialLocomotionBrain } from "../brain/natural-spatial-locomotion";
import type { MotionContinuityStepResult } from "../brain/motion-continuity";
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
const TIME_SCALES = [0.25, 0.5, 1, 2] as const;
const TRAIL_CAPACITY = 240;

function axis(negative: Phaser.Input.Keyboard.Key, positive: Phaser.Input.Keyboard.Key): number {
  return (positive.isDown ? 1 : 0) - (negative.isDown ? 1 : 0);
}

function motion(x: number, y: number): Vec2 {
  const length = Math.hypot(x, y);
  return length > 1 ? { x: x / length, y: y / length } : { x, y };
}

function speed(v: Vec2): number {
  return Math.hypot(v.x, v.y);
}

function compact(value: number): number {
  return Number(value.toFixed(3));
}

function topAcceptedCandidates(decision: SpatialLocomotionDecision, limit = 4): SpatialVelocityCandidate[] {
  return decision.candidates
    .filter((candidate) => !candidate.hardRejected)
    .sort((a, b) => a.score - b.score || a.id.localeCompare(b.id))
    .slice(0, limit);
}

export class S4LabScene extends Phaser.Scene {
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
  private naturalActuator = true;
  private timeScaleIndex = 2;
  private trailsEnabled = true;

  private readonly relationalBrain = new RelationalPositioningBrain();
  private readonly spatialBrain = new SpatialLocomotionBrain();
  private readonly naturalSpatialBrain = new NaturalSpatialLocomotionBrain();
  private relationalDecision: RelationalDecision | null = null;
  private spatialDecision: SpatialLocomotionDecision | null = null;
  private continuityDecision: MotionContinuityStepResult | null = null;
  private directTraversalProbe: DirectTraversalResult | null = null;
  private routePlan: StaticRoutePlan | null = null;

  private readonly debugWorkbench = new DebugWorkbenchState("motion");
  private readonly trace = new ResearchTrace();
  private readonly playerTrail: Vec2[] = [];
  private readonly companionTrail: Vec2[] = [];
  private lastSpatialSignature: string | null = null;
  private lastRouteSignature: string | null = null;
  private previousCompanionContacts = new Set<string>();
  private incidentNotice = "";

  private keys!: Record<
    "w" | "a" | "s" | "d" | "up" | "down" | "left" | "right" |
    "reset" | "pause" | "step" | "debug" | "mode" | "incident" |
    "natural" | "time" | "trail" | "one" | "two" | "three" | "four",
    Phaser.Input.Keyboard.Key
  >;

  constructor() {
    super("s4-lab");
  }

  create(): void {
    this.graphics = this.add.graphics();
    this.hud = this.add.text(12, 10, "Loading S4 natural-motion workbench...", {
      fontFamily: "monospace",
      fontSize: "14px",
      color: "#e7e9ee",
      backgroundColor: "rgba(12,14,18,0.84)",
      padding: { x: 8, y: 6 }
    }).setDepth(10);

    const keyboard = this.input.keyboard;
    if (!keyboard) throw new Error("Keyboard input is required for S4.");
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
      natural: Phaser.Input.Keyboard.KeyCodes.N,
      time: Phaser.Input.Keyboard.KeyCodes.T,
      trail: Phaser.Input.Keyboard.KeyCodes.L,
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

    const scale = TIME_SCALES[this.timeScaleIndex] ?? 1;
    const frameSeconds = Math.min(deltaMs / 1000, MAX_FRAME_SECONDS);
    if (!this.paused) this.accumulator += frameSeconds * scale;

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
    if (!this.world) throw new Error("Cannot step without World.");
    const intents = this.currentIntents();
    this.snapshotValue = this.world.step(intents);
    this.updateNavigationEvidence(this.snapshotValue);
    this.recordTrail(this.snapshotValue);
    this.recordTrace(this.snapshotValue);
  }

  private currentIntents(): MotionIntent[] {
    if (!this.world || !this.snapshotValue) throw new Error("Cannot produce intent without World state.");
    const playerIntent: MotionIntent = {
      actorId: "player",
      move: motion(axis(this.keys.a, this.keys.d), axis(this.keys.w, this.keys.s))
    };

    let companionIntent: MotionIntent;
    this.continuityDecision = null;
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
    } else {
      const relationship = this.relationalBrain.decision(this.snapshotValue);
      this.relationalDecision = relationship;
      const plan = this.buildRoutePlan(this.snapshotValue, relationship.target);
      this.routePlan = plan;
      const input = {
        snapshot: this.snapshotValue,
        relationshipTarget: relationship.target,
        routePlan: plan,
        query: (from: Vec2, to: Vec2, radius: number) => this.world!.staticCircleTraversal(from, to, radius)
      };
      if (this.naturalActuator) {
        companionIntent = this.naturalSpatialBrain.intent(input);
        const debug = this.naturalSpatialBrain.debugState();
        this.spatialDecision = debug.preferred;
        this.continuityDecision = debug.continuity;
      } else {
        companionIntent = this.spatialBrain.intent(input);
        this.spatialDecision = this.spatialBrain.debugState();
      }
      this.observeSpatialChoice(this.snapshotValue.tick);
    }
    return [playerIntent, companionIntent];
  }

  private buildRoutePlan(snapshot: WorldSnapshot, target: Vec2): StaticRoutePlan {
    if (!this.world) throw new Error("Cannot build route without World.");
    const companion = snapshot.actors.find((actor) => actor.id === "companion");
    if (!companion) throw new Error("Cannot build route without companion.");
    return planStaticShadowRoute({
      snapshot,
      start: companion.position,
      target,
      radius: companion.radius,
      query: (from, to, radius) => this.world!.staticCircleTraversal(from, to, radius)
    });
  }

  private navigationTarget(snapshot: WorldSnapshot): Vec2 | null {
    if (this.companionMode === "spatial" || this.companionMode === "relational") {
      return this.relationalDecision?.target ?? null;
    }
    if (this.companionMode === "chase") {
      const player = snapshot.actors.find((actor) => actor.id === "player");
      return player ? { ...player.position } : null;
    }
    return null;
  }

  private updateNavigationEvidence(snapshot: WorldSnapshot): void {
    if (!this.world) return;
    const target = this.navigationTarget(snapshot);
    if (!target) {
      this.directTraversalProbe = null;
      this.routePlan = null;
      return;
    }
    this.directTraversalProbe = this.world.directTraversal("companion", target);
    this.routePlan = this.buildRoutePlan(snapshot, target);
    const signature = `${this.routePlan.status}|${this.routePlan.routeNodeIds.join(">")}`;
    if (signature !== this.lastRouteSignature) {
      const previous = this.lastRouteSignature;
      this.lastRouteSignature = signature;
      this.trace.recordEvent(snapshot.tick, "nav.route", `${previous ?? "none"} -> ${signature}`, {
        actorId: "companion",
        fields: {
          status: this.routePlan.status,
          path: this.routePlan.routeNodeIds.join(">") || "none",
          cost: this.routePlan.cost === null ? null : compact(this.routePlan.cost)
        }
      });
    }
  }

  private observeSpatialChoice(tick: number): void {
    const decision = this.spatialDecision;
    if (!decision) return;
    const signature = `${decision.state}|${decision.selectedCandidateId}`;
    if (signature === this.lastSpatialSignature) return;
    const previous = this.lastSpatialSignature;
    this.lastSpatialSignature = signature;
    this.trace.recordEvent(tick, "spatial.choice", decision.reason, {
      actorId: "companion",
      fields: {
        previous,
        state: decision.state,
        candidate: decision.selectedCandidateId,
        naturalActuator: this.naturalActuator
      }
    });
  }

  private recordTrail(snapshot: WorldSnapshot): void {
    const player = snapshot.actors.find((actor) => actor.id === "player");
    const companion = snapshot.actors.find((actor) => actor.id === "companion");
    if (player) this.pushTrail(this.playerTrail, player.position);
    if (companion) this.pushTrail(this.companionTrail, companion.position);
  }

  private pushTrail(trail: Vec2[], point: Vec2): void {
    trail.push({ ...point });
    if (trail.length > TRAIL_CAPACITY) trail.splice(0, trail.length - TRAIL_CAPACITY);
  }

  private publicDebugChannels(snapshot: WorldSnapshot): PublicDebugChannel[] {
    const channels: PublicDebugChannel[] = [];
    const spatial = this.spatialDecision;
    if (this.relationalDecision) {
      channels.push({
        id: "brain",
        summary: `relationship ${this.relationalDecision.selectedSlot}`,
        fields: {
          slot: this.relationalDecision.selectedSlot,
          targetX: compact(this.relationalDecision.target.x),
          targetY: compact(this.relationalDecision.target.y),
          reason: this.relationalDecision.reason
        }
      });
    }
    if (this.routePlan) {
      channels.push({
        id: "nav",
        summary: `${this.routePlan.status}: ${this.routePlan.routeNodeIds.join(">") || "none"}`,
        fields: {
          status: this.routePlan.status,
          cost: this.routePlan.cost === null ? null : compact(this.routePlan.cost),
          clearance: compact(this.routePlan.clearance),
          directClear: this.directTraversalProbe?.clear ?? null,
          blocker: this.directTraversalProbe?.blocker?.label ?? null
        }
      });
    }
    if (spatial) {
      channels.push({
        id: "spatial",
        summary: `${spatial.state} via ${spatial.selectedCandidateId}`,
        fields: {
          candidate: spatial.selectedCandidateId,
          accepted: spatial.acceptedCount,
          rejected: spatial.rejectedCount,
          preferredVx: compact(spatial.selectedVelocity.x),
          preferredVy: compact(spatial.selectedVelocity.y),
          routeRemaining: compact(spatial.observation.routeRemainingDistance)
        }
      });
    }
    const continuity = this.continuityDecision;
    const companion = snapshot.actors.find((actor) => actor.id === "companion");
    if (companion) {
      channels.push({
        id: "motion",
        summary: continuity
          ? `${continuity.regime}; preferred ${continuity.preferredSpeed.toFixed(2)} -> commanded ${continuity.speed.toFixed(2)}`
          : `${this.naturalActuator ? "natural idle" : "direct actuator"}; actual ${speed(companion.actualVelocity).toFixed(2)}`,
        fields: {
          actuator: this.naturalActuator ? "natural" : "direct",
          preferredSpeed: continuity ? compact(continuity.preferredSpeed) : null,
          commandedSpeed: continuity ? compact(continuity.speed) : compact(speed(companion.requestedVelocity)),
          actualSpeed: compact(speed(companion.actualVelocity)),
          acceleration: continuity ? compact(continuity.accelerationMagnitude) : null,
          jerk: continuity ? compact(continuity.jerkMagnitude) : null,
          responseError: continuity ? compact(continuity.velocityError) : null,
          contacts: companion.contacts.map((contact) => contact.with).join(",") || "none"
        }
      });
    }
    return channels;
  }

  private recordTrace(snapshot: WorldSnapshot): void {
    const companion = snapshot.actors.find((actor) => actor.id === "companion");
    if (companion) {
      const contacts = new Set(companion.contacts.map((contact) => contact.with));
      for (const label of contacts) {
        if (!this.previousCompanionContacts.has(label)) {
          this.trace.recordEvent(snapshot.tick, "contact.begin", `contact with ${label}`, { actorId: "companion" });
        }
      }
      for (const label of this.previousCompanionContacts) {
        if (!contacts.has(label)) this.trace.recordEvent(snapshot.tick, "contact.end", `cleared ${label}`, { actorId: "companion" });
      }
      this.previousCompanionContacts = contacts;
    }
    this.trace.recordSample(snapshot, this.companionMode, this.publicDebugChannels(snapshot));
  }

  private handleCommands(): void {
    if (Phaser.Input.Keyboard.JustDown(this.keys.reset)) void this.loadScenario(this.scenarioId);
    if (Phaser.Input.Keyboard.JustDown(this.keys.pause)) this.paused = !this.paused;
    if (Phaser.Input.Keyboard.JustDown(this.keys.step)) {
      this.paused = true;
      this.singleStepQueued = true;
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.debug)) this.debugWorkbench.cycle();
    if (Phaser.Input.Keyboard.JustDown(this.keys.mode)) this.cycleCompanionMode();
    if (Phaser.Input.Keyboard.JustDown(this.keys.natural)) this.toggleActuator();
    if (Phaser.Input.Keyboard.JustDown(this.keys.time)) this.cycleTimeScale();
    if (Phaser.Input.Keyboard.JustDown(this.keys.trail)) this.trailsEnabled = !this.trailsEnabled;
    if (Phaser.Input.Keyboard.JustDown(this.keys.incident)) this.captureIncident();
    if (Phaser.Input.Keyboard.JustDown(this.keys.one)) void this.loadScenario("open");
    if (Phaser.Input.Keyboard.JustDown(this.keys.two)) void this.loadScenario("pillar");
    if (Phaser.Input.Keyboard.JustDown(this.keys.three)) void this.loadScenario("doorway");
    if (Phaser.Input.Keyboard.JustDown(this.keys.four)) void this.loadScenario("head-on");
  }

  private cycleCompanionMode(): void {
    const index = COMPANION_MODES.indexOf(this.companionMode);
    const next = COMPANION_MODES[(index + 1) % COMPANION_MODES.length];
    if (!next) return;
    const previous = this.companionMode;
    this.companionMode = next;
    this.resetBrains();
    this.trace.recordEvent(this.snapshotValue?.tick ?? 0, "control.mode", `${previous} -> ${next}`);
  }

  private toggleActuator(): void {
    this.naturalActuator = !this.naturalActuator;
    this.resetMotionBrains();
    this.trace.recordEvent(this.snapshotValue?.tick ?? 0, "control.actuator", this.naturalActuator ? "NATURAL" : "DIRECT");
  }

  private cycleTimeScale(): void {
    this.timeScaleIndex = (this.timeScaleIndex + 1) % TIME_SCALES.length;
    this.trace.recordEvent(this.snapshotValue?.tick ?? 0, "control.time", `${TIME_SCALES[this.timeScaleIndex]}x`);
  }

  private captureIncident(): void {
    const snapshot = this.snapshotValue;
    if (!snapshot) return;
    const incident = this.trace.captureIncident(
      snapshot,
      this.companionMode,
      `S4 Owner incident; actuator=${this.naturalActuator ? "natural" : "direct"}`,
      this.publicDebugChannels(snapshot)
    );
    const blob = new Blob([JSON.stringify(incident, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `companion-s4-${snapshot.scenarioId}-tick-${snapshot.tick}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    this.incidentNotice = `incident captured @ t${snapshot.tick}`;
  }

  private resetMotionBrains(): void {
    this.spatialBrain.reset();
    this.naturalSpatialBrain.reset();
    this.spatialDecision = null;
    this.continuityDecision = null;
    this.lastSpatialSignature = null;
  }

  private resetBrains(): void {
    this.relationalBrain.reset();
    this.resetMotionBrains();
    this.relationalDecision = null;
    this.directTraversalProbe = null;
    this.routePlan = null;
    this.lastRouteSignature = null;
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
      this.previousCompanionContacts.clear();
      this.trace.reset();
      this.incidentNotice = "";
      this.resetBrains();
      this.recordTrail(this.snapshotValue);
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

    if (this.trailsEnabled && (visibility.motion || visibility.spatial)) this.drawTrails(sx, sy);
    if (visibility.brain) this.drawRelationship(snapshot, sx, sy);
    if (visibility.nav) this.drawNavigation(sx, sy, scale);
    if (visibility.spatial) this.drawSpatial(sx, sy);

    for (const actor of snapshot.actors) {
      this.graphics.fillStyle(actor.id === "player" ? 0x63a8ff : 0xf2c15c, 1);
      this.graphics.fillCircle(sx(actor.position.x), sy(actor.position.y), actor.radius * scale);
      this.graphics.lineStyle(3, actor.contacts.length ? 0xff5d66 : 0xe7e9ee, 0.95);
      this.graphics.strokeCircle(sx(actor.position.x), sy(actor.position.y), actor.radius * scale);
      if (visibility.motion) this.drawActorMotion(actor.id, actor.position, actor.requestedVelocity, actor.actualVelocity, sx, sy, scale);
    }

    const timeScale = TIME_SCALES[this.timeScaleIndex] ?? 1;
    const actuator = this.naturalActuator ? "NATURAL" : "DIRECT";
    const lines = [
      `S4 · ${SCENARIOS[snapshot.scenarioId].label} · tick ${snapshot.tick} · ${this.paused ? "PAUSED" : "RUNNING"} ${timeScale}x · mode ${this.companionMode.toUpperCase()} · actuator ${actuator} · debug ${this.debugWorkbench.preset().toUpperCase()}`,
      "WASD player · M brain mode · N DIRECT/NATURAL A/B · T time 0.25/0.5/1/2x · L trails · B debug · P pause · O step · I incident · 1-4 scenes · R reset"
    ];
    if (this.incidentNotice) lines.push(this.incidentNotice);
    if (visibility.brain) this.appendBrainHud(lines);
    if (visibility.nav) this.appendNavHud(lines);
    if (visibility.spatial) this.appendSpatialHud(lines);
    if (visibility.motion) this.appendMotionHud(snapshot, lines);
    if (visibility.events) {
      lines.push(`EVENTS ${this.trace.sampleCount()} samples / ${this.trace.eventCount()} events`);
      for (const event of this.trace.recentEvents(5)) lines.push(`  t${event.tick} ${event.kind}: ${event.summary}`);
    }
    this.hud.setText(lines);
  }

  private drawTrails(sx: (x: number) => number, sy: (y: number) => number): void {
    const draw = (trail: readonly Vec2[], color: number): void => {
      if (trail.length < 2) return;
      this.graphics.lineStyle(2, color, 0.32);
      for (let i = 1; i < trail.length; i += 1) {
        const a = trail[i - 1];
        const b = trail[i];
        if (a && b) this.graphics.lineBetween(sx(a.x), sy(a.y), sx(b.x), sy(b.y));
      }
    };
    draw(this.playerTrail, 0x63a8ff);
    draw(this.companionTrail, 0xf2c15c);
  }

  private drawRelationship(snapshot: WorldSnapshot, sx: (x: number) => number, sy: (y: number) => number): void {
    if (!this.relationalDecision) return;
    for (const candidate of this.relationalDecision.candidates) {
      const selected = candidate.slot === this.relationalDecision.selectedSlot;
      this.graphics.lineStyle(selected ? 3 : 1, candidate.valid ? 0x9da7b3 : 0xff5d66, selected ? 1 : 0.5);
      this.graphics.strokeCircle(sx(candidate.position.x), sy(candidate.position.y), selected ? 8 : 4);
    }
    const companion = snapshot.actors.find((actor) => actor.id === "companion");
    if (companion) {
      this.graphics.lineStyle(2, 0xd2a8ff, 0.75);
      this.graphics.lineBetween(sx(companion.position.x), sy(companion.position.y), sx(this.relationalDecision.target.x), sy(this.relationalDecision.target.y));
    }
  }

  private drawNavigation(sx: (x: number) => number, sy: (y: number) => number, scale: number): void {
    const probe = this.directTraversalProbe;
    if (probe) {
      const color = probe.clear ? 0x3fb950 : 0xff7b72;
      this.graphics.lineStyle(Math.max(6, probe.radius * 2 * scale), color, 0.08);
      this.graphics.lineBetween(sx(probe.from.x), sy(probe.from.y), sx(probe.to.x), sy(probe.to.y));
      this.graphics.lineStyle(2, color, 0.7);
      this.graphics.lineBetween(sx(probe.from.x), sy(probe.from.y), sx(probe.to.x), sy(probe.to.y));
    }
    const plan = this.routePlan;
    if (!plan) return;
    const nodes = new Map(plan.nodes.map((node) => [node.id, node]));
    for (let i = 0; i < plan.routeNodeIds.length - 1; i += 1) {
      const a = nodes.get(plan.routeNodeIds[i] ?? "");
      const b = nodes.get(plan.routeNodeIds[i + 1] ?? "");
      if (!a || !b) continue;
      this.graphics.lineStyle(5, 0x58a6ff, 0.8);
      this.graphics.lineBetween(sx(a.position.x), sy(a.position.y), sx(b.position.x), sy(b.position.y));
    }
    for (const node of plan.nodes) {
      const selected = plan.routeNodeIds.includes(node.id);
      this.graphics.fillStyle(selected ? 0x58a6ff : 0x8b949e, selected ? 0.9 : 0.4);
      this.graphics.fillCircle(sx(node.position.x), sy(node.position.y), selected ? 4 : 2);
    }
  }

  private drawSpatial(sx: (x: number) => number, sy: (y: number) => number): void {
    const decision = this.spatialDecision;
    if (!decision) return;
    const origin = decision.observation.companionPosition;
    for (const ray of decision.observation.rays) {
      const end = {
        x: origin.x + ray.direction.x * ray.freeDistance,
        y: origin.y + ray.direction.y * ray.freeDistance
      };
      this.graphics.lineStyle(1, ray.blockedBy ? 0xff7b72 : 0x7ee787, ray.blockedBy ? 0.35 : 0.12);
      this.graphics.lineBetween(sx(origin.x), sy(origin.y), sx(end.x), sy(end.y));
    }
    for (const candidate of decision.candidates) {
      if (candidate.id === decision.selectedCandidateId) continue;
      this.graphics.fillStyle(candidate.hardRejected ? 0xff5d66 : 0x8b949e, candidate.hardRejected ? 0.18 : 0.22);
      this.graphics.fillCircle(sx(candidate.predictedPosition.x), sy(candidate.predictedPosition.y), 2);
    }
    this.graphics.lineStyle(3, 0xd2a8ff, 0.9);
    this.graphics.lineBetween(sx(origin.x), sy(origin.y), sx(decision.observation.routeLookahead.x), sy(decision.observation.routeLookahead.y));
  }

  private drawActorMotion(
    actorId: string,
    position: Vec2,
    requested: Vec2,
    actual: Vec2,
    sx: (x: number) => number,
    sy: (y: number) => number,
    scale: number
  ): void {
    const arrowScale = scale * 0.18;
    if (actorId === "companion" && this.continuityDecision) {
      const preferred = this.continuityDecision.preferredVelocity;
      this.graphics.lineStyle(4, 0xd2a8ff, 0.9);
      this.graphics.lineBetween(sx(position.x), sy(position.y), sx(position.x) + preferred.x * arrowScale, sy(position.y) + preferred.y * arrowScale);
    }
    this.graphics.lineStyle(3, 0x7ee787, 0.95);
    this.graphics.lineBetween(sx(position.x), sy(position.y), sx(position.x) + requested.x * arrowScale, sy(position.y) + requested.y * arrowScale);
    this.graphics.lineStyle(2, 0xff7b72, 0.95);
    this.graphics.lineBetween(sx(position.x), sy(position.y), sx(position.x) + actual.x * arrowScale, sy(position.y) + actual.y * arrowScale);
  }

  private appendBrainHud(lines: string[]): void {
    if (!this.relationalDecision) {
      lines.push(`BRAIN ${this.companionMode.toUpperCase()} baseline`);
      return;
    }
    lines.push(
      `BRAIN relationship ${this.relationalDecision.selectedSlot} · rethink #${this.relationalDecision.reconsiderationCount}`,
      `BRAIN reason: ${this.relationalDecision.reason}`
    );
  }

  private appendNavHud(lines: string[]): void {
    if (!this.routePlan) {
      lines.push("NAV no autonomous route");
      return;
    }
    lines.push(
      `NAV ${this.routePlan.status.toUpperCase()} · path ${this.routePlan.routeNodeIds.join(" → ") || "none"} · cost ${this.routePlan.cost?.toFixed(2) ?? "n/a"}`,
      `NAV clearance ${this.routePlan.clearance.toFixed(2)} · corner ε ${S2C_CORNER_EPSILON.toFixed(2)} · direct ${this.directTraversalProbe?.clear ? "CLEAR" : `BLOCKED ${this.directTraversalProbe?.blocker?.label ?? "unknown"}`}`
    );
  }

  private appendSpatialHud(lines: string[]): void {
    const decision = this.spatialDecision;
    if (!decision) {
      lines.push("SPATIAL inactive");
      return;
    }
    const top = topAcceptedCandidates(decision).map((candidate) => `${candidate.id}:${candidate.score.toFixed(2)}`).join("  ");
    lines.push(
      `SPATIAL ${decision.state} · preferred ${decision.selectedCandidateId} · ${decision.acceptedCount} accepted / ${decision.rejectedCount} rejected`,
      `SPATIAL lookahead ${decision.observation.routeLookahead.x.toFixed(2)},${decision.observation.routeLookahead.y.toFixed(2)} · remaining ${decision.observation.routeRemainingDistance.toFixed(2)}`,
      `SPATIAL top ${top}`
    );
  }

  private appendMotionHud(snapshot: WorldSnapshot, lines: string[]): void {
    const companion = snapshot.actors.find((actor) => actor.id === "companion");
    if (!companion) return;
    const c = this.continuityDecision;
    lines.push("MOTION purple=preferred · green=commanded/requested · red=actual · trails last ~4s");
    if (c) {
      lines.push(
        `MOTION ${c.regime} · preferred ${c.preferredSpeed.toFixed(2)} · commanded ${c.speed.toFixed(2)} · actual ${speed(companion.actualVelocity).toFixed(2)} · response error ${c.velocityError.toFixed(2)}`,
        `MOTION accel ${c.accelerationMagnitude.toFixed(2)} m/s² · jerk ${c.jerkMagnitude.toFixed(1)} m/s³ · actuator NATURAL`
      );
    } else {
      lines.push(`MOTION actuator ${this.naturalActuator ? "NATURAL idle" : "DIRECT"} · requested ${speed(companion.requestedVelocity).toFixed(2)} · actual ${speed(companion.actualVelocity).toFixed(2)}`);
    }
  }
}
