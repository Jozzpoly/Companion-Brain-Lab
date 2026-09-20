import type { ActorId, ScenarioId, Vec2, WorldSnapshot } from "./types";

export type SharedPressurePhase = "QUIET" | "ACTIVE" | "RECOVERING";
export type SharedPressureOutcome = "NONE" | "CONTAINED" | "BREACHED";
export type SharedPressureResponder = ActorId | "both" | "none";

export interface SharedPressureSnapshot {
  enabled: boolean;
  phase: SharedPressurePhase;
  cycle: number;
  target: Vec2 | null;
  responseRadius: number;
  responseTicks: number;
  requiredResponseTicks: number;
  deadlineTick: number | null;
  ticksUntilDeadline: number | null;
  ticksUntilActivation: number | null;
  lastResponder: SharedPressureResponder;
  lastOutcome: SharedPressureOutcome;
  lastResolvedBy: SharedPressureResponder;
  breaches: number;
  reason: string;
}

const OPEN_ACTIVATION_DELAY_TICKS = 90;
const OPEN_RECOVERY_TICKS = 120;
const OPEN_RESPONSE_RADIUS = 0.72;
const OPEN_REQUIRED_RESPONSE_TICKS = 42;
const OPEN_ACTIVE_DEADLINE_TICKS = 420;

const OPEN_TARGETS: readonly Vec2[] = [
  { x: 9.4, y: 2.0 },
  { x: 2.6, y: 6.0 }
];

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function actorPosition(snapshot: WorldSnapshot, id: ActorId): Vec2 {
  const found = snapshot.actors.find((actor) => actor.id === id);
  if (!found) throw new Error(`Shared pressure missing actor: ${id}`);
  return found.position;
}

function responderFor(snapshot: WorldSnapshot, target: Vec2): SharedPressureResponder {
  const player = distance(actorPosition(snapshot, "player"), target) <= OPEN_RESPONSE_RADIUS;
  const companion = distance(actorPosition(snapshot, "companion"), target) <= OPEN_RESPONSE_RADIUS;
  if (player && companion) return "both";
  if (player) return "player";
  if (companion) return "companion";
  return "none";
}

function cloneTarget(target: Vec2 | null): Vec2 | null {
  return target ? { ...target } : null;
}

export class SharedPressureLoop {
  private lastObservedTick = 0;
  private phaseValue: SharedPressurePhase = "QUIET";
  private cycleValue = 0;
  private targetValue: Vec2 | null = null;
  private activationTickValue = OPEN_ACTIVATION_DELAY_TICKS;
  private deadlineTickValue: number | null = null;
  private recoveryUntilTickValue: number | null = null;
  private responseTicksValue = 0;
  private lastResponderValue: SharedPressureResponder = "none";
  private lastOutcomeValue: SharedPressureOutcome = "NONE";
  private lastResolvedByValue: SharedPressureResponder = "none";
  private breachesValue = 0;
  private reasonValue = "waiting for the first shared-world pressure event";

  constructor(private readonly scenarioId: ScenarioId) {}

  snapshot(): SharedPressureSnapshot {
    const enabled = this.scenarioId === "open";
    return {
      enabled,
      phase: enabled ? this.phaseValue : "QUIET",
      cycle: this.cycleValue,
      target: enabled ? cloneTarget(this.targetValue) : null,
      responseRadius: OPEN_RESPONSE_RADIUS,
      responseTicks: enabled ? this.responseTicksValue : 0,
      requiredResponseTicks: OPEN_REQUIRED_RESPONSE_TICKS,
      deadlineTick: enabled ? this.deadlineTickValue : null,
      ticksUntilDeadline:
        enabled && this.phaseValue === "ACTIVE" && this.deadlineTickValue !== null
          ? Math.max(0, this.deadlineTickValue - this.lastObservedTick)
          : null,
      ticksUntilActivation:
        enabled && this.phaseValue === "QUIET"
          ? Math.max(0, this.activationTickValue - this.lastObservedTick)
          : null,
      lastResponder: enabled ? this.lastResponderValue : "none",
      lastOutcome: enabled ? this.lastOutcomeValue : "NONE",
      lastResolvedBy: enabled ? this.lastResolvedByValue : "none",
      breaches: enabled ? this.breachesValue : 0,
      reason: enabled
        ? this.reasonValue
        : "Stage B shared pressure is deliberately bounded to the Open fixture."
    };
  }

  observe(snapshot: WorldSnapshot): SharedPressureSnapshot {
    this.lastObservedTick = snapshot.tick;
    if (this.scenarioId !== "open") return this.snapshot();

    if (this.phaseValue === "QUIET" && snapshot.tick >= this.activationTickValue) {
      const authored = OPEN_TARGETS[this.cycleValue % OPEN_TARGETS.length];
      if (!authored) throw new Error("Shared pressure target sequence is empty.");
      this.phaseValue = "ACTIVE";
      this.targetValue = { ...authored };
      this.deadlineTickValue = snapshot.tick + OPEN_ACTIVE_DEADLINE_TICKS;
      this.responseTicksValue = 0;
      this.lastResponderValue = "none";
      this.lastOutcomeValue = "NONE";
      this.lastResolvedByValue = "none";
      this.reasonValue = "external threat pressure became active; the team must answer it";
    }

    if (this.phaseValue === "ACTIVE") {
      if (!this.targetValue || this.deadlineTickValue === null) {
        throw new Error("ACTIVE shared pressure requires target and deadline.");
      }

      const responder = responderFor(snapshot, this.targetValue);
      this.lastResponderValue = responder;
      this.responseTicksValue = responder === "none" ? 0 : this.responseTicksValue + 1;

      if (this.responseTicksValue >= OPEN_REQUIRED_RESPONSE_TICKS) {
        this.phaseValue = "RECOVERING";
        this.lastOutcomeValue = "CONTAINED";
        this.lastResolvedByValue = responder;
        this.recoveryUntilTickValue = snapshot.tick + OPEN_RECOVERY_TICKS;
        this.reasonValue = `threat pressure contained by ${responder}; regroup window opened`;
      } else if (snapshot.tick >= this.deadlineTickValue) {
        this.phaseValue = "RECOVERING";
        this.lastOutcomeValue = "BREACHED";
        this.lastResolvedByValue = "none";
        this.breachesValue += 1;
        this.recoveryUntilTickValue = snapshot.tick + OPEN_RECOVERY_TICKS;
        this.reasonValue = "threat pressure breached before the team sustained a response";
      }
    } else if (
      this.phaseValue === "RECOVERING" &&
      this.recoveryUntilTickValue !== null &&
      snapshot.tick >= this.recoveryUntilTickValue
    ) {
      this.phaseValue = "QUIET";
      this.cycleValue += 1;
      this.targetValue = null;
      this.deadlineTickValue = null;
      this.recoveryUntilTickValue = null;
      this.responseTicksValue = 0;
      this.lastResponderValue = "none";
      this.activationTickValue = snapshot.tick + OPEN_ACTIVATION_DELAY_TICKS;
      this.reasonValue = "pressure episode complete; ordinary player-companion relationship resumed";
    }

    return this.snapshot();
  }
}
