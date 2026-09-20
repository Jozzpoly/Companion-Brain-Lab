import { describe, expect, it } from "vitest";
import {
  FOLLOW_AUTONOMY_RADIUS,
  HOLD_AUTONOMY_RADIUS,
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

function threat(x: number, y: number): StageBPartnerAction {
  return {
    kind: "RESPOND_TO_THREAT",
    objectiveKey: "stage-b-pressure:3",
    target: { x, y },
    reason: "active shared-world threat has priority over ordinary relationship positioning"
  };
}

describe("player directive / local autonomy seam", () => {
  it("defaults to AT_WILL and preserves autonomous threat responsibility", () => {
    const runtime = new PlayerDirectiveRuntime();
    const decision = arbitrateCompanionAction({
      directive: runtime.snapshot(),
      autonomousProposal: threat(9, 2),
      relationshipTarget: { x: 4, y: 4 },
      playerPosition: { x: 3, y: 4 }
    });

    expect(decision.directive.kind).toBe("AT_WILL");
    expect(decision.source).toBe("AUTONOMY");
    expect(decision.selectedKind).toBe("RESPOND_TO_THREAT");
    expect(decision.compatibility).toBe("UNCONSTRAINED");
  });

  it("FOLLOW_ME blocks a distant autonomous excursion but keeps the proposal visible", () => {
    const runtime = new PlayerDirectiveRuntime();
    runtime.issue("FOLLOW_ME", 120, { x: 4, y: 4 });

    const decision = arbitrateCompanionAction({
      directive: runtime.snapshot(),
      autonomousProposal: threat(9, 4),
      relationshipTarget: { x: 4, y: 4 },
      playerPosition: { x: 3, y: 4 }
    });

    expect(decision.source).toBe("PLAYER_DIRECTIVE");
    expect(decision.selectedKind).toBe("FOLLOW_PLAYER");
    expect(decision.autonomousProposal.kind).toBe("RESPOND_TO_THREAT");
    expect(decision.compatibility).toBe("BLOCKED");
    expect(decision.constraintDistance).toBe(6);
    expect(decision.constraintLimit).toBe(FOLLOW_AUTONOMY_RADIUS);
  });

  it("FOLLOW_ME permits local autonomous protection inside the player leash", () => {
    const runtime = new PlayerDirectiveRuntime();
    runtime.issue("FOLLOW_ME", 120, { x: 4, y: 4 });

    const decision = arbitrateCompanionAction({
      directive: runtime.snapshot(),
      autonomousProposal: threat(5.5, 4),
      relationshipTarget: { x: 4, y: 4 },
      playerPosition: { x: 3, y: 4 }
    });

    expect(decision.source).toBe("AUTONOMY");
    expect(decision.selectedKind).toBe("RESPOND_TO_THREAT");
    expect(decision.compatibility).toBe("COMPATIBLE");
    expect(decision.constraintDistance).toBe(2.5);
    expect(decision.constraintLimit).toBe(FOLLOW_AUTONOMY_RADIUS);
  });

  it("HOLD_HERE blocks distant initiative but permits a threat inside the held responsibility envelope", () => {
    const runtime = new PlayerDirectiveRuntime();
    runtime.issue("HOLD_HERE", 240, { x: 6.5, y: 3.25 });
    const snapshot = runtime.snapshot();

    const blocked = arbitrateCompanionAction({
      directive: snapshot,
      autonomousProposal: threat(10, 3.25),
      relationshipTarget: { x: 2, y: 7 },
      playerPosition: { x: 3, y: 4 }
    });
    expect(blocked.selectedKind).toBe("HOLD_POSITION");
    expect(blocked.source).toBe("PLAYER_DIRECTIVE");
    expect(blocked.compatibility).toBe("BLOCKED");
    expect(blocked.constraintLimit).toBe(HOLD_AUTONOMY_RADIUS);

    const compatible = arbitrateCompanionAction({
      directive: snapshot,
      autonomousProposal: threat(8.5, 3.25),
      relationshipTarget: { x: 2, y: 7 },
      playerPosition: { x: 3, y: 4 }
    });
    expect(compatible.selectedKind).toBe("RESPOND_TO_THREAT");
    expect(compatible.source).toBe("AUTONOMY");
    expect(compatible.compatibility).toBe("COMPATIBLE");
    expect(compatible.target).toEqual({ x: 8.5, y: 3.25 });
  });

  it("issuing FOLLOW_ME after HOLD_HERE clears the captured hold responsibility", () => {
    const runtime = new PlayerDirectiveRuntime();
    runtime.issue("HOLD_HERE", 10, { x: 1, y: 2 });
    const next = runtime.issue("FOLLOW_ME", 11, { x: 5, y: 6 });
    expect(next.holdAnchor).toBeNull();

    const decision = arbitrateCompanionAction({
      directive: next,
      autonomousProposal: regroup,
      relationshipTarget: { x: 3, y: 4 },
      playerPosition: { x: 2, y: 4 }
    });
    expect(decision.selectedKind).toBe("FOLLOW_PLAYER");
  });
});
