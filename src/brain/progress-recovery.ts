import type { StaticRoutePlan } from "../navigation/static-router";
import type { Vec2 } from "../world/types";

const EPSILON = 1e-9;
export const R1_PROGRESS_WINDOW_TICKS = 30;
export const R1_NO_PROGRESS_TRIGGER_TICKS = 36;
export const R1_UNREACHABLE_PERSIST_TICKS = 60;
export const R1_RECOVERY_COOLDOWN_TICKS = 45;
export const R1_MAX_LOCAL_RETRIES_PER_EPISODE = 2;
export const R1_PROGRESS_DISTANCE = 0.06;
export const R1_ARRIVAL_DISTANCE = 0.2;

export type ProgressRecoveryState =
  | "UNKNOWN"
  | "ARRIVED"
  | "PROGRESSING"
  | "INTENTIONAL_HOLD"
  | "HOLDING_UNEXPLAINED"
  | "BLOCKED_PLAYER"
  | "BLOCKED_STATIC"
  | "NO_PROGRESS"
  | "TRANSIENT_UNREACHABLE"
  | "PERSISTENT_UNREACHABLE"
  | "RECOVERING";

export type ProgressRecoveryAction =
  | "NONE"
  | "WAIT_CONFLICT"
  | "RETRY_LOCAL"
  | "REPORT_UNREACHABLE";

export interface ProgressRecoveryObservation {
  tick: number;
  objectiveKey: string;
  position: Vec2;
  target: Vec2;
  routeStatus: StaticRoutePlan["status"];
  routeRemainingDistance: number | null;
  commandedSpeed: number;
  actualSpeed: number;
  contacts: readonly string[];
  intentionalHoldReason?: string | null;
}

export interface ProgressRecoveryDecision {
  tick: number;
  state: ProgressRecoveryState;
  action: ProgressRecoveryAction;
  reason: string;
  objectiveKey: string;
  objectiveDistance: number;
  progressMetric: number;
  progressDelta: number;
  noProgressTicks: number;
  unreachableTicks: number;
  retryCount: number;
  playerBlocked: boolean;
  staticBlocked: boolean;
}

interface ProgressSample {
  tick: number;
  metric: number;
}

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function finiteNonNegative(value: number | null, fallback: number): number {
  return value !== null && Number.isFinite(value) && value >= 0 ? value : fallback;
}

function copyDecision(value: ProgressRecoveryDecision | null): ProgressRecoveryDecision | null {
  return value ? { ...value } : null;
}

export class ProgressRecoveryMonitor {
  private objectiveKeyValue: string | null = null;
  private readonly samples: ProgressSample[] = [];
  private lastDecisionValue: ProgressRecoveryDecision | null = null;
  private noProgressSinceTick: number | null = null;
  private unreachableSinceTick: number | null = null;
  private retryCountValue = 0;
  private lastRetryTick = Number.NEGATIVE_INFINITY;
  private previouslyPlayerBlocked = false;
  private reportedPersistentUnreachable = false;

  reset(): void {
    this.objectiveKeyValue = null;
    this.samples.length = 0;
    this.lastDecisionValue = null;
    this.noProgressSinceTick = null;
    this.unreachableSinceTick = null;
    this.retryCountValue = 0;
    this.lastRetryTick = Number.NEGATIVE_INFINITY;
    this.previouslyPlayerBlocked = false;
    this.reportedPersistentUnreachable = false;
  }

