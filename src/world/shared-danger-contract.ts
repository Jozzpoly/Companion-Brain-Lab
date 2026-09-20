import type { ActorId, Vec2 } from "./types";

export type SharedDangerEntityId = "hostile";

export type SharedDangerPhase =
  | "APPROACHING"
  | "WINDUP"
  | "RECOVERING"
  | "COMPLETE";

export type SharedDangerEpisodeOutcome =
  | "NONE"
  | "INTERRUPTED"
  | "PLAYER_HIT"
  | "ATTACK_MISSED";

export interface SharedDangerRules {
  interventionRange: number;
  attackRange: number;
  windupTicks: number;
  recoveryTicks: number;
}

export interface SharedDangerSnapshot {
  entityId: SharedDangerEntityId;
  phase: SharedDangerPhase;
  phaseTicksRemaining: number;
  targetActorId: "player";
  lastOutcome: SharedDangerEpisodeOutcome;
  lastOutcomeTick: number | null;
  interruptedBy: readonly ActorId[];
}

export type WorldActionKind = "INTERVENE";

export interface WorldActionAttempt {
  actorId: ActorId;
  kind: WorldActionKind;
  targetId: SharedDangerEntityId;
}

export type WorldActionOutcomeStatus =
  | "SUCCEEDED"
  | "OUT_OF_RANGE"
  | "INVALID_PHASE";

export interface WorldActionOutcome {
  observationTick: number;
  outcomeTick: number;
  actorId: ActorId;
  kind: WorldActionKind;
  targetId: SharedDangerEntityId;
  status: WorldActionOutcomeStatus;
  phaseObserved: SharedDangerPhase;
  distance: number;
  requiredRange: number;
  reason: string;
}

export interface SharedDangerPostPhysicsFrame {
  hostilePosition: Vec2;
  playerPosition: Vec2;
  companionPosition: Vec2;
}

export interface ResolveSharedDangerTickInput {
  observationTick: number;
  before: SharedDangerSnapshot;
  postPhysics: SharedDangerPostPhysicsFrame;
  attempts: readonly WorldActionAttempt[];
  rules: SharedDangerRules;
}

export interface ResolveSharedDangerTickResult {
  after: SharedDangerSnapshot;
  actionOutcomes: readonly WorldActionOutcome[];
  episodeOutcome: SharedDangerEpisodeOutcome;
}

const EPSILON = 1e-9;

function assertPositiveFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be finite and > 0.`);
  }
}

function validateRules(rules: SharedDangerRules): void {
  assertPositiveFinite(rules.interventionRange, "Shared-danger intervention range");
  assertPositiveFinite(rules.attackRange, "Shared-danger attack range");
  if (!Number.isInteger(rules.windupTicks) || rules.windupTicks <= 0) {
    throw new Error("Shared-danger windupTicks must be a positive integer.");
  }
  if (!Number.isInteger(rules.recoveryTicks) || rules.recoveryTicks <= 0) {
    throw new Error("Shared-danger recoveryTicks must be a positive integer.");
  }
}

function validateSnapshot(snapshot: SharedDangerSnapshot): void {
  if (snapshot.entityId !== "hostile") throw new Error("Shared-danger entity id must be hostile.");
  if (snapshot.targetActorId !== "player") throw new Error("Shared-danger apparatus currently targets player.");
  if (!Number.isInteger(snapshot.phaseTicksRemaining) || snapshot.phaseTicksRemaining < 0) {
    throw new Error("Shared-danger phaseTicksRemaining must be a non-negative integer.");
  }
  if (snapshot.phase === "WINDUP" || snapshot.phase === "RECOVERING") {
    if (snapshot.phaseTicksRemaining <= 0) {
      throw new Error(`${snapshot.phase} requires positive phaseTicksRemaining.`);
    }
  }
  if ((snapshot.phase === "APPROACHING" || snapshot.phase === "COMPLETE") && snapshot.phaseTicksRemaining !== 0) {
    throw new Error(`${snapshot.phase} requires phaseTicksRemaining = 0.`);
  }
}

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function actorPosition(
  frame: SharedDangerPostPhysicsFrame,
  actorId: ActorId
): Vec2 {
  return actorId === "player" ? frame.playerPosition : frame.companionPosition;
}

function cloneSnapshot(value: SharedDangerSnapshot): SharedDangerSnapshot {
  return {
    ...value,
    interruptedBy: [...value.interruptedBy]
  };
}

export function validateWorldActionAttempts(attempts: readonly WorldActionAttempt[]): WorldActionAttempt[] {
  const byActor = new Map<ActorId, WorldActionAttempt>();
  for (const attempt of attempts) {
    if (attempt.kind !== "INTERVENE") {
      throw new Error(`Unsupported world action kind: ${attempt.kind satisfies never}`);
    }
    if (attempt.targetId !== "hostile") {
      throw new Error("Shared-danger apparatus only accepts hostile as action target.");
    }
    if (byActor.has(attempt.actorId)) {
      throw new Error(`Duplicate world action attempt from ${attempt.actorId} in one tick.`);
    }
    byActor.set(attempt.actorId, { ...attempt });
  }
  return [...byActor.values()].sort((a, b) => a.actorId.localeCompare(b.actorId));
}

function validateAttemptsAgainstSameFrame(
  input: ResolveSharedDangerTickInput,
  attempts: readonly WorldActionAttempt[]
): WorldActionOutcome[] {
  return attempts.map((attempt) => {
    const d = distance(
      actorPosition(input.postPhysics, attempt.actorId),
      input.postPhysics.hostilePosition
    );
    const base = {
      observationTick: input.observationTick,
      outcomeTick: input.observationTick + 1,
      actorId: attempt.actorId,
      kind: attempt.kind,
      targetId: attempt.targetId,
      phaseObserved: input.before.phase,
      distance: d,
      requiredRange: input.rules.interventionRange
    } as const;

    if (input.before.phase !== "WINDUP") {
      return {
        ...base,
        status: "INVALID_PHASE" as const,
        reason:
          `INTERVENE is only materially effective during WINDUP; observed ${input.before.phase}`
      };
    }
    if (d > input.rules.interventionRange + EPSILON) {
      return {
        ...base,
        status: "OUT_OF_RANGE" as const,
        reason:
          `INTERVENE distance ${d.toFixed(3)} exceeds range ${input.rules.interventionRange.toFixed(3)}`
      };
    }
    return {
      ...base,
      status: "SUCCEEDED" as const,
      reason:
        `INTERVENE is valid in WINDUP at distance ${d.toFixed(3)} within range ${input.rules.interventionRange.toFixed(3)}`
    };
  });
}

export function initialSharedDangerSnapshot(): SharedDangerSnapshot {
  return {
    entityId: "hostile",
    phase: "APPROACHING",
    phaseTicksRemaining: 0,
    targetActorId: "player",
    lastOutcome: "NONE",
    lastOutcomeTick: null,
    interruptedBy: []
  };
}

/**
 * Resolves only the post-physics shared-danger portion of one authoritative
 * World tick.
 *
 * Ordering is part of the contract:
 * 1. physics has already produced one shared post-physics frame;
 * 2. all external action attempts are validated simultaneously against that
 *    same frame and the same pre-resolution episode phase;
 * 3. successful interventions are applied as one batch;
 * 4. only then may hostile windup/attack resolution advance.
 *
 * This makes a legal last-moment intervention win over attack resolution
 * without introducing actor-order bias. It also prevents an action submitted
 * during APPROACHING from retroactively becoming valid merely because the
 * hostile enters WINDUP later in this same resolution.
 */
export function resolveSharedDangerAfterPhysics(
  input: ResolveSharedDangerTickInput
): ResolveSharedDangerTickResult {
  if (!Number.isInteger(input.observationTick) || input.observationTick < 0) {
    throw new Error("Shared-danger observationTick must be a non-negative integer.");
  }
  validateRules(input.rules);
  validateSnapshot(input.before);

  const attempts = validateWorldActionAttempts(input.attempts);
  const actionOutcomes = validateAttemptsAgainstSameFrame(input, attempts);
  const successfulActors = actionOutcomes
    .filter((outcome) => outcome.status === "SUCCEEDED")
    .map((outcome) => outcome.actorId)
    .sort((a, b) => a.localeCompare(b));

  const outcomeTick = input.observationTick + 1;

  if (successfulActors.length > 0) {
    const after: SharedDangerSnapshot = {
      ...cloneSnapshot(input.before),
      phase: "RECOVERING",
      phaseTicksRemaining: input.rules.recoveryTicks,
      lastOutcome: "INTERRUPTED",
      lastOutcomeTick: outcomeTick,
      interruptedBy: successfulActors
    };
    return {
      after,
      actionOutcomes,
      episodeOutcome: "INTERRUPTED"
    };
  }

  if (input.before.phase === "APPROACHING") {
    const attackDistance = distance(
      input.postPhysics.hostilePosition,
      input.postPhysics.playerPosition
    );
    if (attackDistance <= input.rules.attackRange + EPSILON) {
      return {
        after: {
          ...cloneSnapshot(input.before),
          phase: "WINDUP",
          phaseTicksRemaining: input.rules.windupTicks,
          interruptedBy: []
        },
        actionOutcomes,
        episodeOutcome: "NONE"
      };
    }
    return {
      after: cloneSnapshot(input.before),
      actionOutcomes,
      episodeOutcome: "NONE"
    };
  }

  if (input.before.phase === "RECOVERING") {
    const remaining = input.before.phaseTicksRemaining - 1;
    if (remaining > 0) {
      return {
        after: {
          ...cloneSnapshot(input.before),
          phaseTicksRemaining: remaining
        },
        actionOutcomes,
        episodeOutcome: "NONE"
      };
    }
    return {
      after: {
        ...cloneSnapshot(input.before),
        phase: "COMPLETE",
        phaseTicksRemaining: 0
      },
      actionOutcomes,
      episodeOutcome: "NONE"
    };
  }

  if (input.before.phase === "COMPLETE") {
    return {
      after: cloneSnapshot(input.before),
      actionOutcomes,
      episodeOutcome: "NONE"
    };
  }

  const remaining = input.before.phaseTicksRemaining - 1;
  if (remaining > 0) {
    return {
      after: {
        ...cloneSnapshot(input.before),
        phaseTicksRemaining: remaining,
        interruptedBy: []
      },
      actionOutcomes,
      episodeOutcome: "NONE"
    };
  }

  const attackDistance = distance(
    input.postPhysics.hostilePosition,
    input.postPhysics.playerPosition
  );
  const landed = attackDistance <= input.rules.attackRange + EPSILON;
  const episodeOutcome: SharedDangerEpisodeOutcome = landed
    ? "PLAYER_HIT"
    : "ATTACK_MISSED";

  return {
    after: {
      ...cloneSnapshot(input.before),
      phase: "RECOVERING",
      phaseTicksRemaining: input.rules.recoveryTicks,
      lastOutcome: episodeOutcome,
      lastOutcomeTick: outcomeTick,
      interruptedBy: []
    },
    actionOutcomes,
    episodeOutcome
  };
}
