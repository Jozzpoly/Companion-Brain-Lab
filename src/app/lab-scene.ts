import Phaser from "phaser";
import {
  COMPANION_MODES,
  RelationalPositioningBrain,
  chaseIntent,
  type CompanionMode,
  type RelationalDecision
} from "../brain/relational-positioning";
import { DebugWorkbenchState } from "../debug/debug-workbench";
import { ResearchTrace, type PublicDebugChannel } from "../debug/research-trace";
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
  private companionMode: CompanionMode = "relational";
  private readonly relationalBrain = new RelationalPositioningBrain();
  private relationalDecision: RelationalDecision | null = null;
  private directTraversalProbe: DirectTraversalResult | null = null;
  private readonly debugWorkbench = new DebugWorkbenchState("brain");
  private readonly researchTrace = new ResearchTrace();
  private lastBrainSlot: string | null = null;
  private lastTraversalSignature: string | null = null;
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
    this.hud = this.add.text(12, 10, "Loading S2-B movement workbench...", {
      fontFamily: "monospace",
      fontSize: "15px",
      color: "#e7e9ee",
      backgroundColor: "rgba(12,14,18,0.78)",
      padding: { x: 8, y: 6 }
    }).setDepth(10);

    const keyboard = this.input.keyboard;
    if (!keyboard) throw new Error("Keyboard input is required for S2-B.");
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
    this.updateTraversalProbe(this.snapshotValue);
    this.recordTrace(this.snapshotValue);
  }

  private currentIntents(): MotionIntent[] {
    if (!this.snapshotValue) throw new Error("Cannot produce intents without a World snapshot.");

    const playerIntent: MotionIntent = {
      actorId: "player",
      move: motion(axis(this.keys.a, this.keys.d), axis(this.keys.w, this.keys.s))
    };

    let companionIntent: MotionIntent;
    if (this.companionMode === "manual") {
      this.relationalDecision = null;
      companionIntent = {
        actorId: "companion",
        move: motion(axis(this.keys.left, this.keys.right), axis(this.keys.up, this.keys.down))
      };
    } else if (this.companionMode === "chase") {
      this.relationalDecision = null;
      companionIntent = chaseIntent(this.snapshotValue);
    } else {
      companionIntent = this.relationalBrain.intent(this.snapshotValue);
      this.relationalDecision = this.relationalBrain.debugState();
      this.observeBrainDecision(this.snapshotValue.tick);
    }

    return [playerIntent, companionIntent];
  }

  private navigationTarget(snapshot: WorldSnapshot): Vec2 | null {
    if (this.companionMode === "relational") return this.relationalDecision?.target ?? null;
    if (this.companionMode === "chase") {
      const player = snapshot.actors.find((entry) => entry.id === "player");
      return player ? { ...player.position } : null;
    }
    return null;
  }

  private updateTraversalProbe(snapshot: WorldSnapshot): void {
    if (!this.world) return;
    const target = this.navigationTarget(snapshot);
    if (!target) {
      this.directTraversalProbe = null;
      this.lastTraversalSignature = null;
      return;
    }

    const probe = this.world.directTraversal("companion", target);
    this.directTraversalProbe = probe;
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

  private observeBrainDecision(tick: number): void {
    const decision = this.relationalDecision;
    if (!decision || decision.selectedSlot === this.lastBrainSlot) return;
    const previous = this.lastBrainSlot;
    this.lastBrainSlot = decision.selectedSlot;
    this.researchTrace.recordEvent(
      tick,
      "brain.slot",
      previous === null
        ? `selected ${decision.selectedSlot}`
        : `slot ${previous} -> ${decision.selectedSlot}`,
      {
        actorId: "companion",
        fields: {
          previous,
          selected: decision.selectedSlot,
          reason: decision.reason,
          targetX: compact(decision.target.x),
          targetY: compact(decision.target.y)
        }
      }
    );
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

    if (this.relationalDecision && this.companionMode === "relational") {
      channels.push({
        id: "brain",
        summary: `relationship slot ${this.relationalDecision.selectedSlot}`,
        fields: {
          selectedSlot: this.relationalDecision.selectedSlot,
          targetX: compact(this.relationalDecision.target.x),
          targetY: compact(this.relationalDecision.target.y),
          rethink: this.relationalDecision.reconsiderationCount,
          reason: this.relationalDecision.reason
        }
      });
    } else {
      channels.push({ id: "brain", summary: `${this.companionMode} baseline` });
    }

    const probe = this.directTraversalProbe;
    if (probe) {
      const blocker = probe.blocker;
      channels.push({
        id: "nav",
        summary: probe.clear ? "direct whole-body traversal clear" : `direct traversal blocked by ${blocker?.label ?? "unknown"}`,
        fields: {
          routeModel: "none",
          directTraversalKnown: true,
          directClear: probe.clear,
          distance: compact(probe.distance),
          radius: compact(probe.radius),
          targetX: compact(probe.to.x),
          targetY: compact(probe.to.y),
          blocker: blocker?.label ?? null,
          hitDistance: blocker ? compact(blocker.distance) : null,
          hitFraction: blocker ? compact(blocker.fraction) : null,
          hitX: blocker ? compact(blocker.hitCenter.x) : null,
          hitY: blocker ? compact(blocker.hitCenter.y) : null,
          contactX: blocker ? compact(blocker.contactPoint.x) : null,
          contactY: blocker ? compact(blocker.contactPoint.y) : null,
          normalX: blocker ? compact(blocker.normal.x) : null,
          normalY: blocker ? compact(blocker.normal.y) : null
        }
      });
    } else {
      channels.push({
        id: "nav",
        summary: this.companionMode === "manual" ? "manual mode has no navigation target" : "waiting for first navigation probe",
        fields: { routeModel: "none", directTraversalKnown: false }
      });
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

  private cycleCompanionMode(): void {
    const currentIndex = COMPANION_MODES.indexOf(this.companionMode);
    const next = COMPANION_MODES[(currentIndex + 1) % COMPANION_MODES.length];
    if (!next) throw new Error("Companion mode cycle produced no next mode.");
    const previous = this.companionMode;
    this.companionMode = next;
    this.relationalBrain.reset();
    this.relationalDecision = null;
    this.directTraversalProbe = null;
    this.lastBrainSlot = null;
    this.lastTraversalSignature = null;
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
      this.relationalBrain.reset();
      this.relationalDecision = null;
      this.directTraversalProbe = null;
      this.lastBrainSlot = null;
      this.lastTraversalSignature = null;
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

    if (visibility.brain && this.companionMode === "relational" && this.relationalDecision) {
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
          sx(companion.position.x),
          sy(companion.position.y),
          sx(this.relationalDecision.target.x),
          sy(this.relationalDecision.target.y)
        );
      }
      if (player) {
        this.graphics.lineStyle(2, 0x79c0ff, 0.9);
        this.graphics.lineBetween(
          sx(player.position.x),
          sy(player.position.y),
          sx(player.position.x + this.relationalDecision.playerDirection.x),
          sy(player.position.y + this.relationalDecision.playerDirection.y)
        );
      }
    }

    if (visibility.nav && this.directTraversalProbe) {
      const probe = this.directTraversalProbe;
      const corridorColor = probe.clear ? 0x3fb950 : 0xff7b72;
      const corridorWidth = Math.max(6, probe.radius * 2 * scale);
      this.graphics.lineStyle(corridorWidth, corridorColor, 0.12);
      this.graphics.lineBetween(sx(probe.from.x), sy(probe.from.y), sx(probe.to.x), sy(probe.to.y));
      this.graphics.lineStyle(3, corridorColor, 0.95);
      this.graphics.lineBetween(sx(probe.from.x), sy(probe.from.y), sx(probe.to.x), sy(probe.to.y));
      this.graphics.lineStyle(2, corridorColor, 0.9);
      this.graphics.strokeCircle(sx(probe.to.x), sy(probe.to.y), probe.radius * scale);

      const blocker = probe.blocker;
      if (blocker) {
        this.graphics.lineStyle(3, 0xff5d66, 1);
        this.graphics.strokeCircle(sx(blocker.hitCenter.x), sy(blocker.hitCenter.y), probe.radius * scale);
        this.graphics.fillStyle(0xffa657, 1);
        this.graphics.fillCircle(sx(blocker.contactPoint.x), sy(blocker.contactPoint.y), 5);
        this.graphics.lineStyle(3, 0x79c0ff, 1);
        this.graphics.lineBetween(
          sx(blocker.contactPoint.x),
          sy(blocker.contactPoint.y),
          sx(blocker.contactPoint.x + blocker.normal.x * 0.55),
          sy(blocker.contactPoint.y + blocker.normal.y * 0.55)
        );
      }
    }

    if (visibility.brain && this.companionMode === "chase") {
      const companion = snapshot.actors.find((entry) => entry.id === "companion");
      const player = snapshot.actors.find((entry) => entry.id === "player");
      if (companion && player) {
        this.graphics.lineStyle(2, 0xd29922, 0.8);
        this.graphics.lineBetween(sx(companion.position.x), sy(companion.position.y), sx(player.position.x), sy(player.position.y));
      }
    }

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
    const baseLines = [
      `S2-B · ${scenarioLabel} · tick ${snapshot.tick} · ${this.paused ? "PAUSED" : "RUNNING"} · companion ${this.companionMode.toUpperCase()} · debug ${this.debugWorkbench.preset().toUpperCase()}`,
      "WASD player · M mode · arrows manual companion · 1-4 scenarios · R reset · P pause · O step · B debug preset · I capture incident"
    ];
    if (this.incidentNotice) baseLines.push(this.incidentNotice);

    const debugLines: string[] = [];

    if (visibility.brain) {
      if (this.companionMode === "relational" && this.relationalDecision) {
        const scores = this.relationalDecision.candidates
          .map((candidate) => `${candidate.slot}:${candidate.valid ? candidate.score.toFixed(2) : "X"}`)
          .join("  ");
        debugLines.push(
          `BRAIN slot ${this.relationalDecision.selectedSlot} · rethink #${this.relationalDecision.reconsiderationCount} @ tick ${this.relationalDecision.reconsideredAtTick}`,
          `BRAIN reason: ${this.relationalDecision.reason}`,
          `BRAIN candidates: ${scores}`
        );
      } else if (this.companionMode === "chase") {
        debugLines.push("BRAIN CHASE baseline: direct center-seeking; no relational slot selection");
      } else {
        debugLines.push("BRAIN MANUAL baseline: arrow keys own companion intent");
      }
    }

    if (visibility.nav) {
      const probe = this.directTraversalProbe;
      if (!probe) {
        debugLines.push(
          this.companionMode === "manual"
            ? "NAV MANUAL: no autonomous navigation target"
            : "NAV waiting for first direct whole-body traversal probe",
          "NAV route model: NONE · dynamic cooperation/yielding: NOT MODELED"
        );
      } else if (probe.clear) {
        debugLines.push(
          `NAV direct whole-body: CLEAR · distance ${probe.distance.toFixed(2)} · radius ${probe.radius.toFixed(2)}`,
          `NAV target ${probe.to.x.toFixed(2)},${probe.to.y.toFixed(2)} · route model: NONE`,
          "NAV static feasibility only · dynamic cooperation/yielding: NOT MODELED"
        );
      } else {
        const blocker = probe.blocker;
        debugLines.push(
          `NAV direct whole-body: BLOCKED by ${blocker?.label ?? "unknown"}`,
          `NAV hit ${blocker?.distance.toFixed(2) ?? "?"}/${probe.distance.toFixed(2)} (${blocker ? (blocker.fraction * 100).toFixed(0) : "?"}%) · radius ${probe.radius.toFixed(2)}`,
          blocker
            ? `NAV hit-center ${blocker.hitCenter.x.toFixed(2)},${blocker.hitCenter.y.toFixed(2)} · contact ${blocker.contactPoint.x.toFixed(2)},${blocker.contactPoint.y.toFixed(2)} · normal ${blocker.normal.x.toFixed(2)},${blocker.normal.y.toFixed(2)}`
            : "NAV blocker geometry unavailable",
          "NAV route model: NONE · next stage must find an alternate static route"
        );
      }
    }

    if (visibility.motion) {
      debugLines.push("MOTION green=requested velocity · red=actual velocity · red body outline=contact", ...actorLines);
    }

    if (visibility.events) {
      const events = this.researchTrace.recentEvents(5);
      debugLines.push(`EVENTS trace ${this.researchTrace.sampleCount()} samples / ${this.researchTrace.eventCount()} events`);
      for (const event of events) debugLines.push(`  t${event.tick} ${event.kind}: ${event.summary}`);
    }

    this.hud.setVisible(true).setText([...baseLines, ...debugLines]);
  }
}