  observe(observation: ProgressRecoveryObservation): ProgressRecoveryDecision {
    if (!Number.isInteger(observation.tick) || observation.tick < 0) {
      throw new Error("Progress monitor requires a non-negative integer tick.");
    }
    if (!observation.objectiveKey) throw new Error("Progress monitor requires an objectiveKey.");
    if (![observation.position.x, observation.position.y, observation.target.x, observation.target.y].every(Number.isFinite)) {
      throw new Error("Progress monitor requires finite position/target coordinates.");
    }

    const objectiveChanged = observation.objectiveKey !== this.objectiveKeyValue;
    if (objectiveChanged) this.beginObjective(observation.objectiveKey);

    const objectiveDistance = distance(observation.position, observation.target);
    const progressMetric = finiteNonNegative(observation.routeRemainingDistance, objectiveDistance);
    this.recordProgress(observation.tick, progressMetric);
    const progressDelta = this.progressDelta();
    const playerBlocked = observation.contacts.includes("player");
    const staticBlocked = observation.contacts.some((label) => label !== "player");

    if (objectiveDistance <= R1_ARRIVAL_DISTANCE) {
      this.noProgressSinceTick = null;
      this.unreachableSinceTick = null;
      this.previouslyPlayerBlocked = false;
      return this.finish(observation, {
        state: "ARRIVED",
        action: "NONE",
        reason: "objective is within arrival tolerance",
        objectiveDistance,
        progressMetric,
        progressDelta,
        playerBlocked,
        staticBlocked
      });
    }

    if (observation.routeStatus === "unreachable" || observation.routeStatus === "invalid-target") {
      this.noProgressSinceTick = null;
      this.previouslyPlayerBlocked = false;
      this.unreachableSinceTick ??= observation.tick;
      const unreachableTicks = observation.tick - this.unreachableSinceTick + 1;
      const persistent = unreachableTicks >= R1_UNREACHABLE_PERSIST_TICKS;
      const firstReport = persistent && !this.reportedPersistentUnreachable;
      if (firstReport) this.reportedPersistentUnreachable = true;
      return this.finish(observation, {
        state: persistent ? "PERSISTENT_UNREACHABLE" : "TRANSIENT_UNREACHABLE",
        action: firstReport ? "REPORT_UNREACHABLE" : "NONE",
        reason: persistent
          ? "same objective has remained hard-unreachable beyond the bounded persistence window"
          : "objective is currently hard-unreachable; waiting for route/objective change before escalation",
        objectiveDistance,
        progressMetric,
        progressDelta,
        playerBlocked,
        staticBlocked
      });
    }

    const routeRestored = this.unreachableSinceTick !== null;
    this.unreachableSinceTick = null;
    this.reportedPersistentUnreachable = false;

    if (observation.intentionalHoldReason) {
      this.noProgressSinceTick = null;
      this.previouslyPlayerBlocked = playerBlocked;
      return this.finish(observation, {
        state: "INTENTIONAL_HOLD",
        action: playerBlocked ? "WAIT_CONFLICT" : "NONE",
        reason: observation.intentionalHoldReason,
        objectiveDistance,
        progressMetric,
        progressDelta,
        playerBlocked,
        staticBlocked
      });
    }

    if (playerBlocked && observation.commandedSpeed > 0.05 && observation.actualSpeed < 0.08) {
      this.noProgressSinceTick ??= observation.tick;
      this.previouslyPlayerBlocked = true;
      return this.finish(observation, {
        state: "BLOCKED_PLAYER",
        action: "WAIT_CONFLICT",
        reason: "player contact is suppressing commanded motion; do not thrash local recovery while conflict persists",
        objectiveDistance,
        progressMetric,
        progressDelta,
        playerBlocked,
        staticBlocked
      });
    }

    if (this.previouslyPlayerBlocked && !playerBlocked) {
      this.previouslyPlayerBlocked = false;
      this.noProgressSinceTick = null;
      if (this.canRetry(observation.tick)) {
        this.consumeRetry(observation.tick);
        return this.finish(observation, {
          state: "RECOVERING",
          action: "RETRY_LOCAL",
          reason: "player conflict cleared; refresh local movement state once before continuing",
          objectiveDistance,
          progressMetric,
          progressDelta,
          playerBlocked,
          staticBlocked
        });
      }
    }

    if (routeRestored && this.canRetry(observation.tick)) {
      this.noProgressSinceTick = null;
      this.consumeRetry(observation.tick);
      return this.finish(observation, {
        state: "RECOVERING",
        action: "RETRY_LOCAL",
        reason: "route became reachable again; refresh local movement state once",
        objectiveDistance,
        progressMetric,
        progressDelta,
        playerBlocked,
        staticBlocked
      });
    }

    if (staticBlocked && observation.commandedSpeed > 0.05 && observation.actualSpeed < 0.08) {
      this.noProgressSinceTick ??= observation.tick;
      const blockedTicks = observation.tick - this.noProgressSinceTick + 1;
      if (blockedTicks >= R1_NO_PROGRESS_TRIGGER_TICKS && this.canRetry(observation.tick)) {
        this.consumeRetry(observation.tick);
        this.noProgressSinceTick = observation.tick;
        return this.finish(observation, {
          state: "RECOVERING",
          action: "RETRY_LOCAL",
          reason: "persistent static contact suppressed a nonzero command; retrying local movement state",
          objectiveDistance,
          progressMetric,
          progressDelta,
          playerBlocked,
          staticBlocked
        });
      }
      return this.finish(observation, {
        state: "BLOCKED_STATIC",
        action: "NONE",
        reason: "static contact is suppressing commanded motion",
        objectiveDistance,
        progressMetric,
        progressDelta,
        playerBlocked,
        staticBlocked
      });
    }

    const measurableProgress = progressDelta >= R1_PROGRESS_DISTANCE || observation.actualSpeed >= 0.12;
    if (measurableProgress) {
      this.noProgressSinceTick = null;
      return this.finish(observation, {
        state: "PROGRESSING",
        action: "NONE",
        reason: progressDelta >= R1_PROGRESS_DISTANCE
          ? "rolling route/objective metric is decreasing"
          : "body has meaningful actual motion while route remains reachable",
        objectiveDistance,
        progressMetric,
        progressDelta,
        playerBlocked,
        staticBlocked
      });
    }

    this.noProgressSinceTick ??= observation.tick;
    const noProgressTicks = observation.tick - this.noProgressSinceTick + 1;
    if (noProgressTicks >= R1_NO_PROGRESS_TRIGGER_TICKS) {
      if (this.canRetry(observation.tick)) {
        this.consumeRetry(observation.tick);
        this.noProgressSinceTick = observation.tick;
        return this.finish(observation, {
          state: "RECOVERING",
          action: "RETRY_LOCAL",
          reason: "reachable objective has produced no measurable progress for the bounded trigger window",
          objectiveDistance,
          progressMetric,
          progressDelta,
          playerBlocked,
          staticBlocked
        });
      }
      return this.finish(observation, {
        state: "NO_PROGRESS",
        action: "NONE",
        reason: "reachable objective remains without measurable progress; local retry budget/cooldown prevents thrash",
        objectiveDistance,
        progressMetric,
        progressDelta,
        playerBlocked,
        staticBlocked
      });
    }

    return this.finish(observation, {
      state: observation.commandedSpeed < 0.03 ? "HOLDING_UNEXPLAINED" : "UNKNOWN",
      action: "NONE",
      reason: observation.commandedSpeed < 0.03
        ? "objective is unsatisfied but current command is near zero; awaiting bounded progress window"
        : "insufficient temporal evidence to classify progress yet",
      objectiveDistance,
      progressMetric,
      progressDelta,
      playerBlocked,
      staticBlocked
    });
  }

