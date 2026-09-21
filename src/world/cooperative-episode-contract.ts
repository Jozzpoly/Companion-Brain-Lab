import type { ActorId, Vec2 } from "./types";

export type CooperativeEpisodePhase =
  | "CALM"
  | "APPROACHING"
  | "PRESSURING"
  | "DRIVEN_BACK"
  | "RESETTING";

export type CooperativeEpisodeOutcome =
  | "NONE"
  | "REPELLED"
  | "PLAYER_HIT";

export interface CooperativeEpisodeRules {
  repelRange: number;
  pressureRange: number;
  pressureBreakRange: number;
  pressureTicks: number;
  drivenBackTicks: number;
  calmTicks: number;
  home: Vec2;
  homeArrivalRange: number;
}

export interface CooperativeEpisodeSnapshot {
  phase: CooperativeEpisodePhase;
  cycle: number;
  phaseTicksRemaining: number;
  lastOutcome: CooperativeEpisodeOutcome;
  lastOutcomeTick: number | null;
  repelledBy: readonly ActorId[];
  drivenBackDirection: Vec2 | null;
}

export interface CooperativeEpisodeActionAttempt {
  actorId: ActorId;
  kind: "REPEL";
  targetId: "hostile";
}

export type CooperativeEpisodeActionStatus =
  | "SUCCEEDED"
  | "OUT_OF_RANGE"
  | "INACTIVE_PHASE";

export interface CooperativeEpisodeActionOutcome {
  observationTick: number;
  outcomeTick: number;
  actorId: ActorId;
  kind: "REPEL";
  targetId: "hostile";
  status: CooperativeEpisodeActionStatus;
  phaseObserved: CooperativeEpisodePhase;
  distance: number;
  requiredRange: number;
  reason: string;
}

export interface CooperativeEpisodePostPhysicsFrame {
  hostilePosition: Vec2;
  playerPosition: Vec2;
  companionPosition: Vec2;
}

export interface ResolveCooperativeEpisodeTickInput {
  observationTick: number;
  before: CooperativeEpisodeSnapshot;
  postPhysics: CooperativeEpisodePostPhysicsFrame;
  attempts: readonly CooperativeEpisodeActionAttempt[];
  rules: CooperativeEpisodeRules;
}

export interface ResolveCooperativeEpisodeTickResult {
  after: CooperativeEpisodeSnapshot;
  actionOutcomes: readonly CooperativeEpisodeActionOutcome[];
  episodeOutcome: CooperativeEpisodeOutcome;
}

const EPSILON = 1e-9;

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function actorPosition(frame: CooperativeEpisodePostPhysicsFrame, actorId: ActorId): Vec2 {
  return actorId === "player" ? frame.playerPosition : frame.companionPosition;
}

function normalize(value: Vec2): Vec2 {
  const length = Math.hypot(value.x, value.y);
  return length > EPSILON
    ? { x: value.x / length, y: value.y / length }
    : { x: 1, y: 0 };
}

function clone(value: CooperativeEpisodeSnapshot): CooperativeEpisodeSnapshot {
  return {
    ...value,
    repelledBy: [...value.repelledBy],
    drivenBackDirection: value.drivenBackDirection
      ? { ...value.drivenBackDirection }
      : null
  };
}

function assertRules(rules: CooperativeEpisodeRules): void {
  for (const [label, value] of [
    ["repelRange", rules.repelRange],
    ["pressureRange", rules.pressureRange],
    ["pressureBreakRange", rules.pressureBreakRange],
    ["homeArrivalRange", rules.homeArrivalRange]
  ] as const) {
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error(`Cooperative episode ${label} must be finite and > 0.`);
    }
  }
  for (const [label, value] of [
    ["pressureTicks", rules.pressureTicks],
    ["drivenBackTicks", rules.drivenBackTicks],
    ["calmTicks", rules.calmTicks]
  ] as const) {
    if (!Number.isInteger(value) || value <= 0) {
      throw new Error(`Cooperative episode ${label} must be a positive integer.`);
    }
  }
  if (rules.pressureBreakRange <= rules.pressureRange) {
    throw new Error("Cooperative episode pressureBreakRange must exceed pressureRange.");
  }
  if (!Number.isFinite(rules.home.x) || !Number.isFinite(rules.home.y)) {
    throw new Error("Cooperative episode home must be finite.");
  }
}

