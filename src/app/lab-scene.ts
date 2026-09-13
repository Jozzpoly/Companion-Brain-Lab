import Phaser from "phaser";
import { S0_STEP_SECONDS } from "../physics/rapier-physical-world";
import { SCENARIOS } from "../world/scenarios";
import type { MotionIntent, ScenarioId, Vec2, WorldSnapshot } from "../world/types";
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

export class LabScene extends Phaser.Scene {
  private world: LabWorld | null = null;
  private snapshotValue: WorldSnapshot | null = null;
  private graphics!: Phaser.GameObjects.Graphics;
  private hud!: Phaser.GameObjects.Text;
  private accumulator = 0;
  private paused = false;
  private debug = true;
  private loading = false;
  private singleStepQueued = false;
  private scenarioId: ScenarioId = "open";

  private keys!: Record<
    "w" | "a" | "s" | "d" | "up" | "down" | "left" | "right" | "reset" | "pause" | "step" | "debug" | "one" | "two" | "three" | "four",
    Phaser.Input.Keyboard.Key
  >;

  constructor() {
    super("lab");
  }

  create(): void {
    this.graphics = this.add.graphics();
    this.hud = this.add.text(12, 10, "Loading S0...", {
      fontFamily: "monospace",
      fontSize: "15px",
      color: "#e7e9ee",
      backgroundColor: "rgba(12,14,18,0.75)",
      padding: { x: 8, y: 6 }
    }).setDepth(10);

    const keyboard = this.input.keyboard;
    if (!keyboard) throw new Error("Keyboard input is required for S0.");
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
      this.snapshotValue = this.world.step(this.currentIntents());
      this.singleStepQueued = false;
    }

    while (!this.paused && this.accumulator >= S0_STEP_SECONDS) {
      this.snapshotValue = this.world.step(this.currentIntents());
      this.accumulator -= S0_STEP_SECONDS;
    }

    this.draw(this.snapshotValue);
  }

  private currentIntents(): MotionIntent[] {
    return [
      {
        actorId: "player",
        move: motion(axis(this.keys.a, this.keys.d), axis(this.keys.w, this.keys.s))
      },
      {
        actorId: "companion",
        move: motion(axis(this.keys.left, this.keys.right), axis(this.keys.up, this.keys.down))
      }
    ];
  }

  private handleCommands(): void {
    if (Phaser.Input.Keyboard.JustDown(this.keys.reset)) void this.loadScenario(this.scenarioId);
    if (Phaser.Input.Keyboard.JustDown(this.keys.pause)) this.paused = !this.paused;
    if (Phaser.Input.Keyboard.JustDown(this.keys.step)) {
      this.paused = true;
      this.singleStepQueued = true;
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.debug)) this.debug = !this.debug;
    if (Phaser.Input.Keyboard.JustDown(this.keys.one)) void this.loadScenario("open");
    if (Phaser.Input.Keyboard.JustDown(this.keys.two)) void this.loadScenario("pillar");
    if (Phaser.Input.Keyboard.JustDown(this.keys.three)) void this.loadScenario("doorway");
    if (Phaser.Input.Keyboard.JustDown(this.keys.four)) void this.loadScenario("head-on");
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

    this.graphics.clear();
    this.graphics.fillStyle(0x171b22, 1).fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
    this.graphics.lineStyle(2, 0x55606f, 1).strokeRect(offsetX, offsetY, snapshot.width * scale, snapshot.height * scale);

    this.graphics.fillStyle(0x39414d, 1);
    for (const obstacle of snapshot.obstacles) {
      this.graphics.fillRect(sx(obstacle.x), sy(obstacle.y), obstacle.width * scale, obstacle.height * scale);
    }

    for (const actor of snapshot.actors) {
      const isPlayer = actor.id === "player";
      const inContact = actor.contacts.length > 0;
      this.graphics.fillStyle(isPlayer ? 0x63a8ff : 0xf2c15c, 1);
      this.graphics.fillCircle(sx(actor.position.x), sy(actor.position.y), actor.radius * scale);
      this.graphics.lineStyle(3, inContact ? 0xff5d66 : 0xe7e9ee, 0.95);
      this.graphics.strokeCircle(sx(actor.position.x), sy(actor.position.y), actor.radius * scale);

      if (this.debug) {
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
      return `${actor.id.padEnd(9)} pos ${actor.position.x.toFixed(2)},${actor.position.y.toFixed(2)}  motion error ${actor.motionError.toFixed(2)}  contacts ${contactText}`;
    });

    const scenarioLabel = SCENARIOS[snapshot.scenarioId].label;
    this.hud.setVisible(this.debug).setText([
      `S0 · ${scenarioLabel} · tick ${snapshot.tick} · ${this.paused ? "PAUSED" : "RUNNING"}`,
      "WASD player · arrows companion · 1-4 scenarios · R reset · P pause · O single-step · B debug",
      "green=requested velocity · red=actual velocity · red body outline=contact",
      ...actorLines
    ]);
  }
}
