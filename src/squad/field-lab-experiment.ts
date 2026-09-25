import {
  FIELD_LAB_SQUAD_MEMBERS,
  FieldLabSquadControl,
  type FieldLabSquadControlSnapshot
} from "./field-lab-squad-control";
import type {
  FieldLabLayout,
  FieldLabSituation,
  SquadMemberId,
  Vec2
} from "../world/types";
import type { FieldLabSpawnOverrides } from "../world/scenarios";

export const FIELD_LAB_EXPERIMENT_SCHEMA = "companion-field-lab-experiment-v1" as const;
export type FieldLabExperimentSlot = "A" | "B";

export interface FieldLabExperimentRecord {
  schema: typeof FIELD_LAB_EXPERIMENT_SCHEMA;
  label: string;
  capturedAtTick: number;
  setup: {
    situation: FieldLabSituation;
    layout: FieldLabLayout;
    control: FieldLabSquadControlSnapshot;
    positions: FieldLabSpawnOverrides;
  };
}

export type FieldLabExperimentDiffCategory =
  | "SITUATION"
  | "ROSTER"
  | "SELECTION"
  | "AUTHORITY"
  | "FORMATION"
  | "ORDERS"
  | "DYNAMICS"
  | "POSITIONS";

export interface FieldLabExperimentDifference {
  category: FieldLabExperimentDiffCategory;
  path: string;
  a: string;
  b: string;
}

export interface FieldLabExperimentDiff {
  equal: boolean;
  differences: readonly FieldLabExperimentDifference[];
  categories: readonly FieldLabExperimentDiffCategory[];
}

