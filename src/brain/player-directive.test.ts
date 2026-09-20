import { describe, expect, it } from "vitest";
import {
  PlayerDirectiveRuntime,
  arbitrateCompanionAction
} from "./player-directive";
import type { StageBPartnerAction } from "./stage-b-partner";

const regroup: StageBPartnerAction = {
  kind: "REGROUP",
  objectiveKey: null,
  target: null,
  reason: "no active shared threat"
};

const threat: StageBPartnerAction = {
  kind: "RESPOND_TO_THREAT",
  objectiveKey: "stage-b-pressure:3",
  target: { x: 9, y: 2 },
  reason: "active shared-world threat has priority over ordinary relationship positioning"
};

describe("player directive / local autonomy seam", () => {
  it("defaults to AT_WILL and preserves autonomous threat responsibility", () => {
    const runtime = new PlayerDirectiveRuntime();
    const decision = arbitrateCompanionAction({
      directive: runtime.snapshot(),
      autonomousProposal: threat,
      relationshipTarget: { x: 4, y: 4 }
    });

    expect(decision.directive.kind).toBe("AT_WILL");
    expect(decision.source).toBe("AUTONOMY");
    expect(decision.selectedKind).toBe("RESPOND_TO_THREAT");
    expect(decision.target).toEqual({ x: 9, y: 2 });
  });

  it("FOLLOW_ME can visibly override an autonomous threat proposal without deleting it", () => {
    const runtime = new PlayerDirectiveRuntime();
    runtime.issue("FOLLOW_ME", 120, { x: 6, y: 4 });

    const decision = arbitrateCompanionAction({
      directive: runtime.snapshot(),
      autonomousProposal: threat,
      relationshipTarget: { x: 4, y: 4 }
    });

    expect(decision.source).toBe("PLAYER_DIRECTIVE");
    expect(decision.selectedKind).toBe("FOLLOW_PLAYER");
    expect(decision.target).toEqual({ x: 4, y: 4 });
    expect(decision.autonomousProposal.kind).toBe("RESPOND_TO_THREAT");
    expect(decision.reason).toContain("outranks");
  });

  it("HOLD_HERE captures the issue position and keeps it stable while the relationship target moves", () => {
    const runtime = new PlayerDirectiveRuntime();
    runtime.issue("HOLD_HERE", 240, { x: 6.5, y: 3.25 });
    const snapshot = runtime.snapshot();

    const decision = arbitrateCompanionAction({
      directive: snapshot,
      autonomousProposal: threat,
      relationshipTarget: { x: 2, y: 7 }
    });

    expect(snapshot.holdAnchor).toEqual({ x: 6.5, y: 3.25 });
    expect(decision.source).toBe("PLAYER_DIRECTIVE");
    expect(decision.selectedKind).toBe("HOLD_POSITION");
    expect(decision.target).toEqual({ x: 6.5, y: 3.25 });
    expect(decision.autonomousProposal.kind).toBe("RESPOND_TO_THREAT");
  });

  it("issuing FOLLOW_ME after HOLD_HERE clears the captured hold responsibility", () => {
    const runtime = new PlayerDirectiveRuntime();
    runtime.issue("HOLD_HERE", 10, { x: 1, y: 2 });
    const next = runtime.issue("FOLLOW_ME", 11, { x: 5, y: 6 });

    expect(next.kind).toBe("FOLLOW_ME");
    expect(next.holdAnchor).toBeNull();

    const decision = arbitrateCompanionAction({
      directive: next,
      autonomousProposal: regroup,
      relationshipTarget: { x: 3, y: 4 }
    });
    expect(decision.selectedKind).toBe("FOLLOW_PLAYER");
  });
});
