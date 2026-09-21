import Phaser from "phaser";
import { SquadFieldLabHud } from "./squad-field-lab-hud";
import { SquadFieldLabPanel } from "../debug/squad-field-lab-panel";
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
  ActorSnapshot,
  ExperimentalSquadMotionIntent,
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

function axis(negative: Phaser.Input.Keyboard.Key, positive: Phaser.Input.Keyboard.Key): number {
  return (positive.isDown ? 1 : 0) - (negative.isDown ? 1 : 0);
}

function normalizedMotion(x: number, y: number): Vec2 {
  const length = Math.hypot(x, y);
  return length > 1 ? { x: x / length, y: y / length } : { x, y };
}

function actor(snapshot: WorldSnapshot, id: SquadMemberId | "player"): ActorSnapshot {
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
  responsiveness: number
): Vec2 {
  const delta = { x: target.x - from.x, y: target.y - from.y };
  const d = Math.hypot(delta.x, delta.y);
  if (d <= tolerance) return { x: 0, y: 0 };
  const direction = { x: delta.x / d, y: delta.y / d };
  const slowdownRadius = Math.max(tolerance * 4, 0.6);
  const proximityThrottle = Math.min(1, d / slowdownRadius);
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

export class SquadFieldLabScene extends Phaser.Scene {
  private world: LabWorld | null = null;
  private snapshotValue: WorldSnapshot | null = null;
  private graphics!: Phaser.GameObjects.Graphics;
  private hud!: SquadFieldLabHud;
  private panel!: SquadFieldLabPanel;
  private readonly control = new FieldLabSquadControl();
  private readonly labels = new Map<SquadMemberId, Phaser.GameObjects.Text>();
  private playerLabel!: Phaser.GameObjects.Text;

  private accumulator = 0;
  private paused = false;
  private singleStepQueued = false;
  private loading = false;
  private timeScaleIndex = 1;
  private transform: RenderTransform = { scale: 1, offsetX: 0, offsetY: 0 };
  private draggingSlot: SquadMemberId | null = null;
  private readonly eventLog: string[] = [];

  private keys!: Record<
    "w" | "a" | "s" | "d" | "up" | "down" | "left" | "right" |
    "tab" | "direct" | "reset" | "pause" | "step" | "time" |
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
      onResponsiveness: (value) => this.control.setResponsiveness(value),
      onTolerance: (value) => this.control.setSlotTolerance(value)
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
      Phaser.Input.Keyboard.KeyCodes.RIGHT
    ]);

    this.input.mouse?.disableContextMenu();
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => this.onPointerDown(pointer));
    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => this.onPointerMove(pointer));
    this.input.on("pointerup", () => {
      if (this.draggingSlot) this.log(`slot edit end ${memberLabel(this.draggingSlot)}`);
      this.draggingSlot = null;
    });

    void this.loadWorld();
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
    for (const memberId of FIELD_LAB_SQUAD_MEMBERS) {
      const body = actor(before, memberId);
      const target = this.control.targetFor(memberId, player.position);
      if (target.authority === "DIRECT") {
        memberMoves.set(memberId, directMove);
      } else if (target.target) {
        memberMoves.set(
          memberId,
          clampMoveToward(
            body.position,
            target.target,
            control.dynamics.slotTolerance,
            control.dynamics.responsiveness
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
    const experimentalSquadMotionIntents: ExperimentalSquadMotionIntent[] = [
      { bodyId: "squad-2", move: memberMoves.get("squad-2") ?? { x: 0, y: 0 } },
      { bodyId: "squad-3", move: memberMoves.get("squad-3") ?? { x: 0, y: 0 } },
      { bodyId: "squad-4", move: memberMoves.get("squad-4") ?? { x: 0, y: 0 } }
    ];

    this.snapshotValue = this.world.stepSituation({
      motionIntents: canonicalIntents,
      experimentalSquadMotionIntents
    }).snapshot;
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
    for (const [key, memberId] of [
      [this.keys.one, "companion"],
      [this.keys.two, "squad-2"],
      [this.keys.three, "squad-3"],
      [this.keys.four, "squad-4"]
    ] as const) {
      if (Phaser.Input.Keyboard.JustDown(key)) {
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
      void this.loadWorld();
    }
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
    for (const memberId of FIELD_LAB_SQUAD_MEMBERS) {
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
    for (const memberId of FIELD_LAB_SQUAD_MEMBERS) {
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

    const control = this.control.snapshot();
    const player = actor(snapshot, "player");

    // Formation truth first: selected members get strong editable handles;
    // non-selected slots remain faint so the whole squad stays legible.
    for (const memberId of FIELD_LAB_SQUAD_MEMBERS) {
      const target = this.control.targetFor(memberId, player.position);
      if (!target.target) continue;
      const selected = control.selected.includes(memberId);
      const tx = sx(target.target.x);
      const ty = sy(target.target.y);
      const color = selected ? 0x58a6ff : 0x6e7681;
      const alpha = selected ? 0.95 : 0.28;
      this.graphics.lineStyle(selected ? 3 : 1, color, alpha);
      this.graphics.strokeCircle(tx, ty, selected ? 10 : 7);
      this.graphics.lineBetween(tx - 5, ty, tx + 5, ty);
      this.graphics.lineBetween(tx, ty - 5, tx, ty + 5);

      if (selected) {
        const body = actor(snapshot, memberId);
        this.graphics.lineStyle(2, color, 0.38);
        this.graphics.lineBetween(sx(body.position.x), sy(body.position.y), tx, ty);
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

      const label = this.labels.get(memberId);
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
    this.hud.update({ control: state });
    const focusedBody = actor(snapshot, state.focused);
    const player = actor(snapshot, "player");
    const focusedTarget = this.control.targetFor(state.focused, player.position);
    this.panel.update({
      snapshot,
      control: state,
      focusedBody,
      focusedTarget,
      recentEvents: this.eventLog
    });
  }

  private log(value: string): void {
    const tick = this.snapshotValue?.tick ?? 0;
    this.eventLog.push(`t${tick} · ${value}`);
    if (this.eventLog.length > 80) this.eventLog.splice(0, this.eventLog.length - 80);
  }

  private async loadWorld(): Promise<void> {
    if (this.loading) return;
    this.loading = true;
    const previous = this.world;
    try {
      const next = await LabWorld.create("squad-field-lab");
      previous?.dispose();
      this.world = next;
      this.snapshotValue = next.snapshot();
      this.accumulator = 0;
      this.singleStepQueued = false;
      this.draggingSlot = null;
      this.log("Field Lab world reconstructed · squad control state preserved");
      this.drawWorld(this.snapshotValue);
      this.updateUi(this.snapshotValue);
    } finally {
      this.loading = false;
    }
  }
}
