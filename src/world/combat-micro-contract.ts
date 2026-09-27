import type { ActorId, Vec2 } from "./types";

export type CombatMicroPhase =
  | "APPROACHING"
  | "PRESSURING"
  | "RECOVERING"
  | "DEFEATED";

export type CombatMicroEpisodeOutcome =
  | "NONE"
  | "HOSTILE_STRUCK"
  | "PLAYER_HIT"
  | "HOSTILE_DEFEATED";

export interface CombatMicroRules {
  strikeRange: number;
  attackRange: number;
  pressureBreakRange: number;
  pressureTicks: number;
  recoveryTicks: number;
  hostileHealth: number;
  strikeDamage: number;
}

export interface CombatMicroSnapshot {
  phase: CombatMicroPhase;
  phaseTicksRemaining: number;
  hostileHealth: number;
  playerHitCount: number;
  lastOutcome: CombatMicroEpisodeOutcome;
  lastOutcomeTick: number | null;
  lastSuccessfulStrikers: readonly ActorId[];
  successfulStrikeHistory: readonly ActorId[];
}

export interface CombatMicroActionAttempt {
  actorId: ActorId;
  kind: "STRIKE";
  targetId: "hostile";
}

export type CombatMicroActionStatus =
  | "SUCCEEDED"
  | "OUT_OF_RANGE"
  | "INACTIVE_PHASE";

export interface CombatMicroActionOutcome {
  observationTick: number;
  outcomeTick: number;
  actorId: ActorId;
  kind: "STRIKE";
  targetId: "hostile";
  status: CombatMicroActionStatus;
  phaseObserved: CombatMicroPhase;
  distance: number;
  requiredRange: number;
  reason: string;
}

export interface CombatMicroPostPhysicsFrame {
  hostilePosition: Vec2;
  playerPosition: Vec2;
  companionPosition: Vec2;
}

export interface ResolveCombatMicroTickInput {
  observationTick: number;
  before: CombatMicroSnapshot;
  postPhysics: CombatMicroPostPhysicsFrame;
  attempts: readonly CombatMicroActionAttempt[];
  rules: CombatMicroRules;
}

export interface ResolveCombatMicroTickResult {
  after: CombatMicroSnapshot;
  actionOutcomes: readonly CombatMicroActionOutcome[];
  episodeOutcome: CombatMicroEpisodeOutcome;
}

const EPSILON = 1e-9;

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function assertRules(rules: CombatMicroRules): void {
  for (const [label, value] of [
    ["strikeRange", rules.strikeRange],
    ["attackRange", rules.attackRange],
    ["pressureBreakRange", rules.pressureBreakRange]
  ] as const) {
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error(`Combat micro ${label} must be finite and > 0.`);
    }
  }
  if (rules.pressureBreakRange <= rules.attackRange) {
    throw new Error("Combat micro pressureBreakRange must exceed attackRange.");
  }
  for (const [label, value] of [
    ["pressureTicks", rules.pressureTicks],
    ["recoveryTicks", rules.recoveryTicks],
    ["hostileHealth", rules.hostileHealth],
    ["strikeDamage", rules.strikeDamage]
  ] as const) {
    if (!Number.isInteger(value) || value <= 0) {
      throw new Error(`Combat micro ${label} must be a positive integer.`);
    }
  }
}

function assertSnapshot(snapshot: CombatMicroSnapshot): void {
  if (!Number.isInteger(snapshot.phaseTicksRemaining) || snapshot.phaseTicksRemaining < 0) {
    throw new Error("Combat micro phaseTicksRemaining must be a non-negative integer.");
  }
  if (!Number.isInteger(snapshot.hostileHealth) || snapshot.hostileHealth < 0) {
    throw new Error("Combat micro hostileHealth must be a non-negative integer.");
  }
  if (!Number.isInteger(snapshot.playerHitCount) || snapshot.playerHitCount < 0) {
    throw new Error("Combat micro playerHitCount must be a non-negative integer.");
  }
  if (
    (snapshot.phase === "PRESSURING" || snapshot.phase === "RECOVERING") &&
    snapshot.phaseTicksRemaining <= 0
  ) {
    throw new Error(`${snapshot.phase} requires positive phaseTicksRemaining.`);
  }
  if (
    (snapshot.phase === "APPROACHING" || snapshot.phase === "DEFEATED") &&
    snapshot.phaseTicksRemaining !== 0
  ) {
    throw new Error(`${snapshot.phase} requires phaseTicksRemaining = 0.`);
  }
  if (snapshot.phase === "DEFEATED" && snapshot.hostileHealth !== 0) {
    throw new Error("DEFEATED requires hostileHealth = 0.");
  }
}

