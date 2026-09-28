import type {
  FieldLabMemberTarget,
  FieldLabMemberAssignment
} from "../squad/field-lab-squad-control";
import type { ActorSnapshot } from "../world/types";

export type FieldLabTakeoverReadinessReasonCode =
  | "READY_INDEPENDENT_ANCHOR_SETTLED"
  | "PLAYER_RELATIVE_FOLLOW"
  | "DIRECT_AUTHORITY_UNRESOLVED"
  | "INVALID_TARGET"
  | "INDEPENDENT_ANCHOR_NOT_SETTLED"
  | "INDEPENDENT_ANCHOR_MOTOR_STILL_ACTIVE";

export interface FieldLabTakeoverReadinessEvidence {
  kind: "FIELD_LAB_TAKEOVER_READINESS_EVIDENCE";
  prepared: boolean;
  reasonCode: FieldLabTakeoverReadinessReasonCode;
  assignmentMode: FieldLabMemberAssignment["mode"];
  authority: FieldLabMemberTarget["authority"];
  independentWorldAnchor: boolean;
  targetValid: boolean;
  targetError: number | null;
  settledThreshold: number;
  settledAtTarget: boolean;
  requestedSpeed: number;
  motorRequestSettled: boolean;
  source: string;
  reason: string;
  runtimeAuthorityClaim: "NONE_EVIDENCE_ONLY";
}

export interface EvaluateFieldLabTakeoverReadinessInput {
  body: ActorSnapshot;
  assignment: FieldLabMemberAssignment;
  target: FieldLabMemberTarget;
  targetValid: boolean;
  slotTolerance: number;
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function speed(value: { x: number; y: number }): number {
  return Math.hypot(value.x, value.y);
}

const MOTOR_SETTLED_EPSILON = 1e-6;

function result(
  input: EvaluateFieldLabTakeoverReadinessInput,
  reasonCode: FieldLabTakeoverReadinessReasonCode,
  prepared: boolean,
  targetError: number | null,
  settledThreshold: number,
  reason: string
): FieldLabTakeoverReadinessEvidence {
  return {
    kind: "FIELD_LAB_TAKEOVER_READINESS_EVIDENCE",
    prepared,
    reasonCode,
    assignmentMode: input.assignment.mode,
    authority: input.target.authority,
    independentWorldAnchor:
      input.assignment.mode !== "FOLLOW" && input.assignment.worldAnchor !== null,
    targetValid: input.targetValid,
    targetError,
    settledThreshold,
    settledAtTarget:
      targetError !== null && targetError <= settledThreshold,
    requestedSpeed: speed(input.body.requestedVelocity),
    motorRequestSettled:
      speed(input.body.requestedVelocity) <= MOTOR_SETTLED_EPSILON,
    source:
      prepared
        ? `FIELD_LAB_${input.assignment.mode}_ARRIVED`
        : `FIELD_LAB_${input.assignment.mode}_${reasonCode}`,
    reason,
    runtimeAuthorityClaim: "NONE_EVIDENCE_ONLY"
  };
}

/**
 * Extracts bounded Field Lab evidence for the manually discovered
 * "prepared / materially available" takeover relation.
 *
 * This is intentionally not a gameplay command semantic and has no action
 * authority. It distinguishes a stable independent spatial responsibility
 * from transient proximity or a moving player-relative FOLLOW frame.
 */
export function evaluateFieldLabTakeoverReadiness(
  input: EvaluateFieldLabTakeoverReadinessInput
): FieldLabTakeoverReadinessEvidence {
  if (!Number.isFinite(input.slotTolerance) || input.slotTolerance <= 0) {
    throw new Error("Field Lab takeover readiness requires finite positive slotTolerance.");
  }

  // Material readiness must follow the actual Field Lab motor stop condition,
  // not the looser display/trial ARRIVED band (1.35 × slotTolerance).
  const settledThreshold = input.slotTolerance;

  if (input.target.authority === "DIRECT") {
    return result(
      input,
      "DIRECT_AUTHORITY_UNRESOLVED",
      false,
      null,
      settledThreshold,
      "C1 is under direct puppeteering authority; this evidence seam does not reinterpret direct control as autonomous preparation"
    );
  }

  if (input.assignment.mode === "FOLLOW") {
    const targetError =
      input.target.target && input.targetValid
        ? distance(input.body.position, input.target.target)
        : null;
    return result(
      input,
      "PLAYER_RELATIVE_FOLLOW",
      false,
      targetError,
      settledThreshold,
      "FOLLOW is player-relative and can move with the player; transient proximity does not establish the independent spatial readiness discovered by the manual campaign"
    );
  }

  if (!input.target.target || !input.targetValid) {
    return result(
      input,
      "INVALID_TARGET",
      false,
      null,
      settledThreshold,
      "C1 has an independent assignment, but its current material target is missing or invalid"
    );
  }

  const targetError = distance(input.body.position, input.target.target);
  if (targetError > settledThreshold) {
    return result(
      input,
      "INDEPENDENT_ANCHOR_NOT_SETTLED",
      false,
      targetError,
      settledThreshold,
      `C1 has an independent ${input.assignment.mode} anchor but is still ${targetError.toFixed(3)}m from its target, outside the material motor-stop tolerance ${settledThreshold.toFixed(3)}m`
    );
  }

  const requestedSpeed = speed(input.body.requestedVelocity);
  if (requestedSpeed > MOTOR_SETTLED_EPSILON) {
    return result(
      input,
      "INDEPENDENT_ANCHOR_MOTOR_STILL_ACTIVE",
      false,
      targetError,
      settledThreshold,
      `C1 is within the independent ${input.assignment.mode} target tolerance, but the Field Lab motor still requests ${requestedSpeed.toFixed(3)} normalized speed; settled readiness waits for the motor request to stop`
    );
  }

  return result(
    input,
    "READY_INDEPENDENT_ANCHOR_SETTLED",
    true,
    targetError,
    settledThreshold,
    `C1 is within the material motor-stop tolerance ${settledThreshold.toFixed(3)}m of an independent ${input.assignment.mode} target and the motor requests no further motion; preparation evidence is present without equating readiness to the command label`
  );
}
