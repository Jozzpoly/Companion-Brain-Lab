import { describe, expect, it } from "vitest";
import { evaluateFieldLabTakeoverReadiness } from "./field-lab-takeover-readiness";
import type {
  FieldLabMemberAssignment,
  FieldLabMemberTarget
} from "../squad/field-lab-squad-control";
import type { ActorSnapshot } from "../world/types";

function body(x = 5, y = 5): ActorSnapshot {
  return {
    id: "companion",
    position: { x, y },
    radius: 0.3,
    requestedVelocity: { x: 0, y: 0 },
    actualVelocity: { x: 0, y: 0 },
    motionError: 0,
    contacts: []
  };
}

function assignment(
  mode: FieldLabMemberAssignment["mode"],
  anchor = mode === "FOLLOW" ? null : { x: 3.45, y: 5 }
): FieldLabMemberAssignment {
  return {
    memberId: "companion",
    mode,
    worldAnchor: anchor
  };
}

function target(input: {
  mode: FieldLabMemberAssignment["mode"];
  authority?: FieldLabMemberTarget["authority"];
  x?: number;
  y?: number;
}): FieldLabMemberTarget {
  return {
    memberId: "companion",
    authority: input.authority ?? "FORMATION",
    orderMode: input.mode,
    target:
      input.authority === "DIRECT"
        ? null
        : { x: input.x ?? 5, y: input.y ?? 5 },
    localSlot: { x: 1.55, y: 0 },
    worldAnchor:
      input.mode === "FOLLOW"
        ? { x: 3.45, y: 5 }
        : { x: 3.45, y: 5 }
  };
}

function decide(input: {
  mode: FieldLabMemberAssignment["mode"];
  bodyX?: number;
  targetX?: number;
  authority?: FieldLabMemberTarget["authority"];
  targetValid?: boolean;
}) {
  const t = target({
    mode: input.mode,
    authority: input.authority,
    x: input.targetX
  });
  return evaluateFieldLabTakeoverReadiness({
    body: body(input.bodyX ?? 5),
    assignment: assignment(input.mode),
    target: t,
    targetValid: input.targetValid ?? true,
    slotTolerance: 0.18
  });
}

describe("Field Lab takeover readiness evidence", () => {
  it("recognizes settled HOLD as one independent-anchor preparation provenance", () => {
    const result = decide({ mode: "HOLD" });

    expect(result.prepared).toBe(true);
    expect(result.reasonCode).toBe("READY_INDEPENDENT_ANCHOR_SETTLED");
    expect(result.assignmentMode).toBe("HOLD");
    expect(result.independentWorldAnchor).toBe(true);
    expect(result.settledAtTarget).toBe(true);
    expect(result.source).toBe("FIELD_LAB_HOLD_ARRIVED");
    expect(result.runtimeAuthorityClaim).toBe("NONE_EVIDENCE_ONLY");
  });

  it("recognizes the qualified ARRIVED MOVE counterexample without treating MOVE itself as sufficient", () => {
    const result = decide({ mode: "MOVE", bodyX: 5.02, targetX: 5 });

    expect(result.prepared).toBe(true);
    expect(result.reasonCode).toBe("READY_INDEPENDENT_ANCHOR_SETTLED");
    expect(result.assignmentMode).toBe("MOVE");
    expect(result.targetError).toBeCloseTo(0.02, 6);
    expect(result.source).toBe("FIELD_LAB_MOVE_ARRIVED");
  });

  it("does not call a travelling MOVE prepared merely because it has an independent anchor", () => {
    const result = decide({ mode: "MOVE", bodyX: 5.6, targetX: 5 });

    expect(result.prepared).toBe(false);
    expect(result.reasonCode).toBe("INDEPENDENT_ANCHOR_NOT_SETTLED");
    expect(result.independentWorldAnchor).toBe(true);
    expect(result.settledAtTarget).toBe(false);
  });

  it("keeps FOLLOW distinct even when transiently exactly on its player-relative target", () => {
    const result = decide({ mode: "FOLLOW", bodyX: 5, targetX: 5 });

    expect(result.prepared).toBe(false);
    expect(result.reasonCode).toBe("PLAYER_RELATIVE_FOLLOW");
    expect(result.independentWorldAnchor).toBe(false);
    expect(result.targetError).toBe(0);
  });

  it("does not manufacture readiness from an invalid independent target", () => {
    const result = decide({ mode: "HOLD", targetValid: false });

    expect(result.prepared).toBe(false);
    expect(result.reasonCode).toBe("INVALID_TARGET");
  });

  it("leaves direct puppeteering outside this readiness semantic", () => {
    const result = decide({ mode: "HOLD", authority: "DIRECT" });

    expect(result.prepared).toBe(false);
    expect(result.reasonCode).toBe("DIRECT_AUTHORITY_UNRESOLVED");
    expect(result.authority).toBe("DIRECT");
  });
});