function validateAttempts(
  attempts: readonly CooperativeEpisodeActionAttempt[]
): CooperativeEpisodeActionAttempt[] {
  const byActor = new Map<ActorId, CooperativeEpisodeActionAttempt>();
  for (const attempt of attempts) {
    if (attempt.kind !== "REPEL" || attempt.targetId !== "hostile") {
      throw new Error("Cooperative episode only accepts REPEL attempts against hostile.");
    }
    if (byActor.has(attempt.actorId)) {
      throw new Error(`Duplicate cooperative-episode action from ${attempt.actorId}.`);
    }
    byActor.set(attempt.actorId, { ...attempt });
  }
  return [...byActor.values()].sort((a, b) => a.actorId.localeCompare(b.actorId));
}

function actionOutcomes(
  input: ResolveCooperativeEpisodeTickInput,
  attempts: readonly CooperativeEpisodeActionAttempt[]
): CooperativeEpisodeActionOutcome[] {
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
      kind: "REPEL" as const,
      targetId: "hostile" as const,
      phaseObserved: input.before.phase,
      distance: d,
      requiredRange: input.rules.repelRange
    };
    if (!active) {
      return {
        ...base,
        status: "INACTIVE_PHASE" as const,
        reason: `REPEL has no active threat to affect during ${input.before.phase}`
      };
    }
    if (d > input.rules.repelRange + EPSILON) {
      return {
        ...base,
        status: "OUT_OF_RANGE" as const,
        reason: `REPEL distance ${d.toFixed(3)} exceeds range ${input.rules.repelRange.toFixed(3)}`
      };
    }
    return {
      ...base,
      status: "SUCCEEDED" as const,
      reason: `REPEL materially drives hostile back at distance ${d.toFixed(3)}`
    };
  });
}

function drivenBackDirection(
  frame: CooperativeEpisodePostPhysicsFrame,
  successfulActors: readonly ActorId[]
): Vec2 {
  if (successfulActors.length === 0) {
    return normalize({
      x: frame.hostilePosition.x - frame.playerPosition.x,
      y: frame.hostilePosition.y - frame.playerPosition.y
    });
  }
  const origins = successfulActors.map((id) => actorPosition(frame, id));
  const center = origins.reduce(
    (sum, value) => ({ x: sum.x + value.x, y: sum.y + value.y }),
    { x: 0, y: 0 }
  );
  center.x /= origins.length;
  center.y /= origins.length;
  return normalize({
    x: frame.hostilePosition.x - center.x,
    y: frame.hostilePosition.y - center.y
  });
}

export function initialCooperativeEpisodeSnapshot(
  rules: CooperativeEpisodeRules
): CooperativeEpisodeSnapshot {
  assertRules(rules);
  return {
    phase: "CALM",
    cycle: 0,
    phaseTicksRemaining: rules.calmTicks,
    lastOutcome: "NONE",
    lastOutcomeTick: null,
    repelledBy: [],
    drivenBackDirection: null
  };
}

