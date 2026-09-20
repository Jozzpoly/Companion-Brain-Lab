import type { ActorId, ScenarioId, Vec2, WorldSnapshot } from "./types";

export type SharedPressurePhase = "QUIET" | "ACTIVE" | "RECOVERING";
export type SharedPressureOutcome = "NONE" | "CONTAINED" | "BREACHED";
export type SharedPressureResponder = ActorId | "both" | "none";
export type SharedPressureKind = "ADVANCING_THREAT_PROXY";

export interface SharedPressureSnapshot {
  enabled: boolean;
  kind: SharedPressureKind;
  phase: SharedPressurePhase;
  cycle: number;
  /** World-owned position of the advancing threat proxy and current live intercept target. */
  target: Vec2 | null;
  threatRadius: number;
  threatSpeed: number;
  breachDistance: number;
  threatDistanceToPlayer: number | null;
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
const OPEN_THREAT_RADIUS = 0.24;
const OPEN_THREAT_SPEED = 1.1;
const OPEN_BREACH_DISTANCE = 0.56;
const OPEN_RESPONSE_RADIUS = 0.68;
const OPEN_REQUIRED_RESPONSE_TICKS = 36;
const OPEN_ACTIVE_DEADLINE_TICKS = 600;
const DEFAULT_STEP_SECONDS = 1 / 60;

const OPEN_THREAT_SPAWNS: readonly Vec2[] = [
  { x: 10.8, y: 2.0 },
  { x: 10.8, y: 6.0 }
];

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function actorPosition(snapshot: WorldSnapshot, id: ActorId): Vec2 {
  const found = snapshot.actors.find((actor) => actor.id === id);
  if (!found) throw new Error(`Shared pressure missing actor: ${id}`);
  return found.position;
}

function cloneTarget(target: Vec2 | null): Vec2 | null {
  return target ? { ...target } : null;
}

function moveToward(from: Vec2, to: Vec2, distanceStep: number): Vec2 {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (length <= 1e-9 || distanceStep >= length) return { ...to };
  const scale = distanceStep / length;
  return {
    x: from.x + dx * scale,
    y: from.y + dy * scale
  };
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
  private threatDistanceToPlayerValue: number | null = null;
  private reasonValue = "waiting for the first advancing shared-world threat";

  constructor(
    private readonly scenarioId: ScenarioId,
    private readonly stepSeconds: number = DEFAULT_STEP_SECONDS
  ) {
    if (!(stepSeconds > 0)) throw new Error("Shared pressure stepSeconds must be positive.");
  }

  snapshot(): SharedPressureSnapshot {
    const enabled = this.scenarioId === "open";
    return {
      enabled,
      kind: "ADVANCING_THREAT_PROXY",
      phase: enabled ? this.phaseValue : "QUIET",
      cycle: this.cycleValue,
      target: enabled ? cloneTarget(this.targetValue) : null,
      threatRadius: OPEN_THREAT_RADIUS,
      threatSpeed: OPEN_THREAT_SPEED,
      breachDistance: OPEN_BREACH_DISTANCE,
      threatDistanceToPlayer: enabled ? this.threatDistanceToPlayerValue : null,
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
        : "Stage B advancing threat proxy is deliberately bounded to the Open fixture."
    };
  }

  private beginActive(snapshot: WorldSnapshot): void {
    const authored = OPEN_THREAT_SPAWNS[this.cycleValue % OPEN_THREAT_SPAWNS.length];
    if (!authored) throw new Error("Shared pressure threat spawn sequence is empty.");
    this.phaseValue = "ACTIVE";
    this.targetValue = { ...authored };
    this.deadlineTickValue = snapshot.tick + OPEN_ACTIVE_DEADLINE_TICKS;
    this.responseTicksValue = 0;
    this.lastResponderValue = "none";
    this.lastOutcomeValue = "NONE";
    this.lastResolvedByValue = "none";
    this.threatDistanceToPlayerValue = distance(
      this.targetValue,
      actorPosition(snapshot, "player")
    );
    this.reasonValue = "advancing threat entered the world and is closing on the player";
  }

  private enterRecovery(
    snapshot: WorldSnapshot,
    outcome: Exclude<SharedPressureOutcome, "NONE">,
    resolvedBy: SharedPressureResponder,
    reason: string
  ): void {
    this.phaseValue = "RECOVERING";
    this.lastOutcomeValue = outcome;
    this.lastResolvedByValue = resolvedBy;
    this.recoveryUntilTickValue = snapshot.tick + OPEN_RECOVERY_TICKS;
    this.reasonValue = reason;
    if (outcome === "BREACHED") this.breachesValue += 1;
  }

  observe(snapshot: WorldSnapshot): SharedPressureSnapshot {
    this.lastObservedTick = snapshot.tick;
    if (this.scenarioId !== "open") return this.snapshot();

    if (this.phaseValue === "QUIET" && snapshot.tick >= this.activationTickValue) {
      this.beginActive(snapshot);
    }

    if (this.phaseValue === "ACTIVE") {
      if (!this.targetValue || this.deadlineTickValue === null) {
        throw new Error("ACTIVE shared pressure requires threat target and deadline.");
      }

      const playerPosition = actorPosition(snapshot, "player");
      const companionPosition = actorPosition(snapshot, "companion");
      let threatDistanceToPlayer = distance(this.targetValue, playerPosition);

      if (threatDistanceToPlayer <= OPEN_BREACH_DISTANCE) {
        this.threatDistanceToPlayerValue = threatDistanceToPlayer;
        this.lastResponderValue = "none";
        this.responseTicksValue = 0;
        this.enterRecovery(
          snapshot,
          "BREACHED",
          "none",
          "advancing threat reached the player before the companion contained it"
        );
        return this.snapshot();
      }

      const companionEngaged =
        distance(companionPosition, this.targetValue) <= OPEN_RESPONSE_RADIUS;
      this.lastResponderValue = companionEngaged ? "companion" : "none";

      if (companionEngaged) {
        this.responseTicksValue += 1;
        this.reasonValue = "companion is physically intercepting the advancing threat";
      } else {
        this.responseTicksValue = 0;
        this.targetValue = moveToward(
          this.targetValue,
          playerPosition,
          OPEN_THREAT_SPEED * this.stepSeconds
        );
        threatDistanceToPlayer = distance(this.targetValue, playerPosition);
        this.reasonValue = "advancing threat is closing on the player; companion has not intercepted it yet";
      }

      this.threatDistanceToPlayerValue = threatDistanceToPlayer;

      if (threatDistanceToPlayer <= OPEN_BREACH_DISTANCE) {
        this.lastResponderValue = "none";
        this.responseTicksValue = 0;
        this.enterRecovery(
          snapshot,
          "BREACHED",
          "none",
          "advancing threat reached the player before the companion contained it"
        );
      } else if (this.responseTicksValue >= OPEN_REQUIRED_RESPONSE_TICKS) {
        this.enterRecovery(
          snapshot,
          "CONTAINED",
          "companion",
          "companion sustained the intercept long enough to contain the advancing threat"
        );
      } else if (snapshot.tick >= this.deadlineTickValue) {
        this.lastResponderValue = "none";
        this.responseTicksValue = 0;
        this.enterRecovery(
          snapshot,
          "BREACHED",
          "none",
          "advancing threat exceeded the bounded episode deadline before containment"
        );
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
      this.threatDistanceToPlayerValue = null;
      this.activationTickValue = snapshot.tick + OPEN_ACTIVATION_DELAY_TICKS;
      this.reasonValue = "threat episode complete; ordinary player-companion relationship resumed";
    }

    return this.snapshot();
  }
}