  debugState(): ProgressRecoveryDecision | null {
    return copyDecision(this.lastDecisionValue);
  }

  private beginObjective(objectiveKey: string): void {
    this.objectiveKeyValue = objectiveKey;
    this.samples.length = 0;
    this.noProgressSinceTick = null;
    this.unreachableSinceTick = null;
    this.retryCountValue = 0;
    this.lastRetryTick = Number.NEGATIVE_INFINITY;
    this.previouslyPlayerBlocked = false;
    this.reportedPersistentUnreachable = false;
  }

  private recordProgress(tick: number, metric: number): void {
    this.samples.push({ tick, metric });
    const minimumTick = tick - R1_PROGRESS_WINDOW_TICKS;
    while (this.samples.length > 1 && (this.samples[0]?.tick ?? tick) < minimumTick) this.samples.shift();
  }

  private progressDelta(): number {
    const first = this.samples[0];
    const last = this.samples.at(-1);
    if (!first || !last) return 0;
    return Math.max(0, first.metric - last.metric);
  }

  private canRetry(tick: number): boolean {
    return this.retryCountValue < R1_MAX_LOCAL_RETRIES_PER_EPISODE &&
      tick - this.lastRetryTick >= R1_RECOVERY_COOLDOWN_TICKS - EPSILON;
  }

  private consumeRetry(tick: number): void {
    this.retryCountValue += 1;
    this.lastRetryTick = tick;
  }

  private finish(
    observation: ProgressRecoveryObservation,
    value: Omit<ProgressRecoveryDecision, "tick" | "objectiveKey" | "noProgressTicks" | "unreachableTicks" | "retryCount">
  ): ProgressRecoveryDecision {
    const decision: ProgressRecoveryDecision = {
      tick: observation.tick,
      objectiveKey: observation.objectiveKey,
      ...value,
      noProgressTicks: this.noProgressSinceTick === null ? 0 : observation.tick - this.noProgressSinceTick + 1,
      unreachableTicks: this.unreachableSinceTick === null ? 0 : observation.tick - this.unreachableSinceTick + 1,
      retryCount: this.retryCountValue
    };
    this.lastDecisionValue = decision;
    return { ...decision };
  }
}