export function resolveCooperativeEpisodeAfterPhysics(
  input: ResolveCooperativeEpisodeTickInput
): ResolveCooperativeEpisodeTickResult {
  assertRules(input.rules);
  if (!Number.isInteger(input.observationTick) || input.observationTick < 0) {
    throw new Error("Cooperative episode observationTick must be a non-negative integer.");
  }

  const attempts = validateAttempts(input.attempts);
  const outcomes = actionOutcomes(input, attempts);
  const successfulActors = outcomes
    .filter((value) => value.status === "SUCCEEDED")
    .map((value) => value.actorId)
    .sort((a, b) => a.localeCompare(b));
  const outcomeTick = input.observationTick + 1;

  if (successfulActors.length > 0) {
    return {
      after: {
        ...clone(input.before),
        phase: "DRIVEN_BACK",
        phaseTicksRemaining: input.rules.drivenBackTicks,
        lastOutcome: "REPELLED",
        lastOutcomeTick: outcomeTick,
        repelledBy: successfulActors,
        drivenBackDirection: drivenBackDirection(input.postPhysics, successfulActors)
      },
      actionOutcomes: outcomes,
      episodeOutcome: "REPELLED"
    };
  }

  if (input.before.phase === "CALM") {
    const remaining = input.before.phaseTicksRemaining - 1;
    if (remaining > 0) {
      return {
        after: { ...clone(input.before), phaseTicksRemaining: remaining },
        actionOutcomes: outcomes,
        episodeOutcome: "NONE"
      };
    }
    return {
      after: {
        ...clone(input.before),
        phase: "APPROACHING",
        phaseTicksRemaining: 0,
        repelledBy: [],
        drivenBackDirection: null
      },
      actionOutcomes: outcomes,
      episodeOutcome: "NONE"
    };
  }

  if (input.before.phase === "APPROACHING") {
    const d = distance(
      input.postPhysics.hostilePosition,
      input.postPhysics.playerPosition
    );
    if (d <= input.rules.pressureRange + EPSILON) {
      return {
        after: {
          ...clone(input.before),
          phase: "PRESSURING",
          phaseTicksRemaining: input.rules.pressureTicks,
          repelledBy: [],
          drivenBackDirection: null
        },
        actionOutcomes: outcomes,
        episodeOutcome: "NONE"
      };
    }
    return {
      after: clone(input.before),
      actionOutcomes: outcomes,
      episodeOutcome: "NONE"
    };
  }

  if (input.before.phase === "PRESSURING") {
    const d = distance(
      input.postPhysics.hostilePosition,
      input.postPhysics.playerPosition
    );
    if (d > input.rules.pressureBreakRange + EPSILON) {
      return {
        after: {
          ...clone(input.before),
          phase: "APPROACHING",
          phaseTicksRemaining: 0,
          repelledBy: [],
          drivenBackDirection: null
        },
        actionOutcomes: outcomes,
        episodeOutcome: "NONE"
      };
    }

    const remaining = input.before.phaseTicksRemaining - 1;
    if (remaining > 0) {
      return {
        after: { ...clone(input.before), phaseTicksRemaining: remaining },
        actionOutcomes: outcomes,
        episodeOutcome: "NONE"
      };
    }

    return {
      after: {
        ...clone(input.before),
        phase: "DRIVEN_BACK",
        phaseTicksRemaining: input.rules.drivenBackTicks,
        lastOutcome: "PLAYER_HIT",
        lastOutcomeTick: outcomeTick,
        repelledBy: [],
        drivenBackDirection: drivenBackDirection(input.postPhysics, [])
      },
      actionOutcomes: outcomes,
      episodeOutcome: "PLAYER_HIT"
    };
  }

  if (input.before.phase === "DRIVEN_BACK") {
    const remaining = input.before.phaseTicksRemaining - 1;
    if (remaining > 0) {
      return {
        after: { ...clone(input.before), phaseTicksRemaining: remaining },
        actionOutcomes: outcomes,
        episodeOutcome: "NONE"
      };
    }
    return {
      after: {
        ...clone(input.before),
        phase: "RESETTING",
        phaseTicksRemaining: 0
      },
      actionOutcomes: outcomes,
      episodeOutcome: "NONE"
    };
  }

  const homeDistance = distance(
    input.postPhysics.hostilePosition,
    input.rules.home
  );
  if (homeDistance <= input.rules.homeArrivalRange + EPSILON) {
    return {
      after: {
        ...clone(input.before),
        phase: "CALM",
        cycle: input.before.cycle + 1,
        phaseTicksRemaining: input.rules.calmTicks,
        repelledBy: [],
        drivenBackDirection: null
      },
      actionOutcomes: outcomes,
      episodeOutcome: "NONE"
    };
  }

  return {
    after: clone(input.before),
    actionOutcomes: outcomes,
    episodeOutcome: "NONE"
  };
}