function clone(snapshot: CombatMicroSnapshot): CombatMicroSnapshot {
  return {
    ...snapshot,
    lastSuccessfulStrikers: [...snapshot.lastSuccessfulStrikers],
    successfulStrikeHistory: [...snapshot.successfulStrikeHistory]
  };
}

function actorPosition(frame: CombatMicroPostPhysicsFrame, actorId: ActorId): Vec2 {
  return actorId === "player" ? frame.playerPosition : frame.companionPosition;
}

function validateAttempts(
  attempts: readonly CombatMicroActionAttempt[]
): CombatMicroActionAttempt[] {
  const byActor = new Map<ActorId, CombatMicroActionAttempt>();
  for (const attempt of attempts) {
    if (attempt.kind !== "STRIKE" || attempt.targetId !== "hostile") {
      throw new Error("Combat micro accepts only STRIKE attempts against hostile.");
    }
    if (byActor.has(attempt.actorId)) {
      throw new Error(`Duplicate combat-micro action from ${attempt.actorId}.`);
    }
    byActor.set(attempt.actorId, { ...attempt });
  }
  return [...byActor.values()].sort((a, b) => a.actorId.localeCompare(b.actorId));
}

function resolveAttemptOutcomes(
  input: ResolveCombatMicroTickInput,
  attempts: readonly CombatMicroActionAttempt[]
): CombatMicroActionOutcome[] {
  const active =
    input.before.phase === "APPROACHING" ||
    input.before.phase === "PRESSURING";

  return attempts.map((attempt) => {
    const d = distance(
      actorPosition(input.postPhysics, attempt.actorId),
      input.postPhysics.hostilePosition
    );
    const base = {
      observationTick: input.observationTick,
      outcomeTick: input.observationTick + 1,
      actorId: attempt.actorId,
      kind: "STRIKE" as const,
      targetId: "hostile" as const,
      phaseObserved: input.before.phase,
      distance: d,
      requiredRange: input.rules.strikeRange
    };

    if (!active) {
      return {
        ...base,
        status: "INACTIVE_PHASE" as const,
        reason: `STRIKE cannot affect hostile during ${input.before.phase}`
      };
    }
    if (d > input.rules.strikeRange + EPSILON) {
      return {
        ...base,
        status: "OUT_OF_RANGE" as const,
        reason:
          `STRIKE distance ${d.toFixed(3)} exceeds range ${input.rules.strikeRange.toFixed(3)}`
      };
    }
    return {
      ...base,
      status: "SUCCEEDED" as const,
      reason:
        `STRIKE is materially valid at distance ${d.toFixed(3)} within range ${input.rules.strikeRange.toFixed(3)}`
    };
  });
}

export function initialCombatMicroSnapshot(rules: CombatMicroRules): CombatMicroSnapshot {
  assertRules(rules);
  return {
    phase: "APPROACHING",
    phaseTicksRemaining: 0,
    hostileHealth: rules.hostileHealth,
    playerHitCount: 0,
    lastOutcome: "NONE",
    lastOutcomeTick: null,
    lastSuccessfulStrikers: [],
    successfulStrikeHistory: []
  };
}

/**
 * Bounded combat-situation spike.
 *
 * This is intentionally not a combat framework. It exists to test whether one
 * shared material problem can support several responsibility allocations
 * without a hidden timing oracle or passive body placement counting as help.
 *
 * Ordering:
 * 1. one shared post-physics frame already exists;
 * 2. player/companion STRIKE attempts are validated simultaneously;
 * 3. successful explicit actions resolve before hostile pressure consequence;
 * 4. if nobody lands an action, movement may still break hostile pressure;
 * 5. otherwise the hostile pressure clock advances.
 */
