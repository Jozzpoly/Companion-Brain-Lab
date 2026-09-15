import type { ActorSnapshot, Vec2 } from "../world/types";

const COMMAND_EPSILON = 0.05;
const MOTION_EPSILON = 0.04;
const DISPLACEMENT_EPSILON = 0.0015;
const SUPPRESSED_SPEED_RATIO = 0.25;
const SELF_ALIGNMENT_MIN = 0.9;
const MATERIAL_ERROR_RATIO = 0.3;

export type OutcomeAttributionState =
  | "SELF_ACTION_SUPPORTED"
  | "SELF_ACTION_CONSTRAINED"
  | "EXTERNAL_DISPLACEMENT_EVIDENT"
  | "MIXED_OR_AMBIGUOUS"
  | "NO_MEANINGFUL_MOTION";

export interface OutcomeAttributionEvidence {
  state: OutcomeAttributionState;
  reason: string;
  commandedSpeed: number;
  requestedSpeed: number;
  actualSpeed: number;
  displacement: number;
  commandActualAlignment: number | null;
  commandDisplacementAlignment: number | null;
  motionError: number;
  contacts: readonly string[];
  finalConstraintIntervened: boolean;
}

function magnitude(value: Vec2): number {
  return Math.hypot(value.x, value.y);
}

function subtract(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

function alignment(a: Vec2, b: Vec2, epsilon: number): number | null {
  const aLength = magnitude(a);
  const bLength = magnitude(b);
  if (aLength <= epsilon || bLength <= epsilon) return null;
  return (a.x * b.x + a.y * b.y) / (aLength * bLength);
}

export function evaluateOutcomeAttribution(input: {
  before: ActorSnapshot;
  after: ActorSnapshot;
  commandedVelocity: Vec2;
  finalConstraintIntervened?: boolean;
}): OutcomeAttributionEvidence {
  if (input.before.id !== input.after.id) {
    throw new Error("Outcome attribution requires before/after snapshots for the same actor.");
  }
  if (![input.commandedVelocity.x, input.commandedVelocity.y].every(Number.isFinite)) {
    throw new Error("Outcome attribution requires a finite commanded velocity.");
  }

  const displacementVector = subtract(input.after.position, input.before.position);
  const commandedSpeed = magnitude(input.commandedVelocity);
  const requestedSpeed = magnitude(input.after.requestedVelocity);
  const actualSpeed = magnitude(input.after.actualVelocity);
  const displacement = magnitude(displacementVector);
  const commandActualAlignment = alignment(input.commandedVelocity, input.after.actualVelocity, MOTION_EPSILON);
  const commandDisplacementAlignment = alignment(input.commandedVelocity, displacementVector, DISPLACEMENT_EPSILON);
  const contacts = input.after.contacts.map((contact) => contact.with);
  const hasContact = contacts.length > 0;
  const hasPlayerContact = contacts.includes("player");
  const finalConstraintIntervened = input.finalConstraintIntervened ?? false;

  const base = {
    commandedSpeed,
    requestedSpeed,
    actualSpeed,
    displacement,
    commandActualAlignment,
    commandDisplacementAlignment,
    motionError: input.after.motionError,
    contacts,
    finalConstraintIntervened
  };

  if (commandedSpeed <= COMMAND_EPSILON) {
    if (actualSpeed <= MOTION_EPSILON && displacement <= DISPLACEMENT_EPSILON) {
      return {
        ...base,
        state: "NO_MEANINGFUL_MOTION",
        reason: "submitted command and observed body motion are both negligible"
      };
    }
    if (hasContact) {
      return {
        ...base,
        state: "EXTERNAL_DISPLACEMENT_EVIDENT",
        reason: "body moved materially under a near-zero submitted command while contact evidence was present"
      };
    }
    return {
      ...base,
      state: "MIXED_OR_AMBIGUOUS",
      reason: "body moved materially under a near-zero submitted command without enough contact evidence to identify the source"
    };
  }

  const stronglySuppressed =
    actualSpeed <= MOTION_EPSILON ||
    actualSpeed < commandedSpeed * SUPPRESSED_SPEED_RATIO;
  if (stronglySuppressed && (hasContact || finalConstraintIntervened)) {
    return {
      ...base,
      state: "SELF_ACTION_CONSTRAINED",
      reason: finalConstraintIntervened
        ? "submitted action was materially altered or suppressed by downstream physical authority"
        : "submitted action was materially suppressed while contact evidence was present"
    };
  }

  const errorRatio = commandedSpeed > COMMAND_EPSILON
    ? input.after.motionError / commandedSpeed
    : 0;
  const alignedActual = commandActualAlignment !== null && commandActualAlignment >= SELF_ALIGNMENT_MIN;
  const alignedDisplacement =
    commandDisplacementAlignment === null || commandDisplacementAlignment >= SELF_ALIGNMENT_MIN;

  if (
    alignedActual &&
    alignedDisplacement &&
    errorRatio <= MATERIAL_ERROR_RATIO &&
    !hasContact &&
    !finalConstraintIntervened
  ) {
    return {
      ...base,
      state: "SELF_ACTION_SUPPORTED",
      reason: "observed velocity and displacement are aligned with the submitted action without material contact or downstream intervention"
    };
  }

  if (hasPlayerContact) {
    return {
      ...base,
      state: "MIXED_OR_AMBIGUOUS",
      reason: "submitted action and material player contact coexist, so causal ownership of the resulting motion is mixed"
    };
  }

  if (hasContact || finalConstraintIntervened) {
    return {
      ...base,
      state: "SELF_ACTION_CONSTRAINED",
      reason: finalConstraintIntervened
        ? "downstream physical authority intervened in the submitted action"
        : "contact evidence materially complicates execution of the submitted action"
    };
  }

  return {
    ...base,
    state: "MIXED_OR_AMBIGUOUS",
    reason: "observed motion does not support confident self-action attribution and no external cause is sufficiently evidenced"
  };
}
