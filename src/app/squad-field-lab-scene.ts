import Phaser from "phaser";
import { SquadFieldLabHud } from "./squad-field-lab-hud";
import {
  createFieldLabExperiment,
  decodeFieldLabExperiment,
  diffFieldLabExperiments,
  encodeFieldLabExperiment,
  fieldLabExperimentStorageKey,
  renameFieldLabExperiment,
  type FieldLabExperimentRecord,
  type FieldLabExperimentSlot
} from "../squad/field-lab-experiment";
import { SquadFieldLabPanel, type FieldLabMemberStatus } from "../debug/squad-field-lab-panel";
import {
  FIELD_LAB_TRIAL_MAX_FRAMES,
  classifyFieldLabTrialMember,
  compareFieldLabTrials,
  createFieldLabTrialFrame,
  createFieldLabTrialRecord,
  summarizeFieldLabTrial,
  type FieldLabTrialComparison,
  type FieldLabTrialFrame,
  type FieldLabTrialRecord,
  type FieldLabTrialSlot,
  type FieldLabTrialSummary
} from "../squad/field-lab-trial";
import {
  FIELD_LAB_SQUAD_MEMBERS,
  FieldLabSquadControl,
  inverseRotateFieldLabVector,
  rotateFieldLabVector,
  type FieldLabFormationPreset,
  type FieldLabMemberTarget,
  type SquadOrderMode
} from "../squad/field-lab-squad-control";
import { S0_STEP_SECONDS } from "../physics/rapier-physical-world";
import { LabWorld } from "../world/world";
import type {
  CooperativeEpisodeActionAttempt,
  CooperativeEpisodeActionOutcome,
  CooperativeEpisodeOutcome,
  CooperativeEpisodeParticipantId,
  CooperativeEpisodeSnapshot
} from "../world/cooperative-episode-contract";
import { squadFieldLabScenario, type FieldLabSpawnOverrides } from "../world/scenarios";
import type {
  ActorSnapshot,
  ExperimentalSquadMotionIntent,
  FieldLabLayout,
  FieldLabSituation,
  MotionIntent,
  SquadMemberId,
  Vec2,
  WorldSnapshot
} from "../world/types";

const VIEW_WIDTH = 1200;
const VIEW_HEIGHT = 800;
const MAX_FRAME_SECONDS = 0.1;
const TIME_SCALES = [0.5, 1, 2] as const;
const MEMBER_COLORS: Readonly<Record<SquadMemberId, number>> = {
  companion: 0xf2c15c,
  "squad-2": 0xe3b341,
  "squad-3": 0xd29922,
  "squad-4": 0xffc680
};

interface RenderTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

function cloneSpawnOverrides(value: FieldLabSpawnOverrides): FieldLabSpawnOverrides {
  const squad: Partial<Record<SquadMemberId, Vec2>> = {};
  for (const memberId of FIELD_LAB_SQUAD_MEMBERS) {
    const position = value.squad?.[memberId];
    if (position) squad[memberId] = { ...position };
  }
  return value.player
    ? { player: { ...value.player }, squad }
    : { squad };
}

function axis(negative: Phaser.Input.Keyboard.Key, positive: Phaser.Input.Keyboard.Key): number {
  return (positive.isDown ? 1 : 0) - (negative.isDown ? 1 : 0);
}

function normalizedMotion(x: number, y: number): Vec2 {
  const length = Math.hypot(x, y);
  return length > 1 ? { x: x / length, y: y / length } : { x, y };
}

function actor(snapshot: WorldSnapshot, id: SquadMemberId | "player" | "hostile"): ActorSnapshot {
  const value = snapshot.actors.find((entry) => entry.id === id);
  if (!value) throw new Error(`Squad Field Lab missing body: ${id}`);
  return value;
}

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clampMoveToward(
  from: Vec2,
  target: Vec2,
  tolerance: number,
  responsiveness: number,
  slowdownRadius: number
): Vec2 {
  const delta = { x: target.x - from.x, y: target.y - from.y };
  const d = Math.hypot(delta.x, delta.y);
  if (d <= tolerance) return { x: 0, y: 0 };
  const direction = { x: delta.x / d, y: delta.y / d };
  const effectiveSlowdownRadius = Math.max(tolerance, slowdownRadius);
  const proximityThrottle = Math.min(1, d / effectiveSlowdownRadius);
  const throttle = Math.max(0.08, proximityThrottle * responsiveness);
  return {
    x: direction.x * throttle,
    y: direction.y * throttle
  };
}

function memberLabel(id: SquadMemberId): string {
  if (id === "companion") return "C1";
  if (id === "squad-2") return "C2";
  if (id === "squad-3") return "C3";
  return "C4";
}

function targetInsideWorld(snapshot: WorldSnapshot, body: ActorSnapshot, target: Vec2): boolean {
  return (
    target.x >= body.radius &&
    target.y >= body.radius &&
    target.x <= snapshot.width - body.radius &&
    target.y <= snapshot.height - body.radius
  );
}

function clampTargetToWorld(snapshot: WorldSnapshot, target: Vec2): Vec2 {
  return {
    x: Math.max(0.12, Math.min(snapshot.width - 0.12, target.x)),
    y: Math.max(0.12, Math.min(snapshot.height - 0.12, target.y))
  };
}

export class SquadFieldLabScene extends Phaser.Scene {
  private world: LabWorld | null = null;
  private snapshotValue: WorldSnapshot | null = null;
  private graphics!: Phaser.GameObjects.Graphics;
  private hud!: SquadFieldLabHud;
  private panel!: SquadFieldLabPanel;
  private readonly control = new FieldLabSquadControl();
  private readonly labels = new Map<SquadMemberId, Phaser.GameObjects.Text>();
  private playerLabel!: Phaser.GameObjects.Text;
  private hostileLabel!: Phaser.GameObjects.Text;