const SITUATIONS = ["TRAINING", "PRESSURE", "TASK_PRESSURE"] as const;
const LAYOUTS = ["OPEN", "DOORWAY", "PILLAR", "MIXED"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finite(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${label} must be finite.`);
  }
  return value;
}

function vec(value: unknown, label: string): Vec2 {
  if (!isRecord(value)) throw new Error(`${label} must be an object.`);
  return {
    x: finite(value.x, `${label}.x`),
    y: finite(value.y, `${label}.y`)
  };
}

function clonePositions(value: FieldLabSpawnOverrides): FieldLabSpawnOverrides {
  const squad: Partial<Record<SquadMemberId, Vec2>> = {};
  for (const memberId of FIELD_LAB_SQUAD_MEMBERS) {
    const position = value.squad?.[memberId];
    if (position) squad[memberId] = { ...position };
  }
  return value.player
    ? { player: { ...value.player }, squad }
    : { squad };
}

function validatePositions(value: unknown): FieldLabSpawnOverrides {
  if (!isRecord(value)) throw new Error("Experiment positions must be an object.");
  const squadRaw = value.squad;
  if (squadRaw !== undefined && !isRecord(squadRaw)) {
    throw new Error("Experiment squad positions must be an object.");
  }
  const squad: Partial<Record<SquadMemberId, Vec2>> = {};
  if (isRecord(squadRaw)) {
    for (const memberId of FIELD_LAB_SQUAD_MEMBERS) {
      const candidate = squadRaw[memberId];
      if (candidate !== undefined) squad[memberId] = vec(candidate, `positions.${memberId}`);
    }
  }
  const player = value.player === undefined ? undefined : vec(value.player, "positions.player");
  return player ? { player, squad } : { squad };
}

function validateControl(value: unknown): FieldLabSquadControlSnapshot {
  if (!isRecord(value)) throw new Error("Experiment control snapshot must be an object.");
  const control = new FieldLabSquadControl();
  return control.restore(value as unknown as FieldLabSquadControlSnapshot);
}

function validateRecord(value: unknown): FieldLabExperimentRecord {
  if (!isRecord(value)) throw new Error("Field Lab experiment must be an object.");
  if (value.schema !== FIELD_LAB_EXPERIMENT_SCHEMA) {
    throw new Error(`Unsupported Field Lab experiment schema: ${String(value.schema)}`);
  }
  if (typeof value.label !== "string") throw new Error("Experiment label must be a string.");
  const capturedAtTick = finite(value.capturedAtTick, "capturedAtTick");
  if (!Number.isInteger(capturedAtTick) || capturedAtTick < 0) {
    throw new Error("capturedAtTick must be a non-negative integer.");
  }
  if (!isRecord(value.setup)) throw new Error("Experiment setup must be an object.");
  const situation = value.setup.situation;
  const layout = value.setup.layout;
  if (!SITUATIONS.includes(situation as FieldLabSituation)) {
    throw new Error(`Unknown Field Lab situation: ${String(situation)}`);
  }
  if (!LAYOUTS.includes(layout as FieldLabLayout)) {
    throw new Error(`Unknown Field Lab layout: ${String(layout)}`);
  }
  return {
    schema: FIELD_LAB_EXPERIMENT_SCHEMA,
    label: value.label.slice(0, 80),
    capturedAtTick,
    setup: {
      situation: situation as FieldLabSituation,
      layout: layout as FieldLabLayout,
      control: validateControl(value.setup.control),
      positions: validatePositions(value.setup.positions)
    }
  };
}

export function createFieldLabExperiment(input: {
  label?: string;
  capturedAtTick: number;
  situation: FieldLabSituation;
  layout: FieldLabLayout;
  control: FieldLabSquadControlSnapshot;
  positions: FieldLabSpawnOverrides;
}): FieldLabExperimentRecord {
  return validateRecord({
    schema: FIELD_LAB_EXPERIMENT_SCHEMA,
    label: input.label ?? "",
    capturedAtTick: input.capturedAtTick,
    setup: {
      situation: input.situation,
      layout: input.layout,
      control: input.control,
      positions: clonePositions(input.positions)
    }
  });
}

export function renameFieldLabExperiment(
  record: FieldLabExperimentRecord,
  label: string
): FieldLabExperimentRecord {
  return validateRecord({ ...record, label });
}

export function encodeFieldLabExperiment(record: FieldLabExperimentRecord): string {
  return JSON.stringify(validateRecord(record));
}

export function decodeFieldLabExperiment(serialized: string): FieldLabExperimentRecord {
  return validateRecord(JSON.parse(serialized) as unknown);
}

export function fieldLabExperimentStorageKey(slot: FieldLabExperimentSlot): string {
  return `companion-brain-lab.field-lab.experiment.${slot}.v1`;
}

function fmtNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

function fmtVec(value: Vec2 | null | undefined): string {
  return value ? `(${fmtNumber(value.x)}, ${fmtNumber(value.y)})` : "none";
}

function fmtList(values: readonly string[]): string {
  return values.length > 0 ? values.join(",") : "none";
}

function add(
  differences: FieldLabExperimentDifference[],
  category: FieldLabExperimentDiffCategory,
  path: string,
  a: string,
  b: string
): void {
  if (a === b) return;
  differences.push({ category, path, a, b });
}

function numberDiff(
  differences: FieldLabExperimentDifference[],
  category: FieldLabExperimentDiffCategory,
  path: string,
  a: number,
  b: number,
  epsilon = 1e-6
): void {
  if (Math.abs(a - b) <= epsilon) return;
  differences.push({ category, path, a: fmtNumber(a), b: fmtNumber(b) });
}

function vecDiff(
  differences: FieldLabExperimentDifference[],
  category: FieldLabExperimentDiffCategory,
  path: string,
  a: Vec2 | null | undefined,
  b: Vec2 | null | undefined,
  epsilon = 1e-6
): void {
  if (!a || !b) {
    add(differences, category, path, fmtVec(a), fmtVec(b));
    return;
  }
  if (Math.hypot(a.x - b.x, a.y - b.y) <= epsilon) return;
  differences.push({ category, path, a: fmtVec(a), b: fmtVec(b) });
}

export function diffFieldLabExperiments(
  a: FieldLabExperimentRecord,
  b: FieldLabExperimentRecord
): FieldLabExperimentDiff {
  const left = validateRecord(a);
  const right = validateRecord(b);
  const differences: FieldLabExperimentDifference[] = [];

  add(differences, "SITUATION", "situation", left.setup.situation, right.setup.situation);
  add(differences, "SITUATION", "layout", left.setup.layout, right.setup.layout);

  const ac = left.setup.control;
  const bc = right.setup.control;
  add(differences, "ROSTER", "activeMembers", fmtList(ac.activeMembers), fmtList(bc.activeMembers));
  add(differences, "SELECTION", "selected", fmtList(ac.selected), fmtList(bc.selected));
  add(differences, "SELECTION", "focused", ac.focused, bc.focused);
  add(differences, "AUTHORITY", "directControl", String(ac.directControl), String(bc.directControl));

  numberDiff(differences, "FORMATION", "orientationRadians", ac.orientationRadians, bc.orientationRadians);
  for (const memberId of FIELD_LAB_SQUAD_MEMBERS) {
    const as = ac.slots.find((slot) => slot.memberId === memberId)?.offset;
    const bs = bc.slots.find((slot) => slot.memberId === memberId)?.offset;
    vecDiff(differences, "FORMATION", `slots.${memberId}`, as, bs);

    const aa = ac.assignments.find((assignment) => assignment.memberId === memberId);
    const ba = bc.assignments.find((assignment) => assignment.memberId === memberId);
    add(differences, "ORDERS", `orders.${memberId}.mode`, aa?.mode ?? "missing", ba?.mode ?? "missing");
    vecDiff(
      differences,
      "ORDERS",
      `orders.${memberId}.anchor`,
      aa?.worldAnchor ?? null,
      ba?.worldAnchor ?? null
    );
  }

  numberDiff(differences, "DYNAMICS", "spacingScale", ac.dynamics.spacingScale, bc.dynamics.spacingScale);
  numberDiff(differences, "DYNAMICS", "slotTolerance", ac.dynamics.slotTolerance, bc.dynamics.slotTolerance);
  numberDiff(differences, "DYNAMICS", "responsiveness", ac.dynamics.responsiveness, bc.dynamics.responsiveness);
  numberDiff(differences, "DYNAMICS", "slowdownRadius", ac.dynamics.slowdownRadius, bc.dynamics.slowdownRadius);
  for (const memberId of FIELD_LAB_SQUAD_MEMBERS) {
    const ad = ac.memberDynamics.find((entry) => entry.memberId === memberId);
    const bd = bc.memberDynamics.find((entry) => entry.memberId === memberId);
    for (const key of ["slotTolerance", "responsiveness", "slowdownRadius"] as const) {
      add(
        differences,
        "DYNAMICS",
        `memberDynamics.${memberId}.${key}`,
        ad?.[key] === null || ad?.[key] === undefined ? "inherit" : fmtNumber(ad[key]!),
        bd?.[key] === null || bd?.[key] === undefined ? "inherit" : fmtNumber(bd[key]!)
      );
    }
  }

  vecDiff(differences, "POSITIONS", "positions.player", left.setup.positions.player, right.setup.positions.player);
  for (const memberId of FIELD_LAB_SQUAD_MEMBERS) {
    vecDiff(
      differences,
      "POSITIONS",
      `positions.${memberId}`,
      left.setup.positions.squad?.[memberId],
      right.setup.positions.squad?.[memberId]
    );
  }

  const categories = [...new Set(differences.map((difference) => difference.category))];
  return {
    equal: differences.length === 0,
    differences,
    categories
  };
}
