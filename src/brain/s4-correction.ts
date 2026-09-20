import type { S3MaterialContributionProposal } from "./s3-material-contribution";
import type { MotionIntent } from "../world/types";
import type { WorldActionAttempt } from "../world/shared-danger-contract";

export type S4CorrectionKind = "NONE" | "WITHHOLD_CURRENT_CONTRIBUTION";

export interface S4CorrectionDecision {
  kind: "S4_CORRECTION_DECISION";
  correction: S4CorrectionKind;
  blocked: boolean;
  rawProposalKind: S3MaterialContributionProposal["kind"];
  effectiveMotionIntent: MotionIntent;
  effectiveActionAttempt: WorldActionAttempt | null;
  reason: string;
}

function zeroCompanionIntent(): MotionIntent {
  return {
    actorId: "companion",
    move: { x: 0, y: 0 }
  };
}

function cloneIntent(value: MotionIntent): MotionIntent {
  return {
    actorId: value.actorId,
    move: { ...value.move }
  };
}

function cloneAttempt(value: WorldActionAttempt | null): WorldActionAttempt | null {
  return value ? { ...value } : null;
}

/**
 * S4 is deliberately downstream of cognition.
 *
 * The raw S3 proposal remains intact and inspectable. A player correction may
 * constrain execution, but it is not allowed to rewrite S2 responsibility or
 * pretend that the companion never proposed the contribution.
 */
export function applyS4Correction(input: {
  proposal: S3MaterialContributionProposal;
  correction: S4CorrectionKind;
}): S4CorrectionDecision {
  if (input.correction === "NONE") {
    return {
      kind: "S4_CORRECTION_DECISION",
      correction: "NONE",
      blocked: false,
      rawProposalKind: input.proposal.kind,
      effectiveMotionIntent: cloneIntent(input.proposal.motionIntent),
      effectiveActionAttempt: cloneAttempt(input.proposal.actionAttempt),
      reason: "no player correction constrains the current material contribution"
    };
  }

  if (input.proposal.kind === "NONE") {
    return {
      kind: "S4_CORRECTION_DECISION",
      correction: "WITHHOLD_CURRENT_CONTRIBUTION",
      blocked: false,
      rawProposalKind: "NONE",
      effectiveMotionIntent: zeroCompanionIntent(),
      effectiveActionAttempt: null,
      reason:
        "player correction is armed, but the companion currently proposes no material contribution to block"
    };
  }

  return {
    kind: "S4_CORRECTION_DECISION",
    correction: "WITHHOLD_CURRENT_CONTRIBUTION",
    blocked: true,
    rawProposalKind: input.proposal.kind,
    effectiveMotionIntent: zeroCompanionIntent(),
    effectiveActionAttempt: null,
    reason:
      "player correction withholds execution of the current companion contribution without rewriting the underlying situated judgement or raw proposal"
  };
}
