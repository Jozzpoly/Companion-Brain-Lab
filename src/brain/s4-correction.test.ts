import { describe, expect, it } from "vitest";
import { applyS4Correction } from "./s4-correction";
import type { S3MaterialContributionProposal } from "./s3-material-contribution";

function proposal(
  kind: S3MaterialContributionProposal["kind"]
): S3MaterialContributionProposal {
  if (kind === "APPROACH_INTERVENTION") {
    return {
      kind,
      motionIntent: { actorId: "companion", move: { x: -1, y: 0 } },
      actionAttempt: null,
      focusId: "hostile",
      distanceToFocus: 1.4,
      reason: "raw approach"
    };
  }
  if (kind === "INTERVENE") {
    return {
      kind,
      motionIntent: { actorId: "companion", move: { x: 0, y: 0 } },
      actionAttempt: {
        actorId: "companion",
        kind: "INTERVENE",
        targetId: "hostile"
      },
      focusId: "hostile",
      distanceToFocus: 0.8,
      reason: "raw intervene"
    };
  }
  return {
    kind: "NONE",
    motionIntent: { actorId: "companion", move: { x: 0, y: 0 } },
    actionAttempt: null,
    focusId: null,
    distanceToFocus: null,
    reason: "raw none"
  };
}

describe("S4 correction seam", () => {
  it("passes raw S3 execution through when no correction exists", () => {
    const raw = proposal("INTERVENE");
    const result = applyS4Correction({ proposal: raw, correction: "NONE" });

    expect(result.blocked).toBe(false);
    expect(result.rawProposalKind).toBe("INTERVENE");
    expect(result.effectiveActionAttempt).toEqual(raw.actionAttempt);
    expect(result.effectiveMotionIntent).toEqual(raw.motionIntent);
  });

  it("withholds approach execution without rewriting the raw proposal", () => {
    const result = applyS4Correction({
      proposal: proposal("APPROACH_INTERVENTION"),
      correction: "WITHHOLD_CURRENT_CONTRIBUTION"
    });

    expect(result.blocked).toBe(true);
    expect(result.rawProposalKind).toBe("APPROACH_INTERVENTION");
    expect(result.effectiveMotionIntent.move).toEqual({ x: 0, y: 0 });
    expect(result.effectiveActionAttempt).toBeNull();
  });

  it("withholds a material action without rewriting the raw proposal", () => {
    const result = applyS4Correction({
      proposal: proposal("INTERVENE"),
      correction: "WITHHOLD_CURRENT_CONTRIBUTION"
    });

    expect(result.blocked).toBe(true);
    expect(result.rawProposalKind).toBe("INTERVENE");
    expect(result.effectiveMotionIntent.move).toEqual({ x: 0, y: 0 });
    expect(result.effectiveActionAttempt).toBeNull();
  });

  it("an armed correction does not fabricate a blocked action when S3 proposes nothing", () => {
    const result = applyS4Correction({
      proposal: proposal("NONE"),
      correction: "WITHHOLD_CURRENT_CONTRIBUTION"
    });

    expect(result.blocked).toBe(false);
    expect(result.rawProposalKind).toBe("NONE");
    expect(result.effectiveMotionIntent.move).toEqual({ x: 0, y: 0 });
    expect(result.effectiveActionAttempt).toBeNull();
  });
});