  private accumulator = 0;
  private paused = false;
  private singleStepQueued = false;
  private loading = false;
  private timeScaleIndex = 1;
  private transform: RenderTransform = { scale: 1, offsetX: 0, offsetY: 0 };
  private draggingSlot: SquadMemberId | null = null;
  private situation: FieldLabSituation = "TRAINING";
  private layout: FieldLabLayout = "MIXED";
  private cooperativeEpisode: CooperativeEpisodeSnapshot | null = null;
  private latestCooperativeEpisodeOutcome: CooperativeEpisodeOutcome = "NONE";
  private lastCooperativeActionOutcomes: readonly CooperativeEpisodeActionOutcome[] = [];
  private pendingCooperativeAttempts: CooperativeEpisodeActionAttempt[] = [];
  private positionMemory: FieldLabSpawnOverrides = { squad: {} };
  private readonly experiments = new Map<FieldLabExperimentSlot, FieldLabExperimentRecord>();
  private readonly trials = new Map<FieldLabTrialSlot, FieldLabTrialRecord>();
  private readonly trialSummaries = new Map<FieldLabTrialSlot, FieldLabTrialSummary>();
  private trialComparison: FieldLabTrialComparison | null = null;
  private activeTrial: {
    slot: FieldLabTrialSlot;
    label: string;
    startedAtTick: number;
    frames: FieldLabTrialFrame[];
  } | null = null;
  private readonly eventLog: string[] = [];

  private keys!: Record<
    "w" | "a" | "s" | "d" | "up" | "down" | "left" | "right" |
    "tab" | "direct" | "reset" | "pause" | "step" | "time" | "situation" |
    "playerAction" | "focusedAction" | "selectedAction" |
    "one" | "two" | "three" | "four",
    Phaser.Input.Keyboard.Key
  >;

  constructor() {
    super("squad-field-lab");
  }

