import type { ContactRecord, Vec2 } from "./types";

export type TaskPressurePhase = "IDLE" | "ACTIVE" | "COMPLETED" | "SETTLED";

export interface TaskPressureRules {
  taskCenters: readonly [Vec2, Vec2];
  taskRadius: number;
  contestRadius: number;
  requiredProgressTicks: number;
  hostileHome: Vec2;
  hostileHomeArrivalRange: number;
}

export interface TaskPressureSnapshot {
  phase: TaskPressurePhase;
  stageIndex: number;
  stageCount: number;
  progressTicks: number;
  requiredProgressTicks: number;
  playerCommitted: boolean;
  contested: boolean;
  playerHostileContact: boolean;
  lastProgressTick: number | null;
  stageCompletionTicks: readonly number[];
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
  if (rules.taskCenters.length !== 2) {
    throw new Error("Task pressure currently requires exactly two visible task stations.");
  }
  for (const [index, center] of rules.taskCenters.entries()) {
    if (!Number.isFinite(center.x) || !Number.isFinite(center.y)) {
      throw new Error(`Task pressure taskCenters[${index}] must be finite.`);
    }
  }
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
    ["hostileHome.x", rules.hostileHome.x],
    ["hostileHome.y", rules.hostileHome.y]
  ] as const) {
    if (!Number.isFinite(value)) throw new Error(`Task pressure ${label} must be finite.`);
  }
}

export function activeTaskPressureCenter(
  snapshot: Pick<TaskPressureSnapshot, "stageIndex">,
  rules: TaskPressureRules
): Vec2 {
  assertRules(rules);
  const index = Math.max(0, Math.min(rules.taskCenters.length - 1, snapshot.stageIndex));
  const center = rules.taskCenters[index]!;
  return { ...center };
}

export function initialTaskPressureSnapshot(rules: TaskPressureRules): TaskPressureSnapshot {
  assertRules(rules);
  return {
    phase: "IDLE",
    stageIndex: 0,
    stageCount: rules.taskCenters.length,
    progressTicks: 0,
    requiredProgressTicks: rules.requiredProgressTicks,
    playerCommitted: false,
    contested: false,
    playerHostileContact: false,
    lastProgressTick: null,
    stageCompletionTicks: [],
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

  const activeCenter = activeTaskPressureCenter(input.before, input.rules);
  const playerCommitted =
    distance(input.playerPosition, activeCenter) <= input.rules.taskRadius + EPSILON;
  const playerHostileContact = input.playerContacts.some(
    (contact) => contact.with === "hostile" && contact.contactCount > 0
  );
  const contested =
    distance(input.hostilePosition, activeCenter) <= input.rules.contestRadius + EPSILON ||
    playerHostileContact;

  if (input.before.phase === "SETTLED") {
    return {
      ...input.before,
      playerCommitted,
      contested: false,
      playerHostileContact,
      stageCompletionTicks: [...input.before.stageCompletionTicks]
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
      playerHostileContact,
      stageCompletionTicks: [...input.before.stageCompletionTicks]
    };
  }

  const active = input.before.phase === "ACTIVE" || playerCommitted;
  if (!active) {
    return {
      ...input.before,
      playerCommitted,
      contested,
      playerHostileContact,
      stageCompletionTicks: [...input.before.stageCompletionTicks]
    };
  }

  const canProgress = playerCommitted && !contested;
  const progressTicks = Math.min(
    input.rules.requiredProgressTicks,
    input.before.progressTicks + (canProgress ? 1 : 0)
  );
  const outcomeTick = input.observationTick + 1;
  const stageComplete = progressTicks >= input.rules.requiredProgressTicks;

  if (!stageComplete) {
    return {
      ...input.before,
      phase: "ACTIVE",
      progressTicks,
      playerCommitted,
      contested,
      playerHostileContact,
      lastProgressTick: canProgress ? outcomeTick : input.before.lastProgressTick,
      stageCompletionTicks: [...input.before.stageCompletionTicks]
    };
  }

  const stageCompletionTicks = [...input.before.stageCompletionTicks, outcomeTick];
  const finalStage = input.before.stageIndex >= input.rules.taskCenters.length - 1;
  if (finalStage) {
    return {
      ...input.before,
      phase: "COMPLETED",
      progressTicks: input.rules.requiredProgressTicks,
      playerCommitted,
      contested: false,
      playerHostileContact,
      lastProgressTick: outcomeTick,
      stageCompletionTicks,
      completionTick: input.before.completionTick ?? outcomeTick
    };
  }

  const nextStageIndex = input.before.stageIndex + 1;
  const nextCenter = input.rules.taskCenters[nextStageIndex]!;
  const nextPlayerCommitted =
    distance(input.playerPosition, nextCenter) <= input.rules.taskRadius + EPSILON;
  const nextContested =
    distance(input.hostilePosition, nextCenter) <= input.rules.contestRadius + EPSILON ||
    playerHostileContact;

  return {
    ...input.before,
    phase: "ACTIVE",
    stageIndex: nextStageIndex,
    progressTicks: 0,
    playerCommitted: nextPlayerCommitted,
    contested: nextContested,
    playerHostileContact,
    lastProgressTick: outcomeTick,
    stageCompletionTicks,
    completionTick: null
  };
}
