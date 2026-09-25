import type { ContactRecord, Vec2 } from "./types";

export type TaskPressurePhase = "IDLE" | "ACTIVE" | "COMPLETED" | "SETTLED";

export interface TaskPressureRules {
  taskCenter: Vec2;
  taskRadius: number;
  contestRadius: number;
  requiredProgressTicks: number;
  hostileHome: Vec2;
  hostileHomeArrivalRange: number;
}

export interface TaskPressureSnapshot {
  phase: TaskPressurePhase;
  progressTicks: number;
  requiredProgressTicks: number;
  playerCommitted: boolean;
  contested: boolean;
  playerHostileContact: boolean;
  lastProgressTick: number | null;
  completionTick: number | null;
}

export interface ResolveTaskPressureInput {
  observationTick: number;
  before: TaskPressureSnapshot;
  playerPosition: Vec2;
  hostilePosition: Vec2;
  playerContacts: readonly ContactRecord[];
  rules: TaskPressureRules;
}

const EPSILON = 1e-9;

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function assertRules(rules: TaskPressureRules): void {
  for (const [label, value] of [
    ["taskRadius", rules.taskRadius],
    ["contestRadius", rules.contestRadius],
    ["hostileHomeArrivalRange", rules.hostileHomeArrivalRange]
  ] as const) {
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error(`Task pressure ${label} must be finite and > 0.`);
    }
  }
  if (!Number.isInteger(rules.requiredProgressTicks) || rules.requiredProgressTicks <= 0) {
    throw new Error("Task pressure requiredProgressTicks must be a positive integer.");
  }
  for (const [label, value] of [
    ["taskCenter.x", rules.taskCenter.x],
    ["taskCenter.y", rules.taskCenter.y],
    ["hostileHome.x", rules.hostileHome.x],
    ["hostileHome.y", rules.hostileHome.y]
  ] as const) {
    if (!Number.isFinite(value)) throw new Error(`Task pressure ${label} must be finite.`);
  }
}

export function initialTaskPressureSnapshot(rules: TaskPressureRules): TaskPressureSnapshot {
  assertRules(rules);
  return {
    phase: "IDLE",
    progressTicks: 0,
    requiredProgressTicks: rules.requiredProgressTicks,
    playerCommitted: false,
    contested: false,
    playerHostileContact: false,
    lastProgressTick: null,
    completionTick: null
  };
}

export function resolveTaskPressureAfterPhysics(
  input: ResolveTaskPressureInput
): TaskPressureSnapshot {
  assertRules(input.rules);
  if (!Number.isInteger(input.observationTick) || input.observationTick < 0) {
    throw new Error("Task pressure observationTick must be a non-negative integer.");
  }

  const playerCommitted =
    distance(input.playerPosition, input.rules.taskCenter) <= input.rules.taskRadius + EPSILON;
  const playerHostileContact = input.playerContacts.some(
    (contact) => contact.with === "hostile" && contact.contactCount > 0
  );
  const contested =
    distance(input.hostilePosition, input.rules.taskCenter) <= input.rules.contestRadius + EPSILON ||
    playerHostileContact;

  if (input.before.phase === "SETTLED") {
    return {
      ...input.before,
      playerCommitted,
      contested: false,
      playerHostileContact
    };
  }

  if (input.before.phase === "COMPLETED") {
    const hostileHome =
      distance(input.hostilePosition, input.rules.hostileHome) <=
      input.rules.hostileHomeArrivalRange + EPSILON;
    return {
      ...input.before,
      phase: hostileHome ? "SETTLED" : "COMPLETED",
      playerCommitted,
      contested: false,
      playerHostileContact
    };
  }

  const active = input.before.phase === "ACTIVE" || playerCommitted;
  if (!active) {
    return {
      ...input.before,
      playerCommitted,
      contested,
      playerHostileContact
    };
  }

  const canProgress = playerCommitted && !contested;
  const progressTicks = Math.min(
    input.rules.requiredProgressTicks,
    input.before.progressTicks + (canProgress ? 1 : 0)
  );
  const outcomeTick = input.observationTick + 1;
  const complete = progressTicks >= input.rules.requiredProgressTicks;

  return {
    phase: complete ? "COMPLETED" : "ACTIVE",
    progressTicks,
    requiredProgressTicks: input.rules.requiredProgressTicks,
    playerCommitted,
    contested,
    playerHostileContact,
    lastProgressTick: canProgress ? outcomeTick : input.before.lastProgressTick,
    completionTick: complete
      ? input.before.completionTick ?? outcomeTick
      : input.before.completionTick
  };
}