export function resolveCombatMicroAfterPhysics(
  input: ResolveCombatMicroTickInput
): ResolveCombatMicroTickResult {
  if (!Number.isInteger(input.observationTick) || input.observationTick < 0) {
    throw new Error("Combat micro observationTick must be a non-negative integer.");
  }
  assertRules(input.rules);
  assertSnapshot(input.before);

  const attempts = validateAttempts(input.attempts);
  const actionOutcomes = resolveAttemptOutcomes(input, attempts);
  const successfulActors = actionOutcomes
    .filter((outcome) => outcome.status === "SUCCEEDED")
    .map((outcome) => outcome.actorId)
    .sort((a, b) => a.localeCompare(b));
  const outcomeTick = input.observationTick + 1;

  if (input.before.phase === "DEFEATED") {
    return {
      after: clone(input.before),
      actionOutcomes,
      episodeOutcome: "NONE"
    };
  }

  if (successfulActors.length > 0) {
    const damage = successfulActors.length * input.rules.strikeDamage;
    const hostileHealth = Math.max(0, input.before.hostileHealth - damage);
    const defeated = hostileHealth === 0;
    const episodeOutcome: CombatMicroEpisodeOutcome = defeated
      ? "HOSTILE_DEFEATED"
      : "HOSTILE_STRUCK";

    return {
      after: {
        ...clone(input.before),
        phase: defeated ? "DEFEATED" : "RECOVERING",
        phaseTicksRemaining: defeated ? 0 : input.rules.recoveryTicks,
        hostileHealth,
        lastOutcome: episodeOutcome,
        lastOutcomeTick: outcomeTick,
        lastSuccessfulStrikers: successfulActors,
        successfulStrikeHistory: [
          ...input.before.successfulStrikeHistory,
          ...successfulActors
        ]
      },
      actionOutcomes,
      episodeOutcome
    };
  }

  if (input.before.phase === "RECOVERING") {
    const remaining = input.before.phaseTicksRemaining - 1;
    if (remaining > 0) {
      return {
        after: {
          ...clone(input.before),
          phaseTicksRemaining: remaining,
          lastSuccessfulStrikers: []
        },
        actionOutcomes,
        episodeOutcome: "NONE"
      };
    }
    return {
      after: {
        ...clone(input.before),
        phase: "APPROACHING",
        phaseTicksRemaining: 0,
        lastSuccessfulStrikers: []
      },
      actionOutcomes,
      episodeOutcome: "NONE"
    };
  }

  const hostilePlayerDistance = distance(
    input.postPhysics.hostilePosition,
    input.postPhysics.playerPosition
  );

  if (input.before.phase === "APPROACHING") {
    if (hostilePlayerDistance <= input.rules.attackRange + EPSILON) {
      return {
        after: {
          ...clone(input.before),
          phase: "PRESSURING",
          phaseTicksRemaining: input.rules.pressureTicks,
          lastSuccessfulStrikers: []
        },
        actionOutcomes,
        episodeOutcome: "NONE"
      };
    }
    return {
      after: {
        ...clone(input.before),
        lastSuccessfulStrikers: []
      },
      actionOutcomes,
      episodeOutcome: "NONE"
    };
  }

  if (hostilePlayerDistance > input.rules.pressureBreakRange + EPSILON) {
    return {
      after: {
        ...clone(input.before),
        phase: "APPROACHING",
        phaseTicksRemaining: 0,
        lastSuccessfulStrikers: []
      },
      actionOutcomes,
      episodeOutcome: "NONE"
    };
  }

  const remaining = input.before.phaseTicksRemaining - 1;
  if (remaining > 0) {
    return {
      after: {
        ...clone(input.before),
        phaseTicksRemaining: remaining,
        lastSuccessfulStrikers: []
      },
      actionOutcomes,
      episodeOutcome: "NONE"
    };
  }

  return {
    after: {
      ...clone(input.before),
      phase: "RECOVERING",
      phaseTicksRemaining: input.rules.recoveryTicks,
      playerHitCount: input.before.playerHitCount + 1,
      lastOutcome: "PLAYER_HIT",
      lastOutcomeTick: outcomeTick,
      lastSuccessfulStrikers: []
    },
    actionOutcomes,
    episodeOutcome: "PLAYER_HIT"
  };
}