  create(): void {
    this.graphics = this.add.graphics();

    this.playerLabel = this.add.text(0, 0, "YOU", {
      fontFamily: "ui-monospace, monospace",
      fontSize: "12px",
      color: "#9ecbff"
    }).setOrigin(0.5, 1.8).setDepth(4);

    this.hostileLabel = this.add.text(0, 0, "THREAT", {
      fontFamily: "ui-monospace, monospace",
      fontSize: "11px",
      color: "#ff9b5e"
    }).setOrigin(0.5, 1.9).setDepth(4).setVisible(false);

    for (const memberId of FIELD_LAB_SQUAD_MEMBERS) {
      const label = this.add.text(0, 0, memberLabel(memberId), {
        fontFamily: "ui-monospace, monospace",
        fontSize: "12px",
        color: "#ffe09a"
      }).setOrigin(0.5, 1.8).setDepth(4);
      this.labels.set(memberId, label);
    }

    this.panel = new SquadFieldLabPanel();
    this.hud = new SquadFieldLabHud({
      onSituation: (situation) => {
        if (this.situation === situation) return;
        const before = this.situation;
        this.situation = situation;
        this.log(`situation ${before} -> ${situation} · preserving squad control state`);
        void this.loadWorld(true);
      },
      onLayout: (layout) => {
        if (this.layout === layout) return;
        const before = this.layout;
        this.layout = layout;
        this.log(`layout ${before} -> ${layout} · preserving squad control state`);
        void this.loadWorld(true);
      },
      onSquadSize: (count) => {
        const before = this.control.snapshot().activeMembers.length;
        if (before === count) return;
        this.control.setActiveCount(count);
        this.log(`squad size ${before} -> ${count} · rebuilding real World roster`);
        void this.loadWorld(true);
      },
      onSelect: (memberId, additive) => {
        additive ? this.control.toggleSelected(memberId) : this.control.selectOnly(memberId);
        this.log(`${additive ? "toggle" : "select"} ${memberLabel(memberId)}`);
      },
      onSelectAll: () => {
        this.control.selectAll();
        this.log("select all squad members");
      },
      onCycleFocus: (direction) => {
        const next = this.control.cycleFocus(direction);
        this.log(`focus ${memberLabel(next.focused)}`);
      },
      onToggleDirect: () => {
        const before = this.control.snapshot().directControl;
        const next = this.control.setDirectControl(!before);
        this.log(`direct ${memberLabel(next.focused)} ${next.directControl ? "ON" : "off"}`);
      },
      onOrder: (mode) => this.issueOrderFromHud(mode),
      onPreset: (preset) => this.applyPreset(preset),
      onRotate: (delta) => {
        this.control.rotateBy(delta);
        this.log(`formation rotate ${Math.round(delta * 180 / Math.PI)}°`);
      },
      onSpacing: (value) => this.control.setSpacingScale(value),
      onGroupDynamics: (key, value) => {
        this.control.setGroupDynamics(key, value);
        this.log(`group dynamics ${key}=${value.toFixed(2)}`);
      },
      onSelectedDynamicsOverride: (key, value) => {
        this.control.setSelectedDynamicsOverride(key, value);
        this.log(
          `selected dynamics ${key}=${value.toFixed(2)} · ` +
          `${this.control.snapshot().selected.map(memberLabel).join("+")}`
        );
      },
      onClearSelectedDynamicsOverrides: () => {
        const selected = this.control.snapshot().selected.map(memberLabel).join("+");
        this.control.clearSelectedDynamicsOverrides();
        this.log(`selected dynamics inherit group · ${selected}`);
      },
      onCaptureExperiment: (slot) => this.captureExperiment(slot),
      onRestoreExperiment: (slot) => this.restoreExperiment(slot),
      onRenameExperiment: (slot, label) => this.renameExperiment(slot, label),
      onClearExperiment: (slot) => this.clearExperiment(slot),
      onToggleTrial: (slot) => void this.toggleTrial(slot),
      onClearTrial: (slot) => this.clearTrial(slot),
      onPlayerRepel: () => this.queueCooperativeAttempt("player"),
      onFocusedRepel: () => this.queueCooperativeAttempt(this.control.snapshot().focused),
      onSelectedRepel: () => {
        for (const memberId of this.control.snapshot().selected) {
          this.queueCooperativeAttempt(memberId);
        }
      }
    });

    const keyboard = this.input.keyboard;
    if (!keyboard) throw new Error("Squad Field Lab requires keyboard input.");
    this.keys = keyboard.addKeys({
      w: Phaser.Input.Keyboard.KeyCodes.W,
      a: Phaser.Input.Keyboard.KeyCodes.A,
      s: Phaser.Input.Keyboard.KeyCodes.S,
      d: Phaser.Input.Keyboard.KeyCodes.D,
      up: Phaser.Input.Keyboard.KeyCodes.UP,
      down: Phaser.Input.Keyboard.KeyCodes.DOWN,
      left: Phaser.Input.Keyboard.KeyCodes.LEFT,
      right: Phaser.Input.Keyboard.KeyCodes.RIGHT,
      tab: Phaser.Input.Keyboard.KeyCodes.TAB,
      direct: Phaser.Input.Keyboard.KeyCodes.F,
      reset: Phaser.Input.Keyboard.KeyCodes.R,
      pause: Phaser.Input.Keyboard.KeyCodes.P,
      step: Phaser.Input.Keyboard.KeyCodes.O,
      time: Phaser.Input.Keyboard.KeyCodes.T,
      situation: Phaser.Input.Keyboard.KeyCodes.G,
      playerAction: Phaser.Input.Keyboard.KeyCodes.E,
      focusedAction: Phaser.Input.Keyboard.KeyCodes.ENTER,
      selectedAction: Phaser.Input.Keyboard.KeyCodes.SPACE,
      one: Phaser.Input.Keyboard.KeyCodes.ONE,
      two: Phaser.Input.Keyboard.KeyCodes.TWO,
      three: Phaser.Input.Keyboard.KeyCodes.THREE,
      four: Phaser.Input.Keyboard.KeyCodes.FOUR
    }) as typeof this.keys;

    keyboard.addCapture([
      Phaser.Input.Keyboard.KeyCodes.TAB,
      Phaser.Input.Keyboard.KeyCodes.UP,
      Phaser.Input.Keyboard.KeyCodes.DOWN,
      Phaser.Input.Keyboard.KeyCodes.LEFT,
      Phaser.Input.Keyboard.KeyCodes.RIGHT,
      Phaser.Input.Keyboard.KeyCodes.SPACE,
      Phaser.Input.Keyboard.KeyCodes.ENTER
    ]);

    this.input.mouse?.disableContextMenu();
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => this.onPointerDown(pointer));
    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => this.onPointerMove(pointer));
    this.input.on("pointerup", () => {
      if (this.draggingSlot) this.log(`slot edit end ${memberLabel(this.draggingSlot)}`);
      this.draggingSlot = null;
    });

    this.loadPersistedExperiments();
    void this.loadWorld(false);
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
    this.updateUi(this.snapshotValue);
  }

  private stepWorld(): void {
    if (!this.world || !this.snapshotValue) return;
    const before = this.snapshotValue;
    const playerMove = normalizedMotion(
      axis(this.keys.a, this.keys.d),
      axis(this.keys.w, this.keys.s)
    );
    const directMove = normalizedMotion(
      axis(this.keys.left, this.keys.right),
      axis(this.keys.up, this.keys.down)
    );
    const control = this.control.snapshot();
    const player = actor(before, "player");

    const memberMoves = new Map<SquadMemberId, Vec2>();
    for (const memberId of control.activeMembers) {
      const body = actor(before, memberId);
      const target = this.control.targetFor(memberId, player.position);
      if (target.authority === "DIRECT") {
        memberMoves.set(memberId, directMove);
      } else if (target.target) {
        const dynamics = this.control.effectiveDynamicsFor(memberId);
        memberMoves.set(
          memberId,
          clampMoveToward(
            body.position,
            target.target,
            dynamics.slotTolerance,
            dynamics.responsiveness,
            dynamics.slowdownRadius
          )
        );
      } else {
        memberMoves.set(memberId, { x: 0, y: 0 });
      }
    }

    const canonicalIntents: MotionIntent[] = [
      { actorId: "player", move: playerMove },
      { actorId: "companion", move: memberMoves.get("companion") ?? { x: 0, y: 0 } }
    ];
    const experimentalSquadMotionIntents: ExperimentalSquadMotionIntent[] = control.activeMembers
      .filter((memberId): memberId is Exclude<SquadMemberId, "companion"> => memberId !== "companion")
      .map((bodyId) => ({
        bodyId,
        move: memberMoves.get(bodyId) ?? { x: 0, y: 0 }
      }));

    const cooperativeEpisodeAttempts =
      this.situation === "PRESSURE" ? this.pendingCooperativeAttempts.splice(0) : [];
    const result = this.world.stepSituation({
      motionIntents: canonicalIntents,
      experimentalSquadMotionIntents,
      cooperativeEpisodeAttempts
    });
    this.snapshotValue = result.snapshot;
    this.cooperativeEpisode = result.cooperativeEpisode;
    this.lastCooperativeActionOutcomes = result.cooperativeEpisodeActionOutcomes;
    this.latestCooperativeEpisodeOutcome = result.cooperativeEpisodeOutcome;
    this.recordActiveTrialFrame();

    for (const outcome of result.cooperativeEpisodeActionOutcomes) {
      this.log(
        `REPEL ${String(outcome.actorId)} -> ${outcome.status} @ ${outcome.distance.toFixed(2)}m`
      );
    }
    if (result.cooperativeEpisodeOutcome !== "NONE") {
      this.log(
        `pressure outcome ${result.cooperativeEpisodeOutcome} · ` +
        `repelled by ${result.cooperativeEpisode?.repelledBy.join(", ") || "none"}`
      );
    }
  }

  private handleKeyboard(): void {
    if (Phaser.Input.Keyboard.JustDown(this.keys.tab)) {
      const next = this.control.cycleFocus(1);
      this.log(`focus ${memberLabel(next.focused)}`);
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.direct)) {
      const state = this.control.snapshot();
      const next = this.control.setDirectControl(!state.directControl);
      this.log(`direct ${memberLabel(next.focused)} ${next.directControl ? "ON" : "off"}`);
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.situation)) {
      this.situation = this.situation === "TRAINING" ? "PRESSURE" : "TRAINING";
      this.log(`situation -> ${this.situation}`);
      void this.loadWorld(true);
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.playerAction)) {
      this.queueCooperativeAttempt("player");
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.focusedAction)) {
      this.queueCooperativeAttempt(this.control.snapshot().focused);
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.selectedAction)) {
      for (const memberId of this.control.snapshot().selected) {
        this.queueCooperativeAttempt(memberId);
      }
    }
    for (const [key, memberId] of [
      [this.keys.one, "companion"],
      [this.keys.two, "squad-2"],
      [this.keys.three, "squad-3"],
      [this.keys.four, "squad-4"]
    ] as const) {
      if (
        Phaser.Input.Keyboard.JustDown(key) &&
        this.control.snapshot().activeMembers.includes(memberId)
      ) {
        this.control.selectOnly(memberId);
        this.log(`select ${memberLabel(memberId)}`);
      }
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.pause)) {
      this.paused = !this.paused;
      this.accumulator = 0;
      this.log(this.paused ? "PAUSED" : "RUNNING");
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.step) && this.paused) {
      this.singleStepQueued = true;
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.time)) {
      this.timeScaleIndex = (this.timeScaleIndex + 1) % TIME_SCALES.length;
      this.log(`time ${TIME_SCALES[this.timeScaleIndex]}x`);
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.reset)) {
      this.log("authored position reset requested");
      void this.loadWorld(false);
    }
  }

  private queueCooperativeAttempt(actorId: CooperativeEpisodeParticipantId): void {
    if (this.situation !== "PRESSURE" || !this.cooperativeEpisode) {
      this.log(`REPEL ignored · pressure inactive · ${String(actorId)}`);
      return;
    }
    if (
      actorId !== "player" &&
      !this.control.snapshot().activeMembers.includes(actorId)
    ) {
      this.log(`REPEL ignored · inactive squad member ${String(actorId)}`);
      return;
    }
    if (this.pendingCooperativeAttempts.some((attempt) => attempt.actorId === actorId)) {
      return;
    }
    this.pendingCooperativeAttempts.push({
      actorId,
      kind: "REPEL",
      targetId: "hostile"
    });
    this.log(`REPEL queued · ${String(actorId)}`);
  }

  private issueOrderFromHud(mode: SquadOrderMode): void {
    if (!this.snapshotValue) return;
    if (mode === "FOLLOW") {
      this.control.issueSelected("FOLLOW");
      this.log(`selected → FOLLOW`);
      return;
    }
    if (mode === "HOLD") {
      const anchor = this.anchorThatPreservesSelectedCurrentPositions(this.snapshotValue);
      this.control.issueSelected("HOLD", anchor);
      this.log(`selected → HOLD @ ${anchor.x.toFixed(2)},${anchor.y.toFixed(2)}`);
    }
  }

  private applyPreset(preset: FieldLabFormationPreset): void {
    this.control.applyFormationPreset(preset);
    this.log(`formation preset generated ${preset} · slots remain editable`);
  }

  private anchorThatPreservesSelectedCurrentPositions(snapshot: WorldSnapshot): Vec2 {
    const state = this.control.snapshot();
    const spacing = state.dynamics.spacingScale;
    const selected = state.selected;
    const anchors = selected.map((memberId) => {
      const body = actor(snapshot, memberId);
      const slot = state.slots.find((value) => value.memberId === memberId);
      if (!slot) throw new Error(`Missing slot for ${memberId}`);
      const rotated = rotateFieldLabVector(
        { x: slot.offset.x * spacing, y: slot.offset.y * spacing },
        state.orientationRadians
      );
      return {
        x: body.position.x - rotated.x,
        y: body.position.y - rotated.y
      };
    });
    return {
      x: anchors.reduce((sum, value) => sum + value.x, 0) / anchors.length,
      y: anchors.reduce((sum, value) => sum + value.y, 0) / anchors.length
    };
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (!this.snapshotValue) return;
    const worldPoint = this.pointerToWorld(pointer);
    if (!worldPoint) return;

    if (pointer.rightButtonDown()) {
      this.control.issueSelected("MOVE", worldPoint);
      this.log(`selected → MOVE @ ${worldPoint.x.toFixed(2)},${worldPoint.y.toFixed(2)}`);
      return;
    }

    const slotMember = this.slotAt(worldPoint);
    if (slotMember) {
      this.draggingSlot = slotMember;
      this.control.focus(slotMember);
      this.log(`slot edit begin ${memberLabel(slotMember)}`);
      return;
    }

    const memberId = this.memberAt(worldPoint);
    if (memberId) {
      const additive = Boolean((pointer.event as PointerEvent | undefined)?.shiftKey);
      additive ? this.control.toggleSelected(memberId) : this.control.selectOnly(memberId);
      this.log(`${additive ? "toggle" : "select"} ${memberLabel(memberId)} from world`);
    }
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (!this.draggingSlot || !pointer.leftButtonDown() || !this.snapshotValue) return;
    const point = this.pointerToWorld(pointer);
    if (!point) return;

    const state = this.control.snapshot();
    const player = actor(this.snapshotValue, "player");
    const target = this.control.targetFor(this.draggingSlot, player.position);
    const delta = {
      x: point.x - target.worldAnchor.x,
      y: point.y - target.worldAnchor.y
    };
    const localScaled = inverseRotateFieldLabVector(delta, state.orientationRadians);
    const spacing = state.dynamics.spacingScale;
    this.control.setSlotOffset(this.draggingSlot, {
      x: localScaled.x / spacing,
      y: localScaled.y / spacing
    });
  }

  private memberAt(point: Vec2): SquadMemberId | null {
    if (!this.snapshotValue) return null;
    let best: { id: SquadMemberId; distance: number } | null = null;
    for (const memberId of this.control.snapshot().activeMembers) {
      const body = actor(this.snapshotValue, memberId);
      const d = distance(point, body.position);
      if (d <= body.radius + 0.18 && (!best || d < best.distance)) {
        best = { id: memberId, distance: d };
      }
    }
    return best?.id ?? null;
  }

  private slotAt(point: Vec2): SquadMemberId | null {
    if (!this.snapshotValue) return null;
    const player = actor(this.snapshotValue, "player");
    const selected = new Set(this.control.snapshot().selected);
    let best: { id: SquadMemberId; distance: number } | null = null;
    for (const memberId of this.control.snapshot().activeMembers) {
      if (!selected.has(memberId)) continue;
      const target = this.control.targetFor(memberId, player.position);
      if (!target.target) continue;
      const d = distance(point, target.target);
      if (d <= 0.24 && (!best || d < best.distance)) {
        best = { id: memberId, distance: d };
      }
    }
    return best?.id ?? null;
  }

  private pointerToWorld(pointer: Phaser.Input.Pointer): Vec2 | null {
    const { scale, offsetX, offsetY } = this.transform;
    if (scale <= 0) return null;
    return {
      x: (pointer.x - offsetX) / scale,
      y: (pointer.y - offsetY) / scale
    };
  }

  private drawWorld(snapshot: WorldSnapshot): void {
    const scale = Math.min(VIEW_WIDTH / snapshot.width, VIEW_HEIGHT / snapshot.height);
    const offsetX = (VIEW_WIDTH - snapshot.width * scale) / 2;
    const offsetY = (VIEW_HEIGHT - snapshot.height * scale) / 2;
    this.transform = { scale, offsetX, offsetY };
    const sx = (x: number) => offsetX + x * scale;
    const sy = (y: number) => offsetY + y * scale;

    this.graphics.clear();
    this.graphics.fillStyle(0x111820, 1).fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
    this.graphics.lineStyle(2, 0x55606f, 1)
      .strokeRect(offsetX, offsetY, snapshot.width * scale, snapshot.height * scale);

    this.graphics.fillStyle(0x343d49, 1);
    for (const obstacle of snapshot.obstacles) {
      this.graphics.fillRect(
        sx(obstacle.x),
        sy(obstacle.y),
        obstacle.width * scale,
        obstacle.height * scale
      );
    }

    this.drawCooperativePressure(snapshot, sx, sy, scale);

    const control = this.control.snapshot();
    const player = actor(snapshot, "player");

    // Formation truth first: selected members get strong editable handles;
    // non-selected slots remain faint so the whole squad stays legible.
    for (const memberId of control.activeMembers) {
      const target = this.control.targetFor(memberId, player.position);
      if (!target.target) continue;
      const selected = control.selected.includes(memberId);
      const body = actor(snapshot, memberId);
      const validTarget = targetInsideWorld(snapshot, body, target.target);
      const displayTarget = validTarget
        ? target.target
        : clampTargetToWorld(snapshot, target.target);
      const tx = sx(displayTarget.x);
      const ty = sy(displayTarget.y);
      const color = !validTarget ? 0xff5d66 : selected ? 0x58a6ff : 0x6e7681;
      const alpha = selected || !validTarget ? 0.95 : 0.28;
      this.graphics.lineStyle(selected ? 3 : 1, color, alpha);
      this.graphics.strokeCircle(tx, ty, selected ? 10 : 7);
      this.graphics.lineBetween(tx - 5, ty, tx + 5, ty);
      this.graphics.lineBetween(tx, ty - 5, tx, ty + 5);

      if (selected) {
        this.graphics.lineStyle(2, color, validTarget ? 0.38 : 0.72);
        this.graphics.lineBetween(sx(body.position.x), sy(body.position.y), tx, ty);
      }
      if (!validTarget) {
        this.graphics.lineStyle(4, 0xff5d66, 0.9);
        this.graphics.lineBetween(tx - 7, ty - 7, tx + 7, ty + 7);
        this.graphics.lineBetween(tx - 7, ty + 7, tx + 7, ty - 7);
      }
    }

    // Selected world anchors show which part of the squad is following the
    // player vs obeying an independent MOVE/HOLD responsibility point.
    const drawnAnchors = new Set<string>();
    for (const memberId of control.selected) {
      const target = this.control.targetFor(memberId, player.position);
      const key = `${target.orderMode}:${target.worldAnchor.x.toFixed(2)}:${target.worldAnchor.y.toFixed(2)}`;
      if (drawnAnchors.has(key)) continue;
      drawnAnchors.add(key);
      const ax = sx(target.worldAnchor.x);
      const ay = sy(target.worldAnchor.y);
      this.graphics.lineStyle(2, target.orderMode === "FOLLOW" ? 0x7ee787 : 0xbc8cff, 0.8);
      this.graphics.strokeCircle(ax, ay, 14);
    }

    const playerBody = actor(snapshot, "player");
    this.graphics.fillStyle(0x63a8ff, 1);
    this.graphics.fillCircle(sx(playerBody.position.x), sy(playerBody.position.y), playerBody.radius * scale);
    this.graphics.lineStyle(3, 0xe7e9ee, 0.95);
    this.graphics.strokeCircle(sx(playerBody.position.x), sy(playerBody.position.y), playerBody.radius * scale);
    this.playerLabel.setPosition(sx(playerBody.position.x), sy(playerBody.position.y));

    for (const memberId of FIELD_LAB_SQUAD_MEMBERS) {
      const label = this.labels.get(memberId);
      const active = control.activeMembers.includes(memberId);
      label?.setVisible(active);
      if (!active) continue;
      const body = actor(snapshot, memberId);
      const selected = control.selected.includes(memberId);
      const focused = control.focused === memberId;
      const direct = control.directControl && focused;

      this.graphics.fillStyle(MEMBER_COLORS[memberId], 1);
      this.graphics.fillCircle(sx(body.position.x), sy(body.position.y), body.radius * scale);
      this.graphics.lineStyle(3, selected ? 0x58a6ff : 0xe7e9ee, selected ? 1 : 0.72);
      this.graphics.strokeCircle(sx(body.position.x), sy(body.position.y), body.radius * scale);

      if (selected) {
        this.graphics.lineStyle(focused ? 4 : 2, focused ? 0xffffff : 0x58a6ff, 0.95);
        this.graphics.strokeCircle(
          sx(body.position.x),
          sy(body.position.y),
          body.radius * scale + (focused ? 10 : 6)
        );
      }
      if (direct) {
        this.graphics.lineStyle(3, 0xff7bff, 0.95);
        this.graphics.strokeCircle(sx(body.position.x), sy(body.position.y), body.radius * scale + 16);
      }

      label?.setPosition(sx(body.position.x), sy(body.position.y));
      label?.setColor(focused ? "#ffffff" : "#ffe09a");
    }

    // Orientation handle from player gives a world-readable formation frame.
    const orientation = {
      x: Math.cos(control.orientationRadians),
      y: Math.sin(control.orientationRadians)
    };
    this.graphics.lineStyle(3, 0x7ee787, 0.7);
    this.graphics.lineBetween(
      sx(player.position.x),
      sy(player.position.y),
      sx(player.position.x + orientation.x * 1.0),
      sy(player.position.y + orientation.y * 1.0)
    );
  }

  private updateUi(snapshot: WorldSnapshot): void {
    const state = this.control.snapshot();
    const experimentA = this.experiments.get("A") ?? null;
    const experimentB = this.experiments.get("B") ?? null;
    const experimentDiff = experimentA && experimentB
      ? diffFieldLabExperiments(experimentA, experimentB)
      : null;
    const experimentSummaries: Partial<Record<FieldLabExperimentSlot, {
      label: string;
      capturedAtTick: number;
    }>> = {};
    for (const slot of ["A", "B"] as const) {
      const record = this.experiments.get(slot);
      if (record) {
        experimentSummaries[slot] = {
          label: record.label,
          capturedAtTick: record.capturedAtTick
        };
      }
    }

    this.hud.update({
      control: state,
      situation: this.situation,
      layout: this.layout,
      episode: this.cooperativeEpisode,
      latestEpisodeOutcome: this.latestCooperativeEpisodeOutcome,
      experiments: experimentSummaries,
      experimentDiff,
      trials: {
        A: this.trialSummaries.get("A"),
        B: this.trialSummaries.get("B")
      },
      activeTrial: this.activeTrial
        ? { slot: this.activeTrial.slot, frameCount: this.activeTrial.frames.length }
        : null,
      trialComparison: this.trialComparison
    });
    const focusedBody = actor(snapshot, state.focused);
    const player = actor(snapshot, "player");
    const focusedTarget = this.control.targetFor(state.focused, player.position);
    const memberStatuses = {} as Record<SquadMemberId, FieldLabMemberStatus>;
    for (const memberId of FIELD_LAB_SQUAD_MEMBERS) {
      if (!state.activeMembers.includes(memberId)) {
        memberStatuses[memberId] = "ARRIVED";
        continue;
      }
      const body = actor(snapshot, memberId);
      const target = this.control.targetFor(memberId, player.position);
      const dynamics = this.control.effectiveDynamicsFor(memberId);
      memberStatuses[memberId] = classifyFieldLabTrialMember({
        body,
        target,
        targetValid: Boolean(target.target && targetInsideWorld(snapshot, body, target.target)),
        slotTolerance: dynamics.slotTolerance
      });
    }
    this.panel.update({
      snapshot,
      situation: this.situation,
      layout: this.layout,
      control: state,
      focusedBody,
      focusedTarget,
      memberStatuses,
      cooperativeEpisode: this.cooperativeEpisode,
      cooperativeEpisodeOutcome: this.latestCooperativeEpisodeOutcome,
      cooperativeActionOutcomes: this.lastCooperativeActionOutcomes,
      experiments: { A: experimentA, B: experimentB },
      experimentDiff,
      trials: {
        A: this.trialSummaries.get("A"),
        B: this.trialSummaries.get("B")
      },
      activeTrial: this.activeTrial
        ? { slot: this.activeTrial.slot, frameCount: this.activeTrial.frames.length }
        : null,
      trialComparison: this.trialComparison,
      recentEvents: this.eventLog
    });
  }

  private drawCooperativePressure(
    snapshot: WorldSnapshot,
    sx: (x: number) => number,
    sy: (y: number) => number,
    scale: number
  ): void {
    const episode = this.cooperativeEpisode;
    const hostile = snapshot.actors.find((entry) => entry.id === "hostile");
    if (!episode || !hostile) {
      this.hostileLabel.setVisible(false);
      return;
    }

    const x = sx(hostile.position.x);
    const y = sy(hostile.position.y);
    const bodyR = hostile.radius * scale;
    const threatColor = episode.phase === "PRESSURING" ? 0xff5d66 : 0xff9b5e;

    this.hostileLabel.setVisible(true);
    this.hostileLabel.setPosition(x, y);
    this.hostileLabel.setColor(episode.phase === "PRESSURING" ? "#ff7b72" : "#ffb07a");

    this.graphics.fillStyle(
      episode.phase === "DRIVEN_BACK" && episode.lastOutcome === "REPELLED"
        ? 0x7ee787
        : episode.phase === "CALM"
          ? 0x6e7681
          : threatColor,
      1
    );
    this.graphics.fillCircle(x, y, bodyR);
    this.graphics.lineStyle(3, 0xf0f6fc, 0.82);
    this.graphics.strokeCircle(x, y, bodyR);

    if (episode.phase === "APPROACHING" || episode.phase === "PRESSURING") {
      this.graphics.lineStyle(3, threatColor, 0.9);
      for (let index = 0; index < 8; index += 1) {
        const angle = (Math.PI * 2 * index) / 8;
        const dx = Math.cos(angle);
        const dy = Math.sin(angle);
        this.graphics.lineBetween(
          x + dx * bodyR * 1.15,
          y + dy * bodyR * 1.15,
          x + dx * bodyR * 1.55,
          y + dy * bodyR * 1.55
        );
      }
    }

    if (episode.phase === "PRESSURING") {
      const player = actor(snapshot, "player");
      this.graphics.lineStyle(4, 0xff5d66, 0.72);
      this.graphics.lineBetween(x, y, sx(player.position.x), sy(player.position.y));
      const progress = Math.max(0, Math.min(1, episode.phaseTicksRemaining / 72));
      this.graphics.lineStyle(3, 0xff5d66, 0.7);
      this.graphics.strokeCircle(x, y, bodyR * (1.8 + (1 - progress) * 1.5));
    }

    if (episode.phase === "DRIVEN_BACK" && episode.lastOutcome === "REPELLED") {
      const r = bodyR * 1.65;
      this.graphics.lineStyle(5, 0x7ee787, 0.95);
      this.graphics.lineBetween(x - r, y - r, x + r, y + r);
      this.graphics.lineBetween(x - r, y + r, x + r, y - r);
      for (const contributor of episode.repelledBy) {
        const source = snapshot.actors.find((entry) => entry.id === contributor);
        if (!source) continue;
        this.graphics.lineStyle(3, 0x7ee787, 0.86);
        this.graphics.lineBetween(sx(source.position.x), sy(source.position.y), x, y);
      }
    }

    if (episode.phase === "DRIVEN_BACK" && episode.lastOutcome === "PLAYER_HIT") {
      const player = actor(snapshot, "player");
      const px = sx(player.position.x);
      const py = sy(player.position.y);
      const r = player.radius * scale * 2.0;
      this.graphics.lineStyle(5, 0xff5d66, 0.92);
      this.graphics.strokeCircle(px, py, r);
      this.graphics.lineBetween(px - r, py, px + r, py);
      this.graphics.lineBetween(px, py - r, px, py + r);
    }
  }

  private currentPositions(): FieldLabSpawnOverrides {
    if (!this.snapshotValue) return cloneSpawnOverrides(this.positionMemory);
    const squad: Partial<Record<SquadMemberId, Vec2>> = {};
    for (const memberId of FIELD_LAB_SQUAD_MEMBERS) {
      const body = this.snapshotValue.actors.find((entry) => entry.id === memberId);
      if (body) squad[memberId] = { ...body.position };
    }
    const playerBody = this.snapshotValue.actors.find((entry) => entry.id === "player");
    return playerBody
      ? { player: { ...playerBody.position }, squad }
      : { squad };
  }

  private rememberCurrentPositions(): void {
    this.positionMemory = this.currentPositions();
  }

  private loadPersistedExperiments(): void {
    for (const slot of ["A", "B"] as const) {
      const raw = window.localStorage.getItem(fieldLabExperimentStorageKey(slot));
      if (!raw) continue;
      try {
        const record = decodeFieldLabExperiment(raw);
        this.experiments.set(slot, record);
        this.log(`loaded persistent setup ${slot} · ${record.label || "unlabelled"}`);
      } catch (error) {
        window.localStorage.removeItem(fieldLabExperimentStorageKey(slot));
        this.log(
          `discarded invalid persistent setup ${slot} · ` +
          `${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  }

  private persistExperiment(slot: FieldLabExperimentSlot): void {
    const record = this.experiments.get(slot);
    if (!record) {
      window.localStorage.removeItem(fieldLabExperimentStorageKey(slot));
      return;
    }
    window.localStorage.setItem(
      fieldLabExperimentStorageKey(slot),
      encodeFieldLabExperiment(record)
    );
  }

  private captureExperiment(slot: FieldLabExperimentSlot): void {
    if (!this.snapshotValue || this.loading) {
      this.log(`capture ${slot} ignored · World unavailable`);
      return;
    }
    const existing = this.experiments.get(slot);
    const record = createFieldLabExperiment({
      label: existing?.label || `Setup ${slot}`,
      capturedAtTick: this.snapshotValue.tick,
      situation: this.situation,
      layout: this.layout,
      control: this.control.snapshot(),
      positions: this.currentPositions()
    });
    this.experiments.set(slot, record);
    this.persistExperiment(slot);
    this.log(
      `captured persistent setup ${slot} · ${record.setup.situation}/${record.setup.layout} · ` +
      `squad ${record.setup.control.activeMembers.length} · tick ${record.capturedAtTick}`
    );
  }

  private renameExperiment(slot: FieldLabExperimentSlot, label: string): void {
    const existing = this.experiments.get(slot);
    if (!existing) return;
    const renamed = renameFieldLabExperiment(existing, label);
    this.experiments.set(slot, renamed);
    this.persistExperiment(slot);
    this.log(`renamed setup ${slot} · ${renamed.label || "unlabelled"}`);
  }

  private clearExperiment(slot: FieldLabExperimentSlot): void {
    if (!this.experiments.delete(slot)) return;
    this.persistExperiment(slot);
    this.log(`cleared persistent setup ${slot}`);
  }

  private restoreExperiment(slot: FieldLabExperimentSlot): void {
    const record = this.experiments.get(slot);
    if (!record || this.loading) {
      this.log(`restore ${slot} ignored · setup unavailable`);
      return;
    }
    this.control.restore(record.setup.control);
    this.situation = record.setup.situation;
    this.layout = record.setup.layout;
    this.log(
      `restore persistent setup ${slot} · ${record.label || "unlabelled"} · ` +
      `${record.setup.situation}/${record.setup.layout}`
    );
    void this.loadWorld(false, record.setup.positions);
  }

  private async toggleTrial(slot: FieldLabTrialSlot): Promise<void> {
    if (this.activeTrial?.slot === slot) {
      this.stopTrial("manual stop");
      return;
    }
    if (this.loading) {
      this.log(`trial ${slot} ignored · World loading`);
      return;
    }
    if (this.activeTrial) {
      this.stopTrial(`switch to ${slot}`);
    }

    const setup = this.experiments.get(slot);
    if (!setup) {
      this.log(`trial ${slot} ignored · capture setup ${slot} first`);
      return;
    }

    this.control.restore(setup.setup.control);
    this.situation = setup.setup.situation;
    this.layout = setup.setup.layout;
    await this.loadWorld(false, setup.setup.positions);
    if (!this.snapshotValue) {
      this.log(`trial ${slot} ignored · restored World unavailable`);
      return;
    }

    this.activeTrial = {
      slot,
      label: setup.label || `Setup ${slot}`,
      startedAtTick: this.snapshotValue.tick,
      frames: []
    };
    this.log(
      `trial ${slot} recording started · restored ${setup.label || "unlabelled"} · ` +
      `${setup.setup.situation}/${setup.setup.layout}`
    );
  }

  private stopTrial(reason: string): void {
    const active = this.activeTrial;
    if (!active) return;
    this.activeTrial = null;
    if (active.frames.length === 0) {
      this.log(`trial ${active.slot} discarded empty · ${reason}`);
      return;
    }

    const record = createFieldLabTrialRecord({
      slot: active.slot,
      label: active.label,
      startedAtTick: active.startedAtTick,
      frames: active.frames
    });
    this.trials.set(active.slot, record);
    this.trialSummaries.set(active.slot, summarizeFieldLabTrial(record));
    const a = this.trials.get("A");
    const b = this.trials.get("B");
    this.trialComparison = a && b ? compareFieldLabTrials(a, b) : null;
    this.log(
      `trial ${active.slot} captured · ${record.frames.length} ticks · ${reason}`
    );
  }

  private clearTrial(slot: FieldLabTrialSlot): void {
    if (this.activeTrial?.slot === slot) {
      this.activeTrial = null;
    }
    this.trials.delete(slot);
    this.trialSummaries.delete(slot);
    const a = this.trials.get("A");
    const b = this.trials.get("B");
    this.trialComparison = a && b ? compareFieldLabTrials(a, b) : null;
    this.log(`cleared trial trace ${slot}`);
  }

  private recordActiveTrialFrame(): void {
    const active = this.activeTrial;
    const snapshot = this.snapshotValue;
    if (!active || !snapshot) return;

    const control = this.control.snapshot();
    const player = actor(snapshot, "player");
    const members = control.activeMembers.map((memberId) => {
      const body = actor(snapshot, memberId);
      const target = this.control.targetFor(memberId, player.position);
      const dynamics = this.control.effectiveDynamicsFor(memberId);
      return {
        memberId,
        body,
        target,
        targetValid: Boolean(
          target.target && targetInsideWorld(snapshot, body, target.target)
        ),
        slotTolerance: dynamics.slotTolerance
      };
    });

    active.frames.push(createFieldLabTrialFrame({
      tick: snapshot.tick,
      playerPosition: player.position,
      cooperativeOutcome: this.latestCooperativeEpisodeOutcome,
      members
    }));

    if (active.frames.length >= FIELD_LAB_TRIAL_MAX_FRAMES) {
      this.stopTrial(`automatic ${FIELD_LAB_TRIAL_MAX_FRAMES}-tick bound`);
    }
  }

  private log(value: string): void {
    const tick = this.snapshotValue?.tick ?? 0;
    this.eventLog.push(`t${tick} · ${value}`);
    if (this.eventLog.length > 80) this.eventLog.splice(0, this.eventLog.length - 80);
  }

  private async loadWorld(
    preservePositions: boolean,
    restoredPositions?: FieldLabSpawnOverrides
  ): Promise<void> {
    if (this.loading) return;
    if (this.activeTrial) {
      this.stopTrial("World reconstruction");
    }
    if (restoredPositions) {
      this.positionMemory = cloneSpawnOverrides(restoredPositions);
    } else if (preservePositions) {
      this.rememberCurrentPositions();
    } else {
      this.positionMemory = { squad: {} };
    }
    this.loading = true;
    const previous = this.world;
    try {
      const next = await LabWorld.createFromSpec(
        squadFieldLabScenario(
          this.control.snapshot().activeMembers,
          this.situation,
          this.layout,
          this.positionMemory
        )
      );
      previous?.dispose();
      this.world = next;
      this.snapshotValue = next.snapshot();
      this.accumulator = 0;
      this.singleStepQueued = false;
      this.draggingSlot = null;
      this.pendingCooperativeAttempts = [];
      this.lastCooperativeActionOutcomes = [];
      this.latestCooperativeEpisodeOutcome = "NONE";
      this.cooperativeEpisode = next.cooperativeEpisode();
      this.log(
        `Field Lab world reconstructed · ${this.situation}/${this.layout} · ` +
        `${restoredPositions ? "persistent experiment setup restored" : preservePositions ? "positions + control preserved" : "authored default positions"}`
      );
      this.drawWorld(this.snapshotValue);
      this.updateUi(this.snapshotValue);
    } finally {
      this.loading = false;
    }
  }
}
